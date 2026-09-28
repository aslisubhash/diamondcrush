// Procedural sprite art. Everything is drawn from shapes at any tile size,
// so the same code yields HD art at 96px and chunky Retro art at 24px
// (GDD 7.1 and 7.4: same footprint, same silhouettes).
import { COLORS, PALETTES } from './palette.js';

export function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
  ctx.fillStyle = hash(x, y) > 0.5 ? pal.floor : pal.floorAlt;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = pal.grout;
  const g = Math.max(1, s / 24);
  // Slab joints, offset every other row like laid stone.
  ctx.fillRect(0, 0, s, g);
  ctx.fillRect(y % 2 ? s / 2 : 0, 0, g, s);
  if (hash(x, y, 3) > 0.7) {
    ctx.globalAlpha = 0.35;
    ctx.fillRect(s * 0.2, s * 0.55, s * 0.25, g);
    ctx.globalAlpha = 1;
  }
  if (hash(x, y, 5) > 0.85) {
    ctx.fillStyle = pal.moss;
    ctx.globalAlpha = 0.5;
    circle(ctx, s * 0.75, s * 0.8, s * 0.08);
    circle(ctx, s * 0.82, s * 0.74, s * 0.05);
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
  ctx.fillStyle = pal.earth;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = pal.earthDark;
  ctx.fillRect(0, s * 0.85, s, s * 0.15);
  ctx.fillStyle = pal.earthSpeck;
  for (let i = 0; i < 7; i++) {
    const px = hash(x, y, i * 2) * s * 0.9;
    const py = hash(x, y, i * 2 + 1) * s * 0.8;
    ctx.fillRect(px, py, Math.max(1, s / 12), Math.max(1, s / 16));
  }
  if (hash(x, y, 9) > 0.6) {
    ctx.strokeStyle = pal.root;
    ctx.lineWidth = Math.max(1, s / 20);
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.3);
    ctx.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.6, s * 0.5);
    ctx.quadraticCurveTo(s * 0.7, s * 0.8, s * 0.95, s * 0.7);
    ctx.stroke();
  }
}

// Walls: a lit top face and, when open floor lies below, a darker front face
// (the top-down 3/4 camera, GDD 7.1).
export function drawWall(ctx, s, x, y, pal, front, cracked) {
  const fh = front ? s * 0.38 : 0;
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(0, 0, s, s - fh);
  ctx.fillStyle = pal.wallTopDark;
  const g = Math.max(1, s / 24);
  ctx.fillRect(0, (s - fh) / 2, s, g);
  ctx.fillRect((x + y) % 2 ? s * 0.3 : s * 0.7, 0, g, (s - fh) / 2);
  ctx.fillRect((x + y) % 2 ? s * 0.75 : s * 0.25, (s - fh) / 2, g, (s - fh) / 2);
  if (front) {
    ctx.fillStyle = pal.wallFront;
    ctx.fillRect(0, s - fh, s, fh);
    ctx.fillStyle = pal.wallFrontDark;
    ctx.fillRect(0, s - fh, s, g * 2);
    ctx.fillRect(s * 0.5, s - fh, g, fh);
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
      ctx.fillRect(mx + s * 0.1, s - fh, s * 0.05, fh * 0.7);
      ctx.fillRect(mx + s * 0.22, s - fh, s * 0.04, fh * 0.45);
    }
  }
  // Hanging banners and prayer flags on wall faces.
  if (front && pal.banner && hash(x, y, 13) > 0.78) {
    const bx = s * 0.3;
    ctx.fillStyle = pal.bannerTrim;
    ctx.fillRect(bx - s * 0.03, s - fh - s * 0.02, s * 0.46, s * 0.04);
    ctx.fillStyle = pal.banner;
    poly(ctx, [bx, s - fh, bx + s * 0.4, s - fh, bx + s * 0.4, s - s * 0.08, bx + s * 0.2, s - s * 0.16, bx, s - s * 0.08]);
    ctx.fillStyle = pal.bannerTrim;
    circle(ctx, bx + s * 0.2, s - fh + s * 0.12, s * 0.05);
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
  }
}

export function drawPit(ctx, s, pal) {
  ctx.fillStyle = pal.grout;
  ctx.fillRect(0, 0, s, s);
  const g = ctx.createRadialGradient(s / 2, s * 0.6, s * 0.05, s / 2, s / 2, s * 0.6);
  g.addColorStop(0, '#000');
  g.addColorStop(1, pal.pit);
  ctx.fillStyle = g;
  roundRect(ctx, s * 0.08, s * 0.12, s * 0.84, s * 0.8, s * 0.12);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(s * 0.1, s * 0.12, s * 0.8, s * 0.12);
}

