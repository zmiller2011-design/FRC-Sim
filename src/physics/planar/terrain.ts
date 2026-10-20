/**
 * A drive-over ramp shaped as a triangular prism: height rises linearly from 0 at both
 * long edges to `height` along the centre ridge (REBUILT BUMPS). Described in its own
 * frame: X across the ridge (depth), Y along it (width).
 */
export interface Ramp {
  cx: number;
  cy: number;
  angle: number;
  halfDepth: number;
  halfWidth: number;
  height: number;
}

export interface TerrainSample {
  height: number;
  /** Height gradient in the field frame (dimensionless slope). */
  gradX: number;
  gradY: number;
}

export function makeTerrainSample(): TerrainSample {
  return { height: 0, gradX: 0, gradY: 0 };
}

/** Samples the highest ramp under (x, y). Flat carpet is height 0 with no slope. */
export function sampleTerrain(
  ramps: readonly Ramp[],
  x: number,
  y: number,
  out: TerrainSample,
): TerrainSample {
  out.height = 0;
  out.gradX = 0;
  out.gradY = 0;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i]!;
    const c = Math.cos(r.angle);
    const s = Math.sin(r.angle);
    const dx = x - r.cx;
    const dy = y - r.cy;
    const lx = c * dx + s * dy;
    const ly = -s * dx + c * dy;
    if (Math.abs(lx) >= r.halfDepth || Math.abs(ly) > r.halfWidth) continue;
    const slope = r.height / r.halfDepth;
    const h = r.height - Math.abs(lx) * slope;
    if (h <= out.height) continue;
    out.height = h;
    // d h / d lx = -sign(lx) * slope; rotate back into the field frame.
    const g = (lx > 0 ? -1 : 1) * slope;
    out.gradX = c * g;
    out.gradY = s * g;
  }
  return out;
}
