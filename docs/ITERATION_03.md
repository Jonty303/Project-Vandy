# Iteration 03 — Batteries, BMS, GX Connectivity & Interactive 2D System Overview

## Design authority
This is the authoritative Iteration 03 implementation contract. Base branch: `iteration-02`. Do not merge into `iteration-02` or `main` without user approval. Preserve Iterations 01 and 02 energy calculations, topology data, editor functionality, storage migration and safety disclaimers.

## Goals
1. Make **Batteries & BMS** its own workspace, separate from the equipment inventory, with individual batteries and banks (series strings in parallel).
2. Include manufacturer/model/chemistry/dimensions/weight, nominal voltage and Ah, maximum charge/discharge currents, charge/discharge temperature bounds, BMS details, cell monitoring/balancing/protections, evidence and documentation URL.
3. Model self-heating and temperature cut-offs as separate features (yes/no/unknown), with heater control/thresholds, watts, input source and status visibility; remain informational for energy calculations.
4. Treat Bluetooth batteries as **vendor-app-only** unless documentation explicitly establishes another compatible management interface. No generic Bluetooth→Cerbo assumption or unverified CAN/DVCC claim.
5. Represent physical device communication ports by unique stable IDs (VE.Direct, VE.Bus, VE.Can, Bluetooth, AUX, temperature inputs, USB and Ethernet) independently from DC/AC power terminal groups.
6. Recommend documented compatible connections into Cerbo or similar GX controller where available, identifying the required cable/adapter, what monitoring/control data becomes accessible and why. Recommendations are **not installed** connections.
7. Track documented, verified, unverified or unsupported capability separately from proposed, owner-reported or user-marked-verified installation status.
8. Treat data-source authority explicitly (SmartShunt bank SOC separate from manufacturer BMS cell readings; GX display does not imply BMS management). Model the SmartShunt AUX choice as **one of starter voltage, battery temperature or midpoint**, not three simultaneous inputs. Distinguish optional sensor models.
9. Provide the new **2D Overview** with independent AC, DC and communications layers generated from saved logical power links and communication connections; ability to select equipment, inspect relationships and drag/reposition nodes, pan/zoom and save visual placement. No invented wiring lines.
10. Implement **Reset / Update** staging for existing editable pages as well as new workspaces. A field's dependency/lock must have an explicit reason. Unknown safe values may be saved with field-level incomplete flags; only genuinely invalid structures/values prevent Update and must show the specific cause.
11. Upgrade schema v2→v3 and v1→v3, carrying forward all user edits. Existing v2 browser projects should continue to load and their Ah and load data must not be silently overwritten.
12. Use the active bank, not a competing project-level capacity field, for autonomy. Unknown or mismatched bank specs must block an autonomy *rating* without blocking safe editor updates.

## Vandy seed facts
- WattCycle 280Ah 12V LiFePO₄ habitation battery, internal Bluetooth app/BMS, individual cell readings reported by owner; exact model variant and other management interfaces not confirmed. Self-heating and detailed temperature data **unknown**; do not guess.
- SmartShunt bank monitor is a separate source of SOC, distinct from WattCycle BMS. Its AUX supports one selected function. The included fused AUX lead is documented for the relevant SmartShunt family; compatible temperature probe is optional.
- Cerbo GX, Victron SmartSolar MPPT 100/50, Orion XS 12/12-50 and MultiPlus 12/500/20 exist in project. External data cabling/port occupancy not confirmed. The exact Cerbo hardware generation also remains unverified.
- VE.Direct routes for SmartShunt, SmartSolar and Orion XS; VE.Bus route for MultiPlus are documentary recommendations, not installed claims. The Orion XS supports monitoring and supported remote on/off through GX when connected with VE.Direct, but DVCC only under documented conditions.
- Original physical AC topology and CU protections remain unverified; diagrams cannot certify installation.

