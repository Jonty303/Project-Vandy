# Focused load calculator — typical daily usage

This branch exposes **Home**, **Load Calculator**, **Battery Selection**, and **Charging** only. Projects start empty; the catalogue is a menu of optional loads, not a pre-populated project.

## This iteration
- The calculator has **Loads** and **Circuits** tabs. Each tab shows a compact, scrollable table on top; selecting a row opens its edit/details panel below the table.
- **Ungrouped loads** always appears first, including when empty. It is a built-in default virtual container, not a persisted physical circuit. New loads start here, have independent voltages, and can later be assigned to named circuits. Deleting a named circuit returns its loads to Ungrouped.
- The Loads tab groups rows by Ungrouped and named circuits. **Drag a load row** onto any part of another group's rows or its heading to reassign it. Empty groups accept drops. Drag onto Ungrouped to remove a circuit assignment. The load retains its own voltage regardless of the destination circuit; any disagreement appears as a non-blocking validation issue. Drop movement is staged and saved by Update; it does not create wiring. The existing Circuit dropdown in the load editor provides a non-drag alternative.
- Clicking **any cell in a load or circuit table row** (or pressing Enter/Space on a focused row) selects it. Clicking a group heading from Loads opens that circuit in the Circuits tab.
- The Circuits tab lists the Ungrouped container followed by named circuits with load counts, voltage, switch presence and Wh/day.
- A named circuit has an editable name, a 12/24/230 V supply and a **Physical on/off switch** checkbox (default unchecked). The circuit editor shows its assigned loads and Wh/day; links open an appliance in the Loads tab.
- **No "Controlled by" selector** or 6-gang remote assignment is exposed or stored in this planner schema. Selection of physical versus remote control will be part of the later wiring workflow. No controller wiring or channel mapping is inferred.
- The **Add load** catalogue exposes a single **LED lights** preset rather than separate floor, kitchen, toilet, main, outside and garage lighting choices. Add as many instances as needed, rename them, set their strip lengths and usage individually, and group them into circuits. Existing previously saved named lighting loads are preserved exactly. Default is an explicitly estimated 5 W/m, 1 metre, 3 hours/day.
- Adding a reference device creates a populated, editable **average electrical input** (W or A), typical hours per day, and quantity. LED strips additionally use estimated length and average power per metre; other devices never show length.
- Fridges use average electrical power across a normal 24-hour day (compressor duty already incorporated). Diesel heaters use a simple representative average while operating, with startup/shutdown transients excluded from *energy* modelling at this stage, not declared safe for sizing cables or protection.
- All supplied power/time defaults are planning inputs, not installation facts. The disclosure under **Technical basis & notes** explains whether a default comes from a manufacturer source, a reported rating, or an explicit estimate. Manufacturers' peak/nameplate ratings must not be presented as measured averages.
- Daily Wh = average W × daily operating hours × quantity; for LED strips average W = W/m × metres. Average A = average W / voltage. Daily Ah is Wh / voltage. 230 V equivalents are nominal W/230 without power factor correction; never assume they are actual AC apparent currents.
- Sum Wh across voltages, but not Ah. Unknown figures produce a partial total; blank is not zero. Battery Selection uses these Wh totals, but excludes inverter/converter losses, charge modelling, wiring, protection or certification.
- Edit, Reset, Update, local browser storage, JSON import/export remain in this focused feature. Changing a circuit voltage **never rewrites** load voltages, and voltage mismatches are valid to save/export. Shared `voltageIssues()` detects them and feeds Home, Load/Circuit tables, detail views and battery estimate; future 2D diagrams must consume the same issues. Energy totals remain calculated but are marked provisional when affected.

