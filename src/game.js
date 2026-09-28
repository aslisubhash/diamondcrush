// A running stage: owns the simulation state, the two clocks (hero steps
// and the 400 ms background tick, GDD 9.1), the input buffer, rewind
// history, checkpoints, and turns engine events into sound and feedback.
import { createState, act, cloneState, cycleTool, currentTool, remaining } from './engine/sim.js';
import { parseMoves } from './engine/replay.js';
import { DIFFICULTIES, BG_TICK_MS, KEY_SHAPES, TOOLS } from './engine/constants.js';
import { predictFalls } from './engine/sim.js';
import { stepMs, upgradeLevel } from './save.js';
import { toolsBefore } from './levels/index.js';


export class GameSession {
  constructor({ level, profile, settings, renderer, audio, hooks, autoplay = false }) {
    this.level = level;
    this.profile = profile;
    this.settings = settings;
    this.renderer = renderer;
    this.audio = audio;
    this.hooks = hooks;
    const difficulty = profile.difficulty || 'classic';
    this.diff = DIFFICULTIES[difficulty];
    const maxHearts = this.diff.hearts + upgradeLevel(profile, 'heart');
    // Tools come from the profile plus anything earlier levels hand out, so
    // replays, the Spirit guide and jumps between worlds never lack one.
    // The Spirit guide replays with exactly the tools its solution was tested with.
    const tools = autoplay ? toolsBefore(level.id) : [...new Set([...toolsBefore(level.id), ...profile.tools])];
    this.state = createState(level, { difficulty, tools, maxHearts, lead: profile.lead });
    this.rewindCap = this.diff.rewind === Infinity ? Infinity : this.diff.rewind + 5 * upgradeLevel(profile, 'rewind');
    this.rewindLeft = this.rewindCap;
    this.rewindsUsed = 0;
    this.history = [];
    this.checkpoint = cloneState(this.state);
    this.buffer = null;
    this.nextHeroAt = 0;
    this.lastTickAt = 0;
    this.stepMs = stepMs(profile);
    this.bgMs = BG_TICK_MS * this.diff.bgScale;
    this.paused = false;
    this.over = false;
    this.elapsed = 0;
    this.assisted = autoplay;
    this.autoplay = autoplay ? parseMoves(level.solution) : null;
    this.autoIndex = 0;
    this.tipsShown = new Set();
    this.hurtsSinceHint = 0;
    this.hitStopUntil = 0;
  }

  start(now) {
    this.lastTickAt = now;
    this.lastFrame = now;
    this.renderer.setState(this.state, this.level, now);
    this.renderer.keenEye = upgradeLevel(this.profile, 'eye') > 0;
    this.audio.playMusic(this.level.boss ? `boss-${this.level.world}` : this.level.secret ? `secret-${this.level.world}` : this.level.world);
    this.updateLayers();
    this.hooks.onHud(this);
    this.checkTips();
  }

  // ---------- input ----------

  queueMove(dir) {
    if (this.over || this.paused || this.autoplay) return;
    this.buffer = { type: 'move', dir };
  }

  queueTool() {
    if (this.over || this.paused || this.autoplay) return;
    if (!currentTool(this.state)) {
      this.hooks.toast('No tool yet');
      return;
    }
    this.buffer = { type: 'tool' };
  }

  swap() {
    if (this.over || this.paused || this.autoplay) return;
    if (!this.state.partner) return;
    this.buffer = { type: 'swap' };
  }

  cycle(step) {
    if (cycleTool(this.state, step)) {
      this.audio.sfx('ui');
      this.hooks.onHud(this);
    }
  }

  rewind() {
    if (this.over || this.autoplay) return false;
    if (this.rewindLeft <= 0 || !this.history.length) {
      this.hooks.toast(this.rewindCap === 0 ? 'No rewinds in this mode' : 'No rewinds left');
      return false;
    }
    this.state = this.history.pop();
    this.state.events = [];
    this.rewindLeft--;
    this.rewindsUsed++;
    this.renderer.state = this.state;
    this.renderer.snapTo(performance.now());
    this.audio.sfx('rewind');
    this.buffer = null;
    this.hooks.onHud(this);
    return true;
  }

  // Revive from the last checkpoint idol with full hearts (3.5).
  restoreCheckpoint() {
    this.state = cloneState(this.checkpoint);
    this.state.hero.hearts = this.state.hero.maxHearts;
    this.state.hero.invul = 0;
    this.state.status = 'play';
    this.state.events = [];
    this.history = [];
    this.rewindLeft = this.rewindCap;
    this.renderer.state = this.state;
    this.renderer.snapTo(performance.now());
    this.over = false;
    this.buffer = null;
    this.lastTickAt = performance.now();
    this.hooks.onHud(this);
  }

