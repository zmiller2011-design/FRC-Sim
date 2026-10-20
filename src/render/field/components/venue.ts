import type { GeometryBatcher } from '../GeometryBatcher';
import type { FieldConfig } from './types';

const ORIGIN = { x: 0, y: 0, yaw: 0 };
const DRAPE_HEIGHT = 1.1;
const TRUSS_Z = 9;

/**
 * Arena surroundings: pipe-and-drape around the playing area, an overhead lighting truss
 * with light panels, and low audience risers along one side. Kept dark and simple so the
 * field stays the focus.
 */
export function buildVenue(b: GeometryBatcher, config: FieldConfig): void {
  const L = config.lengthM;
  const W = config.widthM;
  const margin = 4.6;
  const x0 = -margin;
  const x1 = L + margin;
  const y0 = -2.6;
  const y1 = W + 2.6;

  b.boxSpan('drape', ORIGIN, x0, x1, y0 - 0.03, y0, 0, DRAPE_HEIGHT);
  b.boxSpan('drape', ORIGIN, x0, x1, y1, y1 + 0.03, 0, DRAPE_HEIGHT);
  b.boxSpan('drape', ORIGIN, x0 - 0.03, x0, y0, y1, 0, DRAPE_HEIGHT);
  b.boxSpan('drape', ORIGIN, x1, x1 + 0.03, y0, y1, 0, DRAPE_HEIGHT);
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ] as const) {
    b.box('steelDark', ORIGIN, x, y, (DRAPE_HEIGHT + 0.1) / 2, 0.05, 0.05, DRAPE_HEIGHT + 0.1);
  }

  // Lighting truss along both sidelines (outside the field footprint so it never blocks
  // the overhead view), with light panels facing down.
  for (const y of [-2.2, W + 2.2]) {
    b.boxSpan('steelDark', ORIGIN, -2, L + 2, y - 0.2, y + 0.2, TRUSS_Z, TRUSS_Z + 0.4);
    for (let i = 0; i < 8; i++) {
      const x = ((i + 0.5) / 8) * L;
      b.box('steelDark', ORIGIN, x, y, TRUSS_Z - 0.08, 1.3, 0.7, 0.16);
      b.box('lightPanel', ORIGIN, x, y, TRUSS_Z - 0.165, 1.2, 0.6, 0.01);
    }
  }

  // Audience risers behind the far guardrail.
  for (let step = 0; step < 6; step++) {
    const y = W + 5 + step * 0.9;
    b.boxSpan('drape', ORIGIN, -1, L + 1, y, y + 0.9, 0, 0.45 * (step + 1));
  }
}
