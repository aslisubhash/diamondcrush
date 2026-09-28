// Deterministic grid simulation. Same state + same actions = same result,
// which powers rewind, replays, the Spirit guide and solution tests.
// Tick order follows GDD 3.4.

import {
  DIRS, OPPOSITE, CLOCKWISE, HERO_FLOORS, OBJECT_FLOORS, ENEMY_FLOORS, FILLABLE,
  FALLERS, ROUND, PUSHABLE, HEAVY, COLLECTIBLE, DIFFICULTIES, ENEMY_NAMES, OBJECT_NAMES,
} from './constants.js';
import { parseLevel } from './level.js';

export function createState(level, opts = {}) {
  const diff = DIFFICULTIES[opts.difficulty || 'classic'];
  const p = parseLevel(level);
  const maxHearts = opts.maxHearts ?? diff.hearts;
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
      x: p.hero.x, y: p.hero.y, dir: 'D',
      hearts: maxHearts, maxHearts, invul: 0,
      keys: {}, windup: null,
      tools: [...new Set([...(opts.tools || []), ...(level.tools || [])])],
      tool: 0,
      stolen: 0,
    },
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
    rules: { crush: diff.crush, wobble: diff.wobble },
    status: 'play', // play | won | dead
    exitKind: null, // 'exit' | 'secret'
    lastHurt: '',
    events: [],
    newTools: [],
    boss: null,
  };
  if (p.boss) {
    s.boss = {
      t: p.boss.t, x: p.boss.x, y: p.boss.y, dir: 'R',
      hp: 5, maxHp: 5, phase: 1, alive: true,
      clock: 0, strike: null, sweep: null, trail: [],
    };
    // Remember boulders and earth so the arena can refill between phases.
    s.bossSpawns = [];
    s.bossEarth = [];
    p.obj.forEach((o, i) => { if (o && o.t === 'boulder') s.bossSpawns.push(i); });
    p.floor.forEach((f, i) => { if (f === 'earth') s.bossEarth.push(i); });
  }
  for (const [i, m] of Object.entries(s.meta)) {
    if (s.floor[i] === 'lever' && m.on) s.levers[m.ch] = !s.levers[m.ch];
  }
  updateTriggers(s);
  return s;
}

export function cloneState(s) {
  return structuredClone(s);
}

// ---------- helpers ----------

const idx = (s, x, y) => y * s.w + x;
const inb = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const enemyAt = (s, x, y) => s.enemies.find((e) => e.alive && e.x === x && e.y === y) || null;
const heroAt = (s, x, y) => s.hero.x === x && s.hero.y === y;

function emit(s, type, x, y, extra) {
  s.events.push({ type, x, y, ...extra });
}

export function exitOpen(s) {
  return s.gems >= s.quota && (!s.boss || !s.boss.alive);
}

export function gateOpen(s, i) {
  const m = s.meta[i];
  if (!m) return false;
  if (m.held) return true;
  const on = !!s.chan[m.ch];
  return m.inv ? !on : on;
}

function heroCanEnter(s, i) {
  const f = s.floor[i];
  if (!HERO_FLOORS.has(f)) return false;
  if (f === 'gate' && !gateOpen(s, i)) return false;
  if (f === 'exit' && !exitOpen(s)) return false;
  return true;
}

function objectCanEnter(s, x, y, o) {
  if (!inb(s, x, y)) return false;
  const i = idx(s, x, y);
  const f = s.floor[i];
  if (!OBJECT_FLOORS.has(f)) return false;
  if (f === 'gate' && !gateOpen(s, i)) return false;
  if (s.obj[i] || heroAt(s, x, y) || enemyAt(s, x, y)) return false;
  // Only heavy objects sink into pits and water; gems stop at the edge.
  if (FILLABLE.has(f) && !HEAVY.has(o.t)) return false;
  if (f === 'lair' && !FALLERS.has(o.t) && !HEAVY.has(o.t)) return false;
  return true;
}

function enemyCanEnter(s, x, y) {
  if (!inb(s, x, y)) return false;
  const i = idx(s, x, y);
  const f = s.floor[i];
  if (!ENEMY_FLOORS.has(f)) return false;
  if (f === 'gate' && !gateOpen(s, i)) return false;
  if (s.obj[i] || enemyAt(s, x, y)) return false;
  return true;
}

