import type { DriverAxes } from '@/input/DriverAxes';
import type { Alliance } from '@/field/types';
import type { DriveLimits } from '../config/types';
import type { DriveCommand } from '../DriveCommand';

export interface HumanDriveOptions {
  fieldRelative: boolean;
  /** The driver's alliance: field-relative "forward" points away from their wall. */
  alliance: Alliance;
  /** Speed multiplier while precision mode is held. */
  precisionScale: number;
}

/**
 * Maps driver axes to a drive command, the way teleop code does. Field-relative driving is
 * from the driver's point of view: blue drivers face +X, red drivers face −X.
 */
export class HumanDriveController {
  constructor(
    public options: HumanDriveOptions,
    private readonly limits: DriveLimits,
  ) {}

  update(axes: DriverAxes, out: DriveCommand): DriveCommand {
    const scale = axes.precision ? this.options.precisionScale : 1;
    const flip = this.options.fieldRelative && this.options.alliance === 'red' ? -1 : 1;
    out.vx = axes.forward * this.limits.maxSpeedMps * scale * flip;
    out.vy = axes.left * this.limits.maxSpeedMps * scale * flip;
    out.omega = axes.rotate * this.limits.maxAngularRateRadps * scale;
    out.fieldRelative = this.options.fieldRelative;
    out.xLock = axes.xLock;
    return out;
  }
}
