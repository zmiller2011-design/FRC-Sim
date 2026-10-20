import type { Vec3 } from '@/core';
import type { BoxCollider, ConvexCollider, CylinderCollider, ElementPose } from './types';

/** Transforms a point from an element's local frame into the field frame. */
export function localToField(pose: ElementPose, lx: number, ly: number, lz: number): Vec3 {
  const c = Math.cos(pose.yaw);
  const s = Math.sin(pose.yaw);
  return { x: pose.x + c * lx - s * ly, y: pose.y + s * lx + c * ly, z: lz };
}

/**
 * The red-alliance counterpart of a blue pose. REBUILT is point-symmetric: red elements
 * are blue ones rotated 180° about the field centre.
 */
export function mirrorPose(pose: ElementPose, lengthM: number, widthM: number): ElementPose {
  return { x: lengthM - pose.x, y: widthM - pose.y, yaw: normalizeYaw(pose.yaw + Math.PI) };
}

function normalizeYaw(yaw: number): number {
  const wrapped = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  // Keep exact multiples of π/2 clean so configs compare and print predictably.
  const quarter = Math.round(wrapped / (Math.PI / 2));
  return Math.abs(wrapped - quarter * (Math.PI / 2)) < 1e-12 ? quarter * (Math.PI / 2) : wrapped;
}

/**
 * Collider builders that take element-local coordinates. Every shape is described by its
 * local centre and size, then placed with the element's pose.
 */
export function localBox(
  owner: string,
  pose: ElementPose,
  center: Vec3,
  size: Vec3,
  pitch?: number,
): BoxCollider {
  const box: BoxCollider = {
    kind: 'box',
    owner,
    center: localToField(pose, center.x, center.y, center.z),
    halfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
    yaw: pose.yaw,
  };
  if (pitch !== undefined) box.pitch = pitch;
  return box;
}

/** A cylinder lying along the element's local Y axis (e.g. a rung between two uprights). */
export function localCylinderY(
  owner: string,
  pose: ElementPose,
  center: Vec3,
  radius: number,
  length: number,
): CylinderCollider {
  return {
    kind: 'cylinder',
    owner,
    center: localToField(pose, center.x, center.y, center.z),
    radius,
    halfLength: length / 2,
    axis: 'horizontal',
    yaw: pose.yaw + Math.PI / 2,
  };
}

export function localConvex(owner: string, pose: ElementPose, points: Vec3[]): ConvexCollider {
  return {
    kind: 'convex',
    owner,
    points: points.map((p) => localToField(pose, p.x, p.y, p.z)),
  };
}
