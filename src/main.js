// Boot, screens and menus. The game itself lives in game.js (session),
// render/ (canvas), audio/ (Web Audio) and engine/ (rules).
import { WORLDS, getLevel } from './levels/index.js';
import { Renderer } from './render/renderer.js';
import { AudioEngine } from './audio/audio.js';
import { Input } from './input.js';
import { GameSession } from './game.js';
import { DIFFICULTIES, KEY_SHAPES, TOOLS } from './engine/constants.js';
import { parseLevel } from './engine/level.js';
import { COLORS } from './render/palette.js';
import { loadAll, saveAll, UPGRADES, upgradeLevel, insightCap, stepMs } from './save.js';
import { startTitleArt, COMIC, drawComic, drawToolIcon } from './ui/art.js';
import { currentTool } from './engine/sim.js';
import { icon } from './ui/icons.js';
import { iconURL } from './render/premium.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const { profile, settings } = loadAll();
const audio = new AudioEngine();
let renderer = null;
let session = null;
let screen = 'title';
let stopTitle = null;
let selectedWorld = 'angkor';
let modalOpen = null;

function save() {
  saveAll(profile, settings);
}

// ---------- screens ----------

function show(name) {
  screen = name;
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === `screen-${name}`));
  if (name !== 'title' && stopTitle) {
    stopTitle();
    stopTitle = null;
  }
}

