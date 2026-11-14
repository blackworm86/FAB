// 3D figures in place of the wooden blocks (The Bulge): ONE figure per unit, all at one scale over the whole map, Germans facing
// west and the Allies east; a ring in the side's colour round it and its pips (one per step) floating above. The game's own block
// layout places it, given the figure's footprint. Figures come from tools/pezzi3d (strumenti/separa_figure.py); docs/ASSETS-3D.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let studio: THREE.Texture | null = null;
/** The figures' look: painted plastic toy soldiers. A soft studio light reflected on them (only on figures: the board keeps its look),
 * a satin clear coat, no metal. The decoy (ghost) is the same model as a pale see-through glass piece. */
export function toyMaterial(map: THREE.Texture | null, ghost = false) {
  const m = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
    envMap: studio,
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
  });
  if (ghost)
    Object.assign(m, {
      color: new THREE.Color(0xcfe6ff),
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      emissive: new THREE.Color(0x6aa8ff),
      emissiveIntensity: 0.25,
    });
  return m;
}
/** Builds the studio light once (needs the renderer); call before loadTroops. */
export function setStudio(r: THREE.WebGLRenderer) {
  if (studio) return;
  const pm = new THREE.PMREMGenerator(r);
  studio = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}

export type Troop = { figs: THREE.Object3D[]; size: THREE.Vector3 };
type Index = { tipi: Record<string, { figure: string[]; veicolo: boolean; lunghezza?: number }>; blocchi: Record<string, string> };

/** One scale for every figure on the map (figures are at 0.18 board units per metre): a Sherman is 1.6 long, about one block wide. */
export const SCALE = 1.5;
/** Soldiers are drawn 3× larger than true scale (owner, 11 November 2026): a lone soldier at true scale is a speck; at 3× he stands about as tall as a tank. */
export const INFANTRY = 3;
/** The player's figure size (View window): every figure, ring and footprint grows by the same factor, so proportions stay. */
let zoom = 1.5;
export const setZoom = (z: number) => {
  zoom = z;
};
let byUnit: Record<string, string> = {};
const troops = new Map<string, Troop>();