  setPaused(p) {
    this.paused = p;
    if (!p) {
      this.lastTickAt = performance.now();
      this.lastFrame = performance.now();
    }
  }

  // ---------- clocks ----------

  update(now) {
    const dt = now - (this.lastFrame || now);
    this.lastFrame = now;
    if (this.paused || this.over) return;
    this.elapsed += dt;
    if (now < this.hitStopUntil) return;

    if (this.autoplay) {
      if (now - this.lastTickAt >= this.stepMs + 40) {
        if (this.autoIndex >= this.autoplay.length) return;
        const a = this.autoplay[this.autoIndex++];
        if (a && a.type === 'face') {
          this.state.hero.dir = a.dir;
          return;
        }
        if (a && a.type === 'cycle') {
          cycleTool(this.state, a.step);
          this.hooks.onHud(this);
          return;
        }
        this.step(a, now);
      }
      return;
    }

    if (this.buffer && now >= this.nextHeroAt) {
      const a = this.buffer;
      this.buffer = null;
      this.step(a, now);
      this.nextHeroAt = now + this.stepMs;
    } else if (now - this.lastTickAt >= this.bgMs) {
      this.step(null, now);
    }
  }

  step(action, now) {
    const s = this.state;
    const snap = action ? cloneState(s) : null;
    this.renderer.capture();
    const interval = now - this.lastTickAt;
    const ticked = act(s, action);
    if (!ticked) {
      this.bumpFeedback(s.events);
      return false;
    }
    if (snap) {
      this.history.push(snap);
      if (this.history.length > 40) this.history.shift();
    }
    this.lastTickAt = now;
    this.renderer.afterTick(s.events, now, action ? Math.min(interval, this.stepMs) : interval);
    this.handleEvents(s.events, now);
    this.updateLayers();
    this.hooks.onHud(this);
    this.checkTips();
    if (s.status === 'dead') this.onDeath();
    else if (s.status === 'won') this.onWin();
    return true;
  }

  bumpFeedback(events) {
    for (const e of events) {
      if (e.type === 'locked') {
        this.audio.sfx('locked');
        this.hooks.toast(`Locked: needs the ${e.color} key (${KEY_SHAPES[e.color]})`);
      } else if (e.type === 'exitShut') {
        this.audio.sfx('locked');
        const s = this.state;
        const msg = s.boss && s.boss.alive ? 'The gate is sealed while the guardian lives' : `The gate needs ${s.quota} gems (${s.gems}/${s.quota})`;
        this.hooks.toast(msg);
      } else if (e.type === 'clang') {
        this.audio.sfx('clang');
      }
    }
  }

