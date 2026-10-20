import { describe, expect, it } from 'vitest';
import { FixedStepper } from '@/core/loop/FixedStepper';

function runFrames(stepper: FixedStepper, frameSeconds: number, frames: number): number {
  let steps = 0;
  for (let i = 0; i < frames; i++) steps += stepper.advance(frameSeconds, () => {});
  return steps;
}

describe('FixedStepper', () => {
  it.each([30, 60, 75, 144, 165, 240])('runs 200 steps per simulated second at %i fps', (fps) => {
    const stepper = new FixedStepper({ stepHz: 200, maxSubSteps: 20 });
    const steps = runFrames(stepper, 1 / fps, fps * 10);
    expect(steps).toBe(2000);
    expect(stepper.simTime).toBeCloseTo(10, 9);
  });

  it('produces identical tick sequences regardless of frame pacing', () => {
    const a = new FixedStepper({ stepHz: 200, maxSubSteps: 20 });
    const b = new FixedStepper({ stepHz: 200, maxSubSteps: 20 });
    const ticksA: number[] = [];
    const ticksB: number[] = [];
    for (let i = 0; i < 60; i++) a.advance(1 / 60, (_dt, t) => ticksA.push(t));
    for (let i = 0; i < 144; i++) b.advance(1 / 144, (_dt, t) => ticksB.push(t));
    expect(ticksA.length).toBe(200);
    expect(ticksB).toEqual(ticksA.slice(0, ticksB.length));
  });

  it('always passes the same dt', () => {
    const stepper = new FixedStepper({ stepHz: 120, maxSubSteps: 10 });
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) stepper.advance(0.003 + (i % 7) * 0.004, (dt) => seen.add(dt));
    expect([...seen]).toEqual([1 / 120]);
  });

  it('keeps alpha in [0, 1)', () => {
    const stepper = new FixedStepper({ stepHz: 200, maxSubSteps: 20 });
    for (let i = 0; i < 500; i++) {
      stepper.advance(Math.random() * 0.03, () => {});
      expect(stepper.alpha).toBeGreaterThanOrEqual(0);
      expect(stepper.alpha).toBeLessThan(1);
    }
  });

  it('caps sub-steps and drops the excess instead of spiralling', () => {
    const stepper = new FixedStepper({ stepHz: 200, maxSubSteps: 10 });
    const steps = stepper.advance(1, () => {});
    expect(steps).toBe(10);
    expect(stepper.droppedTime).toBeCloseTo(1 - 10 / 200, 9);
    // The next normal frame runs normally, with no backlog.
    expect(stepper.advance(1 / 100, () => {})).toBe(2);
  });

  it('runs nothing while paused (zero elapsed)', () => {
    const stepper = new FixedStepper({ stepHz: 200, maxSubSteps: 10 });
    stepper.advance(0.0025, () => {});
    expect(runFrames(stepper, 0, 100)).toBe(0);
  });

  it('preserves partial progress when the rate changes', () => {
    const stepper = new FixedStepper({ stepHz: 100, maxSubSteps: 10 });
    stepper.advance(0.005, () => {});
    expect(stepper.alpha).toBeCloseTo(0.5, 9);
    stepper.configure({ stepHz: 200, maxSubSteps: 10 });
    expect(stepper.advance(0.0025, () => {})).toBe(1);
  });
});