/** Loads a volume's figures (web/public/pezzi/<vol>.json and its .glb files). Resolves false when the volume has none. */
export async function loadTroops(vol: string, base = './'): Promise<boolean> {
  const r = await fetch(`${base}pezzi/${vol}.json`).catch(() => null);
  if (!r?.ok) return false;
  const idx = (await r.json()) as Index,
    loader = new GLTFLoader();
  /** The owner's choices from the kit's Orientamento tab: which figure of a type to use, and each figure's turn and origin nudge. */
  const cfg = (await fetch(`${base}pezzi/${vol}_config.json`)
    .then((c) => (c.ok ? c.json() : {}))
    .catch(() => ({}))) as Record<
    string,
    { scelta?: number | null; figure?: Record<string, { gradi?: number; dx?: number; dz?: number }> }
  >;
  await Promise.all(
    Object.entries(idx.tipi).map(async ([tipo, t]) => {
      const own = cfg[tipo],
        files = own?.scelta != null && t.figure[own.scelta] ? [t.figure[own.scelta]] : t.figure;
      const figs = await Promise.all(
        files.map((f) =>
          loader.loadAsync(`${base}pezzi/${f}`).then((gl) => {
            gl.scene.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                o.castShadow = true;
                o.userData.shared = true;
                const old = ([] as THREE.Material[]).concat(m.material)[0] as THREE.MeshStandardMaterial;
                m.material = toyMaterial(old.map ?? null, tipo.endsWith('_ghost'));
                if (old.vertexColors) (m.material as THREE.MeshPhysicalMaterial).vertexColors = true;
                old.dispose();
                if (tipo.endsWith('_ghost')) o.castShadow = false;
                m.geometry = toCreasedNormals(m.geometry, THREE.MathUtils.degToRad(70));
              }
            }); // the files carry no normals, so every triangle was shaded flat (visible polygon edges): smooth shading, with a crease where the surface turns more than 50°   // double-sided: a hole left in a model shows its back, not the ground   // shared by every copy: never disposed with the board
            // a vehicle is sized by its real hull length (Meshy draws vehicles chunky and tall, so sizing by height made short ones tiny)
            const k = SCALE * (t.veicolo ? (t.lunghezza ? (t.lunghezza * 0.18) / bodyLength(gl.scene) : 1) : INFANTRY),
              c = bodyCentre(gl.scene),
              root = new THREE.Group();
            const o = own?.figure?.[f] ?? {},
              turn = new THREE.Group();
            gl.scene.scale.setScalar(k);
            gl.scene.position.set(-c.x * k, 0, -c.z * k);
            turn.add(gl.scene); // the body (not a gun barrel or a rifle) sits on the origin
            turn.rotation.y = THREE.MathUtils.degToRad(o.gradi ?? 0);
            turn.position.set((o.dx ?? 0) * k, 0, (o.dz ?? 0) * k);
            root.add(turn); // then the owner's turn and nudge
            return root;
          }),
        ),
      );
      const bs = figs.map((f) => new THREE.Box3().setFromObject(f));
      troops.set(tipo, {
        figs,
        size: new THREE.Vector3(
          2 * Math.max(...bs.map((b) => Math.max(-b.min.x, b.max.x))),
          Math.max(...bs.map((b) => b.max.y)),
          2 * Math.max(...bs.map((b) => Math.max(-b.min.z, b.max.z))),
        ),
      }); // footprint symmetric round the origin
    }),
  );
  byUnit = idx.blocchi;
  return troops.size > 0;
}
/** Centre of a figure's body on the ground: the surface-area centre, so a long gun barrel or a rifle does not pull it off. */
/** Length of a vehicle's body along its longer ground axis: the span of 94% of its surface, so a thin gun barrel or aerial does not count. */
export function bodyLength(o: THREE.Object3D) {
  o.updateMatrixWorld(true);
  const pts: [number, number, number][] = [],
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    d = new THREE.Vector3();
  o.traverse((m) => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || !(m as THREE.Mesh).isMesh) return;
    const p = g.getAttribute('position'),
      ix = g.index,
      n = ix ? ix.count : p.count,
      at = (i: number) => (ix ? ix.getX(i) : i);
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p, at(i)).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(p, at(i + 1)).applyMatrix4(m.matrixWorld);
      d.fromBufferAttribute(p, at(i + 2)).applyMatrix4(m.matrixWorld);
      const w = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a)).length() / 2;
      pts.push([(a.x + b.x + d.x) / 3, (a.z + b.z + d.z) / 3, w]);
    }
  });
  const span = (k: 0 | 1) => {
    const s = [...pts].sort((p, q) => p[k] - q[k]),
      tot = s.reduce((x, p) => x + p[2], 0);
    let acc = 0,
      lo = 0,
      hi = 0;
    for (const p of s) {
      acc += p[2];
      if (!lo && acc >= 0.03 * tot) lo = p[k];
      if (acc <= 0.97 * tot) hi = p[k];
    }
    return hi - lo;
  };
  return Math.max(span(0), span(1)) / 0.94 || 1;
}
function bodyCentre(o: THREE.Object3D) {
  o.updateMatrixWorld(true);
  const c = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    d = new THREE.Vector3(),
    t = new THREE.Vector3();
  let sum = 0;
  o.traverse((m) => {
    const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || !(m as THREE.Mesh).isMesh) return;
    const p = g.getAttribute('position'),
      ix = g.index,
      n = ix ? ix.count : p.count;
    for (let i = 0; i < n; i += 3) {
      const at = (j: number) => (ix ? ix.getX(i + j) : i + j);
      a.fromBufferAttribute(p, at(0)).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(p, at(1)).applyMatrix4(m.matrixWorld);
      d.fromBufferAttribute(p, at(2)).applyMatrix4(m.matrixWorld);
      const w = t.crossVectors(b.clone().sub(a), d.clone().sub(a)).length();
      c.addScaledVector(a.add(b).add(d), w / 3);
      sum += w;
    }
  });
  return sum ? c.divideScalar(sum) : c;
}
export const troopOf = (unitId: string) => troops.get(byUnit[unitId]) ?? null;

