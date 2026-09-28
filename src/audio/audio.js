// Web Audio engine (GDD 8). Every sound is synthesised: a pulse/triangle/
// noise "Classic layer" in the spirit of old phone chips. Music is original,
// composed for this game, with base, danger and discovery stems.

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

export function noteHz(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  const midi = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

// Gem combo ladder (8.6): major pentatonic from C6.
export const GEM_LADDER = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];

// Priority when voices are scarce (8.9).
const PRIORITY = { hurt: 7, gem: 6, red: 6, warn: 5, land: 4, tool: 3, step: 1, ui: 2, other: 3 };

// ---- Songs. Lead lines are 8th notes: a note name, '-' rest, '=' hold. ----
const A_LEAD = 'E5 G5 A5 = G5 E5 D5 - C5 D5 E5 G5 E5 = = - A5 G5 E5 = D5 C5 D5 - E5 = = = = - - - ' +
  'E5 G5 A5 = C6 A5 G5 - A5 G5 E5 D5 C5 = D5 - E5 D5 C5 A4 G4 = A4 - C5 = = = = - - -';
const B_LEAD = 'A4 C5 D5 = C5 A4 G4 - A4 C5 D5 E5 D5 = = - G5 E5 D5 = C5 D5 E5 - D5 = = = = - - - ' +
  'A4 C5 D5 = E5 G5 A5 - G5 E5 D5 C5 D5 = E5 - G5 A5 G5 E5 D5 = C5 - C5 = = = = - - -';
const A_BASS = 'C C A G C F G C';
const B_BASS = 'A A G G A F G C';

const SONGS = {
  title: { bpm: 132, lead: `${A_LEAD} ${B_LEAD}`, bass: `${A_BASS} ${B_BASS}`, wave: 'pulse50', shimmer: true, drums: true },
  angkor: { bpm: 128, lead: `${A_LEAD} ${B_LEAD}`, bass: `${A_BASS} ${B_BASS}`, wave: 'pulse25', transpose: 0 },
  hub: { bpm: 96, lead: A_LEAD, bass: A_BASS, wave: 'triangle', transpose: 0, soft: true },
  secret: { bpm: 84, lead: A_LEAD, bass: A_BASS, wave: 'triangle', transpose: 12, musicBox: true },
  boss: {
    bpm: 150,
    lead: 'A4 C5 E5 = D5 C5 B4 - A4 C5 E5 G5 E5 = = - F5 E5 D5 = C5 B4 C5 - A4 = = = = - - - ' +
      'A4 C5 E5 = A5 G5 E5 - F5 E5 D5 C5 B4 = C5 - D5 C5 B4 G4 E4 = G4 - A4 = = = = - - -',
    bass: 'A A F E A F E A',
    wave: 'pulse25',
    drums: true,
    minor: true,
  },
};

