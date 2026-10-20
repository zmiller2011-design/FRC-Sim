import {
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
} from 'three';
import type { Disposable } from '@/core';
import type { FieldState } from '@/field/FieldState';

/**
 * Every FUEL ball in one instanced draw call. Instance matrices are rewritten only when the
 * field state's revision changes (reset, or later a physics step), never by default per frame.
 */
export class FuelView implements Disposable {
  readonly mesh: InstancedMesh;
  private readonly geometry: SphereGeometry;
  private readonly material = new MeshStandardMaterial({
    color: 0xf3c217,
    roughness: 0.82,
    metalness: 0,
  });
  private readonly matrix = new Matrix4();
  private revision = -1;

  constructor(
    parent: Object3D,
    private readonly state: FieldState,
    radius: number,
  ) {
    // 16 × 10 segments (320 triangles): round at field distances, ~160k triangles for 504 balls.
    this.geometry = new SphereGeometry(radius, 16, 10);
    this.mesh = new InstancedMesh(this.geometry, this.material, state.count);
    this.mesh.name = 'fuel';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    parent.add(this.mesh);
    this.sync();
  }

  sync(): void {
    if (this.revision === this.state.revision) return;
    this.revision = this.state.revision;
    const p = this.state.positions;
    for (let i = 0; i < this.state.count; i++) {
      // Field (x, y, z) → world (x, z, −y).
      this.matrix.makeTranslation(p[i * 3]!, p[i * 3 + 2]!, -p[i * 3 + 1]!);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
