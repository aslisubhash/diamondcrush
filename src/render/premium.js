// High-detail treasure art: faceted gems, sculpted rocks, brass-bound
// crates and gilded keys. Each piece is painted once per tile size into an
// offscreen canvas (many facets and gradients) and then blitted, so the
// detail costs nothing per frame. Only the sparkle is animated live.

const cache = new Map();

function makeCanvas(n) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(n, n);
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  return c;
}

// Paint `draw(ctx, n)` into an n x n canvas once and reuse it.
export function cached(key, size, draw) {
  const n = Math.max(8, Math.ceil(size));
  const k = `${key}@${n}`;
  let c = cache.get(k);
  if (!c) {
    if (cache.size > 400) cache.clear();
    c = makeCanvas(n);
    draw(c.getContext('2d'), n);
    cache.set(k, c);
  }
  return c;
}

function blit(ctx, key, s, draw) {
  ctx.drawImage(cached(key, s, draw), 0, 0, s, s);
}

// ---------- helpers ----------

function lerp(a, b, t) { return a + (b - a) * t; }

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Colour ramp sampler: t in 0..1 across the stops.
function ramp(stops, t) {
  const cs = stops.map(hex);
  const x = Math.max(0, Math.min(0.9999, t)) * (cs.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = cs[i];
  const b = cs[i + 1];
  return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
}

function path(ctx, pts, s) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
  ctx.closePath();
}

