# FRC Simulator — Architecture Proposal

Status: **Approved** with the decisions in §8. Stages 0 and 1 are implemented. Networked multiplayer (§9) was added to the plan after approval.

## 0. Current project state

- At proposal time the repository was empty (no commits, no files), so this is a greenfield project.
- Toolchain: Node 22+, npm 10. TypeScript is pinned to 6.0 because typescript-eslint does not support 7.x yet.
- Implemented so far: stage 0 (setup) and stage 1 (engine core). See §5.

---

## 1. Guiding decisions

| Decision        | Choice                                                                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering       | **Imperative Three.js**, owned by a non-React `Renderer` class                                                                                                                                                                          | React Three Fiber routes scene changes through React reconciliation and makes it easy to accidentally re-render per frame. With plain Three.js, React never sees the 3D scene.                                                                              |
| React's role    | **UI shell only** (menus, HUD, settings, telemetry, builder)                                                                                                                                                                            | React re-renders happen only on user actions or throttled telemetry (≤10 Hz). They never happen per frame.                                                                                                                                                  |
| Simulation loop | **Fixed timestep (default 200 Hz physics, 50 Hz robot logic)** with an accumulator, a sub-step cap and render interpolation                                                                                                             | Frame-rate-independent, reproducible, and the 50 Hz logic rate matches the real roboRIO loop period of 20 ms.                                                                                                                                               |
| Physics         | **Rapier 3D (WASM)** for rigid bodies and collisions; **custom drivetrain/mechanism models** on top                                                                                                                                     | Game pieces bouncing, stacking and colliding with field elements and robots is what a physics engine does well and is very costly to write by hand. Drivetrain behavior (swerve modules, motor curves, traction) is FRC-specific and must be custom anyway. |
| State           | Mutable, typed simulation state outside React. A small **Zustand vanilla store** for UI-facing state, fed by throttled snapshots                                                                                                        | Avoids per-frame React updates and gives one clear boundary between sim and UI.                                                                                                                                                                             |
| Season data     | A **`GameDefinition` plugin** (field config, game pieces, scoring rules)                                                                                                                                                                | The engine does not depend on the season, so a new game means a new folder, not a rewrite.                                                                                                                                                                  |
| Units           | SI everywhere (m, kg, s, rad, N, V, A)                                                                                                                                                                                                  | No unit bugs. Imperial values from the game manual are converted once, in data files.                                                                                                                                                                       |
| Coordinates     | Field 2D poses use the **WPILib convention** (origin at the blue alliance wall corner, +X toward red, +Y left, CCW+). The 3D world is **Y-up** (Three.js and Rapier). Conversion happens in exactly one module (`core/math/frames.ts`). | Autonomous paths, AprilTag layouts and telemetry stay compatible with real FRC tooling.                                                                                                                                                                     |

---

## 2. Folder structure

