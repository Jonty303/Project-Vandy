# Project Vandy — Load Calculator

Focused workspace for daily electrical demand, with Home and Load Calculator navigation only. Add named circuits and appliances, then enter electrical ratings and seasonal usage. Initial projects are empty.

Requires Node 22.16 or newer.

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Open the forwarded Vite port (normally 5173) in Codespaces. Use Update to save in this browser and Export JSON for backups.

```sh
npm run check
npx tsc -p tsconfig.domain.json
```

See [the focused calculation contract](docs/LOAD_CALCULATOR.md) for formulas, assumptions and scope. Battery runtime is the next step.
