import type { Disposable } from '@/core';
import type { DriverAxes } from './DriverAxes';

/** Keys that drive the robot. Arrow keys mirror WASD. */
export const DRIVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  rotateLeft: ['KeyQ'],
  rotateRight: ['KeyE'],
  precision: ['ShiftLeft', 'ShiftRight'],
  xLock: ['Space'],
} as const;

const ALL_KEYS = new Set<string>(Object.values(DRIVE_KEYS).flat());
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'number', 'password', 'tel', 'url']);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

/**
 * Tracks which drive keys are held. Events only update a set; the simulation reads it once
 * per control tick via {@link read}, never from inside event handlers.
 */
export class KeyboardSource implements Disposable {
  private readonly down = new Set<string>();

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    // Releasing keys while the window is unfocused would otherwise leave them "held".
    target.addEventListener('blur', this.onBlur);
  }

  /** Adds keyboard intent into `out` (axes are summed with other devices, then clamped). */
  read(out: DriverAxes): void {
    const held = (codes: readonly string[]) => codes.some((c) => this.down.has(c));
    out.forward += (held(DRIVE_KEYS.forward) ? 1 : 0) - (held(DRIVE_KEYS.back) ? 1 : 0);
    out.left += (held(DRIVE_KEYS.left) ? 1 : 0) - (held(DRIVE_KEYS.right) ? 1 : 0);
    out.rotate += (held(DRIVE_KEYS.rotateLeft) ? 1 : 0) - (held(DRIVE_KEYS.rotateRight) ? 1 : 0);
    out.precision ||= held(DRIVE_KEYS.precision);
    out.xLock ||= held(DRIVE_KEYS.xLock);
  }

  get activeKeyCount(): number {
    return this.down.size;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.down.clear();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!ALL_KEYS.has(e.code) || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Stop the page scrolling on arrows/space while driving.
    e.preventDefault();
    this.down.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
  };
}
