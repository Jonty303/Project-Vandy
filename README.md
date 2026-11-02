# Project Vandy — Electrical Planning & Off-grid Rating

A focused **typical-day** load calculator and battery endurance comparison. The menu now includes **Home**, **Load Calculator**, **Battery Selection**, **Charging**, **Off-grid rating** and **Distribution**.

Start with an empty project and the built-in **Ungrouped loads** container. Add named circuits and loads from the reference catalogue (or a custom load). The **Add load** panel offers just one generic **LED lights** preset, instead of multiple named lighting presets. Add it repeatedly and name/length/assign each instance as needed. Every new appliance starts ungrouped and gets an editable power and daily usage estimate, including LED strip length where relevant. Manufacturer-confirmed ratings and rough assumptions are differentiated in the Technical basis section.

Under **Load Calculator**, use the **Loads** and **Circuits** tabs. Each has a compact list above the selected load/circuit details editor. Click anywhere on a row to select it. In Loads, drag a load row onto another circuit group (including an empty group), or onto **Ungrouped loads**, to change its assignment. A load moved into a named circuit **keeps its voltage**; a voltage mismatch is flagged but can be saved. The load editor's Circuit dropdown is an alternative for touch/keyboard use. Ungrouped loads is always shown, even when empty; it has no fixed voltage or switch. Named circuits retain a **Physical on/off switch** checkbox, but there is no control-assignment field. Remote-controller assignment belongs to a future wiring workflow. Deleting a named circuit moves its loads to Ungrouped instead of deleting them.

Battery Selection opens a searchable, voltage-filtered catalogue only after **Select a battery** or **Change battery** is pressed. It offers three EU WattCycle LiFePO₄ planning options: 12V 280Ah Mini, 12V 628Ah Ultra, and 24V 314Ah Ultra. It calculates simple no-charge runtime as 90% of nominal battery Wh divided by daily load Wh. A 12V battery flags 24V DC loads, and vice versa; connection modelling is deferred. Inverter losses and other electrical inefficiencies are excluded; the result is indicative only.

**Charging** has three tabs: DC–DC (select multiple Victron Orion/Renogy units and estimate spare alternator amps, default 30 A); Solar (one generic panel specification with editable W, quantity, series/parallel, Voc and Isc, plus one or more Victron/Renogy MPPTs); Shore power (single Victron IP22 charger or MultiPlus inverter/charger in 12/24V). Selecting a MultiPlus records a future inverter prefill but doesn't wire or assign any AC loads. Manufacturer specifications and nonblocking voltage/array warnings are included. Charging is **configuration-only**: battery runtime does not yet add solar, driving or shore charging.

The **Solar** charging tab now offers a searchable selection of model-specific Renogy 100/200/320/400 W panels, or a Custom panel prefilled with estimated 400 W, Voc 40 V and Isc 13 A. Orion XS lets you plan distinct input and output current limits, and Shore Power records an editable shore supply limit.

**Off-grid rating** compares monthly stationary versus daily-driving battery autonomy using PVGIS 5.3 historical long-term solar production for a UK five-site reference average, searchable UK regions or user-approved browser geolocation. Click months to inspect the demand, solar/day, drive charging/day, net battery depletion and a 14-day SoC projection. Conversion assumptions (230 V inverter, 12/24 V DC) are shown and applied. A balanced month does **not** mean guaranteed unlimited autonomy. PVGIS results depend on the **Vite development-only server** at `/api/pvgis/monthly`; a static production hosting target requires a separate API backend.

**Distribution** has 12 V DC, 24 V DC and 230 V AC tabs. The 24 V tab remains disabled unless a 24 V battery has been chosen. Add any number of Lynx Distributor modules (four numbered fused branches), Blue Sea ST Blade 5026 fuse blocks (twelve numbered fuse positions) or generic paired positive/negative busbars. Assign named circuits as a group, or assign ungrouped loads individually. Reuse the selected MPPT and DC–DC charger IDs as charging sources without introducing duplicate appliances. Feed each Blue Sea block logically from the planned battery, Lynx or busbar. Generic busbar details estimate the minimum number of connections needed **per polarity** from the upstream feed, downstream branches and charging outputs; this is not a cable/terminal schedule.

The 230 V distribution tab proposes the existing selected MultiPlus inverter/charger if present, otherwise allows a standalone 12 V or 24 V Victron Phoenix 500 VA inverter. A shore-only charger is not an inverter. Logical inverter assignments have no real 230 V consumer units, transfer switches or earth/neutral wiring at this stage.

Distribution changes are staged until **Update**. Structural failures (occupied fuse slots, cycles, dangling IDs) block saving; incomplete/unassigned paths and voltage incompatibilities remain review warnings. **v7 JSON** imports older v1–v6 projects without adding any distribution equipment. The six-way remote remains deferred.

Seasonal profiles are intentionally hidden for this iteration. Previous v1 seasonal data is migrated to one typical day using its Summer profile; the original is preserved for a possible later reintroduction.

Requires Node 22.16 or newer. In Codespaces:

```sh
git switch feature/load-calculator
npm install
npm run check
npm run dev -- --host 0.0.0.0
```

Open the forwarded Vite port (normally 5173). Use **Update** to save to browser storage and **Export JSON** for a backup. Battery Selection retains a no-charge load-side runtime, while Off-grid rating models conversion losses and estimated solar/driving contributions. Shore is excluded.

For formulas, safety assumptions, default sources and migration details see [the focused calculator contract](docs/LOAD_CALCULATOR.md).
