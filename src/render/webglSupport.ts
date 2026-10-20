export type RenderErrorCode =
  /** The browser has no WebGL2 at all (very old browser). */
  | 'webgl2-unsupported'
  /** WebGL exists but is unavailable: hardware acceleration off, GPU blocklisted, or driver issue. */
  | 'webgl-blocked'
  /** A context was available but Three.js failed to initialize on it. */
  | 'context-creation-failed';

export class RenderInitError extends Error {
  override readonly name = 'RenderInitError';
  constructor(
    readonly code: RenderErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface GpuInfo {
  /** GPU description reported by the browser, e.g. "ANGLE (NVIDIA, GeForce GTX 1660 ...)". */
  renderer: string;
  vendor: string;
  maxTextureSize: number;
  maxSamples: number;
}

type CanvasFactory = () => { getContext(id: string, options?: object): unknown };

const PROBE_OPTIONS = { failIfMajorPerformanceCaveat: false, powerPreference: 'high-performance' };

/** Reads human-readable GPU details. Prefers the unmasked strings when the browser exposes them. */
export function readGpuInfo(gl: WebGL2RenderingContext): GpuInfo {
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));
  const vendor = debug
    ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
    : String(gl.getParameter(gl.VENDOR));
  return {
    renderer,
    vendor,
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    maxSamples: Number(gl.getParameter(gl.MAX_SAMPLES)),
  };
}

/**
 * Checks for WebGL2 (required by Three.js) on a throwaway canvas and classifies failures
 * so the error screen can give specific advice. Throws {@link RenderInitError}.
 */
export function assertWebGL2(
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
): GpuInfo {
  if (typeof WebGL2RenderingContext === 'undefined') {
    throw new RenderInitError(
      'webgl2-unsupported',
      'This browser does not support WebGL 2, which the simulator needs for 3D graphics.',
    );
  }

  const gl = createCanvas().getContext('webgl2', PROBE_OPTIONS) as WebGL2RenderingContext | null;
  if (!gl) {
    throw new RenderInitError(
      'webgl-blocked',
      'WebGL 2 is supported by this browser but could not be started. Hardware acceleration may be turned off, or the graphics driver may be blocked.',
    );
  }

  const info = readGpuInfo(gl);
  // Release the probe context right away; browsers limit how many can be alive.
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return info;
}
