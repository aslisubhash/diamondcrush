import { ANGKOR } from './angkor.js';
import { BAVARIA } from './bavaria.js';
import { TIBET } from './tibet.js';
import { INDIA } from './india.js';
import { VAULT_LEVELS } from './vault.js';
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
  {
    id: 'india',
    name: 'Bharat Expedition',
    place: 'India',
    mood: 'Warm sandstone, marigold, peacock blues and monsoon greens.',
    levels: INDIA,
    playable: true,
  },
  {
    id: 'vault',
    name: 'The Obsidian Vault',
    place: 'Beneath all four temples',
    mood: 'Black glass, red lasers and every tool you own.',
    levels: VAULT_LEVELS,
    playable: true,
  },
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
