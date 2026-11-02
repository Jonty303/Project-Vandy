# Socket connection-point and 230 V consumer-unit amendment

Branch: `feature/socket-distribution` (created from `feature/load-calculator`, do not merge into main).

## Intent and scope
This is an incremental planning feature. USB charge sockets, UK 3-pin appliance outlets and the exterior shore inlet are **non-consuming connection points**. Their presence changes no load's wattage, voltage, operating hours, quantity, Wh or Ah. Actual plugged-in appliances (phone, tablet, laptop, Starlink) remain energy loads and must be entered only once.

## Load Calculator
- A **named DC circuit** (12 V or 24 V) can contain USB socket connection points with one or two USB ports.
- A **named 230 V circuit** can contain a single or double UK 3-pin outlet connection point. Multiple connection points can exist in a circuit.
- The named circuit editor adds, renames, changes port count or deletes sockets. These connection points are displayed separately from the energy-consuming loads.
- Each load can select its supplying socket from the load detail view. The linked socket may be in a different circuit, but the app reports a review warning; neither item's circuit/voltage is rewritten.
- A socket port is a physical connection count, **not** a guaranteed electrical capacity. A load row whose quantity is two phones calls for two USB ports. The application warns about capacity after edits, while still permitting an incomplete project to be saved.
- An outlet associated with a 230 V circuit must have a selected inverter and its circuit must be logically assigned to the inverter's output under Distribution. Without an inverter, the socket may be planned but cannot be marked powered.
- The previous "USB socket 1/2 (idle draw)" templates were removed from *new* load choices to prevent accidental duplication; any previously saved idle-draw loads are preserved as real user data, and can be removed manually if no longer relevant. True idle consumption can be modelled as an ordinary load in a later step if desired.

## Distribution — 230 V
- **Shore input consumer unit**, stable derived role, appears when a shore charger/inverter-charger is chosen or the external shore-power inlet is added.
- **Inverter-fed output consumer unit**, separate stable derived role, appears when a 230 V load or UK 3-pin outlet is planned.
- One external **shore-power inlet** is an independent named connection point in the 230 V tab, with add/edit/remove controls; it is not a 3-pin load outlet and does not act as a source for an off-grid appliance.
- The actual 230 V inverter selected in the Charging or Distribution screen remains the planned supply for output circuits. A shore-only charger remains an AC load, not an inverter. No automatic inverter creation.
- Consumer-unit roles are **derived**, not additional manually maintained equipment records. They are not double-created when both a shore inlet and a charger are selected.
- No breaker ratings, RCD/RCBO configuration, protection/cable/earth design, AC source transfer, neutral-earth switching or physical cable connections are inferred. Two separate units match the previous planning requirement without committing to an installation topology.

## Data and regression
- JSON/storage schema v9 adds `connections: {sockets, shoreInlet, loadSocketLinks}`; previous v1–v8 configurations migrate losslessly (connections default empty). Existing distribution, charging, load, battery and off-grid data are retained.
- Direct socket association never adds or duplicates load energy, including Off-grid rating calculations.
- Circuit deletion removes its sockets and socket links, but retains appliances under Ungrouped as in the existing design; deleting a load removes its socket link. User-added shore inlet remains independent.
- Structural validation prevents missing IDs, duplicate load-to-socket links and too many distinct load links for the declared sockets; voltage and quantity mismatches are warnings to review.
- Tests: `tests/connectionPoints.test.mjs`, existing load/distribution/off-grid suites, TypeScript check and Vite build. GitHub Actions now runs on the new feature branch.

## Follow-up (later)
Socket power/converter losses, USB charger idle consumption, outlet current and coincident load calculations, fuse/breaker and AC shore protection, consumer-unit contents, RCDs, physical terminals, and actual inverter/source transfer arrangement are explicitly deferred.
