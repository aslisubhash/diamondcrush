// Procedural sprite art. Everything is drawn from shapes at any tile size,
// so the same code yields HD art at 96px and chunky Retro art at 24px
// (GDD 7.1 and 7.4: same footprint, same silhouettes).
import { COLORS, PALETTES } from './palette.js';
import { drawGemHQ, drawBoulderHQ, drawCrateHQ, drawKeyHQ } from './premium.js';

export function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Lighten (k > 0) or darken (k < 0) a #rrggbb colour.
export function shade(c, k) {
  if (!c || c[0] !== '#') return c;
  const n = parseInt(c.slice(1), 16);
  const f = (v) => Math.round(Math.max(0, Math.min(255, k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// Draws a key shape glyph (circle, triangle, square, star) for colour-blind safety.
export function shapeGlyph(ctx, shape, cx, cy, r) {
  if (shape === 'circle') circle(ctx, cx, cy, r);
  else if (shape === 'square') ctx.fillRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  else if (shape === 'triangle') poly(ctx, [cx, cy - r, cx + r, cy + r * 0.8, cx - r, cy + r * 0.8]);
  else if (shape === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    poly(ctx, pts);
  }
}

// ---------- floors ----------

export function drawFloor(ctx, s, x, y, pal) {
  const g = Math.max(1, Math.round(s / 36));
  // Grout, then slabs laid in a running bond (seam offset every other row).
  ctx.fillStyle = pal.grout;
  ctx.fillRect(0, 0, s, s);
  const seam = y % 2 ? Math.round(s / 2) : 0;
  const slabs = seam ? [[0, seam, false, true], [seam + g, s, true, false]] : [[g, s, true, true]];
  for (const [a, b, leftSeam, rightSeam] of slabs) {
    const k = hash(x * 2 + (a > 0 ? 1 : 0), y, 1);
    const base = k > 0.5 ? pal.floor : pal.floorAlt;
    const grad = ctx.createLinearGradient(a, g, b, s);
    grad.addColorStop(0, shade(base, 0.07));
    grad.addColorStop(1, shade(base, -0.07));
    ctx.fillStyle = grad;
    ctx.fillRect(a, g, b - a, s - g);
    // Bevel: lit top and left lips, shaded bottom and right lips.
    ctx.fillStyle = 'rgba(255,248,230,0.22)';
    ctx.fillRect(a, g, b - a, g);
    if (leftSeam) ctx.fillRect(a, g, g, s - g);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(a, s - g, b - a, g);
    if (rightSeam) ctx.fillRect(b - g, g, g, s - g);
  }
  // Fine grain.
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = hash(x, y, 40 + i) > 0.5 ? 'rgba(255,245,220,0.12)' : 'rgba(40,25,10,0.12)';
    const d = Math.max(1, s / 40);
    ctx.fillRect(hash(x, y, 20 + i) * s, hash(y, x, 20 + i) * s, d, d);
  }
  if (hash(x, y, 3) > 0.72) {
    // A worn hairline crack.
    ctx.strokeStyle = 'rgba(40,25,10,0.35)';
    ctx.lineWidth = Math.max(0.6, s / 60);
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.55);
    ctx.lineTo(s * 0.3, s * 0.6);
    ctx.lineTo(s * 0.36, s * 0.7);
    ctx.stroke();
  }
  if (hash(x, y, 5) > 0.85) {
    ctx.fillStyle = pal.moss;
    ctx.globalAlpha = 0.55;
    circle(ctx, s * 0.75, s * 0.8, s * 0.07);
    circle(ctx, s * 0.82, s * 0.74, s * 0.045);
    ctx.globalAlpha = 1;
  }
}

export function drawFilled(ctx, s, x, y, pal) {
  drawFloor(ctx, s, x, y, pal);
  ctx.fillStyle = pal.grout;
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 6; i++) {
    circle(ctx, s * (0.2 + hash(x, y, i) * 0.6), s * (0.2 + hash(y, x, i) * 0.6), s * 0.07);
  }
  ctx.globalAlpha = 1;
}

export function drawEarth(ctx, s, x, y, pal) {
  // Packed soil: shaded clods, embedded pebbles and the odd root.
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, shade(pal.earth, 0.06));
  g.addColorStop(1, shade(pal.earth, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 5; i++) {
    const cx = hash(x, y, 60 + i) * s;
    const cy = hash(x, y, 70 + i) * s;
    const r = s * (0.12 + hash(x, y, 80 + i) * 0.1);
    const cg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    cg.addColorStop(0, 'rgba(255,230,190,0.1)');
    cg.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.7, hash(x, y, 90 + i) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const px = s * (0.08 + hash(x, y, i * 2) * 0.84);
    const py = s * (0.08 + hash(x, y, i * 2 + 1) * 0.8);
    const r = Math.max(1, s * (0.025 + hash(y, x, i) * 0.03));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.4, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.earthSpeck;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.35)';
    ctx.beginPath();
    ctx.ellipse(px - r * 0.3, py - r * 0.3, r * 0.35, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hash(x, y, 9) > 0.75) {
    ctx.strokeStyle = pal.root;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s / 22);
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.35);
    ctx.bezierCurveTo(s * 0.35, s * 0.2, s * 0.5, s * 0.55, s * 0.95, s * 0.62);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.6, s / 50);
    ctx.beginPath();
    ctx.moveTo(s * 0.45, s * 0.42);
    ctx.quadraticCurveTo(s * 0.5, s * 0.25, s * 0.62, s * 0.2);
    ctx.stroke();
  }
  // Soft edge shadow so dug tunnels read as cut into the soil.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, s - Math.max(1, s / 18), s, Math.max(1, s / 18));
}

