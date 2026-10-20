import { ExtrudeGeometry, Matrix4, Shape, Vector2, Vector3 } from 'three';
import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import type { ElementOf } from './types';

/**
 * BUMP: a steel ridge frame topped by two alliance-coloured HDPE ramps. The ramp angle is
 * computed from the published height, depth and HDPE thickness so the ramps meet the frame
 * exactly (≈15° as specified).
 */
export function buildBump(b: GeometryBatcher, bump: ElementOf<'bump'>): void {
  const { width, depth, height, rampThickness: t } = bump.dims;
  const p = bump.pose;
  const hx = depth / 2;
  const angle0 = bump.dims.rampAngle;
  const hTop = height - t / Math.cos(angle0);
  const angle = Math.atan2(hTop, hx);

  const shape = new Shape([new Vector2(-hx, 0), new Vector2(hx, 0), new Vector2(0, hTop)]);
  const frame = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Shape X → field X, shape Y → field Z (up), extrusion → field −Y; then centre on Y.
  frame.applyMatrix4(
    new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0)),
  );
  frame.translate(0, width / 2, 0);
  b.addLocal('steelDark', frame, p, 0, 0, 0, 1, 1, 1);
  frame.dispose();

  const slope = Math.hypot(hx, hTop);
  const key = allianceKeys[bump.alliance].hdpe;
  for (const s of [-1, 1]) {
    // Outward normal of this ramp face, used to sit the slab on top of the frame.
    const nx = (s * hTop) / slope;
    const nz = hx / slope;
    b.box(
      key,
      p,
      (s * hx) / 2 + (nx * t) / 2,
      0,
      hTop / 2 + (nz * t) / 2,
      slope,
      width,
      t,
      0,
      s * angle,
    );
  }
}
