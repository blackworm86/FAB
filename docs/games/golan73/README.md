# Fast Action Battles: Golan '73 (Vol. 3)

Yom Kippur War, October 1973. Source material for building this game; same workflow as The Bulge.

## What to upload

| Folder | Put here |
|---|---|
| `rules/` | Rulebooks (PDF or EPUB): the exclusive Play Book of this game. The Series Rules are shared and already in `docs/rules/`; add them here only if this game ships a different edition. |
| `maps/` | The game map: a straight, flat, high-resolution scan or photo (300 dpi or more if possible, whole map in one image, no perspective). Add scenario maps or map inserts too. |
| `counters/` | Unit stickers (block labels) and counter sheets, front and back. Flat scans, one image per sheet is fine. |
| `player-aids/` | Player aids and charts (sequence of play, combat table, terrain effects, event summary...). |
| `scenarios/` | Scenario sheets and any bonus scenarios, if they are separate from the Play Book. |
| `other/` | Anything else useful: errata, FAQ, set-up photos, reinforcement cards. |

File names can be anything; keep the original names if you have them.

## How to upload

- **GitHub website:** open this folder on github.com (branch `main`), then *Add file → Upload files*, drop the files into the right subfolder and commit.
- **Or in the chat:** attach the files and say which game they are for; Claude puts them here.

Large files are fine (scans of 20–50 MB). Photos taken with a phone work, but flat scans give much better drafts.

## What happens next

From these sources Claude prepares, for your review:

1. **Map draft:** area outlines, numbers, names, terrain and TDN, connections (roads, rivers, bridges), zones, entry areas, VP areas, as data (`data/<game>/map.json`) and as a redrawn vector map.
2. **Units and assets draft:** every block and chit as data (`data/<game>/units.json`, `counters.json`) with redrawn vector art, plus the set-up and reinforcement schedule.
3. **Rules:** the exclusive rules of this game in the engine, tested like The Bulge.

You then review the drafts (as with the counter check page) and provide better graphics where needed.
