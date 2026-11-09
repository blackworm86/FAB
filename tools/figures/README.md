# Figures pipeline

Turns every unit of the three volumes into a small **low-poly figure**: soldiers, tanks, guns, planes, a ship, a bunker, each a few hundred flat faces painted with a handful of plain colours, like a painted war-game miniature on the map. Plan and rules: `docs/PARALLEL.md` §3.

AI services draw the pictures and build the 3D models; the owner chooses and approves; the scripts here move the files, make the model low-poly and put it in the game. Nothing is modelled by hand or by Claude. Free services first.

The owner works from the **Figure Workshop** page: https://claude.ai/artifact/Luo4w2YdxJkw8KPzbFJ2jU

## The six steps

| Step | Who | What happens | Free service | Output |
|---|---|---|---|---|
| 1 List and prompts | Claude | every piece -> one of 72 figure types (period equipment); one picture prompt per type in the low-poly style | none | `1-list/list.json`, `2-concept/prompts.json`, `PROMPTS.md` |
| 2 Picture | owner | one low-poly picture per type, three-quarter view, on a plain background; the owner picks the best of a few variants | Gemini, ChatGPT or Bing by hand (best); Hugging Face FLUX.1-schnell or Pollinations by script | `2-concept/<type>/pick.png` |
| 3 3D model | an AI | image-to-3D builds a textured model from the picked picture | TRELLIS (Microsoft, MIT licence) on a Hugging Face Space, by script or in the owner's browser; or the free web tiers of Meshy (credit them: CC BY) or Tripo (non-commercial) | `3-model/<type>/raw.glb` |
| 4 Low-poly | script, owner approves | the model is cut to its triangle budget (soldier 500, vehicle 900, gun 500, plane 700, ship 900, bunker 400, cover 150) and each face gets one plain colour from a palette of at most 16 | none (meshoptimizer, local) | `4-lowpoly/<type>/<type>.glb` |
| 5 Animation | owner in Mixamo | soldiers only: rig and four clips (idle, move, fire, fall); vehicles and guns are moved in code | Mixamo (free, by hand) + FBX2glTF | `5-animate/<type>/idle.glb` + clips |
| 6 Into the game | script | centred, standing on the ground, scaled (soldier 0.55 cm tall, vehicle 1.3 cm long; a block is 1.6), compressed | none | `web/public/models/<type>.glb`, `figures.json` |

Why this order: image-to-3D AIs make dense, detailed meshes, and no free service makes clean low-poly ones (Meshy's and Tripo's low-poly modes are paid or limited). So the picture already asks for the low-poly look, which the 3D AI copies in its shapes, and step 4 turns whatever comes back into true low-poly with flat colours. Tested on a 108 936-face sample car: 898 faces, 16 colours, shape and colours kept.

Each step skips a type whose output file already exists, so nothing is paid or waited for twice, and **any step can be done by hand** by dropping in the file it would make.

```bash
cd tools/figures && npm ci
npm run list                    # 1  types and prompts (after editing types.json)
npm run concept -- us44-inf     # 2  three variants -> 2-concept/us44-inf/1.png 2.png 3.png; copy the chosen one to pick.png
npm run model -- us44-inf       # 3  pick.png -> raw.glb (TRELLIS)
npm run lowpoly -- us44-inf     # 4  raw.glb -> low-poly figure
npm run animate -- export us44-inf    # 5  the Mixamo upload; after Mixamo: npm run animate -- import us44-inf
npm run game -- us44-inf        # 6  -> web/public/models
npm run page                    # rebuild the Figure Workshop page (then republish it)
npm test                        # self-check of steps 1, 4, 5 and 6 on a made-up model, no service needed
```

Leave out the type names to run every type. Every run adds a line with its cost to `runs.log`; Claude copies it to the page.

## Changing the look

The style sentence at the top of `types.json` goes into every prompt; the triangle budgets are the kinds' `tris`; `--colours=` on step 4 sets the palette size (default 16). After a change: `npm run list`, `npm run page`, republish the page. If a model faces the wrong way in the game, add `"yaw": 90` (degrees) to its type and run step 6 again.

## The Workshop page and Claude

Source `page/template.html`, built into `page/index.html` by `npm run page`, published at the URL above (republish that file to the same URL). The page keeps its progress in its own records, which Claude reads and writes with the ArtifactData tool:

- `types/<type id>`: `pick` (asset id of the chosen picture: fetch it with the Artifact tool, `action: read`, `path: <asset id>`, save as `2-concept/<type>/pick.png`), `note`, `modelOk` (set by the owner); `raw: {faces, service}` when the 3D model is in, `model: {faces, colours, kb, preview}` after step 4 (preview = asset id of a PNG render), `mixamo: {"model.obj": id, "model.mtl": id, "texture.png": id}` (the page zips them for the owner), `rigged: true`, `game: {kb, at}`. Use `update`, pinned with `if_version`.
- `runs/*`: `{at, step, service, what, cost}`, one per service run.

## In a cloud Claude session

Node's own downloads ignore the session's network proxy unless told: run the steps as `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run …`. The environment allows `image.pollinations.ai`, `huggingface.co`, `router.huggingface.co` and `trellis-community-trellis.hf.space`. The Hugging Face token is a network secret on `huggingface.co` that the proxy adds to requests; give scripts `HF_TOKEN=proxy-injected`. In November 2026 Hugging Face still refused the saved token ("Invalid username or password"), and TRELLIS without an account answers "ZeroGPU quota exceeded".

## Keys

Never put a key in the repo or in a file. Scripts read `HF_TOKEN` (free account, huggingface.co/settings/tokens, type Read) and `POLLINATIONS_TOKEN` (optional) from the environment only.

## Rules the figures keep

- Real equipment of the period; Vassal images and scans are never used as input or reference.
- No swastikas or SS runes; German vehicles carry the Balkenkreuz, as the blocks do.
- A hidden enemy unit is always the same covered `cover` figure: it tells nothing about type or strength.
- The base keeps the block's wood colour (Italian orange `#e66525`), and the unit's printed face stays readable on it.
- Free Firebase plan: the models are static files served with the site; nothing goes in the database.
