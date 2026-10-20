import type { GeometryBatcher } from '../GeometryBatcher';
import type { FieldConfig } from './types';

const Z = 0.0008;

/**
 * Soft dark patches under large structures. They ground the field elements visually when
 * real shadows are off (Low/Medium presets) at the cost of one transparent draw call.
 */
export function buildContactShadows(b: GeometryBatcher, config: FieldConfig): void {
  for (const e of config.elements) {
    const p = e.pose;
    switch (e.type) {
      case 'hub':
        b.addLocal(
          'contactShadow',
          b.unitPlane,
          p,
          0,
          0,
          Z,
          e.dims.width * 1.7,
          e.dims.width * 1.7,
          1,
        );
        break;
      case 'bump':
        b.addLocal(
          'contactShadow',
          b.unitPlane,
          p,
          0,
          0,
          Z,
          e.dims.depth * 1.5,
          e.dims.width * 1.2,
          1,
        );
        break;
      case 'trench': {
        const y = e.dims.openingWidth + e.dims.legWidth / 2;
        b.addLocal(
          'contactShadow',
          b.unitPlane,
          p,
          0,
          y,
          Z,
          e.dims.depth * 1.6,
          e.dims.legWidth * 2.4,
          1,
        );
        break;
      }
      case 'tower':
        b.addLocal(
          'contactShadow',
          b.unitPlane,
          p,
          e.dims.depth / 2,
          0,
          Z,
          e.dims.depth * 1.5,
          e.dims.width * 1.4,
          1,
        );
        break;
      default:
        break;
    }
  }
}
