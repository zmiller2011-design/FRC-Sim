import type { DriverAxes } from './DriverAxes';
import { deadband, shapeStick } from './shaping';

export interface GamepadShaping {
  deadband: number;
  /** Response exponent for translation and rotation (2 = squared). */
  exponent: number;
}

// Standard mapping (Xbox / PlayStation layouts via the Gamepad API).
const AXIS_LX = 0;
const AXIS_LY = 1;
const AXIS_RX = 2;
const BUTTON_X = 2;
const BUTTON_LB = 4;

/**
 * Reads the first connected gamepad with the standard mapping. Polled once per control
 * tick (the Gamepad API has no events for stick movement).
 */
export class GamepadSource {
  private readonly stick: [number, number] = [0, 0];
  /** Name of the gamepad read on the last poll, or null. */
  connected: string | null = null;

  constructor(private readonly shaping: GamepadShaping = { deadband: 0.1, exponent: 2 }) {}

  read(out: DriverAxes): void {
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected && p.mapping === 'standard') {
        pad = p;
        break;
      }
    }
    this.connected = pad?.id ?? null;
    if (!pad) return;
    const { deadband: db, exponent } = this.shaping;
    // Stick up is −Y on the Gamepad API.
    shapeStick(-(pad.axes[AXIS_LY] ?? 0), -(pad.axes[AXIS_LX] ?? 0), db, exponent, this.stick);
    out.forward += this.stick[0];
    out.left += this.stick[1];
    const rx = deadband(-(pad.axes[AXIS_RX] ?? 0), db);
    out.rotate += Math.sign(rx) * Math.abs(rx) ** exponent;
    out.precision ||= pad.buttons[BUTTON_LB]?.pressed ?? false;
    out.xLock ||= pad.buttons[BUTTON_X]?.pressed ?? false;
  }
}
