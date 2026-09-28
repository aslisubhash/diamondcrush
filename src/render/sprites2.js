// Procedural art for Worlds 2 to 5: new tiles, tools, enemies, bosses and
// Meera Rao. Same rules as sprites.js: shapes scaled to any tile size.
import { COLORS } from './palette.js';
import { drawHero, drawGem } from './sprites.js';

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ROT = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 };

function shadow(ctx, s, w = 0.3) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.86, s * w, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- floors ----------

export function drawIce(ctx, s, x, y) {
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, '#d7f0ff');
  g.addColorStop(1, '#9fd0f2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1, s / 20);
  ctx.beginPath();
  const o = ((x * 7 + y * 3) % 5) / 10;
  ctx.moveTo(s * (0.15 + o * 0.3), s * 0.25);
  ctx.lineTo(s * (0.45 + o * 0.3), s * 0.12);
  ctx.moveTo(s * 0.5, s * 0.75);
  ctx.lineTo(s * 0.85, s * 0.55);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,140,190,0.35)';
  ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
}

export function drawConveyor(ctx, s, dir, t) {
  ctx.fillStyle = '#2d2f35';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#44474f';
  ctx.fillRect(0, s * 0.1, s, s * 0.8);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(ROT[dir]);
  ctx.beginPath();
  ctx.rect(-s / 2, -s * 0.4, s, s * 0.8);
  ctx.clip();
  ctx.strokeStyle = '#e0b43c';
  ctx.lineWidth = Math.max(1, s / 12);
  const off = ((t * 3) % 1) * (s / 2);
  for (let k = -2; k < 3; k++) {
    const xx = k * (s / 2) + off;
    ctx.beginPath();
    ctx.moveTo(xx - s * 0.12, -s * 0.2);
    ctx.lineTo(xx + s * 0.08, 0);
    ctx.lineTo(xx - s * 0.12, s * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWind(ctx, s, dir, t, pal) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(ROT[dir]);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, s / 18);
  for (let k = 0; k < 3; k++) {
    const ph = ((t * 1.5 + k / 3) % 1) * s - s / 2;
    ctx.beginPath();
    ctx.moveTo(ph - s * 0.2, (k - 1) * s * 0.25);
    ctx.quadraticCurveTo(ph, (k - 1) * s * 0.25 - s * 0.08, ph + s * 0.2, (k - 1) * s * 0.25);
    ctx.stroke();
  }
  ctx.restore();
  void pal;
}

export function drawBlade(ctx, s, phase, t) {
  ctx.fillStyle = 'rgba(20,20,25,0.45)';
  ctx.fillRect(s * 0.05, s * 0.44, s * 0.9, s * 0.12);
  if (phase === 'down') return;
  ctx.save();
  ctx.translate(s / 2, s / 2);
  const a = phase === 'up' ? 0 : Math.sin(t * 20) * 0.15 + 0.5;
  ctx.globalAlpha = phase === 'up' ? 1 : 0.45;
  ctx.rotate(a);
  ctx.fillStyle = '#c7ccd6';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.46, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f6fb';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.05, s * 0.4, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBrazier(ctx, s, lit, t, pal) {
  ctx.fillStyle = pal.wallFront;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#3b2c1c';
  poly(ctx, [s * 0.2, s * 0.5, s * 0.8, s * 0.5, s * 0.65, s * 0.8, s * 0.35, s * 0.8]);
  ctx.fillStyle = '#6b5234';
  ctx.fillRect(s * 0.15, s * 0.45, s * 0.7, s * 0.08);
  ctx.fillRect(s * 0.44, s * 0.8, s * 0.12, s * 0.15);
  if (lit) {
    const f = Math.sin(t * 14) * s * 0.04;
    const g = ctx.createRadialGradient(s / 2, s * 0.35, 0, s / 2, s * 0.35, s * 0.55);
    g.addColorStop(0, 'rgba(255,190,90,0.55)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = COLORS.flame;
    poly(ctx, [s * 0.28, s * 0.47, s * 0.5, s * 0.08 + f, s * 0.72, s * 0.47]);
    ctx.fillStyle = COLORS.flameCore;
    poly(ctx, [s * 0.4, s * 0.47, s * 0.5, s * 0.25 - f, s * 0.6, s * 0.47]);
  } else {
    ctx.fillStyle = '#2a2a2a';
    circle(ctx, s * 0.42, s * 0.45, s * 0.05);
    circle(ctx, s * 0.56, s * 0.44, s * 0.04);
  }
}

export function drawJet(ctx, s, dir, phase, pal) {
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(ROT[dir]);
  ctx.fillStyle = '#3a3b40';
  rr(ctx, -s * 0.3, -s * 0.22, s * 0.6, s * 0.44, s * 0.06);
  ctx.fill();
  ctx.fillStyle = phase === 'warn' || phase === 'up' ? '#ff7a2f' : '#1c1c20';
  rr(ctx, s * 0.1, -s * 0.12, s * 0.38, s * 0.24, s * 0.05);
  ctx.fill();
  ctx.restore();
}

export function drawFire(ctx, s, t, x) {
  const f = Math.sin(t * 20 + x) * s * 0.05;
  ctx.fillStyle = 'rgba(255,120,30,0.85)';
  poly(ctx, [0, s * 0.85, s * 0.2, s * 0.2 + f, s * 0.45, s * 0.6, s * 0.6, s * 0.05 - f, s * 0.8, s * 0.55, s, s * 0.3 + f, s, s * 0.85]);
  ctx.fillStyle = 'rgba(255,230,140,0.9)';
  poly(ctx, [s * 0.15, s * 0.85, s * 0.35, s * 0.45, s * 0.55, s * 0.7, s * 0.7, s * 0.35, s * 0.85, s * 0.85]);
}

export function drawVenom(ctx, s, t) {
  ctx.fillStyle = `rgba(150,220,60,${0.6 + Math.sin(t * 20) * 0.2})`;
  for (let k = 0; k < 3; k++) circle(ctx, s * (0.25 + k * 0.25), s * (0.5 + Math.sin(t * 9 + k) * 0.1), s * 0.1);
}

export function drawBridge(ctx, s, open, pal, t) {
  if (open) {
    ctx.fillStyle = '#6d4a2a';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8a6036';
    for (let k = 0; k < 4; k++) ctx.fillRect(s * 0.04, s * (0.03 + k * 0.25), s * 0.92, s * 0.19);
    ctx.fillStyle = '#3b2716';
    ctx.fillRect(s * 0.1, 0, s * 0.05, s);
    ctx.fillRect(s * 0.85, 0, s * 0.05, s);
    return;
  }
  ctx.fillStyle = pal.water;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = pal.waterLight;
  ctx.lineWidth = Math.max(1, s / 20);
  const yy = ((t * 0.3) % 1) * s;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, yy);
  ctx.quadraticCurveTo(s * 0.3, yy - s * 0.06, s * 0.5, yy);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, s, s * 0.15);
}

