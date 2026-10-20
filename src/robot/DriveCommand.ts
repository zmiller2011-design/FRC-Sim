/**
 * What a controller (human, autonomous or network) asks the drivetrain to do, once per
 * control tick. Velocities are in the frame selected by `fieldRelative`.
 */
export interface DriveCommand {
  /** Forward (+X) velocity request (m/s). */
  vx: number;
  /** Leftward (+Y) velocity request (m/s). */
  vy: number;
  /** Counter-clockwise angular velocity request (rad/s). */
  omega: number;
  /** true: vx/vy are in the field frame. false: in the robot frame. */
  fieldRelative: boolean;
  /** Point the wheels into an X and hold position. */
  xLock: boolean;
}

export function makeDriveCommand(): DriveCommand {
  return { vx: 0, vy: 0, omega: 0, fieldRelative: true, xLock: false };
}

export function copyDriveCommand(from: DriveCommand, to: DriveCommand): DriveCommand {
  to.vx = from.vx;
  to.vy = from.vy;
  to.omega = from.omega;
  to.fieldRelative = from.fieldRelative;
  to.xLock = from.xLock;
  return to;
}
