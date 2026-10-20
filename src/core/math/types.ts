/**
 * Plain math types shared by every module. They are structural on purpose so that
 * render code can pass Three.js vectors and physics code can pass Rapier vectors
 * without conversion.
 */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Robot or object pose on the field, in the WPILib field frame:
 * origin at the blue alliance wall corner, +X toward the red alliance,
 * +Y to the left when viewed from blue, heading counter-clockwise positive.
 */
export interface Pose2d {
  x: number;
  y: number;
  /** Radians. */
  heading: number;
}

/** Robot-relative velocities: vx forward, vy left, omega CCW (m/s, m/s, rad/s). */
export interface ChassisSpeeds {
  vx: number;
  vy: number;
  omega: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function pose2d(x = 0, y = 0, heading = 0): Pose2d {
  return { x, y, heading };
}

export function copyPose(from: Pose2d, out: Pose2d): Pose2d {
  out.x = from.x;
  out.y = from.y;
  out.heading = from.heading;
  return out;
}