// Walls: a lit top face and, when open floor lies below, a darker front face
// (the top-down 3/4 camera, GDD 7.1).
export function drawWall(ctx, s, x, y, pal, front, cracked) {
  const fh = front ? Math.round(s * 0.38) : 0;
  const top = s - fh;
  const g = Math.max(1, Math.round(s / 36));
  // Top face: two courses of dressed ashlar blocks.
  ctx.fillStyle = pal.wallTopDark;
  ctx.fillRect(0, 0, s, top);
  const rows = [[0, Math.round(top / 2)], [Math.round(top / 2), top]];
  rows.forEach(([y0, y1], r) => {
    const off = (x + y + r) % 2 ? 0.35 : 0.7;
    const cuts = [0, Math.round(s * off), s];
    for (let k = 0; k < 2; k++) {
      const a = cuts[k] + (k ? g : 0);
      const b = cuts[k + 1];
      const grad = ctx.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, shade(pal.wallTop, 0.1));
      grad.addColorStop(1, shade(pal.wallTop, -0.06));
      ctx.fillStyle = grad;
      ctx.fillRect(a, y0 + g, b - a, y1 - y0 - g);
      ctx.fillStyle = 'rgba(255,250,235,0.25)';
      ctx.fillRect(a, y0 + g, b - a, g);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(a, y1 - g, b - a, g);
    }
  });
  if (front) {
    // Front face in shadow, with a gilded cornice along its top edge.
    const fg = ctx.createLinearGradient(0, top, 0, s);
    fg.addColorStop(0, pal.wallFront);
    fg.addColorStop(1, pal.wallFrontDark);
    ctx.fillStyle = fg;
    ctx.fillRect(0, top, s, fh);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(s * ((x % 2) ? 0.3 : 0.62)), top, g, fh);
    const trim = pal.trim || '#c9a24a';
    const cg = ctx.createLinearGradient(0, top, 0, top + g * 3);
    cg.addColorStop(0, '#fff3c4');
    cg.addColorStop(0.4, trim);
    cg.addColorStop(1, shade(trim, -0.35));
    ctx.fillStyle = cg;
    ctx.fillRect(0, top, s, g * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, top + g * 3, s, g);
    // Small carved rosette on some wall faces.
    if (hash(x, y, 17) > 0.8 && !pal.banner) {
      const cx = s * 0.5;
      const cy = top + fh * 0.58;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      circle(ctx, cx, cy + g, fh * 0.2);
      ctx.fillStyle = shade(trim, -0.15);
      circle(ctx, cx, cy, fh * 0.18);
      ctx.fillStyle = '#fff0b8';
      circle(ctx, cx - fh * 0.04, cy - fh * 0.04, fh * 0.06);
    }
  }
  if (hash(x, y, 7) > 0.55) {
    ctx.fillStyle = pal.moss;
    const mx = hash(x, y, 8) * s * 0.6;
    ctx.beginPath();
    ctx.ellipse(mx + s * 0.2, s * 0.08, s * 0.22, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.mossLight;
    circle(ctx, mx + s * 0.15, s * 0.06, s * 0.05);
    if (front && hash(x, y, 11) > 0.5) {
      ctx.fillStyle = pal.moss;
      ctx.fillRect(mx + s * 0.1, top, s * 0.05, fh * 0.7);
      ctx.fillRect(mx + s * 0.22, top, s * 0.04, fh * 0.45);
    }
  }
  // Hanging banners and prayer flags on wall faces.
  if (front && pal.banner && hash(x, y, 13) > 0.78) {
    const bx = s * 0.3;
    ctx.fillStyle = pal.bannerTrim;
    ctx.fillRect(bx - s * 0.03, top - s * 0.02, s * 0.46, s * 0.04);
    ctx.fillStyle = pal.banner;
    poly(ctx, [bx, top, bx + s * 0.4, top, bx + s * 0.4, s - s * 0.08, bx + s * 0.2, s - s * 0.16, bx, s - s * 0.08]);
    ctx.fillStyle = pal.bannerTrim;
    circle(ctx, bx + s * 0.2, top + s * 0.12, s * 0.05);
  }
  if (cracked) {
    ctx.strokeStyle = '#2a2112';
    ctx.lineWidth = Math.max(1, s / 14);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.1);
    ctx.lineTo(s * 0.45, s * 0.35);
    ctx.lineTo(s * 0.35, s * 0.55);
    ctx.lineTo(s * 0.6, s * 0.8);
    ctx.moveTo(s * 0.45, s * 0.35);
    ctx.lineTo(s * 0.75, s * 0.3);
    ctx.moveTo(s * 0.35, s * 0.55);
    ctx.lineTo(s * 0.15, s * 0.7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,0.25)';
    ctx.lineWidth = Math.max(0.6, s / 40);
    ctx.stroke();
  }
}

