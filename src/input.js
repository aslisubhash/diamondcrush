// All input sources feed one buffered move (GDD 9.6): keyboard, gamepad,
// the touch control deck (D-pad, joystick, classic keypad) and swipes.
import { HOLD_DELAY_MS } from './engine/constants.js';

const KEY_DIRS = {
  ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
  KeyW: 'U', KeyS: 'D', KeyA: 'L', KeyD: 'R',
  Digit2: 'U', Digit8: 'D', Digit4: 'L', Digit6: 'R',
  Numpad2: 'D', Numpad8: 'U', Numpad4: 'L', Numpad6: 'R',
};

export class Input {
  constructor(actions) {
    this.a = actions; // { move(dir), tool(), cycle(step), rewind(), pause(), preview(on), lantern(), active() }
    this.held = []; // stack of held directions (most recent last)
    this.nextRepeat = 0;
    this.stepMs = 150;
    this.pad = { dirs: new Set(), buttons: [] };
    this.bindKeys();
  }

  // ---------- held directions and hold-to-walk ----------

  press(dir, source = 'x') {
    const id = `${source}:${dir}`;
    if (this.held.some((h) => h.id === id)) return;
    this.held.push({ id, dir });
    this.a.move(dir);
    this.nextRepeat = performance.now() + HOLD_DELAY_MS;
  }

  release(dir, source = 'x') {
    const id = `${source}:${dir}`;
    this.held = this.held.filter((h) => h.id !== id);
  }

  releaseSource(source) {
    this.held = this.held.filter((h) => !h.id.startsWith(`${source}:`));
  }

  clear() {
    this.held = [];
  }

  update(now) {
    this.pollGamepad();
    if (!this.held.length || !this.a.active()) return;
    if (now >= this.nextRepeat) {
      this.a.move(this.held[this.held.length - 1].dir);
      this.nextRepeat = now + this.stepMs;
    }
  }

  // ---------- keyboard ----------

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const dir = KEY_DIRS[e.code];
      if (dir && !e.repeat) {
        if (this.a.active()) this.press(dir, 'k');
        e.preventDefault();
        return;
      }
      if (dir) {
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      switch (e.code) {
        case 'Space': case 'Digit5': case 'Numpad5': case 'Enter':
          if (this.a.active()) { this.a.tool(); e.preventDefault(); }
          break;
        case 'KeyX': case 'KeyC': case 'Digit9': case 'Numpad9': this.a.swap?.(); break;
        case 'KeyQ': this.a.cycle(-1); break;
        case 'KeyE': this.a.cycle(1); break;
        case 'NumpadMultiply': this.a.cycle(-1); break;
        case 'NumpadDivide': this.a.cycle(1); break;
        case 'KeyZ': case 'Backspace': case 'Digit0': case 'Numpad0':
          this.a.rewind();
          e.preventDefault();
          break;
        case 'KeyM': case 'Tab': case 'Digit1': case 'Numpad1':
          this.a.preview(true);
          e.preventDefault();
          break;
        case 'KeyL': this.a.lantern(); break;
        case 'Escape': case 'KeyP': case 'Digit3': case 'Numpad3':
          this.a.pause();
          e.preventDefault();
          break;
        default:
          if (e.key === '*') this.a.cycle(-1);
          if (e.key === '#') this.a.cycle(1);
      }
    });
    window.addEventListener('keyup', (e) => {
      const dir = KEY_DIRS[e.code];
      if (dir) this.release(dir, 'k');
      if (['KeyM', 'Tab', 'Digit1', 'Numpad1'].includes(e.code)) this.a.preview(false);
    });
    window.addEventListener('blur', () => {
      this.clear();
      this.a.preview(false);
    });
  }

  // ---------- gamepad (browser Gamepad API) ----------

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    const dirs = new Set();
    if (b(12) || ay < -0.5) dirs.add('U');
    if (b(13) || ay > 0.5) dirs.add('D');
    if (b(14) || ax < -0.5) dirs.add('L');
    if (b(15) || ax > 0.5) dirs.add('R');
    for (const d of dirs) if (!this.pad.dirs.has(d) && this.a.active()) this.press(d, 'g');
    for (const d of this.pad.dirs) if (!dirs.has(d)) this.release(d, 'g');
    this.pad.dirs = dirs;
    const prev = this.pad.buttons;
    const now = gp.buttons.map((x) => x.pressed);
    const edge = (i) => now[i] && !prev[i];
    if (edge(0)) this.a.tool();
    if (edge(1)) this.a.rewind();
    if (edge(4)) this.a.cycle(-1);
    if (edge(5)) this.a.cycle(1);
    if (edge(9)) this.a.pause();
    if (edge(3)) this.a.preview(true);
    if (edge(2)) this.a.swap?.();
    if (!now[3] && prev[3]) this.a.preview(false);
    this.pad.buttons = now;
  }

  // ---------- swipes on the game window ----------

  bindSwipe(el) {
    let start = null;
    el.addEventListener('pointerdown', (e) => {
      if (!this.a.active()) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: null };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) < 22) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
      if (dir !== start.dir) {
        if (start.dir) this.release(start.dir, 's');
        start.dir = dir;
        this.press(dir, 's');
      }
      // Re-anchor so the finger can change direction mid-swipe.
      start.x = e.clientX;
      start.y = e.clientY;
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (start.dir) this.release(start.dir, 's');
      start = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- on-screen deck ----------

  bindHoldButton(el, dir, source) {
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('down');
      if (this.a.active()) this.press(dir, source);
      this.a.haptic?.(6);
    };
    const up = () => {
      el.classList.remove('down');
      this.release(dir, source);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  bindTapButton(el, fn, onUp) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('down');
      this.a.haptic?.(6);
      fn();
    });
    const up = () => {
      el.classList.remove('down');
      if (onUp) onUp();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  // Floating joystick: appears where the thumb lands, snaps to 4 directions
  // with a 20% dead zone (GDD 2, control deck modes).
  bindJoystick(zone, knob, base) {
    let st = null;
    const R = 56;
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null };
      base.style.left = `${e.clientX - r.left}px`;
      base.style.top = `${e.clientY - r.top}px`;
      base.classList.add('on');
      knob.style.transform = 'translate(-50%, -50%)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      let dx = e.clientX - st.x;
      let dy = e.clientY - st.y;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      let dir = null;
      if (d > R * 0.2) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
      if (dir !== st.dir) {
        if (st.dir) this.release(st.dir, 'j');
        st.dir = dir;
        if (dir && this.a.active()) this.press(dir, 'j');
      }
    });
    const end = (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (st.dir) this.release(st.dir, 'j');
      st = null;
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}
