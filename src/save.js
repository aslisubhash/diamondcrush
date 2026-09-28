// Local profile and settings. Browser storage can be unavailable (private
// mode, blocked storage), so every access is guarded and the game still
// runs with in-memory defaults.

const KEY = 'diamond-crush-save-v1';

export const UPGRADES = [
  { id: 'heart', name: 'Heart container', desc: '+1 max heart', prices: [500, 1200, 2500] },
  { id: 'rewind', name: 'Rewind capacity', desc: '+5 rewind steps', prices: [300, 700, 1400, 2800] },
  { id: 'boots', name: 'Swift boots', desc: 'Faster hold-to-walk (150 → 120 → 100 ms)', prices: [600, 1500] },
  { id: 'eye', name: 'Keen eye', desc: 'False walls shimmer when you stand beside them', prices: [800] },
  { id: 'well', name: 'Insight well', desc: 'Insight cap +5', prices: [700, 1600] },
  { id: 'preview', name: 'Rock-fall lens', desc: 'Unlocks the rock-fall preview (hold M)', prices: [250] },
];

export function defaultProfile() {
  return {
    v: 1,
    coins: 0,
    insight: 3,
    shards: 0,
    stages: {}, // id -> { stars:[b,b,b], crown, bestMoves, bestTime, done, gems, red }
    unlocked: { '1-S1': false, '1-S2': false },
    tools: [],
    upgrades: {},
    seenIntro: false,
    seenTips: {},
    difficulty: 'classic',
    purist: false,
  };
}

export function defaultSettings() {
  return {
    control: 'dpad', // dpad | joystick | keypad | swipe (no buttons)
    controlsChosen: false,
    floatButtons: false,
    lastDeck: 'dpad',
    leftHanded: false,
    split: 0.62,
    buttonScale: 1,
    buttonOpacity: 0.9,
    retro: false,
    reducedMotion: false,
    haptics: true,
    music: 0.6,
    sfx: 0.8,
    hints: true,
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadAll() {
  const data = read() || {};
  return {
    profile: { ...defaultProfile(), ...(data.profile || {}) },
    settings: { ...defaultSettings(), ...(data.settings || {}) },
  };
}

export function saveAll(profile, settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ profile, settings }));
  } catch {
    // Storage unavailable: progress lives for this session only.
  }
}

export function upgradeLevel(profile, id) {
  return profile.upgrades[id] || 0;
}

export function insightCap(profile) {
  return 20 + 5 * upgradeLevel(profile, 'well');
}

export function stepMs(profile) {
  return [150, 120, 100][upgradeLevel(profile, 'boots')];
}