export function drawPit(ctx, s, pal) {
  ctx.fillStyle = pal.grout;
  ctx.fillRect(0, 0, s, s);
  // Stone lip.
  ctx.fillStyle = shade(pal.floor, -0.25);
  roundRect(ctx, s * 0.04, s * 0.06, s * 0.92, s * 0.9, s * 0.14);
  ctx.fill();
  const g = ctx.createRadialGradient(s / 2, s * 0.7, s * 0.02, s / 2, s * 0.55, s * 0.55);
  g.addColorStop(0, '#000');
  g.addColorStop(0.7, pal.pit);
  g.addColorStop(1, shade(pal.pit === '#0e0b07' ? '#3a2c1a' : pal.pit, 0.1));
  ctx.fillStyle = g;
  roundRect(ctx, s * 0.1, s * 0.12, s * 0.8, s * 0.8, s * 0.12);
  ctx.fill();
  // Inner wall catching a little light at the top edge.
  const w = ctx.createLinearGradient(0, s * 0.12, 0, s * 0.4);
  w.addColorStop(0, 'rgba(120,95,60,0.55)');
  w.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = w;
  roundRect(ctx, s * 0.1, s * 0.12, s * 0.8, s * 0.28, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.25)';
  ctx.lineWidth = Math.max(0.6, s / 40);
  roundRect(ctx, s * 0.04, s * 0.06, s * 0.92, s * 0.9, s * 0.14);
  ctx.stroke();
}

