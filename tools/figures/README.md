# Figures pipeline

Turns every unit of the three volumes into a small 3D figure (soldiers, tanks, guns, planes, a ship, a bunker) made by **other AI services, free ones first**. Plan and rules: `docs/PARALLEL.md` §3. Nothing here is modelled by hand or by Claude: Claude wrote the list, the prompts and the scripts that move files between the services.

Each step is a folder and a script that reads the previous step's files. A step that already has its output file skips that type, so nothing is paid or waited for twice, and **any step can be done by hand** by dropping in the file it would make.

```bash
cd tools/figures && npm ci
npm run list                 # 1  units -> figure types (1-list/list.json) and every prompt (PROMPTS.md)
npm run concept -- us44-inf  # 2  concept art, 3 views x 2 variants; then copy the best to 2-concept/us44-inf/pick.png
npm run model -- us44-inf    # 3  pick.png -> 3D model (TRELLIS), reduced for phones
npm run animate -- export us44-inf   # 4  soldiers only: makes the Mixamo upload; after Mixamo:  npm run animate -- import us44-inf
npm run game -- us44-inf     # 5  -> web/public/models/us44-inf.glb + figures.json
npm test                     # self-check of steps 1, 3, 4 and 5 on a made-up model (no service needed)
```

Leave out the type names to run every type. Every service run adds a line to `runs.log` with what it made and its cost.

## The steps

| Step | Makes | Service (free) | Instead, by hand |
|---|---|---|---|
| 1 list | `1-list/list.json`: each piece -> type; 72 types, 412 pieces; events, markers and garrison chits keep their counter | none | edit `types.json` (types, period equipment, matching rules) |
| 2 concept | `2-concept/<type>/<view>-<n>.png` | **Pollinations** (FLUX, no key, about one image per 15 s). `--service=hf`: Hugging Face FLUX.1-schnell with a free account token | paste a prompt from `PROMPTS.md` into Gemini, ChatGPT or Bing Image Creator and save the result as `pick.png` |
| 3 model | `3-model/<type>/raw.glb`, then `<type>.glb` reduced to the triangle budget of its kind, 512 px texture | **TRELLIS** (Microsoft, MIT licence) on the free Hugging Face Space `trellis-community/TRELLIS` (`--space=` for another copy, e.g. TRELLIS.2). Free GPU time is a few minutes a day, more with a free account token | upload `pick.png` to the free web tier of Meshy or Tripo (Meshy's free models are CC BY: credit them), or TRELLIS on Google Colab; save as `raw.glb`. Not Hunyuan3D: its licence excludes the EU |
| 4 animate | soldiers: `4-animate/<type>/idle.glb` (rigged) and `move` `fire` `fall` clips | **Mixamo** (Adobe, free, no API: by hand) + FBX2glTF | any rigging tool; drop `idle.fbx` (with skin) and the clips (without skin) in the folder and run `import` |
| 5 game | `web/public/models/<type>.glb` (centred, on the ground, scaled: soldier 0.55 cm tall, vehicle 1.3 cm long, a block is 1.6), clips `<type>-<clip>.glb`, `figures.json` | none (gltf-transform, meshopt + WebP) | |

Vehicles and guns get no rig: the game turns the turret, recoils the gun and rocks the hull in code. If a model faces the wrong way, add `"yaw": 90` (degrees) to its type in `types.json` and run step 5 again.

## Keys

Never put a key in the repo or in a file. The scripts read `HF_TOKEN` (Hugging Face, free account: huggingface.co/settings/tokens, "read" is enough) and `POLLINATIONS_TOKEN` (optional) from the environment only. In a cloud Claude session, the key is given through the session's credential form and the host must be allowed in the environment's network settings: `image.pollinations.ai`, `huggingface.co`, `*.hf.space` (the Space's own host), `router.huggingface.co`.

## Rules the figures keep

- Real equipment of the period; Vassal images and scans are never used as input or reference.
- No swastikas or SS runes (in the negative prompt); German vehicles carry the Balkenkreuz, as the blocks do.
- A hidden enemy unit is always the same covered `cover` figure: it tells nothing about type or strength.
- The base keeps the block's wood colour (Italian orange `#e66525`), and the unit's printed face stays readable on it.
- Free Firebase plan: the models are static files served with the site; nothing goes in the database.

## The Figure Workshop page

The owner runs the pipeline from a private claude.ai page: https://claude.ai/artifact/Luo4w2YdxJkw8KPzbFJ2jU (source: `page/template.html`, rebuilt into `page/index.html` by `node page/build.mjs`; republish that file to the same URL after the types or prompts change). There the owner copies prompts, opens free Pollinations variants with one tap, uploads the picked concept art, approves models and leaves notes. Progress lives in the page's own records, read and written by Claude with the ArtifactData tool:

- `types/<type id>`: `pick` (asset id of the picked picture; fetch it with the Artifact tool, `action: read`, `path: <asset id>`, and save it as `2-concept/<type>/pick.png`), `note`, `modelOk` (set by the owner); `model: {tris, kb, service, preview}` (preview = asset id of a PNG render), `mixamo: {"model.obj": id, "model.mtl": id, "texture.png": id}` (the page zips them for the owner), `rigged: true`, `game: {kb, at}` (set by Claude). Use `update`, pinned with `if_version`.
- `runs/*`: `{at, step, service, what, cost}`, one per service run (the same line `runs.log` gets).
