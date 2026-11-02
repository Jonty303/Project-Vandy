# Distribution iteration contract — logical planning associations

Status: **IMPLEMENTED (v7 planning model; physical connectivity deferred)**. Branch: `feature/load-calculator`.
Scope: planning-level **logical distribution associations** only. The user's existing loads, circuits, battery, selected chargers and off-grid model remain authoritative. This contract does not authorize terminals, conductor wiring, fuse rating calculations, compliance claims or 2D editing.

## Goal
Add **Distribution** as the next menu item after **Off-grid rating**, with exactly three tabs: **12 V DC**, **24 V DC**, and **230 V AC**. Present selected distribution equipment, chosen charging equipment, named circuits and ungrouped individual loads using the same top-list + bottom-detail editing pattern as Load Calculator. Assign logical supply destinations without altering circuit membership or load voltage. Continue the existing staged **Update / Reset / Export JSON / Import JSON** workflow.

## Voltage tabs and gating
- **12 V DC**: always accessible for planning and review, even with no selected battery or with a 24 V battery. In the latter case, retain 12 V circuits/loads and show that an actual 24-to-12 V converter/source will be needed before this rail can be considered supplied. A generic step-down efficiency assumed for Off-grid rating is **not** an implemented distribution source.
- **24 V DC**: **disabled unless a 24 V capable supply has been selected**, initially a selected 24 V battery. A 24 V appliance, 24 V-labelled circuit, or 12-to-24 V *battery charger* does **not** prove the existence of a usable 24 V DC load rail. In a later iteration, a properly specified 12-to-24 V load converter or separately supplied 24 V subsystem may enable this tab.
- **230 V AC**: available for planning if 230 V loads, circuits, inverter, inverter/charger or shore charging exist. It must still distinguish AC supply from charger input and show missing-source warnings. Display the tab consistently in navigation.
- With a 24 V battery, the separate 12 V load rail is **not** assumed implemented simply because Off-grid rating uses provisional step-down efficiency. Mark 12 V distribution as requiring a converter/source. Do not silently produce a virtual converter or rewrite voltages.
- Every unpowered or mismatched item remains available for review and saving; never delete or move it just to satisfy tab gating.

## Component catalogue — first build
1. **Victron Lynx Distributor**: DC positive/negative distribution with **four MEGA-fused branch positions**, manufacturer-supported 12/24 V; each instance has a stable ID and optional friendly name. Each branch position can hold one logical branch association for this pass. The upstream feed association does not auto-occupy a particular fuse slot. Manufacturer: https://www.victronenergy.com/media/pg/Lynx_Distributor/en/system-design.html
2. **Blue Sea Systems ST Blade model 5026** (not "Sky Blue"): one positive supply input, a separate negative bus and **twelve numbered ATC/ATO branch-fuse positions**. Manufacturer maxima: **32 V DC, 100 A block, 30 A each branch**. Supports 12 V or 24 V only when its actual operating voltages are compatible. **An upstream source is mandatory** as a planned association (battery, Lynx Distributor, or suitable DC busbar). Direct battery feed is a possible plan, **not evidence that feed protection is adequate**. Manufacturer: https://www.bluesea.com/products/5026/ST_Blade_Fuse_Block_-_12_Circuits_with_Cover
3. **Generic DC busbar**: configurable label and nominal system voltage; model positive and negative electrical domains **separately**, even if the interface offers a visually paired busbar assembly. This is NOT a fused device and does NOT inherently establish a chassis-earth or protective-earth bond. The UI must not equate DC negative with earth or AC protective earth.
4. **230 V standalone inverter selection**, only as needed if no suitable selected inverter/charger exists. Initially Victron Phoenix VE.Direct 12/500 and 24/500, using documented 12 V and 24 V DC input, 500 VA AC output and manufacturer specification source. **Do not invent compatibility** or replace the prior selected shore-only charger. Defer multiple simultaneous AC sources, transfer arrangement and 230 V protection topology.
5. The **6-way remote** is explicitly omitted, as requested. No switches, breakers, AC consumer unit hardware or additional fuse products are automatically introduced in this first distribution pass.

## Source and destination semantics
- Battery selection provides an abstract **DC battery-system source** at the selected nominal voltage; it does not create a physical cable, terminal or fuse. In the absence of a battery selection, associations can be staged but remain unresolved.
- **DC distribution device** can have one declared upstream logical feed (selected battery system, Lynx, or appropriately typed busbar, according to compatibility rules), and downstream associations. Allow chains such as:
  **Battery → Lynx → Blue Sea 5026 → Lighting circuit → member loads**.
  **Battery → DC busbar → Blue Sea 5026 → Ungrouped toilet pump**.
  Upstream links must not form cycles; a source cannot feed itself.