```
src/
  main.tsx                    # React entry: mounts <App/>, nothing else
  app/
    App.tsx                   # Layout and routing between screens only
    screens/                  # MainMenu, RobotBuilder, MatchScreen, Settings
    EngineProvider.tsx        # Creates/destroys the Engine and exposes it via context

  core/                       # Season-independent foundation; no React, no Three
    loop/
      FixedStepper.ts         # Accumulator, sub-step cap, interpolation alpha, tick-derived sim time
      FrameDriver.ts          # rAF driver (browser); a timer driver runs the headless server
    events/EventBus.ts        # Typed pub/sub (piece scored, phase changed, ...)
    math/                     # Vec2, Pose2d, Transform, frames.ts, pooled temporaries
    random/Rng.ts             # Seeded PRNG for reproducible matches
    ecs/                      # Lightweight entity registry (ids, component tables)
    resources/Disposable.ts   # Disposal contract and DisposalScope helper

  engine/
    Engine.ts                 # Composition root: wires systems, owns lifecycle
    SystemScheduler.ts        # Ordered fixedUpdate / render-sync phases

  physics/                    # Only module that imports Rapier
    PhysicsWorld.ts           # Rapier world init (async WASM), step, dispose
    colliders/                # Builders: field statics, robot chassis, piece shapes
    queries.ts                # Raycasts and shape overlaps for intakes and sensors
    collisionGroups.ts        # Bitmasks: field, robot, piece, sensor

  robot/
    config/                   # RobotConfig types, presets, validation, JSON schema
    Robot.ts                  # Robot instance: chassis body, drivetrain, mechanisms
    drivetrain/
      Drivetrain.ts           # Interface
      SwerveDrive.ts          # Kinematics, module states, desaturation, field-relative
      SwerveModule.ts         # Steer and drive motor models, traction limit
      TankDrive.ts, MecanumDrive.ts
    actuators/
      DcMotorModel.ts         # Kraken/Falcon/NEO/Vortex curves: stall torque, free speed, current
      Gearbox.ts
    mechanisms/
      Mechanism.ts            # Interface
      Intake.ts, Indexer.ts, Shooter.ts, Elevator.ts, Arm.ts, Climber.ts
    controllers/
      RobotController.ts      # Interface: produces RobotCommand each logic tick
      HumanController.ts      # From input bindings
      AutoController.ts       # From autonomous routines (stage 10)
    sensors/                  # Gyro, encoders, simulated AprilTag vision (later)

  input/
    InputManager.ts           # Polls keyboard and gamepads once per logic tick
    KeyboardSource.ts
    GamepadSource.ts          # navigator.getGamepads polling, hot-plug
    bindings/                 # Action map: DriveX, DriveY, Rotate, Intake, Score...
    shaping.ts                # Deadband, expo curves, slew limits

  game/
    GameDefinition.ts         # Interface every season implements
    match/
      MatchController.ts      # Phase state machine: pre, auto, transition, teleop, endgame, post
      MatchState.ts
    scoring/
      ScoringSystem.ts        # Applies rule callbacks and keeps the alliance scoreboard
      zones.ts                # Sensor volumes that trigger scoring events
    pieces/
      GamePieceManager.ts     # Pooled pieces: spawn, possess, release, despawn
    seasons/
      generic/                # Evergreen test game (always available, used in tests)
      <season-year>/          # field.ts, pieces.ts, rules.ts, assets manifest

  field/
    FieldConfig.ts            # Types: dimensions, elements, tags, zones, spawn points
    FieldBuilder.ts           # FieldConfig -> physics statics plus render meshes

  render/                     # Only module that imports Three.js
    Renderer.ts               # WebGL context, canvas, resize + pixel-ratio tracking, context loss
    SceneManager.ts           # Scene, background, lighting, environment, `world` group for views
    webglSupport.ts           # WebGL2 probe, GPU info, RenderInitError codes for the error screen
    environment/              # Lighting (one shadow caster), TestFloor (until the field exists)
    assets/
      AssetManager.ts         # GLTF/texture loading, ref-counted cache, dispose
      materials.ts            # Shared material library
    views/
      RobotView.ts            # Syncs robot state to meshes (interpolated)
      GamePieceView.ts        # InstancedMesh per piece type
      FieldView.ts            # Merged static geometry
    cameras/
      CameraManager.ts        # Active camera, transitions
      modes/                  # DriverStation, Follow, TopDown, Orbit, RobotPOV
    debug/                    # Collider wireframes, vectors, perf HUD

  state/
    uiStore.ts                # Zustand vanilla store: settings, screen, match summary
    telemetry/
      TelemetryBus.ts         # Sim -> ring buffers; throttled snapshot to UI
      channels.ts
    persistence.ts            # localStorage: settings, robot presets, bindings

  settings/
    Settings.ts               # Typed settings and defaults
    qualityPresets.ts         # Low / Medium / High / Ultra

  ui/                         # Presentational React components
    hud/                      # Timer, score bar, match phase banner
    telemetry/                # Charts (canvas based), value tables
    fieldview/                # 2D top-down minimap (canvas 2D, not React DOM per robot)
    settings/, builder/, common/

  net/                        # Stage 9: online multiplayer (client side)
    protocol/                 # Shared message types + binary encode/decode (also used by server/)
    NetClient.ts              # WebSocket connection, room join by code, clock sync
    Prediction.ts             # Local robot prediction and reconciliation
    SnapshotBuffer.ts         # Remote entity interpolation (~100 ms behind)

  auto/                       # Stage 11
    routines/                 # Command-style routine runner (sequential, parallel, race)
    paths/                    # Trajectory following, path file import

server/                       # Stage 9: headless authoritative match server (Node)
  index.ts                    # WebSocket rooms, join codes, tick loop using the same sim code
tests/                        # Vitest: kinematics, loop, scoring, match FSM, determinism
public/assets/                # Compressed GLB and KTX2 assets (original work only)
docs/
```

