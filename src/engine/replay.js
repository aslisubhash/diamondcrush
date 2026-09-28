// Solution strings: U D L R = move, T = use tool, < > = cycle tool,
// . = one background tick (wait), u d l r = turn to face a direction
// without stepping (what bumping into a wall does), X = swap explorers.
// Whitespace is ignored.
import { createState, act, cycleTool } from './sim.js';

export function parseMoves(str) {
  return [...str.replace(/\s+/g, '')].map((c) => {
    if ('UDLR'.includes(c)) return { type: 'move', dir: c };
    if ('udlr'.includes(c)) return { type: 'face', dir: c.toUpperCase() };
    if (c === 'T') return { type: 'tool' };
    if (c === 'X') return { type: 'swap' };
    if (c === '.') return null;
    if (c === '<') return { type: 'cycle', step: -1 };
    if (c === '>') return { type: 'cycle', step: 1 };
    throw new Error(`bad move char '${c}'`);
  });
}

// Plays moves on a state. Stops at the first move that does nothing
// (a bump), since in a solution that always means a mistake.
export function playMoves(s, moves, { strict = true, onTick } = {}) {
  const list = typeof moves === 'string' ? parseMoves(moves) : moves;
  for (let n = 0; n < list.length; n++) {
    if (s.status !== 'play') return { ok: s.status === 'won', at: n, state: s };
    const a = list[n];
    if (a && a.type === 'cycle') {
      cycleTool(s, a.step);
      continue;
    }
    if (a && a.type === 'face') {
      s.hero.dir = a.dir;
      continue;
    }
    const ticked = act(s, a);
    if (onTick) onTick(s, n, a);
    if (!ticked && strict) return { ok: false, at: n, state: s, error: `move ${n} (${a ? a.dir || a.type : '.'}) did nothing` };
  }
  return { ok: s.status === 'won', at: list.length, state: s };
}

export function runSolution(level, opts = {}) {
  const s = createState(level, opts);
  return playMoves(s, level.solution, opts);
}
