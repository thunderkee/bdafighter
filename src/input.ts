import { AIM_LIMIT, ARENA } from './config';
import type { Shooter } from './game';
import { DEFAULT_SETTINGS, type Settings } from './storage';

const AIM_TURN_RATE = 1.7; // rad/s when left/right turn the aim
const TRIPLE_ANGLE = 0.42; // radians for the front-left / front-right fire buttons

/**
 * Touch first:
 *   left 40% of the screen  — drag sideways to slide along the rail
 *   right 60% of the screen — tap to fire, hold to charge a big shot, drag sideways to aim
 * Buttons layout: on-screen ◀ ▶ and FIRE replace the gesture zones.
 * Mouse (can be switched off): cursor aims, hold button to fire.
 * Keyboard: A/D or arrows move (or turn aim, per settings), Q/E nudge aim, Space fires.
 */
type PadButton = 'left' | 'right' | 'fire' | 'down' | 'fireL' | 'fireR';

/**
 * On-screen pad that tracks every finger on it. Which button a finger holds
 * is re-read from the element under it on each move, so sliding between
 * buttons works, and held state is derived fresh every frame — nothing else
 * in the game can "forget" a button that is physically still pressed.
 * Browser gestures (iOS pinch, long-press callouts) are blocked on the pad,
 * since they cancel touches mid-hold.
 */
export class PadTracker {
  private fingers = new Map<number, PadButton | null>();
  /** the finger working the move slider (if any) and where it is along the track, 0..1 */
  private sliderId: number | null = null;
  private sliderU = 0.5;

  constructor(private el: HTMLElement) {
    const opts = { passive: false } as const;
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // stop the browser turning a two-thumb hold into a pinch/zoom or callout
    for (const t of ['touchstart', 'touchmove', 'touchend'] as const) el.addEventListener(t, (e) => e.preventDefault(), opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault(), opts);
    // backup: if a lift lands somewhere other than the pad, still release that finger
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
  }

  /** which buttons are held, for the debug readout */
  debug() {
    return [...this.fingers.values()].filter(Boolean).join(',') || '-';
  }

  onPress: (() => void) | null = null;

  /**
   * The button under a finger, or — if the thumb has slipped into a gap or
   * just off an edge — the nearest visible button within a thumb's reach.
   */
  private buttonAt(x: number, y: number): PadButton | null {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('.pad-btn');
    if (hit) return (hit.dataset.btn as PadButton | undefined) ?? null;
    let best: PadButton | null = null;
    let bestD = 44; // px of slack around each button
    for (const el of this.el.querySelectorAll<HTMLElement>('.pad-btn')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue; // hidden (single vs triple fire)
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = el.dataset.btn as PadButton;
      }
    }
    return best;
  }

  /** 0..1 along the slider track for a screen x */
  private trackU(x: number) {
    const track = this.el.querySelector<HTMLElement>('.pad-slider .track');
    const r = track?.getBoundingClientRect();
    if (!r || !r.width) return 0.5;
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  }

  /** where the slider finger is (0..1), or null when nobody is touching it */
  slider() {
    return this.sliderId === null ? null : this.sliderU;
  }

  private down = (e: PointerEvent) => {
    // the move slider owns any touch that starts on it (never a nearby button)
    const onSlider = (e.target as Element | null)?.closest?.('.pad-slider') || document.elementFromPoint(e.clientX, e.clientY)?.closest('.pad-slider');
    if (onSlider && this.sliderId === null) {
      e.preventDefault();
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        // still tracked without capture
      }
      this.sliderId = e.pointerId;
      this.sliderU = this.trackU(e.clientX);
      this.onPress?.();
      return;
    }
    const b = this.buttonAt(e.clientX, e.clientY);
    if (!b) return;
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // still tracked without capture
    }
    this.fingers.set(e.pointerId, b);
    this.onPress?.();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId === this.sliderId) {
      this.sliderU = this.trackU(e.clientX);
      return;
    }
    if (!this.fingers.has(e.pointerId)) return;
    // slide between buttons; a finger that drifts off keeps its last button
    const b = this.buttonAt(e.clientX, e.clientY);
    if (b) this.fingers.set(e.pointerId, b);
  };

  private up = (e: PointerEvent) => {
    this.fingers.delete(e.pointerId);
    if (e.pointerId === this.sliderId) this.sliderId = null;
  };

  held(name: PadButton) {
    for (const b of this.fingers.values()) if (b === name) return true;
    return false;
  }

  /** forget every finger (pause / leaving the match) */
  clear() {
    this.fingers.clear();
    this.sliderId = null;
  }
}

export class Input {
  enabled = false;
  /** 'touch' once a finger is seen, so the HUD can show the right hints */
  mode: 'touch' | 'mouse' = 'ontouchstart' in window ? 'touch' : 'mouse';
  onFirstInput: (() => void) | null = null;
  /** F key, right-click, or the ITEM button */
  onUseItem: (() => void) | null = null;
  settings: Settings = { ...DEFAULT_SETTINGS };
  /** held state of the on-screen buttons, refreshed from the pad every tick */
  buttons = { left: false, right: false, fire: false, down: false, fireL: false, fireR: false };
  pad: PadTracker | null = null;

  private moveTouch: { id: number; x0: number; y0: number; s0: number } | null = null;
  /** gestures: dragging the move thumb downward raises the shield */
  private shieldDrag = false;
  private aimTouch: { id: number; x0: number; a0: number } | null = null;
  private mouseDown = false;
  private keys = new Set<string>();
  private mouseWorld: { x: number; y: number } | null = null;

