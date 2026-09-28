// Bosses (GDD 4.3). Three phases each; damage only ever comes from the
// arena (falling or sliding rocks, jammed gears), never from attacking.
import { DIRS, MIRROR_DIR, ENEMY_NAMES } from './constants.js';
import {
  idx, inb, emit, heroAt, bodyAt, enemyAt, hurt, lineOfSight, effFloor,
} from './shared.js';
import { ENEMY_FLOORS } from './constants.js';
import { pathStep } from './enemies.js';

export function makeBoss(t, x, y) {
  return {
    t, x, y, dir: 'R',
    hp: 5, maxHp: 5, phase: 1, alive: true,
    clock: 0, trail: [], stun: 0,
    strike: null, sweep: null, charge: null, wind: null, breath: null, cannon: null,
  };
}

export function bossPhase(hp) {
  if (hp >= 5) return 1;
  if (hp >= 3) return 2;
  return 3;
}

export function bossDamage(s, how) {
  const b = s.boss;
  if (!b || !b.alive) return;
  b.hp--;
  b.hurtT = s.tick;
  b.strike = null;
  b.charge = null;
  b.wind = null;
  b.breath = null;
  emit(s, 'bossHit', b.x, b.y, { hp: b.hp, how });
  if (b.hp <= 0) {
    b.alive = false;
    b.sweep = null;
    b.cannon = null;
    s.coins += 200;
    s.dark = false;
    emit(s, 'bossDown', b.x, b.y, { boss: b.t });
    const ex = s.floor.indexOf('exit');
    if (ex >= 0) emit(s, 'exitOpen', ex % s.w, Math.floor(ex / s.w));
    return;
  }
  b.stun = Math.max(b.stun, 2);
  const np = bossPhase(b.hp);
  if (np !== b.phase) {
    b.phase = np;
    b.sweep = null;
    b.cannon = null;
    b.clock = 0;
    s.hero.hearts = s.hero.maxHearts;
    if (b.t === 'frost' && np === 3) s.dark = true;
    emit(s, 'bossPhase', b.x, b.y, { phase: np, boss: b.t });
    bossRefill(s, true);
    emit(s, 'checkpoint', s.hero.x, s.hero.y, { silent: true });
  }
}

// The Naga lives in the lair row: anything falling in shatters, and hits
// the head if it is there.
export function lairImpact(s, x, y, o) {
  const b = s.boss;
  if (b && b.alive && b.t === 'naga' && b.x === x && b.y === y) bossDamage(s, 'rock');
  else emit(s, 'shatter', x, y, { obj: o.t });
}

// Refill boulders (and the earth holding them) so an arena never soft-locks.
export function bossRefill(s, force) {
  const b = s.boss;
  if (!b || !s.bossSpawns) return;
  if (!force) {
    const any = s.obj.some((o) => o && o.t === 'boulder');
    if (any) return;
  }
  let placed = false;
  for (const i of s.bossEarth) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (s.floor[i] === 'floor' && !s.obj[i] && !bodyAt(s, x, y) && !enemyAt(s, x, y) && !(b.x === x && b.y === y)) s.floor[i] = 'earth';
  }
  for (const i of s.bossSpawns) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (!s.obj[i] && !bodyAt(s, x, y) && s.floor[i] !== 'earth' && !(b.x === x && b.y === y) && !enemyAt(s, x, y)) {
      s.obj[i] = { id: s.nextId++, t: 'boulder', st: 'rest' };
      placed = true;
    }
  }
  if (placed) emit(s, 'refill', b.x, b.y);
}

export function bossAct(s) {
  const b = s.boss;
  if (!b || !b.alive) return;
  b.clock++;
  const fn = { naga, baron, frost, rakta, hand }[b.t];
  fn(s, b);
}

// ---------- Naga Warden (Angkor) ----------

const NAGA = {
  1: { move: 3, strikeEvery: 11, sweepEvery: 0 },
  2: { move: 2, strikeEvery: 10, sweepEvery: 13 },
  3: { move: 2, strikeEvery: 8, sweepEvery: 11 },
};

function naga(s, b) {
  const t = NAGA[b.phase];
  const h = s.hero;
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

// ---------- The Iron Baron (Bavaria) ----------
// Charges in straight lines when lined up with the hero. Ramming a wall
// stuns him, which is the moment to drop a rock on his helmet.

const BARON = {
  1: { wander: 3, stun: 7 },
  2: { wander: 2, stun: 6 },
  3: { wander: 2, stun: 5 },
};

function bossCanEnter(s, x, y) {
  if (!inb(s, x, y)) return false;
  const i = idx(s, x, y);
  if (!ENEMY_FLOORS.has(effFloor(s, i))) return false;
  return !s.obj[i] && !enemyAt(s, x, y) && !(s.partner && s.partner.x === x && s.partner.y === y);
}

function bossStep(s, b, dir, name) {
  const [dx, dy] = DIRS[dir];
  const nx = b.x + dx;
  const ny = b.y + dy;
  if (bodyAt(s, nx, ny)) {
    hurt(s, 1, `Struck by ${name}`);
    emit(s, 'attack', nx, ny, { enemy: b.t });
    return 'hit';
  }
  if (!bossCanEnter(s, nx, ny)) return false;
  b.trail.unshift({ x: b.x, y: b.y });
  b.trail.length = Math.min(b.trail.length, 3);
  b.x = nx;
  b.y = ny;
  b.dir = dir;
  return true;
}

function greedy(s, b, tx, ty, name) {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const dirs = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx) dirs.push(dx < 0 ? 'L' : 'R');
    if (dy) dirs.push(dy < 0 ? 'U' : 'D');
  } else {
    if (dy) dirs.push(dy < 0 ? 'U' : 'D');
    if (dx) dirs.push(dx < 0 ? 'L' : 'R');
  }
  for (const d of dirs) if (bossStep(s, b, d, name)) return;
}

