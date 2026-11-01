# Iteration 04 — Physical terminals and circuit-level switching

## Status and branch
Implemented for manual review on `feature/device-connections-and-grounding` in draft PR #4, based on `iteration-03`. Do not merge until the user has checked Vandy's wiring and generated a corrected project JSON export.

## Scope
1. Define stable, editable physical terminal IDs on equipment, separated from existing logical `ElectricalPort` groups and Victron communication ports.
2. Distinguish DC positive, DC negative, AC L, AC N, protective earth, chassis and unknown-polarity switch contacts.
3. Include named terminals for habitation and starter batteries, both sides of SmartShunt, Orion XS, MPPT PV input and battery output, MultiPlus DC +/− and AC, Lynx DC buses/fuse positions, Blue Sea ST Blade 5026 inputs/12 fused channels and negative returns, and AC consumer units.
4. Extend each physical DC cable to reference exact source and destination terminal IDs where known. Omitted IDs represent unassigned, not an implicitly accepted connection.
5. Model individual AC L/N/PE conductor records separately from the established logical 230V supply diagram. No physical AC wiring is invented from block links.
6. Resolve grounding links through the same PE/chassis terminal catalogue without inferring DC-negative or AC neutral bonds.
7. Assign one or more switch devices or controller channels to a **Circuit**; these are NOT properties of individual loads or evidence of installed switched conductors.
8. Show/edit these relationships from the equipment/device editor and the DC schedule. Project JSON import/export must retain them, and the 2D diagram must reflect changes in saved conductor endpoints.
9. Validate polarity/type mismatches, missing terminal IDs, duplicate AC contacts and missing switch channels as structural blockers; permit deliberately unassigned terminals.
10. Existing v3, v2 and v1 data must migrate without overwriting prior user edits.

## Owner-confirmed Vandy facts
- Lynx Distributor has a chassis/earth connection to the main equipment earth busbar and the busbar attaches to vehicle chassis.
- Both 230V consumer units' PE returns attach to the rear-pillar chassis ground point.
- MPPT SmartSolar 100/50 and MultiPlus 12/500/20 are both connected to the Lynx. Their physical fuse positions and attached individual Lynx terminals remain unconfirmed. Four numbered Lynx fuse slots are *only* demo propositions and are not linked to these reported runs until inspected.
- The six-way controller occupies a Lynx output but the slot number and switched contact polarity remain unknown.
- Votronic rocker switching polarity and circuit assignment are unconfirmed. Users explicitly assign switches per circuit.
- The Orion XS negative/GND return remains unconfirmed, and the Orion does not feed through Lynx.

## Boundaries
- Displayed component terminal labels are an editable engineering catalogue, not confirmation of a physically inspected terminal position.
- The 2D SVG graph still renders device-level edge paths, although detail inspection shows explicit terminal names. Graphical wire-endpoint drag, schematic-quality conductor routing, cable interlocks and physically safe-to-build plans are deferred.
- Conductor sizing and fuse recommendations remain provisional. Completing the data model is not an electrical compliance certificate.

## Acceptance checks
- Existing seed DC runs reference the distinct SmartShunt BATTERY MINUS and SYSTEM MINUS endpoints.
- MPPT and MultiPlus have a reported Lynx relationship but do not claim an exact Lynx output terminal/fuse position.
- Remote-controller and rocker contacts have unspecified polarity.
- User can add/edit terminal labels and assign individual cable endpoints on a device and see their saved relationship in the generated overview.
- User can record independent AC L, N and PE conductor paths without creating a neutral–PE or chassis–negative bond.
- Circuit switch assignments, including specific remote-controller channels, persist after saving and JSON export/import with no energy-calculation side effects.
- Legacy v3 user wiring is hydrated only at untouched known seed endpoints; custom rewiring is not replaced.
- Node tests, strict TypeScript and Vite production build pass in GitHub Actions.
