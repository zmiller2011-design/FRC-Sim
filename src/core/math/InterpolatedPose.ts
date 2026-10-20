import { lerp, lerpAngle } from './scalar';
import type { Pose2d } from './types';

/**
 * Holds the pose at the previous and current simulation step so rendering can
 * interpolate between them. Call `beginStep()` before each fixed update mutates `current`.
 */
export class InterpolatedPose {
  readonly previous: Pose2d = { x: 0, y: 0, heading: 0 };
  readonly current: Pose2d = { x: 0, y: 0, heading: 0 };

  beginStep(): void {
    this.previous.x = this.current.x;
    this.previous.y = this.current.y;
    this.previous.heading = this.current.heading;
  }

  /** Teleports without interpolation (spawns, resets). */
  reset(x: number, y: number, heading: number): void {
    this.current.x = this.previous.x = x;
    this.current.y = this.previous.y = y;
    this.current.heading = this.previous.heading = heading;
  }

  sample(alpha: number, out: Pose2d): Pose2d {
    out.x = lerp(this.previous.x, this.current.x, alpha);
    out.y = lerp(this.previous.y, this.current.y, alpha);
    out.heading = lerpAngle(this.previous.heading, this.current.heading, alpha);
    return out;
  }
}
