#!/usr/bin/env python3
"""Build a signed Android APK of Diamond Crush without the Android SDK.

The game is a static web app, so the APK is a small WebView shell
(src/com/diamondcrush/game/MainActivity.java) plus the game files under
assets/www. Everything the Android toolchain normally does is done here:

  1. fetch build tools from Maven Central (dx, apksig, framework jar)
  2. javac the activity and dex it with dx
  3. encode AndroidManifest.xml (binary XML) and resources.arsc
  4. zip the APK with stored entries 4-byte aligned
  5. sign it (APK signature scheme v2) with apksig and verify the result

Usage: python3 android/build_apk.py [--out dist/DiamondCrush.apk]
Signing key: android/keystore/release.p12 (created on first run; keep it
safe, Android only accepts updates signed with the same key). Override with
DC_KEYSTORE / DC_KEYSTORE_PASS / DC_KEY_ALIAS.
"""
import argparse
import os
import shutil
import struct
import subprocess
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache')
BUILD = os.path.join(HERE, 'build')

PACKAGE = 'com.diamondcrush.game'
LABEL = 'Diamond Crush'
VERSION_CODE = 1
VERSION_NAME = '1.0.0'
MIN_SDK = 24  # Android 7.0+: APK signature scheme v2 alone is valid
TARGET_SDK = 34

MAVEN = 'https://repo1.maven.org/maven2/'
JARS = {
    'dx': 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig': 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
    'android': 'org/robolectric/android-all/11-robolectric-6757853/android-all-11-robolectric-6757853.jar',
}

# Web files shipped in the APK (tests, tools and docs stay out).
WEB_FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg']
WEB_DIRS = ['src', 'fonts']


def log(msg):
    print(f'[apk] {msg}', flush=True)


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(JARS[name]))
    if not os.path.exists(path):
        log(f'downloading {os.path.basename(path)}')
        tmp = path + '.part'
        with urllib.request.urlopen(MAVEN + JARS[name]) as r, open(tmp, 'wb') as f:
            shutil.copyfileobj(r, f)
        os.replace(tmp, path)
    return path


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


# ---------------------------------------------------------------------------
# Binary XML (AXML) and resource table (ARSC) encoding.

RES_NULL = 0x00
TYPE_REFERENCE = 0x01
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_INT_BOOLEAN = 0x12

ANDROID_NS = 'http://schemas.android.com/apk/res/android'

# android.R.attr ids (checked against the framework jar at build time).
ATTR = {
    'theme': 0x01010000,
    'label': 0x01010001,
    'icon': 0x01010002,
    'name': 0x01010003,
    'exported': 0x01010010,
    'launchMode': 0x0101001d,
    'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f,
    'minSdkVersion': 0x0101020c,
    'versionCode': 0x0101021b,
    'versionName': 0x0101021c,
    'targetSdkVersion': 0x01010270,
    'allowBackup': 0x01010280,
    'hardwareAccelerated': 0x010102d3,
}


def pad4(b):
    return b + b'\0' * ((4 - len(b) % 4) % 4)


def string_pool(strings):
    """UTF-16 string pool chunk (RES_STRING_POOL_TYPE)."""
    offsets = []
    data = b''
    for s in strings:
        offsets.append(len(data))
        u = s.encode('utf-16-le')
        data += struct.pack('<H', len(s)) + u + b'\0\0'
    data = pad4(data)
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    body = b''.join(struct.pack('<I', o) for o in offsets) + data
    size = header_size + len(body)
    head = struct.pack('<HHIIIIII', 0x0001, header_size, size, len(strings), 0, 0, strings_start, 0)
    return head + body


