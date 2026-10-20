import {
  AnimationFrameDriver,
  DisposalScope,
  type Disposable,
  EventBus,
  FixedStepper,
  type FrameDriver,
  fieldToWorld,
  vec3,
} from '@/core';
import { rebuiltAnchors } from '@/game/seasons/rebuilt2026';
import {
  assertWebGL2,
  CameraManager,
  type CameraModeId,
  DriverStationCameraMode,
  type GpuInfo,
  OrbitCameraMode,
  OverheadCameraMode,
  Renderer,
  SceneManager,
} from '@/render';
import { mergeSettings, type Settings, type SettingsPatch } from '@/settings';
import type { PerfSample, RenderStatus, RobotTelemetry } from '@/state';
import { type FieldInfo, FieldRuntime } from './FieldRuntime';
import { PerfMonitor } from './PerfMonitor';
import { RobotRuntime } from './RobotRuntime';
import { SystemScheduler } from './SystemScheduler';

/** Driver eye position: behind the wall at standing height. [APPROX] */
const DRIVER_EYE = { behindWallM: 0.9, heightM: 1.65 };
/** Default orbit view: above and behind the blue alliance's right corner. */
const ORBIT_OFFSET = { x: -9, y: 9.5, z: 11 };

export interface EngineEvents {
  /** Published at `interface.telemetryHz`. The object is reused: copy it if you keep it. */
  perf: Readonly<PerfSample>;
  renderStatus: RenderStatus;
  /** The field was built or rebuilt (variant change). */
  field: FieldInfo;
  /** Robot telemetry at `interface.telemetryHz`. The object is reused: copy it if kept. */
  robot: Readonly<RobotTelemetry>;
}

export interface EngineOptions {
  settings: Settings;
  /** Defaults to requestAnimationFrame. Tests and headless servers can supply their own. */
  frameDriver?: FrameDriver;
}

/** Read-only view of the recent frame-time ring buffer, for graphing. */
export interface FrameHistory {
  /** Frame times in milliseconds. The oldest sample is at `head`. */
  readonly samples: Float32Array;
  readonly head: number;
}

/**
 * Composition root. Owns every system and the frame loop. The UI talks to the simulation
 * only through this class's public methods and `events`.
 *
 * Loop structure (one animation frame):
 *   1. FixedStepper converts real elapsed time into 0..N fixed simulation steps.
 *   2. Render-sync systems interpolate between the last two steps using `alpha`.
 *   3. The camera updates and the scene is drawn once.
 * Simulation never depends on frame rate; rendering never advances the simulation.
 */
export class Engine implements Disposable {
  readonly events = new EventBus<EngineEvents>();

  private settings: Settings;
  private readonly scope = new DisposalScope();
  private readonly renderer: Renderer;
  private readonly scenes: SceneManager;
  private readonly cameras: CameraManager;
  private readonly field: FieldRuntime;
  private readonly robot: RobotRuntime;
  private readonly scheduler: SystemScheduler;
  private readonly stepper: FixedStepper;
  private readonly driver: FrameDriver;
  private readonly perf: PerfMonitor;
  private readonly perfSample: PerfSample = {
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
  };
  private droppedAtLastSample = 0;
  private paused = false;
  private timeScale = 1;
  private mounted = false;

  /**
   * Checks WebGL support, then builds every system. Rejects with a `RenderInitError`
   * describing what went wrong when 3D graphics are unavailable.
   * Async so heavy one-time setup (physics WASM, asset preloads) can be awaited here later.
   */
  static async create(options: EngineOptions): Promise<Engine> {
    assertWebGL2();
    return new Engine(options);
  }

