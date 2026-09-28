// Turns a level definition (ASCII grid + legend, GDD 9.5) into cell data.

// Default legend. Levels can add or override characters with `legend`.
export const DEFAULT_LEGEND = {
  ' ': { floor: 'void' },
  W: { floor: 'wall' },
  F: { floor: 'false' },
  C: { floor: 'cracked' },
  '.': { floor: 'floor' },
  E: { floor: 'earth' },
  B: { obj: { t: 'boulder' } },
  R: { obj: { t: 'stone' } },
  c: { obj: { t: 'crate' } },
  G: { obj: { t: 'gem' } },
  '*': { obj: { t: 'red' } },
  K: { obj: { t: 'key', color: 'red' } },
  D: { floor: 'door', meta: { color: 'red' } },
  H: { hero: true },
  X: { floor: 'exit' },
  Y: { floor: 'sexit' },
  P: { floor: 'idol', meta: { active: false } },
  O: { floor: 'pit' },
  '~': { floor: 'water' },
  '^': { floor: 'spikes', meta: { period: 4, offset: 0 } },
  _: { floor: 'weak' },
  S: { enemy: { t: 'snake', dir: 'R' } },
  s: { enemy: { t: 'snake', dir: 'D' } },
  A: { enemy: { t: 'scarab', dir: 'U' } },
  M: { enemy: { t: 'monkey', dir: 'L' } },
  h: { obj: { t: 'tool', tool: 'hammer' } },
  f: { obj: { t: 'fruit' } },
  N: { boss: true },
  L: { floor: 'lair' },
  I: { floor: 'ice' },
  '%': { floor: 'grass' },
  '&': { partner: true },
  '(': { floor: 'conv', meta: { dir: 'L' } },
  ')': { floor: 'conv', meta: { dir: 'R' } },
  x: { enemy: { t: 'bat', dir: 'R' } },
  n: { enemy: { t: 'knight', dir: 'R' } },
  r: { enemy: { t: 'rat', dir: 'R' } },
  y: { enemy: { t: 'yeti', dir: 'R' } },
  j: { enemy: { t: 'spirit', dir: 'R' } },
  z: { enemy: { t: 'langur', dir: 'L' } },
  t: { enemy: { t: 'tiger', dir: 'R' } },
  u: { enemy: { t: 'thug', dir: 'L' } },
  e: { enemy: { t: 'echo', dir: 'R' } },
  '=': { floor: 'den' },
};

// Floor laid under a boss marker, per boss type.
const BOSS_FLOOR = { naga: 'lair', frost: 'den' };

export function parseLevel(level) {
  const legend = { ...DEFAULT_LEGEND, ...(level.legend || {}) };
  const rows = level.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const floor = new Array(w * h).fill('void');
  const obj = new Array(w * h).fill(null);
  const meta = {};
  const enemies = [];
  let hero = null;
  let partner = null;
  let boss = null;
  let nextId = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? ' ';
      const def = legend[ch];
      if (!def) throw new Error(`${level.id}: unknown map char '${ch}' at ${x},${y}`);
      const i = y * w + x;
      // Anything that is not an explicit floor sits on plain floor.
      floor[i] = def.floor || 'floor';
      if (def.meta) meta[i] = { ...def.meta };
      if (def.obj) obj[i] = { id: nextId++, st: 'rest', ...def.obj };
      if (def.enemy) enemies.push({ id: nextId++, x, y, alive: true, ...def.enemy });
      if (def.hero) hero = { x, y };
      if (def.partner) partner = { x, y };
      if (def.boss) {
        const t = level.bossType || 'naga';
        boss = { t, x, y };
        floor[i] = BOSS_FLOOR[t] || 'floor';
      }
    }
  }
  if (!hero) throw new Error(`${level.id}: no hero start (H)`);
  const gemsTotal = obj.filter((o) => o && o.t === 'gem').length;
  const redTotal = obj.filter((o) => o && o.t === 'red').length;
  return { w, h, floor, obj, meta, enemies, hero, partner, boss, gemsTotal, redTotal, nextId };
}
