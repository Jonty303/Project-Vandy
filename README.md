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

Distribution changes are staged until **Update**. Structural failures (occupied fuse slots, cycles, dangling IDs) block saving; incomplete/unassigned paths and voltage incompatibilities remain review warnings. **v8 JSON** imports older v1–v7 projects without adding any distribution equipment. The six-way remote remains deferred.

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


### Lynx charge-output slots
The **Lynx Distributor's four fused positions are shared** by inverter or downstream distributor feeds, MPPT outputs and DC–DC charger outputs. Selecting Lynx as the destination automatically assigns the next available position; a full Lynx cannot receive another new charger link until a position is freed. Change or remove a charger position from the device list or Charging outputs table. Saved v7 setups migrate existing charger-to-Lynx links into unused slots without deleting the equipment; oversubscribed links remain visible and marked for review.


**Battery-side DC equipment**: Distribution now lists the selected combined inverter/charger or standalone inverter alongside DC–DC, MPPT and standalone shore charger outputs. Every item can be logically associated with battery, Lynx or suitable busbar. A MultiPlus has exactly one bidirectional DC association and one Lynx position, not a second charger-output entry; the same 230 V inverter choice remains selected. A shore-only Blue Smart IP22 has a DC charging-output entry, but no inverter output. Changes use the existing v8 JSON schema.

## Socket and shore-inlet amendment (separate branch)

On `feature/socket-distribution`, the Load Calculator's named circuits can contain **USB charging sockets** (one/two USB ports for 12/24 V) or **UK 3-pin sockets** (single/double on 230 V). Sockets are **connection points**, not extra consumption; associate actual phone/tablet/laptop/Starlink loads to their outlets without double counting Wh. USB socket records include optional manufacturer **total and per-port maximum output W**, **maximum per-port output A**, **12/24 V-side maximum input A or W**, and supported USB output voltage/PD modes. Missing ratings remain unknown; inferred input A using a 90%-efficiency assumption is explicitly an estimate, **not yet suitable for fuse/cable sizing**.

Distribution → 230 V now derives separate **shore-input** and **inverter-output consumer-unit roles** where applicable, and allows a named **external shore-power inlet** connection point. Inverter-backed outlet circuits need an actual inverter selection before they can be considered powered. Physical AC protection and source changeover are deferred. The new v9 storage format imports v1–v8 projects.

See [socket/shore amendment details](docs/SOCKET_DISTRIBUTION.md).

To test in Codespaces:
```sh
git switch feature/socket-distribution
git pull --ff-only
npm run dev
```