function openModal(html, { onClose, cls = '' } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`;
  m.classList.add('show');
  modalOpen = { onClose };
  return m.firstElementChild;
}

function closeModal() {
  const m = $('#modal');
  m.classList.remove('show');
  m.innerHTML = '';
  const cb = modalOpen && modalOpen.onClose;
  modalOpen = null;
  if (cb) cb();
}

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const el = screen === 'game' ? $('#toast') : null;
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

let tipTimer = 0;
function tip(msg) {
  const el = $('#tip');
  el.innerHTML = `${icon('scroll')}<span>${esc(msg)}</span>`;
  el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

function haptic(p) {
  if (!settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(p); } catch { /* unsupported */ }
}

function applySettings() {
  const root = document.documentElement.style;
  root.setProperty('--split', settings.split);
  root.setProperty('--btn-scale', settings.buttonScale);
  root.setProperty('--btn-opacity', settings.buttonOpacity);
  audio.setVolumes(settings.music, settings.sfx);
  if (renderer) {
    renderer.retro = settings.retro;
    renderer.reducedMotion = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  input.stepMs = stepMs(profile);
}

// ---------- title and story ----------

function initTitle() {
  stopTitle = startTitleArt($('#title-art'));
  $('#tap-begin').addEventListener('click', () => {
    audio.init();
    audio.sfx('ui');
    const go = () => (profile.seenIntro ? showMap() : showComic(true));
    if (!settings.controlsChosen) chooseControls(go);
    else go();
  });
}

// Asked once when the game starts (and available again in Settings):
// on-screen buttons are optional.
const CONTROL_CHOICES = [
  { id: 'deck', pic: 'up', name: 'Royal control deck', desc: 'On-screen D-pad and tool buttons below the temple view.' },
  { id: 'gestures', pic: 'hand', name: 'Gestures only', desc: 'No buttons. Swipe to move, tap for your tool, two-finger tap to rewind, hold to preview rockfalls.' },
  { id: 'keys', pic: 'map', name: 'Keyboard or gamepad', desc: 'No buttons on screen. Arrows or WASD, Space for tools, Z to rewind.' },
];

function applyControlChoice(id) {
  if (id === 'deck') {
    if (!['dpad', 'joystick', 'keypad'].includes(settings.control)) settings.control = 'dpad';
  } else {
    settings.control = 'swipe';
    settings.floatButtons = false;
  }
  settings.controlsChosen = true;
  save();
}

function chooseControls(then) {
  const el = openModal(`<h2>Choose your controls</h2>
    <p class="muted" style="text-align:center">Buttons are optional. You can change this any time in Settings.</p>
    <div class="choices">${CONTROL_CHOICES.map((c) => `<button class="choice" data-c="${c.id}">
      <span class="pic">${icon(c.pic)}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></button>`).join('')}</div>`,
  { onClose: () => { if (!settings.controlsChosen) applyControlChoice('deck'); then(); } });
  el.querySelectorAll('[data-c]').forEach((b) => {
    b.onclick = () => {
      audio.sfx('ui');
      applyControlChoice(b.dataset.c);
      closeModal();
    };
  });
}

function showComic(first) {
  show('comic');
  audio.playMusic('title');
  const wrap = $('#comic-panels');
  wrap.innerHTML = COMIC.map((p) => `<div class="panel"><canvas></canvas><p>${esc(p.text)}</p></div>`).join('');
  const panels = [...wrap.children];
  let n = 0;
  const reveal = () => {
    panels[n].classList.add('show');
    drawComic(panels[n].querySelector('canvas'), COMIC[n].art);
    audio.sfx('ui');
    n++;
    $('#comic-next').textContent = n >= panels.length ? (first ? 'Begin' : 'Back') : 'Next';
  };
  const done = () => {
    profile.seenIntro = true;
    save();
    showMap();
  };
  $('#comic-next').onclick = () => (n >= panels.length ? done() : reveal());
  $('#comic-skip').onclick = done;
  reveal();
}

// ---------- hub map ----------

// Per-world structure: main stages in order, secrets, and the boss.
function worldOf(id) {
  return WORLDS.find((w) => w.levels.some((l) => l.id === id)) || WORLDS[0];
}
function mainOrder(w) {
  return w.levels.filter((l) => !l.secret && !l.boss).map((l) => l.id);
}
function bossOf(w) {
  return w.levels.find((l) => l.boss) || null;
}
function worldNum(w) {
  return WORLDS.indexOf(w) + 1;
}
// Star gate: the boss needs about two thirds of the world's blue gems.
function gemGate(w) {
  const total = mainOrder(w).reduce((n, id) => n + gemCount(getLevel(id)), 0);
  return Math.floor(total * 0.6);
}
const gemCache = new Map();
function gemCount(level) {
  if (!gemCache.has(level.id)) gemCache.set(level.id, parseLevel(level).gemsTotal);
  return gemCache.get(level.id);
}

function stageRec(id) {
  return profile.stages[id] || null;
}

function totals(w) {
  let gems = 0;
  let stars = 0;
  let crowns = 0;
  for (const [id, r] of Object.entries(profile.stages)) {
    if (w && worldOf(id) !== w) continue;
    gems += r.gems || 0;
    stars += (r.stars || []).filter(Boolean).length;
    if (r.crown) crowns++;
  }
  return { gems, stars, crowns };
}

function worldUnlocked(w) {
  const n = WORLDS.indexOf(w);
  if (!w.playable) return false;
  if (n === 0) return true;
  const prev = WORLDS[n - 1];
  const b = bossOf(prev);
  return !!(b && stageRec(b.id)?.done);
}

function isUnlocked(level) {
  const w = worldOf(level.id);
  if (!worldUnlocked(w)) return false;
  if (level.secret) return !!profile.unlocked[level.id];
  const order = mainOrder(w);
  if (level.boss) return !!stageRec(order[order.length - 1])?.done && totals(w).gems >= gemGate(w);
  const i = order.indexOf(level.id);
  return i === 0 || !!stageRec(order[i - 1])?.done;
}

function lockReason(level) {
  const w = worldOf(level.id);
  if (!worldUnlocked(w)) return 'Defeat the previous world\'s guardian to travel here.';
  if (level.secret) return 'A secret stage. Look for a hidden exit in an earlier stage.';
  if (level.boss) {
    const order = mainOrder(w);
    const last = getLevel(order[order.length - 1]);
    if (!stageRec(last.id)?.done) return `Clear ${last.name} to reach the guardian.`;
    return `The star gate needs ${gemGate(w)} blue gems from this world. You have ${totals(w).gems}.`;
  }
  return 'Clear the previous stage first.';
}

function showMap() {
  show('map');
  audio.playMusic('hub');
  renderHub();
}

function renderHub() {
  const t = totals();
  if (!worldUnlocked(WORLDS.find((x) => x.id === selectedWorld)) && selectedWorld !== WORLDS[0].id) {
    const open = WORLDS.filter(worldUnlocked);
    if (!open.length) selectedWorld = WORLDS[0].id;
  }
  $('#hub-coins').textContent = profile.coins;
  $('#hub-insight').textContent = profile.insight;
  $('#hub-gems').textContent = t.gems;
  $('#hub-stars').textContent = t.stars;
  $('#world-tabs').innerHTML = WORLDS.map((w) =>
    `<button data-w="${w.id}" class="${w.id === selectedWorld ? 'on' : ''} ${worldUnlocked(w) ? '' : 'locked'}">${worldUnlocked(w) ? '' : icon('lock')}${esc(w.name)}</button>`).join('');
  $('#world-tabs').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      selectedWorld = b.dataset.w;
      renderHub.scrolled = false;
      audio.sfx('ui');
      renderHub();
    };
  });
  const w = WORLDS.find((x) => x.id === selectedWorld);
  const view = $('#world-view');
  const num = worldNum(w);
  if (!worldUnlocked(w)) {
    const prev = WORLDS[WORLDS.indexOf(w) - 1];
    const guard = prev && bossOf(prev);
    view.innerHTML = `<div class="world-head"><h2>World ${num} · ${esc(w.name)}</h2><p>${esc(w.place)} · ${esc(w.mood)}</p></div>
      <div class="coming"><h3>The road is sealed</h3>${guard ? `Defeat ${esc(guard.name)} in ${esc(prev.name)} to carry its Heart Stone here.` : 'Coming soon.'}</div>`;
    return;
  }
  // Winding trail: main stages top to bottom, secrets on side branches, boss last.
  const order = mainOrder(w);
  const nodes = [];
  const gap = 104;
  let y = 60;
  order.forEach((id, i) => {
    const x = 50 + Math.sin(i * 1.15) * 28;
    nodes.push({ id, x, y });
    const lvl = getLevel(id);
    if (lvl.secretExit) nodes.push({ id: `${num}-${lvl.secretExit}`, x: x > 50 ? 16 : 84, y: y + gap / 2, branch: nodes[nodes.length - 1] });
    y += gap;
  });
  const boss = bossOf(w);
  if (boss) nodes.push({ id: boss.id, x: 50, y: y + 10 });
  const height = y + 90;
  const main = nodes.filter((n) => !n.branch);
  const pathD = main.map((n, i) => `${i ? 'L' : 'M'} ${n.x} ${n.y}`).join(' ');
  const branches = nodes.filter((n) => n.branch).map((n) => `M ${n.branch.x} ${n.branch.y} L ${n.x} ${n.y}`).join(' ');
  const firstOpen = order.find((id) => !stageRec(id)?.done);
  view.innerHTML = `<div class="world-head"><h2>World ${num} · ${esc(w.name)}</h2><p>${esc(w.place)} · ${esc(w.mood)}</p></div>
    <div class="trail" style="height:${height}px">
      <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none">
        <path d="${pathD}" fill="none" stroke="#000" stroke-opacity="0.55" vector-effect="non-scaling-stroke" style="stroke-width:9px" stroke-linecap="round"/>
        <path d="${pathD}" fill="none" stroke="#d9b04e" stroke-dasharray="1 9" vector-effect="non-scaling-stroke" style="stroke-width:5px" stroke-linecap="round"/>
        <path d="${branches}" fill="none" stroke="#e0223f" stroke-opacity="0.8" stroke-dasharray="1 8" vector-effect="non-scaling-stroke" style="stroke-width:4px" stroke-linecap="round"/>
      </svg>
      ${nodes.map((n) => nodeHtml(n, firstOpen)).join('')}
    </div>`;
  view.querySelectorAll('.node').forEach((el) => {
    el.onclick = () => {
      audio.sfx('ui');
      stageCard(getLevel(el.dataset.id));
    };
  });
  const cur = view.querySelector('.node.current');
  if (cur && !renderHub.scrolled) {
    renderHub.scrolled = true;
    view.scrollTop = Math.max(0, cur.offsetTop - view.clientHeight / 2);
  }
}

function nodeHtml(n, firstOpen) {
  const lvl = getLevel(n.id);
  const rec = stageRec(n.id);
  const open = isUnlocked(lvl);
  const cls = ['node'];
  if (!open) cls.push('locked');
  if (rec?.done) cls.push('done');
  if (rec?.crown) cls.push('crown');
  if (lvl.secret) cls.push('secret');
  if (lvl.boss) cls.push('boss');
  if (n.id === firstOpen || (!firstOpen && lvl.boss && open && !rec?.done)) cls.push('current');
  const label = lvl.secret ? (open ? lvl.name : '???') : lvl.name;
  const num = lvl.boss ? icon('skull') : lvl.secret ? icon(open ? 'star' : 'question') : !open ? icon('lock') : n.id.split('-')[1];
  const stars = (rec?.stars || [false, false, false]).map((s) => `<i class="ico star ${s ? '' : 'off'}"></i>`).join('');
  return `<button class="${cls.join(' ')}" data-id="${n.id}" style="left:${n.x}%;top:${n.y}px">
    <span class="disc"><span>${num}</span></span>
    <span class="stars">${stars}</span>
    <span class="label">${esc(label)}</span></button>`;
}

function stageCard(level) {
  if (!isUnlocked(level)) {
    const el = openModal(`<h2>${level.secret ? '???' : esc(level.name)}</h2><p class="lock-line">${icon('lock')}<span>${esc(lockReason(level))}</span></p>
      <div class="row"><button class="btn" data-x="close">Close</button></div>`);
    el.querySelector('[data-x=close]').onclick = closeModal;
    return;
  }
  const rec = stageRec(level.id);
  const stars = (rec?.stars || [false, false, false]).map((s) => `<i class="ico star ${s ? 'on' : ''}"></i>`).join('');
  const el = openModal(`
    <div class="stage-card">
      <h2>${esc(level.boss ? `Guardian: ${level.name}` : `${level.id} · ${level.name}`)}</h2>
      <span class="idea">${esc(level.idea)}</span>
      <div class="big-stars">${stars}</div>
      <div class="stat-grid">
        <span>Gem quota</span><b>${level.quota || '—'}</b>
        <span>Par moves</span><b>${level.par}</b>
        <span>Best moves</span><b>${rec?.bestMoves ?? '—'}</b>
        <span>Best gems</span><b>${rec?.gems ?? 0}</b>
        <span>Red gem</span><b>${rec?.red ? 'Found' : level.boss ? '—' : '?'}</b>
        <span>Crown</span><b>${rec?.crown ? icon('crown') : '—'}</b>
      </div>
      <p class="muted">First star: reach the exit. Second: ${level.boss ? 'take no damage' : 'every blue gem'}. Third: ${level.boss ? 'finish under par' : 'the red gem or under par'}. The Crown: a flawless run without rewinds.</p>
      <div class="row"><button class="btn ghost" data-x="close">Back</button><button class="btn primary" data-x="play">Play</button></div>
    </div>`);
  el.querySelectorAll('.big-stars i').forEach((i) => i.classList.contains('on') || i.classList.add('off'));
  el.querySelector('[data-x=close]').onclick = closeModal;
  el.querySelector('[data-x=play]').onclick = () => {
    closeModal();
    startStage(level.id);
  };
}

// ---------- shop ----------

function openShop() {
  const items = UPGRADES.map((u) => {
    const lv = upgradeLevel(profile, u.id);
    const max = lv >= u.prices.length;
    const price = max ? null : u.prices[lv];
    return `<div class="shop-item"><div class="info"><b>${esc(u.name)}</b><small>${esc(u.desc)}</small>
      <div class="lv">LEVEL ${lv}/${u.prices.length}</div></div>
      <button class="btn ${max ? '' : 'primary'}" data-buy="${u.id}" ${max || profile.coins < price ? 'disabled' : ''}>
      ${max ? 'Max' : `<i class="ico coin"></i> ${price}`}</button></div>`;
  }).join('');
  const el = openModal(`<h2>Merchant's tent</h2>
    <p class="muted">Upgrades are bought only with coins earned in play. Nothing here solves a room for you.</p>
    <p><span class="chip"><i class="ico coin"></i><b>${profile.coins}</b></span>
    <span class="chip"><i class="ico insight"></i><b>${profile.insight}/${insightCap(profile)}</b></span></p>
    ${items}
    <div class="row"><button class="btn" data-x="close">Leave</button></div>`, { onClose: renderHub });
  el.querySelector('[data-x=close]').onclick = closeModal;
  el.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = () => {
      const u = UPGRADES.find((x) => x.id === b.dataset.buy);
      const lv = upgradeLevel(profile, u.id);
      const price = u.prices[lv];
      if (profile.coins < price) return;
      profile.coins -= price;
      profile.upgrades[u.id] = lv + 1;
      save();
      audio.sfx('coin');
      applySettings();
      openShop();
    };
  });
}

// ---------- settings ----------

function openSettings(fromGame) {
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l, dis]) =>
    `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${dis ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
  const diffs = Object.entries(DIFFICULTIES).map(([k, d]) => [k, d.label, k === 'purist' && !profile.purist]);
  const el = openModal(`<h2>Settings</h2>
    <h3>Control deck</h3>
    ${seg('control', [['dpad', 'D-pad'], ['joystick', 'Joystick'], ['keypad', 'Keypad'], ['swipe', 'No buttons']], settings.control)}
    <div class="set-row"><label for="s-float">Floating tool and rewind buttons (no-buttons mode)</label><input id="s-float" type="checkbox" ${settings.floatButtons ? 'checked' : ''}></div>
    <div class="set-row"><label for="s-left">Left-handed (mirror deck)</label><input id="s-left" type="checkbox" ${settings.leftHanded ? 'checked' : ''}></div>
    <div class="set-row"><label for="s-size">Button size</label><input id="s-size" type="range" min="0.8" max="1.3" step="0.05" value="${settings.buttonScale}"></div>
    <div class="set-row"><label for="s-op">Button opacity</label><input id="s-op" type="range" min="0.4" max="1" step="0.05" value="${settings.buttonOpacity}"></div>
    <div class="set-row"><label for="s-split">Game / deck split</label><input id="s-split" type="range" min="0.55" max="0.75" step="0.01" value="${settings.split}"></div>
    <h3>Look and feel</h3>
    <div class="set-row"><label for="s-retro">Retro filter (24 px, LCD lines)</label><input id="s-retro" type="checkbox" ${settings.retro ? 'checked' : ''}></div>
    <div class="set-row"><label for="s-rm">Reduced motion (no shake)</label><input id="s-rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}></div>
    <div class="set-row"><label for="s-hap">Haptics</label><input id="s-hap" type="checkbox" ${settings.haptics ? 'checked' : ''}></div>
    <div class="set-row"><label for="s-hints">Tips and adaptive hints</label><input id="s-hints" type="checkbox" ${settings.hints ? 'checked' : ''}></div>
    <h3>Sound</h3>
    <div class="set-row"><label for="s-mus">Music</label><input id="s-mus" type="range" min="0" max="1" step="0.05" value="${settings.music}"></div>
    <div class="set-row"><label for="s-sfx">Sound effects</label><input id="s-sfx" type="range" min="0" max="1" step="0.05" value="${settings.sfx}"></div>
    <h3>Difficulty</h3>
    ${seg('difficulty', diffs, profile.difficulty)}
    <p class="muted" id="diff-hint">${esc(DIFFICULTIES[profile.difficulty].hint)}${profile.purist ? '' : ' · Purist unlocks after the first guardian.'}</p>
    ${fromGame ? '<p class="muted">Difficulty changes apply from the next stage.</p>' : ''}
    <div class="row"><button class="btn danger" data-x="reset">Reset progress</button><button class="btn primary" data-x="close">Done</button></div>`,
  { onClose: () => { if (!fromGame) renderHub(); } });
  el.querySelectorAll('[data-seg]').forEach((g) => {
    g.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        audio.sfx('ui');
        if (g.dataset.seg === 'control') {
          settings.control = b.dataset.v;
          if (screen === 'game') buildDeck();
        } else {
          profile.difficulty = b.dataset.v;
          el.querySelector('#diff-hint').textContent = DIFFICULTIES[profile.difficulty].hint;
        }
        save();
      };
    });
  });
  const bind = (id, key, parse = (v) => v) => {
    const inp = el.querySelector(id);
    inp.oninput = () => {
      settings[key] = inp.type === 'checkbox' ? inp.checked : parse(inp.value);
      applySettings();
      if ((key === 'leftHanded' || key === 'floatButtons') && screen === 'game') buildDeck();
      if (key === 'split' && renderer) requestAnimationFrame(() => renderer.resize());
      save();
    };
  };
  bind('#s-left', 'leftHanded');
  bind('#s-float', 'floatButtons');
  bind('#s-size', 'buttonScale', Number);
  bind('#s-op', 'buttonOpacity', Number);
  bind('#s-split', 'split', Number);
  bind('#s-retro', 'retro');
  bind('#s-rm', 'reducedMotion');
  bind('#s-hap', 'haptics');
  bind('#s-hints', 'hints');
  bind('#s-mus', 'music', Number);
  bind('#s-sfx', 'sfx', Number);
  el.querySelector('[data-x=close]').onclick = () => {
    closeModal();
    if (fromGame) openPause();
  };
  // Two-tap confirmation built into the page (no browser dialogs).
  const reset = el.querySelector('[data-x=reset]');
  reset.onclick = () => {
    if (!reset.dataset.armed) {
      reset.dataset.armed = '1';
      reset.textContent = 'Tap again to erase everything';
      setTimeout(() => {
        delete reset.dataset.armed;
        reset.textContent = 'Reset progress';
      }, 3000);
      return;
    }
    Object.assign(profile, loadDefaults());
    save();
    closeModal();
    session = null;
    showMap();
  };
}