// Moves an object between cells and applies fill-ins (3.3 rule 10) and
// boss-lair impacts.
function moveObject(s, from, to) {
  const o = s.obj[from];
  s.obj[from] = null;
  const x = to % s.w;
  const y = (to - x) / s.w;
  const f = s.floor[to];
  if (FILLABLE.has(f) && HEAVY.has(o.t)) {
    s.floor[to] = 'filled';
    s.meta[to] = { was: f };
    emit(s, 'fill', x, y, { obj: o.t, was: f });
    return null;
  }
  if (f === 'lair') {
    lairImpact(s, x, y, o);
    return null;
  }
  s.obj[to] = o;
  return o;
}

export function hurt(s, amount, cause) {
  const h = s.hero;
  if (h.invul > 0 || s.status !== 'play') return false;
  h.hearts = Math.max(0, h.hearts - amount);
  h.invul = 2;
  s.hurts++;
  s.lastHurt = cause;
  emit(s, 'hurt', h.x, h.y, { cause, amount });
  if (h.hearts <= 0) {
    s.status = 'dead';
    emit(s, 'death', h.x, h.y, { cause });
  }
  return true;
}

function killEnemy(s, e, by) {
  e.alive = false;
  s.kills++;
  s.coins += 5;
  emit(s, 'kill', e.x, e.y, { enemy: e.t, by });
  if (e.t === 'monkey' && e.carrying) {
    e.carrying = false;
    returnStolen(s, e);
  }
}

function returnStolen(s, e) {
  s.gems++;
  s.hero.stolen = Math.max(0, s.hero.stolen - 1);
  emit(s, 'gemBack', e.x, e.y);
}

// ---------- public tick entry ----------

// action: { type: 'move', dir } | { type: 'tool' } | null (background tick).
// Returns true when a world tick happened.
export function act(s, action) {
  if (s.status !== 'play') return false;
  s.events = [];
  let acted = true;
  if (action) {
    acted = heroAct(s, action);
    if (!acted) return false;
  }
  worldTick(s);
  return true;
}

function worldTick(s) {
  s.tick++;
  if (s.status === 'play') updateTriggers(s); // 3
  if (s.status === 'play') physics(s); // 4
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
  emit(s, 'win', s.hero.x, s.hero.y, { kind });
}

// ---------- 2. hero ----------

function heroAct(s, action) {
  const h = s.hero;
  const prevWind = h.windup;
  h.windup = null;
  if (action.type === 'move') return heroMove(s, action.dir, prevWind);
  if (action.type === 'tool') return useTool(s);
  if (action.type === 'wait') return true;
  return false;
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
    hurt(s, 1, `Bitten by ${ENEMY_NAMES[e.t] || 'an enemy'}`);
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
    // The hero steps into the doorway on the same step.
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
      if (o.st === 'fall') return false;
      const fx = tx + dx;
      const fy = ty + dy;
      if (!objectCanEnter(s, fx, fy, o)) {
        emit(s, 'blocked', tx, ty);
        return false;
      }
      // Boulders are heavy: the hero leans in for one step first (3.3 rule 7).
      if (o.t === 'boulder' && !(prevWind && prevWind.dir === dir && prevWind.x === h.x && prevWind.y === h.y)) {
        h.windup = { dir, x: h.x, y: h.y };
        emit(s, 'lean', tx, ty, { dir });
        return true;
      }
      const moved = moveObject(s, ti, idx(s, fx, fy));
      if (moved) moved.st = 'rest';
      emit(s, 'push', fx, fy, { obj: o.t, dir });
    } else {
      return false;
    }
  }

  if (f === 'earth') {
    s.floor[ti] = 'floor';
    emit(s, 'dig', tx, ty);
  } else if (f === 'false') {
    // A false wall crumbles away once walked through, revealing the secret.
    s.floor[ti] = 'floor';
    emit(s, 'secret', tx, ty);
  }
  const fromI = idx(s, h.x, h.y);
  if (s.floor[fromI] === 'weak') {
    s.floor[fromI] = 'pit';
    emit(s, 'crumble', h.x, h.y);
  }
  h.x = tx;
  h.y = ty;
  s.moves++;
  emit(s, 'step', tx, ty, { floor: s.floor[ti] });

  const nf = s.floor[ti];
  if (nf === 'idol' && !s.meta[ti].active) {
    s.meta[ti].active = true;
    emit(s, 'checkpoint', tx, ty);
  }
  return true;
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

