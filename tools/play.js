// Level authoring CLI.
//   node tools/play.js <levelId> "<moves>" [--trace] [--tools=hammer,grapple]
// Moves use the solution alphabet (U D L R T . < >) plus "@x,y" which
// walks to a cell by breadth-first search over simulated steps, avoiding
// damage. Prints the board, stats and the compiled move string.
import { LEVELS, toolsBefore } from '../src/levels/index.js';
import { createState, act, cloneState, cycleTool } from '../src/engine/sim.js';
import { parseMoves } from '../src/engine/replay.js';
import { toAscii, summary } from '../src/engine/ascii.js';

const [, , id, movesArg = '', ...flags] = process.argv;
const level = LEVELS.find((l) => l.id === id);
if (!level) {
  console.error(`unknown level ${id}. Levels: ${LEVELS.map((l) => l.id).join(' ')}`);
  process.exit(1);
}
const trace = flags.includes('--trace');
const toolsFlag = flags.find((f) => f.startsWith('--tools='));
const tools = toolsFlag ? toolsFlag.slice(8).split(',') : toolsBefore(id);
const s = createState(level, { tools, difficulty: 'classic' });

function goto(st, tx, ty) {
  const key = (q) => `${q.hero.x},${q.hero.y},${q.tick % 12},${q.hero.windup ? q.hero.windup.dir : ''},${q.obj.map((o) => (o ? o.id : '')).join()},${q.enemies.map((e) => `${e.x}.${e.y}.${e.dir}`).join()}`;
  const seen = new Set([key(st)]);
  let frontier = [{ st, path: '' }];
  for (let depth = 0; depth < 60 && frontier.length && seen.size < 200000; depth++) {
    const next = [];
    for (const { st: cur, path } of frontier) {
      for (const d of 'UDLR.') {
        const c = cloneState(cur);
        const before = c.hurts;
        if (!act(c, d === '.' ? null : { type: 'move', dir: d })) continue;
        if (c.hurts > before || c.status === 'dead') continue;
        if (c.hero.x === tx && c.hero.y === ty) return path + d;
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ st: c, path: path + d });
      }
    }
    frontier = next;
  }
  return null;
}

let compiled = '';
const tokens = movesArg.match(/@\d+,\d+|[UDLRudlrT.<>]/g) || [];
for (const tok of tokens) {
  let seq = tok;
  if (tok.startsWith('@')) {
    const [tx, ty] = tok.slice(1).split(',').map(Number);
    seq = goto(s, tx, ty);
    if (seq == null) {
      console.log(toAscii(s));
      console.log(summary(s));
      const left = [];
      s.obj.forEach((o, i) => { if (o && (o.t === 'gem' || o.t === 'red')) left.push(`${i % s.w},${Math.floor(i / s.w)}`); });
      console.error(`no safe path to ${tx},${ty}; remaining: ${left.join(' ')}`);
      console.log(`compiled so far: ${compiled}`);
      process.exit(2);
    }
  }
  for (const a of parseMoves(seq)) {
    if (a && a.type === 'cycle') {
      cycleTool(s, a.step);
      compiled += a.step < 0 ? '<' : '>';
      continue;
    }
    if (a && a.type === 'face') {
      s.hero.dir = a.dir;
      compiled += a.dir.toLowerCase();
      continue;
    }
    const ok = act(s, a);
    const ch = a ? (a.dir || 'T') : '.';
    if (!ok) {
      console.log(toAscii(s));
      console.log(summary(s));
      console.error(`move '${ch}' did nothing after: ${compiled}`);
      process.exit(3);
    }
    compiled += ch;
    if (trace) {
      console.log(`-- ${ch} ${s.events.map((e) => e.type).join(',')}`);
      console.log(toAscii(s));
    }
    if (s.status !== 'play') break;
  }
  if (s.status !== 'play') break;
}
console.log(toAscii(s));
console.log(summary(s));
const left = [];
s.obj.forEach((o, i) => { if (o && (o.t === 'gem' || o.t === 'red')) left.push(`${o.t === 'red' ? '*' : ''}${i % s.w},${Math.floor(i / s.w)}`); });
console.log(`remaining: ${left.join(' ')}`);
console.log(`moves (${compiled.length}): ${compiled}`);
