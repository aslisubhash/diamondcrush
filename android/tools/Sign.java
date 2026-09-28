import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK with apksig (scheme v2; minSdk 24+) and verifies the result. */
public class Sign {
    public static void main(String[] a) throws Exception {
        File in = new File(a[0]);
        File out = new File(a[1]);
        char[] pass = a[3].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(a[2])) {
            ks.load(f, pass);
        }
        PrivateKey key = (PrivateKey) ks.getKey(a[4], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[4]);
        ApkSigner.SignerConfig config =
            new ApkSigner.SignerConfig.Builder("DIAMOND", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(config))
            .setInputApk(in)
            .setOutputApk(out)
            .setMinSdkVersion(Integer.parseInt(a[5]))
            .setV1SigningEnabled(false)
            .setV2SigningEnabled(true)
            .build()
            .sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(out).build().verify();
        System.out.println("[apk] verified=" + r.isVerified()
            + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
        for (Object e : r.getErrors()) System.out.println("[apk] error: " + e);
        if (!r.isVerified()) System.exit(1);
    }
}
