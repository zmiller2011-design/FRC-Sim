import type { Disposable } from '../resources/Disposable';

/** Called once per presented frame with the real time elapsed since the previous frame. */
export type FrameCallback = (realDeltaSeconds: number) => void;

/** Source of frames. The browser uses requestAnimationFrame; a headless server can use a timer. */
export interface FrameDriver extends Disposable {
  start(callback: FrameCallback): void;
  stop(): void;
  readonly running: boolean;
}

/** Longest real frame we accept. Longer gaps (tab switch, debugger pause) are clamped. */
const MAX_FRAME_SECONDS = 0.25;

export class AnimationFrameDriver implements FrameDriver {
  private handle = 0;
  private lastTimeMs = -1;
  private callback: FrameCallback | null = null;

  private readonly onVisibilityChange = (): void => {
    // Restart timing when the tab becomes visible so the hidden period isn't simulated.
    this.lastTimeMs = -1;
  };

  private readonly onFrame = (timeMs: number): void => {
    this.handle = requestAnimationFrame(this.onFrame);
    const delta = this.lastTimeMs < 0 ? 0 : (timeMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = timeMs;
    this.callback?.(Math.min(Math.max(delta, 0), MAX_FRAME_SECONDS));
  };

  get running(): boolean {
    return this.callback !== null;
  }

  start(callback: FrameCallback): void {
    if (this.callback) this.stop();
    this.callback = callback;
    this.lastTimeMs = -1;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.handle = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    cancelAnimationFrame(this.handle);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.callback = null;
    this.handle = 0;
  }

  dispose(): void {
    this.stop();
  }
}
