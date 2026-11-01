# Project Vandy — Product and Architecture

## Purpose
A campervan electrical design assistant that starts with a reliable load calculator, grows into component-aware 2D schematics and engineering validation, and later supports routed 3D physical design. The first reference installation is **Vandy V1**, an existing 12V Fiat Ducato campervan. Vandy V2 will explore an agreed 24V equipment shortlist, not an unrestricted shopping catalogue.

## Core architecture
1. **Domain layer**: stable IDs; projects, usage profiles, electrical circuits, consumers, operating modes, components and output channels. Voltage is on circuits and component interfaces, not merely the project root. A battery is only one source.
2. **Calculation layer**: pure deterministic TypeScript calculations (Wh/day; Ah equivalents; approximate connected maxima), with explicit assumptions, uncertainty and no implicit voltage conversion.
3. **Presentation layer**: React UI for entering and editing data; no calculations embedded in components.
4. **Persistence layer**: versioned JSON schema, browser localStorage, import/export. Future database requires a separate decision.
5. **Future knowledge layer**: AI-assisted retrieval/explanation with source provenance; only reviewed rules drive actual electrical validation. Licensed standards material must be handled according to its permissions.

## Entities
- **Consumer / load**: distinct power draw, potentially multiple operating modes, evidence and per-profile run time / duty cycle. Example: toilet light and toilet flush are separate consumers.
- **Circuit**: named logical grouping with a supply type, voltage and multiple consumers. Example: shared Toilet circuit. A source component/channel assignment remains **informational only**; it does not imply actual wiring.
- **Equipment**: battery, Lynx, Blue Sea 5026 fuse block (12 outputs), generic six-channel remote box (6 outputs), Votronic switches, USB panels, chargers, converter, inverter/charger, appliances and monitoring. Components and loads are not necessarily 1:1.
- **Iteration 02 logical ports and links**: each component can expose groups of AC L/N/PE or DC+/DC-/chassis interfaces, with proposed/reported/verified logical relationships. These are NOT individual conductor edges and cannot be used to certify installation. Two physically separate 230V consumer units have independent protection inventories; sockets have independently assignable positions.
- **Future connection / cable**: distinct electrical edges with terminal identity, polarity, conductor cross-section, length, routing, installation environment, protective device and evidence. No such connections are modelled or validated in Iteration 01.
- **Usage profile**: normal day, working from van, winter day; data associated per consumer operating mode.

## Calculations and caveats
- Daily energy per mode = W × run-minutes / 60 × duty fraction. LED strip rated maximum = metres × rated W/m; typical brightness is an energy estimate, not a safe cable-sizing reduction.
- Compressor refrigerator: manufacturer rated 60W; initial 35% duty is only a placeholder. Diesel heater: published 40W running rating; startup/after-run remain unknown. LPG water heater: manual says 12V 5A, a *nominal maximum*, not a guarantee of continuous consumption.
- 230V AC loads fed through an inverter are converted to a battery-side energy estimate with user-visible inverter efficiency. Shore-only energy is excluded from battery demand. 12V circuits in a 24V battery project are flagged until a proper converter is modelled.
- Never count unknown loads as verified zero; always mark partial totals. Sum of load maxima is **not** a validated simultaneous peak, fuse rating or cable sizing result.
- Do not treat battery capacity in Ah as guaranteed usable energy or project runtime, particularly in the absence of valid battery health, SOC and discharge conditions.

## Reference Vandy inventory
- WattCycle 280Ah LiFePO₄ battery; Victron Lynx Distributor, SmartShunt, Cerbo GX; SmartSolar MPPT 100/50; Orion XS 12/12-50; MultiPlus 12/500/20; ~400–480W roof solar (rating not verified).
- Blue Sea ST Blade 5026 12-circuit fuse block; generic six-channel remote-controlled distribution box; two Votronic rocker switches; two four-port USB chargers (advertised 108W match not confirmed).
- CR65X fridge (12/24V, 60W); VEVOR diesel air heater XMZ-F-D1 family (12V 40W listed; exact installed variant and transient draw unverified); unknown-brand LPG water heater (12V 5A electric input per manual); water pump, toilet light/flush, floor LED strips, kitchen/main/outside/garage lights, Maxxair/Airxcel roof vent (specific variant unknown), Starlink on 230V via inverter, and one shared 80W-rated 230V laptop adapter.
- Vandy also has two distinct 230V consumer units (one protecting incoming shore power and one protecting sockets), a double kitchen socket (gas hob igniter plugged in) and a single garage socket. Exact breaker types/ratings, supply wiring, AC earthing and circuit assignments remain unverified.
- The toilet light and flush share a circuit. Other source channel/fuse assignments must not be guessed.

