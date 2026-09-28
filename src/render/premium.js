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
const VIVID_BLUE = ['#031456', '#0a3dcc', '#1c7cff', '#48bcff', '#aef0ff', '#ffffff'];
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

// Gold leaf fill across a box, lit from the top-left.
function goldFill(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fffbe6');
  g.addColorStop(0.25, '#ffd96a');
  g.addColorStop(0.55, '#e0a526');
  g.addColorStop(0.8, '#9a6208');
  g.addColorStop(1, '#f0c24a');
  return g;
}

// A faceted gold claw cap (a small pyramid) centred on a gem's point.
function goldCap(ctx, s, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x * s, y * s);
  ctx.rotate(rot);
  const R = r * s;
  const pts = [[0, -R * 1.25], [R * 0.8, 0], [0, R * 0.9], [-R * 0.8, 0]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = goldFill(ctx, -R, -R, R, R);
  ctx.fill();
  ctx.strokeStyle = '#5a3500';
  ctx.lineWidth = Math.max(0.8, s * 0.012);
  ctx.stroke();
  // Facet split: lit left half, shaded right half.
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.25);
  ctx.lineTo(0, R * 0.9);
  ctx.lineTo(R * 0.8, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,70,0,0.35)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.85)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.25, -R * 0.35, R * 0.18, R * 0.32, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A gold-mounted brilliant in the "diamond" silhouette: vivid facets