export function drawWater(ctx, s, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, shade(pal.water, -0.2));
  g.addColorStop(1, shade(pal.water, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = pal.waterLight;
  ctx.lineWidth = Math.max(1, s / 26);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const yy = ((i / 3 + t) % 1) * s;
    const xx = (i * 0.37) % 0.5;
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(((i / 3 + t) % 1) * Math.PI);
    ctx.beginPath();
    ctx.moveTo(s * (0.08 + xx), yy);
    ctx.quadraticCurveTo(s * (0.25 + xx), yy - s * 0.05, s * (0.42 + xx), yy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, s, s * 0.1);
}

export function drawLair(ctx, s, pal, x, t) {
  ctx.fillStyle = pal.lair;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = pal.lairLight;
  ctx.lineWidth = Math.max(1, s / 18);
  const ph = t * 2 + x * 0.7;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5 + Math.sin(ph) * s * 0.06);
  ctx.quadraticCurveTo(s * 0.5, s * 0.4 + Math.cos(ph) * s * 0.08, s, s * 0.5 + Math.sin(ph + 1) * s * 0.06);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, s, s * 0.15);
}

// Spike floors: 'down', 'warn' (tips peek out) and 'up'.
export function drawSpikes(ctx, s, phase) {
  const holes = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
  ctx.fillStyle = 'rgba(40,30,15,0.45)';
  roundRect(ctx, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.08);
  ctx.fill();
  for (const [hx, hy] of holes) {
    ctx.fillStyle = '#2b2215';
    circle(ctx, s * hx, s * hy, s * 0.09);
    if (phase === 'warn') {
      ctx.fillStyle = COLORS.spike;
      poly(ctx, [s * hx, s * (hy - 0.08), s * (hx + 0.05), s * (hy + 0.02), s * (hx - 0.05), s * (hy + 0.02)]);
    } else if (phase === 'up') {
      ctx.fillStyle = COLORS.spikeDark;
      poly(ctx, [s * hx, s * (hy - 0.24), s * (hx + 0.1), s * (hy + 0.06), s * (hx - 0.1), s * (hy + 0.06)]);
      ctx.fillStyle = COLORS.spike;
      poly(ctx, [s * hx, s * (hy - 0.24), s * (hx + 0.02), s * (hy + 0.06), s * (hx - 0.1), s * (hy + 0.06)]);
    }
  }
}

export function drawPlate(ctx, s, down) {
  ctx.fillStyle = '#7d6a45';
  roundRect(ctx, s * 0.14, s * 0.14, s * 0.72, s * 0.72, s * 0.08);
  ctx.fill();
  ctx.fillStyle = down ? '#6a5937' : '#a89066';
  roundRect(ctx, s * 0.2, s * (down ? 0.24 : 0.18), s * 0.6, s * 0.58, s * 0.06);
  ctx.fill();
  ctx.fillStyle = down ? '#ffd36b' : '#5b4b2e';
  circle(ctx, s * 0.5, s * (down ? 0.53 : 0.47), s * 0.07);
}

export function drawGate(ctx, s, open) {
  if (open) {
    ctx.fillStyle = 'rgba(30,24,14,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(s * (0.14 + i * 0.22), s * 0.05, s * 0.06, s * 0.12);
    return;
  }
  ctx.fillStyle = '#3a3a3f';
  ctx.fillRect(0, s * 0.08, s, s * 0.08);
  ctx.fillRect(0, s * 0.78, s, s * 0.08);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#5c5d66';
    ctx.fillRect(s * (0.12 + i * 0.22), s * 0.02, s * 0.09, s * 0.92);
    ctx.fillStyle = '#9fa1ad';
    ctx.fillRect(s * (0.12 + i * 0.22), s * 0.02, s * 0.03, s * 0.92);
  }
}

