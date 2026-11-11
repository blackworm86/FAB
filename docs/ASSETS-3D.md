# Real 3D models for the blocks (plan)

Goal: replace the generic wooden 3D blocks with models of the real troops and vehicles each block stands for. The tool that makes them is the **pieces kit** in `tools/pezzi3d/` (the owner's Briano Borromeo kit, adapted). This page is the plan: what exists, the rules for a piece, how it would go into the game, and what the owner still has to decide. **Nothing is wired into the game yet.**

## 1. The tool (done)

A local panel in the browser (Italian, like the original). The **Produzione** tab runs the whole line in series: generate the concepts for every piece, pick the best of each in one gallery, then one button makes the front view, the 3D model and the clean-up for every chosen piece, skipping what is done; it can be stopped and resumed. Per piece (Pezzi tab, for redoing one): 2D concept (Gemini) → front/side/back views → 3D model (TRELLIS on the owner's PC, or Meshy) → automatic clean-up (pose, size to the block footprint, side-coloured base, texture shrunk to 512 px; the shape is never reduced, because reducing a textured model tears its texture seams) → preview next to the real block → copy into the game folder.

- Start it: `tools/pezzi3d/AVVIA_PANNELLO.bat` (Windows), then `http://127.0.0.1:8078`. A download of the kit on its own: `python tools/pezzi3d/strumenti/crea_zip.py` (the API key, concepts and raw models stay out). Details and Linux commands: `tools/pezzi3d/PIANO_SVILUPPO.md`.
- What changed from the original kit: the five faction figures, the party and police props, and the procedural block-outs are gone; the list of pieces now comes from the game's own data (`tools/pezzi3d/strumenti/catalogo.py` reads `data/*/units.json`); materials are the piece's real colours plus a base slab `colore_fazione` that the game tints with the side's wood colour; a piece is kept inside the standing block's footprint (1.5 × 0.7); the neon/player-colour logic and the octagon base were removed. Port 8078, so it can run beside the Briano Borromeo panel; TRELLIS and the Gemini key are shared with it.
- Tested here: the catalogue (`python tools/pezzi3d/strumenti/test_catalogo.py`), the panel loading all 32 pieces in a browser, and the clean-up on the kit's sample model (45,528 triangles → 791, 1.5 × 0.7 footprint, 0.6 high). **Not tested**: Gemini and TRELLIS calls (no key or GPU in the cloud session) and the Windows `.bat` files.

## 2. What gets modelled: 32 types for 211 blocks

Blocks of the same side and class share one model (a German infantry block in The Bulge is the same figure group whichever division it is). The six Special Action blocks have no model.

| Volume | Types (blocks) |
|---|---|
| The Bulge, 11 types, 73 blocks | German armour 12, mechanised 5, infantry 14, airborne 2, mountain 1; US infantry 17, cavalry 4, armour 11, airborne 3; British infantry 3, armour 1 |
| Golan '73, 10 types, 61 blocks | Israeli infantry 6, armour 15, mechanised 7, airborne 2, decoy 3; Syrian infantry 7, recon 4, armour 11, mechanised 5, airborne 1 |
| Sicily '43, 11 types, 71 blocks | US armour 2, infantry 8, airborne 2; British infantry 11, airborne 2, armour 2; Italian motorised 2, Alpini 2, infantry 4, garrison 29; German mechanised 7 |

Each type has a prompt subject with period equipment (Panther, Sherman, Centurion, T-55, Alpini hats…), written in `catalogo.py`. Please review them: they are my reading of the history, not yours.

## 3. Rules for a piece

| | |
|---|---|
| Subject | a small group (three infantrymen, two tanks…) that reads as one unit |
| Units | 1 unit = 1 board unit; the wooden block is 1.6 × 1.6 × 0.8 (`block()` in `web/src/main.ts`) |
| Axes | Y up, front toward +Z, origin at the centre of the base, on the ground |
| Footprint | at most 1.5 (X) × 0.7 (Z): no wider than the block standing |
| Height | infantry 0.8, vehicles 0.45–0.6 (in `catalogo.py`) |
| Budget | 5,000 triangles per piece (2,000 for `hidden`), set in the generator (Meshy Poly Count 4,000); a busy map of 60–80 pieces is about 300–400k triangles, fine with instancing |
| Look | the generator's own shape and texture, kept as they are (texture shrunk to 512 px); one base slab named `colore_fazione` for the side colour. The old flat-colour clean-up is still there (untick «tieni la texture») but cut soldiers to ~800 triangles and looked crude: tried and dropped on 10 November |
| Files | `tools/pezzi3d/modelli/definitivi/<volume>_<side>_<class>.glb`, committed; concepts and raw models stay local |
| References | never feed Vassal images or scans to Gemini/TRELLIS, and never commit them (owner rule). Style comes from the first chosen concept, US infantry |

Licence: TRELLIS code is MIT but some modules it uses are research-only; check before any commercial use (the original kit notes this).

## 4. In the game (The Bulge: built 11 November 2026)

Mockup approved by the owner: https://claude.ai/artifact/SpjUQ4nNP3885wy4kxiTop. Code: `web/src/troops.ts` (loading, placement, look), wired in `drawPieces()` in `web/src/main.ts`; tests `web/test/troops.test.ts`. Switch: the View window, Board > **Units: Blocks / Figures**, separate from Map 2D / 3D, so any combination works (Figures by default; blocks in the tutorials, whose texts talk about blocks). Any unit without figures, and every unit while the figures load, is the usual block.

- **One figure per unit** (owner, 11 November 2026, after trying one per step: crowded areas made them too small). A unit shows one of its type's figures, fixed per unit (`variant()`), so neighbouring units of one type differ. Strength is the pips.
- **One scale over the whole map**: `SCALE` in `troops.ts` (1.5× the figures' 0.18 units per metre: a Sherman 1.6 long, about a block). Infantry is drawn 3× larger (`INFANTRY`, owner's choice: a lone soldier at true scale is a speck), so a soldier stands about as tall as a tank. No resizing by area.
- **Facing**: Germans west, Allies east, everywhere.
- **Placement**: the game's own block layout (`drawPieces`), given each figure's real footprint (`radius()`), so a Panther gets more room than a soldier; crowded contested rows space by the widest figure.
- **Side colour**: a rounded ring round the unit's figures in its block wood colour, with a faint fill (the owner's pick of four options). Selected or battle point unit: the ring is brass.
- **Strength**: the pips float above the unit as one strip that always faces the camera, coloured by quality at the current strength (red elite with a white ring, black veteran with a white ring, white green with a black ring).
- **Hidden units** (an enemy block face down): the plain wooden block, as before. No tarpaulin piece (dropped by the owner).
- Taps: a tap on a figure, or inside its ring, picks the unit. The block "turns to its new strength" animation does not run for figures.
- Measured: a full Bulge start is about 61,000 triangles, 267 draw calls. Figures: about 1,200–2,600 triangles each, 256 px textures, 4.2 MB for the 27 Bulge figures.
- **Dividing a group model into figures**: the kit panel, Pezzi > a type > **5 · Dividi in figure** (opens on the automatic proposal; each figure a colour, dark grey = discarded): click a whole part (rifle, turret, body) to give it to the chosen figure, or paint triangles with the brush; Save writes `tools/pezzi3d/modelli/divisioni/<type>.json` and recreates the volume's figures (`separa_figure.py`). The Bulge figures in the game still come from the automatic proposal until the owner saves a hand-made division.

## 5. Phases

0. Kit adapted (done).
1. The Bulge: 11 types modelled by the owner in Meshy, cut into single figures, in the game behind Settings > Screen > 3D figures (done, 11 November 2026).
2. Golan '73 and Sicily '43: generate **one single soldier or vehicle per type** in Meshy (the kit's prompts now ask for that), add each type to `TIPI` in `separa_figure.py` with 1 figure per file, run it with `--volume golan73` / `sicily`, then allow the volume in `wantTroops()` in `main.ts`.
3. Later and optional: redo the two US infantrymen with cut rifles; named leaders (Peiper…); strongpoint and bridge markers as models.

## 6. Decided by the owner

- Models replace the blocks; strength as floating pips; one figure per step (11 November 2026).
- Units deploy inside their area, spread out, facing the enemy, as big as the area allows.
- Side colour: a ground ring round the unit. Hidden units stay plain blocks.
