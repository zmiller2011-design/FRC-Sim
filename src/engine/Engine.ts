import {
  AnimationFrameDriver,
  DisposalScope,
  type Disposable,
  EventBus,
  FixedStepper,
  type FrameDriver,
  fieldToWorld,
  pose2d,
  vec3,
} from '@/core';
import {
  CameraManager,
  type CameraModeId,
  OrbitCameraMode,
  PLACEHOLDER_FIELD,
  Renderer,
  SceneGraph,
  TestBodyView,
} from '@/render';
import { mergeSettings, type Settings, type SettingsPatch } from '@/settings';
import type { PerfSample } from '@/state';
import { PerfMonitor } from './PerfMonitor';
import { TestBodySim } from './sandbox/TestBodySim';
import { SystemScheduler } from './SystemScheduler';

export interface EngineEvents {
  /** Published at `interface.telemetryHz`. The object is reused: copy it if you keep it. */
  perf: Readonly<PerfSample>;
}

export interface EngineOptions {
  settings: Settings;
  /** Defaults to requestAnimationFrame. Tests and headless servers can supply their own. */
  frameDriver?: FrameDriver;
}

/**
 * Composition root. Owns every system and the frame loop. The UI talks to the simulation
 * only through this class's public methods and `events`.
 */
export class Engine implements Disposable {
  readonly events = new EventBus<EngineEvents>();

  private settings: Settings;
  private readonly scope = new DisposalScope();
  private readonly renderer: Renderer;
  private readonly sceneGraph: SceneGraph;
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
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };
  private droppedAtLastSample = 0;
  private paused = false;
  private timeScale = 1;
  private mounted = false;

  // Stage-1 sandbox content; replaced by field, robots and game pieces in later stages.
  private readonly testBody: TestBodySim;
  private readonly testBodyView: TestBodyView;
  private readonly interpolatedPose = pose2d();

  /** Async so heavy one-time setup (physics WASM, asset preloads) can be awaited here. */
  static async create(options: EngineOptions): Promise<Engine> {
    return new Engine(options);
  }

  private constructor(options: EngineOptions) {
    this.settings = options.settings;
    const { graphics, simulation, interface: ui } = this.settings;

    this.driver = this.scope.add(options.frameDriver ?? new AnimationFrameDriver());
    this.renderer = this.scope.add(new Renderer(graphics));
    this.sceneGraph = this.scope.add(new SceneGraph(graphics));
    this.cameras = this.scope.add(new CameraManager());
    this.scheduler = new SystemScheduler(simulation.logicDivisor);
    this.stepper = new FixedStepper({
      stepHz: simulation.physicsHz,
      maxSubSteps: simulation.maxSubSteps,
    });
    this.perf = new PerfMonitor(ui.telemetryHz);
    this.scope.defer(() => this.scheduler.clear());
    this.scope.defer(() => this.events.clear());

    const fieldCenter = fieldToWorld(
      PLACEHOLDER_FIELD.lengthM / 2,
      PLACEHOLDER_FIELD.widthM / 2,
      0,
      vec3(),
    );
    this.cameras.register(
      new OrbitCameraMode(vec3(fieldCenter.x, 0, fieldCenter.z), vec3(0, 11, 14)),
    );
    this.cameras.setMode('orbit');
    this.scope.defer(this.renderer.onResize(() => this.cameras.setAspect(this.renderer.aspect)));

    this.testBody = new TestBodySim(PLACEHOLDER_FIELD.lengthM / 2, PLACEHOLDER_FIELD.widthM / 2);
    this.testBodyView = this.scope.add(new TestBodyView(this.sceneGraph.field));
    this.scheduler.addFixed('physics', this.testBody);
    this.scheduler.addRender({
      name: 'testBodyView',
      sync: (alpha) =>
        this.testBodyView.sync(this.testBody.pose.sample(alpha, this.interpolatedPose)),
    });
  }

  getSettings(): Readonly<Settings> {
    return this.settings;
  }

  get isPaused(): boolean {
    return this.paused;
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

  applySettings(patch: SettingsPatch): void {
    this.settings = mergeSettings(this.settings, patch);
    const { graphics, simulation, interface: ui } = this.settings;

    if (this.renderer.applyGraphics(graphics) && this.mounted) {
      this.cameras.attach(this.renderer.canvas);
    }
    this.sceneGraph.applyGraphics(graphics);
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
    this.renderer.render(this.sceneGraph.scene, this.cameras.camera);

    const cpuMs = performance.now() - start;
    if (this.perf.record(realDt, cpuMs, steps)) {
      const dropped = this.stepper.droppedTime - this.droppedAtLastSample;
      this.droppedAtLastSample = this.stepper.droppedTime;
      this.perf.fill(this.perfSample, dropped);
      this.renderer.readStats(this.perfSample);
      this.events.emit('perf', this.perfSample);
    }
  };
}