export function drawLamp(ctx, s, dir, pal, laser) {
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = laser ? '#2a2d36' : '#8a6a2a';
  circle(ctx, s / 2, s / 2, s * 0.3);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(ROT[dir]);
  ctx.fillStyle = laser ? COLORS.laser : COLORS.light;
  rr(ctx, s * 0.05, -s * 0.12, s * 0.38, s * 0.24, s * 0.06);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = laser ? '#ff9aad' : '#fff7d6';
  circle(ctx, s / 2, s / 2, s * 0.1);
}

export function drawSensor(ctx, s, lit, pal, t) {
  ctx.fillStyle = pal.wallFront;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#6b5a2a';
  circle(ctx, s / 2, s / 2, s * 0.36);
  ctx.fillStyle = lit ? COLORS.light : '#2b2615';
  circle(ctx, s / 2, s / 2, s * 0.26);
  ctx.strokeStyle = lit ? '#fff' : '#8a7a3a';
  ctx.lineWidth = Math.max(1, s / 22);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + (lit ? t : 0);
    ctx.beginPath();
    ctx.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3);
    ctx.lineTo(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42);
    ctx.stroke();
  }
}

export function drawBeamCell(ctx, s, laser, t, axis = '+') {
  const w = s * (laser ? 0.12 : 0.18) * (1 + Math.sin(t * 25) * 0.15);
  ctx.fillStyle = laser ? 'rgba(255,45,85,0.85)' : 'rgba(255,236,150,0.8)';
  if (axis !== '|') ctx.fillRect(0, s / 2 - w / 2, s, w);
  if (axis !== '-') ctx.fillRect(s / 2 - w / 2, 0, w, s);
  ctx.fillStyle = laser ? 'rgba(255,200,210,0.6)' : 'rgba(255,255,240,0.7)';
  if (axis !== '|') ctx.fillRect(0, s / 2 - w / 6, s, w / 3);
  if (axis !== '-') ctx.fillRect(s / 2 - w / 6, 0, w / 3, s);
}

