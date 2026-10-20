import type { MarkingLine } from '@/field/types';
import type { MaterialKey } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import type { ElementOf, FieldConfig } from './types';

const ORIGIN = { x: 0, y: 0, yaw: 0 };
const TAPE_Z = 0.0015;

const TAPE_KEYS: Record<MarkingLine['color'], MaterialKey> = {
  white: 'tapeWhite',
  blue: 'tapeBlue',
  red: 'tapeRed',
};

/** Field carpet, ALLIANCE AREA flooring behind each wall, the arena floor and all tape lines. */
export function buildFloor(b: GeometryBatcher, config: FieldConfig): void {
  const L = config.lengthM;
  const W = config.widthM;
  b.addLocal('carpet', b.unitPlane, ORIGIN, L / 2, W / 2, 0, L, W, 1);
  b.addLocal('arenaFloor', b.unitPlane, ORIGIN, L / 2, W / 2, -0.004, L + 80, W + 70, 1);

  for (const e of config.elements) {
    if (e.type !== 'allianceWall') continue;
    const wall: ElementOf<'allianceWall'> = e;
    const d = wall.dims;
    const depth = d.areaDepth;
    // In the wall's local frame the alliance area lies behind the wall (negative X).
    b.addLocal(
      'allianceArea',
      b.unitPlane,
      wall.pose,
      -d.thickness - depth / 2,
      W / 2,
      -0.001,
      depth,
      W,
      1,
    );
  }

  for (const line of config.markings) {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const length = Math.hypot(dx, dy);
    b.addLocal(
      TAPE_KEYS[line.color],
      b.unitPlane,
      ORIGIN,
      (line.start.x + line.end.x) / 2,
      (line.start.y + line.end.y) / 2,
      TAPE_Z,
      length,
      line.width,
      1,
      Math.atan2(dy, dx),
    );
  }
}
