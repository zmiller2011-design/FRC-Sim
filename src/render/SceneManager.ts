import { Color, Fog, Group, Mesh, Scene } from 'three';
import { DisposalScope, type Disposable } from '@/core';
import type { GraphicsSettings } from '@/settings';
import { Lighting } from './environment/Lighting';
import { TestFloor } from './environment/TestFloor';

const BACKGROUND = 0x15181c;
const FLOOR_SIZE_M = 40;

/**
 * Owns the Three.js scene: background, lighting, the static environment and a `world`
 * group that simulation views attach to. Everything added here is created once and
 * released in `dispose`; nothing is allocated per frame.
 */
export class SceneManager implements Disposable {
  readonly scene = new Scene();
  /** Parent for dynamic content (robots, game pieces). Views add their objects here. */
  readonly world = new Group();

  private readonly scope = new DisposalScope();
  private readonly lighting: Lighting;

  constructor(graphics: GraphicsSettings) {
    this.scene.background = new Color(BACKGROUND);
    // Fades the grid into the background instead of ending at a hard edge.
    this.scene.fog = new Fog(BACKGROUND, 14, FLOOR_SIZE_M * 0.55);
    this.world.name = 'world';
    this.scene.add(this.world);

    this.lighting = this.scope.add(new Lighting(this.scene, { shadowExtentM: 12 }));
    this.scope.add(new TestFloor(this.scene, { sizeM: FLOOR_SIZE_M }));
    this.applyGraphics(graphics);
  }

  /** Registers a view so it is disposed with the scene. Returns the view for chaining. */
  addView<T extends Disposable>(view: T): T {
    return this.scope.add(view);
  }

  applyGraphics(graphics: GraphicsSettings): void {
    const toggled = this.lighting.castsShadows !== graphics.shadows;
    this.lighting.setShadows(graphics.shadows, graphics.shadowMapSize);
    // Shadow support is compiled into shaders, so toggling it requires a recompile.
    if (toggled) this.invalidateMaterials();
  }

  dispose(): void {
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
