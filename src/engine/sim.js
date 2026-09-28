// Deterministic grid simulation. Same state + same actions = same result,
// which powers rewind, replays, the Spirit guide and solution tests.
// Tick order follows GDD 3.4.

import {
  DIRS, OPPOSITE, CLOCKWISE, FALLERS, ROUND, PUSHABLE, HEAVY, COLLECTIBLE,
  DIFFICULTIES, ENEMY_NAMES, OBJECT_NAMES,
} from './constants.js';
import { parseLevel } from './level.js';
import {
  idx, inb, emit, enemyAt, heroAt, partnerAt, bodyAt, bossAt, exitOpen, gateOpen, wellWet, effFloor,
  heroCanEnter, objectCanEnter, hurt, killEnemy, returnStolen,
} from './shared.js';
import { enemiesAct, crushable } from './enemies.js';
import { makeBoss, bossAct, bossDamage, bossRefill, lairImpact, gearJams } from './bosses.js';

export { enemyAt, exitOpen, gateOpen, wellWet, hurt, effFloor };

export function createState(level, opts = {}) {
  const diff = DIFFICULTIES[opts.difficulty || 'classic'];
  const p = parseLevel(level);
  const maxHearts = opts.maxHearts ?? diff.hearts;
  const lead = opts.lead || level.lead || 'kai';
  const s = {
    levelId: level.id,
    w: p.w,
    h: p.h,
    floor: p.floor,
    meta: p.meta,
    obj: p.obj,
    enemies: p.enemies,
    nextId: p.nextId,
    hero: {
      x: p.hero.x, y: p.hero.y, dir: 'D', who: lead,
      hearts: maxHearts, maxHearts, invul: 0,
      keys: {}, windup: null, slide: null, bell: 3,
      tools: [...new Set([...(opts.tools || []), ...(level.tools || [])])],
      tool: 0,
      stolen: 0,
    },
    partner: p.partner ? { x: p.partner.x, y: p.partner.y, dir: 'D', who: lead === 'kai' ? 'meera' : 'kai' } : null,
    start: { x: p.hero.x, y: p.hero.y },
    gems: 0,
    gemsTotal: p.gemsTotal,
    red: 0,
    redTotal: p.redTotal,
    quota: level.quota ?? p.gemsTotal,
    tick: 0,
    moves: 0,
    hurts: 0,
    kills: 0,
    coins: 0,
    levers: {},
    chan: {},
    kolamDone: {},
    chanStart: {},
    rules: { crush: diff.crush, wobble: diff.wobble },
    status: 'play', // play | won | dead
    exitKind: null, // 'exit' | 'secret'
    lastHurt: '',
    events: [],
    newTools: [],
    heroLog: [],
    heroMoved: null,
    venom: [],
    fire: [],
    beams: [],
    disc: null,
    freezeUntil: 0,
    dark: !!level.dark,
    boss: null,
  };
  if (p.boss) {
    s.boss = makeBoss(p.boss.t, p.boss.x, p.boss.y);
    // Remember boulders and earth so the arena can refill between phases.
    s.bossSpawns = [];
    s.bossEarth = [];
    p.obj.forEach((o, i) => { if (o && o.t === 'boulder') s.bossSpawns.push(i); });
    p.floor.forEach((f, i) => { if (f === 'earth') s.bossEarth.push(i); });
  }
  for (const [i, m] of Object.entries(s.meta)) {
    const f = s.floor[i];
    if ((f === 'lever' || f === 'switch') && m.on) s.levers[m.ch] = !s.levers[m.ch];
  }
  // Start with the most recently found tool in hand.
  s.hero.tool = Math.max(0, s.hero.tools.length - 1);
  updateTriggers(s);
  return s;
}

export function cloneState(s) {
  return structuredClone(s);
}

// ---------- public tick entry ----------

// action: { type: 'move', dir } | { type: 'tool' } | { type: 'swap' } |
// null (background tick). Returns true when a world tick happened.
export function act(s, action) {
  if (s.status !== 'play') return false;
  s.events = [];
  s.heroMoved = null;
  s.disc = null;
  if (s.hero.slide) {
    // Sliding on ice: input is ignored until the hero stops.
    slideHero(s);
  } else if (action) {
    const prevWind = s.hero.windup;
    s.hero.windup = null;
    let ok = false;
    if (action.type === 'move') ok = heroMove(s, action.dir, prevWind);
    else if (action.type === 'tool') ok = useTool(s);
    else if (action.type === 'swap') ok = swapHeroes(s);
    else if (action.type === 'wait') ok = true;
    if (!ok) {
      s.hero.windup = s.hero.windup || null;
      return false;
    }
  }
  worldTick(s);
  return true;
}