## Charging (planning, not installed inventory)
- Three tabs: **DC–DC**, **Solar**, **Shore power**. All selections are proposed equipment, saved in the integrated v5 planner. No sources are considered connected or operating yet.
- **DC–DC:** choose any number of Victron Orion XS / Orion-Tr Smart or Renogy DC–DC devices. Default editable **spare alternator current = 30 A** at editable 12 V alternator voltage. This is an illustrative estimate of *spare* capacity, not a claim about alternator nameplate or actual usable input.
- Rated DC–DC charger outputs must share that source. Compare their **aggregate rated output watts** with the approximate spare alternator input budget (amps × source volts). Flag an overcommit; the check is deliberately conservative/incomplete because charger input power, conversion losses and installed current limiting are not modelled. Validate each charger’s expected alternator input and habitation battery output voltage.
- **Solar:** one **Generic solar panel** record with editable per-panel W, quantity, series/parallel, Voc and Isc. Per-panel watts/Voc/Isc initially unknown, not manufacturer or installed facts. Nominal array watts always sum watts × quantity; series increases voltage and parallel increases current. Display array Voc and Isc only where input figures are supplied. Cold-temperature Voc rise is not modelled.
- Add any number of Victron SmartSolar MPPT or Renogy Rover controllers. When *exactly one* MPPT is selected, warn about entered array Voc/Isc exceeding that model's rated limits and array wattage exceeding nominal PV rating at the selected battery voltage. When several are selected, **do not assume the full array feeds each**; explicitly defer array/string allocation to wiring design.
- **Shore:** choose a single 230 V charger (Victron Blue Smart IP22 at 12/30 or 24/16) or a MultiPlus inverter/charger at 12 V or 24 V. Combined models supply a stable **future inverter selection prefill**, derived from the chosen `shoreModelId`; plain chargers do not imply an inverter. No 230 V load assignments or shore-availability runtime assumptions are made.
- Manufacturer technical sources:
  - Victron Orion XS 12/12-50: https://www.victronenergy.com/media/pg/Orion_XS_12-12-50A_DC-DC_battery_charger/en/technical-data.html
  - Victron Orion-Tr Smart input/output variants: https://www.victronenergy.com/media/pg/Orion-Tr_Smart_DC-DC_Charger_-_Non-Isolated/en/specifications--non-isolated-.html
  - Victron SmartSolar 100/30 and 100/50: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html
  - Victron SmartSolar 150/35 and 150/45: https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-35__150-45/en/technical-specifications.html
  - Renogy EU Rover Li 40A: https://eu.renogy.com/products/rover-li-40-amp-mppt-solar-charge-controller
  - Renogy EU 12 V 40 A DC–DC: https://eu.renogy.com/products/12v-40a-dc-to-dc-battery-charger
  - Victron 230 V Blue Smart IP22: https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html
  - Victron 230 V MultiPlus 12/500, 12/800, 24/800, 24/1200: https://www.victronenergy.com/upload/documents/Manual-MultiPlus-500VA-1200VA-EN-NL-FR-DE-ES-IT.pdf
- Voltage mismatches are persistent **non-blocking warnings**. Structural impossibilities and invalid numeric fields still block Update and Export. No recharging energy is added to the simple battery runtime estimate yet; later work will model time spent driving, sunshine/daylight, inverter losses and actual charging efficiency.