**Dependency rules** (to be enforced with ESLint `no-restricted-imports`):

- `core` imports nothing internal.
- `physics` → `core`. `render` → `core`. Neither imports React.
- `robot`, `game`, `field`, `input` → `core` and `physics` (never `render` or `ui`).
- `render/views` read sim state through read-only interfaces. They never mutate it.
- `ui` → `state` and the Engine's public API only. It never touches Three or Rapier objects directly.
- `engine` is the only module that knows about everything.

---

## 3. System responsibilities and core interfaces

These sketches show the contracts I'm proposing. Final code may refine them.

### 3.1 Loop and scheduling

```ts
interface FixedStepSystem {
  /** Called at the fixed physics rate. dt is constant (e.g. 1/200 s). */
  fixedUpdate(dt: number, tick: number): void;
}
interface RenderSyncSystem {
  /** Called once per animation frame. alpha in [0,1) interpolates prev->current state. */
  sync(alpha: number, frameDt: number): void;
}
interface SimLoopConfig {
  physicsHz: number; // default 200
  logicDivisor: number; // robot logic every N physics steps (4 => 50 Hz)
  maxSubSteps: number; // prevents the "spiral of death"; excess time is dropped
  timeScale: number; // slow-mo / pause
}
```

Per-tick order: `Input.sample → Controllers → Robot logic (drivetrain/mechanisms apply forces) → Physics.step → Sensor/zone queries → GamePieces → Scoring → MatchController → Telemetry.record`.

### 3.2 Physics

```ts
interface PhysicsWorld extends Disposable {
  init(): Promise<void>; // loads WASM once
  step(dt: number): void;
  createBody(desc: BodyDesc): BodyHandle;
  removeBody(h: BodyHandle): void;
  raycast(origin: Vec3, dir: Vec3, maxDist: number, mask: number): RayHit | null;
  overlap(shape: ShapeDesc, pose: Transform, mask: number, out: number[]): number;
  drainCollisionEvents(cb: (e: CollisionEvent) => void): void;
}
```

The robot chassis is a **dynamic** rigid body. The drivetrain computes the per-wheel traction force (from motor torque, limited by μ·normal load) and applies it at the module positions. This produces realistic acceleration, pushing matches and wall contact without frame-dependent movement.

### 3.3 Robot

```ts
type DrivetrainType = 'swerve' | 'tank' | 'mecanum';

interface RobotConfig {
  id: string;
  name: string;
  frame: { lengthM: number; widthM: number; bumperThicknessM: number; heightM: number };
  massKg: number;
  momentOfInertiaKgM2?: number; // derived if omitted
  drivetrain: SwerveConfig | TankConfig | MecanumConfig;
  mechanisms: MechanismConfig[]; // discriminated union by `kind`
  capacity: Record<GamePieceTypeId, number>;
}

interface SwerveConfig {
  type: 'swerve';
  modules: { positionM: Vec2 }[]; // relative to robot center
  driveMotor: MotorId;
  driveGearRatio: number;
  wheelRadiusM: number;
  steerMotor: MotorId;
  steerGearRatio: number;
  wheelCoF: number;
  maxSpeedMps?: number; // software limit
}

interface RobotState {
  // read-only view for render/UI
  readonly id: string;
  readonly alliance: Alliance;
  readonly pose: Pose2d; // field frame, WPILib convention
  readonly velocity: ChassisSpeeds;
  readonly modules?: readonly SwerveModuleState[];
  readonly mechanisms: readonly MechanismState[];
  readonly heldPieces: readonly GamePieceId[];
}

interface RobotCommand {
  // controller output, once per logic tick
  drive: { vx: number; vy: number; omega: number; fieldRelative: boolean };
  actions: Partial<Record<ActionId, number | boolean>>;
}

interface RobotController {
  update(state: RobotState, match: MatchState, dt: number): RobotCommand;
}

interface Mechanism {
  readonly kind: string;
  fixedUpdate(cmd: RobotCommand, ctx: MechanismContext, dt: number): void;
  getState(): MechanismState;
}
```

Controllers are the extension point for multiple robots and autonomous play. Human, autonomous, scripted AI and (eventually) networked robots all produce a `RobotCommand`.

### 3.4 Game pieces