function worldTick(s) {
  s.tick++;
  s.venom = [];
  s.fire = [];
  const moved = new Set();
  if (s.status === 'play') updateTriggers(s); // 3
  if (s.status === 'play') carry(s, moved); // conveyors, wind, ice slides
  if (s.status === 'play') physics(s, moved); // 4
  if (s.status === 'play') enemiesAct(s); // 5
  if (s.status === 'play') bossAct(s);
  if (s.status === 'play') hazards(s); // 6
  // 7: resolve end state
  if (s.hero.invul > 0) s.hero.invul--;
  if (s.boss && s.boss.alive && s.status === 'play') bossRefill(s, false);
  if (s.status === 'play') {
    const f = s.floor[idx(s, s.hero.x, s.hero.y)];
    if (f === 'exit' && exitOpen(s)) win(s, 'exit');
    else if (f === 'sexit') win(s, 'secret');
  }
}

function win(s, kind) {
  s.status = 'won';
  s.exitKind = kind;
  s.hero.slide = null;
  emit(s, 'win', s.hero.x, s.hero.y, { kind });
}

// ---------- 2. hero ----------

function swapHeroes(s) {
  const p = s.partner;
  if (!p) return false;
  const h = s.hero;
  [h.x, p.x] = [p.x, h.x];
  [h.y, p.y] = [p.y, h.y];
  [h.dir, p.dir] = [p.dir, h.dir];
  [h.who, p.who] = [p.who, h.who];
  h.slide = null;
  emit(s, 'swap', h.x, h.y, { who: h.who });
  return true;
}

function heroMove(s, dir, prevWind) {
  const h = s.hero;
  const [dx, dy] = DIRS[dir];
  h.dir = dir;
  const tx = h.x + dx;
  const ty = h.y + dy;
  if (!inb(s, tx, ty)) return false;
  const ti = idx(s, tx, ty);
  const f = s.floor[ti];

  if (partnerAt(s, tx, ty)) return false;
  if (bossAt(s, tx, ty)) {
    hurt(s, 1, `Struck by ${ENEMY_NAMES[s.boss.t]}`);
    return true;
  }
  const e = enemyAt(s, tx, ty);
  if (e) {
    if (e.t === 'monkey') {
      if (e.carrying) {
        e.carrying = false;
        e.calm = true;
        returnStolen(s, e);
        emit(s, 'bump', tx, ty);
        return true;
      }
      return false;
    }
    if (e.t === 'echo' || e.t === 'spirit') return false;
    hurt(s, 1, `Hurt by ${ENEMY_NAMES[e.t] || 'an enemy'}`);
    return true;
  }

  if (f === 'lever') {
    const m = s.meta[ti];
    m.on = !m.on;
    s.levers[m.ch] = !s.levers[m.ch];
    emit(s, 'lever', tx, ty, { on: m.on });
    return true;
  }
  if (f === 'door') {
    const color = s.meta[ti].color;
    if (!h.keys[color]) {
      emit(s, 'locked', tx, ty, { color });
      return false;
    }
    h.keys[color]--;
    s.floor[ti] = 'floor';
    emit(s, 'door', tx, ty, { color });
  } else if (f === 'exit' && !exitOpen(s)) {
    emit(s, 'exitShut', tx, ty);
    return false;
  } else if (f !== 'earth' && !heroCanEnter(s, ti)) {
    return false;
  }

  const o = s.obj[ti];
  if (o) {
    if (COLLECTIBLE.has(o.t)) {
      collect(s, o, tx, ty);
      s.obj[ti] = null;
    } else if (PUSHABLE.has(o.t)) {
      if (!push(s, o, tx, ty, dir, prevWind)) return s.hero.windup !== null;
    } else {
      return false;
    }
  }

  if (s.floor[ti] === 'earth') {
    s.floor[ti] = 'floor';
    emit(s, 'dig', tx, ty);
  } else if (s.floor[ti] === 'false') {
    // A false wall crumbles away once walked through, revealing the secret.
    s.floor[ti] = 'floor';
    emit(s, 'secret', tx, ty);
  }
  leaveCell(s);
  h.x = tx;
  h.y = ty;
  s.moves++;
  s.heroMoved = dir;
  s.heroLog.push(dir);
  emit(s, 'step', tx, ty, { floor: s.floor[ti] });
  enterCell(s, dir);
  return true;
}

