import * as THREE from 'three';

/** A set of d10 shown together: engine rolls already happened, the dice only perform them. */
export interface DiceGroup { label: string; col: 'w' | 'k' | 's'; sn: number; dice: number[] }
export const isHit = (d: number, sn: number) => d === 1 || (d !== 10 && d <= sn);

const DIE = { w: ['#f2efe6', '#161616'], k: ['#1d1d20', '#f3f3f3'], s: ['#6c7782', '#ffffff'] } as const;
function faces() {                                              // pentagonal trapezohedron: 10 kites, apex height fixed by planarity
  const R = 1, h = 0.1, ring = Array.from({ length: 10 }, (_, k) => new THREE.Vector3(R * Math.cos(k * Math.PI / 5), k % 2 ? h : -h, R * Math.sin(k * Math.PI / 5)));
  const A = ring[1], n = new THREE.Vector3().subVectors(ring[3], A).cross(new THREE.Vector3().subVectors(ring[2], A)), H = n.dot(A) / n.y;
  const T = new THREE.Vector3(0, H, 0), B = new THREE.Vector3(0, -H, 0), out: { num: number; apex: THREE.Vector3; v: THREE.Vector3[] }[] = [];
  for (let i = 0; i < 5; i++) out.push({ num: 2 * i + 1, apex: T, v: [T, ring[2 * i + 1], ring[(2 * i + 2) % 10], ring[(2 * i + 3) % 10]] });
  for (let j = 0; j < 5; j++) out.push({ num: 10 - 2 * ((j + 2) % 5), apex: B, v: [B, ring[2 * j], ring[2 * j + 1], ring[(2 * j + 2) % 10]] });
  return out;
}
const texCache = new Map<string, THREE.CanvasTexture>();
const TONE = { g: '#2fe073', r: '#ff5a4d' } as const;
function faceTex(num: number, col: keyof typeof DIE, tone?: 'g' | 'r') {
  const key = col + num + (tone ?? ''); let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!; x.fillStyle = DIE[col][0]; x.fillRect(0, 0, 256, 256);
  const g = x.createRadialGradient(100, 90, 20, 128, 128, 200); g.addColorStop(0, '#ffffff22'); g.addColorStop(1, '#00000033'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = tone ? TONE[tone] : DIE[col][1]; x.font = '700 78px "Saira Condensed", Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), 128, 124);
  if (num === 6 || num === 9) x.fillRect(114, 164, 28, 8);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}
function makeDie(col: keyof typeof DIE) {
  const group = new THREE.Group(), normals: Record<number, THREE.Vector3> = {}, ups: Record<number, THREE.Vector3> = {}, meshes: Record<number, THREE.Mesh> = {};
  for (const f of faces()) {
    const [a, b, c, d] = f.v, cen = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
    const nrm = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)); if (nrm.dot(cen) < 0) nrm.negate(); nrm.normalize();
    const up = new THREE.Vector3().subVectors(f.apex, cen).projectOnPlane(nrm).normalize(), right = new THREE.Vector3().crossVectors(up, nrm).normalize();
    const pos: number[] = [], uv: number[] = [];
    for (const p of [a, b, c, d]) { const r = new THREE.Vector3().subVectors(p, cen); pos.push(p.x, p.y, p.z); uv.push(0.5 + r.dot(right) * 0.4, 0.5 + r.dot(up) * 0.4); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(nrm.dot(new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: faceTex(f.num, col), roughness: 0.32, metalness: 0.08, side: THREE.DoubleSide })); m.castShadow = true; group.add(m); normals[f.num] = nrm; ups[f.num] = up; meshes[f.num] = m;
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col === 'w' ? 0x8d8a80 : 0x000000, transparent: true, opacity: 0.5 })));
  }
  group.scale.setScalar(1.0);
  return { group, normals, ups, meshes, col };
}

let stop: (() => void) | null = null;
export function clearDice() { stop?.(); stop = null; }

/** Throws the dice onto `cv` and calls `done` with the screen position of each die once they settle. */
export function throwDice(cv: HTMLCanvasElement, groups: DiceGroup[], done: (pos: { x: number; y: number; group: number; v: number }[]) => void) {
  clearDice();
  const w = cv.clientWidth || 1280, h = cv.clientHeight || 720, r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  r.setSize(w, h, false); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.shadowMap.enabled = true;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 100); cam.position.set(0, 12, 8.6).multiplyScalar(Math.max(1, 1.25 / (w / h))); cam.lookAt(0, 0, 0.6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 0.9)); const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-4, 9, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 }); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const all = groups.flatMap((g, gi) => g.dice.map((v) => ({ g, gi, v }))), per = all.length > 5 ? Math.ceil(all.length / 2) : all.length, sp = 2.3, quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = all.map((d, k) => {
    const die = makeDie(d.g.col), row = k < per ? 0 : 1, col = row ? k - per : k, inRow = row ? all.length - per : per, x = (col - (inRow - 1) / 2) * sp, z = all.length > 5 ? (row ? 1.1 : -1.1) : 0.2;
    const q0 = new THREE.Quaternion().setFromUnitVectors(die.normals[d.v].clone(), new THREE.Vector3(0, 1, 0)), upT = die.ups[d.v].clone().applyQuaternion(q0), qEnd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - Math.atan2(upT.x, upT.z)).multiply(q0);   // lands with the number upright for the viewer
    const sx = x - 6 + Math.random(), sz = z - 5; die.group.position.set(sx, 5, sz); scene.add(die.group);
    return { die, x, z, sx, sz, qEnd, axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 9 + Math.random() * 6, delay: k * 0.07, dur: 1.4 + Math.random() * 0.4, d };
  });
  const t0 = performance.now(), ease = (t: number) => 1 - Math.pow(1 - t, 3); let raf = 0, finished = false, dead = false;
  const q = new THREE.Quaternion();
  const frame = () => {
    const t = (performance.now() - t0) / 1000; let fin = true;
    for (const it of items) {
      const u = quick ? 1 : Math.min(1, Math.max(0, (t - it.delay) / it.dur)); if (u < 1) fin = false; const e = ease(u), p = it.die.group;
      p.position.set(it.sx + (it.x - it.sx) * e, 0.4 + Math.abs(Math.sin(u * Math.PI * 3.2)) * (1 - u) * 2.4 + (1 - e) * 1.2, it.sz + (it.z - it.sz) * e);
      p.quaternion.copy(q.setFromAxisAngle(it.axis, (1 - e) * it.spin)).multiply(it.qEnd);
    }
    r.render(scene, cam);
    if (fin && !finished) {
      finished = true;
      for (const it of items) { const hit = isHit(it.d.v, it.d.g.sn); (it.die.meshes[it.d.v].material as THREE.MeshStandardMaterial).map = faceTex(it.d.v, it.d.g.col, hit ? 'g' : 'r'); (it.die.meshes[it.d.v].material as THREE.MeshStandardMaterial).needsUpdate = true; }
      done(items.map((it) => { const v = new THREE.Vector3(it.x, 0.2, it.z + 1.0).project(cam); return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, group: it.d.gi, v: it.d.v }; })); }
    if (!dead) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  stop = () => { dead = true; cancelAnimationFrame(raf); r.dispose(); r.clear(); };
}
