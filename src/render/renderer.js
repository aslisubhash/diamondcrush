// Canvas renderer (GDD 9). The simulation ticks on a grid; drawing runs
// every animation frame and slides entities between their previous and
// current cells, so the game plays like a grid game but looks fluid.
import * as S from './sprites.js';
import * as S2 from './sprites2.js';
import { PALETTES, COLORS } from './palette.js';
import { KEY_SHAPES } from '../engine/constants.js';
import { gateOpen, exitOpen, spikePhase, predictFalls, wellWet, lampDir, convDir } from '../engine/sim.js';

// Solid tiles that should show a wall front face above open floor.
const SOLIDISH = new Set(['wall', 'false', 'cracked', 'void', 'door', 'lever', 'exit', 'brazier', 'jet', 'lamp', 'sensor', 'vent']);
// Tiles redrawn every frame on top of the cached floor.
const DYNAMIC = new Set(['spikes', 'plate', 'gate', 'door', 'lever', 'idol', 'exit', 'sexit', 'water', 'lair',
  'conv', 'wind', 'blade', 'brazier', 'jet', 'bridge', 'lamp', 'sensor', 'vent', 'kolam', 'switch', 'well', 'collapse', 'den']);

const SLIDE_MS = 150;
const RETRO_TILE = 24;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.retro = false;
    this.reducedMotion = false;
    this.keenEye = false;
    this.state = null;
    this.prev = new Map();
    this.tickAt = 0;
    this.slideMs = SLIDE_MS;
    this.particles = [];
    this.floaters = [];
    this.shake = { amp: 0, until: 0 };
    this.flash = { color: null, until: 0 };
    this.cam = { x: 0, y: 0, init: false };
    this.floorCache = null;
    this.floorDirty = true;
    this.lantern = 0;
    this.compass = 0;
    this.preview = null;
    this.lightsOutAt = 0;
    this.heroHurtUntil = 0;
    this.bossHurtUntil = 0;
    this.lowRes = document.createElement('canvas');
    this.dpr = 1;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.floorDirty = true;
  }

  setState(state, level, now) {
    this.state = state;
    this.level = level;
    this.pal = PALETTES[level.world] || PALETTES.angkor;
    this.prev.clear();
    this.particles = [];
    this.floaters = [];
    this.floorDirty = true;
    this.cam.init = false;
    this.tickAt = now;
    this.lightsOutAt = level.dark ? now + 3500 : 0;
  }

  // Remember where everything was before a tick, for the slide animation.
  capture() {
    const s = this.state;
    const m = new Map();
    m.set('hero', { x: s.hero.x, y: s.hero.y });
    s.enemies.forEach((e) => m.set(`e${e.id}`, { x: e.x, y: e.y }));
    s.obj.forEach((o, i) => { if (o) m.set(`o${o.id}`, { x: i % s.w, y: Math.floor(i / s.w) }); });
    if (s.boss) m.set('boss', { x: s.boss.x, y: s.boss.y });
    if (s.partner) m.set('partner', { x: s.partner.x, y: s.partner.y });
    this.prev = m;
  }

  afterTick(events, now, interval) {
    this.tickAt = now;
    this.slideMs = Math.min(SLIDE_MS, Math.max(60, interval || SLIDE_MS));
    for (const e of events) this.effect(e, now);
    if (events.some((e) => ['dig', 'smash', 'fill', 'door', 'secret', 'crumble', 'refill'].includes(e.type))) this.floorDirty = true;
    if (this.preview) this.preview = predictFalls(this.state);
  }

  snapTo(now) {
    this.prev.clear();
    this.tickAt = now - 1000;
    this.floorDirty = true;
    if (this.preview) this.preview = predictFalls(this.state);
  }

  // ---------- effects ----------

  burst(x, y, color, n, speed = 3, size = 0.08, life = 500) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random()) * speed;
      this.particles.push({
        x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
        life, max: life, color, size: size * (0.6 + Math.random() * 0.8), g: 6,
      });
    }
  }

  float(x, y, text, color) {
    this.floaters.push({ x: x + 0.5, y: y + 0.2, text, color, t: 0 });
  }

  doShake(amp, now) {
    if (this.reducedMotion) return;
    this.shake = { amp, until: now + 150, start: now };
  }

  effect(e, now) {
    const pal = this.pal;
    switch (e.type) {
      case 'dig': this.burst(e.x, e.y, pal.earthSpeck, 8, 2, 0.07, 350); break;
      case 'land':
        if (e.heavy) {
          this.burst(e.x, e.y + 0.4, 'rgba(210,190,150,0.8)', 7, 1.5, 0.1, 400);
          this.doShake(2.5, now);
        }
        break;
      case 'crush':
        this.doShake(6, now);
        this.flash = { color: 'rgba(255,40,40,0.25)', until: now + 180 };
        break;
      case 'hurt': this.heroHurtUntil = now + 500; break;
      case 'gem':
        this.burst(e.x, e.y, COLORS.gemLight, 10, 3, 0.06, 450);
        this.float(e.x, e.y, '+1', COLORS.gemLight);
        break;
      case 'red':
        this.burst(e.x, e.y, COLORS.red, 24, 4, 0.09, 900);
        this.burst(e.x, e.y, '#fff', 10, 2, 0.05, 700);
        this.float(e.x, e.y, 'Red gem!', COLORS.redLight);
        break;
      case 'key':
      case 'toolGet':
        this.burst(e.x, e.y, '#ffe9a8', 14, 3, 0.07, 600);
        break;
      case 'kill':
        this.burst(e.x, e.y, '#d8d0bf', 12, 3, 0.1, 500);
        this.burst(e.x, e.y, '#ffd36b', 6, 2.5, 0.06, 700);
        this.float(e.x, e.y, '+5', '#ffd36b');
        this.doShake(4, now);
        break;
      case 'smash':
        this.burst(e.x, e.y, pal.wallTop, 14, 3.5, 0.1, 500);
        this.doShake(3, now);
        break;
      case 'fill': this.burst(e.x, e.y, 'rgba(200,180,140,0.9)', 10, 2, 0.1, 500); break;
      case 'shatter': this.burst(e.x, e.y, COLORS.boulderLight, 14, 3, 0.1, 500); break;
      case 'bossHit':
        this.bossHurtUntil = now + 400;
        this.burst(e.x, e.y, COLORS.nagaJewel, 20, 4, 0.1, 700);
        this.doShake(7, now);
        break;
      case 'bossDown':
        this.burst(e.x, e.y, COLORS.nagaJewel, 40, 5, 0.12, 1200);
        this.burst(e.x, e.y, '#fff', 30, 4, 0.08, 1000);
        this.doShake(8, now);
        break;
      case 'secret': this.burst(e.x, e.y, '#fff3c4', 16, 2, 0.06, 800); break;
      case 'checkpoint': if (!e.silent) this.burst(e.x, e.y, COLORS.idolGlow, 18, 2.5, 0.07, 800); break;
      case 'exitOpen': {
        const s = this.state;
        const i = s.floor.indexOf('exit');
        if (i >= 0) this.burst(i % s.w, Math.floor(i / s.w), COLORS.exitGlow, 20, 3, 0.08, 900);
        break;
      }
      case 'steal': this.float(e.x, e.y, '-1', '#ff9a9a'); break;
      case 'gemBack': this.float(e.x, e.y, '+1', COLORS.gemLight); break;
      case 'heal': this.float(e.x, e.y, '+♥', '#ff8aa0'); break;
      case 'strike': case 'cannon': case 'breath': this.doShake(3, now); break;
      case 'ignite': this.burst(e.x, e.y, COLORS.flame, 16, 3, 0.07, 600); break;
      case 'burn': this.burst(e.x, e.y, COLORS.flame, 18, 3, 0.09, 700); this.burst(e.x, e.y, '#3b2716', 10, 2, 0.08, 600); break;
      case 'freeze': this.burst(e.x, e.y, '#e6f7ff', 12, 2, 0.06, 600); break;
      case 'melt': case 'splash': this.burst(e.x, e.y, '#6fb0dd', 10, 2, 0.06, 500); break;
      case 'poof': case 'avalanche': this.burst(e.x, e.y, '#ffffff', 10, 2.5, 0.08, 500); break;
      case 'kolamDone': case 'latch': case 'sensorOn': this.burst(e.x, e.y, '#ffd36b', 16, 3, 0.07, 700); break;
      case 'collapse': this.burst(e.x, e.y, pal.grout, 12, 2.5, 0.1, 500); this.doShake(2, now); break;
      case 'jam': this.burst(e.x, e.y, '#b8862e', 18, 3.5, 0.09, 700); this.doShake(5, now); break;
      case 'bossBump': this.doShake(6, now); this.burst(e.x, e.y, '#ffd36b', 10, 3, 0.07, 600); break;
      case 'fallPit': this.burst(e.x, e.y, '#ffffff', 10, 2, 0.08, 500); break;
      case 'disc': this.disc = { path: this.state.disc || [], until: now + 350 }; break;
      case 'bell': this.flash = { color: 'rgba(160,220,255,0.18)', until: now + 250 }; break;
      case 'swap': this.burst(e.x, e.y, '#ffffff', 10, 2, 0.06, 500); break;
      default:
    }
  }

  // ---------- floor cache ----------

  buildFloor(T) {
    const s = this.state;
    const pal = this.pal;
    const c = this.floorCache || document.createElement('canvas');
    c.width = s.w * T;
    c.height = s.h * T;
    const g = c.getContext('2d');
    g.fillStyle = pal.void;
    g.fillRect(0, 0, c.width, c.height);
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) return true;
      return SOLIDISH.has(s.floor[y * s.w + x]);
    };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const f = s.floor[y * s.w + x];
        g.save();
        g.translate(x * T, y * T);
        if (f === 'void') { g.restore(); continue; }
        if (f === 'wall' || f === 'false' || f === 'cracked') {
          S.drawWall(g, T, x, y, pal, !solid(x, y + 1), f === 'cracked');
        } else if (f === 'earth') {
          S.drawEarth(g, T, x, y, pal);
        } else if (f === 'filled') {
          S.drawFilled(g, T, x, y, pal);
        } else if (f === 'pit') {
          S.drawPit(g, T, pal);
        } else if (f === 'ice') {
          S2.drawIce(g, T, x, y);
        } else if (f === 'grass') {
          S2.drawGrass(g, T, x, y);
        } else {
          S.drawFloor(g, T, x, y, pal);
        }
        g.restore();
      }
    }
    this.floorCache = c;
    this.floorT = T;
    this.floorDirty = false;
  }

  // ---------- frame ----------

  frame(now) {
    const s = this.state;
    if (!s) return;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    let T = Math.floor(Math.min(cw / 11, ch / 8.5));
    // Retro: whole-number pixel scaling when it costs little view, else the
    // nearest fractional scale (still drawn with nearest-neighbour pixels).
    if (this.retro) {
      const whole = Math.floor(T / RETRO_TILE) * RETRO_TILE;
      if (whole >= T * 0.85) T = whole;
      T = Math.max(RETRO_TILE, T);
    }
    const viewW = cw / T;
    const viewH = ch / T;

    this.updateCamera(now, viewW, viewH);
    let ox = 0;
    let oy = 0;
    if (this.shake.amp && now < this.shake.until) {
      const k = (this.shake.until - now) / 150;
      ox = (Math.random() - 0.5) * 2 * this.shake.amp * k * this.dpr;
      oy = (Math.random() - 0.5) * 2 * this.shake.amp * k * this.dpr;
    }

    ctx.fillStyle = this.pal.bg;
    ctx.fillRect(0, 0, cw, ch);

    if (this.retro) {
      const RT = RETRO_TILE;
      const scale = T / RT;
      const lw = Math.ceil(cw / scale);
      const lh = Math.ceil(ch / scale);
      if (this.lowRes.width !== lw || this.lowRes.height !== lh) {
        this.lowRes.width = lw;
        this.lowRes.height = lh;
      }
      const lctx = this.lowRes.getContext('2d');
      lctx.imageSmoothingEnabled = false;
      lctx.fillStyle = this.pal.bg;
      lctx.fillRect(0, 0, lw, lh);
      this.drawWorld(lctx, RT, now, Math.round(ox / scale), Math.round(oy / scale));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.lowRes, 0, 0, lw * scale, lh * scale);
      // Soft LCD scanlines.
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      const step = Math.max(2, Math.round(scale));
      for (let y = 0; y < ch; y += step) ctx.fillRect(0, y, cw, Math.max(1, step / 3));
    } else {
      ctx.imageSmoothingEnabled = true;
      this.drawWorld(ctx, T, now, ox, oy);
    }

    if (this.flash.color && now < this.flash.until) {
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, cw, ch);
    }
  }

  updateCamera(now, viewW, viewH) {
    const s = this.state;
    const hp = this.lerpPos('hero', s.hero.x, s.hero.y, now);
    const [dx, dy] = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[s.hero.dir];
    let tx = hp.x + 0.5 + dx * 0.6 - viewW / 2;
    let ty = hp.y + 0.5 + dy * 0.6 - viewH / 2;
    tx = s.w <= viewW ? (s.w - viewW) / 2 : Math.max(0, Math.min(s.w - viewW, tx));
    ty = s.h <= viewH ? (s.h - viewH) / 2 : Math.max(0, Math.min(s.h - viewH, ty));
    if (!this.cam.init) {
      this.cam = { x: tx, y: ty, init: true, t: now };
    } else {
      const dt = Math.min(64, now - (this.cam.t || now));
      const k = 1 - Math.exp(-dt / 110);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.t = now;
    }
  }

  lerpPos(key, x, y, now) {
    const p = this.prev.get(key);
    if (!p) return { x, y, t: 1 };
    const t = Math.min(1, (now - this.tickAt) / this.slideMs);
    const e = t * (2 - t);
    return { x: p.x + (x - p.x) * e, y: p.y + (y - p.y) * e, t };
  }

  drawWorld(ctx, T, now, ox, oy) {
    const s = this.state;
    const pal = this.pal;
    const tsec = now / 1000;
    if (this.floorDirty || this.floorT !== T) this.buildFloor(T);
    const camX = Math.round(this.cam.x * T - ox);
    const camY = Math.round(this.cam.y * T - oy);
    ctx.save();
    ctx.translate(-camX, -camY);
    ctx.drawImage(this.floorCache, 0, 0);

    const x0 = Math.max(0, Math.floor(camX / T) - 1);
    const y0 = Math.max(0, Math.floor(camY / T) - 1);
    const x1 = Math.min(s.w, x0 + Math.ceil(ctx.canvas.width / T) + 3);
    const y1 = Math.min(s.h, y0 + Math.ceil(ctx.canvas.height / T) + 3);

    // Dynamic floor tiles.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * s.w + x;
        const f = s.floor[i];
        const m = s.meta[i];
        const px = x * T;
        const py = y * T;
        if (DYNAMIC.has(f)) {
          ctx.save();
          ctx.translate(px, py);
          if (f === 'spikes') S.drawSpikes(ctx, T, spikePhase(s, i));
          else if (f === 'plate' && m && m.gear) S2.drawGear(ctx, T, tsec);
          else if (f === 'plate') S.drawPlate(ctx, T, m && m.down);
          else if (f === 'conv') S2.drawConveyor(ctx, T, convDir(s, i), tsec);
          else if (f === 'wind') S2.drawWind(ctx, T, m.dir, tsec, pal);
          else if (f === 'blade') S2.drawBlade(ctx, T, spikePhase(s, i), tsec);
          else if (f === 'brazier') S2.drawBrazier(ctx, T, m.lit, tsec, pal);
          else if (f === 'jet') S2.drawJet(ctx, T, m.dir, spikePhase(s, i), pal);
          else if (f === 'bridge') S2.drawBridge(ctx, T, gateOpen(s, i), pal, tsec);
          else if (f === 'lamp') S2.drawLamp(ctx, T, lampDir(s, i), pal, m.laser);
          else if (f === 'sensor') S2.drawSensor(ctx, T, m.hit, pal, tsec);
          else if (f === 'vent') S2.drawVent(ctx, T, spikePhase(s, i), pal);
          else if (f === 'kolam') S2.drawKolam(ctx, T, m.traced || s.kolamDone[m.ch]);
          else if (f === 'switch') S2.drawSwitch(ctx, T, m.on);
          else if (f === 'well') S2.drawWell(ctx, T, wellWet(s, i), pal, tsec);
          else if (f === 'collapse') {
            if (m.down) S.drawPit(ctx, T, pal);
            else S2.drawCollapse(ctx, T, m.warn, tsec);
          } else if (f === 'den') S2.drawDen(ctx, T, tsec);
          else if (f === 'gate') S.drawGate(ctx, T, gateOpen(s, i));
          else if (f === 'door') S.drawDoor(ctx, T, m.color, KEY_SHAPES[m.color], pal);
          else if (f === 'lever') S.drawLever(ctx, T, m.on, pal);
          else if (f === 'idol') S.drawIdol(ctx, T, m.active, tsec);
          else if (f === 'exit') S.drawExit(ctx, T, exitOpen(s), tsec, pal);
          else if (f === 'sexit') S.drawStairs(ctx, T, tsec);
          else if (f === 'water') S.drawWater(ctx, T, pal, tsec * 0.3);
          else if (f === 'lair') S.drawLair(ctx, T, pal, x, tsec);
          ctx.restore();
        }
        if (this.keenEye && f === 'false' && Math.abs(x - s.hero.x) + Math.abs(y - s.hero.y) <= 1) {
          ctx.fillStyle = `rgba(255,243,196,${0.18 + Math.sin(tsec * 5) * 0.12})`;
          ctx.fillRect(px, py, T, T);
        }
      }
    }

    // Fire, venom, light beams and the chakra disc's flight.
    for (const i of s.fire || []) {
      ctx.save();
      ctx.translate((i % s.w) * T, Math.floor(i / s.w) * T);
      S2.drawFire(ctx, T, tsec, i);
      ctx.restore();
    }
    for (const i of s.venom || []) {
      ctx.save();
      ctx.translate((i % s.w) * T, Math.floor(i / s.w) * T);
      S2.drawVenom(ctx, T, tsec);
      ctx.restore();
    }
    for (const beam of s.beams || []) {
      beam.cells.forEach((i, k) => {
        ctx.save();
        ctx.translate((i % s.w) * T, Math.floor(i / s.w) * T);
        S2.drawBeamCell(ctx, T, beam.laser, tsec, beam.axes ? beam.axes[k] : '+');
        ctx.restore();
      });
    }
    if (this.disc && now < this.disc.until) {
      const a = (this.disc.until - now) / 350;
      ctx.fillStyle = `rgba(224,180,60,${a})`;
      for (const i of this.disc.path) {
        ctx.beginPath();
        ctx.arc((i % s.w + 0.5) * T, (Math.floor(i / s.w) + 0.5) * T, T * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Boss telegraphs.
    const b = s.boss;
    if (b && b.alive) {
      const a = 0.22 + Math.sin(tsec * 18) * 0.13;
      if (b.wind) {
        ctx.fillStyle = `rgba(255,70,40,${a})`;
        const [dx, dy] = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[b.wind.dir];
        for (let k = 1; k < 12; k++) {
          const xx = b.x + dx * k;
          const yy = b.y + dy * k;
          if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h || SOLIDISH.has(s.floor[yy * s.w + xx])) break;
          ctx.fillRect(xx * T, yy * T, T, T);
        }
      }
      if (b.breath) {
        ctx.fillStyle = `rgba(150,220,255,${a + 0.1})`;
        ctx.fillRect(0, b.breath.y * T, b.x * T, T);
      }
      if (b.cannon) {
        ctx.fillStyle = `rgba(255,120,40,${a})`;
        if (b.cannon.row !== null) ctx.fillRect(0, b.cannon.row * T, s.w * T, T);
        if (b.cannon.col !== null) ctx.fillRect(b.cannon.col * T, 0, T, s.h * T);
      }
      if (b.strike) {
        const a = 0.25 + Math.sin(tsec * 18) * 0.15;
        ctx.fillStyle = `rgba(255,90,40,${a})`;
        ctx.fillRect(b.strike.x * T, (b.y - 3) * T, T, 3 * T);
      }
      if (b.sweep) {
        const a = 0.2 + Math.sin(tsec * 18) * 0.12;
        ctx.fillStyle = `rgba(255,200,40,${a})`;
        ctx.fillRect(T, b.sweep.y * T, (s.w - 2) * T, T);
      }
    }

    // Rock-fall preview ghosts.
    if (this.preview) {
      ctx.globalAlpha = 0.45;
      for (const p of this.preview) {
        if (p.to < 0) continue;
        const gx = (p.to % s.w) * T;
        const gy = Math.floor(p.to / s.w) * T;
        ctx.save();
        ctx.translate(gx, gy);
        if (p.t === 'gem') S.drawGem(ctx, T, false, 0);
        else S.drawBoulder(ctx, T, p.t === 'stone');
        ctx.restore();
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([T / 8, T / 10]);
        ctx.lineWidth = Math.max(1, T / 24);
        ctx.strokeRect(gx + 2, gy + 2, T - 4, T - 4);
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    // Objects and characters, sorted by row so lower things overlap higher ones.
    const draws = [];
    s.obj.forEach((o, i) => {
      if (!o) return;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      if (x < x0 - 1 || x > x1 || y < y0 - 2 || y > y1) return;
      const p = this.lerpPos(`o${o.id}`, x, y, now);
      draws.push({ y: p.y, fn: () => this.drawObject(ctx, T, o, p, tsec) });
    });
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const p = this.lerpPos(`e${e.id}`, e.x, e.y, now);
      draws.push({ y: p.y, fn: () => this.drawEnemy(ctx, T, e, p, tsec) });
    }
    if (b && b.alive) {
      if (b.t === 'naga') {
        for (const seg of b.trail.slice(0, 3)) {
          draws.push({ y: seg.y - 0.01, fn: () => { ctx.save(); ctx.translate(seg.x * T, seg.y * T); S.drawNagaBody(ctx, T); ctx.restore(); } });
        }
      }
      const p = this.lerpPos('boss', b.x, b.y, now);
      const hurt = now < this.bossHurtUntil;
      draws.push({
        y: p.y + 0.5,
        fn: () => {
          ctx.save();
          if (b.t === 'naga') {
            ctx.translate(p.x * T, (p.y - 0.25) * T);
            S.drawNaga(ctx, T * 1.1, tsec, hurt, !!b.strike);
          } else {
            const big = T * 1.2;
            ctx.translate(p.x * T - (big - T) / 2, p.y * T - (big - T));
            if (b.t === 'baron') S2.drawBaron(ctx, big, b.dir, tsec, hurt, b.stun > 0, !!b.wind || !!b.charge);
            else if (b.t === 'frost') S2.drawFrostfang(ctx, big, tsec, hurt, !!b.breath);
            else if (b.t === 'rakta') S2.drawRakta(ctx, big, tsec, hurt, !!b.cannon);
            else if (b.t === 'hand') S2.drawHandLeader(ctx, big, b.dir, tsec, hurt, Math.floor(tsec * 4) % 2);
          }
          ctx.restore();
        },
      });
    }
    if (s.partner) {
      const pp = this.lerpPos('partner', s.partner.x, s.partner.y, now);
      draws.push({
        y: pp.y,
        fn: () => {
          ctx.save();
          ctx.translate(pp.x * T, pp.y * T);
          ctx.globalAlpha = 0.85;
          S2.drawExplorer(ctx, T, s.partner.who, s.partner.dir, 0, {});
          ctx.restore();
        },
      });
    }
    const hp = this.lerpPos('hero', s.hero.x, s.hero.y, now);
    draws.push({ y: hp.y + 0.001, fn: () => this.drawHeroAt(ctx, T, hp, now) });
    draws.sort((a, c) => a.y - c.y);
    for (const d of draws) d.fn();

    this.drawParticles(ctx, T, now);

    // Clue overlays.
    if (now < this.lantern) this.drawLantern(ctx, T, now);
    if (now < this.compass) this.drawCompass(ctx, T, hp, now);

    // Darkness for dark rooms (torch radius).
    if (s.dark && !this.level.dark) {
      if (!this.darkSince) this.darkSince = now;
      this.drawDark(ctx, T, hp, Math.min(1, (now - this.darkSince) / 800), camX, camY);
    } else if (this.level.dark && s.dark && now > this.lightsOutAt - 1200) {
      const fade = Math.min(1, (now - (this.lightsOutAt - 1200)) / 1200);
      this.drawDark(ctx, T, hp, fade, camX, camY);
    } else {
      this.darkSince = 0;
    }
    ctx.restore();
  }

  drawObject(ctx, T, o, p, tsec) {
    let jx = 0;
    if (o.st === 'wobble' && !this.reducedMotion) jx = Math.sin(tsec * 70) * T * 0.05;
    ctx.save();
    ctx.translate(p.x * T + jx, p.y * T);
    if (o.st === 'wobble') {
      ctx.fillStyle = 'rgba(255,120,60,0.35)';
      ctx.fillRect(T * 0.3, T * 0.02, T * 0.4, T * 0.05);
    }
    switch (o.t) {
      case 'boulder': S.drawBoulder(ctx, T, false); break;
      case 'stone': {
        // Rolling stones spin as they move sideways.
        ctx.translate(T / 2, T / 2);
        ctx.rotate(p.x * Math.PI);
        ctx.translate(-T / 2, -T / 2);
        S.drawBoulder(ctx, T, true);
        break;
      }
      case 'crate':
        S.drawCrate(ctx, T);
        if (o.burn) {
          ctx.fillStyle = `rgba(40,20,5,${o.burn * 0.2})`;
          ctx.fillRect(T * 0.15, T * 0.17, T * 0.7, T * 0.68);
        }
        break;
      case 'mirror': S2.drawMirror(ctx, T, o.o); break;
      case 'heart': S2.drawHeartStone(ctx, T, tsec); break;
      case 'snow': S2.drawSnow(ctx, T); break;
      case 'gem': S.drawGem(ctx, T, false, tsec + p.x * 0.7 + p.y * 1.3); break;
      case 'red': {
        const g = ctx.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T * 0.6);
        g.addColorStop(0, 'rgba(255,60,85,0.35)');
        g.addColorStop(1, 'rgba(255,60,85,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-T * 0.1, -T * 0.1, T * 1.2, T * 1.2);
        S.drawGem(ctx, T, true, tsec);
        break;
      }
      case 'key': S.drawKey(ctx, T, o.color, KEY_SHAPES[o.color]); break;
      case 'tool': {
        const bob = Math.sin(tsec * 3) * T * 0.05;
        ctx.translate(0, bob);
        ctx.fillStyle = 'rgba(255,230,150,0.3)';
        ctx.beginPath();
        ctx.arc(T / 2, T / 2, T * 0.45, 0, Math.PI * 2);
        ctx.fill();
        if (o.tool === 'grapple') S.drawGrapple(ctx, T);
        else if (o.tool === 'hammer') S.drawHammer(ctx, T);
        else S2.drawToolSprite(ctx, T, o.tool);
        break;
      }
      case 'fruit': S.drawFruit(ctx, T); break;
      default:
    }
    ctx.restore();
  }

  drawEnemy(ctx, T, e, p, tsec) {
    const frame = Math.floor(tsec * 4 + e.id) % 2;
    ctx.save();
    ctx.translate(p.x * T, p.y * T);
    if (e.t === 'snake') S.drawSnake(ctx, T, e.dir, frame);
    else if (e.t === 'scarab') S.drawScarab(ctx, T, frame);
    else if (e.t === 'monkey') S.drawMonkey(ctx, T, frame, e.carrying, e.calm);
    else if (e.t === 'bat') S2.drawBat(ctx, T, frame);
    else if (e.t === 'knight') S2.drawKnight(ctx, T, e.dir, frame, !!e.charge);
    else if (e.t === 'rat') S2.drawRat(ctx, T, e.dir, frame);
    else if (e.t === 'yeti') S2.drawYeti(ctx, T, frame, !!e.slide);
    else if (e.t === 'spirit') S2.drawSpirit(ctx, T, tsec);
    else if (e.t === 'cobra') S2.drawCobra(ctx, T, e.dir, e.warn);
    else if (e.t === 'langur') S2.drawLangur(ctx, T, frame);
    else if (e.t === 'thug') S2.drawThug(ctx, T, e.dir, frame);
    else if (e.t === 'tiger') S2.drawTiger(ctx, T, e.dir, frame, e.hunt);
    else if (e.t === 'echo') S2.drawEcho(ctx, T, e.dir, frame, this.state.hero.who);
    const st = this.state;
    if (st.freezeUntil && st.tick <= st.freezeUntil && e.t !== 'echo') {
      ctx.fillStyle = 'rgba(150,210,255,0.45)';
      ctx.beginPath();
      ctx.arc(T / 2, T / 2, T * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHeroAt(ctx, T, p, now) {
    const s = this.state;
    const moving = p.t < 1;
    const frame = moving ? Math.floor(p.t * 2) % 2 : 0;
    ctx.save();
    ctx.translate(p.x * T, p.y * T);
    // Squash and stretch: stretch mid-step, squash on landing.
    if (!this.reducedMotion && moving) {
      const k = Math.sin(p.t * Math.PI) * 0.08;
      ctx.translate(T / 2, T);
      ctx.scale(1 - k, 1 + k);
      ctx.translate(-T / 2, -T);
    }
    if (s.hero.windup) {
      const [dx, dy] = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[s.hero.windup.dir];
      ctx.translate(dx * T * 0.12, dy * T * 0.12);
    }
    const blink = s.hero.invul > 0 && Math.floor(now / 80) % 2 === 0;
    if (!blink) S2.drawExplorer(ctx, T, s.hero.who, s.hero.dir, frame, { hurt: now < this.heroHurtUntil });
    ctx.restore();
  }

  drawParticles(ctx, T, now) {
    const dt = Math.min(0.05, (now - (this.lastP || now)) / 1000);
    this.lastP = now;
    const keep = [];
    for (const p of this.particles) {
      p.life -= dt * 1000;
      if (p.life <= 0) continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * T - (p.size * T) / 2, p.y * T - (p.size * T) / 2, p.size * T, p.size * T);
      keep.push(p);
    }
    this.particles = keep;
    ctx.globalAlpha = 1;
    const fk = [];
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(T * 0.32)}px "Press Start 2P", monospace`;
    for (const f of this.floaters) {
      f.t += dt;
      if (f.t > 0.9) continue;
      ctx.globalAlpha = 1 - f.t / 0.9;
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, f.x * T + 1, (f.y - f.t * 0.8) * T + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * T, (f.y - f.t * 0.8) * T);
      fk.push(f);
    }
    this.floaters = fk;
    ctx.globalAlpha = 1;
  }

  // Lantern pulse (5.2): glow on every gem and secret within 4 tiles.
  drawLantern(ctx, T, now) {
    const s = this.state;
    const a = Math.min(1, (this.lantern - now) / 600);
    const r = (now / 400) % 1;
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (Math.abs(x - s.hero.x) + Math.abs(y - s.hero.y) > 4) continue;
        const i = y * s.w + x;
        const o = s.obj[i];
        const f = s.floor[i];
        let col = null;
        if (o && o.t === 'gem') col = '120,200,255';
        if (o && o.t === 'red') col = '255,80,100';
        if (f === 'false' || f === 'cracked' || f === 'sexit') col = '255,230,140';
        if (!col) continue;
        ctx.strokeStyle = `rgba(${col},${a * (1 - r)})`;
        ctx.lineWidth = Math.max(1, T / 14);
        ctx.beginPath();
        ctx.arc((x + 0.5) * T, (y + 0.5) * T, T * (0.3 + r * 0.4), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Whispering compass (5.2): arrow towards the nearest gem (or the red gem).
  drawCompass(ctx, T, hp, now) {
    const s = this.state;
    let best = null;
    let bd = Infinity;
    s.obj.forEach((o, i) => {
      if (!o || (o.t !== 'gem' && o.t !== 'red')) return;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      const d = Math.abs(x - s.hero.x) + Math.abs(y - s.hero.y) - (o.t === 'red' ? 0.5 : 0);
      if (d < bd) { bd = d; best = { x, y, red: o.t === 'red' }; }
    });
    if (!best) return;
    const cx = (hp.x + 0.5) * T;
    const cy = (hp.y + 0.5) * T;
    const ang = Math.atan2(best.y - s.hero.y, best.x - s.hero.x);
    const a = Math.min(1, (this.compass - now) / 500);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = a;
    ctx.fillStyle = best.red ? COLORS.red : COLORS.gem;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, T / 20);
    ctx.beginPath();
    ctx.moveTo(T * 0.95, 0);
    ctx.lineTo(T * 0.6, -T * 0.18);
    ctx.lineTo(T * 0.6, T * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawDark(ctx, T, hp, fade, camX, camY) {
    if (!this.darkCanvas) this.darkCanvas = document.createElement('canvas');
    const d = this.darkCanvas;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    if (d.width !== w || d.height !== h) { d.width = w; d.height = h; }
    const g = d.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = `rgba(4,6,14,${0.96 * fade})`;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const flicker = 1 + Math.sin(performance.now() / 90) * 0.03;
    const cx = (hp.x + 0.5) * T - camX;
    const cy = (hp.y + 0.5) * T - camY;
    const rad = T * 2.4 * flicker;
    const grad = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    ctx.drawImage(d, camX, camY);
    // Warm torch tint.
    ctx.fillStyle = 'rgba(255,170,80,0.06)';
    ctx.beginPath();
    ctx.arc(cx + camX, cy + camY, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}
