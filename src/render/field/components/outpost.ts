import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import { type ElementOf, IN } from './types';

const TRIM = 1.5 * IN;
const CHUTE_SLOPE = (15 * Math.PI) / 180;
const CORRAL_DEPTH = 0.45;
const CORRAL_HEIGHT = 0.45;

/**
 * OUTPOST (behind the ALLIANCE WALL): alliance trim around the opening, a sloped CHUTE
 * feeding it and a floor-level CORRAL bin. The wall openings themselves are cut by the
 * alliance-wall component. Geometry behind the wall is [APPROX].
 */
export function buildOutpost(
  b: GeometryBatcher,
  outpost: ElementOf<'outpost'>,
  wallThickness: number,
): void {
  const o = outpost.dims;
  const p = outpost.pose;
  const keys = allianceKeys[outpost.alliance];
  const hw = o.openingWidth / 2;
  const top = o.openingBottom + o.openingHeight;

  // Trim on the field face around the opening.
  b.boxSpan(keys.hdpe, p, 0, 0.008, -hw - TRIM, hw + TRIM, top, top + TRIM);
  b.boxSpan(keys.hdpe, p, 0, 0.008, -hw - TRIM, hw + TRIM, o.openingBottom - TRIM, o.openingBottom);
  for (const s of [-1, 1]) {
    b.boxSpan(
      keys.hdpe,
      p,
      0,
      0.008,
      s > 0 ? hw : -hw - TRIM,
      s > 0 ? hw + TRIM : -hw,
      o.openingBottom,
      top,
    );
  }
  b.boxSpan(keys.led, p, 0.008, 0.012, -hw, hw, top + TRIM - 0.02, top + TRIM - 0.005);

  // CHUTE tray rising away from the field.
  const run = o.chuteDepth;
  const length = run / Math.cos(CHUTE_SLOPE);
  const zMid = o.openingBottom + (run / 2) * Math.tan(CHUTE_SLOPE) - 0.006;
  b.box(
    'aluminum',
    p,
    -wallThickness - run / 2,
    0,
    zMid,
    length,
    o.openingWidth,
    0.012,
    0,
    CHUTE_SLOPE,
  );
  for (const s of [-1, 1]) {
    b.box(
      'polycarbonate',
      p,
      -wallThickness - run / 2,
      s * (hw + 0.006),
      zMid + 0.12,
      length,
      0.006,
      0.24,
      0,
      CHUTE_SLOPE,
    );
  }
  // Support legs under the chute.
  for (const s of [-1, 1]) {
    const x = -wallThickness - run + 0.03;
    const z = o.openingBottom + run * Math.tan(CHUTE_SLOPE);
    b.boxSpan('aluminum', p, x - 0.02, x + 0.02, s * hw - 0.02, s * hw + 0.02, 0, z);
  }

  // CORRAL bin at the floor behind the CORRAL opening.
  const cw = o.corralOpeningWidth / 2;
  const back = -wallThickness - CORRAL_DEPTH;
  b.boxSpan('polycarbonate', p, back, back + 0.006, -cw, cw, 0, CORRAL_HEIGHT);
  for (const s of [-1, 1]) {
    b.boxSpan(
      'polycarbonate',
      p,
      back,
      -wallThickness,
      s * cw - 0.003,
      s * cw + 0.003,
      0,
      CORRAL_HEIGHT,
    );
  }
  b.boxSpan('aluminum', p, back, -wallThickness, -cw, cw, CORRAL_HEIGHT - 0.02, CORRAL_HEIGHT);
}