// Seeded random, so each piece of art is the same on every device.
function rng(seed) {
  let x = seed | 0 || 1;
  return () => {
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

function shadow(ctx, s, w, y = 0.9, a = 0.35) {
  const g = ctx.createRadialGradient(s * 0.5, s * y, 0, s * 0.5, s * y, s * w);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(s * 0.5, s * y);
  ctx.scale(1, 0.28);
  ctx.translate(-s * 0.5, -s * y);
  ctx.beginPath();
  ctx.arc(s * 0.5, s * y, s * w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- gems ----------

// Sapphire ramp: ink navy -> royal blue -> ice white.
const SAPPHIRE = ['#06163f', '#0b2f86', '#1557d6', '#2f8cff', '#7cc8ff', '#e6f7ff'];
const RUBY = ['#2a0209', '#6d0418', '#b3072b', '#e8203f', '#ff6d7f', '#ffe0e4'];
const EMERALD = ['#021f14', '#05502f', '#0b8a4d', '#1fc06f', '#7ff0b1', '#e6fff1'];
const GOLD = ['#3d2a06', '#7a5410', '#b9861e', '#e8bd48', '#fbe39a', '#fffaf0'];

// A round brilliant seen from the front and a little above: table, crown
// star and bezel facets, girdle, and a pavilion of eight facets.
function paintBrilliant(ctx, s, colors) {
  shadow(ctx, s, 0.34, 0.92, 0.4);
  const T1 = [0.33, 0.235];
  const T2 = [0.67, 0.235];
  const TT1 = [0.4, 0.17];
  const TT2 = [0.6, 0.17];
  const gy = 0.45;
  const G = [0.09, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.91].map((x) => [x, gy]);
  const S1 = [0.14, 0.33];
  const S2 = [0.86, 0.33];
  const C = [0.5, 0.9];
  const outline = [TT1, TT2, T2, S2, G[8], C, G[0], S1, T1];

  // Deep body colour first (fills hairline gaps between facets).
  path(ctx, outline, s);
  ctx.fillStyle = colors[1];
  ctx.fill();

  const facet = (pts, t0, t1, gx0 = 0.2, gy0 = 0.1, gx1 = 0.8, gy1 = 0.9) => {
    path(ctx, pts, s);
    const g = ctx.createLinearGradient(gx0 * s, gy0 * s, gx1 * s, gy1 * s);
    g.addColorStop(0, ramp(colors, t0));
    g.addColorStop(1, ramp(colors, t1));
    ctx.fillStyle = g;
    ctx.fill();
  };

  // Pavilion: light enters top-left, bounces back out through the centre.
  const pav = [0.62, 0.34, 0.78, 0.46, 0.7, 0.3, 0.5, 0.18];
  for (let i = 0; i < 8; i++) {
    const t = pav[i];
    facet([G[i], G[i + 1], C], t + 0.12, t - 0.2, G[i][0], gy, 0.5, 0.9);
  }
  // Crown bezels and stars.
  facet([T1, S1, G[0]], 0.86, 0.6, 0.2, 0.2, 0.1, 0.45);
  facet([T1, G[0], G[2]], 0.74, 0.42);
  facet([T1, G[2], G[4]], 0.66, 0.88, 0.3, 0.25, 0.5, 0.45);
  facet([T1, T2, G[4]], 0.92, 0.55, 0.4, 0.2, 0.55, 0.45);
  facet([T2, G[4], G[6]], 0.5, 0.36);
  facet([T2, G[6], G[8]], 0.4, 0.2, 0.6, 0.2, 0.9, 0.45);
  facet([T2, S2, G[8]], 0.32, 0.14, 0.7, 0.2, 0.9, 0.45);
  // Table.
  facet([TT1, TT2, T2, T1], 0.98, 0.7, 0.35, 0.15, 0.65, 0.25);

  // Facet edges: bright on the lit side, dark on the shade side.
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.6, s * 0.009);
  const edge = (a, b, alpha) => {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(a[0] * s, a[1] * s);
    ctx.lineTo(b[0] * s, b[1] * s);
    ctx.stroke();
  };
  for (let i = 0; i <= 8; i++) edge(G[i], C, i < 4 ? 0.28 : 0.12);
  [[T1, G[0]], [T1, G[2]], [T1, G[4]], [T2, G[4]], [T2, G[6]], [T2, G[8]], [T1, T2], [T1, S1], [T2, S2]]
    .forEach(([a, b], i) => edge(a, b, i < 4 || i === 6 ? 0.4 : 0.18));
  // Girdle band.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(0.8, s * 0.014);
  ctx.beginPath();
  ctx.moveTo(G[0][0] * s, gy * s);
  ctx.lineTo(G[8][0] * s, gy * s);
  ctx.stroke();

  // Inner fire: soft light pooled in the pavilion.
  ctx.save();
  path(ctx, outline, s);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const fire = ctx.createRadialGradient(s * 0.46, s * 0.55, 0, s * 0.46, s * 0.55, s * 0.3);
  fire.addColorStop(0, 'rgba(160,220,255,0.45)');
  fire.addColorStop(1, 'rgba(160,220,255,0)');
  ctx.fillStyle = fire;
  ctx.fillRect(0, 0, s, s);
  // Dispersion flecks (spectral "fire" of a real brilliant).
  const r = rng(7);
  const flecks = ['rgba(255,170,60,0.55)', 'rgba(120,255,170,0.45)', 'rgba(210,120,255,0.5)', 'rgba(255,255,255,0.7)'];
  for (let i = 0; i < 7; i++) {
    const x = (0.28 + r() * 0.44) * s;
    const y = (0.3 + r() * 0.34) * s;
    const rad = s * (0.025 + r() * 0.02);
    const fg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    fg.addColorStop(0, flecks[i % flecks.length]);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Glossy sheen on the lit side of the crown.
  const sheen = ctx.createLinearGradient(s * 0.2, s * 0.15, s * 0.5, s * 0.45);
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  path(ctx, [TT1, [0.5, 0.17], [0.3, 0.45], G[0], S1, T1], s);
  ctx.fill();
  ctx.restore();

  // Crisp outline.
  path(ctx, outline, s);
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.stroke();
  path(ctx, outline, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();
}

function heartPath(ctx, s, cx, cy, w) {
  ctx.beginPath();
  ctx.moveTo(cx * s, (cy + w * 0.95) * s);
  ctx.bezierCurveTo((cx - w * 0.2) * s, (cy + w * 0.7) * s, (cx - w * 1.05) * s, (cy + w * 0.25) * s, (cx - w * 1.0) * s, (cy - w * 0.25) * s);
  ctx.bezierCurveTo((cx - w * 0.98) * s, (cy - w * 0.8) * s, (cx - w * 0.25) * s, (cy - w * 0.95) * s, cx * s, (cy - w * 0.45) * s);
  ctx.bezierCurveTo((cx + w * 0.25) * s, (cy - w * 0.95) * s, (cx + w * 0.98) * s, (cy - w * 0.8) * s, (cx + w * 1.0) * s, (cy - w * 0.25) * s);
  ctx.bezierCurveTo((cx + w * 1.05) * s, (cy + w * 0.25) * s, (cx + w * 0.2) * s, (cy + w * 0.7) * s, cx * s, (cy + w * 0.95) * s);
  ctx.closePath();
}

// Heart-cut ruby in a gold bezel with four claws: the rare red gem.
function paintHeartRuby(ctx, s) {
  shadow(ctx, s, 0.34, 0.92, 0.42);
  const cx = 0.5;
  const cy = 0.5;
  const w = 0.36;
  // Gold bezel.
  heartPath(ctx, s, cx, cy, w + 0.045);
  const bez = ctx.createLinearGradient(0, s * 0.1, s, s * 0.9);
  GOLD.forEach((c, i) => bez.addColorStop(i / (GOLD.length - 1), c));
  const bezRev = ctx.createLinearGradient(s * 0.2, s * 0.15, s * 0.8, s * 0.95);
  bezRev.addColorStop(0, GOLD[5]);
  bezRev.addColorStop(0.35, GOLD[3]);
  bezRev.addColorStop(0.7, GOLD[2]);
  bezRev.addColorStop(1, GOLD[1]);
  ctx.fillStyle = bezRev;
  ctx.fill();
  ctx.strokeStyle = GOLD[0];
  ctx.lineWidth = Math.max(1, s * 0.018);
  ctx.stroke();
  // Stone body.
  heartPath(ctx, s, cx, cy, w);
  ctx.fillStyle = RUBY[1];
  ctx.fill();
  ctx.save();
  heartPath(ctx, s, cx, cy, w);
  ctx.clip();
  // Radial facets fanning from an off-centre table.
  const n = 14;
  const fx = cx - 0.02;
  const fy = cy - 0.04;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const mid = (a0 + a1) / 2;
    // Lit from the top-left.
    const lit = 0.5 + 0.45 * Math.cos(mid - (-2.3));
    const tone = i % 2 ? lit * 0.85 : lit;
    ctx.beginPath();
    ctx.moveTo(fx * s, fy * s);
    ctx.lineTo((fx + Math.cos(a0) * 0.6) * s, (fy + Math.sin(a0) * 0.6) * s);
    ctx.lineTo((fx + Math.cos(a1) * 0.6) * s, (fy + Math.sin(a1) * 0.6) * s);
    ctx.closePath();
    const g = ctx.createLinearGradient(fx * s, fy * s, (fx + Math.cos(mid) * 0.4) * s, (fy + Math.sin(mid) * 0.4) * s);
    g.addColorStop(0, ramp(RUBY, tone * 0.6 + 0.35));
    g.addColorStop(1, ramp(RUBY, tone * 0.7 + 0.05));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,220,225,${0.12 + tone * 0.18})`;
    ctx.lineWidth = Math.max(0.5, s * 0.007);
    ctx.stroke();
  }
  // Table facet.
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = (fx + Math.cos(a) * 0.12) * s;
    const y = (fy + Math.sin(a) * 0.1) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const tg = ctx.createLinearGradient((fx - 0.12) * s, (fy - 0.1) * s, (fx + 0.12) * s, (fy + 0.1) * s);
  tg.addColorStop(0, RUBY[5]);
  tg.addColorStop(0.4, RUBY[4]);
  tg.addColorStop(1, RUBY[2]);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();
  // Deep glow.
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(s * 0.52, s * 0.6, 0, s * 0.52, s * 0.6, s * 0.28);
  glow.addColorStop(0, 'rgba(255,90,110,0.45)');
  glow.addColorStop(1, 'rgba(255,90,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // Claws.
  const claws = [[0.2, 0.3], [0.8, 0.3], [0.33, 0.73], [0.67, 0.73]];
  for (const [x, y] of claws) {
    const g = ctx.createRadialGradient((x - 0.012) * s, (y - 0.012) * s, 0, x * s, y * s, s * 0.04);
    g.addColorStop(0, GOLD[5]);
    g.addColorStop(0.5, GOLD[3]);
    g.addColorStop(1, GOLD[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x * s, y * s, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // Top pearl finial.
  const pg = ctx.createRadialGradient(s * 0.49, s * 0.16, 0, s * 0.5, s * 0.17, s * 0.045);
  pg.addColorStop(0, '#ffffff');
  pg.addColorStop(0.6, '#efe6d8');
  pg.addColorStop(1, '#a89880');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.17, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

// Four-point twinkle with a soft halo, drawn live over a cached gem.
export function sparkle(ctx, x, y, r, a, tint = '255,255,255') {
  if (a <= 0.02) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
  g.addColorStop(0, `rgba(${tint},${0.55 * a})`);
  g.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  const k = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.5);
  ctx.quadraticCurveTo(x + k, y - k, x + r * 1.5, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r * 1.5);
  ctx.quadraticCurveTo(x - k, y + k, x - r * 1.5, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r * 1.5);
  ctx.fill();
}

export function drawGemHQ(ctx, s, kind = 'blue', t = 0) {
  if (kind === 'red') blit(ctx, 'ruby', s, paintHeartRuby);
  else if (kind === 'green') blit(ctx, 'emerald', s, (c, n) => paintBrilliant(c, n, EMERALD));
  else blit(ctx, 'sapphire', s, (c, n) => paintBrilliant(c, n, SAPPHIRE));
  // Two glints that take turns.
  const p = (t * 0.8) % 2;
  const a1 = Math.max(0, Math.sin(Math.min(1, p) * Math.PI));
  const a2 = Math.max(0, Math.sin(Math.max(0, p - 1) * Math.PI));
  if (kind === 'red') {
    sparkle(ctx, s * 0.36, s * 0.34, s * 0.07, a1);
    sparkle(ctx, s * 0.62, s * 0.52, s * 0.05, a2 * 0.8, '255,200,210');
  } else {
    sparkle(ctx, s * 0.4, s * 0.19, s * 0.07, a1);
    sparkle(ctx, s * 0.66, s * 0.47, s * 0.05, a2 * 0.8, '200,235,255');
  }
}

// ---------- rocks ----------

function rockOutline(seed, rx, ry) {
  const r = rng(seed);
  const pts = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.2;
    const k = 0.9 + r() * 0.14;
    pts.push([0.5 + Math.cos(a) * rx * k, 0.53 + Math.sin(a) * ry * k]);
  }
  return pts;
}

function smoothPath(ctx, pts, s) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0] * s, m0[1] * s);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(p[0] * s, p[1] * s, m[0] * s, m[1] * s);
  }
  ctx.closePath();
}

// Granite boulder: chiselled silhouette, speckled grain, cracks, rim light.
function paintBoulder(ctx, s, tones) {
  shadow(ctx, s, 0.42, 0.88, 0.45);
  const pts = rockOutline(11, 0.42, 0.39);
  smoothPath(ctx, pts, s);
  const g = ctx.createRadialGradient(s * 0.36, s * 0.3, s * 0.02, s * 0.52, s * 0.56, s * 0.52);
  g.addColorStop(0, tones[3]);
  g.addColorStop(0.35, tones[2]);
  g.addColorStop(0.75, tones[1]);
  g.addColorStop(1, tones[0]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  smoothPath(ctx, pts, s);
  ctx.clip();
  // Chisel planes: a few flat facets catch the light differently.
  const r = rng(23);
  for (let i = 0; i < 5; i++) {
    const cx = 0.25 + r() * 0.5;
    const cy = 0.25 + r() * 0.5;
    const rad = 0.12 + r() * 0.12;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r();
      const x = (cx + Math.cos(a) * rad) * s;
      const y = (cy + Math.sin(a) * rad * 0.8) * s;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const lit = cy < 0.45 && cx < 0.55;
    ctx.fillStyle = lit ? 'rgba(255,245,225,0.09)' : 'rgba(0,0,0,0.12)';
    ctx.fill();
  }
  // Grain.
  for (let i = 0; i < 70; i++) {
    const x = r() * s;
    const y = r() * s;
    const light = r() > 0.55;
    ctx.fillStyle = light ? 'rgba(255,248,230,0.22)' : 'rgba(10,8,6,0.28)';
    ctx.fillRect(x, y, Math.max(0.6, s * 0.012), Math.max(0.6, s * 0.012));
  }
  // Cracks with a lit lip.
  const crack = (pts2) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts2.forEach(([x, y], k) => (k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.strokeStyle = 'rgba(8,6,4,0.7)';
    ctx.lineWidth = Math.max(0.8, s * 0.018);
    ctx.stroke();
    ctx.translate(s * 0.008, s * 0.01);
    ctx.strokeStyle = 'rgba(255,240,215,0.2)';
    ctx.lineWidth = Math.max(0.5, s * 0.008);
    ctx.stroke();
    ctx.translate(-s * 0.008, -s * 0.01);
  };
  crack([[0.6, 0.2], [0.55, 0.34], [0.63, 0.44], [0.58, 0.55]]);
  crack([[0.63, 0.44], [0.75, 0.5]]);
  crack([[0.25, 0.62], [0.36, 0.66], [0.4, 0.78]]);
  // Ambient occlusion at the base.
  const ao = ctx.createLinearGradient(0, s * 0.55, 0, s * 0.95);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = ao;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();
  // Rim light along the upper-left edge and a dark outline.
  smoothPath(ctx, pts, s);
  ctx.strokeStyle = 'rgba(12,10,8,0.85)';
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.stroke();
  ctx.save();
  smoothPath(ctx, pts, s);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.53, s * 0.4, Math.PI * 0.95, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,246,228,0.45)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.stroke();
  ctx.restore();
}

// Polished rolling stone: a sphere with a gold-inlaid spiral so it reads
// as "round" at a glance.
function paintOrb(ctx, s) {
  shadow(ctx, s, 0.38, 0.9, 0.42);
  const g = ctx.createRadialGradient(s * 0.37, s * 0.33, s * 0.02, s * 0.5, s * 0.52, s * 0.44);
  g.addColorStop(0, '#f3efe6');
  g.addColorStop(0.25, '#b8b2a6');
  g.addColorStop(0.7, '#6e685e');
  g.addColorStop(1, '#2e2a25');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.52, s * 0.39, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,12,10,0.85)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.stroke();
  // Inlaid spiral.
  ctx.save();
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.52, s * 0.37, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4.2; a += 0.12) {
    const rr = s * (0.03 + a * 0.022);
    const x = s * 0.5 + Math.cos(a) * rr;
    const y = s * 0.52 + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#3a2a0c';
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.lineCap = 'round';
  ctx.stroke();
  const gg = ctx.createLinearGradient(s * 0.2, s * 0.2, s * 0.8, s * 0.8);
  gg.addColorStop(0, GOLD[5]);
  gg.addColorStop(0.4, GOLD[3]);
  gg.addColorStop(1, GOLD[1]);
  ctx.strokeStyle = gg;
  ctx.lineWidth = Math.max(0.8, s * 0.026);
  ctx.stroke();
  ctx.restore();
  // Specular.
  const sp = ctx.createRadialGradient(s * 0.36, s * 0.3, 0, s * 0.36, s * 0.3, s * 0.14);
  sp.addColorStop(0, 'rgba(255,255,255,0.85)');
  sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, s, s);
}

export function drawBoulderHQ(ctx, s, round) {
  if (round) blit(ctx, 'orb', s, paintOrb);
  else blit(ctx, 'boulder', s, (c, n) => paintBoulder(c, n, ['#1b1815', '#3d3731', '#6d655a', '#b2a893']));
}

// ---------- crate ----------

function paintCrate(ctx, s) {
  shadow(ctx, s, 0.44, 0.9, 0.4);
  const x0 = s * 0.1;
  const y0 = s * 0.1;
  const w = s * 0.8;
  const h = s * 0.78;
  // Planks.
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const py = y0 + (h / planks) * i;
    const g = ctx.createLinearGradient(0, py, 0, py + h / planks);
    const base = i % 2 ? ['#8a5a2b', '#6b411c'] : ['#9a6532', '#734720'];
    g.addColorStop(0, base[0]);
    g.addColorStop(1, base[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x0, py, w, h / planks);
    // Grain.
    const r = rng(31 + i);
    ctx.strokeStyle = 'rgba(40,20,6,0.35)';
    ctx.lineWidth = Math.max(0.5, s * 0.006);
    for (let k = 0; k < 3; k++) {
      const gy = py + (h / planks) * (0.25 + r() * 0.5);
      ctx.beginPath();
      ctx.moveTo(x0, gy);
      ctx.bezierCurveTo(x0 + w * 0.3, gy - s * 0.015, x0 + w * 0.6, gy + s * 0.015, x0 + w, gy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x0, py + h / planks - Math.max(1, s * 0.012), w, Math.max(1, s * 0.012));
    ctx.fillStyle = 'rgba(255,220,170,0.15)';
    ctx.fillRect(x0, py, w, Math.max(0.6, s * 0.008));
  }
  // Brass frame and diagonal brace.
  const brass = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
  brass.addColorStop(0, GOLD[4]);
  brass.addColorStop(0.4, GOLD[3]);
  brass.addColorStop(1, GOLD[1]);
  ctx.strokeStyle = 'rgba(30,18,4,0.9)';
  ctx.lineWidth = s * 0.075;
  ctx.strokeRect(x0 + s * 0.03, y0 + s * 0.03, w - s * 0.06, h - s * 0.06);
  ctx.strokeStyle = brass;
  ctx.lineWidth = s * 0.05;
  ctx.strokeRect(x0 + s * 0.03, y0 + s * 0.03, w - s * 0.06, h - s * 0.06);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + s * 0.06, y0 + s * 0.06, w - s * 0.12, h - s * 0.12);
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,18,4,0.8)';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + w, y0 + h);
  ctx.stroke();
  ctx.strokeStyle = '#7a4c22';
  ctx.lineWidth = s * 0.055;
  ctx.stroke();
  ctx.restore();
  // Rivets.
  for (const [rx, ry] of [[0.17, 0.17], [0.83, 0.17], [0.17, 0.81], [0.83, 0.81]]) {
    const g = ctx.createRadialGradient((rx - 0.01) * s, (ry - 0.01) * s, 0, rx * s, ry * s, s * 0.035);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.5, GOLD[3]);
    g.addColorStop(1, GOLD[0]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(rx * s, ry * s, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCrateHQ(ctx, s) {
  blit(ctx, 'crate', s, paintCrate);
}

// ---------- key ----------

const KEY_GEMS = { red: RUBY, gold: GOLD, green: EMERALD, violet: ['#12052a', '#3a1070', '#6a2bc0', '#9d5cf0', '#d2b0ff', '#f5ecff'] };

function paintKey(ctx, s, color) {
  shadow(ctx, s, 0.3, 0.86, 0.35);
  const gold = ctx.createLinearGradient(s * 0.1, s * 0.2, s * 0.9, s * 0.7);
  gold.addColorStop(0, GOLD[5]);
  gold.addColorStop(0.3, GOLD[3]);
  gold.addColorStop(0.7, GOLD[2]);
  gold.addColorStop(1, GOLD[1]);
  const outline = () => {
    ctx.strokeStyle = GOLD[0];
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();
  };
  // Shaft and bit.
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.rect(s * 0.44, s * 0.44, s * 0.44, s * 0.08);
  ctx.rect(s * 0.72, s * 0.52, s * 0.07, s * 0.14);
  ctx.rect(s * 0.82, s * 0.52, s * 0.06, s * 0.1);
  ctx.fill();
  outline();
  // Ornate bow: a quatrefoil ring.
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.moveTo(s * (0.3 + Math.cos(a) * 0.1) + s * 0.08, s * (0.48 + Math.sin(a) * 0.1));
    ctx.arc(s * (0.3 + Math.cos(a) * 0.1), s * (0.48 + Math.sin(a) * 0.1), s * 0.08, 0, Math.PI * 2);
  }
  ctx.fillStyle = gold;
  ctx.fill();
  outline();
  // Gem set in the bow.
  const stones = KEY_GEMS[color] || RUBY;
  const g = ctx.createRadialGradient(s * 0.27, s * 0.45, 0, s * 0.3, s * 0.48, s * 0.1);
  g.addColorStop(0, stones[5]);
  g.addColorStop(0.35, stones[3]);
  g.addColorStop(1, stones[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s * 0.3, s * 0.48, s * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD[0];
  ctx.lineWidth = Math.max(0.8, s * 0.015);
  ctx.stroke();
}

export function drawKeyHQ(ctx, s, color) {
  blit(ctx, `key-${color}`, s, (c, n) => paintKey(c, n, color));
}

// ---------- icons for the interface ----------

// Data URL of a treasure sprite, for use as a CSS background image.
export function iconURL(kind, size = 96) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (kind === 'gem') drawGemHQ(ctx, size, 'blue', 0.3);
  else if (kind === 'red') drawGemHQ(ctx, size, 'red', 0.3);
  else if (kind === 'boulder') drawBoulderHQ(ctx, size, false);
  return c.toDataURL('image/png');
}

export const RAMPS = { SAPPHIRE, RUBY, EMERALD, GOLD };

// ---------- finishing pass for characters ----------

// Paints a sprite once, then gives it an ink outline, a rim light on the
// upper-left edges, a shade on the lower-right edges and a soft top-to-bottom
// volume gradient. Ground shadows (semi-transparent) are left untouched.
// The result is cached per pose, so animation frames cost one blit.
export function polished(ctx, key, s, draw) {
  const pad = Math.ceil(s * 0.2);
  const n = Math.max(8, Math.ceil(s)) + pad * 2;
  const k = `pol:${key}@${Math.ceil(s)}`;
  let c = cache.get(k);
  if (!c) {
    if (cache.size > 400) cache.clear();
    c = makeCanvas(n);
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.translate(pad, pad);
    draw(cx, s);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    finish(cx, n, s);
    cache.set(k, c);
  }
  ctx.drawImage(c, -pad, -pad, n, n);
}

function finish(cx, n, s) {
  let img;
  try {
    img = cx.getImageData(0, 0, n, n);
  } catch {
    return;
  }
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const solid = (x, y) => x >= 0 && y >= 0 && x < n && y < n && src[(y * n + x) * 4 + 3] > 170;
  const r = Math.max(1, Math.round(s / 48));
  const rim = Math.max(1, Math.round(s / 40));
  let top = n;
  let bot = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (solid(x, y)) {
        if (y < top) top = y;
        if (y > bot) bot = y;
      }
    }
  }
  const span = Math.max(1, bot - top);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      if (solid(x, y)) {
        // Volume: brighter at the top of the figure, deeper at the feet.
        const v = (y - top) / span;
        let m = 1.12 - v * 0.26;
        let add = 0;
        // Rim light where the upper-left neighbour is empty.
        if (!solid(x - rim, y - rim)) add = 0.3;
        else if (!solid(x + rim, y + rim)) m *= 0.78;
        for (let ch = 0; ch < 3; ch++) {
          const val = src[i + ch] * m;
          d[i + ch] = Math.min(255, val + (255 - val) * add);
        }
      } else {
        // Ink outline around the solid silhouette.
        let near = false;
        for (let dy = -r; dy <= r && !near; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r + 1 && solid(x + dx, y + dy)) {
              near = true;
              break;
            }
          }
        }
        if (near) {
          const a = src[i + 3] / 255;
          const oa = 0.92;
          const outA = oa + a * (1 - oa);
          d[i] = (18 * oa + src[i] * a * (1 - oa)) / outA;
          d[i + 1] = (11 * oa + src[i + 1] * a * (1 - oa)) / outA;
          d[i + 2] = (6 * oa + src[i + 2] * a * (1 - oa)) / outA;
          d[i + 3] = outA * 255;
        }
      }
    }
  }
  cx.putImageData(img, 0, 0);
}
