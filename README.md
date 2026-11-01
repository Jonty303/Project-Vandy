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


## Iteration 02 — review branch

The `iteration-02` branch adds the logical topology view, two separate 230V consumer units, outlet assignments and protection-device metadata. It is *not* a physical wiring design or an electrical safety compliance assessment.

Open the app on `iteration-02` with `npm install` and `npm run dev`, then choose **System topology** in the sidebar. The local browser project migrates from v1; export a backup if you have edited loads before testing a reset.

The old `iteration-01` branch remains available. Iteration 02 is prepared as a draft pull request against `iteration-01` and has not been merged.

## Charging & autonomy refinement
On `iteration-02`, choose **Off-grid autonomy** for battery reserve, average driving hours/spare alternator current, Orion XS limits, PVGIS monthly solar reference and selected location estimates. PVGIS calls are proxied through the Vite development server: start with `npm run dev` in Codespaces. A **static Vite build alone does not serve `/api/solar-monthly`**; production needs a server endpoint. When unavailable, a manual daily PV energy estimate can be entered and is explicitly marked as user-sourced.

The calculator displays stationary and daily-driving energy balances. Solar must be fetched or supplied manually; unknown consumer watts remain flagged. The EU PVGIS source provides historical averages, not a live weather forecast, and the UK composite is an illustrative five-city unweighted mean.

In the **Circuits & loads** editor, choose the consumer input supply and inspect its derived upstream logical AC source. On the **Project settings** page, select the inverter or shore pass-through operating scenario. Off-grid autonomy always calculates as the inverter scenario.

## Iteration 03 — Batteries, BMS, connectivity and 2D overview
The `iteration-03` branch adds dedicated **Batteries & BMS**, **Connectivity**, and **2D system overview** navigation. Use the new **Update** and **Reset** bar to commit/discard edits; previous values are retained until Update. Leaving a page with unsaved changes prompts before discarding them.

Batteries can be recorded individually, including unknown manufacturer specifications, BMS Bluetooth/protocol abilities, low-temperature protection and self-heating. Parallel strings and series members make up the active battery bank. The off-grid planner uses the active bank's derived capacity and flags missing battery ratings or voltage mismatch rather than guessing.

Connectivity shows documented Victron GX recommendations for SmartShunt, SmartSolar MPPT, Orion XS and MultiPlus. Recommendations are *not automatically connected*; users may propose a cable and explicitly record installed evidence. SmartShunt AUX offers starter voltage **or** temperature **or** midpoint. Bluetooth-only batteries remain vendor-app-only unless manufacturer documentation proves otherwise.

The 2D view supports AC/DC/communications layers, component inspection, drag-to-arrange and pan/zoom. **Drawing lines are logical relationships or claimed data links, not certified wire routes.**

### Codespaces
```bash
git fetch origin
git switch --track origin/iteration-03
npm install
npm run dev
```
If the local branch is already checked out, use `git pull --ff-only`. Open forwarded port 5173. Browser-local v2 projects migrate to v3; JSON import/export remains supported. CI runs `npm run check` on `iteration-03`.

Manufacturer documentation links and the bounded acceptance criteria are in `docs/ITERATION_03.md`.

### Portable USB-C charging
The **Phones & tablets** section has two iPhones and one iPad in the Vandy test data. Specify the number of 80%-battery-capacity charges each device receives during Normal, Working or Winter days. Switch profiles directly from the page. Each device's battery Wh and estimated USB-C charging efficiency are editable; these represent energy usage, **not charger wattage**.

For the illustrative modern devices, one 0–80% recharge per device per day adds about **56Wh/day** to the 12V USB charging circuit. The two iPhone capacities (15.5Wh each) and 85% efficiency are assumptions; the example 11-inch iPad 28.93Wh capacity is published by Apple. These charge events are included automatically in the project loads and autonomy calculation. Do not add the same power again via a generic USB charger load.
