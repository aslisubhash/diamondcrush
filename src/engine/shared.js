// Helpers shared by the rules, enemies and bosses.
import {
  DIRS, HERO_FLOORS, OBJECT_FLOORS, ENEMY_FLOORS, FILLABLE, FALLERS, HEAVY,
} from './constants.js';

export const idx = (s, x, y) => y * s.w + x;
export const inb = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const xy = (s, i) => [i % s.w, Math.floor(i / s.w)];

export function emit(s, type, x, y, extra) {
  s.events.push({ type, x, y, ...extra });
}

export const enemyAt = (s, x, y) => s.enemies.find((e) => e.alive && e.x === x && e.y === y) || null;
export const heroAt = (s, x, y) => s.hero.x === x && s.hero.y === y;
export const partnerAt = (s, x, y) => !!s.partner && s.partner.x === x && s.partner.y === y;
// Either explorer's body (the tag-team partner stands still but is solid).
export const bodyAt = (s, x, y) => heroAt(s, x, y) || partnerAt(s, x, y);
export const bossAt = (s, x, y) => !!s.boss && s.boss.alive && s.boss.t !== 'naga' && s.boss.x === x && s.boss.y === y;

export function exitOpen(s) {
  return s.gems >= s.quota && (!s.boss || !s.boss.alive);
}

// Gates and bridges open with their channel (or its inverse); something
// standing in them holds them open.
export function gateOpen(s, i) {
  const m = s.meta[i];
  if (!m) return false;
  if (m.held) return true;
  const on = !!s.chan[m.ch];
  return m.inv ? !on : on;
}

// Stepwell tiles hold water while their channel is on (or off, when inverted).
export function wellWet(s, i) {
  const m = s.meta[i];
  if (!m) return false;
  if (m.held) return false;
  const on = !!s.chan[m.ch];
  return m.inv ? !on : on;
}

// Resolve the effective floor for movement rules.
export function effFloor(s, i) {
  const f = s.floor[i];
  if (f === 'gate' || f === 'bridge') return gateOpen(s, i) ? 'floor' : 'closed';
  if (f === 'well') return wellWet(s, i) ? 'water' : 'floor';
  if (f === 'collapse') return s.meta[i].down ? 'pit' : 'floor';
  return f;
}

export function heroCanEnter(s, i) {
  const f = effFloor(s, i);
  if (!HERO_FLOORS.has(f)) return false;
  if (f === 'exit' && !exitOpen(s)) return false;
  return true;
}

export function objectCanEnter(s, x, y, o) {
  if (!inb(s, x, y)) return false;
  const i = idx(s, x, y);
  const f = effFloor(s, i);
  if (!OBJECT_FLOORS.has(f)) return false;
  if (s.obj[i] || bodyAt(s, x, y) || enemyAt(s, x, y) || bossAt(s, x, y)) return false;
  // Only heavy objects sink into pits and water; gems stop at the edge.
  if (FILLABLE.has(f) && !HEAVY.has(o.t)) return false;
  if (f === 'lair' && !FALLERS.has(o.t) && !HEAVY.has(o.t)) return false;
  return true;
}

export function enemyCanEnter(s, x, y, e) {
  if (!inb(s, x, y)) return false;
  const i = idx(s, x, y);
  const f = effFloor(s, i);
  // Ice spirits only drift over water and ice.
  if (e && e.t === 'spirit') {
    if (f !== 'water' && f !== 'ice') return false;
  } else if (!ENEMY_FLOORS.has(f)) return false;
  if (s.obj[i] || enemyAt(s, x, y) || partnerAt(s, x, y) || bossAt(s, x, y)) return false;
  return true;
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

export function killEnemy(s, e, by) {
  e.alive = false;
  s.kills++;
  s.coins += 5;
  emit(s, 'kill', e.x, e.y, { enemy: e.t, by });
  if (e.t === 'monkey' && e.carrying) {
    e.carrying = false;
    returnStolen(s, e);
  }
}

export function returnStolen(s, e) {
  s.gems++;
  s.hero.stolen = Math.max(0, s.hero.stolen - 1);
  emit(s, 'gemBack', e.x, e.y);
}

// Straight line of sight between two cells in a row or column, through
// cells enemies can see across (no walls, objects or closed gates).
export function lineOfSight(s, x0, y0, x1, y1, max = 99) {
  if (x0 !== x1 && y0 !== y1) return null;
  const dist = Math.abs(x1 - x0) + Math.abs(y1 - y0);
  if (dist === 0 || dist > max) return null;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  for (let k = 1; k < dist; k++) {
    const x = x0 + dx * k;
    const y = y0 + dy * k;
    const i = idx(s, x, y);
    const f = effFloor(s, i);
    if (!ENEMY_FLOORS.has(f) && f !== 'water' && f !== 'pit') return null;
    if (s.obj[i] || partnerAt(s, x, y)) return null;
  }
  return dx < 0 ? 'L' : dx > 0 ? 'R' : dy < 0 ? 'U' : 'D';
}

export function dirTo(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const h = dx < 0 ? 'L' : 'R';
  const v = dy < 0 ? 'U' : 'D';
  if (Math.abs(dx) >= Math.abs(dy)) return dx === 0 ? null : [h, dy ? v : null];
  return [v, dx ? h : null];
}

export function step(x, y, dir) {
  const [dx, dy] = DIRS[dir];
  return [x + dx, y + dy];
}