function loadDefaults() {
  try { localStorage.removeItem('diamond-crush-save-v1'); } catch { /* ignore */ }
  return loadAll().profile;
}

// ---------- in-game ----------

const input = new Input({
  move: (d) => { if (session && screen === 'game' && !modalOpen) session.queueMove(d); },
  tool: () => { if (session && !modalOpen) session.queueTool(); },
  cycle: (s) => { if (session && !modalOpen) session.cycle(s); },
  swap: () => { if (session && !modalOpen) session.swap(); },
  rewind: () => {
    if (!session) return;
    if (modalOpen && session.over && session.state.status === 'dead') {
      closeModal();
      session.over = false;
      session.state.status = 'play';
    }
    if (!modalOpen) session.rewind();
  },
  pause: () => {
    if (screen !== 'game' || !session) return;
    if (modalOpen) {
      if (!session.over) { closeModal(); }
    } else if (!session.over) openPause();
  },
  preview: (on) => {
    if (!session || modalOpen) return;
    if (on && !upgradeLevel(profile, 'preview')) {
      if (on) toast('Rock-fall lens: buy it at the merchant\'s tent');
      return;
    }
    if (profile.difficulty === 'purist' && on) return;
    session.setPreview(on);
  },
  lantern: () => useClue('lantern'),
  gestures: () => settings.control === 'swipe',
  active: () => screen === 'game' && !!session && !modalOpen && !session.over,
  haptic,
});

