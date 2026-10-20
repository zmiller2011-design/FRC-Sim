import type { Object3D } from 'three';
import type { Disposable } from '@/core';
import { FieldState } from '@/field/FieldState';
import { tag36h11Cells } from '@/field/tag36h11';
import type { FieldConfig } from '@/field/types';
import { createRebuiltField } from '@/game/seasons/rebuilt2026';
import { type FieldBounds, FieldView } from '@/render';
import type { FieldVariant } from '@/settings';

export interface FieldInfo {
  season: string;
  gameName: string;
  variantLabel: string;
  lengthM: number;
  widthM: number;
  pieceCount: number;
  colliderCount: number;
  staticDrawCalls: number;
}

/**
 * Owns the active field: its typed configuration, the mutable game-piece state and the
 * visual field. The field is built once; it is only rebuilt when the user switches between
 * the welded and AndyMark variants, never during normal simulation.
 */
export class FieldRuntime implements Disposable {
  config: FieldConfig;
  state: FieldState;
  private view: FieldView;
  private collidersVisible = false;

  constructor(
    private readonly parent: Object3D,
    variant: FieldVariant,
  ) {
    this.config = createRebuiltField({ variant });
    this.state = new FieldState(this.config);
    this.view = this.createView();
  }

  get variant(): FieldVariant {
    return this.config.variant.id;
  }

  /** World-space extents of the carpet. */
  get bounds(): FieldBounds {
    return { minX: 0, maxX: this.config.lengthM, minZ: -this.config.widthM, maxZ: 0 };
  }

  get info(): FieldInfo {
    return {
      season: this.config.season,
      gameName: this.config.gameName,
      variantLabel: this.config.variant.label,
      lengthM: this.config.lengthM,
      widthM: this.config.widthM,
      pieceCount: this.state.count,
      colliderCount: this.config.colliders.length,
      staticDrawCalls: this.view.staticDrawCalls,
    };
  }

  /** Restores every game piece to the official starting configuration. */
  reset(): void {
    this.state.reset();
  }

  setVariant(variant: FieldVariant): boolean {
    if (variant === this.variant) return false;
    this.view.dispose();
    this.config = createRebuiltField({ variant });
    this.state = new FieldState(this.config);
    this.view = this.createView();
    return true;
  }

  setCollidersVisible(visible: boolean): void {
    this.collidersVisible = visible;
    this.view.setCollidersVisible(visible);
  }

  /** Per rendered frame: pushes changed game-piece positions to the GPU. */
  sync(): void {
    this.view.sync();
  }

  dispose(): void {
    this.view.dispose();
  }

  private createView(): FieldView {
    const view = new FieldView(this.parent, {
      config: this.config,
      state: this.state,
      tagCells: tag36h11Cells,
    });
    if (this.collidersVisible) view.setCollidersVisible(true);
    return view;
  }
}
