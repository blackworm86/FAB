// Step 4: animation, soldiers only (vehicles and guns are moved in code). Mixamo is free (an Adobe account) but has no API, so this step is half by hand:
//   node 4-animate/make.mjs export [type ...]   3-model/<type>/<type>.glb -> 4-animate/<type>/upload/ (OBJ + MTL + texture): zip that folder and upload it to mixamo.com
//   in Mixamo: auto-rig (chin, wrists, elbows, knees, groin), then download each clip named in PROMPTS.md as FBX Binary into 4-animate/<type>/:
//       idle.fbx "With Skin", move.fbx / fire.fbx / fall.fbx "Without Skin"
//   node 4-animate/make.mjs import [type ...]   every 4-animate/<type>/*.fbx -> .glb (FBX2glTF, free); idle.glb is the rigged soldier the game uses
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { logRun, pick } from '../log.mjs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url))), mode = process.argv[2];
const soldiers = Object.keys(T.types).filter((id) => T.types[id].kind === 'soldier'), at = (f) => new URL(`../${f}`, import.meta.url);
process.argv.splice(2, 1);
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** The model as OBJ + MTL + PNG, standing on y = 0 and 180 units tall, which is what Mixamo expects. */
async function toObj(glb) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(glb), v = [], vt = [], f = []; let tex = null;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices(), base = v.length;
      tex ??= p.getMaterial()?.getBaseColorTexture() ?? null;
      for (let i = 0; i < pos.getCount(); i++) { v.push(mul(m, ...pos.getElement(i, []))); vt.push(uv ? uv.getElement(i, []) : [0, 0]); }
      const n = idx ? idx.getCount() : pos.getCount(), ix = (i) => (idx ? idx.getScalar(i) : i) + base + 1;
      for (let i = 0; i < n; i += 3) f.push([ix(i), ix(i + 1), ix(i + 2)]);
    }
  }
  const ax = (i) => v.map((p) => p[i]), mid = (a) => (Math.min(...a) + Math.max(...a)) / 2, ys = ax(1), y0 = Math.min(...ys), k = 180 / (Math.max(...ys) - y0), x0 = mid(ax(0)), z0 = mid(ax(2));
  const obj = ['mtllib model.mtl', 'usemtl skin', ...v.map((p) => `v ${((p[0] - x0) * k).toFixed(3)} ${((p[1] - y0) * k).toFixed(3)} ${((p[2] - z0) * k).toFixed(3)}`), ...vt.map((t) => `vt ${t[0]} ${1 - t[1]}`), ...f.map((t) => `f ${t.map((i) => `${i}/${i}`).join(' ')}`)].join('\n');
  return { obj, mtl: `newmtl skin\nKd 1 1 1\n${tex ? 'map_Kd texture.png' : ''}\n`, png: tex ? await sharp(Buffer.from(tex.getImage())).png().toBuffer() : null, verts: v.length };
}

let n = 0;
if (mode === 'export') for (const id of pick(soldiers)) {
  const src = at(`3-model/${id}/${id}.glb`); if (!existsSync(src)) continue;
  const o = await toObj(src.pathname), dir = at(`4-animate/${id}/upload/`); mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('model.obj', dir), o.obj); writeFileSync(new URL('model.mtl', dir), o.mtl); if (o.png) writeFileSync(new URL('texture.png', dir), o.png);
  console.log(`${id}: zip 4-animate/${id}/upload/ and upload it to Mixamo`); n++;
} else if (mode === 'import') {
  const bin = createRequire(import.meta.url).resolve(`fbx2gltf/bin/${process.platform === 'win32' ? 'Windows_NT/FBX2glTF.exe' : process.platform === 'darwin' ? 'Darwin/FBX2glTF' : 'Linux/FBX2glTF'}`);
  for (const id of pick(soldiers)) {
    const dir = at(`4-animate/${id}/`); if (!existsSync(dir)) continue;
    for (const fbx of readdirSync(dir).filter((x) => x.endsWith('.fbx'))) { execFileSync(bin, ['--binary', '--input', new URL(fbx, dir).pathname, '--output', new URL(fbx.replace(/\.fbx$/, ''), dir).pathname], { stdio: 'inherit' }); n++; }
  }
  logRun('animate', 'Mixamo by hand + FBX2glTF', n, 'free');
} else console.log('usage: node 4-animate/make.mjs export|import [type ...]');
