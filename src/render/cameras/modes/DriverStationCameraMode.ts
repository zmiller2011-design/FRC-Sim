import type { Vec3 } from '@/core';
import type { CameraContext, CameraMode, CameraModeId } from '../CameraMode';

const MAX_YAW = (55 * Math.PI) / 180;
const MAX_PITCH = (35 * Math.PI) / 180;
const SENSITIVITY = 0.0035;

/**
 * Driver's-eye view from behind an ALLIANCE WALL. Fixed eye position; drag to look around
 * within limits, as a driver turning their head.
 */
export class DriverStationCameraMode implements CameraMode {
  private ctx: CameraContext | null = null;
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private last = { x: 0, y: 0 };
  private readonly baseYaw: number;
  private readonly basePitch: number;

  /** `eye` and `lookAt` are world coordinates. */
  constructor(
    readonly id: Extract<CameraModeId, 'blueStation' | 'redStation'>,
    private readonly eye: Vec3,
    lookAt: Vec3,
  ) {
    const dx = lookAt.x - eye.x;
    const dy = lookAt.y - eye.y;
    const dz = lookAt.z - eye.z;
    this.baseYaw = Math.atan2(dx, dz);
    this.basePitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  activate(ctx: CameraContext): void {
    this.deactivate();
    this.ctx = ctx;
    ctx.camera.up.set(0, 1, 0);
    const el = ctx.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    this.apply();
  }

  update(): void {}

  reset(): void {
    this.yaw = 0;
    this.pitch = 0;
    this.apply();
  }

  deactivate(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const el = ctx.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    this.dragging = false;
    this.ctx = null;
  }

  dispose(): void {
    this.deactivate();
  }

  private apply(): void {
    const camera = this.ctx?.camera;
    if (!camera) return;
    const yaw = this.baseYaw + this.yaw;
    const pitch = this.basePitch + this.pitch;
    camera.position.set(this.eye.x, this.eye.y, this.eye.z);
    camera.lookAt(
      this.eye.x + Math.sin(yaw) * Math.cos(pitch),
      this.eye.y + Math.sin(pitch),
      this.eye.z + Math.cos(yaw) * Math.cos(pitch),
    );
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.last = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.yaw -= (e.clientX - this.last.x) * SENSITIVITY;
    this.pitch -= (e.clientY - this.last.y) * SENSITIVITY;
    this.yaw = Math.min(Math.max(this.yaw, -MAX_YAW), MAX_YAW);
    this.pitch = Math.min(Math.max(this.pitch, -MAX_PITCH), MAX_PITCH);
    this.last = { x: e.clientX, y: e.clientY };
    this.apply();
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
  };
}
