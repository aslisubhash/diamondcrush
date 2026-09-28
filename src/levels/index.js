import { ANGKOR } from './angkor.js';
import { BAVARIA } from './bavaria.js';
import { TIBET } from './tibet.js';
import { parseLevel } from '../engine/level.js';

export const WORLDS = [
  {
    id: 'angkor',
    name: 'Angkor Jungle Temples',
    place: 'Cambodia',
    mood: 'Morning mist, mossy sandstone, roots breaking through walls.',
    levels: ANGKOR,
    playable: true,
  },
  {
    id: 'bavaria',
    name: 'Falkenstein Keep',
    place: 'Bavaria',
    mood: 'Cold stone, torchlight, banners and dungeons.',
    levels: BAVARIA,
    playable: true,
  },
  {
    id: 'tibet',
    name: 'Monastery of Nine Winds',
    place: 'Tibet',
    mood: 'Prayer flags, blue-white snow, gold roofs and wind.',
    levels: TIBET,
    playable: true,
  },
  { id: 'india', name: 'Bharat Expedition', place: 'India', mood: 'Stepwells, forts and monsoon channels.', levels: [], playable: false },
  { id: 'vault', name: 'The Obsidian Vault', place: 'Finale', mood: 'Every tool, every world.', levels: [], playable: false },
];

export const LEVELS = WORLDS.flatMap((w) => w.levels.map((l) => ({ ...l, world: w.id })));

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

// Tools a player normally owns when starting a level in order: every tool
// picked up or awarded (`reward`) by an earlier level in the campaign.
export function toolsBefore(id) {
  const out = [];
  for (const l of LEVELS) {
    if (l.id === id) break;
    for (const o of parseLevel(l).obj) if (o && o.t === 'tool') out.push(o.tool);
    if (l.reward) out.push(l.reward);
  }
  return [...new Set(out)];
}
