# Iteration 01 — Vandy Electrical Load Calculator

## Objective
Build a usable local-first TypeScript + React application for Vandy V1's 12V reference inventory, with **12V and 24V capable domain models from day one**. Do not introduce automatic equipment recommendation or physical wiring validation.

## Required functionality
1. Seed an editable Vandy project including the known WattCycle/Victron/Blue Sea/remote box/switches/USB equipment inventory and the CR65X, diesel heater and LPG heater specifications supplied by the owner.
2. Create, rename and (when empty) remove **named circuits**. Create, edit and remove **named consumers**, assign several to a circuit and optionally link a consumer to an equipment item.
3. Optional circuit-to-component/output logical assignment for the Blue Sea 12-output block and generic six-channel controller. Label as unverified; never generate real wiring in this iteration.
4. Each consumer has one or more operating modes with wattage or `null`, source evidence, run minutes and duty factor for at least Normal, Working and Winter profiles.
5. LED strips accept named load, length in metres, watts/metre and typical brightness; calculate full rated W separately from estimated Wh.
6. Calculate individual/circuit/project Wh, battery-side Wh, equivalent Ah at nominal battery V and worst-case **known connected W**, with explicit partial-data warnings. Correctly treat 230V inverter losses, shore-only loads and unconverted DC-voltage mismatch.
7. Support editing 12V/24V project reference voltage without rewriting individual circuits. Never infer voltage-converter capability.
8. Local auto-save with failure indication, schema-versioned JSON import/export, and demo reset with confirmation. Data never leaves the browser except at explicit export.
9. Equipment safety metadata and prominent non-certification / CO / LPG / combustion / electrical warnings; no actual safety validation in this iteration.
10. Automated tests for compressor duty cycle, LED calculations, AC losses, voltage mismatch, unknown power, invalid usage and JSON validation.

## Explicit out of scope
AI services, standards retrieval, diagram editor, precise wiring topologies, conductor sizing, protective-device selection, battery autonomy promises, component purchase catalogue, solar forecasting, water and gas networks, 3D model, cloud accounts, subscriptions and real-time telemetry.

## Acceptance criteria
- `npm test` passes and the domain TypeScript check passes.
- With 60W for 24h and 35% compressor duty, CR65X shows approximately **504Wh/day**.
- With 2.5m of a 9.6W/m strip at 50% brightness and 5h, LED energy is **60Wh**, but rated full power remains **24W**.
- One circuit holds toilet light and toilet flush separately, with their own runtimes and ratings.
- 24V project setting does not silently convert the existing 12V circuits; their battery-side estimates are excluded and marked incomplete until converter modelling exists.
- User can change names, add a load, edit its modes and usage by profile, change logical distribution output, export JSON, reimport it and retain the same structure.
- Unknown ratings are not displayed as verified zero and projected totals carry a partial warning.
- No project data is pushed to a server; no installable desktop build is required.

## Delivery and validation
Implement on `iteration-01`, do not merge to `main`. Include tests and workflow. Report verified runs and any constraints (including unavailable package-registry access) explicitly. Once this iteration is accepted, design the physical connector/netlist schema separately before building an electrical drawing surface.
