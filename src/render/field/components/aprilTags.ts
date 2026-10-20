import { Matrix4, PlaneGeometry, Vector3 } from 'three';
import type { GeometryBatcher } from '../GeometryBatcher';
import { FIELD_TO_WORLD } from '../fieldSpace';
import type { TagAtlas } from '../textures';
import { type FieldConfig, IN } from './types';

const BACKING_SIZE = 10.5 * IN;
const BACKING_THICKNESS = 0.25 * IN;

/**
 * All 32 AprilTags at their official poses, with real tag36h11 patterns from the atlas,
 * mounted on thin backing plates. The printed size is the black square; the white quiet
 * zone adds one cell on each side (10/8 of the printed size).
 */
export function buildAprilTags(b: GeometryBatcher, config: FieldConfig, atlas: TagAtlas): void {
  const quad = config.aprilTagSizeM * (10 / 8);
  // Plane basis: image right → field +Y, image up → field +Z, normal → field +X.
  const basis = new Matrix4().makeBasis(
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1),
    new Vector3(1, 0, 0),
  );
  const world = new Matrix4();
  const yaw = new Matrix4();

  for (const tag of config.aprilTags) {
    const heading = (tag.yawDeg * Math.PI) / 180;
    const nx = Math.cos(heading);
    const ny = Math.sin(heading);
    const pose = { x: tag.x, y: tag.y, yaw: heading };

    // Backing plate: front face 0.5 mm in front of the tag plane, extending back.
    b.box(
      'tagBacking',
      pose,
      0.0005 - BACKING_THICKNESS / 2,
      0,
      tag.z,
      BACKING_THICKNESS,
      BACKING_SIZE,
      BACKING_SIZE,
    );

    const [u0, v0, u1, v1] = atlas.uvRect(tag.id);
    const plane = new PlaneGeometry(quad, quad);
    const uv = plane.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    yaw.makeRotationZ(heading);
    world
      .copy(FIELD_TO_WORLD)
      .multiply(new Matrix4().makeTranslation(tag.x + nx * 0.0015, tag.y + ny * 0.0015, tag.z))
      .multiply(yaw)
      .multiply(basis);
    b.addWorld('tags', plane, world);
    plane.dispose();
  }
}
