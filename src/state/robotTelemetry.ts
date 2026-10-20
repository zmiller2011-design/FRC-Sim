/** One swerve module as shown in the telemetry panel. */
export interface ModuleTelemetry {
  name: string;
  /** Measured steering angle, robot frame, wrapped to ±180° (deg). */
  angleDeg: number;
  targetAngleDeg: number;
  /** Measured wheel ground speed (m/s). */
  speed: number;
  targetSpeed: number;
  currentA: number;
  slipping: boolean;
}

/** Developer telemetry for the driven robot, published at the telemetry rate. */
export interface RobotTelemetry {
  /** Frame-centre pose (m, deg). */
  x: number;
  y: number;
  headingDeg: number;
  /** Field-frame velocity (m/s). */
  vx: number;
  vy: number;
  /** Robot-frame velocity (m/s). */
  vxRobot: number;
  vyRobot: number;
  speed: number;
  /** Angular velocity (deg/s). */
  omegaDegPs: number;
  /** Field-frame acceleration (m/s²) and its magnitude; angular acceleration (deg/s²). */
  ax: number;
  ay: number;
  accel: number;
  alphaDegPs2: number;
  modules: ModuleTelemetry[];
  command: { vx: number; vy: number; omega: number; fieldRelative: boolean; xLock: boolean };
  /** Motors in neutral because nothing is requested. */
  neutral: boolean;
  neutralMode: 'brake' | 'coast';
  contacts: number;
  terrainHeight: number;
  physicsHz: number;
  controlHz: number;
  /** Physics timestep (ms). */
  dtMs: number;
  gamepad: string | null;
}

export function copyRobotTelemetry(t: Readonly<RobotTelemetry>): RobotTelemetry {
  return { ...t, command: { ...t.command }, modules: t.modules.map((m) => ({ ...m })) };
}