class Axml:
    """Tiny writer for Android binary XML documents."""

    def __init__(self):
        self.attr_names = []  # android attribute names, in resource-map order
        self.strings = []
        self.nodes = []

    def s(self, text):
        if text not in self.strings:
            self.strings.append(text)
        return text

    def element(self, name, attrs, children=()):
        return (name, attrs, list(children))

    def encode(self, root):
        # Attribute names with resource ids come first so the resource map
        # lines up with the start of the string pool.
        names = []

        def collect(node):
            _, attrs, kids = node
            for ns, key, _ in attrs:
                if ns and key not in names:
                    names.append(key)
            for k in kids:
                collect(k)
        collect(root)
        names.sort(key=lambda k: ATTR[k])
        pool = list(names)

        def add(t):
            if t not in pool:
                pool.append(t)
            return pool.index(t)

        add('android')
        add(ANDROID_NS)
        body = []

        def value_of(v):
            if isinstance(v, bool):
                return TYPE_INT_BOOLEAN, 0xFFFFFFFF if v else 0, None
            if isinstance(v, tuple) and v[0] == 'ref':
                return TYPE_REFERENCE, v[1], None
            if isinstance(v, tuple) and v[0] == 'hex':
                return TYPE_INT_HEX, v[1], None
            if isinstance(v, int):
                return TYPE_INT_DEC, v, None
            return TYPE_STRING, None, str(v)

        def emit(node):
            name, attrs, kids = node
            ordered = sorted([a for a in attrs if a[0]], key=lambda a: ATTR[a[1]]) + [a for a in attrs if not a[0]]
            enc = b''
            for ns, key, v in ordered:
                typ, data, raw = value_of(v)
                raw_idx = 0xFFFFFFFF
                if raw is not None:
                    raw_idx = add(raw)
                    data = raw_idx
                enc += struct.pack('<IIIHBBI', add(ANDROID_NS) if ns else 0xFFFFFFFF, add(key), raw_idx, 8, 0, typ, data)
            ext = struct.pack('<IIHHHHHH', 0xFFFFFFFF, add(name), 20, 20, len(ordered), 0, 0, 0) + enc
            body.append(struct.pack('<HHIII', 0x0102, 16, 16 + len(ext), 1, 0xFFFFFFFF) + ext)
            for k in kids:
                emit(k)
            body.append(struct.pack('<HHIIIII', 0x0103, 16, 24, 1, 0xFFFFFFFF, 0xFFFFFFFF, add(name)))

        ns_start = struct.pack('<HHIIIII', 0x0100, 16, 24, 1, 0xFFFFFFFF, add('android'), add(ANDROID_NS))
        emit(root)
        ns_end = struct.pack('<HHIIIII', 0x0101, 16, 24, 1, 0xFFFFFFFF, add('android'), add(ANDROID_NS))
        spool = string_pool(pool)
        resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(names)) + b''.join(struct.pack('<I', ATTR[n]) for n in names)
        chunks = spool + resmap + ns_start + b''.join(body) + ns_end
        return struct.pack('<HHI', 0x0003, 8, 8 + len(chunks)) + chunks


def manifest_xml(icon_id):
    A = True
    x = Axml()
    activity = x.element('activity', [
        (A, 'name', '.MainActivity'),
        (A, 'exported', True),
        (A, 'launchMode', 2),  # singleTask
        (A, 'configChanges', ('hex', 0x0FB0)),
        (A, 'theme', ('ref', 0x01030007)),  # Theme.NoTitleBar.Fullscreen
    ], [x.element('intent-filter', [], [
        x.element('action', [(A, 'name', 'android.intent.action.MAIN')]),
        x.element('category', [(A, 'name', 'android.intent.category.LAUNCHER')]),
    ])])
    app = x.element('application', [
        (A, 'label', LABEL),
        (A, 'icon', ('ref', icon_id)),
        (A, 'allowBackup', True),
        (A, 'hardwareAccelerated', True),
    ], [activity])
    root = x.element('manifest', [
        (A, 'versionCode', VERSION_CODE),
        (A, 'versionName', VERSION_NAME),
        (None, 'package', PACKAGE),
    ], [
        x.element('uses-sdk', [(A, 'minSdkVersion', MIN_SDK), (A, 'targetSdkVersion', TARGET_SDK)]),
        app,
    ])
    return x.encode(root)


def resource_table(icons):
    """resources.arsc with one mipmap, ic_launcher, in several densities.

    icons: list of (density, path-in-apk).
    """
    values = string_pool([p for _, p in icons])
    type_strings = string_pool(['mipmap'])
    key_strings = string_pool(['ic_launcher'])
    # Type spec: one entry that varies by density.
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack('<I', 0x0100)
    types = b''
    for i, (density, _) in enumerate(icons):
        config = struct.pack('<IHH2s2sBBHBBBBHHHH', 64, 0, 0, b'\0\0', b'\0\0', 0, 0, density,
                             0, 0, 0, 0, 0, 0, 4, 0)
        config = config.ljust(64, b'\0')
        entries_start = 20 + 64 + 4
        entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, TYPE_STRING, i)
        chunk = struct.pack('<HHIBBHII', 0x0201, 20 + 64, entries_start + len(entry), 1, 0, 0, 1, entries_start)
        types += chunk + config + struct.pack('<I', 0) + entry
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\0')
    header_size = 288
    type_off = header_size
    key_off = type_off + len(type_strings)
    pkg_body = type_strings + key_strings + spec + types
    pkg = struct.pack('<HHII', 0x0200, header_size, header_size + len(pkg_body), 0x7F) + name + \
        struct.pack('<IIIII', type_off, 1, key_off, 1, 0) + pkg_body
    table = values + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(table), 1) + table