  private constructor(options: EngineOptions) {
    this.settings = options.settings;
    const { graphics, simulation, interface: ui, field } = this.settings;

    try {
      this.driver = this.scope.add(options.frameDriver ?? new AnimationFrameDriver());
      this.renderer = this.scope.add(new Renderer(graphics));
      const anchors = rebuiltAnchors(field.variant);
      this.scenes = this.scope.add(
        new SceneManager(graphics, {
          center: { x: anchors.lengthM / 2, z: -anchors.widthM / 2 },
          shadowExtentM: 11.5,
        }),
      );
      this.scenes.setEnvironment(this.renderer.createEnvironment());
      this.field = this.scope.add(new FieldRuntime(this.scenes.world, field.variant));
      this.field.setCollidersVisible(field.showColliders);
      this.cameras = this.scope.add(new CameraManager());
    } catch (error) {
      // Release whatever was created before the failure, then surface the original error.
      this.scope.dispose();
      throw error;
    }
    this.scheduler = new SystemScheduler(simulation.logicDivisor);
    this.stepper = new FixedStepper({
      stepHz: simulation.physicsHz,
      maxSubSteps: simulation.maxSubSteps,
    });
    this.perf = new PerfMonitor(ui.telemetryHz);
    this.scope.defer(() => this.scheduler.clear());
    this.scope.defer(() => this.events.clear());

    this.registerCameras();
    this.cameras.setMode('orbit');
    this.scope.defer(this.renderer.onResize(() => this.cameras.setAspect(this.renderer.aspect)));
    this.scope.defer(
      this.renderer.onStatusChange((status) => {
        // A restored context has lost its GPU-side environment map.
        if (status === 'ok') this.scenes.setEnvironment(this.renderer.createEnvironment());
        this.events.emit('renderStatus', status);
      }),
    );
    this.scheduler.addRender({ name: 'field', sync: () => this.field.sync() });
    this.robot = this.scope.add(
      new RobotRuntime(this.scenes.world, this.scheduler, this.field.config, this.settings.driving),
    );
  }