export function drawVent(ctx, s, phase, pal) {
  ctx.fillStyle = pal.wallTop;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#e8f1f8';
  rr(ctx, s * 0.15, s * 0.45, s * 0.7, s * 0.45, s * 0.1);
  ctx.fill();
  ctx.fillStyle = '#9fb6c8';
  for (let k = 0; k < 3; k++) ctx.fillRect(s * (0.25 + k * 0.2), s * 0.55, s * 0.08, s * 0.3);
  if (phase === 'warn') {
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 4; k++) circle(ctx, s * (0.2 + k * 0.2), s * 0.95, s * 0.04);
  }
}

export function drawGrass(ctx, s, x, y) {
  ctx.fillStyle = '#5d7a2c';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#8fb040';
  ctx.lineWidth = Math.max(1, s / 16);
  for (let k = 0; k < 6; k++) {
    const bx = s * (0.1 + ((k * 37 + x * 13 + y * 7) % 80) / 100);
    ctx.beginPath();
    ctx.moveTo(bx, s);
    ctx.quadraticCurveTo(bx + s * 0.05, s * 0.5, bx - s * 0.05, s * 0.05);
    ctx.stroke();
  }
}

export function drawKolam(ctx, s, traced) {
  ctx.fillStyle = traced ? 'rgba(255,90,140,0.35)' : 'rgba(0,0,0,0.12)';
  ctx.fillRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
  ctx.fillStyle = traced ? '#fff' : 'rgba(255,255,255,0.85)';
  for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) circle(ctx, s * a, s * b, s * 0.05);
  ctx.strokeStyle = traced ? '#ffd36b' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, s / 22);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawSwitch(ctx, s, on) {
  ctx.fillStyle = '#4a3b22';
  circle(ctx, s / 2, s / 2, s * 0.26);
  ctx.fillStyle = on ? '#3fbf5f' : '#c9423f';
  circle(ctx, s / 2, s / 2, s * 0.16);
  ctx.strokeStyle = '#d8c08c';
  ctx.lineWidth = Math.max(1, s / 20);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawWell(ctx, s, wet, pal, t) {
  ctx.fillStyle = pal.grout;
  ctx.fillRect(0, 0, s, s);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = k % 2 ? pal.floor : pal.floorAlt;
    ctx.fillRect(s * 0.05 * (k + 1), s * (0.08 + k * 0.3), s * (1 - 0.1 * (k + 1)), s * 0.24);
  }
  if (wet) {
    ctx.fillStyle = 'rgba(21,122,122,0.85)';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(160,230,220,0.8)';
    ctx.lineWidth = Math.max(1, s / 20);
    const yy = ((t * 0.3) % 1) * s;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, yy);
    ctx.quadraticCurveTo(s * 0.4, yy - s * 0.06, s * 0.6, yy);
    ctx.stroke();
  }
}

export function drawCollapse(ctx, s, warn, t) {
  ctx.strokeStyle = 'rgba(40,30,20,0.7)';
  ctx.lineWidth = Math.max(1, s / 16);
  const j = warn ? Math.sin(t * 60) * s * 0.02 : 0;
  ctx.beginPath();
  ctx.moveTo(s * 0.1 + j, s * 0.2);
  ctx.lineTo(s * 0.5, s * 0.45 + j);
  ctx.lineTo(s * 0.9, s * 0.3);
  ctx.moveTo(s * 0.5, s * 0.45);
  ctx.lineTo(s * 0.4 - j, s * 0.9);
  ctx.stroke();
  if (warn) {
    ctx.fillStyle = 'rgba(255,120,60,0.25)';
    ctx.fillRect(0, 0, s, s);
  }
}

export function drawDen(ctx, s, t) {
  ctx.fillStyle = '#9cc6e4';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let k = 0; k < 3; k++) circle(ctx, s * (0.2 + k * 0.3), s * (0.3 + Math.sin(t * 2 + k) * 0.1), s * 0.05);
}

export function drawGear(ctx, s, t) {
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(t * 0.8);
  ctx.fillStyle = '#b8862e';
  for (let k = 0; k < 8; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s * 0.06, -s * 0.42, s * 0.12, s * 0.14);
  }
  circle(ctx, 0, 0, s * 0.3);
  ctx.fillStyle = '#6e4c14';
  circle(ctx, 0, 0, s * 0.12);
  ctx.restore();
}

// ---------- objects ----------

export function drawMirror(ctx, s, o) {
  shadow(ctx, s, 0.26);
  ctx.fillStyle = '#6b5a2a';
  ctx.fillRect(s * 0.42, s * 0.62, s * 0.16, s * 0.24);
  ctx.save();
  ctx.translate(s / 2, s * 0.45);
  ctx.rotate(o === '/' ? -Math.PI / 4 : Math.PI / 4);
  ctx.fillStyle = '#c9a24a';
  rr(ctx, -s * 0.42, -s * 0.09, s * 0.84, s * 0.18, s * 0.04);
  ctx.fill();
  ctx.fillStyle = '#e8f6ff';
  rr(ctx, -s * 0.37, -s * 0.05, s * 0.74, s * 0.1, s * 0.03);
  ctx.fill();
  ctx.restore();
}

