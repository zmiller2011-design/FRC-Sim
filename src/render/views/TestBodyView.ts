import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { type Disposable, fieldHeadingToWorldYaw, fieldToWorld, type Pose2d } from '@/core';

const SIZE_M = 0.9;
const HEIGHT_M = 0.15;

/**
 * Placeholder robot-sized block used to verify the fixed-step loop and interpolation.
 * Replaced by RobotView in stage 4.
 */
export class TestBodyView implements Disposable {
  readonly root = new Group();
  private readonly bodyGeometry = new BoxGeometry(SIZE_M, HEIGHT_M, SIZE_M);
  private readonly arrowGeometry = new ConeGeometry(0.12, 0.3, 16);
  private readonly bodyMaterial = new MeshStandardMaterial({ color: 0x1f5fd6, roughness: 0.5 });
  private readonly arrowMaterial = new MeshStandardMaterial({ color: 0xffc83d, roughness: 0.4 });

  constructor(parent: Object3D) {
    const body = new Mesh(this.bodyGeometry, this.bodyMaterial);
    body.position.y = HEIGHT_M / 2 + 0.02;
    body.castShadow = true;

    // Arrow points toward local +X, which is "forward" for a robot at heading 0.
    const arrow = new Mesh(this.arrowGeometry, this.arrowMaterial);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(SIZE_M * 0.3, HEIGHT_M + 0.05, 0);
    arrow.castShadow = true;

    this.root.add(body, arrow);
    parent.add(this.root);
  }

  /** Writes an (already interpolated) field pose into the scene. Allocation-free. */
  sync(pose: Pose2d): void {
    fieldToWorld(pose.x, pose.y, 0, this.root.position);
    this.root.rotation.y = fieldHeadingToWorldYaw(pose.heading);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.bodyGeometry.dispose();
    this.arrowGeometry.dispose();
    this.bodyMaterial.dispose();
    this.arrowMaterial.dispose();
  }
}
