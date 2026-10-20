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

Stages 0–2 are in place: the fixed-timestep engine, the rendering foundation and a complete
2026 REBUILT field (welded and AndyMark variants) built from the official AprilTag layout and
published dimensions. See [docs/FIELD_REBUILT.md](docs/FIELD_REBUILT.md) for sources, scale and
validation. Physics, robots and game rules come next.

| Control                    | Action                                                          |
| -------------------------- | --------------------------------------------------------------- |
| `1` / `2` / `3` / `4`      | Orbit, overhead, blue driver station, red driver station        |
| Drag / right-drag / scroll | Orbit / pan / zoom (orbit view); pan / zoom (overhead)          |
| `P`                        | Pause or resume                                                 |
| `` ` ``                    | Toggle the diagnostics overlay (on by default in `npm run dev`) |
| Reset field                | Return all 504 FUEL to their starting positions                 |