```ts
interface GamePieceDef {
  typeId: GamePieceTypeId;
  shape:
    | { kind: 'sphere'; radiusM: number }
    | { kind: 'cylinder' | 'torus' | 'box' | 'convex' /* ... */ };
  massKg: number;
  restitution: number;
  friction: number;
  renderAsset: AssetId;
}
type GamePieceLocation =
  | { kind: 'field' } // physics-simulated
  | { kind: 'held'; robotId: string; slot: number } // kinematic, follows robot; physics body disabled
  | { kind: 'scored'; zoneId: string }
  | { kind: 'staged' }; // pre-placed / human player station
interface GamePieceState {
  id: GamePieceId;
  typeId: GamePieceTypeId;
  location: GamePieceLocation;
}
```

Pickup works through intake sensor volumes (overlap query) plus a capacity check. On pickup the piece's body is put to sleep and removed from the collision groups, and it is rendered attached to the robot. On release (eject or shoot) the body is re-enabled with an initial velocity.

### 3.5 Field

```ts
interface FieldConfig {
  season: string;
  lengthM: number;
  widthM: number;
  variant?: 'welded' | 'andymark'; // some seasons differ by vendor
  boundaries: StaticElement[]; // walls, guardrails
  elements: FieldElement[]; // scoring structures, ramps, barriers
  aprilTags: { id: number; pose: Pose3d }[];
  zones: ZoneDef[]; // scoring, starting, protected, etc.
  startingPositions: Record<Alliance, Pose2d[]>;
  pieceSpawns: PieceSpawn[];
}
interface FieldElement {
  id: string;
  collider: ColliderDesc[]; // simple primitives/convex hulls; trimesh only for static
  renderAsset?: AssetId; // visual mesh can be more detailed than the collider
  pose: Pose3d;
}
```

### 3.6 Match and scoring

```ts
type MatchPhase = 'pre' | 'auto' | 'transition' | 'teleop' | 'endgame' | 'post';
interface MatchState {
  phase: MatchPhase;
  phaseTimeRemainingS: number;
  matchTimeS: number;
  score: Record<Alliance, AllianceScore>;
  events: readonly ScoreEvent[];
}
interface GameDefinition {
  id: string;
  displayName: string;
  field: FieldConfig;
  pieces: GamePieceDef[];
  timing: { autoS: number; transitionS: number; teleopS: number; endgameS: number };
  rules: GameRules; // pure functions over events + state
}
interface GameRules {
  onPieceEnteredZone(e: ZoneEntryEvent, ctx: RulesContext): ScoreEvent[];
  onPhaseChange?(from: MatchPhase, to: MatchPhase, ctx: RulesContext): ScoreEvent[];
  evaluateEndgame?(ctx: RulesContext): ScoreEvent[];
  computeBonuses?(ctx: RulesContext): ScoreEvent[]; // ranking points, etc.
}
```

Rules are pure and event-driven, so they can be unit-tested without rendering or physics.

### 3.7 Input

```ts
type ActionId =
  | 'driveX'
  | 'driveY'
  | 'rotate'
  | 'intake'
  | 'score'
  | 'toggleFieldRelative'
  | 'resetGyro'
  | string;
interface InputBinding {
  action: ActionId;
  source: 'keyboard' | 'gamepad';
  code: string;
  axis?: boolean;
  invert?: boolean;
  scale?: number;
}
interface InputFrame {
  axes: Record<ActionId, number>;
  buttons: Record<ActionId, boolean>;
  pressed: Set<ActionId>;
}
interface InputManager extends Disposable {
  sample(playerIndex: number): Readonly<InputFrame>;
}
```

Keyboard events update a key-state set. The gamepad is polled. Both are sampled exactly once per logic tick, so input is frame-rate independent. Deadband, expo curves and slew limits are applied in `shaping.ts`.

### 3.8 Rendering and cameras

```ts
interface CameraMode {
  readonly id: 'driverStation' | 'follow' | 'topDown' | 'orbit' | 'robotPov';
  activate(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, ctx: CameraContext): void;
  update(frameDt: number, ctx: CameraContext): void; // reads interpolated robot pose
  deactivate(): void;
}
```

The renderer owns all GPU resources. Views keep persistent `Object3D`s and only write their transforms in `sync(alpha)`. They never create objects per frame.

### 3.9 Telemetry and UI state