export function drawHeartStone(ctx, s, t) {
  shadow(ctx, s, 0.34);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, `rgba(255,120,200,${0.4 + Math.sin(t * 3) * 0.15})`);
  g.addColorStop(1, 'rgba(255,120,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#3a2340';
  rr(ctx, s * 0.12, s * 0.12, s * 0.76, s * 0.72, s * 0.1);
  ctx.fill();
  ctx.fillStyle = '#ff78c8';
  poly(ctx, [s * 0.5, s * 0.22, s * 0.74, s * 0.46, s * 0.5, s * 0.74, s * 0.26, s * 0.46]);
  ctx.fillStyle = '#ffd6ef';
  poly(ctx, [s * 0.5, s * 0.22, s * 0.62, s * 0.34, s * 0.5, s * 0.46, s * 0.38, s * 0.34]);
}

export function drawPot(ctx, s) {
  shadow(ctx, s, 0.3);
  ctx.fillStyle = '#a4502e';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.58, s * 0.32, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a3a20';
  ctx.fillRect(s * 0.34, s * 0.2, s * 0.32, s * 0.12);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(s * 0.22, s * 0.52, s * 0.56, s * 0.05);
  ctx.fillStyle = '#157a7a';
  for (let k = 0; k < 3; k++) circle(ctx, s * (0.35 + k * 0.15), s * 0.66, s * 0.03);
}

export function drawSnow(ctx, s) {
  ctx.fillStyle = '#f4f8fb';
  circle(ctx, s * 0.5, s * 0.5, s * 0.36);
  ctx.fillStyle = '#c9d8e4';
  circle(ctx, s * 0.6, s * 0.6, s * 0.18);
  ctx.fillStyle = '#fff';
  circle(ctx, s * 0.38, s * 0.36, s * 0.1);
}

// ---------- tool icons ----------

export function drawToolSprite(ctx, s, tool) {
  ctx.save();
  if (tool === 'torch') {
    ctx.fillStyle = '#7b4a22';
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(0.4);
    ctx.fillRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.45);
    ctx.fillStyle = COLORS.flame;
    poly(ctx, [-s * 0.14, -s * 0.05, 0, -s * 0.42, s * 0.14, -s * 0.05]);
    ctx.fillStyle = COLORS.flameCore;
    poly(ctx, [-s * 0.06, -s * 0.05, 0, -s * 0.24, s * 0.06, -s * 0.05]);
    ctx.restore();
  } else if (tool === 'frost') {
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const a = (k / 3) * Math.PI;
      ctx.moveTo(s / 2 + Math.cos(a) * s * 0.34, s / 2 + Math.sin(a) * s * 0.34);
      ctx.lineTo(s / 2 - Math.cos(a) * s * 0.34, s / 2 - Math.sin(a) * s * 0.34);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    circle(ctx, s / 2, s / 2, s * 0.08);
  } else if (tool === 'gauntlet') {
    ctx.fillStyle = '#c9a24a';
    rr(ctx, s * 0.25, s * 0.3, s * 0.5, s * 0.45, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#8a6a2a';
    for (let k = 0; k < 4; k++) ctx.fillRect(s * (0.27 + k * 0.12), s * 0.18, s * 0.09, s * 0.18);
    ctx.fillRect(s * 0.28, s * 0.7, s * 0.44, s * 0.1);
  } else if (tool === 'mirror') {
    drawMirror(ctx, s, '/');
  } else if (tool === 'bell') {
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.7);
    ctx.quadraticCurveTo(s * 0.28, s * 0.25, s * 0.5, s * 0.22);
    ctx.quadraticCurveTo(s * 0.72, s * 0.25, s * 0.7, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(s * 0.22, s * 0.68, s * 0.56, s * 0.08);
    ctx.fillStyle = '#6e4c14';
    circle(ctx, s * 0.5, s * 0.8, s * 0.06);
  } else if (tool === 'disc') {
    ctx.strokeStyle = '#e0b43c';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e0b43c';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      circle(ctx, s / 2 + Math.cos(a) * s * 0.38, s / 2 + Math.sin(a) * s * 0.38, s * 0.05);
    }
  }
  ctx.restore();
}

// ---------- Meera Rao ----------

