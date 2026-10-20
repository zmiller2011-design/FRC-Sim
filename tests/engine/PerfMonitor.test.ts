import { describe, expect, it } from 'vitest';
import { FRAME_HISTORY_LENGTH, PerfMonitor } from '@/engine/PerfMonitor';
import type { PerfSample } from '@/state';

const blank = (): PerfSample => ({
  fps: 0,
  frameMs: 0,
  worstFrameMs: 0,
  cpuMs: 0,
  stepsPerSecond: 0,
  droppedSeconds: 0,
  simTime: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  renderWidth: 0,
  renderHeight: 0,
  pixelRatio: 1,
});

describe('PerfMonitor', () => {
  it('signals a sample once the publish interval has elapsed', () => {
    const monitor = new PerfMonitor(10);
    let ready = false;
    for (let i = 0; i < 5; i++) ready = monitor.record(1 / 60, 1, 3);
    expect(ready).toBe(false);
    for (let i = 0; i < 2; i++) ready = monitor.record(1 / 60, 1, 3);
    expect(ready).toBe(true);
  });

  it('averages the window and then resets it', () => {
    const monitor = new PerfMonitor(1);
    monitor.record(0.01, 2, 2);
    monitor.record(0.03, 4, 6);
    const sample = monitor.fill(blank(), 0);
    expect(sample.fps).toBeCloseTo(50);
    expect(sample.frameMs).toBeCloseTo(20);
    expect(sample.worstFrameMs).toBeCloseTo(30);
    expect(sample.cpuMs).toBeCloseTo(3);
    expect(sample.stepsPerSecond).toBeCloseTo(200);
    monitor.record(0.02, 1, 4);
    expect(monitor.fill(blank(), 0).worstFrameMs).toBeCloseTo(20);
  });

  it('keeps a ring buffer of frame times with the oldest at head', () => {
    const monitor = new PerfMonitor(10);
    for (let i = 0; i < FRAME_HISTORY_LENGTH + 2; i++) monitor.record((i + 1) / 1000, 0, 0);
    expect(monitor.historyHead).toBe(2);
    expect(monitor.frameHistory[monitor.historyHead]).toBeCloseTo(3);
    const newest = (monitor.historyHead + FRAME_HISTORY_LENGTH - 1) % FRAME_HISTORY_LENGTH;
    expect(monitor.frameHistory[newest]).toBeCloseTo(FRAME_HISTORY_LENGTH + 2);
  });
});