export function drawDoor(ctx, s, color, shape, pal) {
  ctx.fillStyle = pal.wallFront;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = COLORS.keyDark[color];
  roundRect(ctx, s * 0.12, s * 0.08, s * 0.76, s * 0.86, s * 0.3);
  ctx.fill();
  ctx.fillStyle = COLORS.key[color];
  roundRect(ctx, s * 0.18, s * 0.14, s * 0.64, s * 0.8, s * 0.26);
  ctx.fill();
  ctx.fillStyle = COLORS.keyDark[color];
  shapeGlyph(ctx, shape, s * 0.5, s * 0.5, s * 0.16);
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.5;
  shapeGlyph(ctx, shape, s * 0.47, s * 0.47, s * 0.06);
  ctx.globalAlpha = 1;
}

export function drawLever(ctx, s, on, pal) {
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#4a3b22';
  roundRect(ctx, s * 0.25, s * 0.55, s * 0.5, s * 0.3, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = '#8a8d96';
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.66);
  ctx.lineTo(s * (on ? 0.78 : 0.22), s * 0.22);
  ctx.stroke();
  ctx.fillStyle = on ? '#ffd36b' : '#c9423f';
  circle(ctx, s * (on ? 0.78 : 0.22), s * 0.22, s * 0.1);
}

export function drawIdol(ctx, s, active, t) {
  if (active) {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.55);
    g.addColorStop(0, `rgba(255,211,107,${0.45 + Math.sin(t * 3) * 0.15})`);
    g.addColorStop(1, 'rgba(255,211,107,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  ctx.fillStyle = '#6d5a35';
  roundRect(ctx, s * 0.25, s * 0.7, s * 0.5, s * 0.18, s * 0.04);
  ctx.fill();
  ctx.fillStyle = active ? COLORS.idolGlow : COLORS.idol;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.58, s * 0.2, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, s * 0.5, s * 0.34, s * 0.14);
  ctx.fillStyle = '#4a3b22';
  ctx.fillRect(s * 0.44, s * 0.32, s * 0.03, s * 0.03);
  ctx.fillRect(s * 0.53, s * 0.32, s * 0.03, s * 0.03);
}

export function drawExit(ctx, s, open, t, pal) {
  // Carved archway with a gilded frame; a light portal when open.
  ctx.fillStyle = pal.wallFront;
  ctx.fillRect(0, 0, s, s);
  const arch = (inset, r) => {
    ctx.beginPath();
    ctx.moveTo(s * inset, s);
    ctx.lineTo(s * inset, s * (0.1 + inset + r));
    ctx.arc(s * 0.5, s * (0.1 + inset + r), s * (0.5 - inset), Math.PI, 0);
    ctx.lineTo(s * (1 - inset), s);
    ctx.closePath();
  };
  arch(0.06, 0.3);
  const gold = ctx.createLinearGradient(0, 0, s, s);
  gold.addColorStop(0, '#fff1b8');
  gold.addColorStop(0.35, '#e0b44c');
  gold.addColorStop(0.7, '#a8791e');
  gold.addColorStop(1, '#5b3d0a');
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.strokeStyle = '#3a2605';
  ctx.lineWidth = Math.max(1, s / 40);
  ctx.stroke();
  arch(0.15, 0.22);
  if (open) {
    const g = ctx.createRadialGradient(s / 2, s * 0.6, s * 0.02, s / 2, s * 0.6, s * 0.45);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, COLORS.exitGlow);
    g.addColorStop(1, '#10405e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    arch(0.15, 0.22);
    ctx.clip();
    ctx.translate(s / 2, s * 0.6);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.6, -s * 0.07);
      ctx.lineTo(s * 0.6, s * 0.07);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, s / 30);
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.6, s * (0.08 + ((t * 0.6) % 1) * 0.22), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Sealed double doors of dark timber with gold studs.
    const wd = ctx.createLinearGradient(0, 0, s, 0);
    wd.addColorStop(0, '#3b2210');
    wd.addColorStop(0.5, '#5a3419');
    wd.addColorStop(1, '#2c180a');
    ctx.fillStyle = wd;
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(s * 0.495, s * 0.3, s * 0.02, s * 0.7);
    ctx.fillStyle = '#e8c15a';
    for (const yy of [0.45, 0.65, 0.85]) {
      circle(ctx, s * 0.3, s * yy, s * 0.028);
      circle(ctx, s * 0.7, s * yy, s * 0.028);
    }
    // Seal.
    ctx.fillStyle = '#e8c15a';
    circle(ctx, s * 0.5, s * 0.58, s * 0.075);
    ctx.fillStyle = '#7a1020';
    circle(ctx, s * 0.5, s * 0.58, s * 0.045);
  }
}

