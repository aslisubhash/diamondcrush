// Greedy solution finder: repeatedly breadth-first searches for the next
// gem (or other sub-goal) without taking damage, then for the exit.
//   node tools/autosolve.js <levelId> "<prefix>" [steps] [actions]
// steps: comma list of goals, default "gems*,win" where gems* means
// "keep collecting gems while one can be reached". Goals: gem, red,
// win, at:x,y, chan:x, bosshit, gems*.
import { LEVELS, toolsBefore } from '../src/levels/index.js';
import { createState, act, cloneState, cycleTool } from '../src/engine/sim.js';
import { playMoves } from '../src/engine/replay.js';
import { toAscii, summary } from '../src/engine/ascii.js';

const [, , id, prefix = '', stepsArg = 'gems*,red,win', actions = 'UDLR.T', depthArg = '26'] = process.argv;
const level = LEVELS.find((l) => l.id === id);
const MAX = Number(depthArg);

function keyOf(s) {
  return JSON.stringify([
    s.hero.x, s.hero.y, s.hero.dir, s.hero.windup, s.hero.slide, s.hero.tool, s.tick % 12,
    s.partner && [s.partner.x, s.partner.y],
    s.chan, Object.values(s.meta).map((m) => `${m.lit ? 1 : 0}${m.traced ? 1 : 0}${m.on ? 1 : 0}${m.down ? 1 : 0}`).join(''),
    s.boss && [s.boss.x, s.boss.y, s.boss.dir, s.boss.hp, s.boss.clock % 60, s.boss.stun, s.boss.charge, s.boss.wind, s.boss.breath, s.boss.cannon, s.boss.strike, s.boss.sweep],
    s.obj.map((o) => (o ? `${o.t}${o.st[0]}${o.slide || ''}${o.o || ''}` : '')).join(),
    s.floor.map((f) => f[0]).join(''),
    s.enemies.map((e) => [e.x, e.y, e.dir, e.alive, e.charge, e.slide, e.hunt, e.carrying]),
    s.gems, s.red,
  ]);
}

function search(start, goal) {
  const seen = new Set([keyOf(start)]);
  let frontier = [{ s: start, path: '' }];
  for (let d = 0; d < MAX && frontier.length; d++) {
    const next = [];
    for (const { s, path } of frontier) {
      for (const c of actions) {
        const n = cloneState(s);
        const hurts = n.hurts;
        if (c === '<' || c === '>') {
          if (!cycleTool(n, c === '<' ? -1 : 1)) continue;
        } else if ('udlr'.includes(c)) {
          if (n.hero.dir === c.toUpperCase()) continue;
          n.hero.dir = c.toUpperCase();
        } else {
          const a = c === '.' ? null : c === 'T' ? { type: 'tool' } : c === 'X' ? { type: 'swap' } : { type: 'move', dir: c };
          if (!act(n, a)) continue;
        }
        if (n.hurts > hurts || n.status === 'dead') continue;
        if (n.status === 'won' && goal(n) !== true) continue;
        if (goal(n)) return { s: n, path: path + c };
        const k = keyOf(n);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: n, path: path + c });
      }
    }
    frontier = next;
    if (seen.size > 1500000) break;
  }
  return null;
}

let s = createState(level, { tools: toolsBefore(id) });
const r = playMoves(s, prefix);
if (r.error) {
  console.error(r.error);
  process.exit(1);
}
let sol = prefix;
for (const step of stepsArg.split(',')) {
  const make = (g) => {
    if (g === 'gem') { const n0 = s.gems; return (q) => q.gems > n0; }
    if (g === 'red') { const n0 = s.red; return (q) => q.red > n0; }
    if (g === 'win') return (q) => q.status === 'won' && q.exitKind === 'exit';
    if (g === 'secret') return (q) => q.status === 'won' && q.exitKind === 'secret';
    if (g === 'kill') { const k0 = s.kills; return (q) => q.kills > k0; }
    if (g === 'bosshit') { const hp = s.boss.hp; return (q) => q.boss.hp < hp; }
    if (g.startsWith('at:')) { const [x, y] = g.slice(3).split('_').map(Number); return (q) => q.hero.x === x && q.hero.y === y; }
    if (g.startsWith('chan:')) { const c = g.slice(5); return (q) => !!q.chan[c]; }
    throw new Error(`bad goal ${g}`);
  };
  if (step === 'gems*' || step === 'bosshit*') {
    const g = step === 'gems*' ? 'gem' : 'bosshit';
    for (;;) {
      if (g === 'bosshit' && (!s.boss.alive)) break;
      const f = search(s, make(g));
      if (!f) break;
      s = f.s;
      sol += f.path;
      console.error(`${g}: +${f.path.length} (${s.gems} gems${s.boss ? `, boss ${s.boss.hp}` : ''})`);
    }
    continue;
  }
  const f = search(s, make(step));
  if (!f) {
    console.log(toAscii(s));
    console.log(summary(s));
    console.log(`STUCK at goal ${step}. so far: ${sol}`);
    process.exit(2);
  }
  s = f.s;
  sol += f.path;
  console.error(`${step}: +${f.path.length}`);
}
console.log(toAscii(s));
console.log(summary(s));
console.log(`moves ${sol.length}: ${sol}`);
