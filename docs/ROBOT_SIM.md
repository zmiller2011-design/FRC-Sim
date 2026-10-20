# Robot simulation and swerve drivetrain

## Layers

| Module                          | Responsibility                                                                             | Depends on                 |
| ------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `src/physics/planar`            | 2D rigid body, SAT box contacts with two-point manifolds, bounds containment, ramp terrain | core                       |
| `src/robot`                     | Typed robot config, motor models, swerve kinematics, module and drivetrain models, `Robot` | core, physics, field types |
| `src/field/planarCollision.ts`  | Projects `FieldConfig` colliders onto the carpet for a robot's height range                | physics types              |
| `src/input`                     | Keyboard and gamepad → `DriverAxes`, sampled once per control tick                         | core                       |
| `src/render/robot/RobotView.ts` | Visual robot; reads interpolated snapshots only                                            | core, robot types          |
| `src/engine/RobotRuntime.ts`    | Wires input → controller → robot → view; telemetry                                         | all of the above           |

None of the simulation modules import Three.js or React (enforced by lint), so the same code can run headless in tests or on a future multiplayer server.

## Timing

- **Physics: 120 Hz** fixed step. **Control (input sampling and drivetrain commands): 60 Hz**, every second physics step.
- Real frame time only decides how many fixed steps to run (`FixedStepper`).
  - Frame deltas are clamped to 0.25 s.
  - A single frame runs at most 12 steps (100 ms of simulated time); anything beyond that is dropped and shown in the diagnostics overlay as "Sim behind".
- Rendering interpolates between the last two physics snapshots (`Robot.previous` / `Robot.current`). This covers pose, terrain tilt, steering angles and wheel rotation. The physics itself never changes for the sake of rendering.
- A test shows states are **bit-identical** at 30, 60, 144 and 240 fps, and with random frame jitter.

## Why a custom planar solver (not Rapier, yet)

A swerve drivetrain on a flat field is a planar problem. The planar solver is:

- deterministic;
- allocation-free per step;
- free of a WASM dependency.

It handles:

- wheel traction;
- side friction;
- inertia;
- robot-versus-obstacle collisions;
- BUMP ramps.

Rapier remains the plan for 3D FUEL physics, where bouncing and stacking matter. The robot's collision footprint and the field obstacles stay behind their own interfaces, so they can be moved onto it later.

## Robot model (`DEFAULT_ROBOT`)

| Parameter                 | Value                                                 | Notes                                                                       |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Frame / bumpers           | 27 × 27 in, 3 in bumpers (33 × 33 in outside)         | `chassis.frameLengthM`, `bumperThicknessM`                                  |
| Mass                      | 125 lb (56.7 kg)                                      | with battery and bumpers                                                    |
| Centre of mass            | frame centre (configurable)                           | shifts static wheel loads and the rotation centre                           |
| Yaw inertia               | 6.64 kg·m²                                            | uniform plate over the bumper footprint unless set                          |
| Height / ground clearance | 20 in / 1.5 in                                        | decides what it can drive under (TRENCH 22.25 in) and over (DEPOT barriers) |
| Modules                   | 4 at ±10.875 in                                       | `modules[].position`                                                        |
| Wheel                     | 4 in, μ = 1.1                                         |                                                                             |
| Drive motor               | Kraken X60, 6.75:1, 95% efficient, 70 A stator limit  | ≈ 4.7 m/s free speed                                                        |
| Drive control             | velocity feedforward + P (8 V per m/s)                |                                                                             |
| Steering                  | ≤ 18 rad/s, ≤ 260 rad/s², P = 30 /s, trapezoidal stop |                                                                             |
| Limits                    | 4.5 m/s, 3π rad/s; command slew 9 m/s², 16π rad/s²    |                                                                             |
| Neutral mode              | brake or coast (setting)                              | X-lock always brakes                                                        |

Motor constants come from vendor specs: free speed, stall torque, stall current and free current (`src/robot/config/motors.ts`). Falcon 500, NEO and NEO Vortex are included too.

## How a command becomes motion