// Secret exit: a hidden stairway down.
export function drawStairs(ctx, s, t) {
  ctx.fillStyle = '#20180c';
  ctx.fillRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(200,170,110,${0.8 - i * 0.18})`;
    ctx.fillRect(s * 0.14, s * (0.16 + i * 0.18), s * 0.72, s * 0.1);
  }
  ctx.fillStyle = `rgba(255,70,90,${0.25 + Math.sin(t * 4) * 0.15})`;
  circle(ctx, s * 0.5, s * 0.8, s * 0.12);
}

// ---------- objects ----------

export function drawBoulder(ctx, s, round) {
  drawBoulderHQ(ctx, s, round);
}

export function drawCrate(ctx, s) {
  drawCrateHQ(ctx, s);
}

export function drawGem(ctx, s, red, t = 0) {
  drawGemHQ(ctx, s, red ? 'red' : 'blue', t);
}

export function drawKey(ctx, s, color, shape) {
  drawKeyHQ(ctx, s, color);
  // Shape glyph on the bow stone keeps keys readable without colour.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  shapeGlyph(ctx, shape, s * 0.3, s * 0.48, s * 0.04);
}

export function drawHammer(ctx, s) {
  ctx.fillStyle = '#7b4a22';
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-0.6);
  ctx.fillRect(-s * 0.05, -s * 0.1, s * 0.1, s * 0.5);
  ctx.fillStyle = '#6f727c';
  ctx.fillRect(-s * 0.25, -s * 0.3, s * 0.5, s * 0.22);
  ctx.fillStyle = '#b8bcc8';
  ctx.fillRect(-s * 0.25, -s * 0.3, s * 0.5, s * 0.06);
  ctx.restore();
}

export function drawGrapple(ctx, s) {
  ctx.strokeStyle = '#c9a15a';
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.55, s * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#8a8d96';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.15);
  ctx.lineTo(s * 0.5, s * 0.4);
  ctx.moveTo(s * 0.35, s * 0.22);
  ctx.lineTo(s * 0.5, s * 0.12);
  ctx.lineTo(s * 0.65, s * 0.22);
  ctx.stroke();
}

export function drawFruit(ctx, s) {
  ctx.fillStyle = '#f2a33a';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.56, s * 0.24, s * 0.28, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  circle(ctx, s * 0.42, s * 0.46, s * 0.07);
  ctx.fillStyle = '#4f9a3a';
  ctx.beginPath();
  ctx.ellipse(s * 0.6, s * 0.26, s * 0.12, s * 0.05, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- characters ----------

// Kai Mercer: wide-brim hat, satchel, boots. Reads in four directions.
export function drawHero(ctx, s, dir, frame, opts = {}) {
  const bob = frame ? s * 0.03 : 0;
  const side = dir === 'L' ? -1 : dir === 'R' ? 1 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.9, s * 0.26, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  // boots
  ctx.fillStyle = COLORS.boots;
  const step = frame ? s * 0.05 : 0;
  ctx.fillRect(s * 0.34, s * 0.76 - step, s * 0.12, s * 0.12);
  ctx.fillRect(s * 0.54, s * 0.76 + step - (frame ? s * 0.05 : 0), s * 0.12, s * 0.12);
  // body
  ctx.fillStyle = opts.outfit || COLORS.shirt;
  roundRect(ctx, s * 0.28, s * 0.44 - bob, s * 0.44, s * 0.36, s * 0.1);
  ctx.fill();
  ctx.fillStyle = COLORS.shirtDark;
  ctx.fillRect(s * 0.28, s * 0.66 - bob, s * 0.44, s * 0.05);
  // satchel strap and bag
  ctx.fillStyle = COLORS.satchel;
  ctx.save();
  ctx.translate(s * 0.5, s * 0.58 - bob);
  ctx.rotate(0.7);
  ctx.fillRect(-s * 0.03, -s * 0.18, s * 0.06, s * 0.36);
  ctx.restore();
  if (dir !== 'U') {
    roundRect(ctx, s * (side < 0 ? 0.56 : 0.2), s * 0.62 - bob, s * 0.2, s * 0.14, s * 0.03);
    ctx.fill();
  }
  // head
  ctx.fillStyle = COLORS.skin;
  circle(ctx, s * 0.5 + side * s * 0.03, s * 0.34 - bob, s * 0.15);
  if (dir !== 'U') {
    ctx.fillStyle = '#2b1a0c';
    if (side === 0) {
      ctx.fillRect(s * 0.43, s * 0.35 - bob, s * 0.04, s * 0.05);
      ctx.fillRect(s * 0.53, s * 0.35 - bob, s * 0.04, s * 0.05);
    } else {
      ctx.fillRect(s * 0.5 + side * s * 0.1 - s * 0.02, s * 0.35 - bob, s * 0.04, s * 0.05);
    }
  }
  // hat: brim + crown + band
  ctx.fillStyle = COLORS.hat;
  ctx.beginPath();
  ctx.ellipse(s * 0.5 + side * s * 0.02, s * 0.25 - bob, s * 0.3, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, s * 0.36 + side * s * 0.02, s * 0.08 - bob, s * 0.28, s * 0.17, s * 0.07);
  ctx.fill();
  ctx.fillStyle = COLORS.hatBand;
  ctx.fillRect(s * 0.36 + side * s * 0.02, s * 0.19 - bob, s * 0.28, s * 0.05);
  if (opts.hurt) {
    ctx.fillStyle = 'rgba(255,60,60,0.45)';
    circle(ctx, s * 0.5, s * 0.5, s * 0.42);
  }
}

export function drawSnake(ctx, s, dir, frame) {
  const flip = dir === 'L' || dir === 'U' ? -1 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.84, s * 0.34, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(s / 2, s / 2);
  if (dir === 'U' || dir === 'D') ctx.rotate(Math.PI / 2);
  ctx.scale(flip, 1);
  ctx.strokeStyle = COLORS.snakeDark;
  ctx.lineWidth = s * 0.2;
  ctx.lineCap = 'round';
  const w = frame ? 0.06 : -0.06;
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, s * 0.12);
  ctx.bezierCurveTo(-s * 0.2, -s * (0.1 + w), 0, s * (0.3 + w), s * 0.18, s * 0.02);
  ctx.stroke();
  ctx.strokeStyle = COLORS.snake;
  ctx.lineWidth = s * 0.13;
  ctx.stroke();
  ctx.fillStyle = COLORS.snake;
  ctx.beginPath();
  ctx.ellipse(s * 0.26, -s * 0.02, s * 0.14, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  circle(ctx, s * 0.3, -s * 0.06, s * 0.03);
  ctx.strokeStyle = '#d23b3b';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(s * 0.38, 0);
  ctx.lineTo(s * 0.46, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawScarab(ctx, s, frame) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.82, s * 0.28, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#141b29';
  ctx.lineWidth = Math.max(1, s * 0.04);
  const l = frame ? 0.05 : -0.05;
  for (const yy of [0.4, 0.52, 0.64]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * (yy + l));
    ctx.lineTo(s * 0.8, s * (yy - l));
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.scarab;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.55, s * 0.22, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, s * 0.5, s * 0.26, s * 0.1);
  ctx.fillStyle = COLORS.scarabShine;
  ctx.beginPath();
  ctx.ellipse(s * 0.43, s * 0.48, s * 0.05, s * 0.12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141b29';
  ctx.fillRect(s * 0.49, s * 0.34, s * 0.02, s * 0.46);
}

export function drawMonkey(ctx, s, frame, carrying, calm) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.86, s * 0.26, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  const b = frame ? s * 0.03 : 0;
  ctx.strokeStyle = COLORS.monkeyDark;
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(s * 0.68, s * 0.7);
  ctx.quadraticCurveTo(s * 0.95, s * 0.6, s * 0.82, s * 0.35);
  ctx.stroke();
  ctx.fillStyle = COLORS.monkey;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.62 - b, s * 0.2, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, s * 0.5, s * 0.32 - b, s * 0.17);
  ctx.fillStyle = COLORS.monkeyDark;
  circle(ctx, s * 0.32, s * 0.3 - b, s * 0.07);
  circle(ctx, s * 0.68, s * 0.3 - b, s * 0.07);
  ctx.fillStyle = '#c9bfae';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.37 - b, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = calm ? '#555' : '#111';
  ctx.fillRect(s * 0.43, s * 0.28 - b, s * 0.04, calm ? s * 0.015 : s * 0.04);
  ctx.fillRect(s * 0.53, s * 0.28 - b, s * 0.04, calm ? s * 0.015 : s * 0.04);
  if (carrying) {
    ctx.save();
    ctx.translate(s * 0.28, s * 0.5 - b);
    drawGem(ctx, s * 0.4, false, 0);
    ctx.restore();
  }
}

// The Naga Warden's head: a stone serpent with a glowing crown jewel.
export function drawNaga(ctx, s, t, hurt, mouthOpen) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const w = s * 0.62;
  ctx.fillStyle = COLORS.nagaDark;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.05, w, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hurt ? '#e0e0e0' : COLORS.naga;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.9, s * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  // hood fins
  ctx.fillStyle = COLORS.nagaDark;
  poly(ctx, [-w * 0.9, -s * 0.1, -w * 1.25, -s * 0.5, -w * 0.5, -s * 0.3]);
  poly(ctx, [w * 0.9, -s * 0.1, w * 1.25, -s * 0.5, w * 0.5, -s * 0.3]);
  // eyes
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.ellipse(-w * 0.4, -s * 0.08, s * 0.08, s * 0.05, 0.3, 0, Math.PI * 2);
  ctx.ellipse(w * 0.4, -s * 0.08, s * 0.08, s * 0.05, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-w * 0.4 - s * 0.01, -s * 0.12, s * 0.02, s * 0.08);
  ctx.fillRect(w * 0.4 - s * 0.01, -s * 0.12, s * 0.02, s * 0.08);
  // mouth
  ctx.fillStyle = '#2a1010';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.2, w * 0.4, mouthOpen ? s * 0.12 : s * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // crown jewel
  const pulse = (Math.sin(t * 4) + 1) / 2;
  ctx.fillStyle = `rgba(255,76,106,${0.3 + pulse * 0.4})`;
  circle(ctx, 0, -s * 0.34, s * 0.16);
  ctx.fillStyle = COLORS.nagaJewel;
  poly(ctx, [0, -s * 0.48, s * 0.1, -s * 0.34, 0, -s * 0.2, -s * 0.1, -s * 0.34]);
  ctx.restore();
}

export function drawNagaBody(ctx, s) {
  ctx.fillStyle = COLORS.nagaDark;
  ctx.beginPath();
  ctx.ellipse(s / 2, s / 2, s * 0.48, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.naga;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.46, s * 0.42, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.nagaDark;
  for (let i = 0; i < 3; i++) circle(ctx, s * (0.28 + i * 0.22), s * 0.44, s * 0.05);
}

export { PALETTES };