function buildDeck() {
  const deck = $('#deck');
  const gameScreen = $('#screen-game');
  input.clear();
  deck.className = `deck ${settings.leftHanded ? 'lefty' : ''}`;
  gameScreen.classList.toggle('swipe-mode-on', settings.control === 'swipe');
  gameScreen.classList.toggle('float-on', !!settings.floatButtons);
  const act = `<div class="pad-act"><div class="act-grid">
      <button class="act-btn rewind" data-a="rewind" aria-label="Rewind">${icon('rewind', { fill: '#eaf4ff' })}<small></small></button>
      <button class="act-btn tool" data-a="tool" aria-label="Use tool"><canvas id="tool-icon" width="40" height="40"></canvas>${icon('hand', { fill: '#3a2405' })}</button>
      <div class="mini-row">
        <button class="mini" data-a="cycle" aria-label="Cycle tool">${icon('cycle')}Tool</button>
        <button class="mini" data-a="map" aria-label="Rock-fall preview (hold)">${icon('eye')}Map</button>
        <button class="mini swap-btn" data-a="swap" aria-label="Swap explorers">${icon('swap')}Swap</button>
      </div></div></div>`;
  if (settings.control === 'keypad') {
    deck.classList.add('keypad-mode');
    const k = (n, label, cls = '') => `<button data-k="${n}" class="${cls}">${n}<small>${label}</small></button>`;
    deck.innerHTML = `<div class="phone"><div class="brand">EXPEDITION KEYPAD</div><div class="keypad">
      ${k(1, icon('eye'))}${k(2, icon('up'), 'nav')}${k(3, icon('pause'))}
      ${k(4, icon('left'), 'nav')}${k(5, icon('hand'))}${k(6, icon('right'), 'nav')}
      ${k(7, icon('lantern'))}${k(8, icon('down'), 'nav')}${k(9, icon('swap'))}
      ${k('*', 'TOOL')}${k(0, icon('rewind'))}${k('#', 'TOOL')}
      </div></div>`;
    const dirs = { 2: 'U', 4: 'L', 6: 'R', 8: 'D' };
    deck.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      if (dirs[k]) input.bindHoldButton(b, dirs[k], `kp${k}`);
      else if (k === '5') input.bindTapButton(b, () => session?.queueTool());
      else if (k === '0') input.bindTapButton(b, () => session?.rewind());
      else if (k === '1') input.bindTapButton(b, () => input.a.preview(true), () => input.a.preview(false));
      else if (k === '3') input.bindTapButton(b, () => openPause());
      else if (k === '7') input.bindTapButton(b, () => useClue('lantern'));
      else if (k === '9') input.bindTapButton(b, () => session?.swap());
      else if (k === '*') input.bindTapButton(b, () => session?.cycle(-1));
      else if (k === '#') input.bindTapButton(b, () => session?.cycle(1));
    });
  } else if (settings.control === 'joystick') {
    deck.innerHTML = `<div class="pad-move"><div class="joy-zone"><div class="hint">Touch and drag<br>anywhere here</div>
      <div class="joy-base"><div class="joy-knob"></div></div></div></div>${act}`;
    input.bindJoystick(deck.querySelector('.joy-zone'), deck.querySelector('.joy-knob'), deck.querySelector('.joy-base'));
  } else {
    deck.innerHTML = `<div class="pad-move"><div class="dpad">
      <button class="u" aria-label="Up">${icon('up')}</button><button class="l" aria-label="Left">${icon('left')}</button>
      <span class="c"></span>
      <button class="r" aria-label="Right">${icon('right')}</button><button class="d" aria-label="Down">${icon('down')}</button>
      </div></div>${act}`;
    for (const [c, d] of [['u', 'U'], ['d', 'D'], ['l', 'L'], ['r', 'R']]) input.bindHoldButton(deck.querySelector(`.dpad .${c}`), d, `dp${d}`);
  }
  deck.querySelectorAll('[data-a]').forEach((b) => {
    const a = b.dataset.a;
    if (a === 'tool') input.bindTapButton(b, () => session?.queueTool());
    if (a === 'rewind') input.bindTapButton(b, () => session?.rewind());
    if (a === 'cycle') input.bindTapButton(b, () => session?.cycle(1));
    if (a === 'map') input.bindTapButton(b, () => input.a.preview(true), () => input.a.preview(false));
    if (a === 'swap') input.bindTapButton(b, () => session?.swap());
  });
  if (session) updateHud(session);
  requestAnimationFrame(() => renderer && renderer.resize());
}

