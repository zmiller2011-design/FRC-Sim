import { Vector3 } from 'three';
import { fieldToWorld, type Pose2d, vec3 } from '@/core';
import type { CameraContext, CameraMode } from '../CameraMode';

/** Distance behind and height above the robot, and how strongly the camera chases it. */
const BEHIND_M = 2.4;
const HEIGHT_M = 1.5;
const LOOK_AHEAD_M = 0.6;
const FOLLOW_RATE = 6;

/**
 * Chase camera behind the robot. Reads the robot's interpolated (rendered) pose each frame
 * and eases toward it with a frame-rate-independent exponential filter, so it never changes
 * the simulation and looks identical at any frame rate.
 */
export class FollowCameraMode implements CameraMode {
  readonly id = 'follow';
  private ctx: CameraContext | null = null;
  private readonly position = new Vector3();
  private readonly lookAt = new Vector3();
  private readonly desired = vec3();
  private readonly desiredLook = vec3();
  private snap = true;

  /** @param target returns the robot pose as currently drawn (field frame). */
  constructor(private readonly target: () => Readonly<Pose2d>) {}

  activate(ctx: CameraContext): void {
    this.ctx = ctx;
    ctx.camera.up.set(0, 1, 0);
    this.snap = true;
    this.update(0);
  }

  update(frameDt: number): void {
    const camera = this.ctx?.camera;
    if (!camera) return;
    const pose = this.target();
    const c = Math.cos(pose.heading);
    const s = Math.sin(pose.heading);
    fieldToWorld(pose.x - c * BEHIND_M, pose.y - s * BEHIND_M, HEIGHT_M, this.desired);
    fieldToWorld(pose.x + c * LOOK_AHEAD_M, pose.y + s * LOOK_AHEAD_M, 0.2, this.desiredLook);
    const k = this.snap ? 1 : 1 - Math.exp(-FOLLOW_RATE * frameDt);
    this.snap = false;
    this.position.x += (this.desired.x - this.position.x) * k;
    this.position.y += (this.desired.y - this.position.y) * k;
    this.position.z += (this.desired.z - this.position.z) * k;
    this.lookAt.x += (this.desiredLook.x - this.lookAt.x) * k;
    this.lookAt.y += (this.desiredLook.y - this.lookAt.y) * k;
    this.lookAt.z += (this.desiredLook.z - this.lookAt.z) * k;
    camera.position.copy(this.position);
    camera.lookAt(this.lookAt);
  }

  reset(): void {
    this.snap = true;
    this.update(0);
  }

  deactivate(): void {
    this.ctx = null;
  }

  dispose(): void {
    this.deactivate();
  }
}