// Pushing. Returns true when the hero may step into the object's cell.
function push(s, o, tx, ty, dir, prevWind) {
  const h = s.hero;
  const [dx, dy] = DIRS[dir];
  if (o.st === 'fall' || o.slide) return false;
  const fx = tx + dx;
  const fy = ty + dy;
  const gauntlet = h.tools.includes('gauntlet');
  const fi = inb(s, fx, fy) ? idx(s, fx, fy) : -1;
  // Frostfang takes damage from rocks rammed into it.
  if (fi >= 0 && bossAt(s, fx, fy) && s.boss.t === 'frost' && HEAVY.has(o.t)) {
    s.obj[idx(s, tx, ty)] = null;
    emit(s, 'shatter', fx, fy, { obj: o.t });
    bossDamage(s, 'rock');
    return true;
  }
  let chain = null;
  if (!objectCanEnter(s, fx, fy, o)) {
    // The power gauntlet shoves two blocks in a row.
    const o2 = fi >= 0 ? s.obj[fi] : null;
    const gx = fx + dx;
    const gy = fy + dy;
    if (gauntlet && o2 && PUSHABLE.has(o2.t) && o2.st !== 'fall' && !o2.slide && objectCanEnter(s, gx, gy, o2)) {
      chain = o2;
    } else {
      emit(s, 'blocked', tx, ty);
      return false;
    }
  }
  // Boulders are heavy: the hero leans in for one step first (3.3 rule 7).
  if ((o.t === 'boulder' || (chain && chain.t === 'boulder')) && !gauntlet &&
      !(prevWind && prevWind.dir === dir && prevWind.x === h.x && prevWind.y === h.y)) {
    h.windup = { dir, x: h.x, y: h.y };
    emit(s, 'lean', tx, ty, { dir });
    return false;
  }
  if (chain) {
    const m2 = moveObject(s, fi, idx(s, fx + dx, fy + dy));
    if (m2) startSlide(s, m2, fx + dx, fy + dy, dir);
  }
  const moved = moveObject(s, idx(s, tx, ty), fi);
  if (moved) startSlide(s, moved, fx, fy, dir);
  emit(s, 'push', fx, fy, { obj: o.t, dir });
  return true;
}

function startSlide(s, o, x, y, dir) {
  o.st = 'rest';
  if (s.floor[idx(s, x, y)] === 'ice') o.slide = dir;
}

function leaveCell(s) {
  const h = s.hero;
  const fromI = idx(s, h.x, h.y);
  if (s.floor[fromI] === 'weak') {
    s.floor[fromI] = 'pit';
    emit(s, 'crumble', h.x, h.y);
  }
}

function enterCell(s, dir) {
  const h = s.hero;
  const i = idx(s, h.x, h.y);
  const f = s.floor[i];
  const m = s.meta[i];
  if (f === 'idol' && !m.active) {
    m.active = true;
    h.bell = 3;
    emit(s, 'checkpoint', h.x, h.y);
  } else if (f === 'ice' && dir) {
    h.slide = dir;
  } else if (f === 'kolam' && !s.kolamDone[m.ch]) {
    if (m.traced) {
      for (const k of Object.keys(s.meta)) {
        const km = s.meta[k];
        if (s.floor[k] === 'kolam' && km.ch === m.ch) km.traced = false;
      }
      emit(s, 'kolamReset', h.x, h.y);
    } else {
      m.traced = true;
      const all = Object.entries(s.meta).filter(([k, km]) => s.floor[k] === 'kolam' && km.ch === m.ch);
      if (all.every(([, km]) => km.traced)) {
        s.kolamDone[m.ch] = true;
        emit(s, 'kolamDone', h.x, h.y);
      } else emit(s, 'trace', h.x, h.y);
    }
  }
}

// One tile of an ice slide. Sliding stops at anything solid.
function slideHero(s) {
  const h = s.hero;
  const dir = h.slide;
  const [dx, dy] = DIRS[dir];
  const tx = h.x + dx;
  const ty = h.y + dy;
  const stop = () => {
    h.slide = null;
    emit(s, 'slideStop', h.x, h.y);
  };
  if (!inb(s, tx, ty) || partnerAt(s, tx, ty)) return stop();
  const ti = idx(s, tx, ty);
  const e = enemyAt(s, tx, ty);
  if (e || bossAt(s, tx, ty)) {
    if (!e || crushable(e)) hurt(s, 1, `Slid into ${ENEMY_NAMES[e ? e.t : s.boss.t]}`);
    return stop();
  }
  if (!heroCanEnter(s, ti)) return stop();
  const o = s.obj[ti];
  if (o) {
    if (!COLLECTIBLE.has(o.t)) return stop();
    collect(s, o, tx, ty);
    s.obj[ti] = null;
  }
  leaveCell(s);
  h.x = tx;
  h.y = ty;
  emit(s, 'slide', tx, ty);
  if (s.floor[ti] !== 'ice') {
    h.slide = null;
    enterCell(s, null);
  } else {
    enterCell(s, dir);
  }
}

function collect(s, o, x, y) {
  if (o.t === 'gem') {
    s.gems++;
    emit(s, 'gem', x, y, { count: s.gems });
    if (s.gems === s.quota) emit(s, 'exitOpen', x, y);
  } else if (o.t === 'red') {
    s.red++;
    emit(s, 'red', x, y);
  } else if (o.t === 'key') {
    s.hero.keys[o.color] = (s.hero.keys[o.color] || 0) + 1;
    emit(s, 'key', x, y, { color: o.color });
  } else if (o.t === 'tool') {
    if (!s.hero.tools.includes(o.tool)) {
      s.hero.tools.push(o.tool);
      s.newTools.push(o.tool);
      s.hero.tool = s.hero.tools.length - 1;
    }
    emit(s, 'toolGet', x, y, { tool: o.tool });
  } else if (o.t === 'fruit') {
    s.hero.hearts = Math.min(s.hero.maxHearts, s.hero.hearts + 1);
    emit(s, 'heal', x, y);
  }
}