export function drawMeera(ctx, s, dir, frame, opts = {}) {
  const bob = frame ? s * 0.03 : 0;
  const side = dir === 'L' ? -1 : dir === 'R' ? 1 : 0;
  shadow(ctx, s, 0.26);
  ctx.fillStyle = '#3b2412';
  const step = frame ? s * 0.05 : 0;
  ctx.fillRect(s * 0.35, s * 0.76 - step, s * 0.11, s * 0.12);
  ctx.fillRect(s * 0.54, s * 0.76, s * 0.11, s * 0.12);
  ctx.fillStyle = COLORS.meeraTop;
  rr(ctx, s * 0.29, s * 0.44 - bob, s * 0.42, s * 0.38, s * 0.1);
  ctx.fill();
  ctx.fillStyle = COLORS.meeraTopDark;
  ctx.fillRect(s * 0.29, s * 0.7 - bob, s * 0.42, s * 0.05);
  // Dupatta scarf across the shoulder.
  ctx.fillStyle = COLORS.meeraScarf;
  ctx.save();
  ctx.translate(s * 0.5, s * 0.55 - bob);
  ctx.rotate(-0.7);
  ctx.fillRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.4);
  ctx.restore();
  // Braid.
  if (dir !== 'D') {
    ctx.fillStyle = COLORS.meeraHair;
    ctx.fillRect(s * 0.5 - side * s * 0.12 - s * 0.04, s * 0.36 - bob, s * 0.08, s * 0.3);
  }
  ctx.fillStyle = COLORS.meeraSkin;
  circle(ctx, s * 0.5 + side * s * 0.03, s * 0.33 - bob, s * 0.15);
  ctx.fillStyle = COLORS.meeraHair;
  ctx.beginPath();
  ctx.arc(s * 0.5 + side * s * 0.03, s * 0.3 - bob, s * 0.155, Math.PI, 0);
  ctx.fill();
  if (dir !== 'U') {
    ctx.fillStyle = '#1a0f0a';
    if (side === 0) {
      ctx.fillRect(s * 0.43, s * 0.35 - bob, s * 0.04, s * 0.04);
      ctx.fillRect(s * 0.53, s * 0.35 - bob, s * 0.04, s * 0.04);
      ctx.fillStyle = '#d23b3b';
      circle(ctx, s * 0.5, s * 0.27 - bob, s * 0.02);
    } else {
      ctx.fillRect(s * 0.5 + side * s * 0.1 - s * 0.02, s * 0.35 - bob, s * 0.04, s * 0.04);
    }
  } else {
    ctx.fillStyle = COLORS.meeraHair;
    circle(ctx, s * 0.5, s * 0.33 - bob, s * 0.15);
  }
  if (opts.hurt) {
    ctx.fillStyle = 'rgba(255,60,60,0.45)';
    circle(ctx, s * 0.5, s * 0.5, s * 0.42);
  }
}

export function drawExplorer(ctx, s, who, dir, frame, opts) {
  if (who === 'meera') drawMeera(ctx, s, dir, frame, opts);
  else drawHero(ctx, s, dir, frame, opts);
}

// ---------- enemies ----------

export function drawBat(ctx, s, frame) {
  shadow(ctx, s, 0.2);
  const f = frame ? -0.25 : 0.15;
  ctx.fillStyle = COLORS.batWing;
  for (const sd of [-1, 1]) {
    ctx.save();
    ctx.translate(s / 2, s * 0.42);
    ctx.scale(sd, 1);
    ctx.rotate(f);
    poly(ctx, [0, 0, s * 0.42, -s * 0.16, s * 0.34, s * 0.02, s * 0.44, s * 0.12, s * 0.2, s * 0.08]);
    ctx.restore();
  }
  ctx.fillStyle = COLORS.bat;
  circle(ctx, s / 2, s * 0.44, s * 0.14);
  poly(ctx, [s * 0.4, s * 0.34, s * 0.44, s * 0.2, s * 0.47, s * 0.33]);
  poly(ctx, [s * 0.6, s * 0.34, s * 0.56, s * 0.2, s * 0.53, s * 0.33]);
  ctx.fillStyle = '#ff5a5a';
  circle(ctx, s * 0.45, s * 0.43, s * 0.025);
  circle(ctx, s * 0.55, s * 0.43, s * 0.025);
}

