// Step 5: into the game. Each finished model -> web/public/models/<type>.glb: standing on y = 0, centred, scaled to its kind's size (cm, a block is 1.6),
// turned by the type's optional "yaw" (degrees) so it faces the player, compressed (meshopt geometry, 512 px WebP texture). Soldier clips -> <type>-<clip>.glb.
// Also writes web/public/models/figures.json: which piece uses which type, and each type's kind and clips. Free: runs locally.
//   node 5-game/install.mjs [type ...] [--to=../../web/public/models]
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { getBounds, textureCompress, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { logRun, pick, flag } from '../log.mjs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url))), L = JSON.parse(readFileSync(new URL('../1-list/list.json', import.meta.url)));
const to = new URL(flag('to', '../../web/public/models') + '/', new URL('../', import.meta.url)), at = (f) => new URL(`../${f}`, import.meta.url);
mkdirSync(to, { recursive: true }); await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const pack = (doc) => doc.transform(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const manifest = existsSync(new URL('figures.json', to)) ? JSON.parse(readFileSync(new URL('figures.json', to))) : { types: {} };
let n = 0;
for (const id of pick(Object.keys(T.types))) {
  const t = T.types[id], k = T.kinds[t.kind], rigged = at(`4-animate/${id}/idle.glb`), src = existsSync(rigged) ? rigged : at(`3-model/${id}/${id}.glb`);
  if (!existsSync(src)) continue;
  const doc = await io.read(src.pathname), scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene), s = k.size / (t.kind === 'soldier' ? max[1] - min[1] : Math.max(max[0] - min[0], max[2] - min[2]));
  const yaw = ((t.yaw ?? 0) * Math.PI) / 180, root = doc.createNode('figure').setScale([s, s, s]).setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
  const c = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2], inner = doc.createNode('centre').setTranslation(c);
  for (const child of scene.listChildren()) { scene.removeChild(child); inner.addChild(child); }
  root.addChild(inner); scene.addChild(root);
  await pack(doc); await io.write(new URL(`${id}.glb`, to).pathname, doc);
  const clips = (k.clips ?? []).filter((cl) => cl !== 'idle' || existsSync(rigged)).filter((cl) => existsSync(at(`4-animate/${id}/${cl}.glb`)));
  for (const cl of clips.filter((x) => x !== 'idle')) { const d = await io.read(at(`4-animate/${id}/${cl}.glb`).pathname); await pack(d); await io.write(new URL(`${id}-${cl}.glb`, to).pathname, d); }
  const kb = statSync(new URL(`${id}.glb`, to)).size / 1024; n++;
  console.log(`${id}: ${kb.toFixed(0)} KB${kb > 500 ? '  (over the 500 KB a phone can take: lower its triangles in types.json kinds)' : ''}${clips.length ? `, clips: ${clips.join(' ')}` : ''}`);
  manifest.types[id] = { kind: t.kind, clips };
}
manifest.pieces = Object.fromEntries(Object.entries(L.pieces).filter(([, ty]) => manifest.types[ty]));
if (manifest.types.cover) manifest.hidden = 'cover';
writeFileSync(new URL('figures.json', to), JSON.stringify(manifest, null, 1) + '\n');
logRun('game', 'local (gltf-transform)', n, 'free');
