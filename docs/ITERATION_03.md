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