export function drawKnight(ctx, s, dir, frame, alert) {
  shadow(ctx, s, 0.28);
  const side = dir === 'L' ? -1 : dir === 'R' ? 1 : 0;
  const b = frame ? s * 0.02 : 0;
  ctx.fillStyle = COLORS.knightDark;
  ctx.fillRect(s * 0.34, s * 0.72, s * 0.12, s * 0.16);
  ctx.fillRect(s * 0.54, s * 0.72, s * 0.12, s * 0.16);
  ctx.fillStyle = COLORS.knight;
  rr(ctx, s * 0.27, s * 0.4 - b, s * 0.46, s * 0.36, s * 0.08);
  ctx.fill();
  ctx.fillStyle = COLORS.knightDark;
  ctx.fillRect(s * 0.27, s * 0.55 - b, s * 0.46, s * 0.04);
  ctx.fillStyle = COLORS.knight;
  rr(ctx, s * 0.33, s * 0.12 - b, s * 0.34, s * 0.32, s * 0.12);
  ctx.fill();
  ctx.fillStyle = alert ? '#ff4a3a' : '#1c1d22';
  ctx.fillRect(s * 0.38 + side * s * 0.04, s * 0.26 - b, s * 0.24, s * 0.05);
  ctx.fillStyle = COLORS.baronPlume;
  poly(ctx, [s * 0.46, s * 0.12 - b, s * 0.5, s * 0.0 - b, s * 0.6, s * 0.12 - b]);
  // Lance
  ctx.strokeStyle = '#6b5234';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(s * 0.5 + side * s * 0.1, s * 0.6);
  ctx.lineTo(s * 0.5 + side * s * 0.45, s * (side ? 0.5 : 0.1));
  ctx.stroke();
}

export function drawRat(ctx, s, dir, frame) {
  shadow(ctx, s, 0.22);
  const flip = dir === 'L' ? -1 : 1;
  ctx.save();
  ctx.translate(s / 2, s * 0.6);
  ctx.scale(flip, 1);
  ctx.strokeStyle = '#b89a8a';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, 0);
  ctx.quadraticCurveTo(-s * 0.4, frame ? -s * 0.15 : s * 0.1, -s * 0.44, -s * 0.05);
  ctx.stroke();
  ctx.fillStyle = COLORS.rat;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.24, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [s * 0.18, -s * 0.1, s * 0.4, 0, s * 0.18, s * 0.08]);
  ctx.fillStyle = '#d9a6a6';
  circle(ctx, s * 0.12, -s * 0.14, s * 0.06);
  ctx.fillStyle = '#111';
  circle(ctx, s * 0.28, -s * 0.03, s * 0.025);
  ctx.restore();
}

export function drawYeti(ctx, s, frame, sliding) {
  shadow(ctx, s, 0.3);
  const b = frame ? s * 0.02 : 0;
  ctx.fillStyle = COLORS.yeti;
  circle(ctx, s / 2, s * 0.58 - b, s * 0.3);
  circle(ctx, s / 2, s * 0.3 - b, s * 0.2);
  ctx.fillStyle = COLORS.yetiDark;
  circle(ctx, s * 0.3, s * 0.62, s * 0.08);
  circle(ctx, s * 0.7, s * 0.62, s * 0.08);
  ctx.fillStyle = '#6fa8d0';
  rr(ctx, s * 0.38, s * 0.26 - b, s * 0.24, s * 0.12, s * 0.05);
  ctx.fill();
  ctx.fillStyle = '#123';
  circle(ctx, s * 0.44, s * 0.3 - b, s * 0.025);
  circle(ctx, s * 0.56, s * 0.3 - b, s * 0.025);
  if (sliding) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(1, s / 20);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.02, s * (0.4 + k * 0.15));
      ctx.lineTo(s * 0.15, s * (0.4 + k * 0.15));
      ctx.stroke();
    }
  }
}

export function drawSpirit(ctx, s, t) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.45);
  g.addColorStop(0, 'rgba(230,248,255,0.95)');
  g.addColorStop(1, 'rgba(160,220,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.45 + Math.sin(t * 3) * s * 0.04, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a6f96';
  circle(ctx, s * 0.43, s * 0.42, s * 0.03);
  circle(ctx, s * 0.57, s * 0.42, s * 0.03);
}

export function drawCobra(ctx, s, dir, warn) {
  shadow(ctx, s, 0.26);
  ctx.fillStyle = COLORS.cobraDark;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.72, s * 0.3, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.cobra;
  ctx.fillRect(s * 0.44, s * 0.38, s * 0.12, s * 0.36);
  ctx.save();
  ctx.translate(s / 2, s * 0.34);
  ctx.rotate(ROT[dir] + Math.PI / 2 * 0);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.32, s * 0.2, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1d9a0';
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.34, s * 0.09, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = warn ? '#9df04a' : '#111';
  const dx = { L: -0.06, R: 0.06, U: 0, D: 0 }[dir] * s;
  circle(ctx, s * 0.44 + dx, s * 0.28, s * 0.03);
  circle(ctx, s * 0.56 + dx, s * 0.28, s * 0.03);
}