function useTool(s) {
  const tool = currentTool(s);
  const h = s.hero;
  const [dx, dy] = DIRS[h.dir];
  const tx = h.x + dx;
  const ty = h.y + dy;
  if (!tool || !inb(s, tx, ty)) return false;
  const ti = idx(s, tx, ty);
  if (tool === 'hammer') {
    if (s.floor[ti] === 'cracked') {
      s.floor[ti] = 'floor';
      emit(s, 'smash', tx, ty);
      return true;
    }
    const o = s.obj[ti];
    if (o && o.t === 'boulder' && o.st !== 'fall') {
      s.obj[ti] = null;
      emit(s, 'smash', tx, ty, { obj: 'boulder' });
      return true;
    }
    emit(s, 'clang', tx, ty);
    return false;
  }
  if (tool === 'grapple') {
    // Pull the object in front one tile towards the hero; the hero steps back.
    const o = s.obj[ti];
    const bx = h.x - dx;
    const by = h.y - dy;
    if (!o || !PUSHABLE.has(o.t) || o.st === 'fall' || !inb(s, bx, by)) return false;
    const bi = idx(s, bx, by);
    if (!heroCanEnter(s, bi) || s.obj[bi] || enemyAt(s, bx, by)) return false;
    const fromI = idx(s, h.x, h.y);
    h.x = bx;
    h.y = by;
    s.obj[fromI] = o;
    s.obj[ti] = null;
    o.st = 'rest';
    s.moves++;
    emit(s, 'pull', tx, ty, { obj: o.t });
    return true;
  }
  return false;
}

// ---------- 3. triggers ----------

function updateTriggers(s) {
  const pressed = {};
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    if (s.floor[i] !== 'plate') continue;
    const x = i % s.w;
    const y = (i - x) / s.w;
    const down = !!s.obj[i] || heroAt(s, x, y);
    if (down !== !!m.down) emit(s, down ? 'plateDown' : 'plateUp', x, y);
    m.down = down;
    if (down) pressed[m.ch] = true;
  }
  const chans = new Set([...Object.keys(pressed), ...Object.keys(s.levers)]);
  for (const m of Object.values(s.meta)) if (m.ch) chans.add(m.ch);
  for (const ch of chans) {
    const on = !!pressed[ch] !== !!s.levers[ch];
    s.chan[ch] = on;
  }
  // Gates cannot close on something standing in them.
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    if (s.floor[i] !== 'gate') continue;
    const x = i % s.w;
    const y = (i - x) / s.w;
    m.held = false;
    let open = gateOpen(s, i);
    if (!open && (s.obj[i] || heroAt(s, x, y) || enemyAt(s, x, y))) {
      open = true;
      m.held = true;
    }
    if (m.open !== undefined && m.open !== open) emit(s, open ? 'gateOpen' : 'gateClose', x, y);
    m.open = open;
  }
}

// ---------- 4. physics (3.3) ----------