export function drawWater(ctx, s, pal, t) {
  ctx.fillStyle = pal.water;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = pal.waterLight;
  ctx.lineWidth = Math.max(1, s / 20);
  for (let i = 0; i < 3; i++) {
    const yy = ((i / 3 + t) % 1) * s;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, yy);
    ctx.quadraticCurveTo(s * 0.3, yy - s * 0.06, s * 0.5, yy);
    ctx.stroke();
  }
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
  ctx.fillStyle = pal.wallFront;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = pal.wallTop;
  roundRect(ctx, s * 0.06, s * 0.02, s * 0.88, s * 0.96, s * 0.4);
  ctx.fill();
  if (open) {
    const g = ctx.createRadialGradient(s / 2, s * 0.55, s * 0.05, s / 2, s * 0.55, s * 0.45);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, COLORS.exitGlow);
    g.addColorStop(1, '#1b5c7a');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#1a140b';
  }
  roundRect(ctx, s * 0.16, s * 0.12, s * 0.68, s * 0.86, s * 0.32);
  ctx.fill();
  if (open) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, s / 24);
    ctx.beginPath();
    ctx.arc(s / 2, s * 0.58, s * (0.12 + ((t * 0.6) % 1) * 0.2), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5c4a2a';
    for (let i = 0; i < 3; i++) ctx.fillRect(s * (0.3 + i * 0.15), s * 0.45, s * 0.06, s * 0.2);
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
  const c = round ? [COLORS.stone, COLORS.stoneDark, COLORS.stoneLight] : [COLORS.boulder, COLORS.boulderDark, COLORS.boulderLight];
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.86, s * 0.38, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c[1];
  circle(ctx, s * 0.5, s * 0.5, s * 0.42);
  ctx.fillStyle = c[0];
  circle(ctx, s * 0.47, s * 0.46, s * 0.37);
  if (round) {
    ctx.strokeStyle = c[1];
    ctx.lineWidth = Math.max(1, s / 16);
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.22, 0.3, Math.PI * 1.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = c[1];
    for (let i = 0; i < 6; i++) {
      circle(ctx, s * (0.3 + hash(i, 1) * 0.4), s * (0.35 + hash(i, 2) * 0.35), s * 0.03);
    }
  }
  ctx.fillStyle = c[2];
  ctx.beginPath();
  ctx.ellipse(s * 0.36, s * 0.3, s * 0.11, s * 0.07, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCrate(ctx, s) {
  ctx.fillStyle = COLORS.crateDark;
  ctx.fillRect(s * 0.1, s * 0.12, s * 0.8, s * 0.78);
  ctx.fillStyle = COLORS.crate;
  ctx.fillRect(s * 0.15, s * 0.17, s * 0.7, s * 0.68);
  ctx.strokeStyle = COLORS.crateDark;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(s * 0.17, s * 0.2);
  ctx.lineTo(s * 0.83, s * 0.82);
  ctx.stroke();
}

export function drawGem(ctx, s, red, t = 0) {
  const [mid, dark, light] = red ? [COLORS.red, COLORS.redDark, COLORS.redLight] : [COLORS.gem, COLORS.gemDark, COLORS.gemLight];
  const cx = s / 2;
  const top = s * 0.2;
  const girdle = s * 0.42;
  const bot = s * 0.86;
  const hw = s * (red ? 0.36 : 0.32);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, s * 0.9, hw * 0.8, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  poly(ctx, [cx - hw, girdle, cx + hw, girdle, cx, bot]);
  ctx.fillStyle = mid;
  poly(ctx, [cx - hw * 0.45, girdle, cx + hw * 0.45, girdle, cx, bot]);
  ctx.fillStyle = mid;
  poly(ctx, [cx - hw * 0.55, top, cx + hw * 0.55, top, cx + hw, girdle, cx - hw, girdle]);
  ctx.fillStyle = light;
  poly(ctx, [cx - hw * 0.55, top, cx, top, cx - hw * 0.2, girdle, cx - hw, girdle]);
  const tw = (Math.sin(t * 3 + (red ? 1 : 0)) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.65})`;
  const sx = cx + hw * 0.35;
  const sy = top + s * 0.06;
  const r = s * (0.05 + tw * 0.05);
  poly(ctx, [sx, sy - r * 2, sx + r * 0.4, sy, sx, sy + r * 2, sx - r * 0.4, sy]);
  poly(ctx, [sx - r * 2, sy, sx, sy - r * 0.4, sx + r * 2, sy, sx, sy + r * 0.4]);
}

export function drawKey(ctx, s, color, shape) {
  ctx.fillStyle = COLORS.keyDark[color];
  circle(ctx, s * 0.36, s * 0.42, s * 0.2);
  ctx.fillRect(s * 0.44, s * 0.38, s * 0.42, s * 0.12);
  ctx.fillRect(s * 0.7, s * 0.46, s * 0.08, s * 0.16);
  ctx.fillRect(s * 0.8, s * 0.46, s * 0.06, s * 0.12);
  ctx.fillStyle = COLORS.key[color];
  circle(ctx, s * 0.35, s * 0.4, s * 0.16);
  ctx.fillRect(s * 0.44, s * 0.36, s * 0.4, s * 0.08);
  ctx.fillStyle = COLORS.keyDark[color];
  shapeGlyph(ctx, shape, s * 0.35, s * 0.4, s * 0.08);
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
