# Real 3D models for the blocks (plan)

Goal: replace the generic wooden 3D blocks with models of the real troops and vehicles each block stands for. The tool that makes them is the **pieces kit** in `tools/pezzi3d/` (the owner's Briano Borromeo kit, adapted). This page is the plan: what exists, the rules for a piece, how it would go into the game, and what the owner still has to decide. **Nothing is wired into the game yet.**

## 1. The tool (done)

A local panel in the browser (Italian, like the original). The **Produzione** tab runs the whole line in series: generate the concepts for every piece, pick the best of each in one gallery, then one button makes the front view, the 3D model and the clean-up for every chosen piece, skipping what is done; it can be stopped and resumed. Per piece (Pezzi tab, for redoing one): 2D concept (Gemini) → front/side/back views → 3D model (TRELLIS on the owner's PC, or Meshy) → automatic clean-up (pose, size to the block footprint, side-coloured base, texture shrunk to 512 px; the shape is never reduced, because reducing a textured model tears its texture seams) → preview next to the real block → copy into the game folder.

- Start it: `tools/pezzi3d/AVVIA_PANNELLO.bat` (Windows), then `http://127.0.0.1:8078`. A download of the kit on its own: `python tools/pezzi3d/strumenti/crea_zip.py` (the API key, concepts and raw models stay out). Details and Linux commands: `tools/pezzi3d/PIANO_SVILUPPO.md`.
- What changed from the original kit: the five faction figures, the party and police props, and the procedural block-outs are gone; the list of pieces now comes from the game's own data (`tools/pezzi3d/strumenti/catalogo.py` reads `data/*/units.json`); materials are the piece's real colours plus a base slab `colore_fazione` that the game tints with the side's wood colour; a piece is kept inside the standing block's footprint (1.5 × 0.7); the neon/player-colour logic and the octagon base were removed. Port 8078, so it can run beside the Briano Borromeo panel; TRELLIS and the Gemini key are shared with it.
- Tested here: the catalogue (`python tools/pezzi3d/strumenti/test_catalogo.py`), the panel loading all 32 pieces in a browser, and the clean-up on the kit's sample model (45,528 triangles → 791, 1.5 × 0.7 footprint, 0.6 high). **Not tested**: Gemini and TRELLIS calls (no key or GPU in the cloud session) and the Windows `.bat` files.

## 2. What gets modelled: 33 pieces for 211 blocks

Blocks of the same side and class share one model (a German infantry block in The Bulge is the same figure group whichever division it is). The six Special Action blocks have no model. Plus one `hidden` piece for every unit the player cannot see.

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

## 4. How it goes into the game (decided 10 November 2026, not built yet)

The owner's decision: **the model replaces the block completely.**

- **Strength**: shown as pips floating above the model, in the stickers' colours (red with a white ring = elite, black = veteran, white with a black ring = green), one pip per step left, always facing the camera. The kit's preview (`visualizzatore.html`) already draws them, to check the headroom over each model. The block no longer turns to show strength.
- **Hidden units**: one extra piece, `hidden` (a tarpaulin over an anonymous load), replaces every block the player may not see (an enemy block face down, a Sicily untried garrison). Its tarpaulin and base are `colore_fazione`, so the game tints it with that side's wood colour (German grey, US green, Italian orange `#e66525`…), like the blank back of a block. No pips on it.
- **Side colour**: `colore_fazione` on every model takes the block's wood colour from the same tables the blocks use (`BULGE_WOOD`, `GOLAN_WOOD`, `SICILY_WOOD`).
- Models load from `web/public/pezzi/` (the kit's "Copia i modelli nel gioco" puts them there), with the old block as fallback while a type has no model, behind a Settings switch until every type exists. Phone budget: instancing, about 60k triangles on a busy map.
- Still to do in the game, after the pilot pieces: a mockup for the owner (the pips, the hidden piece, selection highlight), then the code in `web/src/main.ts` `block()`.

## 5. Phases

0. Kit adapted (done, this page).
1. Pilot, three pieces end to end: US infantry (style anchor), US armour, German armour. Check the look next to the block in the preview.
2. The remaining 29 types, volume by volume (Bulge first).
3. Integration behind a Settings switch (after the owner approves a mockup of section 4).
4. Later and optional: a different group for reduced strength (fewer figures per step), named leaders (Peiper…), strongpoint and bridge markers.

## 6. Open decisions for the owner

1. Are the group sizes right (three infantrymen, two tanks), or one single figure/vehicle per block?
2. Should the group shrink as the block loses steps?
