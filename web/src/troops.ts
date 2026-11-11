// 3D figures in place of the wooden blocks (The Bulge): one figure per step, deployed inside the unit's area, spread out and
// facing the nearest enemy, drawn as big as the area allows; a ring in the side's colour round the unit and its pips floating above.
// Approved mockup: claude.ai/artifact/SpjUQ4nNP3885wy4kxiTop. Figures come from tools/pezzi3d (strumenti/separa_figure.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Troop = { figs: THREE.Object3D[]; vehicle: boolean; size: THREE.Vector3 };
type Index = { tipi: Record<string, { figure: string[]; veicolo: boolean }>; blocchi: Record<string, string> };

let byUnit: Record<string, string> = {};
const troops = new Map<string, Troop>();

/** Loads a volume's figures (web/public/pezzi/<vol>.json and its .glb files). Resolves false when the volume has none. */
export async function loadTroops(vol: string, base = './'): Promise<boolean> {
  const r = await fetch(`${base}pezzi/${vol}.json`).catch(() => null);
  if (!r?.ok) return false;
  const idx = (await r.json()) as Index, loader = new GLTFLoader();
  await Promise.all(Object.entries(idx.tipi).map(async ([tipo, t]) => {
    const figs = await Promise.all(t.figure.map((f) => loader.loadAsync(`${base}pezzi/${f}`).then((gl) => {
      gl.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.userData.shared = true; } });   // shared by every copy: never disposed with the board
      return gl.scene;
    })));
    troops.set(tipo, { figs, vehicle: t.veicolo, size: new THREE.Box3().setFromObject(figs[0]).getSize(new THREE.Vector3()) });
  }));
  byUnit = idx.blocchi;
  return troops.size > 0;
}
export const troopOf = (unitId: string) => troops.get(byUnit[unitId]) ?? null;

/** Local slots for n figures at scale k: x across the front, z toward the rear, j a small turn. Infantry: an open line,
 * every other man a step back; vehicles: a wedge, the leader ahead and the others staggered on both flanks. */
export function slots(t: Pick<Troop, 'vehicle' | 'size'>, n: number, k: number, rnd: () => number): [number, number, number][] {
  const out: [number, number, number][] = [], b = t.size.clone().multiplyScalar(k);
  if (t.vehicle) {
    const lat = b.x * 1.7 + 0.15, back = b.z * 0.55;
    for (let i = 0; i < n; i++) { const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2); out.push([side * lat + (rnd() - 0.5) * 0.15, Math.ceil(i / 2) * back + (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.35]); }
  } else {
    const lat = 0.3 * k + 0.08;
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * lat + (rnd() - 0.5) * 0.12, (i % 2) * 0.2 * k + (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.8]);
  }
  return out;
}
export const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
/** Footprint radius of one figure at scale k. */
export const radius = (t: Pick<Troop, 'size'>, k: number) => Math.max(t.size.x, t.size.z) * k / 2;

export type Room = (x: number, z: number, r: number) => boolean;
/** A test for "a disc of radius r at (x, z) lies inside this polygon" (world x, z). */
export function roomOf(poly: { x: number; z: number }[]): Room {
  const inside = (x: number, z: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; } return c; };
  const edge = (x: number, z: number) => { let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[j], b = poly[i], vx = b.x - a.x, vz = b.z - a.z,
    t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz || 1))); d = Math.min(d, Math.hypot(x - a.x - t * vx, z - a.z - t * vz)); } return d; };
  return (x, z, r) => inside(x, z) && edge(x, z) >= r;
}

export type Place = { fig: [number, number, number][]; k: number; r: number };
export const SIZES = [3, 2.6, 2.2, 1.9, 1.6, 1.35, 1.15, 1, 0.8, 0.6];
const BLOCK_R = 0.95;
/** Deploys an area's units (troop, or null for a plain block, with n figures) round its centre c, facing (fx, fz):
 * the largest size at which every unit fits inside the area, clear of the obstacles and of each other. null: nothing fits. */