/** Which of its type's figures a unit shows: fixed per unit, so neighbouring units of one type look different. */
export const variant = (unitId: string, count: number) => [...unitId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % count;
/** The Bulge: Germans face west, the Allies east (yaw about Y; a figure is modelled facing +z). The other volumes pass their own
 * facing (each side toward the other's edge of the map: main.ts). */
export const yawOf = (side: string) => (side === 'german' ? -Math.PI / 2 : Math.PI / 2);
/** A unit's footprint on the map for a facing: [width along x, depth along z], with room for its ring. */
export function foot(t: Pick<Troop, 'size'>, yaw: number): [number, number] {
  const x = t.size.x * zoom + 0.3,
    z = t.size.z * zoom + 0.3,
    c = Math.abs(Math.cos(yaw)),
    sn = Math.abs(Math.sin(yaw)); // the box round the turned figure
  return [x * c + z * sn, x * sn + z * c];
}
export type Cell = { x: number; z: number; d: number }; // a free spot of an area: world x, z and its distance from the area's border
export type Disc = { x: number; z: number; r: number };
/** Places units inside an area so that they use all its room and never overlap. cells: the area's interior grid (d = distance from the border);
 * units: footprint radius r and group (0 = the attackers, who stand toward +v, 1 = the defenders; a single group takes the whole area);
 * obstacles: what must stay clear (the printed name plate). Each group gets its half of the area (split along v by unit count), each unit the centre
 * of its own k-means cluster of that half (so the units spread over all the free space), the biggest units the roomiest spots; then a relaxation pushes
 * overlapping units apart, off the obstacles and back inside the border. Deterministic. */
export function arrange(
  cells: Cell[],
  units: { r: number; group: number }[],
  v: [number, number],
  obstacles: Disc[],
  gap = 0.15,
): { x: number; z: number }[] {
  const n = units.length;
  if (!n) return [];
  if (!cells.length) return units.map(() => ({ x: 0, z: 0 }));
  const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length,
    cz = cells.reduce((a, c) => a + c.z, 0) / cells.length;
  const clear = (c: Cell, r: number) => c.d >= r && obstacles.every((o) => Math.hypot(c.x - o.x, c.z - o.z) >= o.r + r);
  const usable = (r: number) => {
    for (const f of [1, 0.75, 0.5, 0]) {
      const u = cells.filter((c) => clear(c, r * f));
      if (u.length) return u;
    }
    return cells;
  };
  const rmin = Math.min(...units.map((u) => u.r)),
    base = usable(rmin);
  const two = units.some((u) => u.group === 1) && units.some((u) => u.group === 0),
    out: { x: number; z: number }[] = units.map(() => ({ x: cx, z: cz }));
  const sorted = [...base].sort((a, b) => (b.x - cx) * v[0] + (b.z - cz) * v[1] - ((a.x - cx) * v[0] + (a.z - cz) * v[1])); // the attackers' end first
  const nA = units.filter((u) => u.group === 0).length,
    cut = two ? Math.max(1, Math.min(sorted.length - 1, Math.round((sorted.length * nA) / n))) : sorted.length;
  for (const gr of two ? [0, 1] : [0]) {
    const idx = units.map((u, i) => i).filter((i) => (two ? units[i].group === gr : true));
    if (!idx.length) continue;
    const region = two ? (gr === 0 ? sorted.slice(0, cut) : sorted.slice(cut)) : base,
      pool = region.length ? region : base,
      k = Math.min(idx.length, pool.length);
    let cen: { x: number; z: number }[] = [{ x: pool.reduce((a, c) => (c.d > a.d ? c : a)).x, z: 0 }];
    cen[0].z = pool.reduce((a, c) => (c.d > a.d ? c : a)).z;
    while (cen.length < k) {
      let far = pool[0],
        fd = -1;
      for (const c of pool) {
        const m = Math.min(...cen.map((q) => Math.hypot(c.x - q.x, c.z - q.z)));
        if (m > fd) {
          fd = m;
          far = c;
        }
      }
      cen.push({ x: far.x, z: far.z });
    }
    for (let it = 0; it < 12; it++) {
      const sum = cen.map(() => ({ x: 0, z: 0, n: 0 }));
      for (const c of pool) {
        let b = 0,
          bd = 1e9;
        cen.forEach((q, j) => {
          const d = (c.x - q.x) ** 2 + (c.z - q.z) ** 2;
          if (d < bd) {
            bd = d;
            b = j;
          }
        });
        sum[b].x += c.x;
        sum[b].z += c.z;
        sum[b].n++;
      }
      cen = cen.map((q, j) => (sum[j].n ? { x: sum[j].x / sum[j].n, z: sum[j].z / sum[j].n } : q));
    }
    const room = (q: { x: number; z: number }) =>
      pool.reduce((a, c) => (Math.hypot(c.x - q.x, c.z - q.z) < Math.hypot(a.x - q.x, a.z - q.z) ? c : a)).d;
    const spots = [...cen].sort((a, b) => room(b) - room(a)),
      bigFirst = [...idx].sort((a, b) => units[b].r - units[a].r);
    bigFirst.forEach((i, j) => {
      const q = spots[Math.min(j, spots.length - 1)];
      out[i] = { x: q.x, z: q.z };
    });
  }
  const valid = units.map((u) => {
    for (const f of [1, 0.75, 0.5, 0]) {
      const c = cells.filter((q) => q.d >= u.r * f * 0.9);
      if (c.length) return c;
    }
    return cells;
  });
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = out[j].x - out[i].x,
          dz = out[j].z - out[i].z,
          d = Math.hypot(dx, dz),
          over = units[i].r + units[j].r + gap - d;
        if (over <= 0) continue;
        const ux = d > 1e-6 ? dx / d : 1,
          uz = d > 1e-6 ? dz / d : 0;
        out[i].x -= (ux * over) / 2;
        out[i].z -= (uz * over) / 2;
        out[j].x += (ux * over) / 2;
        out[j].z += (uz * over) / 2;
      }
    for (let i = 0; i < n; i++) {
      for (const o of obstacles) {
        const d = Math.hypot(out[i].x - o.x, out[i].z - o.z),
          over = o.r + units[i].r - d;
        if (over > 0) {
          const ux = d > 1e-6 ? (out[i].x - o.x) / d : 1,
            uz = d > 1e-6 ? (out[i].z - o.z) / d : 0;
          out[i].x += ux * over;
          out[i].z += uz * over;
        }
      }
      let near = valid[i][0],
        nd = 1e9;
      for (const c of valid[i]) {
        const d = (c.x - out[i].x) ** 2 + (c.z - out[i].z) ** 2;
        if (d < nd) {
          nd = d;
          near = c;
        }
      }
      if (nd > 0.04) {
        out[i].x += (near.x - out[i].x) * 0.6;
        out[i].z += (near.z - out[i].z) * 0.6;
      } // back inside the border
    }
  }
  return out;
}
/** An ordered layout: each group (a side) in rows of at most cols units, the groups one under the other (the first toward -z),
 * all centred on (0, 0). Returns each unit's centre, group by group. Nothing overlaps: every unit gets its full footprint plus gap. */
