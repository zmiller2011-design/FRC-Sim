import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import { type ElementOf, IN } from './types';

const TUBE = 2 * IN;

/**
 * TRENCH: an arm spanning the 50.34in opening from the guardrail at 22.25in clearance,
 * carrying AprilTags on both faces, and an inner leg up to the BUMP. Local +Y runs from the
 * guardrail toward the field centre.
 */
export function buildTrench(b: GeometryBatcher, trench: ElementOf<'trench'>): void {
  const d = trench.dims;
  const p = trench.pose;
  const keys = allianceKeys[trench.alliance];
  const hd = d.depth / 2;
  const ow = d.openingWidth;
  const legEnd = ow + d.legWidth;

  // Arm across the opening.
  b.boxSpan(
    keys.hdpe,
    p,
    -d.armThickness / 2,
    d.armThickness / 2,
    0,
    ow,
    d.openingHeight + TUBE,
    d.height - TUBE,
  );
  b.boxSpan(
    'aluminum',
    p,
    -d.armThickness / 2 - 0.004,
    d.armThickness / 2 + 0.004,
    0,
    ow,
    d.openingHeight,
    d.openingHeight + TUBE,
  );

  // Top frame: rectangle over the whole structure.
  for (const sx of [-1, 1]) {
    b.boxSpan(
      'aluminum',
      p,
      sx * hd - TUBE / 2,
      sx * hd + TUBE / 2,
      0,
      legEnd,
      d.height - TUBE,
      d.height,
    );
  }
  for (const y of [TUBE / 2, ow, legEnd - TUBE / 2]) {
    b.boxSpan('aluminum', p, -hd, hd, y - TUBE / 2, y + TUBE / 2, d.height - TUBE, d.height);
  }
  // Mounting posts just outside the guardrail so the opening stays clear.
  for (const sx of [-1, 1]) {
    b.boxSpan(
      'aluminum',
      p,
      sx * hd - TUBE / 2,
      sx * hd + TUBE / 2,
      -TUBE - 0.04,
      -0.04,
      0,
      d.height,
    );
  }

  // Inner leg: corner posts with alliance panels.
  for (const sx of [-1, 1]) {
    for (const y of [ow + TUBE / 2, legEnd - TUBE / 2]) {
      b.box(
        'aluminum',
        p,
        sx * (hd - TUBE / 2),
        y,
        (d.height - TUBE) / 2,
        TUBE,
        TUBE,
        d.height - TUBE,
      );
    }
    b.boxSpan(
      keys.hdpe,
      p,
      sx * (hd - 0.012),
      sx * (hd - 0.002),
      ow + TUBE,
      legEnd - TUBE,
      0.08,
      d.height - TUBE,
    );
  }
  b.boxSpan('steelDark', p, -hd, hd, ow, legEnd, 0, 0.08);
}
