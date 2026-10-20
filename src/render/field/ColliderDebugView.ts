import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  type Object3D,
  Vector3,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Disposable } from '@/core';
import type { ColliderDesc } from '@/field/types';
import { FIELD_TO_WORLD } from './fieldSpace';

/**
 * Wireframe of the simplified collision shapes, merged into one line draw call. Built on
 * first use so it costs nothing unless enabled. Shows that collision geometry is separate
 * from (and much simpler than) the visual meshes.
 */
export class ColliderDebugView implements Disposable {
  private readonly lines: LineSegments;
  private readonly material = new LineBasicMaterial({
    color: 0x35f2a6,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });

  constructor(parent: Object3D, colliders: readonly ColliderDesc[]) {
    const parts: BufferGeometry[] = [];
    const m = new Matrix4();
    const r = new Matrix4();
    const box = new BoxGeometry(1, 1, 1);
    const cylinder = new CylinderGeometry(0.5, 0.5, 1, 12, 1).rotateX(Math.PI / 2);
    for (const c of colliders) {
      let source: BufferGeometry;
      if (c.kind === 'box') {
        m.makeScale(c.halfExtents.x * 2, c.halfExtents.y * 2, c.halfExtents.z * 2);
        if (c.pitch) m.premultiply(r.makeRotationY(c.pitch));
        m.premultiply(r.makeRotationZ(c.yaw));
        m.setPosition(c.center.x, c.center.y, c.center.z);
        source = box;
      } else if (c.kind === 'cylinder') {
        m.makeScale(c.radius * 2, c.radius * 2, c.halfLength * 2);
        if (c.axis === 'horizontal') {
          m.premultiply(r.makeRotationY(Math.PI / 2));
          m.premultiply(r.makeRotationZ(c.yaw));
        }
        m.setPosition(c.center.x, c.center.y, c.center.z);
        source = cylinder;
      } else {
        m.identity();
        source = new ConvexGeometry(c.points.map((p) => new Vector3(p.x, p.y, p.z)));
      }
      const edges = new EdgesGeometry(source, 20);
      edges.applyMatrix4(m.clone().premultiply(FIELD_TO_WORLD));
      parts.push(edges);
      if (c.kind === 'convex') source.dispose();
    }
    box.dispose();
    cylinder.dispose();
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    this.lines = new LineSegments(merged ?? undefined, this.material);
    this.lines.name = 'colliders';
    this.lines.renderOrder = 10;
    this.lines.visible = false;
    parent.add(this.lines);
  }

  set visible(value: boolean) {
    this.lines.visible = value;
  }

  get shapeCount(): number {
    return this.lines.geometry.getAttribute('position')?.count ?? 0;
  }

  dispose(): void {
    this.lines.removeFromParent();
    this.lines.geometry.dispose();
    this.material.dispose();
  }
}