export function grid(groups: [number, number][][], cols: number, gap = 0.15): [number, number][][] {
  const rows: { items: [number, number][]; g: number; i0: number }[] = [];
  groups.forEach((gr, g) => {
    for (let i = 0; i < gr.length; i += cols) rows.push({ items: gr.slice(i, i + cols), g, i0: i });
  });
  const depth = (r: { items: [number, number][] }) => Math.max(...r.items.map((f) => f[1]));
  const total = rows.reduce((a, r) => a + depth(r), 0) + gap * (rows.length - 1) + 0.3 * (groups.filter((x) => x.length).length - 1);
  const out = groups.map((gr) => gr.map(() => [0, 0] as [number, number]));
  let z = -total / 2,
    prev = -1;
  for (const r of rows) {
    if (prev !== -1 && r.g !== prev) z += 0.3; // a little more room between the two sides
    const d = depth(r),
      w = r.items.reduce((a, f) => a + f[0], 0) + gap * (r.items.length - 1);
    let x = -w / 2;
    r.items.forEach((f, k) => {
      out[r.g][r.i0 + k] = [x + f[0] / 2, z + d / 2];
      x += f[0] + gap;
    });
    z += d + gap;
    prev = r.g;
  }
  return out;
}
/** Footprint radius of a unit's figure, for the block layout (never less than a small disc, so pips and ring stay clear of the next unit). */
export const radius = (t: Pick<Troop, 'size'>) => Math.max(0.55, (Math.max(t.size.x, t.size.z) * zoom) / 2 + 0.12);

const PIP: Record<string, [string, string]> = {
  elite: ['#e3222b', '#ffffff'],
  veteran: ['#141414', '#ffffff'],
  green: ['#ffffff', '#141414'],
};
const pipMats = new Map<string, THREE.SpriteMaterial>();
/** The unit's pips as one strip that always faces the camera and stays level on screen: from the left, the steps it has lost, faint and in the
 *  quality they had (owner, 13 Nov), then its present steps, solid, in its present quality. qs: the quality at each strength (qs[s - 1]). */
