import { CylinderGeometry } from 'three';
import { allianceKeys } from '../FieldMaterials';
import type { GeometryBatcher } from '../GeometryBatcher';
import { type ElementOf, IN } from './types';

const POST = 2 * IN;
const PANEL = 0.015;
const KICK = 0.12;

/**
 * HUB: a 47in square body with alliance panels and corner posts, a hexagonal catcher
 * funnel up to the 72in opening, a lit rim, four FUEL exits facing the NEUTRAL ZONE and a
 * net on the neutral-zone side. Local +X faces the NEUTRAL ZONE.
 */
export function buildHub(b: GeometryBatcher, hub: ElementOf<'hub'>): void {
  const d = hub.dims;
  const p = hub.pose;
  const keys = allianceKeys[hub.alliance];
  const hw = d.width / 2;
  const bh = d.bodyHeight;

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      b.box('aluminum', p, sx * (hw - POST / 2), sy * (hw - POST / 2), bh / 2, POST, POST, bh);
    }
  }
  b.boxSpan('steelDark', p, -hw + 0.004, hw - 0.004, -hw + 0.004, hw - 0.004, 0, KICK);
  const panelZ = (KICK + bh - 0.06) / 2;
  const panelH = bh - 0.06 - KICK;
  const inner = d.width - 2 * POST;
  for (const s of [-1, 1]) {
    b.box(keys.hdpe, p, s * (hw - PANEL / 2 - 0.002), 0, panelZ, PANEL, inner, panelH);
    b.box(keys.hdpe, p, 0, s * (hw - PANEL / 2 - 0.002), panelZ, inner, PANEL, panelH);
    // Lit band below the deck.
    b.box(keys.led, p, s * (hw + 0.001), 0, bh - 0.045, 0.004, inner, 0.03);
    b.box(keys.led, p, 0, s * (hw + 0.001), bh - 0.045, inner, 0.004, 0.03);
  }
  b.boxSpan('steelDark', p, -hw, hw, -hw, hw, bh - 0.02, bh);

  // Catcher: hexagonal frustum from the deck up to the opening. Six radial segments put
  // corners on ±Y, so flats face the alliance and the NEUTRAL ZONE.
  const rTop = d.openingAcrossFlats / 2 / Math.cos(Math.PI / 6);
  const funnelH = d.height - bh;
  const funnel = new CylinderGeometry(rTop, rTop * 0.55, funnelH, 6, 1, true).rotateX(Math.PI / 2);
  b.addLocal('hubFunnel', funnel, p, 0, 0, bh + funnelH / 2, 1, 1, 1);
  funnel.dispose();
  const rim = new CylinderGeometry(rTop + 0.012, rTop + 0.012, 0.035, 6, 1, true).rotateX(
    Math.PI / 2,
  );
  b.addLocal('aluminum', rim, p, 0, 0, d.height - 0.0175, 1, 1, 1);
  rim.dispose();
  const glow = new CylinderGeometry(rTop + 0.014, rTop + 0.014, 0.025, 6, 1, true).rotateX(
    Math.PI / 2,
  );
  b.addLocal(keys.led, glow, p, 0, 0, d.height - 0.06, 1, 1, 1);
  glow.dispose();

  // FUEL exits at the base on the NEUTRAL ZONE face.
  const spacing = inner / d.exitCount;
  for (let i = 0; i < d.exitCount; i++) {
    const y = (i - (d.exitCount - 1) / 2) * spacing;
    b.box(
      'blackFrame',
      p,
      hw + 0.004,
      y,
      KICK / 2 + d.exitHeight / 2,
      0.012,
      d.exitWidth,
      d.exitHeight,
    );
    b.box('aluminum', p, hw + 0.012, y, KICK / 2, 0.01, d.exitWidth + 0.03, 0.012);
  }

  // Net behind the opening on the NEUTRAL ZONE side.
  const netH = d.netTop - d.height;
  for (const sy of [-1, 1]) {
    b.box(
      'aluminum',
      p,
      hw - POST / 2,
      sy * (hw - POST / 2),
      (bh + d.netTop) / 2,
      POST,
      POST,
      d.netTop - bh,
    );
  }
  b.box('aluminum', p, hw - POST / 2, 0, d.netTop - POST / 2, POST, d.width, POST);
  b.addLocal(
    'net',
    b.unitPlane,
    p,
    hw - POST / 2,
    0,
    d.height + netH / 2,
    netH,
    inner,
    1,
    0,
    Math.PI / 2,
  );
}
