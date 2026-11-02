# Focused load calculator

This branch intentionally replaces the broad application navigation with Home and Load Calculator. It starts empty and retains prior domain modules and regression tests, but does not expose battery, charging, topology or wiring screens. This user request supersedes the wider iteration implementation scope in AGENTS.md for this branch.

## Behaviour
- Create, name and delete circuits; deletion ungroups their loads without deleting appliances. Circuit voltage is 12, 24 or 230V and is inherited by members.
- Add reference-named appliances from Vandy's inventory or a custom load. All numeric ratings start unknown; catalogue names do not assert a verified model specification.
- Each load has its own name, quantity, rating in W or A, notes/source and circuit assignment. Ungrouped appliances can select their own voltage.
- LED strips: length, W/m or A/m and typical brightness.
- Fridges: compressor running rating with seasonal duty, or averaged input without applying duty again.
- Diesel heaters: electrical running input plus per-cycle startup and shutdown power/duration. Seasonal running hours exclude startup/shutdown durations; cycles describe complete start/stop pairs.
- Four independent seasons each hold hours/day, fridge duty and heater cycles/day. No climate or automatic seasonal assumptions. Copy to all seasons is an explicit confirmed operation.
- Power ratings and LED length/brightness are shared between seasons. Usage is editable by season, including zero for an unused appliance.
- Daily energy = power × hours × quantity, with applicable duty or dimming. Heater transition energy is added per cycle. Ah/day = load-side Wh/day ÷ load voltage. Never sum Ah across voltages. 230V current is a nominal W/V equivalent at unity power factor, not apparent current.
- Unknown inputs produce unknown load results and partial totals. Blank fields remain null. Zero is explicit. Heater running plus transition time may not exceed 24 hours.
- Update saves staged changes; Reset restores the last saved planner. Navigation between the two pages retains edits; browser unload warns while dirty. Invalid negative/impossible values block Update, with explanations. Unknown fields can be saved.
- Separate `vandy-load-planner-v1` local storage protects prior full-project data. JSON import/export uses the standalone schema, validates structure/ranges/references and stages imports for review. Older full-system exports are not silently converted.

## Scope
Load-side daily demand only. No battery Ah, inverter/converter losses, power topology, circuit protection or runtime predictions. These are the next flow; a mixed-voltage load total is not battery demand. Gas/diesel fuel energy is excluded; enter electrical input only.

## Validation
Run `npm run check` and `npx tsc -p tsconfig.domain.json`. Tests cover seasonal independence, mixed voltages, unknowns, unit conversion, LED length/brightness, fridge duty, heater cycles/transients, bounds and JSON validation.
