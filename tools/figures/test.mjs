// Self-check of the steps that run here without any AI service: list, prompts, reduce (3), Mixamo export (4), install (5), on a made-up textured sphere.
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
const at = (f) => new URL(f, import.meta.url), types = ['cover', 'us44-inf'];
run('1-list/list.mjs'); run('2-concept/prompts.mjs');
const P = JSON.parse(readFileSync(at('2-concept/prompts.json')));
assert.equal(Object.keys(P).length, Object.keys(JSON.parse(readFileSync(at('types.json'))).types).length);
assert.ok(Object.values(P).every((p) => Object.keys(p.views).length === 3 && !/swastika/i.test(Object.values(p.views).join())));
if (types.some((t) => existsSync(at(`3-model/${t}`)) || existsSync(at(`4-animate/${t}`)))) { console.log('real models present for the test types: skipping the model checks'); process.exit(0); }

const doc = new Document(), buf = doc.createBuffer(), pos = [], uv = [], idx = [], R = 60;           // a 7200-triangle sphere, 2 units wide, centred off the origin
for (let i = 0; i <= R; i++) for (let j = 0; j <= R; j++) { const a = (i / R) * Math.PI, b = (j / R) * 2 * Math.PI; pos.push(3 + Math.sin(a) * Math.cos(b), 5 + Math.cos(a), Math.sin(a) * Math.sin(b)); uv.push(j / R, i / R); }
for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) { const p = i * (R + 1) + j; idx.push(p, p + R + 1, p + 1, p + 1, p + R + 1, p + R + 2); }
const tex = doc.createTexture().setImage(await sharp({ create: { width: 64, height: 64, channels: 3, noise: { type: 'gaussian', mean: 110, sigma: 40 } } }).png().toBuffer()).setMimeType('image/png');
const prim = doc.createPrimitive().setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf))
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)).setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf))
  .setMaterial(doc.createMaterial().setBaseColorTexture(tex));
doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
const out = mkdtempSync(join(tmpdir(), 'fig-'));
try {
  for (const t of types) { mkdirSync(at(`3-model/${t}`), { recursive: true }); await new NodeIO().write(at(`3-model/${t}/raw.glb`).pathname, doc); }
  console.log(run('3-model/make.mjs', ...types));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }); await MeshoptDecoder.ready;
  const red = await io.read(at('3-model/cover/cover.glb').pathname), tri = red.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
  assert.ok(tri < 1600, `cover reduced to its 800-triangle budget, got ${tri}`);
  run('4-animate/make.mjs', 'export', 'us44-inf');
  const obj = readFileSync(at('4-animate/us44-inf/upload/model.obj'), 'utf8'), vs = obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => l.split(' ').map(Number)), ys = vs.map((v) => v[2]), xs = vs.map((v) => v[1]);
  assert.ok(Math.abs(Math.min(...ys)) < 0.01 && Math.abs(Math.max(...ys) - 180) < 0.01 && Math.abs(Math.min(...xs) + Math.max(...xs)) < 0.01 && existsSync(at('4-animate/us44-inf/upload/texture.png')), 'Mixamo upload stands on the ground, 180 tall, textured');
  console.log(run('5-game/install.mjs', ...types, `--to=${out}`));
  for (const [t, w, axis] of [['cover', 1.2, 'wide'], ['us44-inf', 0.55, 'tall']]) {
    const g = await io.read(join(out, `${t}.glb`)), { min, max } = getBounds(g.getRoot().listScenes()[0]);
    const size = axis === 'tall' ? max[1] - min[1] : Math.max(max[0] - min[0], max[2] - min[2]);
    assert.ok(Math.abs(size - w) < 0.01 && Math.abs(min[1]) < 0.01 && Math.abs(min[0] + max[0]) < 0.01, `${t} scaled to ${w}, on the ground, centred`);
  }
  const m = JSON.parse(readFileSync(join(out, 'figures.json')));
  assert.equal(m.hidden, 'cover'); assert.equal(m.pieces['bulge:B35'], 'us44-inf'); assert.ok(!Object.values(m.pieces).includes('de44-panther'), 'only installed types are listed');
  console.log('figures pipeline: all checks passed');
} finally { for (const t of types) { rmSync(at(`3-model/${t}`), { recursive: true, force: true }); rmSync(at(`4-animate/${t}`), { recursive: true, force: true }); } rmSync(out, { recursive: true, force: true }); }
