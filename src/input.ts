import { AIM_LIMIT, ARENA } from './config';
import type { Shooter } from './game';

/**
 * Touch first:
 *   left 40% of the screen  — drag sideways to slide along the rail
 *   right 60% of the screen — hold to fire, drag sideways to aim
 * Mouse: cursor aims, hold button to fire, A/D or arrows move.
 * Keyboard: A/D or arrows move, Q/E nudge aim, Space fires.
 */
export class Input {
  enabled = false;
  /** 'touch' once a finger is seen, so the HUD can show the right hints */
  mode: 'touch' | 'mouse' = 'ontouchstart' in window ? 'touch' : 'mouse';
  onFirstInput: (() => void) | null = null;

  private moveTouch: { id: number; x0: number; s0: number } | null = null;
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
      if (e.button === 0) this.mouseDown = true;
      this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);
      return;
    }
    this.mode = 'touch';
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety; input still works without it
    }
    const leftZone = e.clientX - r.left < r.width * 0.4;
    if (leftZone && !this.moveTouch) {
      this.moveTouch = { id: e.pointerId, x0: e.clientX, s0: this.player.x };
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
    }
    if (this.aimTouch?.id === e.pointerId) this.aimTouch = null;
  };

  private keydown = (e: KeyboardEvent) => {
    this.first();
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
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
    const left = k.has('KeyA') || k.has('ArrowLeft');
    const right = k.has('KeyD') || k.has('ArrowRight');
    if (!this.moveTouch) {
      p.moveAxis = (right ? 1 : 0) - (left ? 1 : 0);
      if (left || right) p.moveTarget = null;
    }
    if (k.has('KeyQ')) p.aim -= 1.8 * dt;
    if (k.has('KeyE')) p.aim += 1.8 * dt;

    if (this.mode === 'mouse' && this.mouseWorld && !k.has('KeyQ') && !k.has('KeyE')) {
      const dy = this.mouseWorld.y - p.y;
      if (dy > 0.5) p.aim = Math.atan2(this.mouseWorld.x - p.x, dy);
    }
    p.firing = !!this.aimTouch || this.mouseDown || k.has('Space');
  }
}
