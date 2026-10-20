# FRC Sim

A browser-based, real-time 3D simulator for the FIRST Robotics Competition 2026 game, REBUILT.
Built with Vite, React, TypeScript and Three.js.

Design, module boundaries and the staged roadmap are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

Requires Node 22 or newer.

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm run check      # typecheck + lint + unit tests
npm run build      # production build into dist/
```

## Current state

Stages 0–3 are in place: the fixed-timestep engine, the rendering foundation, a complete 2026
REBUILT field ([docs/FIELD_REBUILT.md](docs/FIELD_REBUILT.md)) and a drivable swerve robot with
motor, traction and collision physics ([docs/ROBOT_SIM.md](docs/ROBOT_SIM.md)). Game pieces and
scoring come next.

| Control           | Action                                                       |
| ----------------- | ------------------------------------------------------------ |
| W/A/S/D or arrows | Drive (field-relative from the blue wall by default)         |
| Q / E             | Rotate                                                       |
| Shift / Space     | Precision mode / X-lock                                      |
| F / R / T         | Field↔robot-relative / reset robot / telemetry panel         |
| 1–5               | Orbit, overhead, blue DS, red DS, follow camera              |
| Gamepad           | Left stick drive, right stick rotate, LB precision, X X-lock |
| `P` / `` ` ``     | Pause / diagnostics overlay                                  |
