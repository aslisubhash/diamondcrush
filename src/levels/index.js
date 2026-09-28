import { ANGKOR } from './angkor.js';

export const WORLDS = [
  {
    id: 'angkor',
    name: 'Angkor Jungle Temples',
    place: 'Cambodia',
    mood: 'Morning mist, mossy sandstone, roots breaking through walls.',
    levels: ANGKOR,
    playable: true,
  },
  { id: 'bavaria', name: 'Falkenstein Keep', place: 'Bavaria', mood: 'Torchlight, levers and patrols.', levels: [], playable: false },
  { id: 'tibet', name: 'Monastery of Nine Winds', place: 'Tibet', mood: 'Ice sliding and light beams.', levels: [], playable: false },
  { id: 'india', name: 'Bharat Expedition', place: 'India', mood: 'Stepwells, forts and monsoon channels.', levels: [], playable: false },
  { id: 'vault', name: 'The Obsidian Vault', place: 'Finale', mood: 'Every tool, every world.', levels: [], playable: false },
];

export const LEVELS = WORLDS.flatMap((w) => w.levels.map((l) => ({ ...l, world: w.id })));

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

// Tools a player normally owns when starting a level in order: every tool
// picked up (map char 'h') or awarded (`reward`) by an earlier level.
export function toolsBefore(id) {
  const out = [];
  for (const l of LEVELS) {
    if (l.id === id) break;
    if (l.map.some((row) => row.includes('h'))) out.push('hammer');
    if (l.reward) out.push(l.reward);
  }
  return [...new Set(out)];
}
