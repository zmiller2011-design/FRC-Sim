/** Averaged performance numbers published by the engine at the telemetry rate. */
export interface PerfSample {
  fps: number;
  /** Average real time between frames, in milliseconds. */
  frameMs: number;
  /** Worst frame in the window, in milliseconds. */
  worstFrameMs: number;
  /** Average CPU time spent in simulation + render submission per frame, in milliseconds. */
  cpuMs: number;
  /** Fixed simulation steps executed per real second. */
  stepsPerSecond: number;
  /** Simulated seconds dropped in the window because the simulation fell behind. */
  droppedSeconds: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}