export function currentTool(s) {
  return s.hero.tools[s.hero.tool] || null;
}

export function cycleTool(s, step = 1) {
  const n = s.hero.tools.length;
  if (n < 2) return false;
  s.hero.tool = (s.hero.tool + step + n) % n;
  return true;
}

// Moves an object between cells and applies fill-ins (3.3 rule 10) and
// boss-lair impacts. Returns the object if it still exists.
function moveObject(s, from, to) {
  const o = s.obj[from];
  s.obj[from] = null;
  const x = to % s.w;
  const y = (to - x) / s.w;
  const f = effFloor(s, to);
  if ((f === 'pit' || f === 'water') && HEAVY.has(o.t)) {
    if (s.floor[to] === 'well') {
      // Stepwell: rocks sink to the bottom and wait for the water to drop.
      s.obj[to] = o;
      o.sunk = true;
      emit(s, 'splash', x, y);
      return o;
    }
    const was = s.floor[to];
    s.floor[to] = 'filled';
    s.meta[to] = { was };
    emit(s, 'fill', x, y, { obj: o.t, was });
    return null;
  }
  if (f === 'lair') {
    lairImpact(s, x, y, o);
    return null;
  }
  s.obj[to] = o;
  return o;
}

function useTool(s) {
  const tool = currentTool(s);
  const h = s.hero;
  const [dx, dy] = DIRS[h.dir];
  const tx = h.x + dx;
  const ty = h.y + dy;
  if (!tool) return false;
  if (tool === 'bell') {
    if (h.bell <= 0) {
      emit(s, 'clang', h.x, h.y, { empty: true });
      return false;
    }
    h.bell--;
    s.freezeUntil = s.tick + 3;
    emit(s, 'bell', h.x, h.y, { left: h.bell });
    return true;
  }
  if (tool === 'disc') return throwDisc(s);
  if (!inb(s, tx, ty)) return false;
  const ti = idx(s, tx, ty);
  const o = s.obj[ti];
  const f = s.floor[ti];
  if (tool === 'hammer') {
    if (f === 'cracked') {
      s.floor[ti] = 'floor';
      emit(s, 'smash', tx, ty);
      return true;
    }
    if (o && o.t === 'boulder' && o.st !== 'fall') {
      s.obj[ti] = null;
      emit(s, 'smash', tx, ty, { obj: 'boulder' });
      return true;
    }
  } else if (tool === 'grapple') {
    // Pull the object in front one tile towards the hero; the hero steps back.
    const bx = h.x - dx;
    const by = h.y - dy;
    if (o && PUSHABLE.has(o.t) && o.st !== 'fall' && !o.slide && inb(s, bx, by)) {
      const bi = idx(s, bx, by);
      if (heroCanEnter(s, bi) && !s.obj[bi] && !enemyAt(s, bx, by) && !bodyAt(s, bx, by) && !bossAt(s, bx, by)) {
        const fromI = idx(s, h.x, h.y);
        leaveCell(s);
        h.x = bx;
        h.y = by;
        s.obj[fromI] = o;
        s.obj[ti] = null;
        o.st = 'rest';
        s.moves++;
        emit(s, 'pull', tx, ty, { obj: o.t });
        return true;
      }
    }
  } else if (tool === 'torch') {
    if (f === 'brazier' && !s.meta[ti].lit) {
      s.meta[ti].lit = true;
      emit(s, 'ignite', tx, ty);
      return true;
    }
    if (o && o.t === 'crate') {
      s.obj[ti] = null;
      emit(s, 'burn', tx, ty);
      return true;
    }
    const e = enemyAt(s, tx, ty);
    if (e && e.t === 'bat') {
      e.dx = dx || -e.dx;
      e.dy = dy || -e.dy;
      emit(s, 'scare', tx, ty);
      return true;
    }
  } else if (tool === 'frost') {
    const m = s.meta[ti];
    if (f === 'water' && !o) {
      s.floor[ti] = 'ice';
      s.meta[ti] = { melt: s.tick + 11, frost: true };
      emit(s, 'freeze', tx, ty);
      return true;
    }
    if (f === 'ice' && m && m.frost) {
      m.melt = s.tick + 11;
      emit(s, 'freeze', tx, ty);
      return true;
    }
  } else if (tool === 'mirror') {
    if (o && o.t === 'mirror') {
      o.o = o.o === '/' ? '\\' : '/';
      emit(s, 'turnMirror', tx, ty);
      return true;
    }
  }
  emit(s, 'clang', tx, ty);
  return false;
}

