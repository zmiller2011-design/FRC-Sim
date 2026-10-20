import type { Obb, PlanarWorldOptions, Ramp } from '@/physics/planar';
import type { ColliderDesc, FieldConfig } from './types';

export interface RobotEnvelope {
  /** Robot's maximum height (m). Obstacles entirely above it are driven under. */
  heightM: number;
  /** Bumper bottom height (m). Obstacles entirely below it are driven over. */
  groundClearanceM: number;
}

/**
 * Projects the field's 3D collision shapes onto the carpet for planar robot physics.
 *
 * - The carpet rectangle is the boundary (alliance walls and guardrails), handled exactly
 *   by the solver so fast robots can't tunnel through thin wall colliders.
 * - A shape blocks the robot only if its height range overlaps the robot's: a 20in robot
 *   passes under the 22.25in TRENCH arm and TOWER rungs and over DEPOT barriers.
 * - BUMPS become drive-over ramps rather than walls.
 */
export function buildPlanarWorldOptions(
  config: FieldConfig,
  robot: RobotEnvelope,
): PlanarWorldOptions {
  const obstacles: Obb[] = [];
  for (const c of config.colliders) {
    if (isBoundary(c)) continue;
    const box = footprint(c);
    if (!box) continue;
    if (box.zMax <= robot.groundClearanceM || box.zMin >= robot.heightM) continue;
    obstacles.push(box.obb);
  }
  const ramps: Ramp[] = [];
  for (const e of config.elements) {
    if (e.type !== 'bump') continue;
    ramps.push({
      cx: e.pose.x,
      cy: e.pose.y,
      angle: e.pose.yaw,
      halfDepth: e.dims.depth / 2,
      halfWidth: e.dims.width / 2,
      height: e.dims.height,
    });
  }
  return {
    bounds: { minX: 0, maxX: config.lengthM, minY: 0, maxY: config.widthM },
    obstacles,
    ramps,
  };
}

function isBoundary(c: ColliderDesc): boolean {
  return c.owner.startsWith('guardrail') || c.owner.endsWith('-wall');
}

function footprint(c: ColliderDesc): { obb: Obb; zMin: number; zMax: number } | null {
  switch (c.kind) {
    case 'box':
      if (c.pitch) return null; // No pitched solid boxes on this field.
      return {
        obb: {
          cx: c.center.x,
          cy: c.center.y,
          hx: c.halfExtents.x,
          hy: c.halfExtents.y,
          angle: c.yaw,
        },
        zMin: c.center.z - c.halfExtents.z,
        zMax: c.center.z + c.halfExtents.z,
      };
    case 'cylinder':
      if (c.axis === 'z') {
        return {
          obb: { cx: c.center.x, cy: c.center.y, hx: c.radius, hy: c.radius, angle: 0 },
          zMin: c.center.z - c.halfLength,
          zMax: c.center.z + c.halfLength,
        };
      }
      return {
        obb: { cx: c.center.x, cy: c.center.y, hx: c.halfLength, hy: c.radius, angle: c.yaw },
        zMin: c.center.z - c.radius,
        zMax: c.center.z + c.radius,
      };
    case 'convex':
      // Convex shapes are the BUMPS, handled as ramps.
      return null;
  }
}
