import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationFrameDriver } from '@/core/loop/FrameDriver';

/** Manual requestAnimationFrame + document stand-ins so the driver can be stepped in Node. */
function installFakes() {
  let pending: ((t: number) => void) | null = null;
  let nextHandle = 1;
  const listeners = new Map<string, EventListener>();
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    pending = cb;
    return nextHandle++;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = null;
  });
  vi.stubGlobal('document', {
    addEventListener: (type: string, l: EventListener) => listeners.set(type, l),
    removeEventListener: (type: string) => listeners.delete(type),
  });
  return {
    frame(timeMs: number) {
      const cb = pending;
      pending = null;
      cb?.(timeMs);
    },
    get hasPending() {
      return pending !== null;
    },
    fire(type: string) {
      listeners.get(type)?.(new Event(type));
    },
    listenerCount: () => listeners.size,
  };
}

describe('AnimationFrameDriver', () => {
  let fakes: ReturnType<typeof installFakes>;
  beforeEach(() => {
    fakes = installFakes();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports real elapsed seconds, starting at 0', () => {
    const driver = new AnimationFrameDriver();
    const deltas: number[] = [];
    driver.start((dt) => deltas.push(dt));
    fakes.frame(1000);
    fakes.frame(1016);
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.016);
  });

  it('clamps long gaps such as a debugger pause', () => {
    const driver = new AnimationFrameDriver();
    const deltas: number[] = [];
    driver.start((dt) => deltas.push(dt));
    fakes.frame(0);
    fakes.frame(5000);
    expect(deltas[1]).toBe(0.25);
  });

  it('does not simulate the time a tab was hidden', () => {
    const driver = new AnimationFrameDriver();
    const deltas: number[] = [];
    driver.start((dt) => deltas.push(dt));
    fakes.frame(0);
    fakes.fire('visibilitychange');
    fakes.frame(60_000);
    expect(deltas[1]).toBe(0);
  });

  it('stops scheduling and removes its listener on stop/dispose', () => {
    const driver = new AnimationFrameDriver();
    driver.start(() => {});
    expect(fakes.listenerCount()).toBe(1);
    driver.dispose();
    expect(driver.running).toBe(false);
    expect(fakes.hasPending).toBe(false);
    expect(fakes.listenerCount()).toBe(0);
  });
});
