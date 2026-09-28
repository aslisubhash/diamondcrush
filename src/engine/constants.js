// Shared rule constants for the simulation (GDD sections 3 and 4).

export const DIRS = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
};
export const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L' };
// Clockwise order, used by wall-following enemies.
export const CLOCKWISE = ['U', 'R', 'D', 'L'];

export const STEP_MS = 150; // one tile step (and hold-to-walk repeat)
export const HOLD_DELAY_MS = 200; // delay before hold-to-walk kicks in
export const BG_TICK_MS = 400; // background world clock

// Floor types the hero may stand on.
export const HERO_FLOORS = new Set([
  'floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'exit', 'sexit', 'gate', 'false',
]);
// Floor types an object (boulder, gem...) may move into. Pits and water are
// consumed ("filled") by heavy objects.
export const OBJECT_FLOORS = new Set([
  'floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'gate', 'pit', 'water', 'lair',
]);
export const FILLABLE = new Set(['pit', 'water']);
// Floor types enemies may walk on.
export const ENEMY_FLOORS = new Set(['floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'gate']);
// Floor types that block like a wall for everyone.
export const SOLID_FLOORS = new Set(['wall', 'false', 'cracked', 'void']);

// Objects that fall under gravity (3.3 rule 1).
export const FALLERS = new Set(['boulder', 'stone', 'gem']);
// Objects a rolling stone rolls off (3.2 / 3.3 rule 6).
export const ROUND = new Set(['boulder', 'stone', 'gem']);
// Objects the hero can push.
export const PUSHABLE = new Set(['boulder', 'stone', 'crate']);
// Heavy objects that fill pits and water when they enter them.
export const HEAVY = new Set(['boulder', 'stone', 'crate']);
// Picked up by walking into them.
export const COLLECTIBLE = new Set(['gem', 'red', 'key', 'tool', 'fruit']);

export const KEY_COLORS = ['red', 'gold', 'green', 'violet'];
// Colour-blind safety: every key colour also has a shape (7.4).
export const KEY_SHAPES = { red: 'circle', gold: 'triangle', green: 'square', violet: 'star' };

export const DIFFICULTIES = {
  explorer: { label: 'Explorer', hearts: 5, rewind: Infinity, crush: 1, wobble: true, bgScale: 1.25, hint: 'Casual: 5 hearts, unlimited rewind, slower hazards' },
  classic: { label: 'Classic', hearts: 3, rewind: 10, crush: 1, wobble: true, bgScale: 1, hint: 'The original feel: 3 hearts, 10 rewinds' },
  hunter: { label: 'Relic Hunter', hearts: 2, rewind: 3, crush: 2, wobble: true, bgScale: 0.85, hint: 'Hard: 2 hearts, crushes cost 2, faster hazards' },
  purist: { label: 'Purist', hearts: 3, rewind: 0, crush: 1, wobble: false, bgScale: 1, hint: 'No rewind, no wobble warning, no clues' },
};

export const ENEMY_NAMES = {
  snake: 'a temple snake',
  scarab: 'a scarab swarm',
  monkey: 'a stone monkey',
  naga: 'the Naga Warden',
};

export const OBJECT_NAMES = {
  boulder: 'a falling boulder',
  stone: 'a rolling stone',
  gem: 'a falling gem',
};
