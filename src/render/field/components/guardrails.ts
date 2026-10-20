import type { GeometryBatcher } from '../GeometryBatcher';
import type { FieldConfig } from './types';

const ORIGIN = { x: 0, y: 0, yaw: 0 };
const PANEL_THICKNESS = 0.006;

/**
 * Guardrails along both long edges: aluminium extrusion at the top and bottom, transparent
 * polycarbonate between them and vertical posts. They sit just outside the carpet.
 */
export function buildGuardrails(b: GeometryBatcher, config: FieldConfig): void {
  const L = config.lengthM;
  const { height: h, extrusion: ext, postSpacing } = config.guardrail;
  for (const side of [0, 1]) {
    const yc = side === 0 ? -ext / 2 : config.widthM + ext / 2;
    b.box('aluminum', ORIGIN, L / 2, yc, ext / 2, L, ext, ext);
    b.box('aluminum', ORIGIN, L / 2, yc, h - ext / 2, L, ext, ext);
    b.box('polycarbonate', ORIGIN, L / 2, yc, h / 2, L, PANEL_THICKNESS, h - 2 * ext);
    const posts = Math.max(1, Math.round(L / postSpacing));
    for (let i = 0; i <= posts; i++) {
      const x = Math.min(Math.max((i * L) / posts, ext / 2), L - ext / 2);
      b.box('aluminum', ORIGIN, x, yc, h / 2, ext, ext, h);
    }
  }
}