function tokens(str) {
  return str.trim().split(/\s+/);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.muted = false;
    this.voices = [];
    this.song = null;
    this.songName = null;
    this.chain = 0;
    this.lastGem = 0;
    this.danger = 0;
    this.discovery = 0;
    this.exitLayer = 0;
    this.lowHeart = false;
  }

  // Browsers only allow audio after a user gesture (8.3).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    // Light band limit, like a small phone speaker.
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 70;
    this.master.connect(this.hp);
    this.hp.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.duck = ctx.createGain();
    this.musicLP = ctx.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = 18000;
    this.musicBus.connect(this.musicLP);
    this.musicLP.connect(this.duck);
    this.duck.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.stems = {};
    for (const k of ['base', 'danger', 'discovery', 'exit']) {
      const g = ctx.createGain();
      g.gain.value = k === 'base' ? 1 : 0;
      g.connect(this.musicBus);
      this.stems[k] = g;
    }
    this.waves = {
      pulse25: this.pulseWave(0.25),
      pulse50: this.pulseWave(0.5),
      pulse12: this.pulseWave(0.125),
    };
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.playMusic(p);
    }
  }

  pulseWave(duty) {
    const n = 64;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return this.ctx.createPeriodicWave(real, imag);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : this.musicVol * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : this.sfxVol * 0.9, t, 0.02);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  // ---------- low-level voices ----------

  claimVoice(prio, dur) {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= 8) {
      this.voices.sort((a, b) => a.prio - b.prio);
      if (this.voices[0].prio > prio) return false;
      const v = this.voices.shift();
      try { v.stop(); } catch { /* already stopped */ }
    }
    return true;
  }

  tone({ freq, freq2, wave = 'square', dur = 0.1, vol = 0.3, attack = 0.002, at = 0, dest, prio = 3, slide = 'exp' }) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!dest && !this.claimVoice(prio, dur)) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    if (this.waves[wave]) o.setPeriodicWave(this.waves[wave]);
    else o.type = wave;
    const jitter = dest ? 1 : 1 + (Math.random() - 0.5) * 0.06;
    o.frequency.setValueAtTime(freq * jitter, t);
    if (freq2) {
      if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2 * jitter), t + dur);
      else o.frequency.linearRampToValueAtTime(freq2 * jitter, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    if (!dest) this.voices.push({ prio, end: t + dur, stop: () => o.stop() });
  }

  noiseHit({ dur = 0.05, vol = 0.3, freq = 2000, type = 'lowpass', q = 1, at = 0, dest, prio = 3, sweep }) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!dest && !this.claimVoice(prio, dur)) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    if (!dest) this.voices.push({ prio, end: t + dur, stop: () => src.stop() });
  }

  duckMusic() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(0.6, t);
    this.duck.gain.linearRampToValueAtTime(1, t + 0.3);
  }

  // ---------- sound effects (8.5 recipes) ----------

  sfx(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const alt = (this.stepAlt = !this.stepAlt);
    switch (name) {
      case 'step': {
        const surf = { floor: 2000, earth: 900, filled: 1500, spikes: 2600, idol: 2200 }[opts.floor] || 2000;
        this.noiseHit({ dur: 0.035, vol: 0.18, freq: surf * (alt ? 1.05 : 0.95), prio: PRIORITY.step });
        break;
      }
      case 'dig':
        this.noiseHit({ dur: 0.09, vol: 0.35, freq: 800, type: 'bandpass', q: 2, prio: PRIORITY.tool });
        break;
      case 'push':
        this.noiseHit({ dur: 0.24, vol: 0.35, freq: 400, sweep: 200, prio: PRIORITY.tool });
        this.tone({ freq: 90, freq2: 55, wave: 'sine', dur: 0.12, vol: 0.3, at: 0.18, prio: PRIORITY.tool });
        break;
      case 'lean':
        this.noiseHit({ dur: 0.06, vol: 0.15, freq: 500, prio: PRIORITY.step });
        break;
      case 'wobble':
        for (let i = 0; i < 3; i++) this.noiseHit({ dur: 0.02, vol: 0.2, freq: 3500, type: 'bandpass', q: 4, at: i * 0.04, prio: PRIORITY.warn });
        break;
      case 'land':
        this.tone({ freq: 120, freq2: 50, wave: 'sine', dur: 0.22, vol: 0.55, prio: PRIORITY.land });
        this.noiseHit({ dur: 0.08, vol: 0.3, freq: 1200, prio: PRIORITY.land });
        break;
      case 'gemLand':
        this.tone({ freq: 1800, wave: 'triangle', dur: 0.05, vol: 0.1, prio: PRIORITY.land });
        break;
      case 'gem': {
        const now = performance.now();
        if (now - this.lastGem > 2000) this.chain = 0;
        this.lastGem = now;
        const f = GEM_LADDER[Math.min(this.chain, GEM_LADDER.length - 1)];
        this.chain++;
        this.tone({ freq: f, wave: 'pulse25', dur: 0.11, vol: 0.28, prio: PRIORITY.gem });
        this.tone({ freq: f * 2, wave: 'sine', dur: 0.09, vol: 0.12, at: 0.01, prio: PRIORITY.gem });
        if (this.chain === 5) this.arp(['C7', 'E7', 'G7'], 0.03, 'triangle', 0.08, 0.12);
        if (this.chain === 8) this.arp(['C7', 'D7', 'E7', 'G7', 'A7', 'C8'], 0.03, 'triangle', 0.08, 0.1);
        this.duckMusic();
        return this.chain;
      }
      case 'red':
        this.arp(['C6', 'E6', 'G6', 'A6', 'C7', 'E7'], 0.07, 'pulse25', 0.2, 0.22);
        this.tone({ freq: noteHz('E7'), wave: 'triangle', dur: 0.8, vol: 0.12, at: 0.42, prio: PRIORITY.red });
        this.duckMusic();
        break;
      case 'key':
        this.tone({ freq: noteHz('A5'), wave: 'pulse50', dur: 0.07, vol: 0.2, prio: PRIORITY.tool });
        this.tone({ freq: noteHz('E6'), wave: 'pulse50', dur: 0.1, vol: 0.2, at: 0.07, prio: PRIORITY.tool });
        break;
      case 'door':
        this.tone({ freq: 60, freq2: 180, wave: 'square', dur: 0.4, vol: 0.18, slide: 'lin', prio: PRIORITY.tool });
        this.noiseHit({ dur: 0.4, vol: 0.15, freq: 300, prio: PRIORITY.tool });
        break;
      case 'locked':
        this.tone({ freq: 140, wave: 'square', dur: 0.08, vol: 0.15, prio: PRIORITY.ui });
        break;
      case 'exitOpen':
        this.arp(['C5', 'D5', 'E5', 'G5', 'A5', 'C6'], 0.04, 'pulse25', 0.15, 0.2);
        this.noiseHit({ dur: 0.5, vol: 0.1, freq: 3000, type: 'bandpass', sweep: 8000, prio: PRIORITY.tool });
        break;
      case 'hurt':
        this.tone({ freq: 440, freq2: 220, wave: 'square', dur: 0.15, vol: 0.3, prio: PRIORITY.hurt });
        this.tone({ freq: 90, freq2: 60, wave: 'sine', dur: 0.15, vol: 0.4, prio: PRIORITY.hurt });
        this.duckMusic();
        break;
      case 'checkpoint':
        this.tone({ freq: noteHz('G5'), wave: 'triangle', dur: 0.6, vol: 0.3, prio: PRIORITY.tool });
        this.tone({ freq: noteHz('D6'), wave: 'triangle', dur: 0.5, vol: 0.15, at: 0.02, prio: PRIORITY.tool });
        break;
      case 'kill':
        this.noiseHit({ dur: 0.1, vol: 0.3, freq: 600, prio: PRIORITY.land });
        this.tone({ freq: 1600, freq2: 2400, wave: 'pulse25', dur: 0.06, vol: 0.15, at: 0.08, prio: PRIORITY.land });
        break;
      case 'spikeWarn':
        this.noiseHit({ dur: 0.03, vol: 0.12, freq: 5000, type: 'bandpass', q: 6, prio: PRIORITY.warn });
        break;
      case 'spikeUp':
        this.noiseHit({ dur: 0.05, vol: 0.15, freq: 4000, type: 'highpass', prio: PRIORITY.warn });
        break;
      case 'smash':
        this.noiseHit({ dur: 0.25, vol: 0.45, freq: 1500, sweep: 300, prio: PRIORITY.tool });
        this.tone({ freq: noteHz('E5'), wave: 'pulse50', dur: 0.05, vol: 0.12, prio: PRIORITY.tool });
        this.tone({ freq: noteHz('B4'), wave: 'pulse50', dur: 0.08, vol: 0.12, at: 0.05, prio: PRIORITY.tool });
        break;
      case 'clang':
        this.tone({ freq: 900, wave: 'square', dur: 0.05, vol: 0.12, prio: PRIORITY.tool });
        break;
      case 'pull':
        this.tone({ freq: 300, freq2: 900, wave: 'pulse25', dur: 0.12, vol: 0.15, prio: PRIORITY.tool });
        break;
      case 'lever':
      case 'gate':
        this.tone({ freq: 220, wave: 'square', dur: 0.05, vol: 0.15, prio: PRIORITY.tool });
        this.noiseHit({ dur: 0.12, vol: 0.12, freq: 700, at: 0.04, prio: PRIORITY.tool });
        break;
      case 'plate':
        this.tone({ freq: 330, freq2: 250, wave: 'triangle', dur: 0.08, vol: 0.2, prio: PRIORITY.tool });
        break;
      case 'fill':
        this.noiseHit({ dur: 0.3, vol: 0.35, freq: 600, sweep: 150, prio: PRIORITY.land });
        break;
      case 'secret':
        this.arp(['G5', 'C6', 'E6', 'G6'], 0.06, 'triangle', 0.25, 0.15);
        break;
      case 'steal':
        this.tone({ freq: 1400, freq2: 500, wave: 'pulse25', dur: 0.15, vol: 0.2, prio: PRIORITY.gem });
        break;
      case 'rewind':
        this.tone({ freq: 900, freq2: 250, wave: 'pulse25', dur: 0.2, vol: 0.18, prio: PRIORITY.ui });
        break;
      case 'tool':
        this.tone({ freq: noteHz('C6'), wave: 'pulse50', dur: 0.06, vol: 0.18, prio: PRIORITY.tool });
        this.tone({ freq: noteHz('G6'), wave: 'pulse50', dur: 0.1, vol: 0.18, at: 0.06, prio: PRIORITY.tool });
        break;
      case 'strikeWarn':
        this.tone({ freq: 180, freq2: 120, wave: 'square', dur: 0.25, vol: 0.15, prio: PRIORITY.warn });
        break;
      case 'strike':
        this.noiseHit({ dur: 0.2, vol: 0.4, freq: 900, sweep: 200, prio: PRIORITY.land });
        break;
      case 'bossHit':
        this.tone({ freq: 200, freq2: 60, wave: 'square', dur: 0.4, vol: 0.35, prio: PRIORITY.hurt });
        this.noiseHit({ dur: 0.3, vol: 0.4, freq: 1200, prio: PRIORITY.hurt });
        break;
      case 'bossDown':
        this.arp(['A4', 'C5', 'E5', 'A5', 'C6', 'E6', 'A6'], 0.09, 'pulse25', 0.25, 0.22);
        break;
      case 'ui':
        this.tone({ freq: 1800, wave: 'pulse25', dur: 0.03, vol: 0.12, prio: PRIORITY.ui });
        break;
      case 'star':
        this.tone({ freq: noteHz(['C6', 'E6', 'G6'][opts.n || 0]), wave: 'pulse25', dur: 0.25, vol: 0.22, prio: PRIORITY.gem });
        this.tone({ freq: noteHz(['C7', 'E7', 'G7'][opts.n || 0]), wave: 'triangle', dur: 0.3, vol: 0.1, prio: PRIORITY.gem });
        break;
      case 'coin':
        this.tone({ freq: noteHz('B6'), wave: 'pulse25', dur: 0.05, vol: 0.12, prio: PRIORITY.ui });
        this.tone({ freq: noteHz('E7'), wave: 'pulse25', dur: 0.12, vol: 0.12, at: 0.05, prio: PRIORITY.ui });
        break;
      default:
    }
    return undefined;
  }

  arp(notes, gap, wave, dur, vol) {
    notes.forEach((n, i) => this.tone({ freq: noteHz(n), wave, dur, vol, at: i * gap, prio: PRIORITY.red }));
  }

  jingle(kind) {
    if (!this.ctx) return;
    const bus = this.sfxBus;
    const play = (seq, bpm, wave, vol) => {
      const e = 60 / bpm / 2;
      let t = 0;
      for (const tok of tokens(seq)) {
        const [n, len] = tok.split(':');
        const l = Number(len || 1) * e;
        if (n !== '-') this.tone({ freq: noteHz(n), wave, dur: l * 0.95, vol, at: t, dest: bus });
        t += l;
      }
    };
    if (kind === 'victory') {
      play('C5 E5 G5 C6:2 G5 C6 E6:2 D6 C6 D6 E6:2 G6:4 C7:6', 200, 'pulse25', 0.18);
      play('C4:4 G3:4 A3:4 F3:2 G3:2 C4:8', 200, 'triangle', 0.3);
    } else if (kind === 'gameover') {
      play('E5:2 D5:2 C5:2 A4:6', 110, 'pulse25', 0.2);
      play('A3:12', 110, 'triangle', 0.25);
    }
  }

  // ---------- music sequencer ----------

  playMusic(name) {
    if (!this.ctx) {
      this.pending = name;
      return;
    }
    if (this.songName === name) return;
    this.songName = name;
    const def = SONGS[name];
    if (!def) {
      this.song = null;
      return;
    }
    const lead = tokens(def.lead);
    const bass = tokens(def.bass);
    this.song = { def, lead, bass, step: 0, next: this.ctx.currentTime + 0.08, len: lead.length };
  }

  stopMusic() {
    this.song = null;
    this.songName = null;
  }

  setLayers({ danger = 0, discovery = 0, exit = 0, lowHeart = false }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.stems.danger.gain.setTargetAtTime(danger, t, 0.4);
    this.stems.discovery.gain.setTargetAtTime(discovery * 0.7, t, 0.4);
    this.stems.exit.gain.setTargetAtTime(exit * 0.6, t, 0.6);
    this.musicLP.frequency.setTargetAtTime(lowHeart ? 1400 : 18000, t, 0.3);
    this.lowHeart = lowHeart;
  }

  schedule() {
    const s = this.song;
    if (!s || !this.ctx) return;
    const ctx = this.ctx;
    const e = 60 / s.def.bpm / 2; // eighth note
    while (s.next < ctx.currentTime + 0.12) {
      this.playStep(s, s.step, s.next, e);
      s.step = (s.step + 1) % s.len;
      s.next += e;
    }
  }

  playStep(s, step, t, e) {
    const def = s.def;
    const at = t - this.ctx.currentTime;
    const tr = def.transpose || 0;
    const hz = (n) => noteHz(n) * 2 ** (tr / 12);
    const tok = s.lead[step];
    if (tok !== '-' && tok !== '=') {
      let len = 1;
      while (s.lead[(step + len) % s.len] === '=' && len < 8) len++;
      const base = this.stems.base;
      if (def.musicBox) {
        this.tone({ freq: hz(tok), wave: 'triangle', dur: e * 3, vol: 0.22, at, dest: base });
        this.tone({ freq: hz(tok) * 2, wave: 'sine', dur: e * 2, vol: 0.06, at, dest: base });
      } else {
        this.tone({ freq: hz(tok), wave: def.wave, dur: e * len * 0.92, vol: def.soft ? 0.14 : 0.1, attack: 0.005, at, dest: base });
      }
      // Counter-melody joins when the exit gate opens (8.7).
      this.tone({ freq: hz(tok) / 2 * 1.5, wave: 'triangle', dur: e * len * 0.9, vol: 0.08, at, dest: this.stems.exit });
    }
    // Bouncing octave bassline (triangle), one root per bar of 8 eighths.
    const bar = Math.floor(step / 8) % s.bass.length;
    const root = s.bass[bar];
    if (!def.musicBox) {
      const oct = step % 2 === 0 ? 2 : 3;
      this.tone({ freq: hz(`${root}${oct}`), wave: 'triangle', dur: e * 0.85, vol: 0.28, at, dest: this.stems.base });
    } else if (step % 4 === 0) {
      this.tone({ freq: hz(`${root}3`), wave: 'triangle', dur: e * 3, vol: 0.12, at, dest: this.stems.base });
    }
    // Temple percussion: always on title/boss, otherwise the danger stem.
    const drumDest = def.drums ? this.stems.base : this.stems.danger;
    if (!def.musicBox) {
      if (step % 4 === 0) this.tone({ freq: 150, freq2: 45, wave: 'sine', dur: 0.12, vol: 0.45, at, dest: drumDest });
      if (step % 2 === 1) this.noiseHit({ dur: 0.03, vol: 0.12, freq: 7000, type: 'highpass', at, dest: drumDest });
      if (step % 8 === 4) this.noiseHit({ dur: 0.1, vol: 0.2, freq: 1800, type: 'bandpass', q: 1.5, at, dest: drumDest });
      if (step % 16 === 14) this.tone({ freq: 220, freq2: 160, wave: 'sine', dur: 0.1, vol: 0.25, at, dest: drumDest });
    }
    // Discovery shimmer: high arpeggio sparkles.
    if (step % 2 === 0) {
      const chord = [0, 4, 7, 12];
      const f = hz(`${root}6`) * 2 ** (chord[(step / 2) % 4] / 12);
      this.tone({ freq: f, wave: 'triangle', dur: e * 0.8, vol: 0.05, at, dest: def.shimmer ? this.stems.base : this.stems.discovery });
    }
    // Heartbeat on the last heart (8.7).
    if (this.lowHeart && step % 8 === 0) {
      this.tone({ freq: 60, freq2: 40, wave: 'sine', dur: 0.12, vol: 0.5, at, dest: this.master });
      this.tone({ freq: 55, freq2: 38, wave: 'sine', dur: 0.1, vol: 0.4, at: at + 0.18, dest: this.master });
    }
  }
}