function baron(s, b) {
  const t = BARON[b.phase];
  const h = s.hero;
  const name = ENEMY_NAMES.baron;
  if (b.stun > 0) {
    b.stun--;
    return;
  }
  if (b.charge) {
    const r = bossStep(s, b, b.charge, name);
    if (r === true) return;
    const [dx, dy] = DIRS[b.charge];
    const wx = b.x + dx;
    const wy = b.y + dy;
    b.charge = null;
    if (r === 'hit') {
      b.stun = 2;
      return;
    }
    if (inb(s, wx, wy) && s.floor[idx(s, wx, wy)] === 'cracked') {
      s.floor[idx(s, wx, wy)] = 'floor';
      emit(s, 'smash', wx, wy);
    }
    b.stun = t.stun;
    emit(s, 'bossBump', b.x, b.y);
    return;
  }
  if (b.wind) {
    b.charge = b.wind.dir;
    b.wind = null;
    return;
  }
  const d = lineOfSight(s, b.x, b.y, h.x, h.y, 12);
  if (d) {
    b.wind = { dir: d };
    b.dir = d;
    emit(s, 'chargeWarn', b.x, b.y, { dir: d });
    return;
  }
  if (s.tick % t.wander === 0) greedy(s, b, h.x, h.y, name);
}

// ---------- Frostfang (Tibet) ----------
// Paces its den column and breathes frost along its row. Rocks slid into
// it across the ice crack its hide; in phase 3 the lights go out.

const FROST = {
  1: { move: 3, breathEvery: 9 },
  2: { move: 2, breathEvery: 8 },
  3: { move: 2, breathEvery: 7 },
};

function frost(s, b) {
  const t = FROST[b.phase];
  const h = s.hero;
  if (b.stun > 0) {
    b.stun--;
    return;
  }
  if (b.breath) {
    b.breath.t--;
    if (b.breath.t === 0) {
      emit(s, 'breath', b.x, b.breath.y);
      if (h.y === b.breath.y) hurt(s, 1, "Frozen by Frostfang's breath");
      b.breath = null;
    }
    return;
  }
  if (b.clock % t.breathEvery === 0) {
    b.breath = { y: b.y, t: 2 };
    emit(s, 'breathWarn', b.x, b.y);
    return;
  }
  if (s.tick % t.move) return;
  const den = (y) => inb(s, b.x, y) && s.floor[idx(s, b.x, y)] === 'den';
  if (b.dir !== 'U' && b.dir !== 'D') b.dir = 'D';
  let ny = b.y + (b.dir === 'D' ? 1 : -1);
  if (!den(ny)) {
    b.dir = b.dir === 'D' ? 'U' : 'D';
    ny = b.y + (b.dir === 'D' ? 1 : -1);
  }
  if (den(ny)) {
    b.trail.unshift({ x: b.x, y: b.y });
    b.trail.length = Math.min(b.trail.length, 2);
    b.y = ny;
  }
}

// ---------- Rakta Yantra (India) ----------
// A clockwork guardian bolted to the floor. Cannons sweep the hero's row
// or column after a warning; boulders pushed onto its gear sockets jam it.

const RAKTA = {
  1: { every: 8, rows: true, cols: false },
  2: { every: 7, rows: false, cols: true },
  3: { every: 6, rows: true, cols: true },
};

function rakta(s, b) {
  const t = RAKTA[b.phase];
  const h = s.hero;
  if (b.cannon) {
    b.cannon.t--;
    if (b.cannon.t === 0) {
      emit(s, 'cannon', b.x, b.y);
      if ((b.cannon.row !== null && h.y === b.cannon.row) || (b.cannon.col !== null && h.x === b.cannon.col)) {
        hurt(s, 1, "Blasted by Rakta Yantra's cannon");
      }
      b.cannon = null;
    }
    return;
  }
  if (b.clock % t.every === 0) {
    b.cannon = { row: t.rows ? h.y : null, col: t.cols ? h.x : null, t: 3 };
    emit(s, 'cannonWarn', b.x, b.y);
  }
}

// Called from the trigger step: a boulder resting on a gear socket jams it.
export function gearJams(s) {
  const b = s.boss;
  if (!b || !b.alive || b.t !== 'rakta') return;
  for (const [k, m] of Object.entries(s.meta)) {
    if (!m.gear) continue;
    const i = +k;
    const o = s.obj[i];
    if (o && (o.t === 'boulder' || o.t === 'stone')) {
      s.obj[i] = null;
      emit(s, 'jam', i % s.w, Math.floor(i / s.w));
      bossDamage(s, 'gear');
      if (!b.alive) return;
    }
  }
}

// ---------- The Obsidian Hand leader (Vault) ----------
// Copies the hero's steps mirrored (phases 1-2), then gives chase.

function hand(s, b) {
  const h = s.hero;
  const name = ENEMY_NAMES.hand;
  if (b.stun > 0) {
    b.stun--;
    return;
  }
  if (b.phase < 3) {
    if (s.heroMoved) bossStep(s, b, MIRROR_DIR[s.heroMoved], name);
    return;
  }
  if (s.tick % 3 === 0) return;
  const d = pathStep(s, { x: b.x, y: b.y, t: 'hand' }, h.x, h.y);
  if (d) bossStep(s, b, d, name);
}

export { heroAt };
