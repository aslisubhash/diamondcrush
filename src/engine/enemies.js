// Enemy behaviours (GDD 4.1). Every enemy follows a simple, visible
// pattern so encounters are puzzles rather than reflex tests.
import { DIRS, OPPOSITE, CLOCKWISE, MIRROR_DIR } from './constants.js';
import {
  idx, inb, emit, heroAt, bodyAt, enemyCanEnter, hurt, killEnemy, returnStolen, lineOfSight, effFloor,
} from './shared.js';
import { ENEMY_NAMES } from './constants.js';

export function enemiesAct(s) {
  const frozen = s.freezeUntil && s.tick <= s.freezeUntil;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (frozen && e.t !== 'echo') continue;
    const fn = ACTS[e.t];
    if (fn) fn(s, e);
    if (s.status !== 'play') return;
  }
}

// Step towards dir: attacks a body in the way (the active hero, or the
// tag-team partner, which shares hearts), else moves if the cell is free.
function tryStep(s, e, dir, { harmless = false } = {}) {
  const [dx, dy] = DIRS[dir];
  const nx = e.x + dx;
  const ny = e.y + dy;
  if (bodyAt(s, nx, ny)) {
    e.dir = dir;
    if (harmless) return false;
    hurt(s, 1, `${VERBS[e.t] || 'Attacked'} by ${ENEMY_NAMES[e.t]}`);
    emit(s, 'attack', nx, ny, { enemy: e.t });
    return 'attack';
  }
  if (!enemyCanEnter(s, nx, ny, e)) return false;
  e.x = nx;
  e.y = ny;
  e.dir = dir;
  if (e.t === 'spirit') freezeUnder(s, e);
  return true;
}

// Back-and-forth patrol along the current direction, turning at walls.
function patrol(s, e) {
  const r = tryStep(s, e, e.dir);
  if (r === false) {
    e.dir = OPPOSITE[e.dir];
    emit(s, 'turn', e.x, e.y);
  }
}

// Candidate directions towards a target, best first.
function towards(e, tx, ty) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const h = dx < 0 ? 'L' : 'R';
  const v = dy < 0 ? 'U' : 'D';
  const out = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx) out.push(h);
    if (dy) out.push(v);
  } else {
    if (dy) out.push(v);
    if (dx) out.push(h);
  }
  return out;
}

function chase(s, e, tx, ty) {
  for (const d of towards(e, tx, ty)) {
    const r = tryStep(s, e, d);
    if (r) return r;
  }
  return false;
}

// Back and forth on a line, turning at walls. Every other tick.
function snake(s, e) {
  if (s.tick % 2) return;
  patrol(s, e);
}

// Follows the wall on its left. Every other tick.
function scarab(s, e) {
  if (s.tick % 2 === 0) return;
  const c = CLOCKWISE.indexOf(e.dir);
  const order = [CLOCKWISE[(c + 3) % 4], e.dir, CLOCKWISE[(c + 1) % 4], CLOCKWISE[(c + 2) % 4]];
  for (const d of order) if (tryStep(s, e, d)) return;
}

// Wanders its line; steals a gem when next to the hero, then flees.
function monkey(s, e) {
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
    if (heroAt(s, e.x + dx, e.y + dy) || !enemyCanEnter(s, e.x + dx, e.y + dy, e)) {
      e.dir = OPPOSITE[e.dir];
      return;
    }
    e.x += dx;
    e.y += dy;
    return;
  }
  monkeyFlee(s, e, dist);
}

function monkeyFlee(s, e, dist, canYield = true) {
  let best = null;
  let bestD = dist(e.x, e.y);
  for (const d of ['L', 'U', 'R', 'D']) {
    const [dx, dy] = DIRS[d];
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (!enemyCanEnter(s, nx, ny, e) || heroAt(s, nx, ny)) continue;
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
    e.carrying = false;
    e.calm = true;
    returnStolen(s, e);
  }
}

// Bounces diagonally off walls. Every other tick.
function bat(s, e) {
  if (s.tick % 2) return;
  if (e.dx === undefined) {
    e.dx = 1;
    e.dy = 1;
  }
  const tries = [[e.dx, e.dy], [-e.dx, e.dy], [e.dx, -e.dy], [-e.dx, -e.dy]];
  for (const [dx, dy] of tries) {
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (bodyAt(s, nx, ny)) {
      hurt(s, 1, `Bitten by ${ENEMY_NAMES.bat}`);
      emit(s, 'attack', nx, ny, { enemy: 'bat' });
      e.dx = dx;
      e.dy = dy;
      return;
    }
    if (enemyCanEnter(s, nx, ny, e)) {
      e.x = nx;
      e.y = ny;
      e.dx = dx;
      e.dy = dy;
      e.dir = dx < 0 ? 'L' : 'R';
      return;
    }
  }
}

// Patrols; charges in a straight line at the hero when in sight within 4.
function knight(s, e) {
  const h = s.hero;
  if (!e.charge) {
    // Visors only see along the patrol line.
    const d = lineOfSight(s, e.x, e.y, h.x, h.y, 4);
    const horiz = (x) => x === 'L' || x === 'R';
    if (d && horiz(d) === horiz(e.dir)) {
      e.charge = d;
      e.dir = d;
      emit(s, 'alert', e.x, e.y, { enemy: 'knight' });
      return;
    }
  }
  if (e.charge) {
    const r = tryStep(s, e, e.charge);
    if (r !== true) e.charge = null;
    return;
  }
  if (s.tick % 2) return;
  patrol(s, e);
}