  getSettings(): Readonly<Settings> {
    return this.settings;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get gpuInfo(): Readonly<GpuInfo> {
    return this.renderer.gpuInfo;
  }

  get renderStatus(): RenderStatus {
    return this.renderer.currentStatus;
  }

  get fieldInfo(): FieldInfo {
    return this.field.info;
  }

  get cameraMode(): CameraModeId | null {
    return this.cameras.activeId;
  }

  /** Recent frame times for diagnostics. The buffer is live: read it, don't keep it. */
  get frameHistory(): FrameHistory {
    return { samples: this.perf.frameHistory, head: this.perf.historyHead };
  }

  /** Attaches the canvas to `container` and starts the frame loop. */
  mount(container: HTMLElement): void {
    this.renderer.mount(container);
    this.cameras.attach(this.renderer.canvas);
    this.driver.start(this.onFrame);
    this.mounted = true;
  }

  /** Stops the frame loop and detaches the canvas. GPU resources are kept for the next mount. */
  unmount(): void {
    this.driver.stop();
    this.cameras.detach();
    this.renderer.unmount();
    this.mounted = false;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setTimeScale(scale: number): void {
    this.timeScale = Math.min(Math.max(scale, 0), 4);
  }

  setCameraMode(id: CameraModeId): void {
    this.cameras.setMode(id);
  }

  resetCamera(): void {
    this.cameras.resetActive();
  }

  /** Restores every game piece to the official starting configuration. */
  resetField(): void {
    this.field.reset();
  }

  /** Puts the robot back at its starting position, at rest. */
  resetRobot(): void {
    this.robot.reset();
  }

  applySettings(patch: SettingsPatch): void {
    this.settings = mergeSettings(this.settings, patch);
    const { graphics, simulation, interface: ui, field } = this.settings;

    if (this.renderer.applyGraphics(graphics)) {
      // New WebGL context: GPU-side resources such as the environment map must be rebuilt.
      this.scenes.setEnvironment(this.renderer.createEnvironment());
      if (this.mounted) this.cameras.attach(this.renderer.canvas);
    }
    this.scenes.applyGraphics(graphics);
    this.stepper.configure({ stepHz: simulation.physicsHz, maxSubSteps: simulation.maxSubSteps });
    this.scheduler.setLogicDivisor(simulation.logicDivisor);
    this.perf.setPublishHz(ui.telemetryHz);

    if (this.field.setVariant(field.variant)) {
      const mode = this.cameras.activeId ?? 'orbit';
      this.registerCameras();
      this.cameras.setMode(mode);
      this.scenes.applyGraphics(graphics);
      this.robot.setField(this.field.config);
      this.events.emit('field', this.field.info);
    }
    this.robot.applyDriving(this.settings.driving);
    this.field.setCollidersVisible(field.showColliders);
  }

  dispose(): void {
    this.unmount();
    this.scope.dispose();
  }

  /** (Re)creates camera modes framed on the current field. */
  private registerCameras(): void {
    const { lengthM: L, widthM: W } = this.field.config;
    const bounds = this.field.bounds;
    const center = fieldToWorld(L / 2, W / 2, 0, vec3());
    this.cameras.register(
      new OrbitCameraMode(center, vec3(ORBIT_OFFSET.x, ORBIT_OFFSET.y, ORBIT_OFFSET.z), bounds),
    );
    this.cameras.register(new OverheadCameraMode(bounds));
    const lookAt = fieldToWorld(L / 2, W / 2, 0.3, vec3());
    // Stand at the DRIVER STATION nearest the centre (the wall centre is behind the TOWER).
    const stationY = this.centralDriverStationY();
    this.cameras.register(
      new DriverStationCameraMode(
        'blueStation',
        fieldToWorld(-DRIVER_EYE.behindWallM, stationY, DRIVER_EYE.heightM, vec3()),
        lookAt,
      ),
    );
    this.cameras.register(
      new DriverStationCameraMode(
        'redStation',
        fieldToWorld(L + DRIVER_EYE.behindWallM, W - stationY, DRIVER_EYE.heightM, vec3()),
        lookAt,
      ),
    );
  }

  /** Field Y of the blue DRIVER STATION closest to the field centreline. */
  private centralDriverStationY(): number {
    const W = this.field.config.widthM;
    const wall = this.field.config.elements.find(
      (e) => e.type === 'allianceWall' && e.alliance === 'blue',
    );
    if (wall?.type !== 'allianceWall') return W / 2;
    let best = W / 2;
    let bestDistance = Infinity;
    for (const seg of wall.dims.segments) {
      if (seg.kind !== 'driverStation') continue;
      const mid = (seg.from + seg.to) / 2;
      if (Math.abs(mid - W / 2) < bestDistance) {
        bestDistance = Math.abs(mid - W / 2);
        best = mid;
      }
    }
    return best;
  }

  private readonly runStep = (dt: number, tick: number): void => {
    this.scheduler.runFixed(dt, tick);
  };

  private readonly onFrame = (realDt: number): void => {
    const start = performance.now();

    const simDt = this.paused ? 0 : realDt * this.timeScale;
    const steps = this.stepper.advance(simDt, this.runStep);
    this.scheduler.runRender(this.stepper.alpha, realDt);
    this.cameras.update(realDt);
    this.renderer.render(this.scenes.scene, this.cameras.camera);

    const cpuMs = performance.now() - start;
    if (this.perf.record(realDt, cpuMs, steps)) {
      const dropped = this.stepper.droppedTime - this.droppedAtLastSample;
      this.droppedAtLastSample = this.stepper.droppedTime;
      this.perf.fill(this.perfSample, dropped);
      this.perfSample.simTime = this.stepper.simTime;
      this.renderer.readStats(this.perfSample);
      this.events.emit('perf', this.perfSample);
      const { physicsHz, logicDivisor } = this.settings.simulation;
      this.events.emit('robot', this.robot.fillTelemetry(physicsHz, physicsHz / logicDivisor));
    }
  };
}
