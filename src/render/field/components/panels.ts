import type { MaterialKey } from '../FieldMaterials';
import type { Pose } from '../fieldSpace';
import type { GeometryBatcher } from '../GeometryBatcher';

export interface Hole {
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * Adds a vertical panel occupying x∈[x0,x1], y∈[y0,y1], z∈[z0,z1] in the element frame,
 * leaving rectangular holes. The panel is split on hole edges into a grid of boxes and
 * every cell that is not inside a hole is kept.
 */
export function panelWithHoles(
  b: GeometryBatcher,
  key: MaterialKey,
  pose: Pose,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  holes: readonly Hole[],
): void {
  const clip = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const ys = new Set([y0, y1]);
  const zs = new Set([z0, z1]);
  for (const h of holes) {
    ys.add(clip(h.y0, y0, y1)).add(clip(h.y1, y0, y1));
    zs.add(clip(h.z0, z0, z1)).add(clip(h.z1, z0, z1));
  }
  const yList = [...ys].sort((a, c) => a - c);
  const zList = [...zs].sort((a, c) => a - c);
  for (let i = 0; i < yList.length - 1; i++) {
    for (let j = 0; j < zList.length - 1; j++) {
      const ya = yList[i]!;
      const yb = yList[i + 1]!;
      const za = zList[j]!;
      const zb = zList[j + 1]!;
      if (yb - ya < 1e-6 || zb - za < 1e-6) continue;
      const ym = (ya + yb) / 2;
      const zm = (za + zb) / 2;
      const inHole = holes.some((h) => ym > h.y0 && ym < h.y1 && zm > h.z0 && zm < h.z1);
      if (!inHole) b.boxSpan(key, pose, x0, x1, ya, yb, za, zb);
    }
  }
}
