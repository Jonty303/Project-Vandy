# Iteration 02 — Distribution & Logical Topology

## Goal
Extend Iteration 01 without changing its engineering calculations. Represent Vandy's two distinct 230V consumer units, AC sockets, protected circuits, component terminal groups and *logical* supply relationships, and generate a read-only topology view from those relationships. **This is not a wiring or compliance drawing.**

## Vandy reference facts and limits
- Existing installation includes a 16A shore inlet; one **shore-power protection consumer unit** and a separate **socket-distribution consumer unit**; Victron MultiPlus 12/500/20; a kitchen double socket and a garage single socket. The gas-hob electric igniter plugs into the kitchen socket.
- Precise connection order, RCD/MCB/RCBO ratings and allocation, polarity, PE/bonding, neutral-earth arrangements, cable sizes and actual circuit allocations remain **unverified**. Proposed block-level links are labelled `proposed`.
- 230V AC loads include Starlink and **one shared 80W laptop adapter** (rated capacity, not a continuous draw). Preserve an unknown real Starlink draw. Additional named 12V lights: kitchen, main, outside, garage. Roof fan: Maxxair/Airxcel family, exact model unknown.
- Preserve the separate 12V toilet light and flush as shared consumers on the named Toilet circuit; preserve distinct Blue Sea 5026 and generic six-channel remote controller.

## Deliverables
1. **Versioned model v2** with component electrical ports/terminal groups, typed conductors (AC L/N/PE vs DC positive/negative/chassis), named logical port-to-port links, protection devices, outlet positions and optional plug-in assignments. No silent equivalence of PE, chassis or DC negative.
2. Components may have input/output ports, ratings and evidence status. Links are `proposed`, `reported` or `verified`; a logical link is not an actual cable or individual conductor.
3. CU-01 and CU-02 are **separate** component entities. Each hosts editable protective devices (RCD, MCB, RCBO, isolator, unknown), nullable ratings and optional downstream circuit assignments. Unknown is allowed, no invented rating.
4. Model socket accessories separately from their consumers; kitchen has two positions and garage has one. Allow each position to be assigned to an AC consumer; seed the gas hob igniter into one kitchen position, leave the remaining assignments unverified.
5. Editable logical supply links with valid component/port selectors, plus an automatically generated **read-only** topology diagram from the saved links. Diagram must explicitly label uncertainty and not imply complete L/N/PE wiring.
6. Validation of *model consistency only*: endpoint and port existence, supply-system and voltage compatibility, input/output direction, duplicate socket occupancy and invalid protection references. Report warnings without claiming electrical safety.
7. Preserve existing Iteration 01 projects: load saved v1 JSON, migrate to v2 without overwriting user edits, and support importing v1 exports as well as v2. Ensure new seed catalogue is added without duplicating untouched legacy laptop loads or silently replacing edited ones.
8. Update seed data with Starlink/inverter AC circuit, one shared 80W laptop adapter, additional named lights, Maxxair fan placeholder, shore/CU/socket equipment and gas-hob igniter.
9. Keep v1 load calculations, profile editing, saving and exports working. Add automated migration, topology and consumer-unit tests and run the full CI build.

## Explicit exclusions
No drag-and-drop wiring canvas, verified connection topology, fuse/cable sizing, voltage-drop compliance, mains earthing verification, AC transfer/neutral-earth logic, automatic downstream protection calculations, AI standards analysis, installation approval or physical 3D routing.

## Acceptance examples
- Two consumer units appear as distinct editable items with independent protection inventories.
- Kitchen (two positions) and garage (one) are modelled and can have AC consumers assigned without double-counting appliance Wh.
- AC path is rendered conceptually as shore inlet → shore CU → MultiPlus → socket CU → kitchen/garage sockets, all `proposed` unless separately verified.
- AC L, N, PE and DC +, −, chassis remain distinguished; mismatched DC-to-AC links are flagged and never automatically converted.
- Existing v1 project imports preserve edited loads; unknown values remain unknown. Normal and working profiles still calculate.
- Eight original calculation tests and new topology/migration tests pass.

## Accepted in-iteration refinements (2026-11-01)
### AC source tracing
- When a consumer changes to 230V, offer inverter-backed and shore-only supplies and attach it to an appropriate named AC circuit. Derive the upstream source by walking the stored, compatible AC port-group links, not by an independent load/source dropdown.
- A source is resolvable only if a matching route exists to MultiPlus AC OUT or shore-only supply. Vandy's inverter-backed AC output has two distinct operational scenarios: (1) battery inverter, (2) shore-through-MultiPlus. Do not mistake the shore pass-through supply path for an independent shore-only circuit.
- Preserve the distinct logical distribution group and physical socket assignment. On missing/ambiguous routes, warn, never auto-certify or fabricate wiring.
- Expose the derived route, evidence and operating scenario in the consumer editor.

### Charging & autonomy (prototype-only extension requested by owner)
- Add **Off-grid autonomy** planning page with stationary versus daily-driving estimates, usable battery energy based on configurable starting and minimum SOC, and daily Wh from the existing load calculator in *inverter* mode.
- Model Orion XS 12/12-50A input-side spare alternator current (not nameplate alternator rating), input limit, output limit, charge voltages, efficiency and active-driving fraction; enforce 700W nominal cap and never infer automatic support for 24V batteries.
- Solar: use European Commission PVGIS 5.3 `PVcalc` monthly typical production, derived at a selected latitude/longitude or an **illustrative equal-weight UK five-location reference**. Source API explicitly prohibits browser AJAX: Codespaces development proxy must call server-side with rate limiting/cache, never direct CORS AJAX. For commercial deployment require separate hosted backend and usage review.
- Use PVGIS `peakpower` in **kW**, while users enter Wp. Use monthly `E_m` kWh / month and convert to typical daily Wh by month length. PVGIS grid-tied model is an approximate proxy for MPPT/battery charging, not a guaranteed match; month-to-month averages are not a forecast.
- Include explicit solar loss, additional shade derating, 100/50 nominal PV limit (700W on 12V), and location/time evidence. Missing/expired data must remain unknown, not invented. An editable manual Wh/day override is allowed, visibly user-sourced.
- Report daily load Wh, solar Wh, DC-DC Wh, stationary/off-grid net, daily-driving net, and indicative days to minimum SOC, with **no finite number if average energy balance is non-depleting**. Flag partial load ratings as optimistic and do not grant a positive safety/off-grid rating while important loads are unmeasured.
- Exclude shore charge from off-grid calculations, do not extrapolate instantaneous weather or exact MPPT clipping from monthly PVGIS data, and do not count spare generation beyond battery capacity.
- Preserve existing JSON schema v2 with optional autonomy configuration, defaults for older imports, and tests for charger limits, unknown solar, provenance, AC paths and two driving/stationary scenarios.
