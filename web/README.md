# FAB web demo

One page runs every volume: `?game=golan73` opens Golan '73 (default: The Bulge); the home page chooses. `?dev=1&game=golan73` is a local two-seat table; `golan-sheet.html` shows the Golan pieces (dev only).

The 3D board and interface. `npm install && npm run dev` (copies the map and block labels into `public/`).
`npm run build && python3 scripts/artifact.py` produces `dist/page.html` + a files map for publishing.