1. **Controller (60 Hz).**
   - Driver axes become a command, either field-relative (from the driver's wall) or robot-relative.
   - The command is clamped to the speed limits and slew-limited in the field frame, so the robot can't jump to full speed or rotation instantly.
   - The command is converted to the robot frame, and inverse kinematics produces module speeds and angles.
   - Wheel speeds are desaturated, and each module is optimised to turn at most 90° (driving reversed instead).
   - Steering feedforward is computed analytically: while the robot spins, a field-fixed translation keeps rotating in the robot frame.
   - With no input, the motors go to neutral (brake or coast) instead of servoing to zero.
2. **Module (120 Hz).**
   - The steering axis follows its target with rate and acceleration limits.
   - The drive motor is a DC motor: I = (V − ω/kV)/R, clamped to the current limit.
   - The motor's force is traction-limited, with rolling resistance and viscous drag.
   - Drive output fades in over the last 20° of steering error, so the robot never lurches diagonally while its wheels turn.
3. **Chassis (120 Hz).**
   - Drive forces act along each wheel, evaluated at the step's midpoint heading and steering angle.
   - Sequential impulses cancel sideways sliding at each contact patch, within the traction left over from the drive force (friction circle). Over-demanding a wheel therefore makes the robot skid instead of breaking physics.
   - On BUMPS, gravity acts along the slope.
   - Integrate, then resolve collisions.
4. **Collisions.**
   - The carpet rectangle (walls and guardrails) is enforced exactly, so nothing tunnels through thin walls.
   - Field obstacles block only if their height range overlaps the robot's.
   - Contacts use a two-point manifold: a square push into a wall is resolved spin-free, and a crooked push squares the robot up.

## Controls

| Input      | Action                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| W/S or ↑/↓ | forward / back (from the driver's view when field-relative)                                                       |
| A/D or ←/→ | left / right                                                                                                      |
| Q / E      | rotate CCW / CW                                                                                                   |
| Shift      | precision (35%)                                                                                                   |
| Space      | X-lock                                                                                                            |
| F          | toggle field-relative / robot-relative                                                                            |
| R          | reset robot                                                                                                       |
| T          | toggle telemetry panel                                                                                            |
| 1–5        | orbit, overhead, blue DS, red DS, follow camera                                                                   |
| Gamepad    | left stick translate, right stick X rotate, LB precision, X button X-lock (radial deadband 0.1, squared response) |

## Developer telemetry (T)

The panel shows:

- speed, plus field- and robot-relative velocity;
- acceleration and angular acceleration (smoothed);
- heading and angular velocity, and pose;
- the physics timestep and control rate.

It also shows:

- **Per-module data:** measured and target steering angle, wheel speed and drive current, with slipping wheels highlighted.
- **Module diagram:** a live sketch of wheel directions and speeds.
- **Chips:** for driving mode, neutral mode, X-lock, neutral and wall contact.

## Tests (`tests/robot`, `tests/physics`)

| Requirement      | Test                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Forward        | reaches 3 m/s straight, heading drift < 0.002 rad                                                                                                |
| 2 Reverse        | same, backwards                                                                                                                                  |
| 3 Strafe         | sideways at 2 m/s, x drift < 1 cm, wheels at 90°                                                                                                 |
| 4 Rotation       | 2 rad/s in place, translation drift < 2 cm                                                                                                       |
| 5 Combined       | field-relative line while spinning, lateral drift < 15 cm over 8 m                                                                               |
| 6 Accel / brake  | not instant, 90% of 4 m/s in 0.35–1 s, peak < 1.1 g; brake stops < 1.2 m from 3 m/s, coast ≥ 2× further; X-lock resists a shove                  |
| 7 Field vs robot | same command, different frames at 90° heading                                                                                                    |
| 8 Collisions     | wall, guardrail, HUB; under the TRENCH at 20 in but blocked at 30 in; stays square against a wall; squares up after a crooked hit; climbs a BUMP |
| 9 Frame rate     | bit-identical at 30/60/144/240 fps and jitter; catch-up capped at 12 steps                                                                       |

There are also unit tests for kinematics, discretisation, motor equations, SAT, terrain, and the wheel and interpolation snapshot data.

## Known limitations

- **FUEL** is not simulated yet; the robot passes through it.
- **Weight transfer:** wheel loads use the static centre-of-mass distribution, with no dynamic weight transfer during acceleration.
- **Wheel rolling:** wheels are assumed to roll without slipping. When traction-limited, the force is capped, but the wheel's visual spin follows ground speed.
- **BUMP height:** BUMPS affect gravity and the visual height, pitch and roll, but not the robot's collision height or normal loads.
- **Battery:** no battery voltage sag or brownout (by design for v1).
- **Robot collisions:** robot-vs-robot collision is not wired up. The same box-vs-box contact code will handle it when multiple robots arrive.
