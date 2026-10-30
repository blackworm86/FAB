# FAB: The Bulge – app plan

## Goal of the first demo (playable ASAP)
Hot-seat, one browser, Tournament scenario turn 1–2 playable end to end with the core loop:
setup → move → combat → supply → next player. No AI, no network, no hidden blocks yet.

## Stack
- `engine/` – TypeScript rules, pure functions over a `GameState` + an action log (undo, replay, seeded dice). Vitest.
- `web/` – Vite + React + three.js (react-three-fiber/drei) board; Zustand for UI state. Map image as board texture, area polygons from `map.json` for picking.
- Later: same engine on a small server (Cloudflare Durable Objects / PartyKit) for online play with hidden information.

## Milestones
**M1 – Demo (target: first playable)**
1. GameState + scenario setup from the scenario tables (units, garrisons, field works, blown bridges, control).
2. Board view: 3D map, blocks as standing wooden blocks, counters, camera; click area → stack panel.
3. Operational movement with the movement aid (highlight reachable areas, cost, fuel warning), stacking check.
4. Combat round: point units, artillery + ground fire with auto-rolled dice, success-% calculator before rolling, hit priorities as guided choices (abort / retreat / step loss), retreat, exploitation check.
5. Supply phase: control, supply tracing, disorder/recovery, unsupplied morale checks, marker cleanup.
6. Phase bar driving the turn sequence (Player Aid A/B), event log.

**M2 – Full turn**
Reinforcement & admin phases: selection cups, chit draws per turn track, events, engineers (bridges, field works, roadblocks), Special Actions & staff functions, reserves, strategic move, reaction/breakthrough, VP and sudden death.

**M3 – Polish & rules completeness**
Bulge exclusive rules (fuel, German artillery attrition, von der Heydte, Greif teams, air missions, garrisons/task forces, British limits), optional rules as toggles, all three scenarios, save/load, undo.

**M4 – Online & AI**
Server-authoritative online play with hidden blocks, then a simple AI opponent built on the legal-move generator.

## Still missing from the sources
- Getting Started Card (starting Available Box / cup contents) – demo will start from the scenario tables only.
- Turn track numbers (chit draws, sudden-death levels) – read from the map; confirm.
- Bodenplatte: Player Aid D says 1-5 unaffected, 6-9 delayed, 10 eliminated; the play book (17.14) says the reverse. Player Aid D used until told otherwise.
