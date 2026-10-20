import {
  ACESFilmicToneMapping,
  type Camera,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import type { Disposable } from '@/core';
import type { GraphicsSettings } from '@/settings';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export type ResizeListener = (widthPx: number, heightPx: number) => void;

/**
 * Owns the WebGL context and canvas. Knows nothing about the scene contents.
 * The canvas is created once and moved between containers on mount/unmount;
 * the context is only recreated when a setting requires it (antialias).
 */
export class Renderer implements Disposable {
  private webgl: WebGLRenderer;
  private graphics: GraphicsSettings;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly resizeListeners = new Set<ResizeListener>();
  private widthPx = 1;
  private heightPx = 1;

  constructor(graphics: GraphicsSettings) {
    this.graphics = { ...graphics };
    this.webgl = this.createContext();
  }

  get canvas(): HTMLCanvasElement {
    return this.webgl.domElement;
  }

  get aspect(): number {
    return this.widthPx / this.heightPx;
  }

  mount(container: HTMLElement): void {
    if (this.container === container) return;
    this.unmount();
    this.container = container;
    container.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(container);
    this.syncSize();
  }

  unmount(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas.remove();
    this.container = null;
  }

  onResize(listener: ResizeListener): () => void {
    this.resizeListeners.add(listener);
    listener(this.widthPx, this.heightPx);
    return () => this.resizeListeners.delete(listener);
  }

  /** @returns true if the WebGL context was recreated (the canvas element changed). */
  applyGraphics(graphics: GraphicsSettings): boolean {
    const needsNewContext = graphics.antialias !== this.graphics.antialias;
    this.graphics = { ...graphics };
    if (needsNewContext) {
      const container = this.container;
      this.unmount();
      this.releaseContext();
      this.webgl = this.createContext();
      if (container) this.mount(container);
      return true;
    }
    this.webgl.shadowMap.enabled = graphics.shadows;
    this.syncSize();
    return false;
  }

  render(scene: Parameters<WebGLRenderer['render']>[0], camera: Camera): void {
    if (!this.container) return;
    this.webgl.render(scene, camera);
  }

  readStats(out: RenderStats): RenderStats {
    const info = this.webgl.info;
    out.drawCalls = info.render.calls;
    out.triangles = info.render.triangles;
    out.geometries = info.memory.geometries;
    out.textures = info.memory.textures;
    return out;
  }

  dispose(): void {
    this.unmount();
    this.resizeListeners.clear();
    this.releaseContext();
  }

  /** `dispose()` frees GPU objects but not the context itself; browsers cap live contexts (~16). */
  private releaseContext(): void {
    this.webgl.dispose();
    this.webgl.forceContextLoss();
  }

  private createContext(): WebGLRenderer {
    const webgl = new WebGLRenderer({
      antialias: this.graphics.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    webgl.outputColorSpace = SRGBColorSpace;
    webgl.toneMapping = ACESFilmicToneMapping;
    webgl.shadowMap.enabled = this.graphics.shadows;
    webgl.shadowMap.type = PCFShadowMap;
    webgl.domElement.style.display = 'block';
    webgl.domElement.style.width = '100%';
    webgl.domElement.style.height = '100%';
    webgl.domElement.style.touchAction = 'none';
    return webgl;
  }

  private syncSize(): void {
    if (!this.container) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.graphics.pixelRatioCap));
    this.webgl.setSize(width, height, false);
    if (width === this.widthPx && height === this.heightPx) return;
    this.widthPx = width;
    this.heightPx = height;
    for (const listener of this.resizeListeners) listener(width, height);
  }
}
