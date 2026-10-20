import { Matrix4, Vector3 } from 'three';

/**
 * Matrix taking field-frame coordinates (X toward red, Y left, Z up) to world coordinates
 * (Three.js, Y up): world = (fx, fz, -fy). Same mapping as core/math/frames.ts, as a matrix.
 */
export const FIELD_TO_WORLD = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

export interface Pose {
  x: number;
  y: number;
  yaw: number;
}

const tmpRotation = new Matrix4();
const zAxis = new Vector3(0, 0, 1);
const yAxis = new Vector3(0, 1, 0);

/** Field-frame matrix of an element pose: translate to (x, y), rotate yaw about +Z. */
export function poseMatrix(pose: Pose, out = new Matrix4()): Matrix4 {
  out.makeRotationAxis(zAxis, pose.yaw);
  out.setPosition(pose.x, pose.y, 0);
  return out;
}

/**
 * Local transform inside an element: translate to centre, rotate yaw (about Z) then pitch
 * (about the local Y axis), scale to size. Used with unit-sized template geometry.
 */
export function localTransform(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  yaw = 0,
  pitch = 0,
  out = new Matrix4(),
): Matrix4 {
  out.makeScale(sx, sy, sz);
  if (pitch !== 0) out.premultiply(tmpRotation.makeRotationAxis(yAxis, pitch));
  if (yaw !== 0) out.premultiply(tmpRotation.makeRotationAxis(zAxis, yaw));
  out.setPosition(cx, cy, cz);
  return out;
}

/** Composes element pose and local transform into a world matrix. */
export function toWorld(pose: Matrix4, local: Matrix4, out = new Matrix4()): Matrix4 {
  return out.copy(FIELD_TO_WORLD).multiply(pose).multiply(local);
}
