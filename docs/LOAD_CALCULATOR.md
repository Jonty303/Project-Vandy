# Focused load calculator — typical daily usage

This branch deliberately exposes **Home** and **Load Calculator** only. Projects start empty; the catalogue is a menu of optional loads, not a pre-populated project.

## This iteration
- Add a named circuit (12, 24 or 230 V) and assign loads to it. Loads without a circuit retain their own voltage.
- **Physical on/off switch** is a boolean property of a *circuit*, never a separate power-consuming load or a specified switch product. Its default is unchecked.
- A circuit can be **Direct circuit** (default) or **6-gang remote** controlled. With the remote selected, the physical-switch checkbox is disabled and the physical-switch flag is **ignored** in future output. The stored checkbox preference may be restored if the circuit is changed back to direct. No remote channel mapping, polarity or actual wiring is inferred.
- Adding a reference device creates a populated, editable **average electrical input** (W or A), typical hours per day, and quantity. LED strips additionally use estimated length and average power per metre; other devices never show length.
- Fridges use average electrical power across a normal 24-hour day (compressor duty already incorporated). Diesel heaters use a simple representative average while operating, with startup/shutdown transients excluded from *energy* modelling at this stage, not declared safe for sizing cables or protection.
- All supplied power/time defaults are planning inputs, not installation facts. The disclosure under **Technical basis & notes** explains whether a default comes from a manufacturer source, a reported rating, or an explicit estimate. Manufacturers' peak/nameplate ratings must not be presented as measured averages.
- Daily Wh = average W × daily operating hours × quantity; for LED strips average W = W/m × metres. Average A = average W / voltage. Daily Ah is Wh / voltage. 230 V equivalents are nominal W/230 without power factor correction; never assume they are actual AC apparent currents.
- Sum Wh across voltages, but not Ah. Unknown figures produce a partial total; blank is not zero. No battery demand, inverter/converter losses, charge modelling, wiring, protection or certification yet.
- Edit, Reset, Update, local browser storage, JSON import/export remain in this focused feature. Changing a circuit's voltage changes its load voltages to match.

## Saved data and previous seasonal design
- Current data schema is v2, stored under `vandy-load-planner-v2` and exported as a standalone JSON planner. Previous v1 browser data is left intact.
- If a v1 seasonal planner exists, the current import converts its **Summer** settings to a single typical day as a **reviewable migration**; the original per-season load record is preserved as `legacySeasonal` for future migration work.
- The previous seasonal UI, cycle counts, profiles and startup/shutdown fields are not shown or used for calculation. This is deliberate scope control, not a conclusion that these states are technically irrelevant.

## Engineering limitations
- The CR65X model matches an Alpicool manufacturer's 60 W *rated power*; older project text said Vitrifrigo. The device entry is intentionally called "CR65X fridge" pending a label check. **21 W typical average is an estimated 35% duty at 60 W**, not a verified average.
- The reported VEVOR XMZ-F-D1 12 V / 40 W family rating is provisional average in the simple UI; the actual consumption may vary with speed, startup and shutdown.
- The Cerbo GX default of 2.8 W at 12 V (without GX Touch) is manufacturer-specified. A MaxxFan Deluxe current chart indicates 0.70 A at 50% speed; the van's variant is unverified.
- The Starlink estimate of 85 W is suitable for a newer Standard 4/4X but depends on model and load. The laptop charger's 80 W nameplate rating is not a normal average.
- All other catalogue values explicitly say when estimated; 6-gang remote switch *control* is distinct from its own standby/parasitic electrical consumption, which can be added as a load later if measured.
- Direct control and six-gang remote are currently abstract control assignments. They produce no actual wire, channel, fuse or switch rating; such checks belong to later schematic and validation iterations.

## Validation expectations
Run `npm run check` and `npx tsc -p tsconfig.domain.json` in Codespaces. Tests verify defaults, load conversion, LED lengths, separate mixed-voltage Ah, unknowns, physical-switch suppression, structural validation and legacy migration. Do not merge to main as part of this iteration.