// Chakra disc: flies straight, glances off mirrors, flips switches it
// passes and the first lever it hits, and knocks out small enemies.
function throwDisc(s) {
  const h = s.hero;
  let dir = h.dir;
  let x = h.x;
  let y = h.y;
  const path = [];
  for (let n = 0; n < 40; n++) {
    const [dx, dy] = DIRS[dir];
    x += dx;
    y += dy;
    if (!inb(s, x, y)) break;
    const i = idx(s, x, y);
    const f = effFloor(s, i);
    if (f === 'lever') {
      const m = s.meta[i];
      m.on = !m.on;
      s.levers[m.ch] = !s.levers[m.ch];
      emit(s, 'lever', x, y, { on: m.on });
      path.push(i);
      break;
    }
    const o = s.obj[i];
    if (o && o.t === 'mirror') {
      path.push(i);
      dir = reflect(dir, o.o);
      continue;
    }
    if (o || bodyAt(s, x, y)) break;
    const e = enemyAt(s, x, y);
    if (e) {
      if (crushable(e)) killEnemy(s, e, 'disc');
      path.push(i);
      break;
    }
    if (!['floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'ice', 'conv', 'wind', 'blade', 'grass', 'kolam', 'switch', 'water', 'pit', 'exit', 'sexit'].includes(f)) break;
    path.push(i);
    if (f === 'switch') {
      const m = s.meta[i];
      m.on = !m.on;
      s.levers[m.ch] = !s.levers[m.ch];
      emit(s, 'switch', x, y, { on: m.on });
    }
  }
  s.disc = path;
  emit(s, 'disc', h.x, h.y, { dir: h.dir });
  return true;
}

export function reflect(dir, o) {
  if (o === '/') return { R: 'U', U: 'R', L: 'D', D: 'L' }[dir];
  return { R: 'D', D: 'R', L: 'U', U: 'L' }[dir];
}

// ---------- 3. triggers ----------

const BEAM_PASS = new Set(['floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'ice', 'conv', 'wind', 'blade', 'grass', 'kolam', 'switch', 'water', 'pit', 'exit', 'sexit', 'lair', 'den']);

export function lampDir(s, i) {
  const m = s.meta[i];
  if (!m.rotate) return m.dir;
  const k = Math.floor((s.tick + (m.offset || 0)) / m.rotate);
  return CLOCKWISE[(CLOCKWISE.indexOf(m.dir) + k) % 4];
}

// Light beams and lasers: straight lines that turn at mirrors.
function traceBeams(s) {
  s.beams = [];
  for (const [k, m] of Object.entries(s.meta)) {
    if (s.floor[k] === 'sensor') m.hit = false;
  }
  const b = s.boss;
  let bossLit = false;
  for (const [k, m] of Object.entries(s.meta)) {
    const i0 = +k;
    if (s.floor[i0] !== 'lamp') continue;
    if (m.ch && !s.chan[m.ch]) continue;
    let dir = lampDir(s, i0);
    let x = i0 % s.w;
    let y = (i0 - x) / s.w;
    const cells = [];
    for (let n = 0; n < 80; n++) {
      const [dx, dy] = DIRS[dir];
      x += dx;
      y += dy;
      if (!inb(s, x, y)) break;
      const i = idx(s, x, y);
      const f = s.floor[i];
      if (f === 'sensor') {
        s.meta[i].hit = true;
        cells.push(i);
        break;
      }
      if (b && b.alive && b.t !== 'naga' && b.x === x && b.y === y) {
        cells.push(i);
        if (b.t === 'frost' || m.laser) bossLit = true;
        break;
      }
      const o = s.obj[i];
      if (o && o.t === 'mirror') {
        cells.push(i);
        dir = reflect(dir, o.o);
        continue;
      }
      if (o) break;
      if (bodyAt(s, x, y)) {
        cells.push(i);
        if (m.laser && heroAt(s, x, y)) hurt(s, 1, 'Burned by a laser');
        else if (m.laser) hurt(s, 1, 'Burned by a laser');
        break;
      }
      const e = enemyAt(s, x, y);
      if (e) {
        cells.push(i);
        if (m.laser && crushable(e)) killEnemy(s, e, 'laser');
        break;
      }
      const ef = effFloor(s, i);
      if (!BEAM_PASS.has(ef)) break;
      cells.push(i);
    }
    s.beams.push({ from: i0, cells, laser: !!m.laser });
  }
  // Frostfang melts under concentrated sunlight (one hit per exposure).
  if (b && b.alive) {
    if (bossLit && !b.beamLock) {
      b.beamLock = true;
      bossDamage(s, 'light');
    } else if (!bossLit) b.beamLock = false;
  }
}

function updateTriggers(s) {
  traceBeams(s);
  const pressed = {};
  const groups = {};
  const group = (ch) => (groups[ch] = groups[ch] || { b: 0, bl: 0, se: 0, sl: 0, k: 0 });
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    const f = s.floor[i];
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (f === 'plate') {
      const o = s.obj[i];
      const heavy = o && (!m.only || o.t === m.only);
      const down = !!heavy || (!m.only && (bodyAt(s, x, y) || !!enemyAt(s, x, y)));
      if (down !== !!m.down) emit(s, down ? 'plateDown' : 'plateUp', x, y);
      m.down = down;
      if (m.all) {
        // Twin plates: all of them at once, and the mechanism locks open.
        const g = group(m.ch);
        g.all = (g.all || 0) + 1;
        if (down) g.allDown = (g.allDown || 0) + 1;
      } else if (down) pressed[m.ch] = true;
    } else if (f === 'brazier') {
      const g = group(m.ch);
      g.b++;
      if (m.lit) g.bl++;
    } else if (f === 'sensor') {
      const g = group(m.ch);
      g.se++;
      if (m.hit) g.sl++;
      if (m.hit !== m.wasHit) emit(s, m.hit ? 'sensorOn' : 'sensorOff', x, y);
      m.wasHit = m.hit;
    } else if (f === 'kolam') {
      group(m.ch).k++;
    }
  }
  const chans = new Set([...Object.keys(pressed), ...Object.keys(s.levers), ...Object.keys(groups)]);
  for (const m of Object.values(s.meta)) if (m.ch) chans.add(m.ch);
  for (const ch of chans) {
    const g = groups[ch];
    if (g && g.all && g.allDown === g.all && !s.kolamDone[ch]) {
      s.kolamDone[ch] = true;
      emit(s, 'latch', 0, 0, { ch });
    }
    const active = !!(pressed[ch] || (g && g.all && s.kolamDone[ch]) ||
      (g && g.b > 0 && g.bl === g.b) ||
      (g && g.se > 0 && g.sl === g.se) ||
      (g && g.k > 0 && s.kolamDone[ch]));
    const on = active !== !!s.levers[ch];
    if (on && s.chanStart[ch] === undefined) s.chanStart[ch] = s.tick;
    s.chan[ch] = on;
  }
  // Gates and bridges cannot close on something standing in them; wells
  // cannot flood a cell someone stands in.
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    const f = s.floor[i];
    if (f !== 'gate' && f !== 'bridge' && f !== 'well') continue;
    const x = i % s.w;
    const y = (i - x) / s.w;
    const occupied = (f === 'well' ? false : !!s.obj[i]) || bodyAt(s, x, y) || !!enemyAt(s, x, y);
    m.held = false;
    if (f === 'well') {
      let wet = wellWet(s, i);
      if (wet && occupied) {
        m.held = true;
        wet = false;
      }
      if (m.wet !== undefined && m.wet !== wet) emit(s, wet ? 'flood' : 'drain', x, y);
      m.wet = wet;
      continue;
    }
    let open = gateOpen(s, i);
    if (!open && occupied) {
      open = true;
      m.held = true;
    }
    if (m.open !== undefined && m.open !== open) emit(s, open ? 'gateOpen' : 'gateClose', x, y);
    m.open = open;
  }
  gearJams(s);
}

// ---------- conveyors, wind and ice slides ----------

// Belts linked to a channel run backwards while it is on.
export function convDir(s, i) {
  const m = s.meta[i];
  return m.ch && s.chan[m.ch] ? OPPOSITE[m.dir] : m.dir;
}

function carry(s, moved) {
  // Objects sliding on ice.
  for (let i = 0; i < s.obj.length; i++) {
    const o = s.obj[i];
    if (!o || !o.slide || moved.has(o.id)) continue;
    const x = i % s.w;
    const y = (i - x) / s.w;
    const [dx, dy] = DIRS[o.slide];
    const nx = x + dx;
    const ny = y + dy;
    moved.add(o.id);
    if (bossAt(s, nx, ny) && s.boss.t === 'frost' && HEAVY.has(o.t)) {
      s.obj[i] = null;
      emit(s, 'shatter', nx, ny, { obj: o.t });
      bossDamage(s, 'rock');
      continue;
    }
    const e = inb(s, nx, ny) ? enemyAt(s, nx, ny) : null;
    if (e && crushable(e) && HEAVY.has(o.t)) {
      killEnemy(s, e, o.t);
    }
    if (!objectCanEnter(s, nx, ny, o)) {
      o.slide = null;
      emit(s, 'land', x, y, { obj: o.t, heavy: true, soft: true });
      continue;
    }
    const m = moveObject(s, i, idx(s, nx, ny));
    if (m && s.floor[idx(s, nx, ny)] !== 'ice') m.slide = null;
  }
  // Conveyors move resting objects one tile per tick.
  const convs = [];
  for (const [k, m] of Object.entries(s.meta)) {
    if (s.floor[k] === 'conv') convs.push([+k, convDir(s, +k)]);
  }
  for (const [i, dir] of convs) {
    const o = s.obj[i];
    if (!o || moved.has(o.id) || o.st === 'fall' || o.st === 'wobble') continue;
    const x = i % s.w;
    const y = (i - x) / s.w;
    const [dx, dy] = DIRS[dir];
    if (!objectCanEnter(s, x + dx, y + dy, o)) continue;
    moved.add(o.id);
    const m = moveObject(s, i, idx(s, x + dx, y + dy));
    if (m) startSlide(s, m, x + dx, y + dy, dir);
    emit(s, 'convey', x + dx, y + dy);
  }
  // Conveyors and wind push the hero.
  const h = s.hero;
  const hi = idx(s, h.x, h.y);
  const hf = s.floor[hi];
  if ((hf === 'conv' || hf === 'wind') && !h.slide) {
    const dir = convDir(s, hi);
    const [dx, dy] = DIRS[dir];
    const nx = h.x + dx;
    const ny = h.y + dy;
    if (inb(s, nx, ny)) {
      const ni = idx(s, nx, ny);
      const o = s.obj[ni];
      const free = heroCanEnter(s, ni) && !enemyAt(s, nx, ny) && !partnerAt(s, nx, ny) && !bossAt(s, nx, ny) &&
        (!o || COLLECTIBLE.has(o.t));
      if (free) {
        if (o) {
          collect(s, o, nx, ny);
          s.obj[ni] = null;
        }
        leaveCell(s);
        h.x = nx;
        h.y = ny;
        emit(s, hf === 'wind' ? 'gust' : 'convey', nx, ny, { hero: true });
        enterCell(s, dir);
      }
    }
  }
}

// ---------- 4. physics (3.3) ----------

export function physics(s, moved = new Set()) {
  const { w, h } = s;
  // Bottom row first, left to right, so chains always resolve the same way.
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = s.obj[i];
      if (!o || moved.has(o.id) || !FALLERS.has(o.t) || o.sunk) continue;
      const wasMoving = o.st === 'fall' || o.st === 'wobble';
      if (y + 1 >= h) {
        o.st = 'rest';
        continue;
      }
      const bi = i + w;

      // Something landing on an explorer. Resting on a head is safe.
      if (bodyAt(s, x, y + 1)) {
        if (wasMoving) {
          emit(s, 'land', x, y, { obj: o.t, heavy: o.t !== 'gem' });
          hurt(s, s.rules.crush, `Crushed by ${OBJECT_NAMES[o.t]}`);
          emit(s, 'crush', x, y + 1, { obj: o.t });
        }
        if (o.t === 'snow' && wasMoving) {
          s.obj[i] = null;
          emit(s, 'poof', x, y);
          continue;
        }
        o.st = 'rest';
        continue;
      }
      if (bossAt(s, x, y + 1)) {
        if (wasMoving) {
          s.obj[i] = null;
          emit(s, 'shatter', x, y + 1, { obj: o.t });
          if (o.t !== 'snow') bossDamage(s, 'rock');
          continue;
        }
        o.st = 'rest';
        continue;
      }
      const e = enemyAt(s, x, y + 1);
      if (e) {
        if (wasMoving && crushable(e)) {
          killEnemy(s, e, o.t);
          const m = moveObject(s, i, bi);
          if (m) m.st = 'fall';
          moved.add(o.id);
        } else if (!crushable(e)) {
          o.st = 'rest';
        }
        continue;
      }
      if (objectCanEnter(s, x, y + 1, o)) {
        if (!wasMoving && s.rules.wobble) {
          o.st = 'wobble';
          emit(s, 'wobble', x, y, { obj: o.t });
          continue;
        }
        const m = moveObject(s, i, bi);
        if (m) m.st = 'fall';
        moved.add(o.id);
        continue;
      }

      // Supported.
      if (o.t === 'snow' && wasMoving) {
        s.obj[i] = null;
        emit(s, 'poof', x, y);
        continue;
      }
      if (o.st === 'fall') emit(s, 'land', x, y, { obj: o.t, heavy: o.t !== 'gem' });
      o.st = 'rest';

      // Rolling stones roll off round things, left first (rule 6).
      const below = s.obj[bi];
      if (o.t === 'stone' && below && ROUND.has(below.t) && below.st !== 'fall') {
        for (const dx of [-1, 1]) {
          const sx = x + dx;
          if (!objectCanEnter(s, sx, y, o) || !objectCanEnter(s, sx, y + 1, o)) continue;
          if (bodyAt(s, sx, y + 1)) continue;
          if (!wasMoving && s.rules.wobble) {
            o.st = 'wobble';
            emit(s, 'wobble', x, y, { obj: o.t });
          } else {
            const m = moveObject(s, i, i + dx);
            if (m) m.st = 'fall';
            moved.add(o.id);
            emit(s, 'roll', sx, y, { dir: dx < 0 ? 'L' : 'R' });
          }
          break;
        }
      }
    }
  }
}