function pips(n: number, qs: string[]) {
  const max = Math.max(n, qs.length),
    key = `${n}|${qs.join()}`;
  let m = pipMats.get(key);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 64 * max;
    c.height = 64;
    const x = c.getContext('2d')!;
    for (let i = 0; i < max; i++) {
      const lost = i < max - n,
        q = lost ? qs[max - 1 - i] : qs[n - 1],
        [fill, ring] = PIP[q] ?? PIP.veteran;
      x.globalAlpha = lost ? 0.35 : 1;
      x.beginPath();
      x.arc(32 + 64 * i, 32, 28, 0, 7);
      x.fillStyle = ring;
      x.fill();
      x.beginPath();
      x.arc(32 + 64 * i, 32, 21, 0, 7);
      x.fillStyle = fill;
      x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false });
    pipMats.set(key, m);
  }
  const s = new THREE.Sprite(m);
  s.scale.set(0.3 * max, 0.3, 1);
  s.renderOrder = 3;
  return s;
}
/** Each side's bit in the stencil buffer: a figure's inner disc hides its own side's ring lines under it, so overlapping circles read as one outline. */
const SIDE_BIT = new Map<string, number>();
const sideBit = (side: string) => SIDE_BIT.get(side) ?? (SIDE_BIT.set(side, 1 << Math.min(6, SIDE_BIT.size)), SIDE_BIT.get(side)!);
/** A circle round the figure's footprint (w along x, d along z), in the side's colour, brass when selected; where circles of one side overlap only their outer outline shows. */
function ring(
  w: number,
  d: number,
  color: THREE.ColorRepresentation,
  selected: boolean,
  side: string,
  fill: string | null,
  point: boolean,
) {
  const r = (Math.hypot(w, d) / 2) * 0.82,
    k = point ? 0.32 : selected ? 0.2 : 0.14, // owner, 14 Nov: thicker, easier to see in 3D; the point unit's is thicker still
    bit = sideBit(side);
  const g = new THREE.Group(),
    m = new THREE.Mesh(
      new THREE.RingGeometry(r - k, r, 56),
      new THREE.MeshBasicMaterial({
        color: selected ? 0xe7b04a : color,
        stencilWrite: true,
        stencilRef: bit,
        stencilFuncMask: bit,
        stencilWriteMask: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
      }),
    ),
    hole = new THREE.Mesh(
      new THREE.CircleGeometry(r - k, 56),
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: bit,
        stencilWriteMask: bit,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
      }),
    );
  for (const x of [m, hole]) {
    x.rotation.x = -Math.PI / 2;
    x.position.y = 0.03;
    x.userData.drape = true; // laid on the 3D relief vertex by vertex (map3d.ts)
    g.add(x);
  }
  if (fill) {
    const f = new THREE.Mesh(
      new THREE.CircleGeometry(r - k, 56),
      new THREE.MeshBasicMaterial({ color: fill, transparent: true, opacity: 0.62, depthWrite: false }),
    );
    f.rotation.x = -Math.PI / 2;
    f.position.y = 0.025;
    f.renderOrder = -1; // under the 'can act' glow
    f.userData.drape = true;
    g.add(f);
  } // the formation colour of the block (command, division or brigade), on the figure's ground disc
  hole.renderOrder = 1;
  m.renderOrder = 2; // the holes first, then the lines outside every hole
  g.userData.base = true;
  g.userData.r = r; // main.ts sizes the act-now halo on it
  g.userData.k = k;
  return g;
}
/** A unit drawn as its figure, centred on the group's origin (the spot the block would take). */
/** yaw: overrides the side's usual facing (in battle the two sides face each other). */
export function troopGroup(
  t: Troop,
  unitId: string,
  side: string,
  color: THREE.ColorRepresentation,
  n: number,
  qs: string[],
  selected: boolean,
  yaw = yawOf(side),
  fill: string | null = null,
  point = false,
) {
  const g = new THREE.Group(),
    f = t.figs[variant(unitId, t.figs.length)].clone(true);
  f.rotation.y = yaw;
  f.scale.multiplyScalar(zoom);
  g.add(f);
  const across = Math.abs(Math.sin(yaw)) > 0.5,
    sz = t.size.clone().multiplyScalar(zoom); // facing east or west: the figure's length lies along x
  g.add(ring((across ? sz.z : sz.x) + 0.3, (across ? sz.x : sz.z) + 0.3, color, selected, side, fill, point));
  const s = pips(n, qs);
  s.position.y = sz.y + 0.35;
  g.add(s);
  g.userData.troop = true;
  g.userData.top = sz.y;
  return g;
}
