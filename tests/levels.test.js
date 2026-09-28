import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, toolsBefore } from '../src/levels/index.js';
import { createState } from '../src/engine/sim.js';
import { playMoves } from '../src/engine/replay.js';
import { toAscii, summary } from '../src/engine/ascii.js';

for (const level of LEVELS) {
  test(`${level.id} ${level.name}: solution reaches the exit`, () => {
    assert.ok(level.solution, 'level has a solution');
    const s = createState(level, { tools: toolsBefore(level.id) });
    const r = playMoves(s, level.solution);
    const info = `\n${toAscii(s)}\n${summary(s)}\n${r.error || ''}`;
    assert.equal(s.status, 'won', `not won${info}`);
    assert.equal(s.exitKind, 'exit', `wrong exit${info}`);
    assert.ok(s.gems >= s.quota, `quota not met${info}`);
    assert.equal(s.hurts, 0, `solution takes damage${info}`);
    if (level.expect) {
      for (const [k, v] of Object.entries(level.expect)) assert.equal(s[k], v, `${k}${info}`);
    }
  });

  test(`${level.id}: initial map is at rest`, () => {
    const s = createState(level, { tools: toolsBefore(level.id) });
    // Objects riding conveyor belts are allowed to move.
    const still = (st) => st.obj.map((o, i) => (o && st.floor[i] !== 'conv' ? `${o.id}@${i}` : '')).filter(Boolean);
    const before = still(s);
    playMoves(s, '..', { strict: false });
    const moved = s.events.filter((e) => e.type === 'wobble');
    for (const k of before) assert.ok(still(s).includes(k), `object ${k} moved at start\n${toAscii(s)}`);
    assert.equal(moved.length, 0);
  });

  if (level.secretSolution) {
    test(`${level.id}: secret exit is reachable`, () => {
      const s = createState(level, { tools: toolsBefore(level.id) });
      const r = playMoves(s, level.secretSolution);
      assert.equal(s.exitKind, 'secret', `${toAscii(s)}\n${summary(s)}\n${r.error || ''}`);
    });
  }
}