// radiating from a four-part table, a thin gold rim and gold claw caps on
// its four points, over a soft halo of its own light.
function paintMounted(ctx, s, colors, glow) {
  shadow(ctx, s, 0.3, 0.93, 0.45);
  const halo = ctx.createRadialGradient(s * 0.5, s * 0.48, 0, s * 0.5, s * 0.48, s * 0.5);
  halo.addColorStop(0, `rgba(${glow},0.45)`);
  halo.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, s, s);
  const T = [0.5, 0.1];
  const L = [0.11, 0.47];
  const R = [0.89, 0.47];
  const B = [0.5, 0.91];
  const t = [0.5, 0.27];
  const l = [0.31, 0.46];
  const r = [0.69, 0.46];
  const b = [0.5, 0.68];
  const c = [0.47, 0.44];
  const outline = [T, R, B, L];
  path(ctx, outline, s);
  ctx.fillStyle = colors[1];
  ctx.fill();
  const facet = (pts, t0, t1) => {
    path(ctx, pts, s);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const g = ctx.createLinearGradient(Math.min(...xs) * s, Math.min(...ys) * s, Math.max(...xs) * s, Math.max(...ys) * s);
    g.addColorStop(0, ramp(colors, t0));
    g.addColorStop(1, ramp(colors, t1));
    ctx.fillStyle = g;
    ctx.fill();
  };
  // Outer ring (8 facets), lit from the top-left.
  facet([T, L, l], 0.9, 0.62);
  facet([T, l, t], 0.99, 0.78);
  facet([T, t, r], 0.72, 0.6);
  facet([T, r, R], 0.62, 0.42);
  facet([L, B, b], 0.5, 0.2);
  facet([L, b, l], 0.66, 0.4);
  facet([R, r, b], 0.44, 0.22);
  facet([R, b, B], 0.3, 0.06);
  // Table.
  facet([t, l, c], 1, 0.84);
  facet([l, b, c], 0.7, 0.55);
  facet([b, r, c], 0.5, 0.36);
  facet([r, t, c], 0.82, 0.62);
  // Crisp facet edges.
  ctx.lineWidth = Math.max(0.6, s * 0.009);
  ctx.lineJoin = 'round';
  const edges = [[T, l], [T, t], [T, r], [L, l], [L, b], [R, r], [R, b], [B, b], [t, l], [l, b], [b, r], [r, t], [t, c], [l, c], [b, c], [r, c]];
  edges.forEach(([a, e], i) => {
    ctx.strokeStyle = `rgba(255,255,255,${i < 4 || (i >= 8 && i < 10) ? 0.55 : 0.25})`;
    ctx.beginPath();
    ctx.moveTo(a[0] * s, a[1] * s);
    ctx.lineTo(e[0] * s, e[1] * s);
    ctx.stroke();
  });
  // Inner light and sheen.
  ctx.save();
  path(ctx, outline, s);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const fire = ctx.createRadialGradient(s * 0.42, s * 0.38, 0, s * 0.42, s * 0.38, s * 0.28);
  fire.addColorStop(0, `rgba(${glow},0.55)`);
  fire.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = fire;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  path(ctx, [[0.44, 0.17], [0.34, 0.3], [0.27, 0.4], [0.33, 0.39], [0.43, 0.28]], s);
  ctx.fill();
  ctx.restore();
  // Gold rim.
  path(ctx, outline, s);
  ctx.strokeStyle = '#4a2c00';
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.stroke();
  path(ctx, outline, s);
  ctx.strokeStyle = goldFill(ctx, 0, 0, s, s);
  ctx.lineWidth = Math.max(0.8, s * 0.024);
  ctx.stroke();
  // Claw caps on the four points.
  goldCap(ctx, s, T[0], T[1] + 0.03, 0.085);
  goldCap(ctx, s, B[0], B[1] - 0.02, 0.085, Math.PI);
  goldCap(ctx, s, L[0] + 0.02, L[1], 0.072, -Math.PI / 2);
  goldCap(ctx, s, R[0] - 0.02, R[1], 0.072, Math.PI / 2);
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
  // Gold caps at the cleft and the tip.
  goldCap(ctx, s, 0.5, 0.315, 0.06);
  goldCap(ctx, s, 0.5, 0.83, 0.065, Math.PI);
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
  else if (kind === 'green') blit(ctx, 'emerald', s, (c, n) => paintMounted(c, n, EMERALD, '90,255,170'));
  else blit(ctx, 'sapphire', s, (c, n) => paintMounted(c, n, VIVID_BLUE, '90,190,255'));
  // Two glints that take turns.
  const p = (t * 0.8) % 2;
  const a1 = Math.max(0, Math.sin(Math.min(1, p) * Math.PI));
  const a2 = Math.max(0, Math.sin(Math.max(0, p - 1) * Math.PI));
  if (kind === 'red') {
    sparkle(ctx, s * 0.36, s * 0.34, s * 0.07, a1);
    sparkle(ctx, s * 0.62, s * 0.52, s * 0.05, a2 * 0.8, '255,200,210');
  } else {
    sparkle(ctx, s * 0.5, s * 0.1, s * 0.08, 0.35 + a1 * 0.65, '255,240,190');
    sparkle(ctx, s * 0.36, s * 0.32, s * 0.05, a2 * 0.9, '200,235,255');
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

// A clump of moss: overlapping round leaves with a lit top.
function mossClump(ctx, s, x, y, r, seed) {
  const rnd = rng(seed);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r;
    const px = (x + Math.cos(a) * d) * s;
    const py = (y + Math.sin(a) * d * 0.7) * s;
    const rr = s * r * (0.35 + rnd() * 0.3);
    const g = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.4, 0, px, py, rr);
    g.addColorStop(0, '#c4f27c');
    g.addColorStop(0.45, '#5fb43a');
    g.addColorStop(1, '#23601a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Granite boulder: chiselled silhouette, speckled grain, cracks, rim light.
function paintBoulder(ctx, s) {
  // Round temple boulder: cracked into plates, mossy, warmly rim-lit.
  shadow(ctx, s, 0.42, 0.9, 0.5);
  const cx = 0.5;
  const cy = 0.52;
  const R = 0.41;
  const body = () => {
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, R * s, 0, Math.PI * 2);
  };
  body();
  const g = ctx.createRadialGradient(s * 0.38, s * 0.36, s * 0.02, s * 0.5, s * 0.55, s * 0.46);
  g.addColorStop(0, '#9b958c');
  g.addColorStop(0.35, '#5b5752');
  g.addColorStop(0.8, '#2c2a27');
  g.addColorStop(1, '#171614');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  // Plates: a central pentagon with seams running out to the rim.
  const pc = [0.47, 0.47];
  const pr = 0.15;
  const verts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + 0.2;
    verts.push([pc[0] + Math.cos(a) * pr, pc[1] + Math.sin(a) * pr * 0.9, a]);
  }
  // Plate shading: each outer plate a touch different.
  for (let i = 0; i < 5; i++) {
    const [x0, y0, a0] = verts[i];
    const [x1, y1, a1] = verts[(i + 1) % 5];
    ctx.beginPath();
    ctx.moveTo(x0 * s, y0 * s);
    ctx.lineTo((cx + Math.cos(a0) * 0.6) * s, (cy + Math.sin(a0) * 0.6) * s);
    ctx.lineTo((cx + Math.cos(a1) * 0.6) * s, (cy + Math.sin(a1) * 0.6) * s);
    ctx.lineTo(x1 * s, y1 * s);
    ctx.closePath();
    const mid = (a0 + a1) / 2;
    const lit = Math.cos(mid - (-2.4));
    ctx.fillStyle = lit > 0 ? `rgba(255,240,215,${0.07 * lit})` : `rgba(0,0,0,${-0.18 * lit})`;
    ctx.fill();
  }
  ctx.beginPath();
  verts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,245,225,0.12)';
  ctx.fill();
  const seam = (pts) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.strokeStyle = 'rgba(10,8,6,0.85)';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.stroke();
    ctx.save();
    ctx.translate(s * 0.01, s * 0.012);
    ctx.strokeStyle = 'rgba(255,238,210,0.28)';
    ctx.lineWidth = Math.max(0.5, s * 0.009);
    ctx.stroke();
    ctx.restore();
  };
  seam([...verts.map(([x, y]) => [x, y]), verts[0]]);
  for (const [x, y, a] of verts) seam([[x, y], [x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.1 + 0.01], [cx + Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5]]);
  // Grain.
  const r = rng(23);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,248,230,0.18)' : 'rgba(0,0,0,0.25)';
    ctx.fillRect(r() * s, r() * s, Math.max(0.6, s * 0.012), Math.max(0.6, s * 0.012));
  }
  // Moss on the crown and the shaded base.
  mossClump(ctx, s, 0.72, 0.24, 0.09, 5);
  mossClump(ctx, s, 0.24, 0.8, 0.08, 9);
  // Warm bounce light on the lower right.
  const bounce = ctx.createRadialGradient(s * 0.85, s * 0.85, 0, s * 0.85, s * 0.85, s * 0.3);
  bounce.addColorStop(0, 'rgba(255,190,110,0.25)');
  bounce.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = bounce;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();
  body();
  ctx.strokeStyle = '#0e0c0a';
  ctx.lineWidth = Math.max(1, s * 0.024);
  ctx.stroke();
  ctx.save();
  body();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx * s, cy * s, (R - 0.015) * s, Math.PI * 0.95, Math.PI * 1.62);
  ctx.strokeStyle = 'rgba(255,236,200,0.6)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.stroke();
  ctx.restore();
}