// ---------- 6. hazards (4.2) ----------

export function spikePhase(s, i, tick = s.tick) {
  const m = s.meta[i];
  const period = m.period || 4;
  const p = (tick + (m.offset || 0)) % period;
  if (p === period - 1) return 'up';
  if (p === period - 2) return 'warn';
  return 'down';
}

const HAZARD_TEXT = { spikes: 'Stabbed by a spike floor', blade: 'Cut by a swinging blade' };

function hazards(s) {
  const h = s.hero;
  const hi = idx(s, h.x, h.y);
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    const f = s.floor[i];
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (f === 'spikes' || f === 'blade' || f === 'jet' || f === 'vent') {
      const ph = spikePhase(s, i);
      if (ph !== m.ph) {
        if (ph === 'warn') emit(s, f === 'jet' ? 'jetWarn' : f === 'vent' ? 'ventWarn' : 'spikeWarn', x, y);
        if (ph === 'up' && f !== 'jet' && f !== 'vent') emit(s, 'spikeUp', x, y, { blade: f === 'blade' });
      }
      m.ph = ph;
      if (f === 'jet' && ph === 'up') fireJet(s, i, m);
      if (f === 'vent' && ph === 'up') avalanche(s, x, y);
    } else if (f === 'ice' && m.frost && s.tick >= m.melt) {
      if (!bodyAt(s, x, y) && !enemyAt(s, x, y)) {
        s.floor[i] = 'water';
        s.meta[i] = {};
        emit(s, 'melt', x, y);
        const o = s.obj[i];
        if (o && HEAVY.has(o.t)) {
          s.obj[i] = null;
          s.floor[i] = 'filled';
          emit(s, 'fill', x, y, { obj: o.t, was: 'water' });
        } else if (o) {
          s.obj[i] = null;
          emit(s, 'splash', x, y);
        }
      }
    } else if (f === 'collapse' && !m.down) {
      const t0 = m.ch ? s.chanStart[m.ch] : 0;
      if (t0 === undefined) continue;
      const at = t0 + m.at;
      m.warn = s.tick >= at - 3;
      if (s.tick >= at) {
        if (bodyAt(s, x, y)) {
          if (!m.hurt) {
            m.hurt = true;
            hurt(s, 1, 'Fell with the collapsing floor');
          }
        } else {
          m.down = true;
          const o = s.obj[i];
          if (o) s.obj[i] = null;
          emit(s, 'collapse', x, y);
        }
      }
    }
  }
  if (s.status !== 'play') return;
  const hf = s.floor[hi];
  if ((hf === 'spikes' || hf === 'blade') && s.meta[hi].ph === 'up') hurt(s, 1, HAZARD_TEXT[hf]);
  if (s.fire.includes(hi)) hurt(s, 1, 'Scorched by a fire jet');
}

