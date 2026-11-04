# Plan: low-poly 3D map (saved for after the tutorial)

A faceted relief of the Ardennes under the game layer. The game data stays the authority (TDN, rivers, Schnee Eifel); real elevation gives the shape.

## Data
- **Height:** public Terrarium elevation tiles (reachable from the dev container, about 30–60 m), cropped to the map area.
- **Georeferencing:** about 25 named towns of the map matched to their real coordinates; a thin-plate-spline warp bends real terrain onto the schematic game map.
- **Forests, rivers, towns:** from our own map data (traced woods layer, river borders, area names and town symbols). OpenStreetMap is not reachable from here and is not needed.

## Shaping rules (the game wins over geography)
- TDN 0 = gentle, 1 = rolling, 2 = hilly and wooded, 3 = rugged: per-area height scale and roughness.
- River borders become valleys; the Schnee Eifel (4–11) becomes a visible ridge.
- Area borders, numbers, TDN plates, roads and VP symbols drape on the relief and stay readable.

## Build and performance
- Built once (offline script) into a compact mesh file (~1–2 MB, 40–80k faces); trees and houses as instanced low-poly props.
- View option: 3D relief / flat board; flat board automatically on weak devices.
- "Flatten while choosing": relief lowers when areas are lit for a move or a target.

## Steps
1. Mockup: one region (St. Vith–Malmedy) for style approval: facet size, colours, trees, towns.
2. Full terrain, forests, towns, rivers.
3. Game layer on top, camera, phone performance, 2D/3D toggle; sweep on all devices.

## Risks
- Readability on phones → flatten mode and 2D option.
- Schematic map vs real distances → acceptable for a stylised relief.