## Validation rules
- A battery name is required, positive numeric values when populated, consistent thermal limits and duplicate-bank-membership checks. Empty capacity, weight, BMS details, heating status and other optional specifications are valid, **incomplete** data; not zeros.
- Parallel strings with different series counts or nominal voltage cannot be treated as valid configured topology; warn/block updates for structural errors rather than silently correcting them. Empty draft bank positions may be saved as incomplete, but no bank Wh or autonomy promise follows.
- Comms connections must target existing ports, with compatible protocols and no duplicate occupancy of individual physical ports. Never automatically translate VE.Direct into VE.Can or Bluetooth into GX.
- Optional GX data authority requires a recorded path; if missing, issue an actionable incomplete warning.
- Visual drag stores **layout coordinates only**, never electrical conductor relationships.
- Display all blocking issues alongside Update, with explicit explanations. Reset restores last saved values; navigation warns before discarding unsaved changes. Dataset imports/exports use versioned JSON.

## Architectural boundaries
- This is a **logical 2D overview** and compatible connectivity planning, not an editable wire-by-wire netlist, cable sizing, earthing/BMS safety design or certified electrical installation drawing.
- No actual device control, live VRM/GX API, authentication, port scanning, sensor wiring instructions, BMS firmware programming, or hosting/telemetry.
- PVGIS remains a development-only proxy for historical solar data; production static hosting needs a proper backend.
- Unknown manufacturer details remain unknown. Source material is retained for product catalogue review.

## Documentation links (used to ground limited integration catalogue)
- Cerbo GX interfaces: https://www.victronenergy.com/media/pg/Cerbo_GX/en/technical-specifications.html
- Cerbo installation / VE.Direct adapters: https://www.victronenergy.com/media/pg/Cerbo_GX/en/installation.html
- SmartShunt AUX/VE.Direct: https://www.victronenergy.com/media/pg/SmartShunt/en/technical-data.html
- Orion XS GX monitoring: https://www.victronenergy.com/media/pg/Orion_XS_12-12-50A_DC-DC_battery_charger/en/operation%2C-configuration-and-monitoring.html

## Acceptance tests
- v2 saved data migrates to v3 without losing customized circuit/load/Ah/profile values.
- 2S2P bank calculates voltage and capacity correctly; missing Ah remains unknown, not zero; bank voltage mismatch blocks autonomy rating.
- All battery/BMS and thermal controls retain null/unknown and list field-level issues.
- Bluetooth-only WattCycle battery does not receive an automatic Cerbo link.
- Three VE.Direct device integrations and one MultiPlus VE.Bus integration may be recommended, subject to free ports and documented compatibility.
- Duplicate port assignments are blocked with the port name; SmartShunt AUX is singly allocated.
- 2D graph comes from persisted AC/DC logical and communications links, not fabricated edges; layout edits survive Update and JSON reload.
- Editable panels have Update/Reset and explain what is missing and what stops saving.
- Existing 32 tests plus new migration, bank and comm tests pass; TypeScript checks and production bundle pass.

## 2026-11-01 extension — owner-reported as-installed DC connection plan
This extends the same Iteration 03 branch and is a **test-data schedule**, not an approved installation.

### Owner confirmed
- Battery: WattCycle **12V 280Ah Mini Bluetooth** LiFePO₄. Model revision inaccessible for label inspection. Internal BMS Bluetooth via manufacturer app only until external interface documented.
- Battery positive: habitation battery → **150A main fuse** → battery isolator → Victron Lynx Distributor. Main fuse order confirmed, physical distance and cable size **not**.
- Battery negative: habitation battery → SmartShunt → Lynx negative bus. SmartShunt current measurement is authoritative for habitation bank SOC when configured correctly; its small positive sensing feed was mentioned but exact terminal unspecified.
- Orion XS 12/12-50 is **not** on the Lynx. Its starter-battery input and habitation-battery output are directly wired with **70A fuses on both sides**, owner-checked. Physical fuse-to-battery position, isolator bypass behaviour and Orion GND return are not yet verified.
- Six-channel remote switching controller occupies the Lynx output formerly assigned to Orion XS. The Blue Sea 5026, SmartSolar 100/50 and MultiPlus 12/500/20 appear as the other three Lynx destinations in a historical sketch, but present-day slot order/rating still requires inspection.
- Lighting lengths: bathroom **1m**, kitchen **1.5m**, floor **2m**. 9.6W/m is a provisional power-per-metre assumption. Bathroom lighting is currently modelled as the previously known toilet light, not an invented additional fixture; confirm whether these are the same.
- Outside light is part of an external rain gutter above the sliding door. Brand, LED technology, length and actual watts are **unknown**.

