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
- **Circuit**: named logical grouping with a supply type, voltage and multiple consumers. Example: shared Toilet circuit. A source component/channel assignment is **informational only** in Iteration 01; it does not imply actual wiring.
- **Equipment**: battery, Lynx, Blue Sea 5026 fuse block (12 outputs), generic six-channel remote box (6 outputs), Votronic switches, USB panels, chargers, converter, inverter/charger, appliances and monitoring. Components and loads are not necessarily 1:1.
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
- CR65X fridge (12/24V, 60W); VEVOR diesel air heater XMZ-F-D1 family (12V 40W listed; exact installed variant and transient draw unverified); unknown-brand LPG water heater (12V 5A electric input per manual); water pump, toilet light/flush, floor LED strip, roof extractor, Starlink, two laptop chargers.
- The toilet light and flush share a circuit. Other source channel/fuse assignments must not be guessed.

## Iteration roadmap
1. **Load calculator**: typed model, named circuits/loads, operating profiles, LED strip and multi-state loads, explicit uncertainty, local persistence and tests.
2. **System sizing**: deterministic battery, charging and solar estimates using fixed, selected reference products for V2; support 24V bus and intentional 12V converter design.
3. **2D schematic**: ports, polarity, positive/negative/chassis bond/AC protective earth as different categories; branching, fuses, switches, wire lengths and sizes; optional auto-placement from logical circuit groupings.
4. **Electrical validation**: voltage, current, voltage drop, protective-device rating/location, alternator/DC-DC and inverter/shore earthing considerations, with verified standards references, manufacturer constraints, and explicit manual-review states.
5. **3D Vandy**: dimensioned vehicle geometry, component placement and physically routed cable lengths; diagram and 3D must share one underlying netlist.
6. **Future utilities**: separate water and gas pipe networks, valves, pumps, venting, service points and physical separation requirements. Do not implement these in the electrical MVP.

## Safety / standards / commercial boundaries
- Engineering software can flag design risks; it cannot certify BS 7671 / relevant EN requirements or substitute for a competent professional's installation, inspection, testing and risk assessment.
- Prioritise UK/EU standards, manufacturer installation data, correct edition and applicable jurisdiction. Don't paste copyrighted standards wholesale into an AI prompt or commercial product without rights.
- Later safety prompts: carbon monoxide detection and testing, combustion air/exhaust routing, LPG leaks/isolation, correct ventilation, fire and electric shock, cable protection and mechanical damage.
- No automatic advice that a component or circuit is safe merely because no warning is found.
- Reassess security, privacy, hosting, licensed third-party assets and commercial terms before publishing paid products or introducing AI accounts.
