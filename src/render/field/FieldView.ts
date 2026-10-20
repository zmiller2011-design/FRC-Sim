import { Group, type Mesh, type Object3D } from 'three';
import type { Disposable } from '@/core';
import type { FieldState } from '@/field/FieldState';
import type { FieldConfig, FieldElement } from '@/field/types';
import { ColliderDebugView } from './ColliderDebugView';
import { buildAllianceWall } from './components/allianceWall';
import { buildAprilTags } from './components/aprilTags';
import { buildBump } from './components/bump';
import { buildFloor } from './components/carpet';
import { buildContactShadows } from './components/contactShadows';
import { buildDepot } from './components/depot';
import { buildGuardrails } from './components/guardrails';
import { buildHub } from './components/hub';
import { buildOutpost } from './components/outpost';
import { buildTower } from './components/tower';
import { buildTrench } from './components/trench';
import { buildVenue } from './components/venue';
import { FieldMaterials } from './FieldMaterials';
import { FuelView } from './FuelView';
import { GeometryBatcher } from './GeometryBatcher';
import { tagAtlas } from './textures';

export interface FieldViewOptions {
  config: FieldConfig;
  state: FieldState;
  /** tag36h11 cell pattern for a tag ID (row-major 10×10, true = white). */
  tagCells: (id: number) => boolean[];
}

/**
 * The complete visual field, built once from a {@link FieldConfig}. Static parts are merged
 * into one mesh per material; FUEL is a single instanced mesh. Nothing is rebuilt during
 * normal simulation: `sync` only updates FUEL instances when the field state changes.
 */
export class FieldView implements Disposable {
  readonly root = new Group();
  private readonly materials: FieldMaterials;
  private readonly staticMeshes: Mesh[];
  private readonly fuel: FuelView;
  private colliders: ColliderDebugView | null = null;

  constructor(
    parent: Object3D,
    private readonly options: FieldViewOptions,
  ) {
    const { config } = options;
    this.root.name = `field:${config.gameName}:${config.variant.id}`;
    const atlas = tagAtlas(
      config.aprilTags.map((t) => t.id),
      options.tagCells,
    );
    this.materials = new FieldMaterials(atlas.texture);

    const batcher = new GeometryBatcher();
    try {
      buildFloor(batcher, config);
      buildGuardrails(batcher, config);
      for (const element of config.elements) this.buildElement(batcher, element);
      buildAprilTags(batcher, config, atlas);
      buildContactShadows(batcher, config);
      buildVenue(batcher, config);
      this.staticMeshes = batcher.build(this.materials);
    } finally {
      batcher.dispose();
    }
    for (const mesh of this.staticMeshes) this.root.add(mesh);

    this.fuel = new FuelView(this.root, options.state, config.gamePiece.radius);
    parent.add(this.root);
  }

  /** Number of draw calls used by the static field (one per material). */
  get staticDrawCalls(): number {
    return this.staticMeshes.length;
  }

  /** Call once per rendered frame. Cheap when nothing changed. */
  sync(): void {
    this.fuel.sync();
  }

  setCollidersVisible(visible: boolean): void {
    if (visible && !this.colliders) {
      this.colliders = new ColliderDebugView(this.root, this.options.config.colliders);
    }
    if (this.colliders) this.colliders.visible = visible;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const mesh of this.staticMeshes) mesh.geometry.dispose();
    this.fuel.dispose();
    this.colliders?.dispose();
    this.materials.dispose();
  }

  private buildElement(b: GeometryBatcher, e: FieldElement): void {
    const { config } = this.options;
    switch (e.type) {
      case 'allianceWall': {
        const outpost = config.elements.find(
          (o): o is Extract<FieldElement, { type: 'outpost' }> =>
            o.type === 'outpost' && o.alliance === e.alliance,
        );
        buildAllianceWall(b, e, outpost);
        break;
      }
      case 'outpost': {
        const wall = config.elements.find(
          (w) => w.type === 'allianceWall' && w.alliance === e.alliance,
        );
        buildOutpost(b, e, wall?.type === 'allianceWall' ? wall.dims.thickness : 0);
        break;
      }
      case 'hub':
        buildHub(b, e);
        break;
      case 'bump':
        buildBump(b, e);
        break;
      case 'trench':
        buildTrench(b, e);
        break;
      case 'tower':
        buildTower(b, e);
        break;
      case 'depot':
        buildDepot(b, e);
        break;
    }
  }
}