### Test-data assumptions — can be edited
- Lynx outputs numbered sequentially for the demo: **1 remote, 2 Blue Sea, 3 MPPT, 4 MultiPlus**. Slots are *proposed*, never marked checked.
- Blue Sea 5026's twelve outputs are provisionally assigned in this order: **fridge, floor LEDs, bathroom/toilet, water pump, diesel heater, LPG water-heater electronics, roof ventilation, USB charging panels, kitchen LEDs, main lighting, rain-gutter outside lighting, garage lighting**. Two USB panels may share one branch in this demonstration; real circuit topology unverified.
- Each DC cable segment is **1m one-way assumed**, each with its own editable length and length-evidence value. The positive and negative conductors are separate records, not synonyms for chassis.
- The fuse records differentiate **observed fuse rating and electrical order**, **actual physical fuse placement**, and **recommended placement near the battery/source**. A downstream fuse near equipment does not protect the conductor between it and its source. Main fuse 150A and both Orion 70A values are owner-checked; other fuse ratings are *provisional planning* or a manufacturer range, **not installed facts**.
- External MPPT battery fuse proposal **60A**, in the SmartSolar 100/50 manufacturer's **55–70A** range.
- Orion XS manufacturer recommends **60–70A external fuses** and **16mm² or 6AWG** alternatives below 5m; their cross-sectional areas are not exactly equal. The wire-sizing engine reports a nearest *non-smaller* standard AWG area and may therefore be more conservative.
- Proposed Lynx remote **15A**, Blue Sea feeder **60A**, MultiPlus **100A** are illustrative placeholders needing device ratings and cable/fuse coordination. In particular, the MultiPlus manufacturer's built-in protection is not treated as an approved external wire fuse.
- Individual Blue Sea slot proposals are **10A, 5A, 10A, 15A, 25A, 10A, 10A, 25A, 5A, 5A, 5A, 5A**. Manufacturer limit is **30A per circuit and 100A per block**, independently of fuse sums.
- Wire size is computed as a *provisional planning area* in metric mm² plus the standard AWG whose actual area is not smaller, from a conservative current floor, manufacturer minimum (if known), and an assumed round-trip 3% voltage-drop target. When appliance load current is unknown, the provisional fuse rating is used as a sizing envelope rather than claiming measured consumption. No cable sizing can be final without real cable type, insulation, installation method, temperature/grouping derating, terminal rating, actual route, voltage, fault-current characteristics and breaking capacity.
- Source of truth remains explicit. Orion XS GND/negative return is **unknown** and must not be invented; check whether its arrangement ensures habitation charging is included in SmartShunt current measurement. Direct Orion output may remain energised while the main isolator is opened; confirmation needed.
- Provisional fuse schedule does **not** assert that the original user's fuses match the proposed ratings, nor that summing downstream fuse ratings proves a block overload.

### Outstanding as-installed measurements
1. Orion XS GND return and habitation battery negative, charger return and chassis/bonding arrangement.
2. Main fuse distance from the battery and whether the Orion habitation output fuse sits next to battery or device; fuse types and interrupt ratings.
3. Cable lengths (1m defaults), stranded copper cross sections, cable insulation and physical routes.
4. Actual Lynx fuse positions/ratings, Blue Sea 12 slot positions/ratings and channel assignments of the 6-way wireless switching unit.
5. Amp and surge ratings of water pump, diesel heater, roof vent, USB charging panels and switching controller; actual charge current settings and inverter surge assumptions.
6. LED strip W/m ratings and whether bathroom strip and toilet light are the same fixture; gutter lighting brand and watts.
7. Cerbo GX external communications wiring and SmartShunt AUX purpose.