- A named **circuit** is the atom of distribution assignment; its existing members are **inherited**, not assigned or double-counted individually. A formerly ungrouped load may be assigned to a branch individually. When added to a named circuit, the load automatically stops being a direct distribution target and inherits the circuit's assignment; when ungrouped, its prior inherited assignment is not silently retained.
- **Ungrouped loads** remain individual selectable destinations and should not require creating a named circuit. The word "direct" means assigned individually to an appropriate distribution branch, NOT assumed wired directly to the battery.
- **MPPT and DC–DC** devices already selected in Charging appear as **charging sources** using their stable instance IDs and selected battery-output voltage. Their battery-side outputs can logically feed the battery system, Lynx or suitable DC busbar. They are **not load circuits**, cannot occupy Blue Sea branch-load slots by default, and must not contribute to consumer counts or demand twice.
- **Inverter or inverter/charger DC input** is a DC consumer/feeder association distinct from its **230 V AC output**. An inverter can receive its battery-side DC supply from the selected DC distribution chain while furnishing an AC supply relationship in the 230 V tab.
- Keep charging sources, distribution devices, named circuits and ungrouped loads visibly separated in lists, with explicit source/consumer direction.

## 230 V tab and charger / inverter rule
- When a **combined inverter/charger** was chosen in Charging, show it **automatically as the proposed 230 V inverter output source**, retaining the *same device identity*, specification and selected model. Do not create a second duplicate inverter.
- When only a **shore-only charger** was selected, show that charger for context as an **AC input consumer / battery charging device**; it is **not** an inverter and must NOT be promoted to a source for 230 V appliances. Provide **Select an inverter** for battery-backed AC loads.
- If nothing relevant was selected, provide **Select an inverter** directly.
- Display named 230 V circuits and individual ungrouped 230 V loads, assign them to the planned inverter AC output grouping only at the logical level. Do not automatically assume they are supplied by shore, and do not model transfer switching or consumer-unit protection yet.
- The existing installation reference has *two distinct 230 V consumer units*. Retain this as a **future modelling requirement**; do not silently instantiate consumer units or assume their wiring in this stage.

## List/detail UI
- Tab headings display a small count of distribution devices and assigned/unassigned items, not only total loads.
- An **Add distribution device** action offers Lynx Distributor, Blue Sea 5026 and generic busbar on the appropriate DC tab. Allow more than one of each type. Each gets a friendly name and stable ID.
- A device details panel shows: selected model, nominal voltage, upstream logical feed, downstream associations, and the appropriate **fused-slot occupancy list** for Lynx (4) / Blue Sea (12). For generic busbars, show source and recipients but NO invented fuse slots.
- The list separately shows selected charge sources, named circuits and ungrouped loads with an **Assigned to** dropdown, using device names and optional branch positions. Support touch, keyboard and future drag/drop; drop not required in first build.
- A device can be assigned an upstream source even when it has zero attached loads. The interface warns about missing upstream supply, double occupancy and unknown protection, while preserving the partially planned system.
- A proposed logical hierarchy overview or breadcrumb is permitted, but it must not present itself as an installable wire-level diagram.

## Initial validation and persistence
- Voltage compatibility across each logical association; circuit/load mismatch warnings from existing shared `voltageIssues()` must remain visible. Do not rewrite item voltage.
- Source directionality, no cyclic feeder chains, no dangling IDs after deletion, and one active upstream/feed assignment per distribution node.
- At most **one logical outgoing association per numbered fused position**; when a destination is removed/unassigned the slot becomes free. Preserve optional position identity for later fuse assignment.
- Duplicate circuit/ungrouped-load assignments are not valid; an item cannot be attached to two separate distribution destinations in this initial design.
- Highlight missing feeder, unavailable voltage, missing inverter for AC loads, incompatible charger output, and any node without confirmed circuit protection. **Do not declare an arrangement safe based solely on association checks.**
- Optional current estimate may use device nameplate/rated power and circuit/load data, labelled **indicative only**, never select an actual fuse or wire. Current comparisons require a verified coincident load profile before suitability can be determined.
- **Do not compute protective device values, wiring size, earth bonding, terminals, DC return wiring, short-circuit ratings, RCD/RCBO layout, load shedding or formal compliance**.
- Project JSON upgrades to the next version (after v6), retains all existing user-edited loads/circuits/battery/charging/off-grid data; older v1–v6 import must remain supported, with no preselected distribution devices.
- Structural errors block Update with a precise reason; incomplete plausible plans save with explicit "Unassigned / Review" warnings. Reset, import/export, browser localStorage and migration behaviour remain consistent with earlier screens.

