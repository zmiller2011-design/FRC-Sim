import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import { type ElementOf, IN } from './types';

const BRACE = 1.5 * IN;

/**
 * TOWER against the ALLIANCE WALL: diamond-plate base, two uprights 43.51in out from the
 * wall, LOW/MID/HIGH rungs at 27/45/63in, an alliance header and a braced back frame.
 */
export function buildTower(b: GeometryBatcher, tower: ElementOf<'tower'>): void {
  const d = tower.dims;
  const p = tower.pose;
  const keys = allianceKeys[tower.alliance];
  const ux = d.frontFaceX - d.uprightSize / 2;
  const halfSpan = d.innerOpeningWidth / 2 + d.uprightSize / 2;
  const span = d.innerOpeningWidth + 2 * d.uprightSize;

  b.boxSpan('diamondPlate', p, 0, d.depth, -d.width / 2, d.width / 2, 0, d.basePlateThickness);
  for (const sy of [-1, 1]) {
    b.box(
      'aluminum',
      p,
      ux,
      sy * halfSpan,
      d.uprightHeight / 2,
      d.uprightSize,
      d.uprightSize,
      d.uprightHeight,
    );
    // Back frame: post at the wall, top tube and a diagonal brace.
    b.box(
      'aluminum',
      p,
      BRACE / 2 + 0.01,
      sy * halfSpan,
      d.uprightHeight / 2,
      BRACE,
      BRACE,
      d.uprightHeight,
    );
    b.boxSpan(
      'aluminum',
      p,
      0.01,
      ux,
      sy * halfSpan - BRACE / 2,
      sy * halfSpan + BRACE / 2,
      d.uprightHeight - BRACE,
      d.uprightHeight,
    );
    const x0 = ux - d.uprightSize / 2;
    const z0 = 0.12;
    const x1 = BRACE + 0.01;
    const z1 = d.uprightHeight * 0.72;
    const length = Math.hypot(x0 - x1, z1 - z0);
    b.box(
      'aluminum',
      p,
      (x0 + x1) / 2,
      sy * halfSpan,
      (z0 + z1) / 2,
      length,
      BRACE,
      BRACE,
      0,
      Math.atan2(-(z1 - z0), x1 - x0),
    );
  }
  for (const z of d.rungHeights) {
    b.addLocal(
      'aluminum',
      b.unitCylinder,
      p,
      ux,
      0,
      z,
      2 * d.rungRadius,
      2 * d.rungRadius,
      span + 0.02,
      Math.PI / 2,
      Math.PI / 2,
    );
  }
  b.box(
    keys.hdpe,
    p,
    ux,
    0,
    (d.uprightHeight + d.height) / 2,
    d.uprightSize + 0.01,
    span,
    d.height - d.uprightHeight,
  );
  b.box(
    keys.led,
    p,
    ux + d.uprightSize / 2 + 0.006,
    0,
    d.uprightHeight + 0.02,
    0.004,
    span - 0.06,
    0.025,
  );
}
