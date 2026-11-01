# Project Vandy — Engineering Agent Instructions

## Scope and authority
- `DESIGN.md` is the long-term product/architecture source of truth.
- `docs/ITERATION_01.md` is the **authoritative contract for Iteration 01**. Deliver only its acceptance criteria. Later milestones are explicitly out of scope.
- Work in a feature branch; do not modify or merge `main` without an explicit request.
- All initial demo equipment and loads are based on Vandy V1. Do not silently promote estimates, owner-reported components or online product matches to manufacturer-verified specifications.

## Engineering integrity
- Calculations must be pure, deterministic TypeScript functions in `src/domain/`. No AI-generated numerical answers in the calculation path.
- Voltages belong to circuits and components. The project battery voltage is only a reference; 12V circuits in 24V projects must require an explicitly verified converter before accounting for their battery-side energy.
- Track AC inverter efficiency as an explicit assumption. A shore-fed load must not count against the habitation battery.
- Unknown inputs stay `null`, not zero. Exclude unverified contribution and flag totals as partial.
- Keep individual consumers separate from shared fused circuits, control components, and abstract source assignments. No automatic conclusions about wiring, protective devices or compliance.
- Do not infer fuses, conductor gauge, protective-earth topology or safety certifications.
- Distinguish manufacturer-sourced, owner-reported, measured, online listings, estimates and unknown evidence.
- Safety hazards include electrical fire/shock, LPG, combustion exhaust, carbon monoxide and water leaks. Inclusion of a CO detector does not certify an installation.

## Development rules
- Stack: TypeScript + React + Vite, no server, local browser storage and JSON export/import.
- Test electrical behaviour with Node's built-in test runner. Every calculation change should include boundary tests and documented assumptions.
- Run `npm run check` with dependencies installed; `npm test` and `tsc -p tsconfig.domain.json` can run independently on Node 22.
- Keep JSX/UI separate from domain models and calculations. Future schematic and 3D features must reuse this engine and stable IDs.
- Do not add telemetry, external accounts, remote AI, paid dependencies or publication/hosting without specific approval.
- Build user-facing warnings that clearly distinguish planning output from installation verification.