export function physics(s) {
  const moved = new Set();
  const { w, h } = s;
  // Bottom row first, left to right, so chains always resolve the same way.
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = s.obj[i];
      if (!o || moved.has(o.id) || !FALLERS.has(o.t)) continue;
      const wasMoving = o.st === 'fall' || o.st === 'wobble';
      if (y + 1 >= h) {
        o.st = 'rest';
        continue;
      }
      const bi = i + w;

      // Something landing on the hero. Resting on the hero's head is safe.
      if (heroAt(s, x, y + 1)) {
        if (wasMoving) {
          emit(s, 'land', x, y, { obj: o.t, heavy: o.t !== 'gem' });
          hurt(s, s.rules.crush, `Crushed by ${OBJECT_NAMES[o.t]}`);
          emit(s, 'crush', x, y + 1, { obj: o.t });
        }
        o.st = 'rest';
        continue;
      }
      const e = enemyAt(s, x, y + 1);
      if (e) {
        if (wasMoving) {
          killEnemy(s, e, o.t);
          const m = moveObject(s, i, bi);
          if (m) m.st = 'fall';
          moved.add(o.id);
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
      if (o.st === 'fall') emit(s, 'land', x, y, { obj: o.t, heavy: o.t !== 'gem' });
      o.st = 'rest';

      // Rolling stones roll off round things, left first (rule 6).
      const below = s.obj[bi];
      if (o.t === 'stone' && below && ROUND.has(below.t) && below.st !== 'fall') {
        for (const dx of [-1, 1]) {
          const sx = x + dx;
          if (!objectCanEnter(s, sx, y, o) || !objectCanEnter(s, sx, y + 1, o)) continue;
          if (heroAt(s, sx, y + 1)) continue;
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

// ---------- 5. enemies (4.1) ----------

function enemiesAct(s) {
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.t === 'snake') snakeAct(s, e);
    else if (e.t === 'scarab') scarabAct(s, e);
    else if (e.t === 'monkey') monkeyAct(s, e);
    if (s.status !== 'play') return;
  }
}

function tryEnemyStep(s, e, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = e.x + dx;
  const ny = e.y + dy;
  if (heroAt(s, nx, ny)) {
    e.dir = dir;
    hurt(s, 1, `Bitten by ${ENEMY_NAMES[e.t]}`);
    emit(s, 'attack', nx, ny, { enemy: e.t });
    return 'attack';
  }
  if (!enemyCanEnter(s, nx, ny)) return false;
  e.x = nx;
  e.y = ny;
  e.dir = dir;
  return true;
}

// Back and forth on a line, turning at walls. Moves every other tick.
function snakeAct(s, e) {
  if (s.tick % 2) return;
  const r = tryEnemyStep(s, e, e.dir);
  if (r === false) {
    e.dir = OPPOSITE[e.dir];
    emit(s, 'turn', e.x, e.y);
  }
}

// Follows the wall on its left. Moves every other tick.
function scarabAct(s, e) {
  if (s.tick % 2 === 0) return;
  const c = CLOCKWISE.indexOf(e.dir);
  const order = [CLOCKWISE[(c + 3) % 4], e.dir, CLOCKWISE[(c + 1) % 4], CLOCKWISE[(c + 2) % 4]];
  for (const d of order) {
    const r = tryEnemyStep(s, e, d);
    if (r) return;
  }
}

// Wanders its line; steals a gem when next to the hero, then flees.
function monkeyAct(s, e) {
  const h = s.hero;
  const dist = (x, y) => Math.abs(x - h.x) + Math.abs(y - h.y);
  if (e.calm) return;
  if (!e.carrying) {
    if (dist(e.x, e.y) === 1 && s.gems > 0) {
      e.carrying = true;
      s.gems--;
      h.stolen++;
      emit(s, 'steal', e.x, e.y);
      monkeyFlee(s, e, dist, false);
      return;
    }
    if (s.tick % 2) return;
    const [dx, dy] = DIRS[e.dir];
    if (heroAt(s, e.x + dx, e.y + dy) || !enemyCanEnter(s, e.x + dx, e.y + dy)) {
      e.dir = OPPOSITE[e.dir];
      return;
    }
    e.x += dx;
    e.y += dy;
    return;
  }
  monkeyFlee(s, e, dist);
}

// Fleeing: step to the free neighbour that is furthest from the hero.
function monkeyFlee(s, e, dist, canYield = true) {
  let best = null;
  let bestD = dist(e.x, e.y);
  for (const d of ['L', 'U', 'R', 'D']) {
    const [dx, dy] = DIRS[d];
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (!enemyCanEnter(s, nx, ny) || heroAt(s, nx, ny)) continue;
    const nd = dist(nx, ny);
    if (nd > bestD) {
      best = d;
      bestD = nd;
    }
  }
  if (best) {
    const [dx, dy] = DIRS[best];
    e.x += dx;
    e.y += dy;
    e.dir = best;
  } else if (canYield && dist(e.x, e.y) === 1) {
    // Cornered: it gives up the gem.
    e.carrying = false;
    e.calm = true;
    returnStolen(s, e);
  }
}

// ---------- boss: Naga Warden (4.3) ----------

const BOSS_TUNING = {
  1: { move: 3, strikeEvery: 11, sweepEvery: 0 },
  2: { move: 2, strikeEvery: 10, sweepEvery: 13 },
  3: { move: 2, strikeEvery: 8, sweepEvery: 11 },
};

function bossPhase(hp) {
  if (hp >= 5) return 1;
  if (hp >= 3) return 2;
  return 3;
}

function lairImpact(s, x, y, o) {
  const b = s.boss;
  if (b && b.alive && b.x === x && b.y === y) {
    b.hp--;
    b.hurtT = s.tick;
    b.strike = null;
    emit(s, 'bossHit', x, y, { hp: b.hp });
    if (b.hp <= 0) {
      b.alive = false;
      b.sweep = null;
      s.coins += 200;
      emit(s, 'bossDown', x, y);
      const ex = s.floor.indexOf('exit');
      if (ex >= 0) emit(s, 'exitOpen', ex % s.w, Math.floor(ex / s.w));
      return;
    }
    const np = bossPhase(b.hp);
    if (np !== b.phase) {
      b.phase = np;
      b.sweep = null;
      b.clock = 0;
      s.hero.hearts = s.hero.maxHearts;
      emit(s, 'bossPhase', x, y, { phase: np });
      bossRefill(s, true);
      emit(s, 'checkpoint', s.hero.x, s.hero.y, { silent: true });
    }
  } else {
    emit(s, 'shatter', x, y, { obj: o.t });
  }
}

// Refill boulders (and the earth holding them) so the arena never soft-locks.
function bossRefill(s, force) {
  const b = s.boss;
  if (!force) {
    const any = s.obj.some((o) => o && o.t === 'boulder');
    if (any) return;
  }
  let placed = false;
  for (const i of s.bossEarth) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (s.floor[i] === 'floor' && !s.obj[i] && !heroAt(s, x, y) && !enemyAt(s, x, y)) s.floor[i] = 'earth';
  }
  for (const i of s.bossSpawns) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (!s.obj[i] && !heroAt(s, x, y) && s.floor[i] !== 'earth') {
      s.obj[i] = { id: s.nextId++, t: 'boulder', st: 'rest' };
      placed = true;
    }
  }
  if (placed) emit(s, 'refill', b.x, b.y);
}

function bossAct(s) {
  const b = s.boss;
  if (!b || !b.alive) return;
  const t = BOSS_TUNING[b.phase];
  const h = s.hero;
  b.clock++;

  // Head strike: telegraph two ticks, then lash up the column.
  if (b.strike) {
    b.strike.t--;
    if (b.strike.t === 0) {
      emit(s, 'strike', b.strike.x, b.y);
      if (h.x === b.strike.x && h.y < b.y && h.y >= b.y - 3) hurt(s, 1, 'Struck by the Naga Warden');
      b.strike = null;
    }
  } else if (b.clock % t.strikeEvery === 0) {
    b.strike = { x: b.x, t: 2 };
    emit(s, 'strikeWarn', b.x, b.y);
  } else if (s.tick % t.move === 0) {
    b.trail.unshift({ x: b.x, y: b.y });
    b.trail.length = Math.min(b.trail.length, 4);
    let nx = b.x + (b.dir === 'R' ? 1 : -1);
    if (!inb(s, nx, b.y) || s.floor[idx(s, nx, b.y)] !== 'lair') {
      b.dir = b.dir === 'R' ? 'L' : 'R';
      nx = b.x + (b.dir === 'R' ? 1 : -1);
    }
    b.x = nx;
  }

  // Tail sweep along the row above the lair (phase 2+).
  if (b.sweep) {
    b.sweep.t--;
    if (b.sweep.t === 0) {
      emit(s, 'sweep', b.x, b.sweep.y);
      if (h.y === b.sweep.y) hurt(s, 1, "Swept by the Naga Warden's tail");
      b.sweep = null;
    }
  } else if (t.sweepEvery && b.clock % t.sweepEvery === 0) {
    b.sweep = { y: b.y - 1, t: 3 };
    emit(s, 'sweepWarn', b.x, b.y - 1);
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

function hazards(s) {
  const h = s.hero;
  const hi = idx(s, h.x, h.y);
  for (const [k, m] of Object.entries(s.meta)) {
    const i = +k;
    if (s.floor[i] !== 'spikes') continue;
    const ph = spikePhase(s, i);
    if (ph !== m.ph) {
      const x = i % s.w;
      const y = (i - x) / s.w;
      if (ph === 'warn') emit(s, 'spikeWarn', x, y);
      if (ph === 'up') emit(s, 'spikeUp', x, y);
    }
    m.ph = ph;
  }
  if (s.floor[hi] === 'spikes' && s.meta[hi].ph === 'up') hurt(s, 1, 'Stabbed by a spike floor');
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
  // Objects that vanished into pits or the lair.
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
