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

Stages 0 and 1 are in place: the fixed-timestep engine loop, renderer, orbit camera,
quality settings and performance overlay. The sandbox shows a placeholder field with a
test body driven by the 200 Hz simulation. Robots, physics and game rules come next.

Controls in the sandbox: drag to orbit, right-drag to pan, scroll to zoom, `P` to pause.
