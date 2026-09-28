// Shared rule constants for the simulation (GDD sections 3 and 4).

export const DIRS = {
  U: [0, -1],
  D: [0, 1],
  L: [-1, 0],
  R: [1, 0],
};
export const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L' };
// Clockwise order, used by wall-following enemies and rotating lamps.
export const CLOCKWISE = ['U', 'R', 'D', 'L'];
// Horizontal mirror, used by langurs and the Obsidian Hand leader.
export const MIRROR_DIR = { U: 'U', D: 'D', L: 'R', R: 'L' };

export const STEP_MS = 150; // one tile step (and hold-to-walk repeat)
export const HOLD_DELAY_MS = 200; // delay before hold-to-walk kicks in
export const BG_TICK_MS = 400; // background world clock

// Walkable ground shared by everyone.
const GROUND = ['floor', 'filled', 'spikes', 'plate', 'weak', 'idol', 'ice', 'conv', 'wind', 'blade', 'grass', 'kolam', 'switch'];

// Floor types the hero may stand on (gates, bridges, wells and collapsing
// floors are resolved to 'floor' or something solid first).
export const HERO_FLOORS = new Set([...GROUND, 'exit', 'sexit', 'false']);
// Floor types an object (boulder, gem...) may move into. Pits and water are
// consumed ("filled") by heavy objects.
export const OBJECT_FLOORS = new Set([...GROUND, 'pit', 'water', 'lair']);
export const FILLABLE = new Set(['pit', 'water']);
// Floor types enemies may walk on.
export const ENEMY_FLOORS = new Set(GROUND);

// Objects that fall under gravity (3.3 rule 1). Snow is avalanche debris.
export const FALLERS = new Set(['boulder', 'stone', 'gem', 'snow']);
// Objects a rolling stone rolls off (3.2 / 3.3 rule 6).
export const ROUND = new Set(['boulder', 'stone', 'gem']);
// Objects the hero can push.
export const PUSHABLE = new Set(['boulder', 'stone', 'crate', 'mirror', 'heart']);
// Heavy objects that fill pits and water when they enter them.
export const HEAVY = new Set(['boulder', 'stone', 'crate']);
// Picked up by walking into them.
export const COLLECTIBLE = new Set(['gem', 'red', 'key', 'tool', 'fruit']);

export const KEY_COLORS = ['red', 'gold', 'green', 'violet'];
// Colour-blind safety: every key colour also has a shape (7.4).
export const KEY_SHAPES = { red: 'circle', gold: 'triangle', green: 'square', violet: 'star' };

export const TOOLS = {
  hammer: { name: 'Hammer', hint: 'Face a cracked wall or boulder and use it to smash' },
  grapple: { name: 'Grapple hook', hint: 'Face a boulder or crate to pull it one tile towards you' },
  torch: { name: 'Fire torch', hint: 'Light braziers and burn crates in front of you' },
  frost: { name: 'Frost charm', hint: 'Freeze the water in front of you for 10 beats' },
  gauntlet: { name: 'Power gauntlet', hint: 'Push two boulders at once, with no lean needed' },
  mirror: { name: 'Sun mirror', hint: 'Turn the mirror in front of you a quarter turn' },
  bell: { name: 'Nandi bell', hint: 'Freeze every enemy for 3 beats. 3 rings per checkpoint' },
  disc: { name: 'Chakra disc', hint: 'Throw it straight ahead to flip switches and levers at range' },
};

export const DIFFICULTIES = {
  explorer: { label: 'Explorer', hearts: 5, rewind: Infinity, crush: 1, rockCrush: 2, wobble: true, bgScale: 1.25, hint: 'Casual: 5 hearts, unlimited rewind; a falling rock costs 2 hearts' },
  classic: { label: 'Classic', hearts: 3, rewind: 10, crush: 1, rockCrush: 'fatal', wobble: true, bgScale: 1, hint: 'The original feel: 3 hearts, 10 rewinds; falling rocks are fatal' },
  hunter: { label: 'Relic Hunter', hearts: 2, rewind: 3, crush: 2, rockCrush: 'fatal', wobble: true, bgScale: 0.85, hint: 'Hard: 2 hearts, crushes cost 2, faster hazards' },
  purist: { label: 'Purist', hearts: 3, rewind: 0, crush: 1, rockCrush: 'fatal', wobble: false, bgScale: 1, hint: 'No rewind, no wobble warning, no clues' },
};

export const ENEMY_NAMES = {
  snake: 'a temple snake',
  scarab: 'a scarab swarm',
  monkey: 'a stone monkey',
  bat: 'a belfry bat',
  knight: 'an armour knight',
  rat: 'a cellar rat',
  yeti: 'a yeti cub',
  spirit: 'an ice spirit',
  cobra: 'a cobra',
  langur: 'a langur',
  thug: 'an Obsidian Hand thug',
  tiger: 'a tiger',
  echo: 'your echo',
  naga: 'the Naga Warden',
  baron: 'the Iron Baron',
  frost: 'Frostfang',
  rakta: 'Rakta Yantra',
  hand: 'the Obsidian Hand leader',
};

export const OBJECT_NAMES = {
  boulder: 'a falling boulder',
  stone: 'a rolling stone',
  gem: 'a falling gem',
  snow: 'an avalanche',
};
