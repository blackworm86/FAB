# FAB – Fast Action Battles (online)

Browser version of the tabletop wargame series **FAB – Fast Action Battles**.
Volumes: 1) *The Bulge* (playable), 2) *Sicily* (planned), 3) *Golan '73* (playable). One rules engine and one interface serve them all (docs/design/one-engine.md).

## Source material (add here)

| Folder | Contents |
|---|---|
| `docs/rules/` | Rulebooks, scenario books, errata (PDF) |
| `docs/player-aids/` | Player aids, charts, tables, counter sheets |
| `docs/maps/` | Map scans / images |
| `docs/game-pieces/` | Counters, tokens, cards, dice, unit art |

Claude reads these to learn the rules. Prefer one folder per game (e.g. `docs/rules/the-bulge/`) once more than one game is present.

## Tooling

[Ponytail](.claude/ponytail) is vendored in `.claude/` (skills: `ponytail`, `-audit`, `-review`, `-debt`, `-gain`, `-help`; hooks wired in `.claude/settings.json`). Requires Node.

## Status

Project objectives: pending.
