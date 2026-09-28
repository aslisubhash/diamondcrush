// Rules from GDD section 3, pinned down on tiny rooms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, act, cloneState, predictFalls } from '../src/engine/sim.js';
import { playMoves } from '../src/engine/replay.js';
import { toAscii } from '../src/engine/ascii.js';

const room = (map, extra = {}) => ({ id: 't', name: 't', par: 99, quota: 0, map, ...extra });
const at = (s, x, y) => s.obj[y * s.w + x];
const run = (s, moves) => playMoves(s, moves, { strict: false });

test('a rock resting on earth stays put', () => {
  const s = createState(room(['WWWWW', 'WHB.W', 'WWEWW', 'WWWWW']));
  run(s, '....');
  assert.equal(at(s, 2, 1).t, 'boulder');
});

test('standing under a rock is safe; it wobbles one tick after you leave, then falls', () => {
  const s = createState(room([
    'WWWWW',
    'W.B.W',
    'WHE.W',
    'W...W',
    'WWWWW',
  ]));
  run(s, 'R');
  assert.deepEqual([s.hero.x, s.hero.y], [2, 2]);
  run(s, '...');
  assert.equal(s.hurts, 0, 'resting on the hero does not hurt');
  assert.equal(at(s, 2, 1).st, 'rest');
  run(s, 'R');
  assert.equal(at(s, 2, 1).st, 'wobble', 'pre-fall wobble');
  run(s, '.');
  assert.equal(at(s, 2, 2).t, 'boulder', 'then falls one cell per tick');
  run(s, '.');
  assert.equal(at(s, 2, 3).t, 'boulder');
});

test('a falling rock landing on the hero is fatal on Classic', () => {
  const s = createState(room([
    'WWWWW',
    'W.B.W',
    'W.E.W',
    'WH..W',
    'WWWWW',
  ]));
  // Dig out the support from below-left, then step under the falling rock.
  run(s, 'U R');
  assert.deepEqual([s.hero.x, s.hero.y], [2, 2]);
  run(s, 'D L');
  run(s, 'R');
  run(s, '...');
  assert.equal(s.hurts, 1, toAscii(s));
  assert.equal(s.hero.hearts, 0);
  assert.equal(s.status, 'dead');
  assert.match(s.lastHurt, /Crushed/);
});

test('rocks cannot be pushed upward', () => {
  const s = createState(room([
    'WWWWW',
    'W...W',
    'W.B.W',
    'W.H.W',
    'WWWWW',
  ]));
  run(s, 'U U');
  assert.deepEqual([s.hero.x, s.hero.y], [2, 3]);
  assert.equal(s.obj[2 * 5 + 2].t, 'boulder');
});

test('Relic Hunter crushes cost two hearts; Purist has no wobble warning', () => {
  const map = ['WWWWW', 'W.B.W', 'WHE.W', 'W...W', 'WWWWW'];
  const hard = createState(room(map), { difficulty: 'hunter' });
  assert.equal(hard.rules.crush, 2);
  const pure = createState(room(map), { difficulty: 'purist' });
  run(pure, 'R R');
  assert.equal(at(pure, 2, 2).t, 'boulder', 'falls immediately without wobbling');
});

test('rolling stones roll left first, then right', () => {
  const left = createState(room(['WWWWW', 'W.R.W', 'W.B.W', 'W.W.W', 'W...W', 'WH..W', 'WWWWW']));
  run(left, '..');
  assert.equal(at(left, 1, 1)?.t ?? at(left, 1, 2)?.t, 'stone');
  const right = createState(room(['WWWWW', 'WWR.W', 'WWB.W', 'W.W.W', 'W...W', 'WH..W', 'WWWWW']));
  run(right, '..');
  assert.equal(at(right, 3, 1)?.t ?? at(right, 3, 2)?.t, 'stone');
});

test('boulders need a lean before the push; stones and crates push at once', () => {
  const s = createState(room(['WWWWWW', 'WHB..W', 'WWWWWW']));
  run(s, 'R');
  assert.equal(at(s, 2, 1).t, 'boulder', 'lean only');
  assert.deepEqual([s.hero.x, s.hero.y], [1, 1]);
  run(s, 'R');
  assert.equal(at(s, 3, 1).t, 'boulder');
  assert.deepEqual([s.hero.x, s.hero.y], [2, 1]);
  const c = createState(room(['WWWWWW', 'WHR..W', 'WWWWWW']));
  run(c, 'R');
  assert.equal(at(c, 3, 1).t, 'stone');
});