## Battery Selection
- Three single-battery options are sourced from WattCycle Europe specifications:
  - **12.8 V, 280 Ah Mini Bluetooth:** nominal 3,584 Wh, 200 A BMS; weight 27 kg; 384 × 194 × 248 mm. [EU Mini series comparison](https://eu.wattcycle.com/pages/12v-280ah-series-lifepo4-battery-comparison).
  - **12.8 V, 628 Ah Ultra Bluetooth:** nominal 8,038.4 Wh, 300 A BMS; 59.81 kg; 480 × 362 × 242 mm. [EU 12V 628Ah product](https://eu.wattcycle.com/products/12v-628ah-lithium-battery-with-bluetooth).
  - **25.6 V, 314 Ah Ultra Bluetooth:** nominal 8,038.4 Wh, 300 A BMS; 69.85 kg; 480 × 362 × 242 mm. [EU 24V 314Ah product](https://eu.wattcycle.com/products/24v-314ah-lifepo4-battery-with-bluetooth). This product was listed out of stock in November 2026; availability is not an installation constraint for this simulation.
- Battery choices appear only after clicking **Select a battery** or **Change battery**. A searchable list supports voltage filtering instead of a permanent row of cards. **One selected model** per project, saved as `batteryId` (or null for no selection). Selection is a capacity comparison, not a claim that existing electrical hardware supports the option.
- Simple no-recharge runtime: **days = nominal battery energy × 0.90 / estimated daily load Wh**. The fixed 10% reserve is a planning assumption, not the BMS cutoff. Empty/zero daily energy displays no runtime; incomplete loads mark totals provisional.
- On 12 V battery selection, flag all **24 V DC loads**; on 24 V selection, flag all **12 V DC loads**. Do not silently convert voltages or infer actual electrical connections. 230 V loads remain in total Wh without modelling their inverter, and the display discloses omitted conversion losses.
- Runtime is indicative and assumes a healthy full battery, constant day of usage, no charging and ideal conversion. It omits inverter/DC-DC losses, idle draws not entered as loads, discharge derating, temperature, aging, and existing battery health issues.
- The 2D wiring editor is **not added** in this iteration. Its future validation must consume the same circuit/device voltage issues and flag provisional diagrams; topology, converter and distribution validation are deliberately deferred.

## Saved data and previous seasonal design
- Current data schema is v5, stored under `vandy-load-planner-v5`, exported as standalone JSON with battery and charging selections. Browser data under previous v1/v2/v3/v4 keys remains untouched; opening it stages migration for review. A migrated v4 keeps its selected battery, and charging defaults to no devices or panel rating. Older planners have no battery pre-selected.
- Legacy v1 seasonal planners convert **Summer** usage into a typical day; their full seasonal record is preserved as `legacySeasonal`.
- Legacy v2 circuits lose their obsolete `control` property on import. If an old circuit was configured as 6-gang remote-controlled, its physical switch is conservatively set **unchecked** so the calculator does not introduce a physical switch that was formerly disabled. Direct circuits keep their tick setting. Users should review migrated switches before saving.
- The previous seasonal UI, cycle counts, profiles and startup/shutdown fields are not shown or used for calculation. This is deliberate scope control, not a conclusion that these states are technically irrelevant.

## Engineering limitations
- The CR65X model matches an Alpicool manufacturer's 60 W *rated power*; older project text said Vitrifrigo. The device entry is intentionally called "CR65X fridge" pending a label check. **21 W typical average is an estimated 35% duty at 60 W**, not a verified average.
- The reported VEVOR XMZ-F-D1 12 V / 40 W family rating is provisional average in the simple UI; the actual consumption may vary with speed, startup and shutdown.
- The Cerbo GX default of 2.8 W at 12 V (without GX Touch) is manufacturer-specified. A MaxxFan Deluxe current chart indicates 0.70 A at 50% speed; the van's variant is unverified.
- The Starlink estimate of 85 W is suitable for a newer Standard 4/4X but depends on model and load. The laptop charger's 80 W nameplate rating is not a normal average.
- All other catalogue values explicitly say when estimated. The future 6-gang remote controller may have standby/parasitic consumption, which can be added as a load later if measured.
- The physical-switch checkbox is only a future topology hint: no actual wire, channel, fuse, remote-control assignment or switch rating is produced here.

## Validation expectations
Run `npm run check` and `npx tsc -p tsconfig.domain.json` in Codespaces. Tests verify defaults, generic LED lights, circuit reassignment without voltage rewriting, nonblocking voltage mismatch validation, mixed-voltage Wh/Ah, batteries and no-charge runtime, generic panels, MPPT and DC–DC compatibility warnings, inverter prefill, and v1–v4 migrations. Do not merge to main as part of this iteration.
