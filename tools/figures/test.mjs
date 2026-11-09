// Self-check of the steps that run without any AI service: list, prompts, low-poly (4), Mixamo export (5), install (6), on a made-up dense
// sphere painted red on top and grey below (a stand-in for an AI model).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const run = (...a) => execFileSync('node', a, { cwd: new URL('.', import.meta.url), env: { ...process.env, FIG_TEST: '1' }, encoding: 'utf8' });
const at = (f) => new URL(f, import.meta.url), types = ['cover', 'us44-inf'], TY = JSON.parse(readFileSync(at('types.json')));
run('1-list/list.mjs'); run('2-concept/prompts.mjs');
const P = JSON.parse(readFileSync(at('2-concept/prompts.json')));
assert.equal(Object.keys(P).length, Object.keys(TY.types).length);
assert.ok(Object.values(P).every((p) => p.prompt.startsWith(TY.style) && !/swastika/i.test(p.prompt)), 'every prompt carries the style and no forbidden symbol');
if (types.some((t) => ['3-model', '4-lowpoly', '5-animate'].some((d) => existsSync(at(`${d}/${t}`))))) { console.log('real models present for the test types: skipping the model checks'); process.exit(0); }

const doc = new Document(), buf = doc.createBuffer(), pos = [], uv = [], idx = [], R = 80;            // 12 800 triangles, 2 units wide, off the origin
for (let i = 0; i <= R; i++) for (let j = 0; j <= R; j++) { const a = (i / R) * Math.PI, b = (j / R) * 2 * Math.PI; pos.push(3 + Math.sin(a) * Math.cos(b), 5 + Math.cos(a), Math.sin(a) * Math.sin(b)); uv.push(j / R, i / R); }
for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) { const p = i * (R + 1) + j; idx.push(p, p + R + 1, p + 1, p + 1, p + R + 1, p + R + 2); }
const noise = await sharp({ create: { width: 64, height: 64, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 12 } } }).raw().toBuffer();
const px = Buffer.alloc(64 * 64 * 3); for (let k = 0; k < 64 * 64; k++) { const top = k < 32 * 64, n = noise[k * 3] - 128; px.set(top ? [200 + n / 4, 40, 30] : [120 + n / 4, 120 + n / 4, 110], k * 3); }
const tex = doc.createTexture().setImage(await sharp(px, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer()).setMimeType('image/png');
const prim = doc.createPrimitive().setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf))
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)).setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf))
  .setMaterial(doc.createMaterial().setBaseColorTexture(tex));
doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
const out = mkdtempSync(join(tmpdir(), 'fig-')), io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
try {
  for (const t of types) { mkdirSync(at(`3-model/${t}`), { recursive: true }); await new NodeIO().write(at(`3-model/${t}/raw.glb`).pathname, doc); }
  console.log(run('4-lowpoly/make.mjs', ...types));
  for (const t of types) {
    const lp = await io.read(at(`4-lowpoly/${t}/${t}.glb`).pathname), pr = lp.getRoot().listMeshes()[0].listPrimitives()[0], faces = pr.getAttribute('POSITION').getCount() / 3, budget = TY.kinds[TY.types[t].kind].tris;
    assert.ok(faces <= budget * 1.2 && faces >= budget * 0.5, `${t}: ${faces} faces for a budget of ${budget}`);
    assert.ok(!pr.getAttribute('NORMAL') && !pr.getIndices(), `${t}: unshared corners, so every face is flat`);
    const info = pr.getMaterial().getBaseColorTextureInfo(), pal = await sharp(Buffer.from(pr.getMaterial().getBaseColorTexture().getImage())).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.getMagFilter(), 9728); assert.ok(pal.info.width <= 16 && pal.info.height === 1, 'a palette of at most 16 colours');
    const cols = [...Array(pal.info.width).keys()].map((i) => [...pal.data.subarray(i * 3, i * 3 + 3)]);
    assert.ok(cols.some(([r, g, b]) => r > 150 && g < 80 && b < 80) && cols.some(([r, g, b]) => Math.abs(r - g) < 25 && r > 80 && r < 170), `${t}: the red top and the grey bottom both survive (${JSON.stringify(cols)})`);
  }
  run('5-animate/make.mjs', 'export', 'us44-inf');
  const obj = readFileSync(at('5-animate/us44-inf/upload/model.obj'), 'utf8'), vs = obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(' ').map(Number)), ys = vs.map((v) => v[2]), xs = vs.map((v) => v[1]);
  assert.ok(Math.abs(Math.min(...ys)) < 0.01 && Math.abs(Math.max(...ys) - 180) < 0.01 && Math.abs(Math.min(...xs) + Math.max(...xs)) < 0.01 && existsSync(at('5-animate/us44-inf/upload/texture.png')), 'Mixamo upload stands on the ground, 180 tall, centred, painted');
  console.log(run('6-game/install.mjs', ...types, `--to=${out}`));
  for (const [t, w, axis] of [['cover', 1.2, 'wide'], ['us44-inf', 0.55, 'tall']]) {
    const g = await io.read(join(out, `${t}.glb`)), { min, max } = getBounds(g.getRoot().listScenes()[0]);
    const size = axis === 'tall' ? max[1] - min[1] : Math.max(max[0] - min[0], max[2] - min[2]);
    assert.ok(Math.abs(size - w) < 0.01 && Math.abs(min[1]) < 0.01 && Math.abs(min[0] + max[0]) < 0.01, `${t} scaled to ${w}, on the ground, centred`);
    assert.equal(g.getRoot().listMaterials()[0].getBaseColorTextureInfo().getMagFilter(), 9728, `${t}: the palette stays crisp in the game file`);
  }
  const m = JSON.parse(readFileSync(join(out, 'figures.json')));
  assert.equal(m.hidden, 'cover'); assert.equal(m.pieces['bulge:B35'], 'us44-inf'); assert.ok(!Object.values(m.pieces).includes('de44-panther'), 'only installed types are listed');
  console.log('figures pipeline: all checks passed');
} finally { for (const t of types) for (const d of ['3-model', '4-lowpoly', '5-animate']) rmSync(at(`${d}/${t}`), { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); }
