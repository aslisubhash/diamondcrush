// Text rendering of a state, for tests and the level-authoring CLI.
import { gateOpen, exitOpen, wellWet } from './shared.js';

const FLOOR_CH = {
  void: ' ', wall: 'W', false: 'F', cracked: 'C', floor: '.', filled: ',', earth: 'E',
  pit: 'O', water: '~', spikes: '^', plate: 'p', weak: '_', idol: 'P', exit: 'X', sexit: 'Y',
  door: 'D', lever: 'l', lair: 'L', ice: 'I', wind: 'w', blade: '|', jet: 'J', lamp: '@',
  vent: 'V', grass: '%', switch: '!', den: ':',
};
const OBJ_CH = { boulder: 'B', stone: 'R', crate: 'c', gem: 'G', red: '*', key: 'K', tool: 'h', fruit: 'f', snow: 'o', heart: 'Q', pot: 'u', mirror: 'm' };
const ENEMY_CH = {
  snake: 'S', scarab: 'A', monkey: 'M', bat: 'x', knight: 'n', rat: 'r', yeti: 'y', spirit: 'j',
  cobra: 'k', langur: 'z', thug: 'u', tiger: 't', echo: 'e',
};

export function toAscii(s) {
  const lines = [];
  for (let y = 0; y < s.h; y++) {
    let line = '';
    for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      const f = s.floor[i];
      const m = s.meta[i] || {};
      let ch = FLOOR_CH[f] ?? '?';
      if (f === 'gate' || f === 'bridge') ch = gateOpen(s, i) ? (f === 'gate' ? 'g' : '=') : '#';
      if (f === 'exit' && exitOpen(s)) ch = 'x';
      if (f === 'conv') ch = { L: '(', R: ')', U: '{', D: '}' }[m.dir];
      if (f === 'brazier') ch = m.lit ? 'Z' : 'z';
      if (f === 'sensor') ch = m.hit ? '9' : '0';
      if (f === 'well') ch = wellWet(s, i) ? '~' : ',';
      if (f === 'kolam') ch = m.traced ? 'K' : 'k';
      if (f === 'collapse') ch = m.down ? 'O' : ';';
      if (s.fire && s.fire.includes(i)) ch = '"';
      const o = s.obj[i];
      if (o) ch = o.t === 'mirror' ? o.o : (OBJ_CH[o.t] ?? '?');
      if (o && o.st === 'wobble') ch = ch.toLowerCase();
      const e = s.enemies.find((en) => en.alive && en.x === x && en.y === y);
      if (e) ch = ENEMY_CH[e.t] ?? '?';
      if (s.boss && s.boss.alive && s.boss.x === x && s.boss.y === y) ch = 'N';
      if (s.partner && s.partner.x === x && s.partner.y === y) ch = '&';
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
    `hearts ${h.hearts}/${h.maxHearts} status ${s.status}${s.boss ? ` boss hp ${s.boss.hp} ph ${s.boss.phase}` : ''} ${s.lastHurt ? `lastHurt: ${s.lastHurt}` : ''}`;
}
