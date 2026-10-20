import {
  ACESFilmicToneMapping,
  type Camera,
  PCFShadowMap,
  PMREMGenerator,
  type Scene,
  SRGBColorSpace,
  type Texture,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Disposable } from '@/core';
import { effectivePixelRatio, type GraphicsSettings } from '@/settings';
import { type GpuInfo, readGpuInfo, RenderInitError } from './webglSupport';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  /** Drawing-buffer size in device pixels (after render scale and pixel-ratio cap). */
  renderWidth: number;
  renderHeight: number;
  pixelRatio: number;
}

export type RenderStatus = 'ok' | 'context-lost';
export type ResizeListener = (widthPx: number, heightPx: number) => void;
export type StatusListener = (status: RenderStatus) => void;

/**
 * Owns the WebGL context and canvas. Knows nothing about scene contents.
 *
 * - The canvas is created once and moved between containers on mount/unmount.
 * - The context is only recreated when a setting requires it (antialias).
 * - Size follows the container (ResizeObserver) and the display's pixel ratio
 *   (which changes when the window moves between monitors or the page is zoomed).
 * - A lost context (driver reset, GPU switch) is reported; Three.js restores it.
 */
export class Renderer implements Disposable {
  private webgl: WebGLRenderer;
  private graphics: GraphicsSettings;
  private readonly gpu: GpuInfo;
  private status: RenderStatus = 'ok';
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private pixelRatioQuery: MediaQueryList | null = null;
  private readonly resizeListeners = new Set<ResizeListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private widthPx = 1;
  private heightPx = 1;

  constructor(graphics: GraphicsSettings) {
    this.graphics = { ...graphics };
    this.webgl = this.createContext();
    this.gpu = readGpuInfo(this.webgl.getContext() as WebGL2RenderingContext);
  }

  get canvas(): HTMLCanvasElement {
    return this.webgl.domElement;
  }

  get aspect(): number {
    return this.widthPx / this.heightPx;
  }

  get gpuInfo(): Readonly<GpuInfo> {
    return this.gpu;
  }

  get currentStatus(): RenderStatus {
    return this.status;
  }

  mount(container: HTMLElement): void {
    if (this.container === container) return;
    this.unmount();
    this.container = container;
    container.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(container);
    this.watchPixelRatio();
    this.syncSize();
  }

  unmount(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.pixelRatioQuery?.removeEventListener('change', this.onPixelRatioChange);
    this.pixelRatioQuery = null;
    this.canvas.remove();
    this.container = null;
  }

  onResize(listener: ResizeListener): () => void {
    this.resizeListeners.add(listener);
    listener(this.widthPx, this.heightPx);
    return () => this.resizeListeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
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

  render(scene: Scene, camera: Camera): void {
    if (!this.container || this.status !== 'ok') return;
    this.webgl.render(scene, camera);
  }

  /**
   * Prefiltered indoor environment for image-based lighting. Generated once on the GPU;
   * must be regenerated after the context is recreated or restored.
   */
  createEnvironment(): Texture {
    const generator = new PMREMGenerator(this.webgl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    return target.texture;
  }

  readStats(out: RenderStats): RenderStats {
    const info = this.webgl.info;
    out.drawCalls = info.render.calls;
    out.triangles = info.render.triangles;
    out.geometries = info.memory.geometries;
    out.textures = info.memory.textures;
    out.renderWidth = this.canvas.width;
    out.renderHeight = this.canvas.height;
    out.pixelRatio = this.webgl.getPixelRatio();
    return out;
  }

  dispose(): void {
    this.unmount();
    this.resizeListeners.clear();
    this.statusListeners.clear();
    this.releaseContext();
  }

  private createContext(): WebGLRenderer {
    let webgl: WebGLRenderer;
    try {
      webgl = new WebGLRenderer({
        antialias: this.graphics.antialias,
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (error) {
      throw new RenderInitError(
        'context-creation-failed',
        `The 3D renderer could not start: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    webgl.outputColorSpace = SRGBColorSpace;
    webgl.toneMapping = ACESFilmicToneMapping;
    webgl.shadowMap.enabled = this.graphics.shadows;
    webgl.shadowMap.type = PCFShadowMap;
    const style = webgl.domElement.style;
    style.display = 'block';
    style.width = '100%';
    style.height = '100%';
    style.touchAction = 'none';
    webgl.domElement.addEventListener('webglcontextlost', this.onContextLost);
    webgl.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.status = 'ok';
    return webgl;
  }

  /** `dispose()` frees GPU objects but not the context itself; browsers cap live contexts (~16). */
  private releaseContext(): void {
    const canvas = this.webgl.domElement;
    // Detach first: a deliberate release must not be reported as a lost context.
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.webgl.dispose();
    this.webgl.forceContextLoss();
  }

  private setStatus(status: RenderStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  // Three.js calls preventDefault on context loss, which lets the browser restore it.
  private readonly onContextLost = (): void => this.setStatus('context-lost');

  private readonly onContextRestored = (): void => {
    this.setStatus('ok');
    this.syncSize();
  };

  private readonly onPixelRatioChange = (): void => {
    this.watchPixelRatio();
    this.syncSize();
  };

  /** A resolution media query fires once when the ratio changes, so it is re-armed each time. */
  private watchPixelRatio(): void {
    this.pixelRatioQuery?.removeEventListener('change', this.onPixelRatioChange);
    this.pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.pixelRatioQuery.addEventListener('change', this.onPixelRatioChange);
  }

  private syncSize(): void {
    if (!this.container) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.webgl.setPixelRatio(effectivePixelRatio(this.graphics, window.devicePixelRatio));
    this.webgl.setSize(width, height, false);
    if (width === this.widthPx && height === this.heightPx) return;
    this.widthPx = width;
    this.heightPx = height;
    for (const listener of this.resizeListeners) listener(width, height);
  }
}