export function drawLangur(ctx, s, frame) {
  shadow(ctx, s, 0.24);
  const b = frame ? s * 0.03 : 0;
  ctx.strokeStyle = COLORS.langur;
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(s * 0.62, s * 0.7);
  ctx.bezierCurveTo(s * 0.95, s * 0.7, s * 0.95, s * 0.2, s * 0.8, s * 0.1);
  ctx.stroke();
  ctx.fillStyle = COLORS.langur;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.6 - b, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, s * 0.5, s * 0.3 - b, s * 0.17);
  ctx.fillStyle = COLORS.langurFace;
  circle(ctx, s * 0.5, s * 0.32 - b, s * 0.11);
  ctx.fillStyle = '#e8d9b8';
  circle(ctx, s * 0.45, s * 0.3 - b, s * 0.02);
  circle(ctx, s * 0.55, s * 0.3 - b, s * 0.02);
}

export function drawThug(ctx, s, dir, frame) {
  shadow(ctx, s, 0.26);
  const b = frame ? s * 0.02 : 0;
  ctx.fillStyle = '#0f1014';
  ctx.fillRect(s * 0.35, s * 0.74, s * 0.11, s * 0.14);
  ctx.fillRect(s * 0.54, s * 0.74, s * 0.11, s * 0.14);
  ctx.fillStyle = COLORS.thug;
  rr(ctx, s * 0.27, s * 0.42 - b, s * 0.46, s * 0.36, s * 0.1);
  ctx.fill();
  ctx.fillStyle = COLORS.thugMark;
  poly(ctx, [s * 0.5, s * 0.5 - b, s * 0.58, s * 0.6 - b, s * 0.5, s * 0.7 - b, s * 0.42, s * 0.6 - b]);
  ctx.fillStyle = '#2a2c34';
  circle(ctx, s * 0.5, s * 0.3 - b, s * 0.15);
  ctx.fillStyle = COLORS.thugMark;
  ctx.fillRect(s * 0.4, s * 0.28 - b, s * 0.2, s * 0.04);
  void dir;
}

export function drawTiger(ctx, s, dir, frame, hunting) {
  shadow(ctx, s, 0.34);
  const flip = dir === 'L' ? -1 : 1;
  ctx.save();
  ctx.translate(s / 2, s * 0.56);
  ctx.scale(flip, 1);
  const leg = frame ? s * 0.04 : 0;
  ctx.fillStyle = COLORS.tiger;
  ctx.fillRect(-s * 0.3, s * 0.08, s * 0.08, s * 0.2 + leg);
  ctx.fillRect(s * 0.18, s * 0.08, s * 0.08, s * 0.2 - leg);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.34, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, s * 0.32, -s * 0.1, s * 0.14);
  ctx.fillStyle = COLORS.tigerStripe;
  for (let k = -2; k <= 2; k++) ctx.fillRect(k * s * 0.1 - s * 0.015, -s * 0.15, s * 0.03, s * 0.2);
  ctx.fillStyle = hunting ? '#ff4a3a' : '#f5e56b';
  circle(ctx, s * 0.36, -s * 0.14, s * 0.03);
  ctx.strokeStyle = COLORS.tiger;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.04);
  ctx.quadraticCurveTo(-s * 0.48, -s * 0.2, -s * 0.44, -s * 0.34);
  ctx.stroke();
  ctx.restore();
}

export function drawEcho(ctx, s, dir, frame, who) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawExplorer(ctx, s, who, dir, frame, {});
  ctx.restore();
  ctx.strokeStyle = 'rgba(160,210,255,0.8)';
  ctx.lineWidth = Math.max(1, s / 24);
  ctx.setLineDash([s / 10, s / 12]);
  ctx.strokeRect(s * 0.2, s * 0.05, s * 0.6, s * 0.85);
  ctx.setLineDash([]);
}

// ---------- bosses ----------

