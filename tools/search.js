// Breadth-first search for a move sequence that reaches a goal, used to
// author timing-heavy solutions (the boss). Avoids any damage.
//   node tools/search.js <levelId> "<prefix moves>" <goal> [maxDepth]
// Goals: bosshit (boss loses 1 hp), win, gems:N
import { LEVELS, toolsBefore } from '../src/levels/index.js';
import { createState, act, cloneState } from '../src/engine/sim.js';
import { playMoves } from '../src/engine/replay.js';
import { toAscii, summary } from '../src/engine/ascii.js';

const [, , id, prefix = '', goal = 'win', maxDepthArg = '30', actionsArg = 'UDLR.'] = process.argv;
const ACTIONS = actionsArg;
const level = LEVELS.find((l) => l.id === id);
const start = createState(level, { tools: toolsBefore(id) });
const r = playMoves(start, prefix);
if (r.error) {
  console.error(r.error);
  process.exit(1);
}
const hp0 = start.boss ? start.boss.hp : 0;
const gems0 = start.gems;
const reached = (s) => {
  if (goal === 'bosshit') return s.boss && s.boss.hp < hp0;
  if (goal === 'win') return s.status === 'won';
  if (goal.startsWith('gems:')) return s.gems >= gems0 + Number(goal.slice(5));
  if (goal.startsWith('at:')) {
    const [gx, gy] = goal.slice(3).split(',').map(Number);
    return s.hero.x === gx && s.hero.y === gy;
  }
  if (goal.startsWith('chan:')) return !!s.chan[goal.slice(5)];
  return false;
};
const key = (s) => JSON.stringify([
  s.hero.x, s.hero.y, s.hero.windup, s.hero.slide, s.tick % 12, s.partner && [s.partner.x, s.partner.y],
  s.hero.tool, s.chan, Object.values(s.meta).map((m) => [m.lit, m.traced, m.on, m.down].join('')).join(),
  s.boss && [s.boss.x, s.boss.y, s.boss.dir, s.boss.hp, s.boss.clock % 132, s.boss.strike, s.boss.sweep, s.boss.stun, s.boss.charge, s.boss.wind, s.boss.breath, s.boss.cannon],
  s.obj.map((o) => (o ? `${o.t}${o.st[0]}${o.slide || ''}${o.o || ''}` : '')).join(),
  s.floor.map((f) => (f === 'earth' ? 1 : 0)).join(''),
  s.enemies.map((e) => [e.x, e.y, e.dir, e.alive]),
]);
const seen = new Set([key(start)]);
let frontier = [{ s: start, path: '' }];
const maxDepth = Number(maxDepthArg);
for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
  const next = [];
  for (const { s, path } of frontier) {
    for (const c of ACTIONS) {
      const n = cloneState(s);
      const hurts = n.hurts;
      const a = c === '.' ? null : c === 'T' ? { type: 'tool' } : c === 'X' ? { type: 'swap' } : { type: 'move', dir: c };
      if (!act(n, a)) continue;
      if (n.hurts > hurts || n.status === 'dead') continue;
      if (reached(n)) {
        console.log(toAscii(n));
        console.log(summary(n));
        console.log(`found (${path.length + 1}): ${path + c}`);
        console.log(`full: ${prefix}${path}${c}`);
        process.exit(0);
      }
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      next.push({ s: n, path: path + c });
    }
  }
  frontier = next;
  if (seen.size > 3e6) break;
}
console.error(`not found (explored ${seen.size})`);
process.exit(2);
