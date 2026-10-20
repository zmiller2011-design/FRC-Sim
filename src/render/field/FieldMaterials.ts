import {
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  DoubleSide,
  type Texture,
} from 'three';
import { DisposalScope, type Disposable } from '@/core';
import { contactShadowTexture, diamondPlateTexture, netTexture, noiseTexture } from './textures';

/** Alliance colours used for paint, HDPE and tape. Slightly desaturated to sit well under ACES. */
export const ALLIANCE_COLORS = { blue: 0x1d5bd6, red: 0xd2302b } as const;

interface MaterialSpec {
  castShadow: boolean;
  receiveShadow: boolean;
  /** When set, merged geometry gets world-space UVs repeating every `worldUvTile` metres. */
  worldUvTile?: number;
  renderOrder?: number;
  create(textures: TextureSet): Material;
}

interface TextureSet {
  carpet: Texture;
  concrete: Texture;
  diamond: Texture;
  hdpe: Texture;
  net: Texture;
  shadow: Texture;
  tags: Texture;
}

const standard = (p: MeshStandardMaterialParameters) => new MeshStandardMaterial(p);

/** Floor decals sit 1–3 mm above the carpet; polygon offset removes any z-fighting. */
const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

const SPECS = {
  carpet: {
    castShadow: false,
    receiveShadow: true,
    worldUvTile: 1.5,
    create: (t) => standard({ color: 0x4d525a, map: t.carpet, roughness: 1, metalness: 0 }),
  },
  allianceArea: {
    castShadow: false,
    receiveShadow: true,
    worldUvTile: 1.5,
    create: (t) => standard({ color: 0x3c4048, map: t.carpet, roughness: 1, metalness: 0 }),
  },
  arenaFloor: {
    castShadow: false,
    receiveShadow: true,
    worldUvTile: 4,
    create: (t) => standard({ color: 0x2a2c30, map: t.concrete, roughness: 0.85, metalness: 0 }),
  },
  tapeWhite: {
    castShadow: false,
    receiveShadow: true,
    create: () => standard({ color: 0xe9e9e6, roughness: 0.75, ...decal }),
  },
  tapeBlue: {
    castShadow: false,
    receiveShadow: true,
    create: () => standard({ color: ALLIANCE_COLORS.blue, roughness: 0.7, ...decal }),
  },
  tapeRed: {
    castShadow: false,
    receiveShadow: true,
    create: () => standard({ color: ALLIANCE_COLORS.red, roughness: 0.7, ...decal }),
  },
  contactShadow: {
    castShadow: false,
    receiveShadow: false,
    renderOrder: 1,
    create: (t) =>
      new MeshBasicMaterial({ map: t.shadow, transparent: true, depthWrite: false, ...decal }),
  },
  aluminum: {
    castShadow: true,
    receiveShadow: true,
    create: () => standard({ color: 0xb8bec7, metalness: 0.85, roughness: 0.38 }),
  },
  steelDark: {
    castShadow: true,
    receiveShadow: true,
    create: () => standard({ color: 0x3b4048, metalness: 0.55, roughness: 0.55 }),
  },
  blackFrame: {
    castShadow: true,
    receiveShadow: true,
    create: () => standard({ color: 0x17191d, metalness: 0.2, roughness: 0.7 }),
  },
  diamondPlate: {
    castShadow: true,
    receiveShadow: true,
    worldUvTile: 0.3,
    create: (t) => standard({ color: 0xffffff, map: t.diamond, metalness: 0.75, roughness: 0.38 }),
  },
  polycarbonate: {
    castShadow: false,
    receiveShadow: false,
    renderOrder: 2,
    create: () =>
      standard({
        color: 0xd9e6f5,
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
        metalness: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
  },
  hdpeBlue: {
    castShadow: true,
    receiveShadow: true,
    worldUvTile: 0.4,
    create: (t) =>
      standard({ color: ALLIANCE_COLORS.blue, map: t.hdpe, roughness: 0.62, metalness: 0 }),
  },
  hdpeRed: {
    castShadow: true,
    receiveShadow: true,
    worldUvTile: 0.4,
    create: (t) =>
      standard({ color: ALLIANCE_COLORS.red, map: t.hdpe, roughness: 0.62, metalness: 0 }),
  },
  ledBlue: {
    castShadow: false,
    receiveShadow: false,
    create: () => standard({ color: 0x0b1a3a, emissive: 0x3c7dff, emissiveIntensity: 2.2 }),
  },
  ledRed: {
    castShadow: false,
    receiveShadow: false,
    create: () => standard({ color: 0x3a0b0b, emissive: 0xff3b30, emissiveIntensity: 2.2 }),
  },
  hubFunnel: {
    castShadow: true,
    receiveShadow: true,
    create: () => standard({ color: 0x2a2e35, metalness: 0.35, roughness: 0.5, side: DoubleSide }),
  },
  net: {
    castShadow: false,
    receiveShadow: false,
    worldUvTile: 0.06,
    renderOrder: 2,
    create: (t) =>
      standard({
        color: 0x1a1a1a,
        alphaMap: t.net,
        transparent: true,
        alphaTest: 0.35,
        roughness: 0.9,
        side: DoubleSide,
      }),
  },
  tags: {
    castShadow: false,
    receiveShadow: true,
    create: (t) => standard({ map: t.tags, roughness: 0.75, metalness: 0 }),
  },
  tagBacking: {
    castShadow: true,
    receiveShadow: true,
    create: () => standard({ color: 0xdedede, roughness: 0.8 }),
  },
  lightPanel: {
    castShadow: false,
    receiveShadow: false,
    create: () => new MeshBasicMaterial({ color: 0xfff6e0 }),
  },
  drape: {
    castShadow: false,
    receiveShadow: true,
    create: () => standard({ color: 0x0c0d0f, roughness: 1 }),
  },
} satisfies Record<string, MaterialSpec>;

export type MaterialKey = keyof typeof SPECS;

/**
 * Shared material library for the field. Each material and texture is created once on
 * first use and reused by every part; `dispose` releases all of them.
 */
export class FieldMaterials implements Disposable {
  private readonly scope = new DisposalScope();
  private readonly materials = new Map<MaterialKey, Material>();
  private readonly textures: TextureSet;

  /** @param tagAtlas texture holding every AprilTag pattern; disposed with the library. */
  constructor(tagAtlas: Texture) {
    this.textures = {
      tags: this.scope.add(tagAtlas),
      carpet: this.scope.add(noiseTexture(128, 11, 150, 220, 0.04)),
      concrete: this.scope.add(noiseTexture(128, 23, 170, 215)),
      diamond: this.scope.add(diamondPlateTexture()),
      hdpe: this.scope.add(noiseTexture(64, 31, 232, 255)),
      net: this.scope.add(netTexture()),
      shadow: this.scope.add(contactShadowTexture()),
    };
  }

  spec(key: MaterialKey): MaterialSpec {
    return SPECS[key];
  }

  get(key: MaterialKey): Material {
    let material = this.materials.get(key);
    if (!material) {
      material = this.scope.add(SPECS[key].create(this.textures));
      material.name = key;
      this.materials.set(key, material);
    }
    return material;
  }

  /** Disposes externally created resources together with this library. */
  own<T extends Disposable>(resource: T): T {
    return this.scope.add(resource);
  }

  dispose(): void {
    this.scope.dispose();
    this.materials.clear();
  }
}

/** Material keys for alliance-specific parts. */
export const allianceKeys = {
  blue: { hdpe: 'hdpeBlue', led: 'ledBlue', tape: 'tapeBlue' },
  red: { hdpe: 'hdpeRed', led: 'ledRed', tape: 'tapeRed' },
} as const satisfies Record<string, Record<string, MaterialKey>>;