// Polished rolling stone: a sphere with a gold-inlaid spiral so it reads
// as "round" at a glance.
function paintOrb(ctx, s) {
  // Rolling stone: a carved disc in a gold ring with an inlaid spiral.
  shadow(ctx, s, 0.4, 0.9, 0.48);
  const c = [s * 0.5, s * 0.52];
  const R = s * 0.41;
  ctx.beginPath();
  ctx.arc(c[0], c[1], R, 0, Math.PI * 2);
  ctx.fillStyle = goldFill(ctx, 0, s * 0.1, s, s * 0.95);
  ctx.fill();
  ctx.strokeStyle = '#4a2c00';
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.stroke();
  const inner = R * 0.84;
  ctx.beginPath();
  ctx.arc(c[0], c[1], inner, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(s * 0.4, s * 0.38, s * 0.02, c[0], c[1], inner);
  g.addColorStop(0, '#a9a397');
  g.addColorStop(0.45, '#67625a');
  g.addColorStop(1, '#2a2723');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,0,0.8)';
  ctx.lineWidth = Math.max(1, s * 0.016);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(c[0], c[1], inner, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4.4; a += 0.1) {
    const rr = s * (0.02 + a * 0.021);
    const x = c[0] + Math.cos(a) * rr;
    const y = c[1] + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a1800';
  ctx.lineWidth = Math.max(1.4, s * 0.055);
  ctx.stroke();
  ctx.strokeStyle = goldFill(ctx, s * 0.2, s * 0.2, s * 0.8, s * 0.8);
  ctx.lineWidth = Math.max(1, s * 0.034);
  ctx.stroke();
  mossClump(ctx, s, 0.7, 0.28, 0.07, 3);
  ctx.restore();
  const sp = ctx.createRadialGradient(s * 0.34, s * 0.28, 0, s * 0.34, s * 0.28, s * 0.14);
  sp.addColorStop(0, 'rgba(255,255,255,0.85)');
  sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, s, s);
}

