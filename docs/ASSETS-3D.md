# Real 3D models for the blocks (plan)

Goal: replace the generic wooden 3D blocks with models of the real troops and vehicles each block stands for. The tool that makes them is the **pieces kit** in `tools/pezzi3d/` (the owner's Briano Borromeo kit, adapted). This page is the plan: what exists, the rules for a piece, how it would go into the game, and what the owner still has to decide. **Nothing is wired into the game yet.**

## 1. The tool (done)

A local panel in the browser (Italian, like the original). Per piece: 2D concept (Gemini) → front/side/back views → 3D model (TRELLIS on the owner's PC, or Meshy) → automatic clean-up to a small flat-coloured `.glb` → preview next to the real block → copy into the game folder.

- Start it: `tools/pezzi3d/AVVIA_PANNELLO.bat` (Windows), then `http://127.0.0.1:8078`. Details and Linux commands: `tools/pezzi3d/PIANO_SVILUPPO.md`.
- What changed from the original kit: the five faction figures, the party and police props, and the procedural block-outs are gone; the list of pieces now comes from the game's own data (`tools/pezzi3d/strumenti/catalogo.py` reads `data/*/units.json`); materials are the piece's real colours plus a base slab `colore_fazione` that the game tints with the side's wood colour; a piece is kept inside the standing block's footprint (1.5 × 0.7); the neon/player-colour logic and the octagon base were removed. Port 8078, so it can run beside the Briano Borromeo panel; TRELLIS and the Gemini key are shared with it.
- Tested here: the catalogue (`python tools/pezzi3d/strumenti/test_catalogo.py`), the panel loading all 32 pieces in a browser, and the clean-up on the kit's sample model (45,528 triangles → 791, 1.5 × 0.7 footprint, 0.6 high). **Not tested**: Gemini and TRELLIS calls (no key or GPU in the cloud session) and the Windows `.bat` files.

## 2. What gets modelled: 32 types, not 211 blocks

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
| Budget | 800 triangles per piece (a busy map has about 60–80 pieces: ~60k triangles) |
| Look | flat shading, no textures, solid colours; one slab named `colore_fazione` for the side colour |
| Files | `tools/pezzi3d/modelli/definitivi/<volume>_<side>_<class>.glb`, committed; concepts and raw models stay local |
| References | never feed Vassal images or scans to Gemini/TRELLIS, and never commit them (owner rule). Style comes from the first chosen concept, US infantry |

Licence: TRELLIS code is MIT but some modules it uses are research-only; check before any commercial use (the original kit notes this).

## 4. How it would go into the game (not built)

The block is also the game's data carrier: turning it 90° shows strength, and a face-down block must stay blank to the enemy (the hidden-block rule). So a model cannot simply replace the block without changing how those two things read. Options:

1. **Model on top of the block (recommended).** The block stays as the base and keeps its face, strength and hidden side; the model stands on top (or beside it) and only shows when the block is face up for you. Nothing about the rules display changes; the Bulge cannot break.
2. **Model replaces the block.** Strength shows as a pip tray or a number, hidden units as a generic crate. Better looking, but a large change to every layout and tutorial.

Either way: models load lazily from `web/public/pezzi/` with a fallback to the plain block, behind a Settings switch, with a phone budget (instancing, hide models far from the camera), and the side colour applied to `colore_fazione` from the same wood table the blocks use. This needs the owner's decision and a mockup before any code.

## 5. Phases

0. Kit adapted (done, this page).
1. Pilot, three pieces end to end: US infantry (style anchor), US armour, German armour. Check the look next to the block in the preview.
2. The remaining 29 types, volume by volume (Bulge first).
3. Integration behind a Settings switch (after the owner picks option 1 or 2 and approves a mockup).
4. Later and optional: a different group for reduced strength (fewer figures per step), named leaders (Peiper…), strongpoint and bridge markers.

## 6. Open decisions for the owner

1. Model on top of the block, or replacing it (section 4)?
2. Are the group sizes right (three infantrymen, two tanks), or one single figure/vehicle per block?
3. Should the group shrink as the block loses steps?