export function deploy(units: { t: Pick<Troop, 'vehicle' | 'size'> | null; n: number }[], room: Room, c: { x: number; z: number }, spread: number,
  facing: [number, number], obstacles: { x: number; z: number; r: number }[], seed: number): Place[] | null {
  const [fx, fz] = facing, ax = [fz, -fx], av = [-fx, -fz];
  for (const k of SIZES) {
    const rnd = rng(seed * 97 + Math.round(k * 100)), taken = [...obstacles], out: Place[] = [];
    for (const u of units) {
      const loc = u.t ? slots(u.t, u.n, k, rnd) : [[0, 0, 0] as [number, number, number]], r = u.t ? radius(u.t, k) : BLOCK_R;
      let best: [number, number, number][] | null = null, score = -1;
      for (let i = 0; i < 400; i++) {
        const px = c.x + (rnd() - 0.5) * spread, pz = c.z + (rnd() - 0.5) * spread;
        const fig = loc.map(([lx, lz, j]) => [px + lx * ax[0] + lz * av[0], pz + lx * ax[1] + lz * av[1], j] as [number, number, number]);
        if (!fig.every(([x, z]) => room(x, z, r + 0.1))) continue;
        let gap = 99; for (const q of taken) for (const [x, z] of fig) gap = Math.min(gap, Math.hypot(x - q.x, z - q.z) - q.r - r);
        if (gap < 0.15) continue;
        const s = taken.length > obstacles.length ? gap : 3 - Math.hypot(px - c.x, pz - c.z) * 0.3;      // the first unit near the centre, the next ones as far apart as they can
        if (s > score) { score = s; best = fig; }
      }
      if (!best) break;
      for (const [x, z] of best) taken.push({ x, z, r });
      out.push({ fig: best, k: u.t ? k : 1, r });
    }
    if (out.length === units.length) return out;
  }
  return null;
}
/** The largest size at which a unit's formation fits in a disc of radius R round one spot (crowded and battle areas). */
export function fitAt(t: Pick<Troop, 'vehicle' | 'size'>, n: number, R: number, x: number, z: number, facing: [number, number], seed: number): Place {
  const [fx, fz] = facing, ax = [fz, -fx], av = [-fx, -fz];
  for (const k of [...SIZES, 0.45, 0.3]) {
    const loc = slots(t, n, k, rng(seed)), r = radius(t, k), mx = loc.reduce((a, p) => a + p[0], 0) / n, mz = loc.reduce((a, p) => a + p[1], 0) / n;
    if (loc.every(([lx, lz]) => Math.hypot(lx - mx, lz - mz) + r <= R) || k === 0.3)
      return { k, r, fig: loc.map(([lx, lz, j]) => [x + (lx - mx) * ax[0] + (lz - mz) * av[0], z + (lx - mx) * ax[1] + (lz - mz) * av[1], j]) };
  }
  throw new Error('unreachable');
}

const PIP: Record<string, [string, string]> = { elite: ['#e3222b', '#ffffff'], veteran: ['#141414', '#ffffff'], green: ['#ffffff', '#141414'] };
const pipMats = new Map<string, THREE.SpriteMaterial>();
/** The unit's pips as one strip that always faces the camera and stays level on screen. */
function pips(n: number, q: string) {
  const key = `${n}${q}`; let m = pipMats.get(key);
  if (!m) {
    const c = document.createElement('canvas'); c.width = 64 * n; c.height = 64; const x = c.getContext('2d')!, [fill, ring] = PIP[q] ?? PIP.veteran;
    for (let i = 0; i < n; i++) { x.beginPath(); x.arc(32 + 64 * i, 32, 28, 0, 7); x.fillStyle = ring; x.fill(); x.beginPath(); x.arc(32 + 64 * i, 32, 21, 0, 7); x.fillStyle = fill; x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }); pipMats.set(key, m);
  }
  const s = new THREE.Sprite(m); s.scale.set(0.3 * n, 0.3, 1); s.renderOrder = 3; return s;
}
/** Rounded outline (convex hull of the figures' footprints, grown a little) with a faint fill, in the side's colour. */
function ring(fig: [number, number, number][], r: number, color: THREE.ColorRepresentation, selected: boolean) {
  const grow = 0.16, pts: [number, number][] = [];
  for (const [x, z] of fig) for (let a = 0; a < 16; a++) pts.push([x + Math.cos(a / 8 * Math.PI) * (r + grow), z + Math.sin(a / 8 * Math.PI) * (r + grow)]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo: [number, number][] = [], hi: [number, number][] = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...pts].reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)), cx = h.reduce((a, p) => a + p[0], 0) / h.length, cz = h.reduce((a, p) => a + p[1], 0) / h.length, w = selected ? 0.13 : 0.07;
  const shape = new THREE.Shape(h.map(([x, z]) => new THREE.Vector2(x, -z)));
  shape.holes.push(new THREE.Path(h.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz) || 1; return new THREE.Vector2(x - (x - cx) / l * w, -(z - (z - cz) / l * w)); }).reverse()));
  const g = new THREE.Group(), col = selected ? 0xe7b04a : color;
  const edge = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: col }));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(h.map(([x, z]) => new THREE.Vector2(x, -z)))), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: selected ? 0.3 : 0.18, depthWrite: false }));
  for (const m of [edge, fill]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); }
  return g;
}
/** A unit drawn as figures. Its origin is the formation's centre, so markers and the camera treat it like a block. */
export function troopGroup(t: Troop, p: Place, yaw: number, color: THREE.ColorRepresentation, n: number, quality: string, selected: boolean) {
  const g = new THREE.Group(), cx = p.fig.reduce((a, f) => a + f[0], 0) / p.fig.length, cz = p.fig.reduce((a, f) => a + f[1], 0) / p.fig.length;
  g.position.set(cx, 0, cz);
  p.fig.forEach(([x, z, j], i) => { const f = t.figs[i % t.figs.length].clone(true); f.scale.setScalar(p.k); f.position.set(x - cx, 0, z - cz); f.rotation.y = yaw + j * 0.4; g.add(f); });
  g.add(ring(p.fig.map(([x, z, j]) => [x - cx, z - cz, j]), p.r, color, selected));
  const s = pips(n, quality); s.position.y = t.size.y * p.k + 0.35; g.add(s);
  g.userData.troop = true; g.userData.top = t.size.y * p.k;
  return g;
}
