# Block faces: the series rule

Every Fast Action Battles volume draws its wooden blocks the same way. One function does it:
`blockFace()` in `web/src/block-kit.ts`. A volume only supplies colours, names and codes
(`labelSvg()` in `web/src/art.ts` for The Bulge, `golanBlockSvg()` in `web/src/golan-art.ts` for Golan '73).

The layout was measured from the printed stickers: the Bulge sticker sheet (`docs/game-pieces/Sticker_Sheet.jpg`)
and the Golan '73 block labels. Both games share it exactly; only the colours and the type size differ.

## The face

All sizes are in face units: the face is 100 × 100, drawn at 512 px.

| Part | Where |
|---|---|
| Wood | The block colour shows as a frame 5 wide round the sticker. The sticker is 90 × 90. |
| Full strength | The top edge. One step lost turns the block 90° counter-clockwise, so the next strength is on the right edge, then the bottom, then the left. |
| Pips | Centred on their edge, 18 in from it. One pip per step. The colour gives the troop quality at that strength: red with a white ring for elite, black for veteran, white with a black ring for green. |
| Bottom-edge pips | They sit to the left of the name, never under it. |
| Unit box | From 24.5 to 74.5 across and 27.5 to 70.5 down, with a thick black outline. It holds the NATO symbol: infantry X, armour oval, mechanised both, recon or cavalry slash and oval, airborne X and canopy, mountain X and peak. |
| Box colour | The command (Bulge) or division (Golan, Israeli side). |
| Colour stripe | Optional. It runs edge to edge across the sticker from 54.5 to 66, behind the unit box. Golan uses it for the Israeli brigades and the Syrian divisions. The Bulge has none. |
| Code | It reads up the left edge from the top. A set-up area number sits in a white box. A holding box (Golan AA, SR, OR) sits in a light-blue box. An arrival turn and entry, such as `7-Y` or `Res`, is plain lettering. |
| Name | Bottom right, right end at 86.5, baseline at 88, bold condensed. A few special units have the name on a yellow box: Peiper, 150 Pz, 82, 101, 517, 82nd. |
| Yellow arrow | It marks the strength a unit starts or arrives with when below full strength. It sits after the pips of that edge: below them on the right and left edges, left of them on the bottom edge. It points at the pips. |

Lettering is always set to the width of Arial Narrow Bold, so a face looks the same whatever fonts the browser has.

## Per volume

| | The Bulge | Golan '73 |
|---|---|---|
| Wood | German grey `#8e9296`, US green `#5d8a45`, British blue `#3f6fb8` | Israeli cyan `#2ea1d5`, Syrian green `#2a7f42` |
| Sticker paper | German blue-grey, darker grey for 6th Panzer Army and 10SS, 17SS, 6SS, light blue for the paratroopers. US green, British tan. | Israeli khaki, Syrian orange |
| Unit box | Command colour | Israeli: division colour. Syrian: cream, gold for the independent units |
| Stripe | none | Israeli brigade (the eight two-block brigades), Syrian division |
| Type size | Pips r 4.7, 12.2 apart; name 17; code 13.5 | Pips r 3.7, 10.8 apart; name 13.5; code 11 |
| Special stickers | | Strongpoint (hexagon, star pips, its last step on the left edge), Ghost, Special Action |

## Adding a volume (Sicily '43)

1. Upload the sticker sheet to `docs/games/sicily/counters/` as a flat scan.
2. Sample its colours: wood, paper per side and command, unit box per command, stripes if any.
3. Write `sicilyBlockSvg()` that maps each unit to a `BlockSpec` and calls `blockFace()`. Set `size` if its stickers print larger or smaller than Golan's.
4. Compare every block at every strength against the scan before publishing. The Golan and Bulge comparison sheets did this side by side.
