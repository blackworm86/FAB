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

## Status
- **M1 done** (hot-seat 3D demo: setup, movement, combat, supply).
- **M2 built** (engine + UI): chit boxes and selection cup, Turn Track draws, all 9 phases, assets in combat (artillery limits, echelon/zone rules), engineers (blow/repair bridges, field works), replacement/rebuild/regiment events, release events, Special Actions (rally, quality replacement, reinforce/retreat in battle, breakthrough activation), command staff, reserves, strategic/reaction/breakthrough movement, bridge-blow attempts, river assaults, fuel rule and captured fuel, task forces, German artillery attrition, VP and sudden death, Tournament and Campaign lengths.
- **M3 done in the engine and UI:** Greif Team Bridge and Interdict, Operation Bodenplatte, von der Heydte's paradrop, unit-built field works, roadblock markers (4.34), defended roadblocks (4.35, engineer becomes a garrison asset with one same-echelon artillery), Boundary Crossing Pre-authorized (14.62a), Pooled Assets (14.62b), Intelligence Gathering (8.32, reveal is logged and marked until hidden blocks exist), Interdiction and Air Supply missions (17.2), Reroute reinforcement (8.27), optional rules 18.5 (airborne supply) and 18.6 (advanced artillery) as toggles in the menu. 34 engine tests.
- **Still to do:** the introductory scenario (needs its map sheet's area list and chit set), the other optional rules (18.1 bridge limits, 18.2 fuel bidding, 18.3, 18.4, 18.7 overrun, 18.8 maintain field works, 18.9 random reinforcements), player-chosen retreat/entry areas (still automatic), hidden blocks (with M4 online play).

## Still missing from the sources
- Getting Started Card (starting Available Box / cup contents) – demo will start from the scenario tables only.
- Turn track numbers (chit draws, sudden-death levels) – read from the map; confirm.
- Bodenplatte: Player Aid D says 1-5 unaffected, 6-9 delayed, 10 eliminated; the play book (17.14) says the reverse. Player Aid D used until told otherwise.

## Rules review (open items)
Found by comparing the printed rules with the engine; fixed: 6.43 loss spreading across volleys, 8.24 no disorder for a retreat before combat, 5.21 reserve marker dropped when the area becomes contested, 5.2 a unit that moved cannot be marked, 5.23 field works belong to their builder and go when no friendly unit is left, 9.5 defended roadblocks of both sides removed, 15.3 turn-4 arrivals may break stacking at entry Z.
Also fixed: 4.1c/14.2 delayed and rerouted units use their army's appropriate entry areas, 14.52 a surviving engineer may bridge in a dead army's zone, 16.11 von der Heydte costs the first mover +1 MP.
Closed: 6.41a (the attacker now chooses between the point unit and an assigned battle asset for the first hit) and 14.43 (British blocks are limited to areas 57, 58, 78, 79, 92-96, the areas on the northwest side of the Meuse in the hand-drawn map; confirm that list).