## Iteration roadmap
1. **Load calculator (completed baseline)**: typed named circuits/consumers, usage profiles, LED strips, multi-state loads, local persistence and tests.
2. **Logical distribution & topology (current)**: AC/DC port groups, two consumer units and their protection records, socket accessories/positions, evidence-labelled logical links, read-only auto-generated block view; v1 data migration.
3. **Interactive 2D schematic**: separate individual conductor terminal/netlist, switches, fuses, branching, cable lengths and cross sections; optional auto-placement from logical groupings.
4. **Electrical validation**: conductor sizing, voltage drop, protective-device placement and limits, inverter/shore protection/earthing and verified UK/EU standards, with manual inspection states.
5. **System sizing**: deterministic battery, charging and solar recommendations using selected equipment, including 24V and intentional 12V conversion.
6. **3D Vandy**: physical placement and routed cable/pipe lengths using the same netlist.
7. **Future utilities**: distinct water, LPG and heating networks with hazard separation and service access.

## Safety / standards / commercial boundaries
- Engineering software can flag design risks; it cannot certify BS 7671 / relevant EN requirements or substitute for a competent professional's installation, inspection, testing and risk assessment.
- Prioritise UK/EU standards, manufacturer installation data, correct edition and applicable jurisdiction. Don't paste copyrighted standards wholesale into an AI prompt or commercial product without rights.
- Later safety prompts: carbon monoxide detection and testing, combustion air/exhaust routing, LPG leaks/isolation, correct ventilation, fire and electric shock, cable protection and mechanical damage.
- No automatic advice that a component or circuit is safe merely because no warning is found.
- Reassess security, privacy, hosting, licensed third-party assets and commercial terms before publishing paid products or introducing AI accounts.

## Charging and autonomy proof-of-concept — Iteration 02 refinement
- Vandy's Victron Orion XS 12/12-50A input and output current limits are each independently configurable up to 50A. Published upper continuous output is 700W at representative charge voltage; efficiency up to 98.5% is not a guaranteed operating efficiency. User-entered alternator current means **spare alternator current available at the charger's input** and must not be confused with total vehicle alternator rating.
- The SmartSolar 100/50 has rated 50A charge output, nominal 700W PV on a 12V battery, and nominal conversion efficiency up to 98%. A preliminary monthly PVGIS power cap uses nominal PV rating; proper hourly clipping, acceptance/taper, shading and thermal derating remain future engineering work.
- The EU JRC PVGIS 5.3 `PVcalc` endpoint yields historical monthly PV production. The API forbids browser-side AJAX, so a **development-only Node/Vite proxy** translates the request. Production hosting needs an authorised backend and cache; missing API data remains unknown.
- UK regional baseline is explicitly an equal-weight average of five UK locations and is **not a validated geographical average or a forecast**.
- The autonomy model simulates nominal usable battery range and a repeated *average* day. It does not verify a safe off-grid duration, model probability of bad weather, charging taper, driving/solar time-of-day, reserve battery health, low-temperature restrictions or electrical safety.
- Source path to AC consumers is derived from compatible topology links and presented as proposed/reported/verified *claims*. Operating scenario determines estimated battery energy for inverter-fed AC loads.

## Iteration 03: battery/BMS records, communications and interactive overview
The third iteration extends Vandy's underlying single equipment/project model with detailed battery records, series/parallel battery-bank topology, distinct BMS capabilities, self-heating details, and evidence/documentation provenance. The bank is authoritative for autonomy while old project Ah remains for import compatibility when no bank is selected. Unknown values remain null.

A distinct communications model stores individually available and occupied device ports, data-link status (proposed/reported/verified), measured-source authority and optional SmartShunt AUX use. Recommendation rules use documented Victron interfaces and identify adapters/cables and benefits without implying installation. No Bluetooth third-party BMS integration is assumed absent manufacturer documentation.

The interactive 2D overview has AC, DC and communications layers and operates on **the same saved logical connection model** as equipment editors. Node layouts are cosmetic and may be dragged independently by layer. It is explicitly not a wire-by-wire schematic.

Manual field changes are staged with Reset/Update rather than silently persisting on every keystroke. Incomplete-but-safe data may be saved with warnings; only invalid values or broken structural relationships block Update with explicit causes. Imported v1/v2 records migrate to v3.


## Device-first connections and earthing — November 2026
The future wiring netlist is a single persisted connection graph accessible both from each equipment device and the 2D designer. Device editing is introduced before diagram-endpoint dragging; the diagram must always update from the edited model. Only compatible endpoints may be connected and every change uses the application's Update/Reset workflow. Current and recommended engineering values are emphasised in the UI, with provenance details retained internally rather than surfaced as confidence badges.

Vandy V1 records a Lynx chassis/earth connection to a common equipment-area bonding busbar, with that busbar connected to a main vehicle chassis point. Both 230V consumer units have protective-earth connections to the **rear pillar** chassis point. Individual additional devices that use the front busbar are not yet specified. Separate DC negative, AC PE and chassis-bond types prevent dangerous implicit equivalence; any actual DC negative/chassis or N–PE bond must be recorded and independently validated before it is shown.