function bindGameChrome() {
  $('#hud-pause').onclick = () => openPause();
  $('#hud-lantern').onclick = () => useClue('lantern');
  $('#stop-guide').onclick = () => {
    const id = session.level.id;
    startStage(id);
  };
  document.querySelectorAll('#swipe-buttons .sb').forEach((b) => {
    input.bindTapButton(b, () => (b.dataset.act === 'tool' ? session?.queueTool() : session?.rewind()));
  });
  input.bindSwipe($('#game'));
  // Draggable divider between the game window and the deck (55/45 to 75/25).
  const div = $('#divider');
  div.addEventListener('pointerdown', (e) => {
    div.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = $('#screen-game').getBoundingClientRect();
      settings.split = Math.max(0.55, Math.min(0.75, (ev.clientY - r.top) / r.height));
      applySettings();
      renderer.resize();
    };
    const up = () => {
      div.removeEventListener('pointermove', move);
      save();
    };
    div.addEventListener('pointermove', move);
    div.addEventListener('pointerup', up, { once: true });
  });
  new ResizeObserver(() => renderer && renderer.resize()).observe($('#game-window'));
}

function startStage(id, { autoplay = false } = {}) {
  const level = getLevel(id);
  if (selectedWorld !== worldOf(id).id) renderHub.scrolled = false;
  selectedWorld = worldOf(id).id;
  closeModal();
  show('game');
  if (!renderer) {
    renderer = new Renderer($('#game'));
    bindGameChrome();
  }
  applySettings();
  buildDeck();
  renderer.resize();
  session = new GameSession({
    level,
    profile,
    settings,
    renderer,
    audio,
    autoplay,
    hooks: {
      onHud: updateHud,
      toast,
      tip,
      haptic,
      onDeath,
      onWin,
    },
  });
  session.start(performance.now());
  $('#autoplay-badge').classList.toggle('show', autoplay);
  const banner = $('#stage-banner');
  banner.innerHTML = `<b>${esc(level.boss ? level.name : `${level.id} ${level.name}`)}</b><small>${esc(level.idea)}</small>`;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2200);
  if (!showGestureHint.shown) showGestureHint();
}

