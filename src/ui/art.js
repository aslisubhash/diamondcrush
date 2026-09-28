// Title screen backdrop and story-comic panel art, drawn with the game's
// own sprite functions.
import * as S from '../render/sprites.js';
import { PALETTES, COLORS } from '../render/palette.js';

const pal = PALETTES.angkor;

function fitCanvas(c) {
  const r = c.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.max(1, Math.round(r.width * dpr));
  c.height = Math.max(1, Math.round(r.height * dpr));
  return c.getContext('2d');
}

function tile(ctx, T, x, y, fn) {
  ctx.save();
  ctx.translate(x * T, y * T);
  fn();
  ctx.restore();
}

// Slowly scrolling temple wall with sparkling gems and resting boulders.
export function startTitleArt(canvas) {
  let raf = 0;
  let ctx = fitCanvas(canvas);
  const onResize = () => { ctx = fitCanvas(canvas); };
  window.addEventListener('resize', onResize);
  const draw = (now) => {
    const t = now / 1000;
    const W = canvas.width;
    const H = canvas.height;
    const T = Math.round(Math.max(W / 9, 48));
    const rows = Math.ceil(H / T) + 2;
    const cols = Math.ceil(W / T);
    const scroll = (t * 12) % T;
    const off = Math.floor((t * 12) / T);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, -scroll);
    for (let r = 0; r < rows; r++) {
      const y = r + off;
      for (let x = 0; x < cols; x++) {
        const h = S.hash(x, y, 1);
        const border = x === 0 || x === cols - 1;
        tile(ctx, T, x, r, () => {
          if (border || h < 0.18) S.drawWall(ctx, T, x, y, pal, S.hash(x, y + 1, 1) >= 0.18 && !border, h < 0.04);
          else if (h < 0.55) S.drawEarth(ctx, T, x, y, pal);
          else S.drawFloor(ctx, T, x, y, pal);
        });
        if (!border && h >= 0.18) {
          const o = S.hash(x, y, 2);
          if (o < 0.12) tile(ctx, T, x, r, () => S.drawGem(ctx, T, false, t + x + y));
          else if (o < 0.2) tile(ctx, T, x, r, () => S.drawBoulder(ctx, T, false));
          else if (o < 0.215) tile(ctx, T, x, r, () => S.drawGem(ctx, T, true, t));
        }
      }
    }
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,15,9,0.55)');
    g.addColorStop(0.45, 'rgba(12,15,9,0.25)');
    g.addColorStop(1, 'rgba(12,15,9,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Hero standing guard near the bottom.
    const hs = Math.round(Math.min(W / 5, 120));
    ctx.save();
    ctx.translate(W / 2 - hs / 2, H * 0.55);
    S.drawHero(ctx, hs, 'D', Math.floor(t * 2) % 2 && false);
    ctx.restore();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}

export const COMIC = [
  { text: 'Long ago, the Star Lattice shattered into five Heart Stones.', art: 'lattice' },
  { text: 'Each stone was hidden in a distant temple, sealed behind traps and stone guardians.', art: 'temple' },
  { text: 'Now the Obsidian Hand, a ruthless syndicate, races to claim them first.', art: 'hand' },
  { text: 'Relic hunter Kai Mercer sets out for the jungle temples of Angkor.', art: 'kai' },
];

export function drawComic(canvas, art) {
  const ctx = fitCanvas(canvas);
  const W = canvas.width;
  const H = canvas.height;
  const T = Math.round(H / 3);
  if (art === 'lattice') {
    ctx.fillStyle = '#0d1426';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(127,224,255,0.8)';
    ctx.lineWidth = Math.max(2, H / 60);
    const cx = W / 2;
    const cy = H * 0.42;
    const R = H * 0.3;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const [x, y] = pts[(i * 2) % 5];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    const s = T * 0.7;
    pts.forEach(([x, y], i) => {
      ctx.save();
      ctx.translate(x - s / 2 + (i - 2) * H * 0.04, y - s / 2 - H * 0.02);
      S.drawGem(ctx, s, i === 0, i);
      ctx.restore();
    });
  } else if (art === 'temple') {
    ctx.fillStyle = '#2b3a22';
    ctx.fillRect(0, 0, W, H);
    const cols = Math.ceil(W / T) + 1;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < 3; y++) {
        tile(ctx, T, x, y, () => {
          if (y === 0 || x % 4 === 0) S.drawWall(ctx, T, x, y, pal, y === 0 && x % 4 !== 0, x === 5 && y === 1);
          else S.drawFloor(ctx, T, x, y, pal);
        });
      }
    }
    tile(ctx, T, 2, 1, () => S.drawBoulder(ctx, T, false));
    tile(ctx, T, 3, 1, () => S.drawSpikes(ctx, T, 'up'));
    tile(ctx, T, 6, 1, () => S.drawSnake(ctx, T, 'L', 0));
    tile(ctx, T, 7, 1, () => S.drawGem(ctx, T, true, 1));
  } else if (art === 'hand') {
    ctx.fillStyle = '#120a0e';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a1520';
    const cx = W / 2;
    ctx.beginPath();
    ctx.ellipse(cx, H * 1.05, H * 0.55, H * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05020a';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - H * 0.32 + i * H * 0.17, H * 0.2 + (i === 0 || i === 3 ? H * 0.1 : 0), H * 0.12, H * 0.5);
    ctx.fillRect(cx - H * 0.36, H * 0.55, H * 0.72, H * 0.45);
    ctx.fillStyle = '#ff3d55';
    ctx.beginPath();
    ctx.arc(cx, H * 0.72, H * 0.06, 0, Math.PI * 2);
    ctx.fill();
  } else if (art === 'kai') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffcf8a');
    g.addColorStop(1, '#3d5a2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a22';
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * W;
      ctx.beginPath();
      ctx.moveTo(x - H * 0.3, H);
      ctx.lineTo(x, H * (0.35 + S.hash(i, 3) * 0.3));
      ctx.lineTo(x + H * 0.3, H);
      ctx.fill();
    }
    const s = H * 0.95;
    ctx.save();
    ctx.translate(W * 0.62 - s / 2, H * 0.02);
    S.drawHero(ctx, s, 'L', 0);
    ctx.restore();
    ctx.fillStyle = COLORS.gem;
    ctx.save();
    ctx.translate(W * 0.2, H * 0.2);
    S.drawGem(ctx, T * 0.8, false, 0);
    ctx.restore();
  }
}

// Small icon of the current tool for the deck's tool button.
export function drawToolIcon(canvas, tool) {
  const ctx = fitCanvas(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.min(canvas.width, canvas.height);
  if (tool === 'hammer') S.drawHammer(ctx, s);
  else if (tool === 'grapple') S.drawGrapple(ctx, s);
}
