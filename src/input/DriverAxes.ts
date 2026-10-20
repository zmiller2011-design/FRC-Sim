/**
 * Normalised driver intent for one control tick, independent of the device.
 * All axes are in [-1, 1] from the driver's point of view.
 */
export interface DriverAxes {
  /** Away from the driver (+) / toward the driver (−). */
  forward: number;
  /** To the driver's left (+) / right (−). */
  left: number;
  /** Counter-clockwise (+) / clockwise (−). */
  rotate: number;
  /** Slow, precise driving. */
  precision: boolean;
  /** Hold position with the wheels in an X. */
  xLock: boolean;
}

export function makeDriverAxes(): DriverAxes {
  return { forward: 0, left: 0, rotate: 0, precision: false, xLock: false };
}