- The sim writes numbers into preallocated ring buffers (`Float32Array`) per channel. This costs nothing when no one is watching.
- `TelemetryBus` publishes a snapshot to the Zustand store at a configurable rate (default 10 Hz). Charts draw to `<canvas>` straight from the ring buffers via their own rAF, without React.
- HUD timer and score: the store is updated only when a displayed value changes (e.g., whole seconds, score events).

### 3.10 Engine public API (what the UI sees)

```ts
interface EngineApi {
  mount(container: HTMLElement): void;
  unmount(): void;
  loadGame(def: GameDefinition): Promise<void>;
  spawnRobot(cfg: RobotConfig, slot: AllianceSlot, controller: RobotController): string;
  match: { start(): void; pause(): void; reset(): void };
  setCameraMode(id: CameraMode['id']): void;
  applySettings(s: Partial<Settings>): void;
  telemetry: TelemetryBus;
  events: EventBus;
  dispose(): void;
}
```

---

## 4. Biggest performance risks and mitigations

| #   | Risk                                                                            | Mitigation                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **React re-rendering per frame** (HUD, telemetry)                               | Sim state lives outside React. UI gets throttled snapshots and change-only updates. Charts draw on canvas. React DevTools profiler check at each stage.                                                                                  |
| 2   | **GC stalls from per-frame allocation** (`new Vector3`, closures, arrays)       | Module-level scratch objects, object pools, out-parameters in math APIs, typed arrays for telemetry. Lint rule or review checklist for `new` inside update functions.                                                                    |
| 3   | **Draw calls** from detailed field and CAD-like robots                          | Merge static field geometry by material. `InstancedMesh` for game pieces. Shared materials. LODs for robots. Target < 300 draw calls.                                                                                                    |
| 4   | **Heavy collision geometry** (trimesh on dynamic bodies, CAD-derived colliders) | Dynamic bodies use primitives or convex hulls only. Static trimesh only where needed. Separate collider and visual meshes. Collision groups to skip irrelevant pairs.                                                                    |
| 5   | **Many active game pieces** (some seasons have dozens)                          | Rapier sleeping, CCD only on fast pieces (shots), pieces held or scored removed from simulation, capped solver iterations.                                                                                                               |
| 6   | **Spiral of death** when a frame is slow                                        | `maxSubSteps` cap, dropping accumulated time beyond the cap, auto-pause on tab hidden (`visibilitychange`).                                                                                                                              |
| 7   | **Shadows and post-processing cost**                                            | Quality presets: shadow map size, one shadow-casting light, static shadows baked or updated rarely, optional post-FX off by default.                                                                                                     |
| 8   | **High-DPI / 4K screens**                                                       | Pixel-ratio cap (default `min(devicePixelRatio, 1.5)`), optional dynamic resolution scaling based on frame time.                                                                                                                         |
| 9   | **Transparent overdraw** (polycarbonate field walls)                            | Few large transparent surfaces, `depthWrite` tuned, option to render walls as opaque frames at Low quality.                                                                                                                              |
| 10  | **Asset size and load time**                                                    | GLB with meshopt/Draco compression, KTX2 textures, lazy loading per season, ref-counted cache.                                                                                                                                           |
| 11  | **GPU/memory leaks** on screen changes and Vite HMR                             | Every system implements `Disposable`. Engine teardown disposes geometries, materials, textures, render targets, Rapier world and listeners. `renderer.info` checks in dev to confirm counts return to baseline.                          |
| 12  | **Main-thread contention** (physics + render + UI)                              | Measure first. If needed (stage 11), move the sim and physics to a Web Worker with transforms shared via `SharedArrayBuffer`. This requires COOP/COEP headers; the architecture keeps this possible because render only reads snapshots. |
| 13  | **WASM init latency** (Rapier)                                                  | Initialize once at app start behind a loading screen, reused across matches.                                                                                                                                                             |

Performance target to confirm: **1080p at a stable 60 fps (ideally 144 fps headroom) on a GTX 1660 / RX 580-class GPU with a 4-core CPU**, at Medium preset, with 6 robots and a full game-piece set.

---

## 5. Staged development plan

Each stage ends with `npm run build`, `npm run lint`, `npm test` passing, and a runnable app.