  constructor(
    private el: HTMLElement,
    private player: Shooter,
    private screenToWorld: (cx: number, cy: number) => { x: number; y: number } | null,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.release());
  }

  release() {
    this.keys.clear();
    this.moveTouch = this.aimTouch = null;
    this.mouseDown = false;
    for (const k of Object.keys(this.buttons) as (keyof typeof this.buttons)[]) this.buttons[k] = false;
    this.shieldDrag = false;
    this.player.shielding = false;
    this.player.firing = false;
    this.player.moveTarget = null;
    this.player.moveAxis = 0;
  }

  private first() {
    if (this.onFirstInput) {
      this.onFirstInput();
      this.onFirstInput = null;
    }
  }

  private down = (e: PointerEvent) => {
    this.first();
    if (!this.enabled) return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      this.mode = 'mouse';
      if (!this.settings.mouseAim) return;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.onUseItem?.();
      this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);
      return;
    }
    this.mode = 'touch';
    if (this.settings.layout === 'buttons') return;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety; input still works without it
    }
    const leftZone = e.clientX - r.left < r.width * 0.4;
    if (leftZone && !this.moveTouch) {
      this.moveTouch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, s0: this.player.x };
    } else if (!this.aimTouch) {
      this.aimTouch = { id: e.pointerId, x0: e.clientX, a0: this.player.aim };
    }
  };

  private move = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);
      return;
    }
    const r = this.el.getBoundingClientRect();
    if (this.moveTouch?.id === e.pointerId) {
      // a ~55% screen-width swipe covers the whole rail
      const perPx = (ARENA.railHalfWidth * 2) / (r.width * 0.55);
      this.player.moveTarget = this.moveTouch.s0 + (e.clientX - this.moveTouch.x0) * perPx;
      this.shieldDrag = e.clientY - this.moveTouch.y0 > 36;
    } else if (this.aimTouch?.id === e.pointerId) {
      const perPx = (AIM_LIMIT * 2) / (r.width * 0.6);
      this.player.aim = this.aimTouch.a0 + (e.clientX - this.aimTouch.x0) * perPx;
      // re-anchor at the clamp so reversing direction responds immediately
      if (Math.abs(this.player.aim) > AIM_LIMIT) {
        this.player.aim = Math.sign(this.player.aim) * AIM_LIMIT;
        this.aimTouch.a0 = this.player.aim;
        this.aimTouch.x0 = e.clientX;
      }
    }
  };

  private up = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouseDown = false;
      return;
    }
    if (this.moveTouch?.id === e.pointerId) {
      this.moveTouch = null;
      this.player.moveTarget = null;
      this.shieldDrag = false;
    }
    if (this.aimTouch?.id === e.pointerId) this.aimTouch = null;
  };

  private keydown = (e: KeyboardEvent) => {
    this.first();
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && this.enabled) this.onUseItem?.();
    this.keys.add(e.code);
  };

  /** Called once per fixed tick before the game steps. */
  update(dt: number) {
    const p = this.player;
    if (!this.enabled) {
      p.firing = false;
      return;
    }
    const k = this.keys;
    const b = this.buttons;
    if (this.pad) for (const name of Object.keys(b) as PadButton[]) b[name] = this.pad.held(name);
    // slider: the thumb's spot on the track is a spot in the robot's lane
    const slide = this.settings.layout === 'buttons' && this.settings.moveControl === 'slider' ? this.pad?.slider() ?? null : null;
    if (slide !== null) {
      // the slider spans the whole rail (pack-mates are passed, not blocked)
      const lo = -ARENA.railHalfWidth;
      const hi = ARENA.railHalfWidth;
      p.moveTarget = lo + slide * (hi - lo);
      p.moveAxis = 0;
    }
    const left = k.has('KeyA') || k.has('ArrowLeft') || b.left;
    const right = k.has('KeyD') || k.has('ArrowRight') || b.right;
    const axis = (right ? 1 : 0) - (left ? 1 : 0);
    const turning = this.settings.arrows === 'aim';
    if (!this.moveTouch && slide === null) {
      p.moveAxis = turning ? 0 : axis;
      if (axis && !turning) p.moveTarget = null;
    }
    if (turning) p.aim += axis * AIM_TURN_RATE * dt;
    if (k.has('KeyQ')) p.aim -= AIM_TURN_RATE * dt;
    if (k.has('KeyE')) p.aim += AIM_TURN_RATE * dt;
    // key/button aiming wins until the mouse moves again
    if ((turning && axis) || k.has('KeyQ') || k.has('KeyE')) this.mouseWorld = null;

    if (this.settings.mouseAim && this.mode === 'mouse' && this.mouseWorld) {
      const dy = this.mouseWorld.y - p.y;
      if (dy > 0.5) p.aim = Math.atan2(this.mouseWorld.x - p.x, dy);
    }
    // triple fire buttons aim for you: front-left, front, front-right
    if (b.fireL) p.aim = -TRIPLE_ANGLE;
    else if (b.fireR) p.aim = TRIPLE_ANGLE;
    else if (b.fire && this.settings.fireButtons === 'triple') p.aim = 0;
    p.firing = !!this.aimTouch || (this.settings.mouseAim && this.mouseDown) || k.has('Space') || b.fire || b.fireL || b.fireR;
    p.shielding = b.down || k.has('KeyS') || k.has('ArrowDown') || this.shieldDrag;
  }
}
