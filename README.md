# Project Vandy — Load Calculator

A focused **typical-day** electrical load calculator. Only Home and Load Calculator are in the menu.

Start with an empty project; add named circuits and loads from the reference catalogue (or a custom load). Every new appliance gets an editable power and daily usage estimate, including LED strip length where relevant. Manufacturer-confirmed ratings and rough assumptions are differentiated in the appliance's Technical basis section.

Each circuit has a **Physical on/off switch** checkbox and a Direct / 6-gang remote control setting. The physical switch only applies to directly controlled circuits; selecting the remote suppresses its effect in future wiring output. Switches are not entered as power-consuming devices.

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