  handleEvents(events, now) {
    const a = this.audio;
    const s = this.state;
    const near = (e, r) => Math.abs(e.x - s.hero.x) + Math.abs(e.y - s.hero.y) <= r;
    const types = new Set(events.map((e) => e.type));
    for (const e of events) {
      switch (e.type) {
        case 'step':
          if (!types.has('dig') && !types.has('gem')) a.sfx('step', { floor: e.floor });
          this.hooks.haptic(8);
          break;
        case 'dig': a.sfx('dig'); break;
        case 'push': a.sfx('push'); this.hooks.haptic(20); break;
        case 'lean': a.sfx('lean'); break;
        case 'wobble': if (near(e, 7)) a.sfx('wobble'); break;
        case 'land':
          if (near(e, 8)) a.sfx(e.heavy ? 'land' : 'gemLand');
          if (e.heavy) this.hitStopUntil = Math.max(this.hitStopUntil, now + (near(e, 3) ? 40 : 0));
          break;
        case 'gem': a.sfx('gem'); this.hooks.haptic(10); break;
        case 'red': a.sfx('red'); this.hooks.haptic([20, 40, 20]); break;
        case 'key': a.sfx('key'); break;
        case 'door': a.sfx('door'); break;
        case 'exitOpen': a.sfx('exitOpen'); this.hooks.toast(s.boss ? 'The gate is open!' : 'Quota reached: the exit gate is open!'); break;
        case 'hurt':
          a.sfx('hurt');
          this.hooks.haptic(60);
          this.hurtsSinceHint++;
          if (this.hurtsSinceHint >= 3 && this.settings.hints && this.profile.difficulty !== 'purist') {
            this.hurtsSinceHint = 0;
            this.hooks.toast('Stuck? Try the lantern clue, or hold M for the rock-fall preview', 4000);
          }
          break;
        case 'crush': this.hitStopUntil = now + 60; this.hooks.haptic(80); break;
        case 'checkpoint':
          if (!e.silent) a.sfx('checkpoint');
          this.checkpoint = cloneState(s);
          this.rewindLeft = this.rewindCap;
          if (!e.silent) this.hooks.toast('Checkpoint saved');
          break;
        case 'kill': a.sfx('kill'); this.hitStopUntil = now + 60; this.hooks.haptic(40); break;
        case 'spikeWarn': if (near(e, 2)) a.sfx('spikeWarn'); break;
        case 'spikeUp': if (near(e, 1)) a.sfx('spikeUp'); break;
        case 'smash': a.sfx('smash'); this.hooks.haptic(30); break;
        case 'pull': a.sfx('pull'); break;
        case 'lever': a.sfx('lever'); break;
        case 'gateOpen': case 'gateClose': if (near(e, 8)) a.sfx('gate'); break;
        case 'plateDown': a.sfx('plate'); break;
        case 'fill': a.sfx('fill'); break;
        case 'secret': a.sfx('secret'); this.hooks.toast('A secret passage!'); break;
        case 'steal': a.sfx('steal'); this.hooks.toast('A stone monkey stole a gem! Corner it to get it back'); break;
        case 'gemBack': a.sfx('gem'); break;
        case 'toolGet':
          a.sfx('tool');
          this.hooks.toast(`${TOOLS[e.tool] ? TOOLS[e.tool].name : e.tool} found! ${TOOLS[e.tool] ? TOOLS[e.tool].hint : ''}`, 4500);
          break;
        case 'heal': a.sfx('checkpoint'); break;
        case 'crumble': a.sfx('dig'); break;
        case 'strikeWarn': a.sfx('strikeWarn'); break;
        case 'strike': a.sfx('strike'); break;
        case 'bossHit': a.sfx('bossHit'); this.hitStopUntil = now + 60; this.hooks.haptic(80); break;
        case 'bossPhase': this.hooks.toast(`Phase ${e.phase}! Hearts restored`, 2500); break;
        case 'bossDown': a.sfx('bossDown'); this.hooks.toast('The guardian falls! Reach the gate'); break;
        case 'bossBump': a.sfx('land'); this.hooks.haptic(60); break;
        case 'chargeWarn': case 'breathWarn': case 'cannonWarn': a.sfx('strikeWarn'); break;
        case 'breath': case 'cannon': a.sfx('strike'); break;
        case 'jam': a.sfx('bossHit'); break;
        case 'ignite': a.sfx('ignite'); break;
        case 'burn': a.sfx('burn'); break;
        case 'scorch': if (near(e, 6)) a.sfx('spikeUp'); break;
        case 'jet': if (near(e, 5)) a.sfx('jet'); break;
        case 'jetWarn': if (near(e, 4)) a.sfx('spikeWarn'); break;
        case 'freeze': a.sfx('freeze'); break;
        case 'melt': if (near(e, 5)) a.sfx('melt'); break;
        case 'turnMirror': a.sfx('lever'); break;
        case 'bell': a.sfx('bell'); this.hooks.toast(`Enemies frozen! ${e.left} ring${e.left === 1 ? '' : 's'} left`, 1500); break;
        case 'disc': a.sfx('disc'); break;
        case 'switch': a.sfx('lever'); break;
        case 'swap': a.sfx('swap'); break;
        case 'slide': if (!types.has('gem')) a.sfx('slide'); break;
        case 'gust': case 'convey': if (e.hero) a.sfx('lean'); break;
        case 'spit': if (near(e, 5)) a.sfx('spit'); break;
        case 'alert': a.sfx('alert'); break;
        case 'avalanche': if (near(e, 6)) a.sfx('dig'); break;
        case 'ventWarn': if (near(e, 4)) a.sfx('wobble'); break;
        case 'poof': if (near(e, 6)) a.sfx('dig'); break;
        case 'trace': a.sfx('ui'); break;
        case 'kolamReset': a.sfx('locked'); this.hooks.toast('The pattern broke. Trace it without crossing your path'); break;
        case 'kolamDone': case 'latch': a.sfx('secret'); break;
        case 'collapse': if (near(e, 6)) a.sfx('fill'); break;
        case 'flood': case 'drain': if (near(e, 8)) a.sfx('door'); break;
        case 'sensorOn': a.sfx('checkpoint'); break;
        case 'fallPit': a.sfx('kill'); break;
        case 'lost': a.sfx('ui'); break;
        case 'shatter': if (near(e, 8)) a.sfx('land'); break;
        default:
      }
    }
  }