export function drawBoulderHQ(ctx, s, round) {
  if (round) blit(ctx, 'orb', s, paintOrb);
  else blit(ctx, 'boulder', s, paintBoulder);
}

// ---------- crate ----------

function paintCrate(ctx, s) {
  // A gilded strongbox of dark timber, seen a little from above so its top
  // and right faces show.
  shadow(ctx, s, 0.46, 0.92, 0.45);
  const P = (x, y) => [x * s, y * s];
  const quad = (pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const F = [[0.08, 0.3], [0.8, 0.3], [0.8, 0.92], [0.08, 0.92]];
  const Tp = [[0.08, 0.3], [0.8, 0.3], [0.92, 0.16], [0.2, 0.16]];
  const Rt = [[0.8, 0.3], [0.92, 0.16], [0.92, 0.78], [0.8, 0.92]];
  // Timber faces.
  const wood = (y0, y1, a, b) => {
    const g = ctx.createLinearGradient(0, y0 * s, 0, y1 * s);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  quad(Tp, wood(0.16, 0.3, '#b27a3e', '#8a5a28'));
  quad(Rt, wood(0.16, 0.92, '#5c3a18', '#3a230c'));
  quad(F, wood(0.3, 0.92, '#9a6532', '#6a4019'));
  // Planks and grain on the front.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0.08 * s, 0.3 * s, 0.72 * s, 0.62 * s);
  ctx.clip();
  for (let i = 1; i < 4; i++) {
    const y = (0.3 + i * 0.155) * s;
    ctx.fillStyle = 'rgba(30,14,2,0.6)';
    ctx.fillRect(0.08 * s, y - s * 0.008, 0.72 * s, s * 0.016);
    ctx.fillStyle = 'rgba(255,210,150,0.2)';
    ctx.fillRect(0.08 * s, y + s * 0.008, 0.72 * s, s * 0.006);
  }
  const r = rng(41);
  ctx.strokeStyle = 'rgba(40,18,4,0.35)';
  ctx.lineWidth = Math.max(0.5, s * 0.006);
  for (let k = 0; k < 10; k++) {
    const gy = (0.33 + r() * 0.56) * s;
    ctx.beginPath();
    ctx.moveTo(0.08 * s, gy);
    ctx.bezierCurveTo(0.3 * s, gy - s * 0.02, 0.55 * s, gy + s * 0.02, 0.8 * s, gy);
    ctx.stroke();
  }
  // Diagonal brace.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#2a1504';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(...P(0.1, 0.34));
  ctx.lineTo(...P(0.78, 0.88));
  ctx.stroke();
  ctx.strokeStyle = wood(0.3, 0.9, '#a86e36', '#744620');
  ctx.lineWidth = s * 0.09;
  ctx.stroke();
  ctx.restore();
  // Gold frame along every edge.
  const edge = (a, b, w = 0.05) => {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...P(...a));
    ctx.lineTo(...P(...b));
    ctx.strokeStyle = '#3d2400';
    ctx.lineWidth = s * (w + 0.022);
    ctx.stroke();
    ctx.strokeStyle = goldFill(ctx, a[0] * s, a[1] * s, b[0] * s + 1, b[1] * s + 1);
    ctx.lineWidth = s * w;
    ctx.stroke();
  };
  edge(F[0], F[1]);
  edge(F[3], F[2]);
  edge(F[0], F[3]);
  edge(F[1], F[2]);
  edge(Tp[3], Tp[2], 0.04);
  edge(Tp[0], Tp[3], 0.04);
  edge(Tp[1], Tp[2], 0.04);
  edge(Rt[2], Rt[3], 0.04);
  edge(Tp[2], Rt[2], 0.04);
  // Corner brackets with rivets.
  for (const [x, y, sx, sy] of [[0.08, 0.3, 1, 1], [0.8, 0.3, -1, 1], [0.08, 0.92, 1, -1], [0.8, 0.92, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(...P(x, y));
    ctx.lineTo(...P(x + sx * 0.17, y));
    ctx.lineTo(...P(x + sx * 0.17, y + sy * 0.05));
    ctx.lineTo(...P(x + sx * 0.05, y + sy * 0.05));
    ctx.lineTo(...P(x + sx * 0.05, y + sy * 0.17));
    ctx.lineTo(...P(x, y + sy * 0.17));
    ctx.closePath();
    ctx.fillStyle = goldFill(ctx, (x - 0.05) * s, (y - 0.05) * s, (x + 0.15) * s, (y + 0.15) * s);
    ctx.fill();
    ctx.strokeStyle = '#3d2400';
    ctx.lineWidth = Math.max(0.8, s * 0.01);
    ctx.stroke();
    const rx = x + sx * 0.08;
    const ry = y + sy * 0.08;
    const rg = ctx.createRadialGradient((rx - 0.01) * s, (ry - 0.01) * s, 0, rx * s, ry * s, s * 0.03);
    rg.addColorStop(0, '#fffbe8');
    rg.addColorStop(0.5, '#e8b43a');
    rg.addColorStop(1, '#6a4000');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(rx * s, ry * s, s * 0.026, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCrateHQ(ctx, s) {
  blit(ctx, 'crate', s, paintCrate);
}

// ---------- key ----------

const KEY_GEMS = { red: RUBY, gold: GOLD, green: EMERALD, violet: ['#12052a', '#3a1070', '#6a2bc0', '#9d5cf0', '#d2b0ff', '#f5ecff'] };

function paintKey(ctx, s, color) {
  // Gold key with a flower bow and a jewel at its heart.
  shadow(ctx, s, 0.32, 0.84, 0.38);
  const gold = goldFill(ctx, s * 0.1, s * 0.3, s * 0.8, s * 0.7);
  const ink = () => {
    ctx.strokeStyle = '#3d2400';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.stroke();
  };
  ctx.beginPath();
  ctx.rect(s * 0.38, s * 0.455, s * 0.52, s * 0.085);
  ctx.rect(s * 0.72, s * 0.54, s * 0.07, s * 0.14);
  ctx.rect(s * 0.83, s * 0.54, s * 0.07, s * 0.1);
  ctx.fillStyle = gold;
  ctx.fill();
  ink();
  ctx.fillStyle = 'rgba(255,255,230,0.6)';
  ctx.fillRect(s * 0.4, s * 0.465, s * 0.48, s * 0.018);
  const cx = s * 0.28;
  const cy = s * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * s * 0.095;
    const py = cy + Math.sin(a) * s * 0.095;
    ctx.moveTo(px + s * 0.075, py);
    ctx.arc(px, py, s * 0.075, 0, Math.PI * 2);
  }
  ctx.fillStyle = gold;
  ctx.fill();
  ink();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  const stones = KEY_GEMS[color] || RUBY;
  const g = ctx.createRadialGradient(cx - s * 0.025, cy - s * 0.03, 0, cx, cy, s * 0.07);
  g.addColorStop(0, stones[5]);
  g.addColorStop(0.35, stones[3]);
  g.addColorStop(1, stones[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.062, 0, Math.PI * 2);
  ctx.fill();
  ink();
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
