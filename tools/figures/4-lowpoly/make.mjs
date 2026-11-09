// Step 4: the AI's dense model -> a low-poly figure: a few hundred flat faces, each one plain colour from a small palette (the
// faceted, painted-miniature look). Automatic, local, free. 3-model/<type>/raw.glb -> 4-lowpoly/<type>/<type>.glb
//   node 4-lowpoly/make.mjs [type ...] [--colours=16]
// How: weld the mesh by position, simplify it to the kind's triangle budget (meshoptimizer), give each face the texture colour under it,
// reduce those colours to a palette (k-means), and draw every face with one palette cell of a tiny texture (nearest filtering, flat normals).
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier as MS } from 'meshoptimizer';
import sharp from 'sharp';
import { logRun, pick, flag } from '../log.mjs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url))), K = +flag('colours', 16), at = (f) => new URL(`../${f}`, import.meta.url);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); await MS.ready;
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

/** Every vertex of the model in world space with the colour painted at it (texture x factor, or vertex colour, or factor). */
async function dense(doc) {
  const pos = [], col = [], tri = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION'), UV = p.getAttribute('TEXCOORD_0'), C = p.getAttribute('COLOR_0'), I = p.getIndices(), mat = p.getMaterial(), base = pos.length / 3;
      const f = mat?.getBaseColorFactor() ?? [1, 1, 1, 1], tex = mat?.getBaseColorTexture();
      const img = tex ? await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
      for (let i = 0; i < P.getCount(); i++) {
        pos.push(...mul(m, ...P.getElement(i, [])));
        let c = [255, 255, 255];
        if (img && UV) { const [u, v] = UV.getElement(i, []), w = img.info.width, h = img.info.height, x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w))), y = Math.min(h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * h))), o = (y * w + x) * 3; c = [img.data[o], img.data[o + 1], img.data[o + 2]]; }
        else if (C) c = C.getElement(i, []).slice(0, 3).map((x) => x * 255);
        col.push(c[0] * f[0], c[1] * f[1], c[2] * f[2]);
      }
      const n = I ? I.getCount() : P.getCount(); for (let i = 0; i < n; i++) tri.push(base + (I ? I.getScalar(i) : i));
    }
  }
  return { pos: new Float32Array(pos), col, tri: new Uint32Array(tri) };
}
/** Merge vertices at the same place (UV seams split them), so the simplifier can collapse across seams. */
function weldByPosition(pos, tri) {
  const key = new Map(), remap = new Uint32Array(pos.length / 3), out = [];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  const q = 1e5 / Math.max(...hi.map((h, a) => h - lo[a]));
  for (let i = 0; i < remap.length; i++) { const k = [0, 1, 2].map((a) => Math.round((pos[i * 3 + a] - lo[a]) * q)).join(','); if (!key.has(k)) { key.set(k, out.length / 3); out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } remap[i] = key.get(k); }
  return { pos: new Float32Array(out), tri: tri.map((i) => remap[i]) };
}
/** k-means on colours, seeded with the most different colours, so a small but strong colour (a red cross, a white star) keeps its own entry. */
function palette(cols, k) {
  const d = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2, c = [cols[0]];
  while (c.length < Math.min(k, cols.length)) { let best = 0, bd = -1; cols.forEach((x, i) => { const m = Math.min(...c.map((y) => d(x, y))); if (m > bd) { bd = m; best = i; } }); if (bd <= 0) break; c.push(cols[best]); }
  let lab = [];
  for (let it = 0; it < 12; it++) {
    lab = cols.map((x) => c.reduce((b, y, j) => (d(x, y) < d(x, c[b]) ? j : b), 0));
    c.forEach((_, j) => { const mine = cols.filter((_, i) => lab[i] === j); if (mine.length) c[j] = [0, 1, 2].map((a) => mine.reduce((s, x) => s + x[a], 0) / mine.length); });
  }
  return { centres: c.map((x) => x.map(Math.round)), lab };
}

export async function lowpoly(src, budget, k = K) {
  const D = await dense(await io.read(src)), W = weldByPosition(D.pos, D.tri);
  let [idx] = MS.simplify(W.tri, W.pos, 3, budget * 3, 1, ['ErrorAbsolute', 'Prune']);
  if (idx.length > budget * 3 * 1.2) [idx] = MS.simplifySloppy(W.tri, W.pos, 3, null, budget * 3, 1);     // torn or non-manifold scans stop the careful simplifier early
  const faces = idx.length / 3, fc = [], N = D.pos.length / 3;
  for (let f = 0; f < faces; f++) {                                  // the colour painted under the face: the original vertex nearest its centre and its three corners
    const ps = [0, 1, 2].map((j) => [...W.pos.subarray(idx[f * 3 + j] * 3, idx[f * 3 + j] * 3 + 3)]), pts = [[0, 1, 2].map((a) => (ps[0][a] + ps[1][a] + ps[2][a]) / 3), ...ps];
    const near = pts.map((p) => { let b = 0, bd = Infinity; for (let i = 0; i < N; i++) { const dd = (D.pos[i * 3] - p[0]) ** 2 + (D.pos[i * 3 + 1] - p[1]) ** 2 + (D.pos[i * 3 + 2] - p[2]) ** 2; if (dd < bd) { bd = dd; b = i; } } return D.col.slice(b * 3, b * 3 + 3); });
    fc.push([0, 1, 2].map((a) => (2 * near[0][a] + near[1][a] + near[2][a] + near[3][a]) / 5));
  }
  const { centres, lab } = palette(fc, k), n = centres.length;
  const png = await sharp(Buffer.from(centres.flat().map((v) => Math.max(0, Math.min(255, v)))), { raw: { width: n, height: 1, channels: 3 } }).png().toBuffer();
  const doc = new Document(), buf = doc.createBuffer(), P = new Float32Array(faces * 9), UV = new Float32Array(faces * 6);
  for (let f = 0; f < faces; f++) for (let j = 0; j < 3; j++) { P.set(W.pos.subarray(idx[f * 3 + j] * 3, idx[f * 3 + j] * 3 + 3), f * 9 + j * 3); UV.set([(lab[f] + 0.5) / n, 0.5], f * 6 + j * 2); }      // every face its own corners: flat shading, one palette cell
  const tex = doc.createTexture('palette').setImage(png).setMimeType('image/png');
  const mat = doc.createMaterial('paint').setBaseColorTexture(tex).setRoughnessFactor(0.85).setMetallicFactor(0);
  mat.getBaseColorTextureInfo().setMagFilter(9728).setMinFilter(9728);   // NEAREST: each face keeps one clean colour
  const prim = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(buf)).setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(UV).setBuffer(buf));
  doc.createScene().addChild(doc.createNode('figure').setMesh(doc.createMesh().addPrimitive(prim)));
  return { doc, faces, colours: n, before: D.tri.length / 3 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let n = 0;
  for (const id of pick(Object.keys(T.types))) {
    const src = at(`3-model/${id}/raw.glb`); if (!existsSync(src)) continue;
    const r = await lowpoly(src.pathname, T.kinds[T.types[id].kind].tris); mkdirSync(at(`4-lowpoly/${id}/`), { recursive: true });
    const out = at(`4-lowpoly/${id}/${id}.glb`); await io.write(out.pathname, r.doc); n++;
    console.log(`${id}: ${r.before} -> ${r.faces} faces, ${r.colours} colours, ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
  logRun('lowpoly', 'local (meshoptimizer)', n, 'free');
}