// Fire jets throw flame 3 tiles; crates catch and burn after 3 blasts.
function fireJet(s, i, m) {
  const [dx, dy] = DIRS[m.dir];
  let x = i % s.w;
  let y = (i - x) / s.w;
  for (let k = 0; k < 3; k++) {
    x += dx;
    y += dy;
    if (!inb(s, x, y)) break;
    const c = idx(s, x, y);
    const f = effFloor(s, c);
    if (!BEAM_PASS.has(f)) break;
    const o = s.obj[c];
    if (o) {
      if (o.t === 'crate') {
        o.burn = (o.burn || 0) + 1;
        emit(s, 'scorch', x, y);
        if (o.burn >= 3) {
          s.obj[c] = null;
          emit(s, 'burn', x, y);
        }
      }
      break;
    }
    s.fire.push(c);
    const e = enemyAt(s, x, y);
    if (e && crushable(e) && e.t !== 'knight') killEnemy(s, e, 'fire');
    if (partnerAt(s, x, y)) hurt(s, 1, 'Scorched by a fire jet');
  }
  emit(s, 'jet', i % s.w, Math.floor(i / s.w));
}

// Avalanche vents drop a chunk of snow into the cell below.
function avalanche(s, x, y) {
  const by = y + 1;
  if (!inb(s, x, by)) return;
  const bi = idx(s, x, by);
  if (bodyAt(s, x, by)) {
    hurt(s, 1, 'Buried by an avalanche');
    emit(s, 'poof', x, by);
    return;
  }
  const f = effFloor(s, bi);
  if (s.obj[bi] || enemyAt(s, x, by) || !['floor', 'filled', 'ice', 'spikes', 'plate', 'grass', 'weak'].includes(f)) return;
  s.obj[bi] = { id: s.nextId++, t: 'snow', st: 'fall' };
  emit(s, 'avalanche', x, by);
}

// ---------- analysis helpers used by clues ----------

// Rock-fall preview (5.2): run physics alone until everything settles.
export function predictFalls(s) {
  const sim = cloneState(s);
  sim.events = [];
  sim.status = 'play';
  sim.hero.invul = 99;
  for (let n = 0; n < 40; n++) {
    physics(sim);
    const moving = sim.obj.some((o) => o && (o.st === 'fall' || o.st === 'wobble'));
    if (!moving) break;
  }
  const out = [];
  const before = new Map();
  s.obj.forEach((o, i) => { if (o) before.set(o.id, i); });
  sim.obj.forEach((o, i) => {
    if (o && before.has(o.id) && before.get(o.id) !== i) out.push({ from: before.get(o.id), to: i, t: o.t });
  });
  for (const [id, i] of before) {
    if (!sim.obj.some((o) => o && o.id === id)) out.push({ from: i, to: -1, t: s.obj[i].t });
  }
  return out;
}

export function remaining(s) {
  let gems = 0;
  let red = 0;
  s.obj.forEach((o) => {
    if (o && o.t === 'gem') gems++;
    if (o && o.t === 'red') red++;
  });
  return { gems, red };
}

export { OPPOSITE };
