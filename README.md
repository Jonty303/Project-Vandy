# Project Vandy — Power Studio

An early-stage, local-first campervan electrical-load calculator built around **named circuits, named consumers and explicit assumptions**. The first demonstration models Vandy's existing 12V equipment; the domain model can represent 12V and 24V projects without pretending a voltage converter exists.

## Quick start

Requires Node.js **22.16+** and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. For production static assets, run `npm run build` and deploy `dist/`. Vite is configured with a relative base for subpath hosting. GitHub Pages deployment is **not** enabled automatically.

## Validation

```bash
npm test
npm run typecheck
npm run build
```

`npm test` uses Node's built-in runner with TypeScript type stripping. Domain-only checks work with an existing global TypeScript install via `tsc -p tsconfig.domain.json` even before npm dependencies are installed.

## What it can do
- Keep consumers separate from their shared named electrical circuits (including toilet light and flush).
- Estimate energy by normal, working-from-van and winter profiles; model compressors, LED strip length/brightness and multi-mode heaters.
- Show battery-side Wh and approximate Ah while marking partial estimates and uncompensated voltage mismatches.
- Assign circuit labels to Blue Sea fuse outputs or 6-way remote controller channels for future diagrams (**not verified wiring**).
- Edit data locally and import/export versioned JSON. No backend or external AI service.

## Important limitation
**This is planning software only.** It does not calculate conductor size, overcurrent protection, earthing/bonding, approved wiring, usable battery runtime or compliance with installation standards. CO detection, ventilation, combustion exhaust and LPG hazards must be assessed separately by competent installers. Component ratings and sample duty cycles may be owner-reported or provisional.

See [DESIGN.md](DESIGN.md), [AGENTS.md](AGENTS.md), and the authoritative [Iteration 01 contract](docs/ITERATION_01.md).
