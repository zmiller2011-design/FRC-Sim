import type { Disposable } from '@/core';
import type { DriverAxes } from './DriverAxes';
import { GamepadSource } from './GamepadSource';
import { KeyboardSource } from './KeyboardSource';

const clampUnit = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

/** Combines keyboard and gamepad into one {@link DriverAxes} sample per control tick. */
export class DriverInput implements Disposable {
  readonly keyboard: KeyboardSource;
  readonly gamepad = new GamepadSource();

  constructor(target: Window = window) {
    this.keyboard = new KeyboardSource(target);
  }

  sample(out: DriverAxes): DriverAxes {
    out.forward = 0;
    out.left = 0;
    out.rotate = 0;
    out.precision = false;
    out.xLock = false;
    this.keyboard.read(out);
    this.gamepad.read(out);
    out.forward = clampUnit(out.forward);
    out.left = clampUnit(out.left);
    out.rotate = clampUnit(out.rotate);
    // Keyboard diagonals would otherwise be √2 faster than straight lines.
    const magnitude = Math.hypot(out.forward, out.left);
    if (magnitude > 1) {
      out.forward /= magnitude;
      out.left /= magnitude;
    }
    return out;
  }

  dispose(): void {
    this.keyboard.dispose();
  }
}