## Acceptance cases for implementation
1. Start with blank project: no device auto-added; 24 V tab gated with explanation. Existing saved v6 JSON imports without losing a single load, circuit or charger selection.
2. 12 V battery → one Lynx → one Blue Sea 5026 upstream from Lynx → one named 12 V circuit in Blue Sea slot 1. All loads in that circuit inherit its slot association.
3. Add an ungrouped 12 V load and assign to Blue Sea slot 2; moving it into the named circuit removes its individual slot-2 association without duplicate demand.
4. Two Blue Sea units can exist and have independent numbering and upstream selection; no slot accepts two targets.
5. MPPT and Orion from Charging appear exactly once as charging sources and can be logically associated with Lynx/busbar/battery, without being reclassified as loads.
6. A 24 V battery enables the 24 V tab. A 12 V load in that plan remains at 12 V and is flagged pending an actual voltage-conversion source; the off-grid calculation's generic conversion assumption does not invent DC distribution capability.
7. A selected MultiPlus inverter/charger appears once as the AC source in the 230 V tab. Choosing only an IP22 shore charger does not create AC output; a standalone inverter can still be selected independently.
8. Deleting/unassigning a distribution device leaves destinations safely unassigned with nonblocking actionable warnings; the source project load and charging data are unaffected.
9. Cycles, incompatible voltage, occupied positions, missing battery, and incomplete feed assignments have clearly distinct messages; no automatic fuse, cable or PE/N connections are produced.
10. All tests, typecheck and build pass on the existing branch. Do not merge to main.

## Explicitly deferred
Wiring terminals, actual DC positive/negative conductors, fuse values and holders, volt-drop and cable current calculations, DC negative/chassis earth bonds, AC L/N/PE, PE/RCDs, consumer units, fuses/circuit breakers, multipoint AC feeds, inverter changeover, equipment physical locations, 2D cable routing, remote six-way controllers, communication data links, and installation claims.

## Engineering sources checked
- Victron Lynx Distributor manual (DC current ratings; four fused MEGA branches): https://www.victronenergy.com/media/pg/Lynx_Distributor/en/system-design.html
- Blue Sea ST Blade 5026 (12 branch positions; 32 V DC, 100 A total, 30 A per branch; negative bus): https://www.bluesea.com/products/5026/ST_Blade_Fuse_Block_-_12_Circuits_with_Cover

## Implementation note (v7)
- Source code: `src/domain/distribution.ts`, `src/ui/DistributionPage.tsx`, `src/ui/distribution.css`; regression tests in `tests/distribution.test.mjs`.
- Tab and assignment UI uses dropdowns; drag/drop assignment and a rendered topology diagram remain deferred.
- Busbar connection counts are **minimum indicative connections per polarity**: reserve 1 upstream feed position, add directly associated downstream branches and incoming charge devices. These are sizing hints, not a verified number of actual DC negative return conductors, cable lugs, or approved stacking on posts.
- Incomplete source, voltage mismatch and no inverter paths generate warnings. Duplicate slot occupancies, cycles and dangling references are structurally invalid. Changing load/circuit membership or charging device selections automatically reconciles obsolete logical links while preserving the original load/charger records.
- Standalone inverter selection is limited to the verified Victron Phoenix VE.Direct 12/500 and 24/500 models; the first iteration allows one active inverter output grouping only.
- The app remains a **planning tool**, not a physical wire-and-protection design. No engineer's safety approval is inferred.


## v8 hotfix — fused Lynx charger-output positions (2026-11-02)
The four Lynx fused slots are a single occupancy inventory shared by **outgoing consumer/distributor feeder associations** and **incoming charge outputs** (MPPT and DC–DC). Selecting a Lynx in a charger-output dropdown automatically reserves the next free fused position. Both the Lynx device cards and Charging outputs table display the chosen position, and users may move/unassign it without double-booking any slot. A fifth connection is rejected until one of the four is freed; no additional Lynx distributor is implied.

Existing v7 exports or browser records with charging outputs previously associated to the Lynx, but without slot identities, migrate to v8. Existing distributor/inverter slots take priority and spare slots are assigned to chargers in their saved order. An excess charger keeps its destination but gets an explicit **unallocated fuse position** warning, rather than being lost or silently assumed protected. This is a planning association only: fuse ratings, terminal lug fit, conductor protection and actual DC+/DC− connections remain deferred.
