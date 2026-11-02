# Project Vandy — Load Calculator

A focused **typical-day** electrical load calculator. Only Home and Load Calculator are in the menu.

Start with an empty project and the built-in **Ungrouped loads** container. Add named circuits and loads from the reference catalogue (or a custom load). The **Add load** panel offers just one generic **LED lights** preset, instead of multiple named lighting presets. Add it repeatedly and name/length/assign each instance as needed. Every new appliance starts ungrouped and gets an editable power and daily usage estimate, including LED strip length where relevant. Manufacturer-confirmed ratings and rough assumptions are differentiated in the Technical basis section.

Under **Load Calculator**, use the **Loads** and **Circuits** tabs. Each has a compact list above the selected load/circuit details editor. Click anywhere on a row to select it. In Loads, drag a load row onto another circuit group (including an empty group), or onto **Ungrouped loads**, to change its assignment. A load moved into a named circuit adopts its voltage. The load editor's Circuit dropdown is an alternative for touch/keyboard use. Ungrouped loads is always shown, even when empty; it has no fixed voltage or switch. Named circuits retain a **Physical on/off switch** checkbox, but there is no control-assignment field. Remote-controller assignment belongs to a future wiring workflow. Deleting a named circuit moves its loads to Ungrouped instead of deleting them.

Seasonal profiles are intentionally hidden for this iteration. Previous v1 seasonal data is migrated to one typical day using its Summer profile; the original is preserved for a possible later reintroduction.

Requires Node 22.16 or newer. In Codespaces:

```sh
git switch feature/load-calculator
npm install
npm run check
npm run dev -- --host 0.0.0.0
```

Open the forwarded Vite port (normally 5173). Use **Update** to save to browser storage and **Export JSON** for a backup. This remains load-side energy only, before battery/inverter losses.

For formulas, safety assumptions, default sources and migration details see [the focused calculator contract](docs/LOAD_CALCULATOR.md).
