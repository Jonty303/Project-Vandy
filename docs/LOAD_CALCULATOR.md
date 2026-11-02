# Focused load calculator — typical daily usage

This branch deliberately exposes **Home** and **Load Calculator** only. Projects start empty; the catalogue is a menu of optional loads, not a pre-populated project.

## This iteration
- The calculator has **Loads** and **Circuits** tabs. Each tab shows a compact, scrollable table on top; selecting a row opens its edit/details panel below the table.
- **Ungrouped loads** always appears first, including when empty. It is a built-in default virtual container, not a persisted physical circuit. New loads start here, have independent voltages, and can later be assigned to named circuits. Deleting a named circuit returns its loads to Ungrouped.
- The Loads tab groups rows by Ungrouped and named circuits. **Drag a load row** onto any part of another group's rows or its heading to reassign it. Empty groups accept drops. Drag onto Ungrouped to remove a circuit assignment. The destination circuit's voltage is applied automatically; when returning to Ungrouped the load keeps that voltage. Drop movement is staged and saved by Update; it does not create wiring. The existing Circuit dropdown in the load editor provides a non-drag alternative.
- Clicking **any cell in a load or circuit table row** (or pressing Enter/Space on a focused row) selects it. Clicking a group heading from Loads opens that circuit in the Circuits tab.
- The Circuits tab lists the Ungrouped container followed by named circuits with load counts, voltage, switch presence and Wh/day.
- A named circuit has an editable name, a 12/24/230 V supply and a **Physical on/off switch** checkbox (default unchecked). The circuit editor shows its assigned loads and Wh/day; links open an appliance in the Loads tab.
- **No "Controlled by" selector** or 6-gang remote assignment is exposed or stored in this planner schema. Selection of physical versus remote control will be part of the later wiring workflow. No controller wiring or channel mapping is inferred.
- The **Add load** catalogue exposes a single **LED lights** preset rather than separate floor, kitchen, toilet, main, outside and garage lighting choices. Add as many instances as needed, rename them, set their strip lengths and usage individually, and group them into circuits. Existing previously saved named lighting loads are preserved exactly. Default is an explicitly estimated 5 W/m, 1 metre, 3 hours/day.
- Adding a reference device creates a populated, editable **average electrical input** (W or A), typical hours per day, and quantity. LED strips additionally use estimated length and average power per metre; other devices never show length.
- Fridges use average electrical power across a normal 24-hour day (compressor duty already incorporated). Diesel heaters use a simple representative average while operating, with startup/shutdown transients excluded from *energy* modelling at this stage, not declared safe for sizing cables or protection.
- All supplied power/time defaults are planning inputs, not installation facts. The disclosure under **Technical basis & notes** explains whether a default comes from a manufacturer source, a reported rating, or an explicit estimate. Manufacturers' peak/nameplate ratings must not be presented as measured averages.
- Daily Wh = average W × daily operating hours × quantity; for LED strips average W = W/m × metres. Average A = average W / voltage. Daily Ah is Wh / voltage. 230 V equivalents are nominal W/230 without power factor correction; never assume they are actual AC apparent currents.
- Sum Wh across voltages, but not Ah. Unknown figures produce a partial total; blank is not zero. No battery demand, inverter/converter losses, charge modelling, wiring, protection or certification yet.
- Edit, Reset, Update, local browser storage, JSON import/export remain in this focused feature. Changing a circuit's voltage changes its load voltages to match.

## Saved data and previous seasonal design
- Current data schema is v3, stored under `vandy-load-planner-v3`, exported as standalone JSON. Browser data under previous v1 and v2 keys remains untouched; opening it stages migration for review.
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
Run `npm run check` and `npx tsc -p tsconfig.domain.json` in Codespaces. Tests verify defaults, generic LED lights template, circuit reassignment and no-op drops, load conversion, LED lengths, separate mixed-voltage Ah, unknowns, implicit Ungrouped behaviour, circuit-level physical switches, structural validation and v1/v2 migration. Do not merge to main as part of this iteration.
