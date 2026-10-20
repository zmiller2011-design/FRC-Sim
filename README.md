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

Stages 0 and 1 are in place: the fixed-timestep engine loop and the rendering foundation
(renderer, scene manager, camera, graphics settings, loading and error screens, diagnostics).
The sandbox shows a measuring floor and a test body driven by the 200 Hz simulation.
Physics, robots and game rules come next.

| Control                    | Action                                                          |
| -------------------------- | --------------------------------------------------------------- |
| Drag / right-drag / scroll | Orbit / pan / zoom                                              |
| `P`                        | Pause or resume                                                 |
| `` ` ``                    | Toggle the diagnostics overlay (on by default in `npm run dev`) |
