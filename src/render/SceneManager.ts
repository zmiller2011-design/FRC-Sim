import { Color, Fog, Group, Mesh, Scene, type Texture } from 'three';
import { DisposalScope, type Disposable } from '@/core';
import type { GraphicsSettings } from '@/settings';
import { Lighting, type LightingOptions } from './environment/Lighting';

const BACKGROUND = 0x0e1013;
const ENVIRONMENT_INTENSITY = 0.45;

/**
 * Owns the Three.js scene: background, lighting, the image-based environment and a `world`
 * group that the field and simulation views attach to. Everything here is created once and
 * released in `dispose`; nothing is allocated per frame.
 */
export class SceneManager implements Disposable {
  readonly scene = new Scene();
  /** Parent for field and dynamic content. */
  readonly world = new Group();

  private readonly scope = new DisposalScope();
  private readonly lighting: Lighting;
  private environment: Texture | null = null;

  constructor(graphics: GraphicsSettings, lighting: LightingOptions) {
    this.scene.background = new Color(BACKGROUND);
    // Distant venue fades into the background; the field itself is never fogged.
    this.scene.fog = new Fog(BACKGROUND, 40, 95);
    this.scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    this.world.name = 'world';
    this.scene.add(this.world);
    this.lighting = this.scope.add(new Lighting(this.scene, lighting));
    this.applyGraphics(graphics);
  }

  /** Registers a view so it is disposed with the scene. Returns the view for chaining. */
  addView<T extends Disposable>(view: T): T {
    return this.scope.add(view);
  }

  /** Replaces the image-based lighting environment, disposing the previous one. */
  setEnvironment(texture: Texture | null): void {
    this.environment?.dispose();
    this.environment = texture;
    this.scene.environment = texture;
  }

  applyGraphics(graphics: GraphicsSettings): void {
    const toggled = this.lighting.castsShadows !== graphics.shadows;
    this.lighting.setShadows(graphics.shadows, graphics.shadowMapSize);
    // Shadow support is compiled into shaders, so toggling it requires a recompile.
    if (toggled) this.invalidateMaterials();
  }

  dispose(): void {
    this.setEnvironment(null);
    this.scope.dispose();
    this.scene.clear();
  }

  private invalidateMaterials(): void {
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.needsUpdate = true;
    });
  }
}
