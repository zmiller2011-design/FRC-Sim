import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { Rng } from '@/core';

/**
 * Small procedural textures, generated once on a canvas. They add surface variation
 * (carpet pile, diamond plate, HDPE orange peel, netting) without downloading images.
 * Seeded so the field looks identical on every load.
 */

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function tiled(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Fine speckled noise around a base grey; used as a colour map (multiplied by material colour). */
export function noiseTexture(
  size: number,
  seed: number,
  low: number,
  high: number,
  streak = 0,
): CanvasTexture {
  const [c, ctx] = canvas(size);
  const rng = new Rng(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(low + (high - low) * rng.next());
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (streak > 0) {
    // Faint rows suggest carpet tufting direction.
    ctx.globalAlpha = streak;
    for (let y = 0; y < size; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(0, y, size, 1);
    }
    ctx.globalAlpha = 1;
  }
  return tiled(c);
}

/** Raised diamond tread pattern on brushed metal. */
export function diamondPlateTexture(): CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  const rng = new Rng(7);
  ctx.fillStyle = '#9da3ab';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * rng.next()})`;
    ctx.fillRect(0, y, size, 1);
  }
  const step = size / 4;
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const x = gx * step + (gy % 2 ? step / 2 : 0);
      const y = gy * step;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(gy % 2 ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillStyle = '#c4c9d0';
      ctx.fillRect(-10, -2.5, 20, 5);
      ctx.fillStyle = '#6d737c';
      ctx.fillRect(-10, 1.5, 20, 1.5);
      ctx.restore();
    }
  }
  return tiled(c);
}

/** Netting: thin cords on a transparent background, used as an alpha map. */
export function netTexture(): CanvasTexture {
  const size = 64;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, size);
  ctx.moveTo(size, 0);
  ctx.lineTo(0, size);
  ctx.stroke();
  return tiled(c, false);
}

/** Soft radial falloff for fake contact shadows under large structures. */
export function contactShadowTexture(): CanvasTexture {
  const size = 128;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface TagAtlas {
  texture: Texture;
  columns: number;
  rows: number;
  /** UV rectangle [u0, v0, u1, v1] for a tag ID. */
  uvRect(id: number): [number, number, number, number];
}

/**
 * All field tags drawn into one texture so every tag renders in a single draw call.
 * Nearest filtering keeps the black/white cells crisp at any distance.
 */
export function tagAtlas(ids: readonly number[], cellsFor: (id: number) => boolean[]): TagAtlas {
  const columns = 8;
  const rows = Math.ceil(ids.length / columns);
  const cellPx = 12;
  const tagPx = cellPx * 10;
  const c = document.createElement('canvas');
  c.width = columns * tagPx;
  c.height = rows * tagPx;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const slot = new Map<number, number>();
  ids.forEach((id, index) => {
    slot.set(id, index);
    const ox = (index % columns) * tagPx;
    const oy = Math.floor(index / columns) * tagPx;
    const cells = cellsFor(id);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        ctx.fillStyle = cells[y * 10 + x] ? '#f2f2f2' : '#0b0b0b';
        ctx.fillRect(ox + x * cellPx, oy + y * cellPx, cellPx, cellPx);
      }
    }
  });
  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  return {
    texture,
    columns,
    rows,
    uvRect(id) {
      const index = slot.get(id);
      if (index === undefined) throw new RangeError(`Tag ${id} not in atlas`);
      const col = index % columns;
      const row = Math.floor(index / columns);
      // Canvas rows go down; texture V goes up (flipY).
      return [col / columns, 1 - (row + 1) / rows, (col + 1) / columns, 1 - row / rows];
    },
  };
}
