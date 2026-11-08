// Step 3: image -> 3D model. For each type with 2-concept/<type>/pick.png: TRELLIS (MIT licence) on a free Hugging Face Space -> 3-model/<type>/raw.glb,
// then reduced to the kind's triangle budget with a 512 px texture -> 3-model/<type>/<type>.glb.
// raw.glb can also be dropped in by hand (Meshy or Tripo free web tiers, or TRELLIS on Colab); this step then only reduces it.
//   node 3-model/make.mjs [type ...] [--space=trellis-community/TRELLIS] [--seed=0]      HF_TOKEN (free account) gives more free GPU time per day.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { logRun, pick, flag } from '../log.mjs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url))), space = flag('space', 'trellis-community/TRELLIS');
const at = (id, f) => new URL(`../${f.replaceAll('%', id)}`, import.meta.url);
let app = null, made = 0;
async function trellis(png) {
  const { Client, handle_file } = await import('@gradio/client');
  app ??= await Client.connect(space, process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {});
  try {                                                        // shortcut: endpoint and argument names are those of the TRELLIS Space app.py; if the Space changes, the error below prints its new API
    await app.predict('/start_session', {}).catch(() => {});
    await app.predict('/image_to_3d', { image: handle_file(new Blob([png], { type: 'image/png' })), multiimages: [], seed: +flag('seed', 0), ss_guidance_strength: 7.5, ss_sampling_steps: 12, slat_guidance_strength: 3, slat_sampling_steps: 12, multiimage_algo: 'stochastic' });
    const r = await app.predict('/extract_glb', { mesh_simplify: 0.95, texture_size: 1024 });
    return Buffer.from(await (await fetch(r.data[0].url ?? r.data[0].path)).arrayBuffer());
  } catch (e) { console.error(e?.message ?? e, '\nThe Space API now is:', JSON.stringify(await app.view_api(), null, 1).slice(0, 3000)); throw e; }
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const id of pick(Object.keys(T.types))) {
  const png = at(id, '2-concept/%/pick.png'), raw = at(id, '3-model/%/raw.glb'), out = at(id, '3-model/%/%.glb');
  if (!existsSync(raw)) { if (!existsSync(png)) continue; mkdirSync(at(id, '3-model/%/'), { recursive: true }); console.log(`${id}: TRELLIS…`); writeFileSync(raw, await trellis(readFileSync(png))); made++; }
  const doc = await io.read(raw.pathname), tris = () => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
  const before = tris(), want = T.kinds[T.types[id].kind].tris;
  await MeshoptSimplifier.ready;
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, want / before), error: 0.01 }), textureCompress({ encoder: sharp, targetFormat: 'png', resize: [512, 512] }), prune());
  await io.write(out.pathname, doc);
  console.log(`${id}: ${Math.round(before)} -> ${Math.round(tris())} triangles, ${(readFileSync(out).length / 1024).toFixed(0)} KB`);
}
logRun('model', `TRELLIS on ${space}`, made, 'free (Hugging Face free GPU time)');