export function drawBaron(ctx, s, dir, t, hurt, stunned, alert) {
  shadow(ctx, s, 0.4);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  if (stunned) ctx.rotate(Math.sin(t * 12) * 0.08);
  ctx.translate(-s / 2, -s / 2);
  ctx.fillStyle = hurt ? '#fff' : COLORS.baronDark;
  rr(ctx, s * 0.12, s * 0.35, s * 0.76, s * 0.55, s * 0.12);
  ctx.fill();
  ctx.fillStyle = hurt ? '#eee' : COLORS.baron;
  rr(ctx, s * 0.18, s * 0.38, s * 0.64, s * 0.45, s * 0.1);
  ctx.fill();
  ctx.fillStyle = COLORS.baronDark;
  circle(ctx, s * 0.18, s * 0.42, s * 0.12);
  circle(ctx, s * 0.82, s * 0.42, s * 0.12);
  ctx.fillStyle = hurt ? '#fff' : COLORS.baron;
  rr(ctx, s * 0.3, s * 0.02, s * 0.4, s * 0.38, s * 0.14);
  ctx.fill();
  ctx.fillStyle = alert ? '#ff3a2a' : '#15161b';
  ctx.fillRect(s * 0.34, s * 0.18, s * 0.32, s * 0.06);
  ctx.fillStyle = COLORS.baronPlume;
  poly(ctx, [s * 0.45, s * 0.03, s * 0.5, -s * 0.2, s * 0.62, s * 0.02]);
  if (stunned) {
    ctx.fillStyle = '#ffd36b';
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + (k * Math.PI * 2) / 3;
      circle(ctx, s * 0.5 + Math.cos(a) * s * 0.3, s * 0.0 + Math.sin(a) * s * 0.08, s * 0.05);
    }
  }
  ctx.restore();
  void dir;
}

export function drawFrostfang(ctx, s, t, hurt, breathing) {
  shadow(ctx, s, 0.45);
  ctx.fillStyle = hurt ? '#fff' : COLORS.frostDark;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.55, s * 0.5, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hurt ? '#fff' : COLORS.frost;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.5, s * 0.44, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9fbff';
  for (let k = 0; k < 5; k++) poly(ctx, [s * (0.1 + k * 0.18), s * 0.2, s * (0.19 + k * 0.18), -s * 0.12, s * (0.28 + k * 0.18), s * 0.2]);
  ctx.fillStyle = '#12324a';
  circle(ctx, s * 0.36, s * 0.42, s * 0.05);
  circle(ctx, s * 0.64, s * 0.42, s * 0.05);
  ctx.fillStyle = breathing ? '#bff0ff' : '#2a4d66';
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.66, s * 0.16, breathing ? s * 0.1 : s * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  const pulse = (Math.sin(t * 4) + 1) / 2;
  ctx.fillStyle = `rgba(120,220,255,${0.3 + pulse * 0.4})`;
  circle(ctx, s / 2, s * 0.5, s * 0.08);
}

export function drawRakta(ctx, s, t, hurt, firing) {
  shadow(ctx, s, 0.45);
  drawGear(ctx, s, t * 2);
  ctx.fillStyle = hurt ? '#fff' : COLORS.raktaDark;
  rr(ctx, s * 0.2, s * 0.15, s * 0.6, s * 0.65, s * 0.12);
  ctx.fill();
  ctx.fillStyle = hurt ? '#fff' : COLORS.rakta;
  rr(ctx, s * 0.26, s * 0.2, s * 0.48, s * 0.52, s * 0.1);
  ctx.fill();
  ctx.fillStyle = firing ? '#ff4a2a' : '#3a1a0a';
  circle(ctx, s * 0.4, s * 0.4, s * 0.06);
  circle(ctx, s * 0.6, s * 0.4, s * 0.06);
  ctx.fillStyle = '#6e4c14';
  for (const [x, y] of [[0.5, 0.05], [0.5, 0.95], [0.05, 0.5], [0.95, 0.5]]) {
    rr(ctx, s * x - s * 0.08, s * y - s * 0.08, s * 0.16, s * 0.16, s * 0.03);
    ctx.fill();
  }
}

export function drawHandLeader(ctx, s, dir, t, hurt, frame) {
  shadow(ctx, s, 0.32);
  const b = frame ? s * 0.02 : 0;
  ctx.fillStyle = hurt ? '#fff' : COLORS.hand;
  poly(ctx, [s * 0.5, s * 0.08, s * 0.85, s * 0.88, s * 0.15, s * 0.88]);
  ctx.fillStyle = '#2a2c34';
  circle(ctx, s * 0.5, s * 0.28 - b, s * 0.16);
  const pulse = (Math.sin(t * 5) + 1) / 2;
  ctx.fillStyle = `rgba(35,230,255,${0.5 + pulse * 0.5})`;
  ctx.fillRect(s * 0.4, s * 0.26 - b, s * 0.2, s * 0.04);
  ctx.save();
  ctx.translate(s * 0.5, s * 0.6);
  ctx.fillStyle = COLORS.handGlow;
  for (let k = 0; k < 4; k++) ctx.fillRect(-s * 0.13 + k * s * 0.07, -s * 0.1, s * 0.04, s * 0.12);
  ctx.fillRect(-s * 0.14, s * 0.02, s * 0.26, s * 0.08);
  ctx.restore();
  void dir;
}

export { drawGem };
