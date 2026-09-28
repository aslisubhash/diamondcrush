// Text rendering of a state, for tests and the level-authoring CLI.
import { gateOpen, exitOpen } from './sim.js';

const FLOOR_CH = {
  void: ' ', wall: 'W', false: 'F', cracked: 'C', floor: '.', filled: ',', earth: 'E',
  pit: 'O', water: '~', spikes: '^', plate: 'p', weak: '_', idol: 'P', exit: 'X', sexit: 'Y',
  door: 'D', lever: 'l', lair: 'L',
};
const OBJ_CH = { boulder: 'B', stone: 'R', crate: 'c', gem: 'G', red: '*', key: 'K', tool: 'h', fruit: 'f' };
const ENEMY_CH = { snake: 'S', scarab: 'A', monkey: 'M' };

export function toAscii(s) {
  const lines = [];
  for (let y = 0; y < s.h; y++) {
    let line = '';
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      let ch = FLOOR_CH[s.floor[i]] ?? '?';
      if (s.floor[i] === 'gate') ch = gateOpen(s, i) ? 'g' : '#';
      if (s.floor[i] === 'exit' && exitOpen(s)) ch = 'x';
      const o = s.obj[i];
      if (o) ch = OBJ_CH[o.t] ?? '?';
      if (o && o.st === 'wobble') ch = ch.toLowerCase() === ch ? ch : ch.toLowerCase();
      const e = s.enemies.find((en) => en.alive && en.x === x && en.y === y);
      if (e) ch = ENEMY_CH[e.t] ?? '?';
      if (s.boss && s.boss.alive && s.boss.x === x && s.boss.y === y) ch = 'N';
      if (s.hero.x === x && s.hero.y === y) ch = 'H';
      line += ch;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function summary(s) {
  const h = s.hero;
  return `tick ${s.tick} moves ${s.moves} gems ${s.gems}/${s.gemsTotal} (quota ${s.quota}) red ${s.red}/${s.redTotal} ` +
    `hearts ${h.hearts}/${h.maxHearts} status ${s.status}${s.boss ? ` boss hp ${s.boss.hp}` : ''} ${s.lastHurt ? `lastHurt: ${s.lastHurt}` : ''}`;
}
