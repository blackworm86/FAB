// Routes on the map: movement arrows by kind of move, the supply line, and the move badges.
import * as THREE from 'three';
import { tr } from './i18n';
import * as E from '../../engine/src';
import { supplySources } from './supply-plan';
import { $, MAP } from './page';
import { g, hoverArea, previewArea, selUnit } from './game-state';
import { disposeAll } from './piece-kit';
import { noSup, seen, supplySide, tint, viewRot } from './map-paint';
import { pitch } from './camera';
import { arrOpts } from './choices';
import { center, clampDist, optsFor, route, setGoal } from './map-input';

/* ---------- routes on the map: movement arrows by kind of move, the supply lifeline (docs/design/route-style-v2.png) ---------- */
function pathPts(path: number[]) {
  const raw = path.map((a) => {
    const c = center(a);
    return new THREE.Vector3(c.x, 0, c.z);
  });
  if (raw.length === 2)
    raw.splice(
      1,
      0,
      raw[0]
        .clone()
        .lerp(raw[1], 0.5)
        .add(new THREE.Vector3(0.6, 0, -0.6)),
    );
  return new THREE.CatmullRomCurve3(raw, false, 'centripetal', 0.5).getSpacedPoints(Math.max(40, path.length * 30));
}
/** A flat band along the points; width and colour/alpha change along the way (t = 0 at the tail, 1 at the head). */
function band(
  pts: THREE.Vector3[],
  w: (t: number) => number,
  col: (t: number) => [number, number, number, number],
  y: number,
  order: number,
) {
  const pos: number[] = [],
    cl: number[] = [],
    idx: number[] = [];
  pts.forEach((p, i) => {
    const t = i / (pts.length - 1),
      a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      d = new THREE.Vector3().subVectors(b, a).setY(0).normalize(),
      n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w(t) / 2),
      c = col(t);
    pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z);
    cl.push(...c, ...c);
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k, k - 1, k + 1);
    }
  });
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4));
  g2.setIndex(idx);
  const m = new THREE.Mesh(
    g2,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, side: THREE.DoubleSide }),
  );
  m.renderOrder = order;
  return m;
}
function quad(v: THREE.Vector3[], c: [number, number, number, number], y: number, order: number) {
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      v.flatMap((p) => [p.x, y, p.z]),
      3,
    ),
  );
  g2.setIndex(v.length === 4 ? [0, 1, 3, 1, 2, 3] : [0, 1, 2]);
  const m = new THREE.Mesh(
    g2,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(c[0], c[1], c[2]),
      transparent: true,
      opacity: c[3],
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  m.renderOrder = order;
  return m;
}
const rgb = (h: number, a = 1): [number, number, number, number] => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b, a];
};
type MoveKind = 'normal' | 'fuel' | 'minimum' | 'blown' | 'strat';
const MOVE_COL: Record<MoveKind, [number, number]> = {
  normal: [0xc8e86a, 0x3a4a14],
  fuel: [0xe7b04a, 0x5a3f08],
  minimum: [0xc9ccd2, 0x3a3d44],
  blown: [0x8a8a80, 0x2a2a26],
  strat: [0xddd7b5, 0x3a3826],
}; // green = a normal move, brass = it burns fuel, steel = minimum move, red = across a blown bridge, paper = strategic
/** Movement: a tapered operations arrow with a soft shadow, a dark rim, a light core and a notched head; the tail fades in. */
function moveArrow(path: number[], kind: MoveKind, blownAt = -1) {
  const pts = pathPts(path),
    [main, rim] = MOVE_COL[kind],
    n = pts.length,
    hl = Math.min(n - 2, 14),
    body = pts.slice(0, n - hl + 2),
    tip = pts[n - 1],
    base = pts[n - hl],
    d = new THREE.Vector3().subVectors(tip, base).setY(0).normalize(),
    nn = new THREE.Vector3(-d.z, 0, d.x);
  const W = (t: number) => 0.32 + t * 0.5,
    fade = (t: number) => Math.min(1, 0.15 + t * 2.2),
    sh = new THREE.Vector3(0.18, 0, 0.26);
  route.add(
    band(
      body.map((p) => p.clone().add(sh)),
      (t) => W(t) + 0.35,
      (t) => [0, 0, 0, 0.28 * fade(t)],
      0.04,
      7,
    ),
  );
  route.add(
    band(
      body,
      (t) => W(t) + 0.26,
      (t) => rgb(rim, 0.95 * fade(t)),
      0.05,
      8,
    ),
  );
  route.add(band(body, W, (t) => rgb(main, fade(t)), 0.06, 9));
  route.add(
    band(
      body,
      (t) => W(t) * 0.28,
      (t) => [1, 1, 1, 0.35 * fade(t)],
      0.07,
      10,
    ),
  );
  const hw = 1.25,
    notch = base.clone().addScaledVector(d, 0.45),
    o3 = (v: THREE.Vector3, o: number) => v.clone().add(new THREE.Vector3(o, 0, o));
  const H = (o: number, grow: number, c: [number, number, number, number], y: number, ord: number) =>
    route.add(
      quad(
        [
          o3(tip.clone().addScaledVector(d, grow), o),
          o3(base.clone().addScaledVector(nn, hw + grow), o),
          o3(notch, o),
          o3(base.clone().addScaledVector(nn, -hw - grow), o),
        ],
        c,
        y,
        ord,
      ),
    );
  H(0.2, 0.2, [0, 0, 0, 0.28], 0.04, 7);
  H(0, 0.16, rgb(rim, 0.95), 0.05, 8);
  H(0, 0, rgb(main, 1), 0.06, 9);
  if (kind === 'blown' && blownAt >= 0) {
    // a white break where the arrow crosses the blown bridge
    const k = Math.min(n - 2, Math.round(((blownAt + 0.5) / (path.length - 1)) * (n - 1))),
      mid = pts[k],
      dd = new THREE.Vector3()
        .subVectors(pts[k + 1], mid)
        .setY(0)
        .normalize(),
      m2 = new THREE.Vector3(-dd.z, 0, dd.x);
    for (const s2 of [-1, 1])
      route.add(
        quad(
          [
            mid
              .clone()
              .addScaledVector(dd, s2 * 0.25)
              .addScaledVector(m2, 0.9),
            mid
              .clone()
              .addScaledVector(dd, s2 * 0.45)
              .addScaledVector(m2, 0.9),
            mid
              .clone()
              .addScaledVector(dd, s2 * 0.45)
              .addScaledVector(m2, -0.9),
            mid
              .clone()
              .addScaledVector(dd, s2 * 0.25)
              .addScaledVector(m2, -0.9),
          ],
          [1, 1, 1, 0.95],
          0.08,
          11,
        ),
      );
  }
}
/** Supply: a calm dotted lifeline, beads at even steps, a ring on every area it passes and a glowing source. */
function supplyLine(path: number[]) {
  const pts = pathPts(path),
    blue = 0xddd7b5,
    deep = 0x2a2a1c; // supply: a paper-coloured lifeline (blue is for rivers only)
  const disc = (x: number, z: number, r1: number, r2: number, c: [number, number, number, number], y: number, o: number) => {
    const m = new THREE.Mesh(
      r1 ? new THREE.RingGeometry(r1, r2, 40) : new THREE.CircleGeometry(r2, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(c[0], c[1], c[2]),
        transparent: true,
        opacity: c[3],
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = o;
    route.add(m);
  };
  route.add(
    band(
      pts,
      () => 0.5,
      () => rgb(blue, 0.14),
      0.04,
      7,
    ),
  );
  for (let i = 0; i < pts.length; i += 6) {
    disc(pts[i].x, pts[i].z, 0, 0.2, rgb(deep, 0.9), 0.05, 8);
    disc(pts[i].x, pts[i].z, 0, 0.13, rgb(blue, 1), 0.06, 9);
  }
  path.forEach((a, i) => {
    const c = center(a);
    if (i === path.length - 1) {
      disc(c.x, c.z, 0, 1.25, rgb(blue, 0.18), 0.045, 7);
      disc(c.x, c.z, 0.78, 0.98, rgb(deep, 0.9), 0.05, 8);
      disc(c.x, c.z, 0.82, 0.94, rgb(blue, 1), 0.06, 9);
      disc(c.x, c.z, 0, 0.34, rgb(blue, 1), 0.06, 9);
    } else if (i) {
      disc(c.x, c.z, 0.36, 0.5, rgb(deep, 0.9), 0.05, 8);
      disc(c.x, c.z, 0.39, 0.47, rgb(blue, 1), 0.06, 9);
    }
  });
}
export function drawRoute() {
  disposeAll(route);
  if (!selUnit || g.battle) return;
  const u = g.units.find((x) => x.id === selUnit);
  if (!u || u.area == null) return;
  const to = previewArea ?? hoverArea;
  if (to == null) {
    const p = seen(u) && !u.garrison ? E.supplyPath(g, u.side, u.area) : null;
    if (p && p.length > 1) supplyLine(p);
    return;
  } // no destination chosen: the way the block traces supply (9.3)
  const o = optsFor(selUnit).find((x) => x.area === to);
  if (!o) return;
  const path = o.path.length ? o.path : [u.area, to],
    bk = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`),
    bi = path.findIndex((a, i) => i > 0 && g.blown.includes(bk(path[i - 1], a)));
  const kind: MoveKind =
    g.phase === 'strategic'
      ? 'strat'
      : bi > 0
        ? 'blown'
        : o.fuel && u.side === 'german' && g.opts.fuel
          ? 'fuel'
          : (u.unsupplied || u.disorder || u.adjOnly) && path.length === 2
            ? 'minimum'
            : 'normal';
  moveArrow(path, kind, bi - 1);
  const fk = `${selUnit}>${previewArea}`;
  if (previewArea != null && innerWidth < 700 && fk !== framedRoute) {
    // phones: the whole route in view, above the one-line ticket
    framedRoute = fk;
    const pts = path.map(center),
      x0 = Math.min(...pts.map((p) => p.x)),
      x1 = Math.max(...pts.map((p) => p.x)),
      z0 = Math.min(...pts.map((p) => p.z)),
      z1 = Math.max(...pts.map((p) => p.z));
    const span = Math.max(x1 - x0, (z1 - z0) * 1.3, 8),
      c = viewRot() ? -1 : 1;
    setGoal({ t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2 + c * span * 0.34), dist: clampDist(span * 2.5 + 10), pitch });
  }
}
let framedRoute = '';
type Badge = { area: number; text: string; cls: string; key?: string };
export const coveredLabels = new Set<number>();
export let badges: Badge[] = [];
export const setBadges = <T extends typeof badges>(v: T): T => ((badges = v), v);
export function badgeList(): Badge[] {
  const out: Badge[] = [];
  if (selUnit && !g.battle) {
    const u = g.units.find((x) => x.id === selUnit)!;
    for (const o of optsFor(selUnit))
      out.push({
        area: o.area,
        text: g.phase === 'strategic' ? '' : `${o.cost} MP${noSup.has(o.area) ? ' · no supply' : ''}`,
        cls: (o.mustStop ? 'stop' : o.fuel && u.side === 'german' ? 'fuel' : 'ok') + (noSup.has(o.area) ? ' nosup' : ''),
      });
  }
  for (const o of arrOpts()) if (o.sa) out.push({ area: o.area, text: 'SA', cls: 'stop' }); // plain entry areas are lit; only the ones that cost a Special Action are marked
  if (g.battle?.stage === 'retreat') for (const a of E.retreatOptions(g, g.battle)) out.push({ area: a, text: 'Retreat', cls: 'ok' });
  if (tint === 'supply' && !g.battle)
    for (const a of supplySources(
      g,
      supplySide(),
      MAP.areas.map((x) => x.id),
    ))
      out.push({ area: a, text: 'Supply source', cls: 'src', key: `S${a}` });
  return out;
}
export const badgeEls = new Map<string, HTMLElement>();
export function syncBadges() {
  const layer = $('#badges');
  layer.innerHTML = '';
  badgeEls.clear();
  for (const b of badges) {
    const d = document.createElement('div');
    d.className = 'bdg ' + b.cls;
    d.textContent = tr(b.text);
    layer.appendChild(d);
    badgeEls.set(b.key ?? String(b.area), d);
  }
}
