# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing codebase: TypeScript, Vite, three.js for the 3D board, a pure-TypeScript rules engine (`engine/`, tested with Vitest) and an HTML overlay UI (`web/`).

## Users
Players of the GMT Games tabletop series Fast Action Battles, both experienced owners of The Bulge and newcomers learning the rules through play. They play hot-seat on desktop or tablet today, and online against each other later. Phones should remain usable.

## Product Purpose
An online version of FAB (Fast Action Battles), starting with Vol. 1 The Bulge: a 3D virtual tabletop with the full rules enforced, automatic setup, and less bookkeeping (dice autoroll, attack success percentages, movement preview with fuel cost). Success is a faithful game that plays faster than the physical one without losing its tension.

## Positioning
A rules-complete 3D tabletop where the engine explains every number: each Success Number is shown with its modifiers, each move with its cost, each asset assignment with the rule that allows or forbids it.

## Operating Context
Turns follow the printed sequence (reinforcement, admin, movement, strategic movement, combat, reaction, breakthrough, supply). Chits move between cup, Available, Used and Eliminated boxes. Combat is resolved with d10 rolls against a Success Number. The Germans track fuel. Sources are the play book, series rules, player aids A to E and the scenario sheets in `docs/`.

## Capabilities and Constraints
- Engine implements M1 to M3 (see `docs/PLAN.md`): all nine phases, assets, events, fuel, supply, roadblocks, interdiction, air supply, reroute, optional rules 18.5 and 18.6.
- Open: the introductory scenario, other optional rules, player-chosen retreat and entry areas, hidden blocks, online server-authoritative play and an AI opponent (M4).
- Physical fidelity: blocks are 16 x 16 x 8 mm, the map is 22 x 34 in, world unit 1 cm.
- All stickers, chits and block labels are redrawn as vector graphics; scans are not shown on pieces.
- Terminology follows the rules: area, block, Higher Echelon, Special Action, Success Number, TDN, field works, point unit.

## Brand Commitments
Personal fan project, not for sale. No GMT logos or scanned artwork are redistributed. The interface currently uses a dark olive and brass "war room" look chosen by the user from three options (Option C); that choice is recorded by `document`/new-work, not here.

## Evidence on Hand
Rulebooks, player aids and scenario sheets in `docs/`; map and piece data in `data/bulge/`; a mockup comparison at `docs/design/ui-options.html`. There are no testimonials, user numbers or published reviews; none may be invented.

## Product Principles
- The rules engine is the authority; the interface only explains and confirms.
- Show the number and the reason together.
- Act on the board first: select a block or an area, not a menu.
- Skip steps with nothing to do, never hide a decision that belongs to a player.
- Stay true to the physical game's proportions and vocabulary.

## Accessibility & Inclusion
Playable with mouse, keyboard and touch. Visible focus, labelled icon buttons, reduced-motion respected, readable contrast on the dark theme.