| Stage                                        | Deliverable                                                                                                                                                                                                                                                                  | Exit criteria                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Setup** ✅                              | Vite + React + TS (strict), ESLint with module-boundary rules, Prettier, Vitest, folder skeleton, `Disposable` contract                                                                                                                                                      | App boots to a menu. Build, lint and tests are green.                                                                                                                 |
| **1. Engine core + rendering foundation** ✅ | `FixedStepper`, `FrameDriver`, `SystemScheduler`, `Engine`; `Renderer` (resize, pixel-ratio cap, render scale, context loss/restore), `SceneManager`, test floor, orbit camera; loading and error screens; app shell with settings panel, status bar and diagnostics overlay | Test body moves on a 200 Hz sim with render interpolation. No leaks across remounts. Only diagnostics DOM updates while running. WebGL failures show specific advice. |
| **2. Physics + generic field**               | Rapier integration, `FieldConfig` → `FieldBuilder`, generic evergreen field (carpet, walls, tags), debug collider view                                                                                                                                                       | Dropped boxes collide with the field. Physics determinism test.                                                                                                       |
| **3. Input**                                 | Keyboard and gamepad sources, binding map, shaping, hot-plug                                                                                                                                                                                                                 | Input test page shows mapped actions. Bindings persist.                                                                                                               |
| **4. Drivetrains**                           | Motor models, swerve (field- and robot-relative, module desaturation, traction limit), tank, mecanum, robot chassis body                                                                                                                                                     | Robot drives with realistic acceleration and wall collisions. Kinematics unit tests. Swerve module telemetry.                                                         |
| **5. Cameras**                               | Driver station (per alliance), follow, top-down orthographic, free orbit, robot POV; smooth transitions                                                                                                                                                                      | Switching cameras via hotkeys/UI. Frame time stays stable.                                                                                                            |
| **6. Game pieces + mechanisms**              | `GamePieceManager` with pools, intake sensors, indexer storage, shooter/elevator/arm/climber models, eject/shoot                                                                                                                                                             | Pick up, carry and launch pieces reliably at all frame rates.                                                                                                         |
| **7. Match + scoring**                       | Match FSM, timing, scoring zones, `GameRules` for the generic game, HUD (timer, score, phase), results screen                                                                                                                                                                | Full match playable end to end. Rules unit tests.                                                                                                                     |
| **8. REBUILT season pack**                   | 2026 `GameDefinition`: field from manual, drawings and AprilTag layout; official CAD where usable; pieces, scoring, timing                                                                                                                                                   | Field elements and tags within tolerance of the published drawings.                                                                                                   |
| **9. Multiple robots + online multiplayer**  | 6-robot spawning, robot-robot interaction, headless server, rooms with join codes, prediction and interpolation (§9)                                                                                                                                                         | Two browsers on different networks join by code and play a match at the target frame rate.                                                                            |
| **10. Robot builder + UI polish**            | Builder (frame, drivetrain, motors, mechanisms, presets, JSON import/export), settings screen, telemetry charts, 2D field view                                                                                                                                               | Custom robot saved, reloaded, driven, and usable online.                                                                                                              |
| **11. Autonomous + AI**                      | `AutoController`, routine runner, path following, simple AI opponents to fill empty slots                                                                                                                                                                                    | Scripted auto scores in the auto phase. AI fills a 3v3 match.                                                                                                         |
| **12. Fouls, ranking points, optimization**  | Remaining rules (fouls, ranking points), profiling pass, dynamic resolution, asset compression, browser testing                                                                                                                                                              | Meets the performance target from §4.                                                                                                                                 |

Stages 2–4 are the riskiest (physics feel), so they come early and get tuned before content is layered on top.

---

## 6. Recommended dependencies

### Runtime

