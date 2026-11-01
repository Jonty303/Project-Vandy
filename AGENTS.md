# Project Vandy — Engineering Agent Instructions

## Scope and authority
- `DESIGN.md` is the long-term product/architecture source of truth.
- `docs/ITERATION_03.md` is the **authoritative contract for Iteration 03**. Preserve the Iteration 01 and 02 design and validated calculations. Do not expand into physical wiring or compliance checking.
- Work in a feature branch; do not modify or merge `main` without an explicit request.
- All initial demo equipment and loads are based on Vandy V1. Do not silently promote estimates, owner-reported components or online product matches to manufacturer-verified specifications.

## Engineering integrity
- Calculations must be pure, deterministic TypeScript functions in `src/domain/`. No AI-generated numerical answers in the calculation path.
- Voltages belong to circuits and components. The project battery voltage is only a reference; 12V circuits in 24V projects must require an explicitly verified converter before accounting for their battery-side energy.
- Track AC inverter efficiency as an explicit assumption. A shore-fed load must not count against the habitation battery.
- Unknown inputs stay `null`, not zero. Exclude unverified contribution and flag totals as partial.
- Keep individual consumers separate from shared fused circuits, control components, and abstract source assignments. No automatic conclusions about wiring, protective devices or compliance.
- Do not infer fuses, conductor gauge, protective-earth topology or safety certifications.
- In Iteration 02, component ports contain **logical conductor groups** only. A link is proposed/reported/verified *as user evidence*, never a verified L/N/PE cable connection or certified bond.
- Keep distinct consumer units, protectors, socket positions and electrical loads; socket assignments must not double count energy.
- Preserve previously saved v1 projects when migrating to the v2 schema, including user-edited appliance information.
- Distinguish manufacturer-sourced, owner-reported, measured, online listings, estimates and unknown evidence.
- Safety hazards include electrical fire/shock, LPG, combustion exhaust, carbon monoxide and water leaks. Inclusion of a CO detector does not certify an installation.

## Development rules
- Stack: TypeScript + React + Vite, no server, local browser storage and JSON export/import.
- Test electrical behaviour with Node's built-in test runner. Every calculation change should include boundary tests and documented assumptions.
- Run `npm run check` with dependencies installed; `npm test` and `tsc -p tsconfig.domain.json` can run independently on Node 22.
- Keep JSX/UI separate from domain models and calculations. Future schematic and 3D features must reuse this engine and stable IDs.
- Do not add telemetry, external accounts, remote AI, paid dependencies or publication/hosting without specific approval.
- Build user-facing warnings that clearly distinguish planning output from installation verification.

## In-iteration source and autonomy rules
- For inverter-backed AC circuits, trace upstream through saved compatible AC port-group links. Distinguish shore power feeding the MultiPlus from a genuinely shore-only downstream circuit. An unresolved logical path must produce a warning.
- The 12/12-50 DC-DC rating does **not** imply 50A available alternator input or 24V output. Alternator usable current is independently limited by estimated spare source current and input/output settings.
- Monthly PVGIS results are historical typical yields, not forecasts; only server-side PVGIS requests are allowed. The Vite middleware is *development-only*. Preserve explicit source, location, date, loss assumptions and invalidation on configuration change.
- Do not claim unlimited off-grid runtime for energy-positive averages or a reliable autonomy rating while material loads are unknown.

## Iteration 03 battery and UX rules
- Save a valid user record even with unknown/null specification fields; only block updates for structural invalidity or impossible values and explain field dependencies. All editable sections need Reset and Update (staged changes, clear confirmation and navigation protection).
- Independent individual battery records and series/parallel bank membership are the source of truth. Do not silently substitute legacy project-level Ah into an active bank.
- Self-heating, low-temperature cut-off and manufacturer BMS protection are distinct facts; unknown does not mean false.
- Bluetooth batteries default to vendor-app-only. Manufacturer-documented protocol support is necessary before suggesting GX management, and documented CAN bus does not imply DVCC support.
- Treat communication ports as capacity-constrained single slots and SmartShunt AUX as one selectable use. Propose documented cables where suitable, but no unverified connection is marked installed.
- Distinguish DC/AC power topology, communications topology and cosmetic 2D layout. No direct device control or invented wire runs.

## Device editor / protective-earth design requirement (2026-11-01)
- Treat the latest `docs/ITERATION_03.md` connection-editor and PE busbar refinement as planned requirements, not existing capabilities.
- Device-side Add/Change/Disconnect must update the same typed graph rendered by 2D; later diagram handle dragging edits that graph too. Node dragging alone never changes connections.
- Model PE, DC- and CHASSIS separately; never create automatic bonding or equate AC earth with a battery negative return. Never seed confirmed chassis/shore/inverter earth links without user evidence.
- UI should show Current and Recommended settings where applicable, not confidence classifications. Preserve internal traceability and never relabel proposals or unknown values as observed installed values.
