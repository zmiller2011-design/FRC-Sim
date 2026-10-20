import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import { type Hole, panelWithHoles } from './panels';
import { type ElementOf, IN } from './types';

const POST = 1.5 * IN;
const LED_HEIGHT = 0.03;

/**
 * ALLIANCE WALL: DRIVER STATIONS, TOWER WALL and the OUTPOST section. Each segment has a
 * diamond-plate base, a transparent upper panel and a top rail. The OUTPOST section gets
 * openings for the OUTPOST and the floor-level CORRAL.
 */
export function buildAllianceWall(
  b: GeometryBatcher,
  wall: ElementOf<'allianceWall'>,
  outpost: ElementOf<'outpost'> | undefined,
): void {
  const d = wall.dims;
  const p = wall.pose;
  const keys = allianceKeys[wall.alliance];
  const top = d.baseHeight + d.panelHeight + d.railHeight;
  const th = d.thickness;

  // Outpost position in the wall's local frame (both share the wall's yaw).
  const outpostY = outpost ? localY(wall, outpost.pose.x, outpost.pose.y) : 0;

  for (const seg of d.segments) {
    const holes: Hole[] = [];
    if (seg.kind === 'outpost' && outpost) {
      const o = outpost.dims;
      holes.push(
        {
          y0: outpostY - o.openingWidth / 2,
          y1: outpostY + o.openingWidth / 2,
          z0: o.openingBottom,
          z1: o.openingBottom + o.openingHeight,
        },
        {
          y0: outpostY - o.corralOpeningWidth / 2,
          y1: outpostY + o.corralOpeningWidth / 2,
          z0: 0,
          z1: o.corralOpeningHeight,
        },
      );
    }
    panelWithHoles(b, 'diamondPlate', p, -th, 0, seg.from, seg.to, 0, d.baseHeight, holes);
    b.boxSpan(
      'polycarbonate',
      p,
      -th / 2 - 0.003,
      -th / 2 + 0.003,
      seg.from,
      seg.to,
      d.baseHeight,
      d.baseHeight + d.panelHeight,
    );
    b.boxSpan('aluminum', p, -th, 0, seg.from, seg.to, top - d.railHeight, top);
    b.boxSpan(
      'aluminum',
      p,
      -th,
      0,
      seg.from,
      seg.to,
      d.baseHeight - POST / 2,
      d.baseHeight + POST / 2,
    );
    // Alliance light strip along the top rail's field face.
    b.boxSpan(
      keys.led,
      p,
      0,
      0.006,
      seg.from + POST,
      seg.to - POST,
      top - d.railHeight - LED_HEIGHT,
      top - d.railHeight,
    );
    // Frame posts at each segment edge.
    for (const y of [seg.from + POST / 2, seg.to - POST / 2]) {
      b.box('aluminum', p, -th / 2, y, top / 2, th + 0.01, POST, top);
    }
    if (seg.kind === 'driverStation') {
      const width = Math.min(d.shelfWidth, seg.to - seg.from - 2 * POST);
      const mid = (seg.from + seg.to) / 2;
      b.boxSpan(
        'aluminum',
        p,
        -th - d.shelfDepth,
        -th,
        mid - width / 2,
        mid + width / 2,
        d.shelfHeight - 0.02,
        d.shelfHeight,
      );
    }
  }
}

function localY(wall: ElementOf<'allianceWall'>, x: number, y: number): number {
  const dx = x - wall.pose.x;
  const dy = y - wall.pose.y;
  return -Math.sin(wall.pose.yaw) * dx + Math.cos(wall.pose.yaw) * dy;
}
