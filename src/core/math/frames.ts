import type { Vec3 } from './types';

/**
 * The single place where field coordinates meet world coordinates.
 *
 * Field frame (WPILib): right-handed, X toward red, Y left, Z up.
 * World frame (Three.js / Rapier): right-handed, Y up.
 *
 *   world.x =  field.x
 *   world.y =  field.z
 *   world.z = -field.y
 *
 * This is a proper rotation (-90° about X), so a field heading θ (CCW about +Z)
 * is a rotation of θ about world +Y.
 */
export function fieldToWorld(fx: number, fy: number, fz: number, out: Vec3): Vec3 {
  out.x = fx;
  out.y = fz;
  out.z = -fy;
  return out;
}

/** Inverse of {@link fieldToWorld}. Writes field coordinates into `out`. */
export function worldToField(wx: number, wy: number, wz: number, out: Vec3): Vec3 {
  out.x = wx;
  out.y = -wz;
  out.z = wy;
  return out;
}

/** Field heading (CCW about +Z) to world yaw (rotation about +Y). */
export function fieldHeadingToWorldYaw(heading: number): number {
  return heading;
}
