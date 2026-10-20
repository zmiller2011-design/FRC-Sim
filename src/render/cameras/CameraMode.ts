import type { PerspectiveCamera } from 'three';
import type { Disposable } from '@/core';

export type CameraModeId = 'orbit' | 'overhead' | 'blueStation' | 'redStation';

export interface CameraContext {
  readonly camera: PerspectiveCamera;
  /** Element that receives pointer input for interactive modes. */
  readonly domElement: HTMLElement;
}

export interface CameraMode extends Disposable {
  readonly id: CameraModeId;
  activate(ctx: CameraContext): void;
  /** Called once per rendered frame, after simulation state has been interpolated. */
  update(frameDt: number): void;
  deactivate(): void;
  /** Returns the camera to this mode's default framing. */
  reset(): void;
}

/** Field extents in world coordinates, used by modes to frame and bound the view. */
export interface FieldBounds {
  /** World X range (field length). */
  minX: number;
  maxX: number;
  /** World Z range (field width; world Z = −field Y). */
  minZ: number;
  maxZ: number;
}
