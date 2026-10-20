import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Disposable } from '@/core';
import type { FieldMaterials, MaterialKey } from './FieldMaterials';
import { localTransform, poseMatrix, type Pose, toWorld } from './fieldSpace';

/**
 * Collects static field geometry and merges it into one mesh per material, so the whole
 * static field costs roughly one draw call per material instead of one per part.
 *
 * Template geometries are unit-sized and defined in the field frame (Z up). Parts are
 * transformed into world space at load time; nothing here runs per frame.
 */
export class GeometryBatcher implements Disposable {
  private readonly parts = new Map<MaterialKey, BufferGeometry[]>();

  /** Unit box (1 × 1 × 1) centred on the origin. */
  readonly unitBox = new BoxGeometry(1, 1, 1);
  /** Unit cylinder along field +Z, radius 0.5, height 1. */
  readonly unitCylinder = new CylinderGeometry(0.5, 0.5, 1, 20, 1).rotateX(Math.PI / 2);
  /** Unit floor quad facing +Z. */
  readonly unitPlane = new PlaneGeometry(1, 1);

  private readonly local = new Matrix4();
  private readonly world = new Matrix4();

  /** Adds `template` transformed by `world` (a full world matrix). */
  addWorld(key: MaterialKey, template: BufferGeometry, world: Matrix4): void {
    const part = template.index ? template.toNonIndexed() : template.clone();
    part.applyMatrix4(world);
    if (!part.getAttribute('uv')) {
      part.setAttribute(
        'uv',
        new Float32BufferAttribute(new Float32Array(part.getAttribute('position').count * 2), 2),
      );
    }
    for (const name of Object.keys(part.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') part.deleteAttribute(name);
    }
    part.clearGroups();
    const list = this.parts.get(key);
    if (list) list.push(part);
    else this.parts.set(key, [part]);
  }

  /** Adds a template placed in an element's local frame. */
  addLocal(
    key: MaterialKey,
    template: BufferGeometry,
    pose: Pose,
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    yaw = 0,
    pitch = 0,
  ): void {
    localTransform(cx, cy, cz, sx, sy, sz, yaw, pitch, this.local);
    this.addWorld(key, template, toWorld(poseMatrix(pose), this.local, this.world));
  }

  /** Box in element-local coordinates, given by its centre and full size. */
  box(
    key: MaterialKey,
    pose: Pose,
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    yaw = 0,
    pitch = 0,
  ): void {
    this.addLocal(key, this.unitBox, pose, cx, cy, cz, sx, sy, sz, yaw, pitch);
  }

  /** Box given by local min/max corners (axis-aligned in the element frame). */
  boxSpan(
    key: MaterialKey,
    pose: Pose,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
  ): void {
    this.box(
      key,
      pose,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      (z0 + z1) / 2,
      Math.abs(x1 - x0),
      Math.abs(y1 - y0),
      Math.abs(z1 - z0),
    );
  }

  /** Builds one merged mesh per material. Call once. */
  build(materials: FieldMaterials): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const spec = materials.spec(key);
      if (spec.worldUvTile) applyWorldUVs(merged, spec.worldUvTile);
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, materials.get(key));
      mesh.name = `field:${key}`;
      mesh.castShadow = spec.castShadow;
      mesh.receiveShadow = spec.receiveShadow;
      mesh.renderOrder = spec.renderOrder ?? 0;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }

  dispose(): void {
    for (const list of this.parts.values()) for (const g of list) g.dispose();
    this.parts.clear();
    this.unitBox.dispose();
    this.unitCylinder.dispose();
    this.unitPlane.dispose();
  }
}

/**
 * Replaces UVs with world-space box projection so tiled textures (carpet, diamond plate,
 * HDPE grain) keep a constant real-world scale regardless of how parts were scaled.
 */
function applyWorldUVs(geometry: BufferGeometry, tileM: number): void {
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / tileM;
    uv[i * 2 + 1] = v / tileM;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}