// Chases for up to 3 tiles when close, otherwise scurries on its line.
function rat(s, e) {
  const h = s.hero;
  const d = Math.abs(h.x - e.x) + Math.abs(h.y - e.y);
  if (d <= 3) {
    if (s.tick % 2 === 0 || d <= 1) chase(s, e, h.x, h.y);
    return;
  }
  if (s.tick % 2) return;
  patrol(s, e);
}

// Slides at the hero when lined up, until something stops it.
function yeti(s, e) {
  const h = s.hero;
  if (!e.slide) {
    const d = lineOfSight(s, e.x, e.y, h.x, h.y, 10);
    if (d) {
      e.slide = d;
      e.dir = d;
      emit(s, 'alert', e.x, e.y, { enemy: 'yeti' });
    }
    return;
  }
  const [dx, dy] = DIRS[e.slide];
  const nx = e.x + dx;
  const ny = e.y + dy;
  if (inb(s, nx, ny) && effFloor(s, idx(s, nx, ny)) === 'pit' && !s.obj[idx(s, nx, ny)]) {
    e.x = nx;
    e.y = ny;
    e.alive = false;
    s.kills++;
    s.coins += 5;
    emit(s, 'fallPit', nx, ny, { enemy: 'yeti' });
    return;
  }
  const r = tryStep(s, e, e.slide);
  if (r !== true) e.slide = null;
}

// Drifts back and forth, freezing water it passes. Harmless.
function spirit(s, e) {
  if (s.tick % 2) return;
  const r = tryStep(s, e, e.dir, { harmless: true });
  if (r === false) e.dir = OPPOSITE[e.dir];
}

function freezeUnder(s, e) {
  const i = idx(s, e.x, e.y);
  if (s.floor[i] === 'water') {
    s.floor[i] = 'ice';
    s.meta[i] = { spirit: true };
    emit(s, 'freeze', e.x, e.y);
  }
}

// Stays put and spits venom 3 tiles ahead every 3 ticks (warning first).
function cobra(s, e) {
  const p = (s.tick + (e.offset || 0)) % 3;
  e.warn = p === 1;
  if (p !== 2) return;
  const [dx, dy] = DIRS[e.dir];
  const cells = [];
  for (let k = 1; k <= 3; k++) {
    const x = e.x + dx * k;
    const y = e.y + dy * k;
    if (!inb(s, x, y)) break;
    const i = idx(s, x, y);
    const f = effFloor(s, i);
    if (f === 'wall' || f === 'closed' || f === 'cracked' || f === 'false' || f === 'void' || s.obj[i]) break;
    cells.push(i);
    if (bodyAt(s, x, y)) {
      hurt(s, 1, 'Hit by cobra venom');
      break;
    }
  }
  s.venom.push(...cells);
  emit(s, 'spit', e.x, e.y, { dir: e.dir });
}

// Mirrors the hero's last step (left and right swapped).
function langur(s, e) {
  if (!s.heroMoved) return;
  tryStep(s, e, MIRROR_DIR[s.heroMoved]);
}

// Takes the shortest path to the hero, one step every other tick.
function thug(s, e) {
  if (s.tick % 2) return;
  const d = pathStep(s, e, s.hero.x, s.hero.y);
  if (d) tryStep(s, e, d);
}

// Patrols; sees 4 tiles ahead and hunts the hero unless hidden in grass.
function tiger(s, e) {
  const h = s.hero;
  const hidden = s.floor[idx(s, h.x, h.y)] === 'grass';
  if (e.hunt && hidden) {
    e.hunt = false;
    emit(s, 'lost', e.x, e.y);
  }
  if (!e.hunt && !hidden) {
    const d = lineOfSight(s, e.x, e.y, h.x, h.y, 4);
    if (d && d === e.dir) {
      e.hunt = true;
      emit(s, 'alert', e.x, e.y, { enemy: 'tiger' });
      return;
    }
  }
  if (e.hunt) {
    chase(s, e, h.x, h.y);
    return;
  }
  if (s.tick % 2) return;
  patrol(s, e);
}

// Replays the hero's own steps from a few moves ago. Harmless, but heavy
// enough to hold pressure plates.
function echo(s, e) {
  e.cursor = e.cursor || 0;
  const lag = e.lag || 6;
  if (s.heroLog.length - e.cursor <= lag) return;
  const d = s.heroLog[e.cursor++];
  tryStep(s, e, d, { harmless: true });
}

// Breadth-first first step towards a target through enemy-walkable cells.
export function pathStep(s, e, tx, ty) {
  const start = idx(s, e.x, e.y);
  const goal = idx(s, tx, ty);
  const prev = new Map([[start, null]]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    if (c === goal) break;
    const cx = c % s.w;
    const cy = (c - cx) / s.w;
    for (const d of ['U', 'L', 'R', 'D']) {
      const [dx, dy] = DIRS[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inb(s, nx, ny)) continue;
      const n = idx(s, nx, ny);
      if (prev.has(n)) continue;
      if (n !== goal && !enemyCanEnter(s, nx, ny, e)) continue;
      prev.set(n, [c, d]);
      q.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  let c = goal;
  let first = null;
  while (prev.get(c)) {
    const [p, d] = prev.get(c);
    first = d;
    c = p;
  }
  return first;
}

const VERBS = {
  snake: 'Bitten', scarab: 'Stung', rat: 'Bitten', knight: 'Struck', yeti: 'Mauled',
  langur: 'Swiped', thug: 'Punched', tiger: 'Mauled', monkey: 'Scratched',
};

const ACTS = { snake, scarab, monkey, bat, knight, rat, yeti, spirit, cobra, langur, thug, tiger, echo };

export function crushable(e) {
  return e.t !== 'echo' && e.t !== 'spirit';
}

export { killEnemy };