  updateLayers() {
    const s = this.state;
    const h = s.hero;
    const d = (x, y) => Math.abs(x - h.x) + Math.abs(y - h.y);
    let danger = s.enemies.some((e) => e.alive && d(e.x, e.y) <= 4) ? 1 : 0;
    s.obj.forEach((o, i) => {
      if (o && (o.st === 'wobble' || o.st === 'fall') && d(i % s.w, Math.floor(i / s.w)) <= 4) danger = 1;
    });
    let discovery = 0;
    for (let y = h.y - 3; y <= h.y + 3; y++) {
      for (let x = h.x - 3; x <= h.x + 3; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h || d(x, y) > 3) continue;
        const i = y * s.w + x;
        if (s.floor[i] === 'false' || s.floor[i] === 'sexit' || (s.obj[i] && s.obj[i].t === 'red')) discovery = 1;
      }
    }
    const exit = s.gems >= s.quota && s.quota > 0 ? 1 : 0;
    this.audio.setLayers({ danger, discovery, exit, lowHeart: h.hearts === 1 && h.maxHearts > 1 });
  }

  bellLeft() {
    return this.state.hero.bell;
  }

  checkTips() {
    if (!this.settings.hints || this.profile.difficulty === 'purist') return;
    const tips = this.level.tips || [];
    const h = this.state.hero;
    for (const [n, t] of tips.entries()) {
      if (this.tipsShown.has(n)) continue;
      if (Math.abs(t.x - h.x) + Math.abs(t.y - h.y) <= 1) {
        this.tipsShown.add(n);
        this.hooks.tip(t.text);
      }
    }
  }

  onDeath() {
    this.over = true;
    this.audio.jingle('gameover');
    setTimeout(() => this.hooks.onDeath(this), 500);
  }

  onWin() {
    this.over = true;
    this.audio.jingle('victory');
    setTimeout(() => this.hooks.onWin(this), 700);
  }

  // ---------- clues (5.2) ----------

  journal() {
    const s = this.state;
    const r = remaining(s);
    const lines = [];
    lines.push(`${r.gems} blue gem${r.gems === 1 ? '' : 's'} left in this stage (${s.gems}/${s.quota} for the gate).`);
    if (s.redTotal) lines.push(s.red ? 'You found the red gem.' : 'A red gem is hidden here, behind a secret or a puzzle.');
    const keys = Object.entries(s.hero.keys).filter(([, n]) => n > 0).map(([c]) => c);
    if (keys.length) lines.push(`Keys held: ${keys.join(', ')}.`);
    if (this.level.secretExit) lines.push('Legends speak of a second way out of this stage.');
    const cracked = s.floor.some((f, i) => f === 'cracked' && Math.abs((i % s.w) - s.hero.x) + Math.abs(Math.floor(i / s.w) - s.hero.y) < 8);
    if (cracked && !s.hero.tools.includes('hammer')) lines.push('Cracked walls nearby. A hammer would open them.');
    return lines;
  }

  useLantern() {
    this.renderer.lantern = performance.now() + 2600;
    this.audio.sfx('secret');
  }

  useCompass() {
    this.renderer.compass = performance.now() + 4000;
    this.audio.sfx('ui');
  }

  setPreview(on) {
    this.renderer.preview = on ? predictFalls(this.state) : null;
  }

  // ---------- results ----------

  results() {
    const s = this.state;
    const lvl = this.level;
    const allGems = s.gems >= s.gemsTotal;
    const redOk = s.redTotal > 0 && s.red >= s.redTotal;
    const par = s.moves <= lvl.par && !this.assisted;
    let stars;
    if (s.exitKind === 'secret') stars = [true, false, false];
    else if (lvl.boss) stars = [true, s.hurts === 0, par];
    else stars = [true, allGems, redOk || par];
    const crown = s.exitKind !== 'secret' && allGems && (s.redTotal === 0 || redOk) && s.hurts === 0 && this.rewindsUsed === 0 && !this.assisted;
    return {
      stars,
      crown,
      moves: s.moves,
      time: this.elapsed,
      gems: s.gems,
      gemsTotal: s.gemsTotal,
      red: s.red,
      redTotal: s.redTotal,
      kills: s.kills,
      bonusCoins: s.coins,
      secret: s.exitKind === 'secret',
      newTools: s.newTools,
      assisted: this.assisted,
    };
  }
}
