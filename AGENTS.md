# Project Vandy — Engineering Agent Instructions


## Active feature branch — electrical planning including logical Distribution (2026-11-02)
On `feature/load-calculator`, `docs/LOAD_CALCULATOR.md` and `docs/DISTRIBUTION_NEXT.md` are the active implementation contracts and supersedes earlier iteration scopes for UI work. Only Home, Load Calculator, Battery Selection, Charging, Off-grid rating and Distribution belong in navigation. Use **one typical-day average** for each appliance with editable power, hours, quantity and LED length, and disclose the source or estimate behind defaults. Leave seasonal profiles, startup/shutdown electrical transients, individual terminals and physical wire-level screens out of this UI. Distribution uses logical source/consumer associations, numbered fused-branch occupancy only, and busbar terminal-capacity estimates; it must not infer fuses, cables or grounding. Off-grid rating adds only PVGIS historical monthly yield and average-energy autonomy; not a site-specific weather prediction. Battery Selection is a planned EU WattCycle choice with a search/filter picker and no-charge endurance. Charging is a three-tab planned-device selection for DC–DC, generic solar panel + MPPT, and 230 V shore chargers/inverter-chargers; no installation facts or physical connections inferred. Store **Physical on/off switch** on a named circuit, but **do not expose or store any controller assignment** in the calculator. Later wiring stages will decide direct switch versus remote control. Keep a permanent implicit Ungrouped loads container (even empty), without voltage or switch; display Loads/Circuits tabs with a top table and bottom selected-item editor. Entire table rows must select, and load rows must be draggable into other named circuit groups or Ungrouped without changing load voltage. Mismatches are centrally validated, shown in every relevant view and permitted on save. Preserve a non-drag assignment path. Add load exposes one reusable generic LED lights template (length and watts per metre editable); don't create multiple purpose-labelled LED presets. Preserve v1–v6 project data during v7 migration, retaining batteries, charging and off-grid data and initialising distribution empty. Do not silently assign a battery. Stay on this feature branch until explicitly directed otherwise; do not merge.

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
- Preserve user-edited appliance information and prior version backups on schema migrations. Historical v1→v2 logic remains supported; the focused planning branch uses v6.
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


## Distribution v8 shared-fuse-position rule
Lynx has exactly **four shared positive fused branch positions**, regardless of power flow direction. Its consumers/distribution feeder links (\`dcAssignments\`) and charging output links (\`chargerAssignments\`) compete for those same four numbered positions. Every newly selected charger-to-Lynx link receives one free slot; duplicate positions are structural invalidity. Saved v7 charging destinations without slot identities must migrate by preserving existing assigned positions and filling the remainder in original order; any legacy overbook remains visible with \`slot:null\` and a review warning, never silently dropped. The fuse values, negative return connections and actual wiring remain unmodelled. Keep all versions of browser storage for backwards compatibility.