| Package                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react`, `react-dom`        | UI shell (required stack).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `three`                     | All 3D rendering (required stack). `GLTFLoader`, `KTX2Loader` and `OrbitControls` come from `three/examples/jsm`, so no extra packages are needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `@dimforge/rapier3d-compat` | Physics. Fast WASM, actively maintained, deterministic, has sleeping/CCD/sensors/collision groups and a clean TS API. The `-compat` build embeds the WASM, which avoids Vite WASM plugin configuration. **Justification against the cost:** game-piece dynamics (bouncing, rolling, stacking, robot pushing) would take months to write by hand and be less robust. The cost is about 1.5 MB of WASM, an async init, and one module (`physics/`) that wraps it. Alternatives: `cannon-es` (pure JS, slower, little maintenance), `ammo.js` (heavy, awkward API), Jolt WASM (excellent but a larger and more complex API). |
| `zustand`                   | Tiny store that works outside React (vanilla API). Ideal for throttled sim→UI updates with selector-based re-renders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Development

| Package                                                          | Why                                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `vite`, `@vitejs/plugin-react`                                   | Build/dev server (required stack).                                               |
| `typescript`, `@types/react`, `@types/react-dom`, `@types/three` | Type safety; `three` ships without types.                                        |
| `vitest`                                                         | Fast unit tests for kinematics, loop, rules and determinism; shares Vite config. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`       | Linting, including `no-restricted-imports` to enforce module boundaries.         |
| `prettier`                                                       | Consistent formatting.                                                           |

### Deliberately not included (for now)

- **@react-three/fiber / drei**: see §1. React should not own the scene.
- **UI component libraries** (MUI, etc.): large bundles. A small custom component set with CSS modules gives a more distinctive look.
- **Charting libraries**: per-frame telemetry charts on canvas are simple and much cheaper than SVG/DOM charts.
- **`stats.js` / `lil-gui`**: easy to add as dev-only tools later if wanted. A custom perf overlay reads `renderer.info` directly.
- **Possible later additions:** `meshoptimizer`/`gltf-transform` (asset pipeline, dev-only), `zod` (validating imported robot JSON) if the builder needs strict import validation.

---

## 7. Missing information affecting accuracy and rules (answered in §8)

1. **Which game season?** This decides the field geometry, game pieces, scoring and timing. Options: the 2026 game (REBUILT), a previous season, or a generic "evergreen" game now with the 2027 game added after the January kickoff. The plan builds a generic game first either way.
2. **Field dimensions source and tolerance.** I need the season's game manual and official field drawings (or the WPILib AprilTag layout JSON). Do we target the welded or the AndyMark field variant? They have differed by several centimeters in recent seasons.
3. **Field element detail level.** Exact CAD-level geometry or simplified-but-dimensionally-correct shapes? Official CAD may have license restrictions. I propose original simplified models built from published dimensions.
4. **Game-piece physical properties.** The manual gives size and mass. Restitution and friction (foam ball vs. hard plastic) are not published, so I need either measurements or approval to tune them by feel.
5. **Rules scope.** Scoring values, ranking points, penalties/fouls, protected zones, human player actions and endgame rules: which ones are in scope for v1? Fouls require robot-robot contact detection and zone tracking, which adds work.
6. **Match timing.** Confirm per season (typically 15 s auto, a short transition, then about 2:15 teleop, with season-specific endgame or shift timing).
7. **Robot rule limits** for the builder: frame perimeter, maximum height, extension limits, weight. These come from the season manual.
8. **Fidelity target.** Arcade (fun, forgiving) or engineering-realistic (motor current limits, brownouts, battery sag)? This affects motor model depth and tuning time. My default: realistic motion, without electrical simulation in v1.
9. **Multiplayer.** Only local (multiple gamepads, AI robots), or networked later? Networked play would require strict determinism or server authority to be planned from the start.
10. **Branding and licensing.** Use of FIRST names, logos and game artwork may need permission. I'll use original assets and neutral naming unless told otherwise.
11. **Target hardware and browsers.** Confirm the "mid-range" spec in §4 and whether Safari and Firefox are required (gamepad API and WebGL quirks), or Chromium-first.
12. **Deployment.** Static hosting target (GitHub Pages, Netlify, ...)? This affects base paths and whether COOP/COEP headers (needed for worker physics) are possible.
13. **Supported controllers.** Xbox/PlayStation gamepads only, or also flight sticks (common in FRC driver stations)?

---

## 8. Decisions (approved 2026-10-20)