function showGestureHint() {
  const el = $('#gesture-hint');
  if (!el || settings.control !== 'swipe') return;
  showGestureHint.shown = true;
  el.textContent = 'Swipe to move · Tap for tool · Two-finger tap to rewind';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4200);
}

function updateHud(s) {
  const st = s.state;
  const g = $('#hud-gems');
  g.querySelector('b').textContent = st.gems;
  g.querySelector('small').textContent = `/${st.quota}`;
  g.classList.toggle('open', st.gems >= st.quota);
  const red = $('#hud-red');
  red.classList.toggle('none', !st.redTotal);
  red.classList.toggle('got', st.red > 0);
  const hearts = [];
  for (let i = 0; i < st.hero.maxHearts; i++) hearts.push(`<span class="h ${i < st.hero.hearts ? '' : 'off'}">${icon('heart', { fill: 'url(#ruby)' })}</span>`);
  $('#hud-hearts').innerHTML = hearts.join('');
  $('#hud-keys').innerHTML = Object.entries(st.hero.keys).filter(([, n]) => n > 0).map(([c, n]) =>
    `<i title="${c} key" style="background:${COLORS.key[c]};${shapeCss(KEY_SHAPES[c])}"></i>${n > 1 ? `<small>${n}</small>` : ''}`).join('');
  const tool = currentTool(st);
  const toolCanvas = $('#tool-icon');
  if (toolCanvas) toolCanvas.parentElement.classList.toggle('empty', !tool);
  if (toolCanvas && toolCanvas.dataset.tool !== String(tool)) {
    toolCanvas.dataset.tool = String(tool);
    drawToolIcon(toolCanvas, tool);
  }
  document.querySelectorAll('.swap-btn').forEach((b) => { b.hidden = !st.partner; });
  const rw = document.querySelector('.act-btn.rewind small');
  if (rw) {
    const label = s.rewindCap === Infinity ? 'inf' : String(s.rewindLeft);
    if (rw.dataset.v !== label) {
      rw.dataset.v = label;
      rw.innerHTML = s.rewindCap === Infinity ? icon('infinity', { fill: '#eaf4ff' }) : label;
    }
  }
}

function shapeCss(shape) {
  if (shape === 'circle') return 'border-radius:50%';
  if (shape === 'triangle') return 'clip-path:polygon(50% 0,100% 100%,0 100%)';
  if (shape === 'star') return 'clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
  return '';
}

