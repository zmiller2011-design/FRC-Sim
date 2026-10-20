import {
  AnimationFrameDriver,
  DisposalScope,
  type Disposable,
  EventBus,
  FixedStepper,
  type FrameDriver,
  pose2d,
  vec3,
} from '@/core';
import {
  assertWebGL2,
  CameraManager,
  type CameraModeId,
  type GpuInfo,
  OrbitCameraMode,
  Renderer,
  SceneManager,
  TestBodyView,
} from '@/render';
import { mergeSettings, type Settings, type SettingsPatch } from '@/settings';
import type { PerfSample, RenderStatus } from '@/state';
import { PerfMonitor } from './PerfMonitor';
import { TestBodySim } from './sandbox/TestBodySim';
import { SystemScheduler } from './SystemScheduler';

export interface EngineEvents {
  /** Published at `interface.telemetryHz`. The object is reused: copy it if you keep it. */
  perf: Readonly<PerfSample>;
  renderStatus: RenderStatus;
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

  // Rendering-foundation test content; replaced by robots in stage 4.
  private readonly testBody: TestBodySim;
  private readonly interpolatedPose = pose2d();

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
    const { graphics, simulation, interface: ui } = this.settings;

    try {
      this.driver = this.scope.add(options.frameDriver ?? new AnimationFrameDriver());
      this.renderer = this.scope.add(new Renderer(graphics));
      this.scenes = this.scope.add(new SceneManager(graphics));
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

    // World coordinates: the field-frame origin is the world origin (see core/math/frames.ts).
    this.cameras.register(new OrbitCameraMode(vec3(0, 0, 0), vec3(-5, 4.5, 6.5)));
    this.cameras.setMode('orbit');
    this.scope.defer(this.renderer.onResize(() => this.cameras.setAspect(this.renderer.aspect)));
    this.scope.defer(
      this.renderer.onStatusChange((status) => this.events.emit('renderStatus', status)),
    );

    // The test body drives a figure-eight centred on the origin.
    this.testBody = new TestBodySim(0, 0);
    const testBodyView = this.scenes.addView(new TestBodyView(this.scenes.world));
    this.scheduler.addFixed('physics', this.testBody);
    this.scheduler.addRender({
      name: 'testBodyView',
      sync: (alpha) => testBodyView.sync(this.testBody.pose.sample(alpha, this.interpolatedPose)),
    });
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

  applySettings(patch: SettingsPatch): void {
    this.settings = mergeSettings(this.settings, patch);
    const { graphics, simulation, interface: ui } = this.settings;

    if (this.renderer.applyGraphics(graphics) && this.mounted) {
      this.cameras.attach(this.renderer.canvas);
    }
    this.scenes.applyGraphics(graphics);
    this.stepper.configure({ stepHz: simulation.physicsHz, maxSubSteps: simulation.maxSubSteps });
    this.scheduler.setLogicDivisor(simulation.logicDivisor);
    this.perf.setPublishHz(ui.telemetryHz);
  }

  dispose(): void {
    this.unmount();
    this.scope.dispose();
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
    }
  };
}