| Question                 | Decision                                                                       | Consequence                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Season                   | **2026 REBUILT**                                                               | Stage 8 builds the REBUILT `GameDefinition`. A generic test game stays for unit tests and as a fallback.                                                       |
| Field sources            | Game manual, field drawings, AprilTag layout                                   | `FieldConfig` values cite their source (manual section or drawing sheet) in comments.                                                                          |
| Field detail             | Simplified original models are fine; **official CAD is acceptable**            | Use official CAD for visuals where its license permits redistribution in a public web app (check before publishing). Colliders stay simplified in every case.  |
| Game-piece physics       | Tune restitution and friction by feel                                          | Values live in the season's `pieces.ts` with a note that they were tuned, not measured.                                                                        |
| Fouls and ranking points | In scope, **not urgent**                                                       | Moved to stage 12. The rules interface already supports them.                                                                                                  |
| Realism                  | **Between game-like and engineering-level**                                    | Real motor curves, gearing, traction limits and mass and inertia. No battery or brownout simulation in v1. Optional driver assists (for example heading hold). |
| Multiplayer              | **Join with a code, from anywhere**                                            | Requires a hosted server. See §9. This affects design from stage 1: the sim must run headless, be driven only by per-tick commands, and be serializable.       |
| Hardware                 | 1080p 60 fps on GTX 1660-class, Chromium-first, must still run well below that | The Low preset must hold 60 fps on integrated graphics at 1080p with 6 robots.                                                                                 |
| Controllers              | Keyboard and gamepads                                                          | No flight-stick-specific bindings. Any device exposed through the Gamepad API still works through generic bindings.                                            |

---

## 9. Online multiplayer design

### Topology: authoritative server

```
 browser A ──┐                         ┌── browser C
             │  WebSocket (binary)     │
 browser B ──┼──►  Match server  ◄─────┼── browser D
             │   (Node, headless sim)  │
             └── room "K7QX-2M"  ──────┘
```

- **Chosen: a dedicated authoritative server.** One Node process hosts many rooms. Each room runs the **same TypeScript simulation** (core, physics, robot, game and field modules, with Rapier running in Node) at the same fixed tick, with no renderer.
- **Rejected: peer-to-peer with one browser as host.** WebRTC fails behind some school and corporate NATs without paid TURN relays, gives the host zero latency (unfair), lets the host cheat, and ends the match if the host's tab closes.
- **Rejected: lockstep or rollback.** Rapier is deterministic only on identical builds and inputs, and 6 players with game pieces make rollback re-simulation expensive. Server authority avoids depending on cross-machine determinism.

### Join codes and rooms

- A host creates a room and the server returns a short code (for example `K7QX-2M`, using an alphabet without ambiguous characters).
- Others join with that code. The server assigns alliance slots, and the host can rearrange them before the match.
- Rooms expire when empty. Codes are not guessable at scale (≈ 31⁶ ≈ 900 million) and are rate-limited per IP.

### Per-tick data flow

1. Each client samples input at the logic rate (50 Hz) and sends a `RobotCommand` tagged with its tick number. This is the same `RobotCommand` type the local game uses, so controllers are unchanged.
2. The server applies each player's latest command to their robot, steps physics at 200 Hz, and runs the rules.
3. The server broadcasts compact binary snapshots at 30 Hz (robot poses and velocities, mechanism states, moving pieces, score and clock), with quantized values and delta compression against acknowledged snapshots.
4. **Own robot:** client-side prediction of the drivetrain, using its own command history. When a snapshot arrives the client reconciles: it snaps if the error is large and smoothly blends small errors.
5. **Everything else:** rendered about 100 ms in the past by interpolating between snapshots (`SnapshotBuffer`).
6. Scoring, match clock and piece possession are **server-only truths**. Clients never decide a score.

### What this means for code written now

- Sim modules have no DOM, React or Three dependencies. This is enforced by lint (§2), so they import cleanly into `server/`.
- `FixedStepper` takes elapsed time from the caller, and `FrameDriver` is an interface, so the server drives the same loop with a timer.
- All randomness goes through the seeded `Rng`, whose state is serializable.
- Robots are driven only through `RobotController` → `RobotCommand`. A `NetworkController` is just another implementation.
- Sim state is plain data that can be serialized into snapshots.

### Hosting (decision needed before stage 9)

The server needs an always-on host with WebSocket support. Options, roughly cheapest to most managed:

| Option                                | Notes                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Fly.io / Railway / Render (container) | Simple Node deploy, regions near players, about $5–20/month at small scale. **Recommended.** |
| A VPS (Hetzner, DigitalOcean)         | Cheapest per CPU, but you manage it yourself.                                                |
| Cloudflare Durable Objects            | Good room model and global edge, but CPU-time limits make a 200 Hz physics loop a poor fit.  |

The static web client can be hosted separately (GitHub Pages, Netlify or Cloudflare Pages) and connect to the server's `wss://` URL.
