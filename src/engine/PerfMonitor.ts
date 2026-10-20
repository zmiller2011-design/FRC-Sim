import type { PerfSample } from '@/state';

/** Accumulates per-frame numbers and produces an averaged sample at a fixed real-time interval. */
export class PerfMonitor {
  private frames = 0;
  private steps = 0;
  private elapsed = 0;
  private cpu = 0;
  private worst = 0;
  private interval: number;

  constructor(publishHz: number) {
    this.interval = 1 / publishHz;
  }

  setPublishHz(hz: number): void {
    this.interval = 1 / hz;
  }

  /** @returns true when a sample is ready to be read with `fill`. */
  record(frameSeconds: number, cpuMs: number, steps: number): boolean {
    this.frames++;
    this.steps += steps;
    this.elapsed += frameSeconds;
    this.cpu += cpuMs;
    if (frameSeconds > this.worst) this.worst = frameSeconds;
    return this.elapsed >= this.interval;
  }

  /** Writes the averaged window into `out` and starts a new window. */
  fill(out: PerfSample, droppedSeconds: number): PerfSample {
    const frames = Math.max(1, this.frames);
    const elapsed = Math.max(1e-6, this.elapsed);
    out.fps = this.frames / elapsed;
    out.frameMs = (elapsed / frames) * 1000;
    out.worstFrameMs = this.worst * 1000;
    out.cpuMs = this.cpu / frames;
    out.stepsPerSecond = this.steps / elapsed;
    out.droppedSeconds = droppedSeconds;
    this.frames = 0;
    this.steps = 0;
    this.elapsed = 0;
    this.cpu = 0;
    this.worst = 0;
    return out;
  }
}