test('rocks pushed into pits fill them and become floor', () => {
  const s = createState(room(['WWWWWW', 'WHBO.W', 'WWWWWW']));
  run(s, 'RR');
  assert.equal(s.floor[1 * s.w + 3], 'filled');
  assert.equal(at(s, 3, 1), null);
  run(s, 'RR');
  assert.deepEqual([s.hero.x, s.hero.y], [4, 1]);
});

test('keys open doors of the same colour only', () => {
  const s = createState(room(['WWWWWWW', 'WHK.D.W', 'WWWWWWW']));
  run(s, 'RRR');
  assert.equal(s.hero.x, 4, 'walks into the opened doorway');
  assert.equal(s.floor[1 * s.w + 4], 'floor');
  const locked = createState(room(['WWWWW', 'WH.DW', 'WWWWW']));
  assert.equal(act(locked, { type: 'move', dir: 'R' }), true);
  assert.equal(act(locked, { type: 'move', dir: 'R' }), false);
});

test('a boulder on a pressure plate holds its gate open', () => {
  const s = createState(room(['WWWWWWW', 'WHBp.gW', 'WWWWWWW'], {
    legend: { p: { floor: 'plate', meta: { ch: 'a' } }, g: { floor: 'gate', meta: { ch: 'a' } } },
  }));
  assert.equal(s.chan.a, false);
  run(s, 'RR');
  run(s, '.');
  assert.equal(s.chan.a, true);
});

test('spikes only hurt when fully up, and warn one tick first', () => {
  const s = createState(room(['WWWWW', 'WH^.W', 'WWWWW']));
  const phases = [];
  run(s, 'R');
  for (let i = 0; i < 4; i++) {
    phases.push(s.meta[1 * s.w + 2].ph);
    run(s, '.');
  }
  assert.ok(phases.includes('warn') && phases.includes('up'));
  assert.ok(s.hurts >= 1);
});

test('falling rocks crush snakes', () => {
  const s = createState(room([
    'WWWWWWW',
    'WH.B..W',
    'WWWC.WW',
    'W..S..W',
    'WWWWWWW',
  ]), { tools: ['hammer'] });
  run(s, 'R');
  // Stand beside the cracked support and smash it.
  run(s, 'R');
  s.hero.x = 4; s.hero.y = 2; s.hero.dir = 'L';
  s.enemies[0].x = 3; s.enemies[0].dir = 'R';
  act(s, { type: 'tool' });
  const snake = s.enemies[0];
  for (let i = 0; i < 4 && snake.alive; i++) {
    snake.x = 3;
    act(s, null);
  }
  assert.equal(snake.alive, false);
  assert.equal(s.kills, 1);
});

test('the same moves always give the same result (determinism)', () => {
  const lvl = room(['WWWWWWW', 'WH.EB.W', 'WEEGEEW', 'W.S...W', 'WWWWWWW']);
  const a = createState(lvl);
  const b = createState(lvl);
  const moves = 'RR..D.LL..R.RD..';
  run(a, moves);
  run(b, moves);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('rock-fall preview predicts where loose rocks land without touching the state', () => {
  const s = createState(room(['WWWWW', 'W.B.W', 'W...W', 'W...W', 'WH..W', 'WWWWW']));
  const before = JSON.stringify(s);
  const p = predictFalls(s);
  assert.equal(JSON.stringify(s), before);
  assert.equal(p.length, 1);
  assert.equal(p[0].to, 4 * s.w + 2);
  const c = cloneState(s);
  run(c, '......');
  assert.equal(at(c, 2, 4).t, 'boulder');
});

test('stone monkeys steal a gem and give it back when cornered', () => {
  const s = createState(room(['WWWWWWWW', 'WHG..M.W', 'WWWWWWWW']));
  run(s, 'R');
  assert.equal(s.gems, 1);
  run(s, 'R.');
  assert.equal(s.gems, 0, 'stolen');
  run(s, 'R.R.R..');
  assert.equal(s.gems, 1, 'recovered once cornered');
});
