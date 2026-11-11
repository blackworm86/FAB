// 3D figures in place of the wooden blocks (The Bulge): ONE figure per unit, all at one scale over the whole map, Germans facing
// west and the Allies east; a ring in the side's colour round it and its pips (one per step) floating above. The game's own block
// layout places it, given the figure's footprint. Figures come from tools/pezzi3d (strumenti/separa_figure.py); docs/ASSETS-3D.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Troop = { figs: THREE.Object3D[]; size: THREE.Vector3 };
type Index = { tipi: Record<string, { figure: string[]; veicolo: boolean }>; blocchi: Record<string, string> };

/** One scale for every figure on the map (figures are at 0.18 board units per metre): a Sherman is 1.6 long, about one block wide. */
export const SCALE = 1.5;
/** Soldiers are drawn 3× larger than true scale (owner, 11 November 2026): a lone soldier at true scale is a speck; at 3× he stands about as tall as a tank. */
export const INFANTRY = 3;
/** The player's figure size (View window): every figure, ring and footprint grows by the same factor, so proportions stay. */
let zoom = 1.5;
export const setZoom = (z: number) => { zoom = z; };
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
      gl.scene.scale.setScalar(SCALE * (t.veicolo ? 1 : INFANTRY));
      return gl.scene;
    })));
    troops.set(tipo, { figs, size: new THREE.Box3().setFromObject(figs[0]).getSize(new THREE.Vector3()) });
  }));
  byUnit = idx.blocchi;
  return troops.size > 0;
}
export const troopOf = (unitId: string) => troops.get(byUnit[unitId]) ?? null;

/** Which of its type's figures a unit shows: fixed per unit, so neighbouring units of one type look different. */
export const variant = (unitId: string, count: number) => [...unitId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % count;
/** The Bulge: Germans face west, the Allies east (yaw about Y; a figure is modelled facing +z). The other volumes pass their own
 * facing (each side toward the other's edge of the map: main.ts). */
export const yawOf = (side: string) => (side === 'german' ? -Math.PI / 2 : Math.PI / 2);
/** A unit's footprint on the map for a facing: [width along x, depth along z], with room for its ring. */
export function foot(t: Pick<Troop, 'size'>, yaw: number): [number, number] {
  const across = Math.abs(Math.sin(yaw)) > 0.5, x = t.size.x * zoom + 0.3, z = t.size.z * zoom + 0.3;
  return across ? [z, x] : [x, z];
}
/** An ordered layout: each group (a side) in rows of at most cols units, the groups one under the other (the first toward -z),
 * all centred on (0, 0). Returns each unit's centre, group by group. Nothing overlaps: every unit gets its full footprint plus gap. */
export function grid(groups: [number, number][][], cols: number, gap = 0.15): [number, number][][] {
  const rows: { items: [number, number][]; g: number; i0: number }[] = [];
  groups.forEach((gr, g) => { for (let i = 0; i < gr.length; i += cols) rows.push({ items: gr.slice(i, i + cols), g, i0: i }); });
  const depth = (r: { items: [number, number][] }) => Math.max(...r.items.map((f) => f[1]));
  const total = rows.reduce((a, r) => a + depth(r), 0) + gap * (rows.length - 1) + 0.3 * (groups.filter((x) => x.length).length - 1);
  const out = groups.map((gr) => gr.map(() => [0, 0] as [number, number]));
  let z = -total / 2, prev = -1;
  for (const r of rows) {
    if (prev !== -1 && r.g !== prev) z += 0.3;                                    // a little more room between the two sides
    const d = depth(r), w = r.items.reduce((a, f) => a + f[0], 0) + gap * (r.items.length - 1); let x = -w / 2;
    r.items.forEach((f, k) => { out[r.g][r.i0 + k] = [x + f[0] / 2, z + d / 2]; x += f[0] + gap; });
    z += d + gap; prev = r.g;
  }
  return out;
}
/** Footprint radius of a unit's figure, for the block layout (never less than a small disc, so pips and ring stay clear of the next unit). */
export const radius = (t: Pick<Troop, 'size'>) => Math.max(0.55, Math.max(t.size.x, t.size.z) * zoom / 2 + 0.12);

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
/** A rounded rectangle round the figure's footprint (w along x, d along z), with a faint fill, in the side's colour. */
function ring(w: number, d: number, color: THREE.ColorRepresentation, selected: boolean) {
  const rr = Math.min(w, d) / 2, rect = (W: number, D: number, R: number) => { const s = new THREE.Shape(), x = W / 2, z = D / 2;
    s.moveTo(-x + R, -z); s.lineTo(x - R, -z); s.quadraticCurveTo(x, -z, x, -z + R); s.lineTo(x, z - R); s.quadraticCurveTo(x, z, x - R, z);
    s.lineTo(-x + R, z); s.quadraticCurveTo(-x, z, -x, z - R); s.lineTo(-x, -z + R); s.quadraticCurveTo(-x, -z, -x + R, -z); return s; };
  const k = selected ? 0.13 : 0.07, outer = rect(w, d, rr), inner = rect(w - 2 * k, d - 2 * k, Math.max(0.01, rr - k));
  outer.holes.push(new THREE.Path(inner.getPoints()));
  const g = new THREE.Group(), col = selected ? 0xe7b04a : color;
  const edge = new THREE.Mesh(new THREE.ShapeGeometry(outer), new THREE.MeshBasicMaterial({ color: col }));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(rect(w, d, rr)), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: selected ? 0.3 : 0.18, depthWrite: false }));
  for (const m of [edge, fill]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); }
  return g;
}
/** A unit drawn as its figure, centred on the group's origin (the spot the block would take). */
/** yaw: overrides the side's usual facing (in battle the two sides face each other). */
export function troopGroup(t: Troop, unitId: string, side: string, color: THREE.ColorRepresentation, n: number, quality: string, selected: boolean, yaw = yawOf(side)) {
  const g = new THREE.Group(), f = t.figs[variant(unitId, t.figs.length)].clone(true);
  f.rotation.y = yaw; f.scale.multiplyScalar(zoom); g.add(f);
  const across = Math.abs(Math.sin(yaw)) > 0.5, sz = t.size.clone().multiplyScalar(zoom);   // facing east or west: the figure's length lies along x
  g.add(ring((across ? sz.z : sz.x) + 0.3, (across ? sz.x : sz.z) + 0.3, color, selected));
  const s = pips(n, quality); s.position.y = sz.y + 0.35; g.add(s);
  g.userData.troop = true; g.userData.top = sz.y;
  return g;
}