function useClue(kind) {
  if (!session || session.over || screen !== 'game') return;
  if (profile.difficulty === 'purist') {
    toast('Purist mode: no clues');
    return;
  }
  const cost = { lantern: 1, compass: 1, guide: 5 }[kind];
  if (profile.insight < cost) {
    toast(`Needs ${cost} Insight. Earn Insight by clearing stages`);
    return;
  }
  profile.insight -= cost;
  save();
  if (kind === 'lantern') session.useLantern();
  if (kind === 'compass') session.useCompass();
  if (kind === 'guide') startStage(session.level.id, { autoplay: true });
}

function openPause() {
  if (!session || session.over) return;
  session.setPaused(true);
  input.clear();
  const lines = session.journal().map((l) => `<p>${esc(l)}</p>`).join('');
  const purist = profile.difficulty === 'purist';
  const clue = (k, name, desc, cost) => `<div class="clue"><div class="info"><b>${esc(name)}</b><small>${esc(desc)}</small></div>
    <button class="btn" data-clue="${k}" ${purist || profile.insight < cost ? 'disabled' : ''}><i class="ico insight"></i> ${cost}</button></div>`;
  const el = openModal(`<h2>Paused</h2>
    <p class="muted">${esc(session.level.id)} · ${esc(session.level.name)} · ${session.state.moves} moves · rewinds ${session.rewindCap === Infinity ? 'unlimited' : `${session.rewindLeft}/${session.rewindCap}`}</p>
    <h3>Explorer's journal</h3>
    <div class="journal">${lines}</div>
    ${purist ? '' : `<h3>Clues · <i class="ico insight"></i> ${profile.insight}</h3>
    ${clue('lantern', 'Lantern pulse', 'Gems and secrets within 4 tiles glow briefly', 1)}
    ${clue('compass', 'Whispering compass', 'Points to the nearest gem', 1)}
    ${clue('guide', 'Spirit guide', 'Replays the full solution from the start. Costs the Crown and par star', 5)}
    <p class="muted">${upgradeLevel(profile, 'preview') ? 'Hold M or the Map button to preview where loose rocks will land.' : 'The rock-fall lens (merchant\'s tent) shows where loose rocks will land.'}</p>`}
    <div class="col">
      <button class="btn primary" data-x="resume">Resume</button>
      <div class="row" style="margin-top:0"><button class="btn" data-x="restart">Restart</button><button class="btn" data-x="settings">Settings</button></div>
      <button class="btn ghost" data-x="controls">${settings.control === 'swipe' ? 'Show control buttons' : 'Hide control buttons'}</button>
      <button class="btn ghost" data-x="quit">Back to map</button>
    </div>`, { onClose: () => session && session.setPaused(false) });
  el.querySelector('[data-x=resume]').onclick = closeModal;
  el.querySelector('[data-x=restart]').onclick = () => startStage(session.level.id);
  el.querySelector('[data-x=controls]').onclick = () => {
    if (settings.control === 'swipe') settings.control = settings.lastDeck || 'dpad';
    else {
      settings.lastDeck = settings.control;
      settings.control = 'swipe';
    }
    save();
    buildDeck();
    closeModal();
    showGestureHint();
  };
  el.querySelector('[data-x=settings]').onclick = () => {
    modalOpen.onClose = null;
    openSettings(true);
  };
  el.querySelector('[data-x=quit]').onclick = () => {
    modalOpen.onClose = null;
    closeModal();
    session = null;
    showMap();
  };
  el.querySelectorAll('[data-clue]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.clue;
      closeModal();
      useClue(k);
    };
  });
}

function onDeath(s) {
  const canRewind = s.rewindLeft > 0 && s.history.length > 0;
  const el = openModal(`<h2>Out of hearts</h2>
    <p class="death-cause">${esc(s.state.lastHurt || 'You fell')}</p>
    <p class="muted">${canRewind ? 'Rewind one step, or return to the last checkpoint idol.' : 'Return to the last checkpoint idol and try again.'}</p>
    <div class="col">
      ${canRewind ? `<button class="btn primary" data-x="rewind">${icon('rewind', { fill: '#2a1804' })}Rewind</button>` : ''}
      <button class="btn ${canRewind ? '' : 'primary'}" data-x="cp">Restart from checkpoint</button>
      <button class="btn ghost" data-x="quit">Back to map</button>
    </div>`);
  const rw = el.querySelector('[data-x=rewind]');
  if (rw) {
    rw.onclick = () => {
      closeModal();
      s.over = false;
      s.rewind();
    };
  }
  el.querySelector('[data-x=cp]').onclick = () => {
    closeModal();
    s.restoreCheckpoint();
    audio.sfx('checkpoint');
  };
  el.querySelector('[data-x=quit]').onclick = () => {
    closeModal();
    session = null;
    showMap();
  };
}

