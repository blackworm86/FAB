# Editable map (for Illustrator)

`bulge-map-editable.svg` is the current trace, split into layers (top-level groups). Open it in Illustrator; `map-scan.jpg` must stay beside it (it is the faded template on the `_scan` layer, lock it).

Layers: `_scan`, `terrain`, `woods`, `entry-zones`, `borders`, `borders-restricted`, `army-boundary`, `rivers`, `roads`, `cities`, `towns`, `labels`, `areas`.

Rules so the game can read it back:
- Rivers, roads and borders stay plain **strokes** (no expand, no brushes or width profiles); stroke weight is the line width.
- `areas` holds one closed path per area named `area-N` (1 to 98). Keep shared vertices on common borders.
- Entry zones: closed shapes in `entry-zones`, named `entry-A` to `entry-Q`, `entry-X`, `entry-Y`, `entry-Z`.
- Keep the artboard at 0,0, 1740 x 1584 units (the playing area of the scan).
- Save as SVG: Presentation Attributes, Object IDs = Layer Names, 2 decimals, not responsive, text to outlines.
