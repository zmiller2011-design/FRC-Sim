import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertWebGL2, RenderInitError } from '@/render/webglSupport';

function fakeGl() {
  const loseContext = vi.fn();
  const gl = {
    RENDERER: 1,
    VENDOR: 2,
    MAX_TEXTURE_SIZE: 3,
    MAX_SAMPLES: 4,
    getParameter: (p: number) => ({ 1: 'Test GPU', 2: 'Test Vendor', 3: 16384, 4: 8 })[p],
    getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
  };
  return { gl, loseContext };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof RenderInitError ? error.code : 'not-a-RenderInitError';
  }
  return undefined;
}

describe('assertWebGL2', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports an outdated browser when WebGL2 does not exist', () => {
    vi.stubGlobal('WebGL2RenderingContext', undefined);
    expect(codeOf(() => assertWebGL2(() => ({ getContext: () => null })))).toBe(
      'webgl2-unsupported',
    );
  });

  it('reports blocked graphics when the context cannot be created', () => {
    vi.stubGlobal('WebGL2RenderingContext', function WebGL2RenderingContext() {});
    expect(codeOf(() => assertWebGL2(() => ({ getContext: () => null })))).toBe('webgl-blocked');
  });

  it('returns GPU info and releases the probe context on success', () => {
    vi.stubGlobal('WebGL2RenderingContext', function WebGL2RenderingContext() {});
    const { gl, loseContext } = fakeGl();
    const info = assertWebGL2(() => ({ getContext: () => gl }));
    expect(info).toEqual({
      renderer: 'Test GPU',
      vendor: 'Test Vendor',
      maxTextureSize: 16384,
      maxSamples: 8,
    });
    expect(loseContext).toHaveBeenCalledOnce();
  });
});
