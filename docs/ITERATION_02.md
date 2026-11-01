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