function onWin(s) {
  const level = s.level;
  const res = s.results();
  const rec = profile.stages[level.id] || { stars: [false, false, false], crown: false, bestMoves: null, bestTime: null, done: false, gems: 0, red: 0 };
  const first = !rec.done;
  rec.done = true;
  rec.stars = rec.stars.map((v, i) => v || res.stars[i]);
  rec.crown = rec.crown || res.crown;
  if (!res.secret) rec.bestMoves = rec.bestMoves == null ? res.moves : Math.min(rec.bestMoves, res.moves);
  rec.bestTime = rec.bestTime == null ? res.time : Math.min(rec.bestTime, res.time);
  rec.gems = Math.max(rec.gems || 0, res.gems);
  rec.red = Math.max(rec.red || 0, res.red);
  profile.stages[level.id] = rec;
  const starN = res.stars.filter(Boolean).length;
  const coins = (first ? 50 : 10) + starN * 20 + res.bonusCoins + (res.crown ? 50 : 0);
  profile.coins += coins;
  let insight = 0;
  if (first) {
    insight = 1;
    profile.insight = Math.min(insightCap(profile), profile.insight + 1);
  }
  if (res.red) profile.shards += 1;
  for (const t of res.newTools) if (!profile.tools.includes(t)) profile.tools.push(t);
  let unlockMsg = '';
  if (level.reward && !profile.tools.includes(level.reward)) {
    profile.tools.push(level.reward);
    const tl = TOOLS[level.reward];
    unlockMsg = `Reward: the ${tl.name.toLowerCase()}. ${tl.hint}.`;
  }
  if (level.boss) {
    const w = worldOf(level.id);
    const nextW = WORLDS[WORLDS.indexOf(w) + 1];
    if (nextW && nextW.playable) unlockMsg += ` The road to ${nextW.name} is open.`;
    if (!profile.purist) unlockMsg += ' Purist difficulty unlocked.';
    profile.purist = true;
  }
  if (res.secret && level.secretExit) {
    const sid = `${level.id.split('-')[0]}-${level.secretExit}`;
    if (!profile.unlocked[sid]) unlockMsg = `Secret exit found! "${getLevel(sid).name}" is now on the map.`;
    profile.unlocked[sid] = true;
  }
  save();
  const t = Math.round(res.time / 1000);
  const next = nextStageId(level.id);
  const el = openModal(`<h2>${res.secret ? 'Secret exit!' : level.boss ? 'Guardian defeated!' : 'Stage clear!'}</h2>
    <p class="muted">${esc(level.id)} · ${esc(level.name)}${res.assisted ? ' · assisted' : ''}</p>
    <div class="big-stars"><i class="ico star"></i><i class="ico star"></i><i class="ico star"></i></div>
    ${res.crown ? `<p class="crown-line">${icon('crown')}Crown · Flawless run</p>` : ''}
    <div class="stat-grid">
      <span>Time</span><b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b>
      <span>Moves (par ${level.par})</span><b>${res.moves}</b>
      ${level.boss ? '' : `<span>Blue gems</span><b>${res.gems}/${res.gemsTotal}</b>`}
      ${res.redTotal ? `<span>Red gem</span><b>${res.red ? 'Found!' : 'Missed'}</b>` : ''}
      <span>Coins</span><b>+${coins}</b>
      ${insight ? `<span>Insight</span><b>+${insight}</b>` : ''}
    </div>
    ${unlockMsg ? `<p>${esc(unlockMsg)}</p>` : ''}
    <div class="col">
      ${next ? '<button class="btn primary" data-x="next">Next stage</button>' : ''}
      <div class="row" style="margin-top:0"><button class="btn" data-x="replay">Replay</button><button class="btn ghost" data-x="map">Map</button></div>
    </div>`);
  const stars = el.querySelectorAll('.big-stars i');
  res.stars.forEach((on, i) => {
    setTimeout(() => {
      if (on) {
        stars[i].classList.add('on');
        audio.sfx('star', { n: i });
      }
    }, 450 + i * 260);
  });
  const nx = el.querySelector('[data-x=next]');
  if (nx) nx.onclick = () => startStage(next);
  el.querySelector('[data-x=replay]').onclick = () => startStage(level.id);
  el.querySelector('[data-x=map]').onclick = () => {
    closeModal();
    session = null;
    showMap();
  };
}

function nextStageId(id) {
  const w = worldOf(id);
  const order = mainOrder(w);
  const i = order.indexOf(id);
  if (i >= 0 && i < order.length - 1) return order[i + 1];
  const boss = bossOf(w);
  if (i === order.length - 1 && boss && isUnlocked(boss)) return boss.id;
  if (boss && id === boss.id) {
    const nextW = WORLDS[WORLDS.indexOf(w) + 1];
    if (nextW && worldUnlocked(nextW)) return mainOrder(nextW)[0];
  }
  return null;
}

// ---------- loop ----------

function loop(now) {
  input.update(now);
  if (screen === 'game' && session) {
    session.update(now);
    renderer.frame(now);
  }
  requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.setMuted(true);
    if (screen === 'game' && session && !modalOpen && !session.over) openPause();
  } else {
    audio.setMuted(false);
  }
});

$('#hub-shop').onclick = () => { audio.sfx('ui'); openShop(); };
$('#hub-settings').onclick = () => { audio.sfx('ui'); openSettings(false); };
$('#hub-story').onclick = () => showComic(false);
$('#modal').addEventListener('pointerdown', (e) => {
  if (e.target.id === 'modal' && modalOpen && !(session && session.over)) closeModal();
});

// Interface art: gilded SVG icons and treasure images painted by the game's
// own high-detail gem renderer.
document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
try {
  const root = document.documentElement.style;
  root.setProperty('--gem-img', `url(${iconURL('gem')})`);
  root.setProperty('--ruby-img', `url(${iconURL('red')})`);
} catch { /* canvas unavailable: icons fall back to plain shapes */ }

applySettings();
initTitle();
requestAnimationFrame(loop);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Handy for debugging and automated smoke tests.
window.__dc = { get session() { return session; }, startStage, profile };
