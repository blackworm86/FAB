// Step 3: picture -> 3D model, by an AI. For each type with 2-concept/<type>/pick.png: TRELLIS (MIT licence) on a free Hugging Face Space -> 3-model/<type>/raw.glb.
// Any other image-to-3D service works too: save its .glb as 3-model/<type>/raw.glb (Meshy or Tripo free web tiers, TRELLIS in your own browser).
//   node 3-model/make.mjs [type ...] [--space=trellis-community/TRELLIS] [--seed=0]
// Needs a free Hugging Face account for the GPU time: HF_TOKEN in the environment (in a cloud session the proxy adds it; set HF_TOKEN=proxy-injected).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { logRun, pick, flag } from '../log.mjs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url))), space = flag('space', 'trellis-community/TRELLIS');
const at = (f) => new URL(`../${f}`, import.meta.url);
let app = null, made = 0;
async function trellis(png) {
  const { Client, handle_file } = await import('@gradio/client');
  app ??= await Client.connect(space, process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {});
  try {                                                        // shortcut: the argument order is that of the TRELLIS Space's /generate_and_extract_glb (checked November 2026); if the Space changes, the error below prints its new API
    const r = await app.predict('/generate_and_extract_glb', [handle_file(new Blob([png], { type: 'image/png' })), [], null, +flag('seed', 0), 7.5, 12, 3, 12, 'stochastic', 0.95, 1024]);
    const glb = r.data[2] ?? r.data[1];                         // the download button's file, else the 3D viewer's
    return Buffer.from(await (await fetch(glb.url)).arrayBuffer());
  } catch (e) { console.error(e?.message ?? e?.title ?? e, '\nThe Space API now is:', JSON.stringify(await app.view_api(), null, 1).slice(0, 3000)); throw e; }
}
for (const id of pick(Object.keys(T.types))) {
  const png = at(`2-concept/${id}/pick.png`), raw = at(`3-model/${id}/raw.glb`);
  if (existsSync(raw) || !existsSync(png)) continue;
  mkdirSync(at(`3-model/${id}/`), { recursive: true }); console.log(`${id}: TRELLIS…`); writeFileSync(raw, await trellis(readFileSync(png))); made++;
}
logRun('model', `TRELLIS on ${space}`, made, 'free (Hugging Face free GPU time)');