# ---------------------------------------------------------------------------


def write_aligned(zf, name, data, compress):
    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    info.external_attr = 0o644 << 16
    if compress:
        info.compress_type = zipfile.ZIP_DEFLATED
    else:
        info.compress_type = zipfile.ZIP_STORED
        # zipalign: pad the local header's extra field so data starts on 4 bytes.
        offset = zf.fp.tell() + 30 + len(name.encode())
        info.extra = b'\0' * ((4 - offset % 4) % 4)
    zf.writestr(info, data)


def ensure_keystore():
    ks = os.environ.get('DC_KEYSTORE', os.path.join(HERE, 'keystore', 'release.p12'))
    pw = os.environ.get('DC_KEYSTORE_PASS', 'diamondcrush')
    alias = os.environ.get('DC_KEY_ALIAS', 'diamondcrush')
    if not os.path.exists(ks):
        os.makedirs(os.path.dirname(ks), exist_ok=True)
        log(f'creating signing key {ks}')
        run(['keytool', '-genkeypair', '-keystore', ks, '-storetype', 'PKCS12', '-storepass', pw,
             '-keypass', pw, '-alias', alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-dname', 'CN=Diamond Crush, O=Diamond Crush, C=IN'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return ks, pw, alias


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist', 'DiamondCrush.apk'))
    args = ap.parse_args()

    dx = fetch('dx')
    apksig = fetch('apksig')
    android = fetch('android')

    shutil.rmtree(BUILD, ignore_errors=True)
    classes = os.path.join(BUILD, 'classes')
    os.makedirs(classes)

    log('compiling the activity')
    sources = []
    for d, _, files in os.walk(os.path.join(HERE, 'src')):
        sources += [os.path.join(d, f) for f in files if f.endswith('.java')]
    run(['javac', '-nowarn', '-Xlint:-options', '--release', '8', '-cp', android, '-d', classes] + sources)

    log('dexing')
    dex = os.path.join(BUILD, 'classes.dex')
    run(['java', '-cp', dx, 'com.android.dx.command.Main', '--dex', f'--min-sdk-version={MIN_SDK}',
         f'--output={dex}', classes])

    log('encoding manifest and resources')
    icons = [(480, 'res/mipmap-xxhdpi-v4/ic_launcher.png'), (640, 'res/mipmap-xxxhdpi-v4/ic_launcher.png')]
    icon_files = {480: os.path.join(HERE, 'res', 'ic_launcher_144.png'), 640: os.path.join(HERE, 'res', 'ic_launcher_192.png')}
    manifest = manifest_xml(0x7F010000)
    arsc = resource_table(icons)

    unsigned = os.path.join(BUILD, 'unsigned.apk')
    log('packaging')
    with zipfile.ZipFile(unsigned, 'w') as zf:
        write_aligned(zf, 'AndroidManifest.xml', manifest, True)
        write_aligned(zf, 'classes.dex', open(dex, 'rb').read(), True)
        write_aligned(zf, 'resources.arsc', arsc, False)
        for density, path in icons:
            write_aligned(zf, path, open(icon_files[density], 'rb').read(), False)
        files = list(WEB_FILES)
        for d in WEB_DIRS:
            for base, _, names in os.walk(os.path.join(ROOT, d)):
                for n in sorted(names):
                    files.append(os.path.relpath(os.path.join(base, n), ROOT))
        for f in sorted(files):
            write_aligned(zf, 'assets/www/' + f.replace(os.sep, '/'), open(os.path.join(ROOT, f), 'rb').read(),
                          not f.endswith(('.png', '.woff2')))

    log('signing (scheme v2)')
    ks, pw, alias = ensure_keystore()
    signer_dir = os.path.join(BUILD, 'signer')
    os.makedirs(signer_dir)
    run(['javac', '-nowarn', '-cp', apksig, '-d', signer_dir, os.path.join(HERE, 'tools', 'Sign.java')])
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    cp = os.pathsep.join([signer_dir, apksig])
    # apksig 2.3 (the newest on Maven Central) reaches into JDK internals.
    opens = []
    for pkg in ('sun.security.x509', 'sun.security.pkcs', 'sun.security.util'):
        opens += ['--add-exports', f'java.base/{pkg}=ALL-UNNAMED']
    run(['java'] + opens + ['-cp', cp, 'Sign', unsigned, args.out, ks, pw, alias, str(MIN_SDK)])
    size = os.path.getsize(args.out)
    log(f'done: {args.out} ({size / 1024:.0f} KB)')


if __name__ == '__main__':
    sys.exit(main())
