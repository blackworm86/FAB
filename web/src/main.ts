import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import mapJson from '../../data/bulge/map.json';
import * as E from '../../engine/src';
import { labelSvg } from './art';
import { chitSvg, mapMarkerSvg, loadChitArt, garrisonChit } from './chits';
import { History } from './history';
import { online, startOnline, push, sit, setDevSeat, auth, lobby, publishReveals, DEV, TABLE, HAS_TABLE, DEV_FAKE, type DevSeat, type Match } from './online';
import { GAMES, gameInfo } from './games';
import { ICONS, ico } from './icons';
import { esc, nm } from './util';
import { drawItems as drawAreaItems, drawEntry } from './board-art';
import { targetsFor, type Tgt } from './chit-play';
import { snap, diffFx, FxLayer, fxRow, FX_SAMPLES, type Fx } from './fx';
import { RULE } from './rules-text';
import rulesText from '../../firestore.rules?raw';
import { throwDice, clearDice, isHit, type DiceGroup } from './dice3d';

type MapArea = { id: number; label: [number, number]; polygon: [number, number][] };
type MapEntry = { letter: string; x: number; y: number; side: E.Side };
type MapConn = { a: number; b: number; marker: [number, number] | null };
const MAP = mapJson as unknown as { size: [number, number]; areas: MapArea[]; connections: MapConn[]; entries: MapEntry[] };
// World unit = 1 cm. The scan is the full 34 x 22 in map (86.36 x 55.88 cm) at 2448 x 1584 px.
const [MW, MH] = MAP.size, S = 2448 / 86.36;                                  // map pixels per cm
const toWorld = (x: number, y: number) => new THREE.Vector3(x / S - MW / (2 * S), 0, y / S - MH / (2 * S));
/** Pole of inaccessibility: the point inside the polygon farthest from its edges, so pieces sit visually centred. */
function pole(poly: [number, number][]): [number, number] {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const edge = (x: number, y: number) => { let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return d; };
  let best: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1;
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const x = x0 + ((x1 - x0) * i) / 40, y = y0 + ((y1 - y0) * j) / 40; if (!inside(x, y)) continue; const d = edge(x, y); if (d > bd) { bd = d; best = [x, y]; } }
  return best;
}
/** Candidate spots inside an area: grid points (world cm) with their clearance from the border, so pieces can be kept fully inside it. */
const CELLS = new Map<number, { x: number; z: number; d: number }[]>();
function cellsOf(id: number) {
  let c = CELLS.get(id); if (c) return c;
  const poly = MAP.areas.find((a) => a.id === id)!.polygon, xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]); c = [];
  const inside = (x: number, y: number) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) k = !k; } return k; };
  const edge = (x: number, y: number) => { let d = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return d; };
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 5) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 5) if (inside(x, y)) { const w = toWorld(x, y); c.push({ x: w.x, z: w.z, d: edge(x, y) / S }); }
  CELLS.set(id, c); return c;
}
const POLE = new Map<number, [number, number]>(MAP.areas.map((a) => [a.id, pole(a.polygon)]));
/** Marker spot on the shared border of two areas (the scan carries no marker positions for most connections). */
function borderMid(a: number, b: number): [number, number] {
  const A = MAP.areas.find((x) => x.id === a)!, B = MAP.areas.find((x) => x.id === b)!, near = A.polygon.filter((p) => B.polygon.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8));
  if (near.length) { const mx = near.reduce((s, p) => s + p[0], 0) / near.length, my = near.reduce((s, p) => s + p[1], 0) / near.length; return [mx, my]; }
  const pa = POLE.get(a)!, pb = POLE.get(b)!; return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
}
/** General direction of the border between two areas (the river runs along it), as an angle in map space. */
function borderAngle(a: number, b: number): number {
  const A = MAP.areas.find((x) => x.id === a)!, B = MAP.areas.find((x) => x.id === b)!, near = A.polygon.filter((p) => B.polygon.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8));
  if (near.length >= 2) {
    const mx = near.reduce((t, p) => t + p[0], 0) / near.length, my = near.reduce((t, p) => t + p[1], 0) / near.length; let sxx = 0, syy = 0, sxy = 0;
    for (const p of near) { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }
  const pa = POLE.get(a)!, pb = POLE.get(b)!; return Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) + Math.PI / 2;
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const areaName = (a: number) => E.areas.get(a)!.name;

/* ---------- state ---------- */
const KEY = TABLE === 'main' ? 'fab-demo2' : `fab-demo2-${TABLE}`;
function load(): E.Game | null { try { const s = localStorage.getItem(KEY); if (!s) return null; const x = JSON.parse(s); return x.chits && x.markers && x.greif && x.roadblocks && x.pendingArrivals && x.fwOwner && Array.isArray(x.recover) ? x : null; } catch { return null; } }
let g: E.Game = load() ?? E.newGame();
let selArea: number | null = null, selUnit: string | null = null, selChit: string | null = null, previewArea: number | null = null, hoverArea: number | null = null, newOpts: E.Opts = { scenario: 'tournament', fuel: true };
let applyingRemote = false;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage off: the game still runs */ } if (!applyingRemote) void push(g); };

/* ---------- three.js scene ---------- */
const canvas = $('#gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101314);
const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-20, 50, 32); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 200 }); scene.add(sun);

let mapTex: THREE.Texture | null = null;                                                          // the scan is only loaded on request (it is not part of the repository)
function scanTex() { if (!mapTex) { mapTex = new THREE.TextureLoader().load('./map.jpg'); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.repeat.set(MW / 2448, 1); mapTex.anisotropy = 8; } return mapTex; }
const board = new THREE.Mesh(new THREE.PlaneGeometry(MW / S, MH / S), new THREE.MeshStandardMaterial({ map: null, roughness: 0.9 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
/** Map art: the traced vector layers (default) or the original scan. */
let art: 'vector' | 'scan' = (() => { try { return localStorage.getItem('fab-art') === 'scan' ? 'scan' : 'vector'; } catch { return 'vector'; } })();
/* The board texture is composed in layers: ground and forest, then the area tint (so roads and rivers stay visible), then the line work, then the printed items (numbers, TDN, VP, names), turned to face the player. */
const boardCv = document.createElement('canvas'); boardCv.width = MW * 2; boardCv.height = MH * 2;
const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8;
const loadImg = (src: string) => { const i = new Image(); i.onload = () => paintBoard(); i.src = src; return i; };
const vpIcons = { allied: loadImg('./icons/vp-allied.svg'), german: loadImg('./icons/vp-german.svg'), mutual: loadImg('./icons/vp-mutual.svg') };
const baseImg = loadImg('./map-base.svg'), linesImg = loadImg('./map-lines.svg');
function applyArt() { const mat = board.material as THREE.MeshStandardMaterial; mat.map = art === 'scan' ? scanTex() : boardTex; mat.needsUpdate = true; if (art === 'vector') paintBoard(); }
const setArt = (a: 'vector' | 'scan') => { art = a; try { localStorage.setItem('fab-art', a); } catch { /* private mode */ } applyArt(); };
const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1 }));
table.rotation.x = -Math.PI / 2; table.position.y = -0.02; scene.add(table);

// area overlays (highlights)
const overlays = new Map<number, THREE.Mesh>();
for (const a of MAP.areas) {
  const shape = new THREE.Shape(a.polygon.map(([x, y]) => new THREE.Vector2(x / S - MW / (2 * S), -(y / S - MH / (2 * S)))));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; scene.add(m); overlays.set(a.id, m);
}
const pieces = new THREE.Group(); scene.add(pieces);
const labelTex = new Map<string, THREE.Texture>();
const svgTex = (key: string, svg: string) => { if (!labelTex.has(key)) { const t = new THREE.TextureLoader().load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; labelTex.set(key, t); } return labelTex.get(key)!; };
const WOOD = { german: 0x8e9296, allied: 0x5d8a45 };
const BRIT = new Set(['43 Inf', '53 Inf', 'Guards', '51 Inf']);

/** Garrison and Task Force counters, drawn like the printed ones (area number, or turn and star). */
function garrisonArt(u: E.Unit) {
  if (u.heydte) return chitSvg({ kind: 'infantry_asset', name: 'v.d. Heydte', side: 'german', ech: 'de_sr', q: 'veteran', turn: null });
  const tf = u.id.startsWith('TF-') ? E.chit(g, u.chitId!).turn : null;
  return garrisonChit(tf != null ? 'Task Force' : u.name.replace('Garrison ', ''), tf != null ? `${tf}-*` : u.id.replace(/^G/, ''), tf == null);
}
function block(u: E.Unit, hidden = false) {
  const w = 1.6, h = 1.6, d = 0.8;                                    // 16 x 16 x 8 mm block
  const wood = new THREE.MeshStandardMaterial({ color: BRIT.has(u.name) ? 0x3f6fb8 : WOOD[u.side], roughness: 0.75 });
  if (u.garrison) {
    const chit = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }), m = new THREE.Mesh(new THREE.BoxGeometry(1.43, 0.18, 1.43), [chit, chit, new THREE.MeshStandardMaterial({ map: svgTex(u.id, garrisonArt(u)) }), chit, chit, chit]); // 9/16 in chit
    m.position.y = 0.09; m.castShadow = true; return m;
  }
  const face = hidden ? wood : new THREE.MeshStandardMaterial({ map: svgTex(`${u.id}-${u.str}`, labelSvg(u)), roughness: 0.6 });   // upright blocks show their blank back to the enemy
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wood, wood, wood, wood, face, wood]); m.rotation.y = viewRot();
  m.position.y = h / 2; m.castShadow = true;
  return m;
}
const markers = new THREE.Group(); scene.add(markers);
/** Remove a group's children and free their geometry and materials; the cached textures are shared and stay. */
function disposeAll(group: THREE.Group) {
  group.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh && !(o as THREE.LineSegments).isLineSegments) return; m.geometry?.dispose(); for (const mat of ([] as THREE.Material[]).concat(m.material)) mat.dispose(); });
  group.clear();
}
const tagTex = new Map<string, THREE.CanvasTexture>();
function tag(text: string, bg: string, size = 1.1) {
  const art = mapMarkerSvg(text);
  if (art) {                                                         // printed marker art, drawn as a vector chit
    const key = 'art:' + text; let at = tagTex.get(key);
    if (!at) { at = new THREE.CanvasTexture(document.createElement('canvas')); const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d')!.drawImage(im, 0, 0, 256, 256); at!.image = c; at!.colorSpace = THREE.SRGBColorSpace; at!.anisotropy = 8; at!.needsUpdate = true; }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art); tagTex.set(key, at); }
    const edge = new THREE.MeshStandardMaterial({ color: 0x2a2a28 }), m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [edge, edge, new THREE.MeshStandardMaterial({ map: at }), edge, edge, edge]);
    m.castShadow = true; return m;
  }
  let t = tagTex.get(text + bg);
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
    x.fillStyle = '#fff'; x.font = `bold ${text.length > 2 ? 46 : 60}px Arial Narrow, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagTex.set(text + bg, t); }
  const side = new THREE.MeshStandardMaterial({ color: bg }), m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [side, side, new THREE.MeshStandardMaterial({ map: t }), side, side, side]);
  m.castShadow = true; return m;
}
/** Every counter is a 9/16 inch square (1.43 cm) with slightly rounded corners. */
const CHIT = 1.43;
const SIDE_HEX = { german: 0xb9bcc0, allied: 0x9db36a };
/** A marker on a plate in its owner's colour, so it is clear whom it helps (field works) or who is attacking (river assault). */
function owned(text: string, bg: string, size: number, side: E.Side) {
  const grp = new THREE.Group(), plate = new THREE.Mesh(new RoundedBoxGeometry(size + 0.2, 0.07, size + 0.2, 2, 0.1), new THREE.MeshStandardMaterial({ color: SIDE_HEX[side], roughness: 0.7 })), t = tag(text, bg, size);
  plate.position.y = 0.035; t.position.y = 0.07 + 0.06; plate.castShadow = true; grp.add(plate, t); return grp;
}
function drawPieces() {
  disposeAll(pieces); disposeAll(markers);
  const taken = new Map<number, { x: number; z: number; r: number }[]>(), edgeTaken: { x: number; z: number; r: number }[] = [];
  /** Spot inside the area nearest to (x, z) whose footprint (radius r) is fully inside it and clear of what is already there. */
  const inArea = (id: number, x: number, z: number, r: number) => {
    const t = taken.get(id) ?? (taken.set(id, []), taken.get(id)!), cells = cellsOf(id);
    for (const need of [r, r * 0.75, r * 0.5, 0]) {
      let best: { x: number; z: number } | null = null, bd = 1e9;
      for (const c of cells) { if (c.d < need) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < bd && t.every((q) => Math.hypot(q.x - c.x, q.z - c.z) >= q.r + r * (need === r ? 1 : 0.7))) { bd = d; best = c; } }
      if (best) { t.push({ ...best, r }); (best as { tight?: boolean }).tight = need < r; return best; }
    }
    const p = toWorld(...POLE.get(id)!); t.push({ x: p.x, z: p.z, r }); return p;
  };
  const free = (x: number, z: number, r: number) => {
    const all = [...edgeTaken, ...[...taken.values()].flat()], ok = (px: number, pz: number) => all.every((t) => Math.hypot(t.x - px, t.z - pz) >= t.r + r);
    let spot = { x, z };
    if (!ok(x, z)) outer: for (let ring = 1; ring <= 10; ring++) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * ring * 0.4, pz = z + Math.sin(a) * ring * 0.4; if (ok(px, pz)) { spot = { x: px, z: pz }; break outer; } }
    edgeTaken.push({ ...spot, r }); return spot;
  };
  const rows = new Map<number, { base: THREE.Vector3; cont: boolean }>();
  for (const a of MAP.areas) {
    const us = E.unitsIn(g, a.id), base = toWorld(...POLE.get(a.id)!), cont = E.contestedAreas(g).includes(a.id); rows.set(a.id, { base, cont });
    const order = [...us].sort((p, q) => +(p.side !== 'german') - +(q.side !== 'german') || +!!p.garrison - +!!q.garrison);
    const place = (column: boolean) => {                                                           // a row of blocks, or a column when the area is too narrow for a row
      const t = taken.get(a.id) ?? [], saved = [...t]; let tight = false;
      const spots = order.map((u) => { const same = us.filter((x) => x.side === u.side), idx = column ? order.indexOf(u) - (order.length - 1) / 2 : same.indexOf(u) - (same.length - 1) / 2, row = u.side === 'german' ? 1.1 : -1.1;
        const p = column ? inArea(a.id, base.x, base.z + idx * 1.8, u.garrison ? 0.75 : 0.95) : inArea(a.id, base.x + idx * 1.75, base.z + (cont ? row : 0.4), u.garrison ? 0.75 : 0.95); if ((p as { tight?: boolean }).tight) tight = true; return p; });
      return { spots, tight, saved };
    };
    let lay = place(false);
    if (lay.tight && order.length > 1) { taken.set(a.id, lay.saved); const col = place(true); if (!col.tight) lay = col; else { taken.set(a.id, lay.saved); lay = place(false); } }
    order.forEach((u, n) => {
      const hid = !seen(u), m = block(u, hid), p = lay.spots[n]; m.userData.hidden = hid;
      m.position.x = p.x; m.position.z = p.z;
      if (tgt?.units.has(u.id)) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 40), new THREE.MeshBasicMaterial({ color: 0x37d67a, transparent: true, opacity: 0.95, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.09, p.z); markers.add(ring); const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ color: 0x37d67a, transparent: true, opacity: 0.28 })); glow.rotation.x = -Math.PI / 2; glow.position.set(p.x, 0.085, p.z); markers.add(glow); }
      m.userData.unit = u.id; if (u.id === selUnit) { const o = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })); m.add(o); }
      pieces.add(m);
      const tags: [string, string][] = []; let stackY = u.garrison ? 0.3 : 1.66;
      if (u.disorder && !u.garrison) { const k = tag(u.disorder === 1 ? 'DIS' : 'REC', u.disorder === 1 ? '#8a1f1f' : '#a8741a', CHIT); k.position.set(m.position.x, 1.66, m.position.z); markers.add(k); stackY = 1.66 + 0.14; }
      if (u.reserve) tags.push([u.side === 'german' ? ({ z5: 'R5', z6: 'R6', z7: 'R7' } as Record<string, string>)[u.reserve] ?? 'R5' : u.reserve === 'z7' ? 'A7' : 'A56', '#2d6cb0']); if (u.exploit) tags.push(['E', '#d9741c']); if (u.unsupplied && !u.garrison) tags.push(['S', '#b8312f']); if (u.interdict) tags.push(['GI', '#8a2f9c']); if (u.bcross) tags.push(['B', '#8a6a1c']);
      tags.forEach(([t, c], i) => { const k = tag(t, c, CHIT); k.position.set(m.position.x + i * 0.12, stackY + i * 0.14, m.position.z - i * 0.08); k.rotation.y = (i % 2 ? 0.12 : -0.08); markers.add(k); });
    });
  }
  // area markers: inside their own area, next to the group they belong to
  for (const a of MAP.areas) {
    const { base, cont } = rows.get(a.id)!, mine: { side?: E.Side; t: string; c: string }[] = [];
    if (g.roadblocks[a.id]) mine.push({ side: g.roadblocks[a.id], t: 'RB', c: '#6b4a8a' }); if (g.interdicted[a.id]) mine.push({ t: 'AIR', c: '#2f6fb0' }); if (g.pooled === a.id) mine.push({ side: 'allied', t: 'P', c: '#3f8a5a' }); if (g.airSupply?.area === a.id) mine.push({ side: g.airSupply.side, t: 'AS', c: '#2f6fb0' });
    if (g.fieldWorks.includes(a.id)) mine.push({ side: g.fwOwner[a.id] ?? g.control[a.id], t: 'FW', c: '#7a5a2b' });
    if (g.riverAssault.includes(a.id)) mine.push({ side: g.phasing, t: 'RA', c: '#2a7fb8' });
    mine.forEach((m, i) => {
      const side = m.side ?? g.control[a.id], lane = cont ? (side === 'german' ? 1 : -1) : 1, size = CHIT;
      const p = inArea(a.id, base.x + (i - (mine.length - 1) / 2) * 1.5, base.z + lane * 2.3, size / 2 + 0.25);
      const k = m.side ? owned(m.t, m.c, size, m.side) : tag(m.t, m.c, size); k.position.set(p.x, 0.02, p.z); markers.add(k);
    });
  }
  for (const k of Object.keys(g.greif)) { const [x, y] = k.split('-').map(Number), q = toWorld(...borderMid(x, y)), p = free(q.x, q.z - 1.3, 0.8), t = tag('G', '#8a2f9c', CHIT); t.position.set(p.x, 0.07, p.z); t.rotation.y = -borderAngle(x, y); markers.add(t); }
  for (const k of g.blown) { const [x, y] = k.split('-').map(Number), q = toWorld(...borderMid(x, y)), p = free(q.x, q.z, 0.85), t = tag('X', '#d9421f', CHIT); t.position.set(p.x, 0.07, p.z); t.rotation.y = -borderAngle(x, y); markers.add(t); }
}
/** Map overlays: the area tint (terrain defence or army zones) is painted into the board under the line work. */
let tint: 'off' | 'tdn' | 'zones' | 'control' = (() => { try { const t = localStorage.getItem('fab-tint'); return t === 'tdn' || t === 'zones' || t === 'control' ? t : 'off'; } catch { return 'off'; } })();
const TDN_COL = [0xf4e3a4, 0xc9a24f, 0x8a8f86, 0x4a5028], ZONE_COL: Record<number, number> = { 5: 0x3a3f46, 6: 0x951b81, 7: 0x009fe3 };   // the TDN colours are the printed TDN markers'
const CONTROL_COL = { allied: 0x6aa84f, german: 0x8a9096, contested: 0x9b59d0 };                      // allied green, axis grey, contested violet (red and yellow are the combat highlights)
const tintOf = (id: number) => (tint === 'tdn' ? TDN_COL[E.areas.get(id)!.tdn] : tint === 'control' ? (E.contested(g, id) ? CONTROL_COL.contested : CONTROL_COL[g.control[id] ?? 'german']) : ZONE_COL[E.areas.get(id)!.zone]);
const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** What is printed on the map, and how. */
const layers = (() => { const d = { numbers: true, tdn: true, vp: true, names: true }; try { return { ...d, ...JSON.parse(localStorage.getItem('fab-layers') ?? '{}') }; } catch { return d; } })();
const saveLayers = () => { try { localStorage.setItem('fab-layers', JSON.stringify(layers)); localStorage.setItem('fab-tint', tint); } catch { /* private mode */ } };
/** Whose side of the table we look from: the German player looks up the map from the bottom, the Allied player down from the top. */
const viewSide = (): E.Side => (online.active && !online.both() && online.mySide() ? online.mySide()! : 'german');
const fogSide = (): E.Side | 'spectator' | null => (online.active && !online.both() ? online.mySide() ?? 'spectator' : null);
const seen = (u: E.Unit) => E.visibleTo(g, u, fogSide());
const viewRot = () => (viewSide() === 'allied' ? Math.PI : 0);
function paintBoard() {
  if (art !== 'vector' || !baseImg.naturalWidth || !linesImg.naturalWidth) return;
  const c = boardCv.getContext('2d')!, k = 2; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, boardCv.width, boardCv.height);
  c.drawImage(baseImg, 0, 0, boardCv.width, boardCv.height);
  if (tint !== 'off') {
    c.save(); c.scale(k, k); c.globalAlpha = 0.6;
    for (const a of MAP.areas) { c.beginPath(); a.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = hex6(tintOf(a.id)); c.fill(); }
    c.restore();
  }
  c.drawImage(linesImg, 0, 0, boardCv.width, boardCv.height);
  {
    c.save(); c.scale(k, k);
    for (const a of MAP.areas) { c.save(); c.translate(a.label[0], a.label[1]); c.rotate(viewRot()); drawAreaItems(c, a, layers, vpIcons, true); c.restore(); }
    if (layers.numbers) for (const e of MAP.entries) { c.save(); c.translate(e.x, e.y); c.rotate(viewRot()); drawEntry(c, e); c.restore(); }
    c.restore();
  }
  boardTex.needsUpdate = true;
}
applyArt();
function paintAreas() {
  const strat = g.phase === 'strategic' && selUnit, opts = selUnit ? (strat ? E.stratOptions(g, selUnit).map((a) => ({ area: a, mustStop: false })) : E.moveOptions(g, selUnit)) : [];
  const fight = g.phase === 'combat' || g.phase === 'btCombat' ? E.contestedAreas(g).filter((a) => !g.fought.includes(a)) : [], must = new Set(E.mustFight(g));
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial; let c = 0xffffff, o = 0; const r = opts.find((x) => x.area === id);
    if (r) { c = r.mustStop ? 0xff8a3d : 0x37d67a; o = 0.32; } else if (fight.includes(id)) { c = must.has(id) ? 0xff4d4d : 0xffc542; o = 0.28; }
    if (id === (previewArea ?? hoverArea) && r) { c = 0xffe08a; o = 0.5; }
    if (id === selArea && !selUnit) { c = 0x4aa3ff; o = Math.max(o, 0.3); }
    if (dragTargets.includes(id)) { c = 0x37d67a; o = 0.5; }
    if (tgt) { if (tgt.areas.has(id) || (tgt.any && false)) { c = tgt.color.get(id) ?? 0x37d67a; o = 0.5; } else if (tgt.pick.has(id)) { c = 0xe7b04a; o = 0.4; } }
    const ar = arrOpts().find((x) => x.area === id); if (ar) { c = ar.sa ? 0xff8a3d : 0x37d67a; o = 0.45; }
    if (g.battle?.stage === 'retreat' && E.retreatOptions(g, g.battle).includes(id)) { c = 0x37d67a; o = 0.5; }
    mat.color.setHex(c); mat.opacity = o;
  }
}

/* ---------- camera ---------- */
let target = new THREE.Vector3(17, 0, -3), yaw = 0, pitch = 1.0, dist = 36;
function placeCam() { cam.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(target); }
const ptrs = new Map<number, [number, number]>(); let moved = 0, pinch = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { goal = null; canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(110, Math.max(7, dist * pinch / d)); pinch = d; moved = 99; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey) { yaw -= dx * 0.006; pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006)); }
  else { const k = dist * 0.0018, c = Math.cos(yaw), s = Math.sin(yaw); target.x -= (dx * c + dy * s) * k; target.z -= (-dx * s + dy * c) * k; }
});
canvas.addEventListener('pointerup', (e) => { ptrs.delete(e.pointerId); if (moved < 6) click(e); });
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { goal = null; e.preventDefault(); dist = Math.min(110, Math.max(7, dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });

const ray = new THREE.Raycaster();
function pick(e: PointerEvent) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
  const hitPiece = ray.intersectObjects(pieces.children, false)[0];
  const hitBoard = ray.intersectObject(board)[0];
  let area: number | null = null;
  if (hitBoard) { const px = (hitBoard.point.x + MW / (2 * S)) * S, py = (hitBoard.point.z + MH / (2 * S)) * S; area = MAP.areas.find((a) => inside(px, py, a.polygon))?.id ?? null; }
  return { unit: hitPiece?.object.userData.unit as string | undefined, area };
}
function inside(x: number, y: number, poly: [number, number][]) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

/* ---------- ui helpers ---------- */
let acts: Record<string, () => void> = {}, actv: Record<string, (v: string) => void> = {}, n = 0;
const reg = (f: () => void) => { const k = 'a' + n++; acts[k] = f; return k; };
const regv = (f: (v: string) => void) => { const k = 'v' + n++; actv[k] = f; return k; };
/** A button that only changes what you see or who sits where, never the game: it works for anyone, whoever's turn it is. */
const ubtn = (label: string, f: () => void, cls = '', dis = false, title = '') => `<button class="${cls}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(title)}">${label}</button>`;
const btn = (label: string, f: () => void, cls = '', dis = false, title = '') => `<button class="${cls}" data-do="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(title)}">${label}</button>`;
const pips = (u: E.Unit) => Array.from({ length: u.str }, () => `<i class="pip ${E.quality(u)}"></i>`).join('');
const ABBR: Record<string, string> = { artillery: 'Arty', rocket_artillery: 'Rkt', engineer: 'Eng', armor_asset: 'Armor', infantry_asset: 'Inf', task_force: 'TF', fuel: 'Fuel', command_staff: 'Staff', sa_block: 'SA', replacement_inf: 'Repl inf', replacement_arm: 'Repl arm',
  rebuild_or_replace_inf: 'Rebuild inf', rebuild_or_replace_arm: 'Rebuild arm', event_arriving_regiment: 'Regt', special_action_event: 'SA event', air_mission: 'Air', event_release: 'Release', event_greif_bridge: 'Greif bridge', event_greif_interdict: 'Greif interdict', event_bodenplatte: 'Bodenplatte', event_delayed_response: 'Delayed' };
const chitLabel = (c: E.Chit) => `${ABBR[c.kind] ?? c.kind}${['fuel', 'sa_block', 'special_action_event', 'air_mission', 'replacement_inf', 'replacement_arm', 'event_delayed_response'].includes(c.kind) || c.name.length > 14 ? '' : ' ' + c.name}${c.turn !== 'S' && E.isEvent(c) ? ' T' + c.turn : ''}`;
/* ---------- playing a chit: the blocks or areas it can be used on light up, and a tap applies it ---------- */
let tgt: Tgt | null = null, infoOpen = false, tgtMode = '';
const abtn = (icon: string, label: string, fn: () => void, cls = '', dis = false, title = '') => btn(`${ico(icon)}<span>${esc(label)}</span>`, fn, 'ab ' + cls, dis, title || label);
const BTN_ICON: [RegExp, string][] = [[/blow|bridge.*bridge/i, 'xbold'], [/repair/i, 'engineer'], [/field works|fortify/i, 'gear'], [/roadblock|rally/i, 'flag'], [/interdict/i, 'warn'], [/alternate/i, 'swap'], [/pool/i, 'task_force'], [/intelligence/i, 'info'], [/reserve/i, 'sa_block'], [/replacement/i, 'infantry_asset'], [/drop|enter|place|boundary/i, 'next'], [/strike/i, 'air_mission']];
/** Give a chit action its icon so the buttons read at a glance; the text stays as the label. */
const iconify = (html: string) => html.replace(/<button class="([^"]*)" (data-do="[^"]+") ([^>]*)>([^<]*)<\/button>/g, (m, cls, d, rest, text) => { const ic = BTN_ICON.find(([re]) => re.test(text))?.[1]; return ic ? `<button class="${cls} ab" ${d} ${rest}>${ico(ic)}<span>${text}</span></button>` : m; });
/** The selected chit: a slim bar with its picture, a one-line instruction, an info toggle and the actions as icon buttons. */
function chitBar(c: E.Chit): string {
  const tg = tgt, body = chitPanel(c), [kind] = RULE[c.kind] ?? [c.kind];
  const chips = tg?.chips.map((x) => `<button class="pc ${c.side}" data-do="${reg(x.fn)}" title="${esc(x.label)}"><img alt="" src="${x.img}"><small>${esc(x.label)}</small></button>`).join('') ?? '';
  return `<div class="c-dispatch chitbar"><div class="cbhead"><img class="cbimg" alt="" src="${chitImg(c)}"><div class="cbt"><b>${esc(c.name)}</b><small>${esc(tg?.hint || kind)}</small></div>
    <button class="ico" data-ui="${reg(() => { infoOpen = !infoOpen; })}" aria-pressed="${infoOpen}" aria-label="What it does" title="What it does">${ico('info')}</button><button class="ico" data-ui="${reg(() => { selChit = null; })}" aria-label="Put away" title="Put away">${ico('close')}</button></div>
    ${infoOpen ? `<div class="inspect slimcard"><p>${esc((RULE[c.kind] ?? ['', ''])[1])}</p></div>` : ''}${tg && tg.modes.length > 1 ? `<div class="modes" role="group" aria-label="What to do">${tg.modes.map((m) => `<button class="ico ${m.id === tgtMode ? 'on' : ''}" data-ui="${reg(() => { tgtMode = m.id; refresh(); })}" title="${esc(m.label)}" aria-label="${esc(m.label)}">${ico(m.icon)}</button>`).join('')}</div>` : ''}${chips ? `<div class="cbchips">${chips}</div>` : ''}${tg?.buttons.length ? `<div class="row">${tg.buttons.map((b) => abtn(b.icon, b.label, b.fn, '', false, b.title)).join('')}</div>` : ''}${iconify(body)}</div>`;
}
function chitPanel(c: E.Chit): string {
  const a = selArea, out: string[] = [];
  const head = '';
  if (c.box !== 'available') return head + '<p class="hint">Only chits in the Available Box can be used.</p>';
  if (g.phase !== 'admin') return head + `<p class="hint">${E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission' ? 'This chit is assigned to a battle during the Combat Phase.' : c.kind === 'fuel' ? 'Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.' : c.kind === 'sa_block' || c.kind === 'special_action_event' ? 'Special Actions are spent in battles (reinforce / retreat), Breakthrough phases and the Admin Phase.' : 'Events are played in the Admin Phase.'}</p>`;
  if (c.kind.startsWith('replacement') || c.kind === 'event_arriving_regiment' || c.kind.startsWith('rebuild')) {
    const el = g.units.filter((x) => E.eligibleForStep(c, x));                                       // blocks on the map light up; eliminated ones come back from the chips above
    if (!el.length) out.push('<p class="hint">No reduced, supplied unit of the right class and Higher Echelon.</p>');
    if (c.kind.startsWith('rebuild')) g.units.filter((x) => x.area == null && x.max === 1 && x.side === c.side && x.q[0] !== 'elite' && !x.garrison && (c.kind.endsWith('arm') === (x.cls === 'armor')) && x.str === 0).forEach((x) => out.push(a == null ? '<p class="hint">Select an objective area to return an eliminated unit.</p>' : btn(`Return ${esc(x.name)} to ${esc(areaName(a))}`, () => E.playRebuild(g, c.id, x.id, a))));
  } else if (c.kind === 'event_bodenplatte') { out.push(btn(`Strike Allied air missions (${E.boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission').length} in the Available Box)`, () => E.playBodenplatte(g, c.id), 'primary')); }
  else if (c.kind === 'fuel') out.push('<p class="hint">Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.</p>');
  if (E.isEvent(c) && c.kind !== 'sa_block') out.push(btn('Alternate use', () => E.alternateUse(g, c.id), '', false, '4.21: return 2 assets to the cup instead'));
  return head + `<div class="row">${out.join('')}</div>`;
}

/* ---------- flow ---------- */
const STEPS = ['Prepare', 'Move', 'Fight', 'Breakthrough', 'Supply'], STEP_OF: Record<E.Phase, number> = { reinforcement: 0, admin: 0, movement: 1, strategic: 1, combat: 2, reaction: 2, btMove: 3, btCombat: 3, supply: 4 };
const other = E.other;
const fightable = () => E.contestedAreas(g).filter((a) => !g.fought.includes(a));
function idle(): boolean {                                                // phases with nothing to do are skipped for the player
  const p = g.phasing, o = other(p), us = (s: E.Side) => g.units.filter((u) => u.side === s && u.area != null && !u.garrison);
  switch (g.phase) {
    case 'reinforcement': return !g.tfNew.length && !g.pendingArrivals.length && !g.recover.length;
    case 'strategic': return !us(p).some((u) => u.reserve);
    case 'combat': case 'btCombat': return !fightable().length;
    case 'reaction': return !us(o).some((u) => u.reserve);
    case 'btMove': return !us(p).some((u) => (u.reserve || u.exploit) && !u.moved) && !(us(p).some((u) => u.cls === 'armor' && !u.moved) && E.saAvailable(g, p).length);
    case 'supply': return true;
    default: return false;
  }
}
function auto() { for (let i = 0; i < 12 && !g.over && !g.battle && !g.pendingBlow && idle(); i++) { try { E.endPhase(g); } catch { break; } } }
let toast = '', toastT = 0;
const say = (t: string) => { toast = t; clearTimeout(toastT); toastT = window.setTimeout(() => { toast = ''; render(); }, 2800); };
let dragTargets: number[] = [];
const hist = new History<E.Game>(); let note = '', selArr: string | null = null;
/** Who may act right now: one side, or both while each handles its own assets (admin, reinforcement, battle set-up). */
function actorNow(): E.Side | 'both' {
  if (g.pendingBlow) return other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side);
  const b = g.battle;
  if (b) return b.stage === 'setup' ? 'both' : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage) ? other(b.attacker) : b.attacker;
  if (g.phase === 'admin' || g.phase === 'reinforcement') return 'both';
  return g.phase === 'reaction' ? other(g.phasing) : g.phasing;
}
const allowed = () => !online.active || modal === 'menu' || online.both() || (online.mySide() != null && (actorNow() === 'both' || actorNow() === online.mySide()));
/** In a shared-screen game every side is yours; online only your own seat's pieces. */
const mine = (s: E.Side) => !online.active || online.both() || online.mySide() === s;
const notYou = () => online.mySide() == null ? 'You are watching. Take a seat in the menu to play.' : `Wait for the ${nm(actorNow() as E.Side)} player.`;
/* ---------- what a hit did: step losses, eliminations, retreats, field works ---------- */
let battleFx: Fx[] = [], rollFx: Fx[] = [];
/** Record and show what changed between two states. */
const fxLayer = new FxLayer(), showFx = (l: Fx[]) => fxLayer.show(l);
let pendingFx: Fx[] = [], rollNoted = false;
function noteFx(a: ReturnType<typeof snap>, x: E.Game, fresh?: boolean) { const d = diffFx(a, x); if (!d.length) return; battleFx.push(...d); if (fresh) { rollFx = d; pendingFx = d; } else showFx(d); }       // after a roll the effects wait for the dice to settle
function act(f: () => void, after = '') {
  if (!allowed()) return say(notYou());
  const before = g.battle ? snap(g) : null;
  const r = hist.run(g, () => { f(); auto(); });
  g = r.game; if (r.error) say(r.error.message); else { note = after; if (before && !rollNoted) noteFx(before, g); }       // a roll already noted its own effects, to show them once the dice have settled
  rollNoted = false;
  save(); refresh();
}
function undo() { if (!allowed()) return say(notYou()); const p = hist.undo(); if (!p) return; g = p; selUnit = selChit = selArr = previewArea = hoverArea = null; note = ''; save(); refresh(); }
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null, typing = !!t?.matches?.('input,select,textarea');
  if (e.key === 'Escape') { if (modal) { modal = null; render(); } else if (selUnit || selArr || selChit) { selUnit = selArr = selChit = null; previewArea = null; refresh(); } return; }
  if (e.key === 'Enter' && !typing && !t?.matches?.('button,[role=button]') && !modal) { const go = document.querySelector<HTMLButtonElement>('#ui .go:not(:disabled)'); if (go) { e.preventDefault(); go.click(); } }
 if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !(e.target as HTMLElement)?.matches?.('input,select')) { e.preventDefault(); undo(); } });
const tfAreas = () => [...E.areas.keys()].filter((a) => g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
function arrOpts(): { area: number; sa: boolean }[] {
  if (!selArr || g.phase !== 'reinforcement') return [];
  return g.pendingArrivals.includes(selArr) ? E.arrivalOptions(g, selArr) : g.tfNew.includes(selArr) ? tfAreas().map((area) => ({ area, sa: false })) : [];
}

/* ---------- camera focus ---------- */
type Goal = { t: THREE.Vector3; dist: number; pitch: number } | null; let goal: Goal = null, saved: Goal = null, inBattle = false;
let frameKey = '';
function syncBattleCam() {
  const b = g.battle, key = b ? `${b.area}:${b.stage === 'setup' ? 's' : 'f'}` : '';                 // re-centre when a battle opens and when its rolling starts
  if (b && key !== frameKey) { if (!inBattle) saved = { t: target.clone(), dist, pitch }; const p = toWorld(...POLE.get(b.area)!); goal = { t: new THREE.Vector3(p.x, 0, p.z - 1.6 * (viewSide() === 'allied' ? -1 : 1)), dist: innerWidth < 700 ? 15 : 17, pitch: 1.0 }; }
  if (!b && inBattle && saved) goal = saved;
  frameKey = key; inBattle = !!b;
}

/* ---------- map interaction ---------- */
const optsFor = (id: string): E.Opt[] => g.phase === 'strategic' ? E.stratOptions(g, id).map((a) => ({ area: a, cost: 0, fuel: g.units.find((x) => x.id === id)!.side === 'german', mustStop: false, path: [] })) : E.moveOptions(g, id);
const fuelLeft = () => E.boxOf(g, 'german', 'available').filter((c) => c.kind === 'fuel').length;
const center = (a: number) => toWorld(...POLE.get(a)!);
function confirmMove() {
  const id = selUnit!, to = previewArea!, u = g.units.find((x) => x.id === id)!, from = u.area!; selUnit = null; previewArea = null; selArea = to;
  act(() => { if (g.phase === 'strategic') E.stratMove(g, id, to); else E.move(g, id, to); }, `${u.name}: ${areaName(from)} → ${areaName(to)}`);
}
function click(e: PointerEvent) {
  const { unit, area } = pick(e);
  { const c0 = selChit ? g.chits.find((x) => x.id === selChit) : null, tg = c0 && g.phase === 'admin' ? tgt : null;
    if (tg) {
      const fnU = unit ? tg.units.get(unit) : undefined, fnA = area != null ? tg.areas.get(area) ?? tg.any?.(area) ?? undefined : undefined;
      if (fnU || fnA) { return act((fnU ?? fnA)!); }
      const pk = area != null && !unit ? tg.pick.get(area) : undefined; if (pk) { pk(); return refresh(); }
    } }
  const rb = g.battle;
  if (rb?.stage === 'retreat' && area != null && E.retreatOptions(g, rb).includes(area)) return act(() => E.chooseRetreat(g, rb, area));
  if (g.pendingBlow || g.battle) return;
  if (selArr && area != null && arrOpts().some((o) => o.area === area)) { const id = selArr; selArr = null; return act(() => { if (g.pendingArrivals.includes(id)) E.placeArrival(g, id, area); else E.placeTaskForce(g, id, area); }); }
  if (selUnit && area != null && optsFor(selUnit).some((o) => o.area === area)) { previewArea = area; refresh(); return; }
  if ((g.phase === 'combat' || g.phase === 'btCombat') && area != null && fightable().includes(area)) { selArea = selArea === area ? null : area; selUnit = null; previewArea = null; return refresh(); }
  const uu = unit ? g.units.find((x) => x.id === unit) : null;
  if (uu && seen(uu)) { selUnit = unit!; selArea = uu.area; } else { selArea = area; selUnit = null; }
  previewArea = null; hoverArea = null; refresh();
}
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || !selUnit || g.battle) return;
  const a = pick(e).area, h = a != null && optsFor(selUnit).some((o) => o.area === a) ? a : null;
  if (h !== hoverArea) { hoverArea = h; if (previewArea == null) refresh(); }
});

const route = new THREE.Group(); scene.add(route);
function drawRoute() {
  route.clear(); const to = previewArea ?? hoverArea; if (!selUnit || to == null) return;
  const o = optsFor(selUnit).find((x) => x.area === to); if (!o) return;
  const u = g.units.find((x) => x.id === selUnit)!, path = o.path.length ? o.path : [u.area!, to], pts = path.map((a) => { const p = center(a); return new THREE.Vector3(p.x, 0.25, p.z); });
  const mat = new THREE.MeshBasicMaterial({ color: o.fuel ? 0xe7b04a : 0x9fe870 });
  route.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.13, 6), mat));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 12), mat); tip.position.copy(pts[pts.length - 1]).setY(0.9); tip.rotation.x = Math.PI; route.add(tip);
}
type Badge = { area: number; text: string; cls: string };
let badges: Badge[] = [];
function badgeList(): Badge[] {
  const out: Badge[] = [];
  if (selUnit && !g.battle) { const u = g.units.find((x) => x.id === selUnit)!; for (const o of optsFor(selUnit)) out.push({ area: o.area, text: g.phase === 'strategic' ? '' : `${o.cost}`, cls: o.mustStop ? 'stop' : o.fuel && u.side === 'german' ? 'fuel' : 'ok' }); }
  if (!selUnit && (g.phase === 'combat' || g.phase === 'btCombat') && !g.battle) { const must = E.mustFight(g); fightable().forEach((a, i) => out.push({ area: a, text: must.includes(a) ? String(i + 1) : '?', cls: must.includes(a) ? 'war' : 'opt' })); }
  for (const a of dragTargets) out.push({ area: a, text: 'Drop', cls: 'ok' });
  for (const o of arrOpts()) out.push({ area: o.area, text: o.sa ? 'SA' : 'Enter', cls: o.sa ? 'stop' : 'ok' });
  if (g.battle?.stage === 'retreat') for (const a of E.retreatOptions(g, g.battle)) out.push({ area: a, text: 'Retreat', cls: 'ok' });
  return out;
}
const badgeEls = new Map<string, HTMLElement>();
function syncBadges() {
  const layer = $('#badges'); layer.innerHTML = ''; badgeEls.clear();
  for (const b of badges) { const d = document.createElement('div'); d.className = 'bdg ' + b.cls; d.textContent = b.text; layer.appendChild(d); badgeEls.set(String(b.area), d); }
}
function placeBadges() {
  { const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(); fxLayer.place((area) => { const p = center(area); v.set(p.x, 3, p.z).project(cam); return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, visible: v.z < 1 }; }); }
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  for (const [k, d] of badgeEls) { const p = d.classList.contains('tint') ? toWorld(...(MAP.areas.find((x) => x.id === +k)!.label)).add(new THREE.Vector3(0, 0, 2.3)) : center(+k); v.set(p.x, 2.2, p.z - 4).project(cam); d.style.display = v.z < 1 ? '' : 'none'; d.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`; }
}

/* ---------- battle state shared with the view ---------- */
interface RollView { title: string; groups: (DiceGroup & { parts: [string, number][]; hits: number })[]; pos: { x: number; y: number; group: number; v: number }[] | null }
let menuTab = 'Players';
let rollView: RollView | null = null, modal: 'menu' | 'boxes' | 'rules' | 'layers' | null = null, handSide: E.Side | null = null;
const STAGE_NAME: Record<string, string> = { attArty: 'artillery', defArty: 'artillery', defFire: 'Defensive fire', offFire: 'Offensive fire' };
function rollStage(b: E.Battle) {
  if (!allowed()) return say(notYou());
  const side = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker), kind = b.stage.endsWith('Arty') ? 'arty' : 'ground', fl = E.fireList(g, b, side, kind), n0 = b.rolls.length, stage = b.stage;
  const before = snap(g); E.roll_step(g, b); rollFx = []; noteFx(before, g, true); rollNoted = true; save();
  const fresh = b.rolls.slice(n0);
  rollView = { title: `${side === 'german' ? 'German' : 'Allied'} ${STAGE_NAME[stage]}`, pos: null, groups: fresh.map((r) => ({ label: r.who, col: r.kind === 'arty' ? 's' : side === 'german' ? 'k' : 'w', sn: r.sn, dice: r.dice, hits: r.hits, parts: fl.find((f) => f.who === r.who)?.parts ?? [] })) };
  if (!rollView.groups.length) { rollView = null; return refresh(); }
  refresh();
  const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => { if (rollView) { rollView.pos = p; render(); showFx(pendingFx); pendingFx = []; } });
}
function endRoll() { rollView = null; clearDice(); ($('#dice') as HTMLElement).style.display = 'none'; refresh(); }

/* ---------- cards and drag and drop ---------- */

const chitUri = new Map<string, string>();
const chitImg = (c: E.Chit) => { let u = chitUri.get(c.id); if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(chitSvg(c)); chitUri.set(c.id, u); } return u; };
const card = (c: E.Chit, r = 0, why: string | null = null) => `<div tabindex="0" role="button" class="card2 ${c.side} ${why ? 'bad' : ''} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" style="--r:${r}deg" title="${esc(why ?? c.name + ' · ' + c.ech)}" aria-label="${esc(c.name)}"><img alt="" draggable="false" src="${chitImg(c)}"></div>`;
const overlapFor = (n: number) => { const cw = innerWidth < 860 ? 78 : 104, avail = innerWidth - 56; const sq = Math.ceil((n * cw - avail) / (n - 1)); return n > 1 ? (innerWidth < 520 ? Math.min(Math.max(8, sq), 22) : Math.max(12, Math.min(cw - (innerWidth < 860 ? 38 : 14), sq))) : 0; };   // phones: always keep ~42px of each card tappable and let the hand scroll
const handStyle = (n: number) => `style="--ov:${overlapFor(n)}px"`;
const fan = (cs: string[]) => cs.map((h, i) => h.replace('--r:0deg', `--r:${((i - (cs.length - 1) / 2) * Math.min(5, 40 / cs.length)).toFixed(1)}deg`)).join('');
/** Place every asset that may legally join, artillery first, for both sides. */
function autoFill(b: E.Battle) {
  const order = (c: E.Chit) => (E.isArty(c) ? 0 : c.kind === 'engineer' ? 2 : 1);
  for (const c of g.chits.filter((x) => x.box === 'available' && (E.isArty(x) || E.isBattleAsset(x)) && mine(x.side)).sort((x, y) => order(x) - order(y))) { if (!E.canAssign(g, b, c.side, c)) E.assign(g, b, c.id); }
}
/** Where an event or asset chit can be played on the map (Admin Phase): the areas to light while it is dragged. */
function chitTargets(c: E.Chit): number[] {
  if (g.phase !== 'admin' || c.box !== 'available') return [];
  const all = [...E.areas.keys()];
  switch (c.kind) {
    case 'event_greif_bridge': return all.filter((a) => E.neighbors(a).some((t) => E.connection(a, t)!.river && !g.blown.includes(a < t ? `${a}-${t}` : `${t}-${a}`) && !g.greif[a < t ? `${a}-${t}` : `${t}-${a}`]));
    case 'event_greif_interdict': return all.filter((a) => E.blocks(g, a, 'allied').length);
    case 'event_release': return [4, 6];
    case 'air_mission': return all;
    case 'engineer': return all.filter((a) => E.bridgeTargets(g, c.side, a).length || E.repairTargets(g, c.side, a).length || E.roadblockAreas(g, c.side).includes(a));
    default: return c.name === 'v.d. Heydte' && E.heydteWindow(g, c) ? [31, 52] : [];
  }
}
/** The chit was dropped on an area: play it there, or open its panel when there is a choice to make. */
let lastPointer = 'mouse';
/** Touch: a card is tapped, never dragged (so the hand can scroll). In a battle it files itself; an event or asset with map targets lights them and waits for a tap on one. */
let handInfo = false, handInspect: string | null = null;
function tapCard(id: string) {
  const c = E.chit(g, id), b = g.battle;
  if (b) {
    if (b.stage !== 'setup') return;
    if (handInfo) { handInspect = handInspect === id ? null : id; return render(); }
    if (!mine(c.side)) return say('Those are the other player\'s assets.');
    const why = E.canAssign(g, b, c.side, c); if (why) return say(why);
    return act(() => { if (c.kind === 'air_mission') E.assign(g, b, id, 'arty'); else E.assign(g, b, id); });
  }
  selChit = selChit === id ? null : id; refresh();
}
function playChitOn(c: E.Chit, area: number) {
  selArea = area;
  const panel = () => { selChit = c.id; refresh(); };
  switch (c.kind) {
    case 'event_release': return act(() => E.releaseUnit(g, c.id, area as 4 | 6));
    case 'air_mission': return act(() => E.playInterdiction(g, c.id, area));
    case 'event_greif_bridge': { const t = E.neighbors(area).filter((n) => E.connection(area, n)!.river && !g.blown.includes(area < n ? `${area}-${n}` : `${n}-${area}`)); return t.length === 1 ? act(() => E.playGreifBridge(g, c.id, area, t[0])) : panel(); }
    case 'event_greif_interdict': { const u = E.blocks(g, area, 'allied'); return u.length === 1 ? act(() => E.playInterdict(g, c.id, u[0].id)) : panel(); }
    case 'engineer': return panel();
    default: if (c.name === 'v.d. Heydte') return act(() => E.heydteDrop(g, c.id, area as 31 | 52)); return panel();
  }
}
function drag(ev: PointerEvent, el: HTMLElement) {
  const id = el.dataset.chit!, c = E.chit(g, id), x0 = ev.clientX, y0 = ev.clientY; let ghost: HTMLElement | null = null, over: Element | null = null;
  const at = (e: PointerEvent) => document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.side && (n as HTMLElement).dataset?.zone || (n as HTMLElement).dataset?.unit);
  const mv = (e: PointerEvent) => {
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) { ghost = el.cloneNode(true) as HTMLElement; ghost.classList.add('ghost'); document.body.appendChild(ghost); if (!g.battle) { dragTargets = chitTargets(c); if (dragTargets.length) { paintAreas(); badges = badgeList(); syncBadges(); } } document.querySelectorAll<HTMLElement>('.slot').forEach((sl) => { const arty = E.isArty(c) || c.kind === 'air_mission'; if (sl.dataset.side === c.side && (sl.dataset.zone === 'arty') === arty) sl.classList.add('legal'); }); }
    if (!ghost) return; ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    const z = at(e) ?? null; if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); over?.classList.remove('over'); document.querySelectorAll('.slot.legal').forEach((sl) => sl.classList.remove('legal'));
    const b = g.battle;
    if (!b && dragTargets.length) {                                                                    // an event or asset dropped on the map
      const cands = dragTargets; dragTargets = [];
      if (ghost && document.elementFromPoint(e.clientX, e.clientY) === canvas) { const area = pick(e).area; if (area != null && cands.includes(area)) return playChitOn(c, area); say('That chit cannot be played there'); }
      refresh(); return;
    }
    if (b?.stage === 'setup' && handInfo && !ghost) { handInspect = handInspect === id ? null : id; render(); return; }
    if (!b || b.stage !== 'setup') { if (!ghost) { selChit = selChit === id ? null : id; refresh(); } return; }
    const z = ghost ? at(e) as HTMLElement | undefined : undefined, s = c.side;
    let zone = z?.dataset.zone, unit = z?.dataset.unit;
    if (!ghost) zone = E.isArty(c) || c.kind === 'air_mission' ? 'arty' : 'asset';               // a plain click files the card where it belongs
    if (!zone && !unit) return;
    const why = E.canAssign(g, b, s, c) ?? (z?.dataset.side && z.dataset.side !== s ? 'That slot belongs to the other side' : null) ?? (zone === 'arty' && c.kind === 'engineer' ? 'Engineers go in the Assets slot' : zone === 'asset' && (E.isArty(c)) ? 'Artillery goes in the Artillery slot' : null);
    if (!mine(s)) return say('Those are the other player\'s assets.');
    if (why) return say(why);
    act(() => { if (c.kind === 'air_mission') { if (unit) E.assign(g, b, id, 'support', unit); else E.assign(g, b, id, 'arty'); } else E.assign(g, b, id); });
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); dragTargets = []; refresh(); }, { once: true });
}

/* ---------- views ---------- */
function topBar() {
  const v = E.victory(g), tr = E.TRACK[g.turn - 1], i = g.phasing === 'german' ? 0 : 1, at = STEP_OF[g.phase];
  return `<div class="c-bar t"><button class="ico" data-modal="menu" title="Menu, log and new game" aria-label="Menu, log and new game">${ico('menu')}</button><div class="c-crumbs">${STEPS.map((s, k) => `<span class="${k === at ? 'on' : k < at ? 'done' : ''}">${s}</span>`).join('')}</div>
    <button class="ico ${tint !== 'off' ? 'on' : ''}" data-tint title="Map overlay: terrain defence / army zones / off" aria-label="Map overlay">${ico('layers')}<span class="bl">Overlay</span></button><button class="ico" data-home title="Reset the camera" aria-label="Reset the camera">${ico('home')}<span class="bl">View</span></button><button class="ico" data-undo title="${hist.length ? 'Undo: ' + esc(note || 'last action') + ' (Ctrl+Z)' : 'Nothing to undo yet. Undo is available until a die is rolled.'}" aria-label="Undo" ${hist.length ? '' : 'disabled'}>${ico('undo')}<span class="bl">Undo</span></button><div class="c-stat"><span>TURN<b>${g.turn}</b></span><span>PLAYING<b class="${g.phasing}">${nm(g.phasing).toUpperCase()}</b></span>${online.active ? `<span>YOU<b class="${online.mySide() ?? ''}">${online.both() ? 'BOTH' : (online.mySide() ?? 'WATCHING').toUpperCase()}</b></span>` : ''}${DEV ? `<button class="ico dev" data-seat title="Developer: switch seat (German, Allied, both, watching)" aria-label="Switch seat">${ico('swap')}<span class="bl">Seat</span></button>` : ''}<span>NET VP<b>${v.net > 0 ? 'GE +' + v.net : v.net < 0 ? 'AL +' + -v.net : '0'}</b></span><span title="Draws this phase (German / Allied)">DRAW<b>${tr.ge[i]}/${tr.al[i]}</b></span><button class="ico" data-modal="boxes" title="Pieces: boxes, arrivals" aria-label="Pieces">${ico('boxes')}</button></div></div>`;
}
function prompt() {
  const chip = online.active && !online.both() && online.mySide() && !g.over ? `<span class="turnchip ${allowed() ? 'go' : 'wait'}">${allowed() ? 'Your move' : 'Waiting'}</span> ` : '';
  return chip + promptText();
}
function promptText() {
  const b = g.battle;
  if (online.active && !allowed() && !g.over) return online.mySide() == null ? '<b>Watching.</b> Take a seat in the menu.' : `<b>Waiting for the ${nm(actorNow() as E.Side)} player…</b>`;
  if (note && !b && hist.length) return `${esc(note)} <button data-do="${reg(() => undo())}">Undo</button>`;
  if (g.over) return `<b>${esc(g.over)}</b>`;
  if (g.pendingBlow) return `<b>${nm(other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side))}</b>: attempt to blow the bridge?`;
  if (b?.stage === 'retreat') return '<b>Choose the retreat area.</b>';
  if (b && b.stage === 'setup' && b.ready?.length === 2) return '<b>Both ready.</b> Blocks are revealed…';
  if (b) return b.stage === 'setup' ? (() => { const me = online.mySide(), rd = (sd: E.Side) => b.ready?.includes(sd); return online.active && !online.both() && me ? `<b>${rd(me) ? 'You are ready.' : 'Tap an asset to add it, then press Ready.'}</b> Opponent: ${rd(other(me)) ? 'ready' : 'preparing'}.` : '<b>Tap a card to add it.</b> Tap a block for point unit.'; })() : b.stage === 'done' ? '' : rollView ? '' : b.stage.endsWith('Choice') ? 'Choose how to take the hits.' : `Next: <b>${STAGE_NAME[b.stage]}</b>`;
  const m = E.mustFight(g).length;
  switch (g.phase) {
    case 'reinforcement': return '<b>Pick a new block</b>, then a lit entry area.';
    case 'admin': return '<b>Tap a card</b> to play it, or end the step.';
    case 'movement': return selUnit ? 'Tap a <b>green</b> area, then <b>Move here</b>. <b>Orange</b>: must stop.' : '<b>Tap one of your blocks</b> to move it.';
    case 'strategic': return '<b>Tap a reserve block</b>, then a green area.';
    case 'combat': case 'btCombat': return m ? `<b>${m} battle${m > 1 ? 's' : ''} to fight.</b> Tap a red area.` : fightable().length ? '<b>Tap a contested area</b> to fight, or end the step.' : 'No battles left.';
    case 'reaction': return `<b>${nm(other(g.phasing))} reserves</b> may react: select a reserve block.`;
    case 'btMove': return '<b>Reserve and exploitation blocks</b> may move. Select one.';
    default: return 'Supply is checked automatically.';
  }
}
function primary(): { label: string; fn: () => void; dis?: boolean } | null {
  const b = g.battle;
  if (g.over || g.pendingBlow || rollView) return null;
  if (b) {
    if (b.stage === 'setup') {
      const solo = !online.active || online.both(), me = online.mySide();
      if (solo) return { label: 'Begin combat', fn: () => act(() => E.beginCombat(g, b)) };
      if (!me) return null;
      const on = b.ready?.includes(me);
      return { label: on ? 'Waiting… tap to undo' : 'Ready', fn: () => act(() => E.setReady(g, b, me, !on)) };
    }
    if (b.stage === 'done') return { label: 'Close battle', fn: () => act(() => { E.closeBattle(g); selArea = null; }) };
    if (b.stage.endsWith('Choice') || b.stage === 'retreat' || b.stage === 'attFirst') return null;
    return { label: `Roll ${STAGE_NAME[b.stage].toLowerCase()}`, fn: () => rollStage(b) };
  }
  const must = E.mustFight(g);
  if (g.phase === 'combat' || g.phase === 'btCombat') {                                              // the player picks the battle and starts it; nothing opens by itself
    const sel = selArea != null && fightable().includes(selArea) ? selArea : null;
    if (sel != null) return { label: `Fight ${areaName(sel)}`, fn: () => { selUnit = null; battleFx = []; rollFx = []; E.startBattle(g, sel, g.phase === 'btCombat'); } };
    if (must.length) return { label: 'Select a battle', fn: () => undefined, dis: true };
  }
  return { label: `End ${STEPS[STEP_OF[g.phase]].toLowerCase()}`, fn: () => act(() => { E.endPhase(g); selUnit = null; previewArea = null; selChit = null; }), dis: !!E.mustFight(g).length || !!g.recover.length };
}
const recoverSel: Record<string, string | null> = {};
let piecesTab: 'boxes' | 'arrivals' = 'boxes', piecesSide: E.Side | null = null, inspectId: string | null = null;
/** A short reading of what a chit does, in the series' own vocabulary; the printed rule is the authority. */

const pieceBtn = (c: E.Chit, f: () => void, on = false, dis = false) => `<button class="pc ${c.side} ${on ? 'on' : ''}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(c.name)}" aria-label="${esc(chitLabel(c))}"><img alt="" draggable="false" src="${chitImg(c)}"></button>`;
const ruleCard = (c: E.Chit) => { const [t, d] = RULE[c.kind] ?? [c.kind, '']; return `<img class="big" alt="" src="${chitImg(c)}"><div><h4>${esc(c.name)} <small>${esc(t)}</small></h4><p>${esc(d)}</p></div>`; };
const seatedView = () => online.active && !online.both() && !!online.mySide();
function piecesHtml() {
  const sd = piecesSide ?? viewSide(), tabs = chip('Pieces', piecesTab === 'boxes', () => { piecesTab = 'boxes'; }) + chip('Arrivals', piecesTab === 'arrivals', () => { piecesTab = 'arrivals'; }) + '<span class="sp"></span>' + (['german', 'allied'] as E.Side[]).sort((x, y) => +(y === viewSide()) - +(x === viewSide())).map((x) => chip(seatedView() ? (x === viewSide() ? 'My pieces' : 'Opponent\'s pieces') : nm(x), sd === x, () => { piecesSide = x; inspectId = null; })).join('');
  let body = '';
  if (piecesTab === 'boxes') {
    const sec = (title: string, bx: E.Chit['box']) => { const cs = E.boxOf(g, sd, bx); return `<h4>${title} <small>${cs.length}</small></h4><div class="pcgrid">${cs.map((c) => pieceBtn(c, () => { inspectId = inspectId === c.id ? null : c.id; }, inspectId === c.id)).join('') || '<small class="none">none</small>'}</div>`; };
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    body = `${pick ? `<div class="inspect">${ruleCard(pick)}</div>` : '<p class="hint">Tap a piece to read what it does.</p>'}<h4>Cup <small>${E.boxOf(g, sd, 'cup').length} chits, drawn at random</small></h4>${sec('Available', 'available')}${sec('Used', 'used')}${sec('Eliminated', 'eliminated')}`;
  } else {
    const rows: string[] = [];
    for (let t = 1; t <= g.lastTurn; t++) {
      const us = g.units.filter((u) => u.side === sd && u.arrival === t), cs = g.chits.filter((c) => c.side === sd && c.turn === t);
      if (!us.length && !cs.length) continue;
      rows.push(`<div class="oob ${t === g.turn ? 'now' : t < g.turn ? 'past' : ''}"><h4>Turn ${t}${t === g.turn ? ' · now' : ''}</h4><div class="oobrow">${us.map((u) => `<div class="oobu" title="${esc(u.name)}"><img alt="" src="${unitFace(u)}"><small>${esc(u.name)}</small><small class="en">${u.entry ? 'Entry ' + u.entry.join('/') : ''}</small></div>`).join('')}${cs.map((c) => pieceBtn(c, () => { inspectId = inspectId === c.id ? null : c.id; }, inspectId === c.id)).join('')}</div></div>`);
    }
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    body = `${pick ? `<div class="inspect">${ruleCard(pick)}</div>` : ''}${rows.join('')}`;
  }
  return `<div class="modal"><div class="sheet wide"><h3>${seatedView() ? (sd === viewSide() ? 'My pieces' : 'Opponent\'s pieces') : nm(sd) + ' pieces'} <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3><div class="chips tabrow">${tabs}</div>${body}</div></div>`;
}
function dispatch() {
  if (g.battle || g.over) return '';
  const row = (k: string, v: string, c = '') => `<div class="r"><span>${k}</span><b class="${c}">${v}</b></div>`;
  const c = selChit ? g.chits.find((x) => x.id === selChit) : null;
  if (c && g.phase === 'admin') return chitBar(c);
  if (g.phase === 'reinforcement' && g.recover.length) return `<div class="c-dispatch recover"><h3>Unused Special Action</h3><p class="hint">Each side may bring one asset back from the Used Box (4.1a).</p>${g.recover.map((sd) => {
    const cs = E.boxOf(g, sd, 'used').filter((c) => E.isAsset(c)), pick = recoverSel[sd] ? cs.find((c) => c.id === recoverSel[sd]) : null, own = mine(sd);
    return `<h4 class="${sd}">${nm(sd)}</h4><div class="pcgrid">${cs.map((c) => pieceBtn(c, () => { recoverSel[sd] = recoverSel[sd] === c.id ? null : c.id; }, recoverSel[sd] === c.id, !own)).join('') || '<small>Nothing in the Used Box</small>'}</div>
      ${pick ? `<div class="inspect">${ruleCard(pick)}</div>` : ''}<div class="row">${btn(pick ? `Bring back ${esc(pick.name)}` : 'Choose an asset', () => { E.recoverAsset(g, sd, pick!.id); recoverSel[sd] = null; }, 'primary', !pick || !own)}${btn('None', () => E.recoverAsset(g, sd, null), '', !own)}</div>`;
  }).join('')}</div>`;
  if (g.phase === 'reinforcement' && selArr) { const o = arrOpts(), name = g.pendingArrivals.includes(selArr) ? g.units.find((x) => x.id === selArr)!.name : 'Task Force'; return `<div class="c-dispatch"><h3>${esc(name)}</h3><p class="hint">${o.length ? 'Click a highlighted area on the map, or pick one:' : 'No legal area right now.'}</p><div class="row">${o.filter((x) => !x.sa).slice(0, 14).map((x) => btn(esc(areaName(x.area)), () => { const id = selArr!; selArr = null; if (g.pendingArrivals.includes(id)) E.placeArrival(g, id, x.area); else E.placeTaskForce(g, id, x.area); })).join('')}</div>${o.some((x) => x.sa) ? `<details><summary class=\"why\">Other entry areas (cost a Special Action, 8.27)</summary><div class=\"row\">${o.filter((x) => x.sa).map((x) => btn(esc(areaName(x.area)), () => { const id = selArr!; selArr = null; E.placeArrival(g, id, x.area); })).join('')}</div></details>` : ''}</div>`; }
  if (g.phase === 'btCombat' && !selUnit && selArea == null) { const air = E.boxOf(g, g.phasing, 'available').filter((x) => x.kind === 'air_mission'), as = E.airSupplyAreas(g, g.phasing); if (air.length && as.length && !g.airSupply) return `<div class="c-dispatch"><h3>Air supply</h3><p class="hint">Before the Supply Phase an Air Mission can supply one cut-off area (17.2).</p><div class="row">${as.map((ar) => btn(esc(areaName(ar)), () => E.playAirSupply(g, air[0].id, ar))).join('')}</div></div>`; }
  const u = selUnit ? g.units.find((x) => x.id === selUnit) : null;
  if (u) {
    const to = previewArea ?? hoverArea, o = to != null ? optsFor(u.id).find((x) => x.area === to) : null, n = fuelLeft(), strat = g.phase === 'strategic';
    const tags = [u.disorder === 1 ? 'disordered' : u.disorder === 2 ? 'recovering' : '', u.unsupplied ? 'unsupplied' : '', u.reserve ? 'reserve' : '', u.exploit ? 'exploit' : '', u.interdict ? 'interdicted' : ''].filter(Boolean);
    let route = '';
    if (o) route = `<div class="route"><h4>→ ${esc(areaName(o.area))}</h4>${strat ? row('Strategic move', 'any distance') : row('Movement', `${o.cost} MP`)}${u.side === 'german' && g.opts.fuel ? row('Fuel', o.fuel ? `−1 &nbsp;(${n} → ${n - 1})` : 'not needed', o.fuel ? 'bad' : '') : ''}${o.mustStop ? row('Stops here', 'enemy present, battle follows', 'bad') : ''}${btn('Move here', () => { previewArea = o.area; confirmMove(); }, 'primary')}</div>`;
    else if (optsFor(u.id).length) route = `<p class="hint">${optsFor(u.id).length} destination(s). Hover or click a highlighted area.</p>`;
    const can = ['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved;
    const fw = can && u.area != null && !u.unsupplied && !u.disorder && !E.contested(g, u.area) && !g.fieldWorks.includes(u.area) && ((g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit)));
    return `<div class="c-dispatch"><h3 class="${u.side}">${esc(u.name)}</h3><div class="pipsrow">${pips(u)} <small>${u.garrison ? 'asset' : u.cls} · ${tags.join(' · ') || 'in order'}</small></div>${route}
      <div class="row">${g.phase === 'movement' && u.side === g.phasing ? (u.reserve ? btn('Remove reserve', () => E.setReserve(g, u.id, false)) : btn('Reserve', () => E.setReserve(g, u.id, true), '', !E.canReserve(g, u))) : ''}${fw ? btn('Fortify', () => E.buildFieldWorks(g, u.id)) : ''}${g.phase === 'btMove' && u.side === g.phasing && u.cls === 'armor' && !u.exploit && !u.reserve && !u.moved ? btn('Activate (SA)', () => E.activateBreakthrough(g, u.id), '', !E.saAvailable(g, u.side, u.ech).length) : ''}</div></div>`;
  }
  return '';
}
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** Fly the camera over the legal entry areas of the selected arriving block. */
function frameArrival() { const all = arrOpts(), o = all.some((x) => !x.sa) ? all.filter((x) => !x.sa) : all; if (selArr && o.length) { const pts = o.map((x) => center(x.area)), cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length, r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))); goal = { t: new THREE.Vector3(cx, 0, cz), dist: Math.min(70, Math.max(24, r * 2.3 + 10)), pitch: 1.15 }; } }
/** Drag an arriving block from the tray onto an entry area of the map. A click without moving still just selects it. */
function dragArrival(ev: PointerEvent, el: HTMLElement) {
  if (ev.button !== 0) return;
  const id = el.dataset.arr!, x0 = ev.clientX, y0 = ev.clientY; let ghost: HTMLElement | null = null;
  const mv = (e: PointerEvent) => {
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { ghost = el.querySelector('.b3')!.cloneNode(true) as HTMLElement; ghost.classList.add('ghost'); document.body.appendChild(ghost); if (selArr !== id) { selArr = id; paintAreas(); badges = badgeList(); syncBadges(); frameArrival(); } }                 // no re-render here: replacing the dragged element would cut a touch drag short
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (!ghost) return; ghost.remove(); e.preventDefault(); const clean = () => { if (selArr === id) { selArr = null; refresh(); } };
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (top !== canvas && top?.closest('.dock, .c-bar, .c-dispatch, .modal, .legend')) { say('Drop it on a highlighted entry area of the map'); return clean(); }
    const area = pick(e).area; if (area == null || !arrOpts().some((o) => o.area === area)) { say('That is not a legal entry area for this block'); return clean(); }
    selArr = null; act(() => { if (g.pendingArrivals.includes(id)) E.placeArrival(g, id, area); else E.placeTaskForce(g, id, area); });
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); }, { once: true });
}
/** A block drawn as a real 3D object (front label, right and top faces), for the tray and the battle view. */
const blankFace = (side: E.Side) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="${side === 'german' ? '#8e9296' : '#5d8a45'}"/></svg>`);
const unitFace = (u: E.Unit) => svgUri(u.garrison ? garrisonArt(u) : labelSvg(u));
const b3 = (face: string, side: E.Side | 'british', chit = false) => `<span class="b3 ${side} ${chit ? 'flat' : ''}" aria-hidden="true"><i class="f"><img alt="" draggable="false" src="${face}"></i><i class="r"></i><i class="t"></i></span>`;
const sideOfUnit = (u: E.Unit) => (u.side === 'german' ? 'german' : BRIT.has(u.name) ? 'british' : 'allied');
function tray() {
  const us = g.pendingArrivals.map((id) => g.units.find((x) => x.id === id)!), tf = g.tfNew.map((id) => E.chit(g, id));
  if (!us.length && !tf.length) return '';
  return `<div class="arrtray" role="group" aria-label="Arriving reinforcements"><span class="why">Drag a block to a highlighted entry area, or click it to see them.</span>${us.map((u) => `<button class="arr ${u.id === selArr ? 'sel' : ''}" data-arr="${u.id}" title="${esc(u.name)}">${b3(unitFace(u), sideOfUnit(u), !!u.garrison)}<small>${esc(u.name)}</small></button>`).join('')}${tf.map((c) => `<button class="arr ${c.id === selArr ? 'sel' : ''}" data-arr="${c.id}" title="Task Force">${b3(svgUri(garrisonChit('Task Force', `${c.turn}-*`, false)), 'allied', true)}<small>Task Force</small></button>`).join('')}</div>`;
}
/** One slim line above the hand: what the chosen card does and whether it can join, without covering the map. */
function cardTip() {
  const c = handInspect ? g.chits.find((x) => x.id === handInspect) : null, b = g.battle;
  if (!c || !b) return '<div class="cardtip"><span>Tap a card to read its rule.</span></div>';
  const [t, d] = RULE[c.kind] ?? [c.kind, ''], why = E.canAssign(g, b, c.side, c);
  return `<div class="cardtip"><img alt="" src="${chitImg(c)}"><div><b>${esc(c.name)} <small>${esc(t)}</small></b><span>${esc(d)}</span>${why ? `<em>Cannot join: ${esc(why)}</em>` : '<em class="ok">Can join this battle</em>'}</div></div>`;
}
function handCards() {
  const b = g.battle;
  if (!b && g.phase === 'reinforcement') return tray();
  if (b) {
    if (b.stage !== 'setup') return '';
    const cs = ([b.attacker, other(b.attacker)] as E.Side[]).filter(mine).sort().flatMap((s) => E.boxOf(g, s, 'available').filter((c) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission'));
    const ok = cs.filter((c) => !E.canAssign(g, b, c.side, c));
    const bad = cs.filter((c) => E.canAssign(g, b, c.side, c));
    return `<div class="handtab">${mine(b.attacker) ? btn(`${ico('close')}<span class="bl">Cancel</span>`, () => { E.cancelBattle(g); }, 'ico danger', !!b.locked, b.locked ? 'A Special Action was spent, so the battle must be fought' : 'Withdraw the attack and return every assigned asset') : ''}<button class="ico ${handInfo ? 'on' : ''}" data-ui="${reg(() => { handInfo = !handInfo; if (!handInfo) handInspect = null; })}" aria-pressed="${handInfo}" title="Rules: tap a card to read what it does instead of adding it" aria-label="Rules">${ico('info')}</button>${ok.length ? btn(`${ico('wand')}<span class="bl">Auto-fill</span>`, () => autoFill(b), 'ico', false, 'Auto-fill: place every asset that can legally join, artillery first') : ''}</div>${handInfo ? cardTip() : ''}<div class="c-hand" ${handStyle(ok.length + bad.length)}>${fan([...ok.map((c) => card(c)), ...bad.map((c) => card(c, 0, E.canAssign(g, b, c.side, c)))])}</div>`;
  }
  if (g.phase !== 'admin') return '';
  const s = handSide ?? g.phasing, cs = [...E.boxOf(g, s, 'available')].sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
  return `<div class="handtab"><button data-do="${reg(() => { handSide = other(s); })}" class="${s}">${nm(s)} hand · ${cs.length} ${ico('swap')}</button></div><div class="c-hand" ${handStyle(cs.length)}>${fan(cs.map((c) => card(c)))}</div>`;
}
function stats(b: E.Battle, s: E.Side) {
  const ls = (['arty', 'ground'] as const).flatMap((k) => E.fireList(g, b, s, k)), pmf = E.hitPmf(ls.map((f) => ({ dice: f.dice, sn: f.sn })));
  return { mean: E.meanHits(pmf), p: (n: number) => Math.round(E.probAtLeast(pmf, n) * 100) };
}
function battleTable() {
  const b = g.battle; if (!b) return '';
  const L = E.areas.get(b.area)!, att = b.attacker, setup = b.stage === 'setup';
  const side = (s: E.Side) => {
    const us = E.unitsIn(g, b.area, s), pt = s === att ? b.attPoint : b.defPoint, lim = E.assetLimits(g, b, s), ids = b.assets[s].map((id) => E.chit(g, id)), air = b.air[s] ? E.chit(g, b.air[s]!.id) : null;
    const arty = [...ids.filter((c) => E.isArty(c)), ...(air && b.air[s]!.mode === 'arty' ? [air] : [])], rest = ids.filter((c) => !E.isArty(c));
    const mini = (c: E.Chit) => `<span class="mini ${c.side}" title="${esc(c.name)}"><img alt="${esc(c.name)}" src="${chitImg(c)}">${setup ? `<button class="x" aria-label="Remove ${esc(c.name)}" data-do="${reg(() => { if (mine(c.side)) E.unassign(g, b, c.id); else say('Those are the other player\'s assets.'); })}">${ico('close')}</button>` : ''}</span>`;
    const sa = setup && s !== att ? E.saAvailable(g, s).length : 0;
    return `<div class="c-side ${s} ${mine(s) ? 'mine' : 'theirs'}"><h4 title="${nm(s)} ${s === att ? 'attacking' : 'defending'}"><span class="tag">${s === 'german' ? 'GE' : 'AL'}</span>${ico(s === att ? 'next' : 'shield')}<span class="nm">${nm(s)}</span>${online.active && !online.both() ? `<small>${mine(s) ? 'you' : 'foe'}</small>` : ''}</h4>
      <div class="c-body"><div class="c-row">${us.map((u) => `<div tabindex="0" role="button" class="blk ${s} ${u.id === pt && seen(u) ? 'pt' : ''} ${air && b.air[s]!.mode === 'support' && b.air[s]!.unit === u.id ? 'air' : ''}" data-unit="${u.id}" data-side="${s}" data-tag="${s === 'german' ? 'G' : 'A'}" title="${seen(u) ? esc(u.name) + (u.id === pt ? ' (point unit)' : '') : 'Hidden block'}" aria-label="${seen(u) ? esc(u.name) : 'Hidden block'}">${b3(seen(u) ? unitFace(u) : blankFace(u.side), sideOfUnit(u), !!u.garrison)}</div>`).join('')}</div>
      <div class="c-slots">${setup || arty.length ? `<div class="slot" data-side="${s}" data-zone="arty"><span class="lab" title="Artillery ${arty.length} of ${lim.arty}">${ico('artillery')}${arty.length}/${lim.arty}</span>${arty.map(mini).join('') || ico('plus')}</div>` : ''}${setup || rest.length ? `<div class="slot" data-side="${s}" data-zone="asset"><span class="lab" title="Battle assets and events">${ico('armor_asset')}</span>${rest.map(mini).join('') || ico('plus')}</div>` : ''}</div></div>
      ${sa ? `<div class="row">${btn('Retreat (SA)', () => E.defenderRetreatSA(g, b), '', !mine(s) || !!b.assets[s].length || us.some((u) => u.garrison) || !us.length)}</div>` : ''}</div>`;
  };
  const covered = E.unitsIn(g, b.area).some((u) => !seen(u)), al = stats(b, 'allied'), ge = stats(b, 'german'), tot = al.mean + ge.mean || 1;
  return `<div class="c-table ${rollView ? 'rolling' : ''}"><div class="c-title">${g.fought.length + fightable().length > 1 ? `<small class="cnt" title="Battle ${g.fought.length + 1} of ${g.fought.length + fightable().length}">${Math.min(g.fought.length + 1, g.fought.length + fightable().length)}/${g.fought.length + fightable().length}</small>` : ''}${b.bt ? '<small class="cnt" title="Breakthrough combat">BT</small>' : ''}<b>${esc(L.name)}</b><span class="chp" title="Terrain defence number ${L.tdn}: attackers −${L.tdn} to hit">${ico('tree')}${L.tdn}</span>${g.fieldWorks.includes(b.area) ? `<span class="chp" title="Field works">${ico('gear')}</span>` : ''}${b.riverAssault ? `<span class="chp" title="River assault">${ico('wave')}</span>` : ''}</div>${side('allied')}
    <div class="c-vs">${covered ? '<div class="big">?<span>:</span>?</div>' : `<div class="big" title="Expected hits per combat round: Allied : German">${al.mean.toFixed(1)}<span>:</span>${ge.mean.toFixed(1)}</div><div class="gauge"><i style="width:${(al.mean / tot) * 100}%"></i></div>`}</div>${side('german')}</div>`;
}
function ledger() {
  const b = g.battle; if (!b || g.pendingBlow) return '';
  if (rollView) {
    const rv = rollView, hits = rv.groups.reduce((a, x) => a + x.hits, 0), labels = (rv.pos ?? []).map((p) => { const hit = isHit(p.v, rv.groups[p.group].sn); return `<div class="lbl ${hit ? 'hit' : 'miss'}" style="left:${p.x}px;top:${p.y}px">${hit ? 'HIT!' : 'MISS'}</div>`; }).join('');
    return `<div class="labels">${labels}</div><div class="c-ledger tight"><div class="lh"><h3>${esc(rv.title)}</h3><b class="tot ${hits ? 'hit' : 'miss'}">${rv.pos ? `${hits} hit${hits === 1 ? '' : 's'}` : '…'}</b></div>${rv.pos ? rollFx.map(fxRow).join('') : ''}${rv.groups.map((x) => `<div class="ln2"><span class="who">${esc(x.label)}</span><span class="sn">SN ${x.sn}</span><span class="cnt">${x.dice.length}${ico('dice')}</span><b class="${x.hits ? 'hit' : 'miss'}">${x.hits}</b></div>`).join('')}
      <div class="row end"><button class="primary" data-do="${reg(() => endRoll())}" ${rv.pos ? '' : 'disabled'}>Continue${ico('next')}</button></div></div>`;
  }
  if (b.stage === 'done') return `<div class="c-ledger tight"><div class="lh"><h3>Battle over</h3></div><p class="resline">${esc(b.result ?? '')}</p>${battleFx.map(fxRow).join('')}</div>`;
  if (b.stage === 'retreat' && b.retreat) { const u = g.units.find((x) => x.id === b.retreat!.queue[0])!; return `<div class="c-ledger"><h3>${esc(u.name)} retreats</h3><p class="hint">The block becomes disordered.</p><div class="row">${E.retreatOptions(g, b).map((a) => btn(esc(areaName(a)), () => E.chooseRetreat(g, b, a), 'primary')).join('')}</div></div>`; }
  if (b.stage === 'attFirst') { const att = b.attacker, opts = [{ k: b.attPoint, n: `${g.units.find((u) => u.id === b.attPoint)!.name} (point unit, loses a step)` }, ...b.assets[att].filter((id) => E.isBattleAsset(E.chit(g, id))).map((id) => ({ k: id, n: `${E.chit(g, id).name} (asset is eliminated)` }))]; return `<div class="c-ledger"><h3>${b.pending} hit(s) on the attackers</h3><p class="hint">The first hit falls on the point unit or on one battle asset (6.41a). Which one?</p><div class="row">${opts.map((o) => btn(esc(o.n), () => E.chooseFirstLoss(g, b, o.k))).join('')}</div></div>`; }
  if (b.stage === 'attChoice') return `<div class="c-ledger"><h3>${b.pending} hit(s) on the attackers</h3><p class="hint">Abort: all attackers disordered, no losses. Or take the losses.</p><div class="row end">${btn('Abort attack', () => E.attackerChoice(g, b, true))}${btn('Take losses', () => E.attackerChoice(g, b, false), 'primary')}</div></div>`;
  if (b.stage === 'defChoice') return `<div class="c-ledger"><h3>${b.pending} hit(s) on the defenders</h3><p class="hint">${b.pendingKind === 'arty' ? 'Disorder all defenders to absorb 1 hit, or take every hit.' : 'Retreat (absorbs 1 hit, units disordered) or stand and take the hits.'}</p><div class="row end">${btn('Take losses', () => E.defenderChoice(g, b, false))}${btn(b.pendingKind === 'arty' ? 'Disorder (absorb 1)' : 'Retreat', () => E.defenderChoice(g, b, true), 'primary')}</div></div>`;
  if (STAGE_NAME[b.stage]) {                                                                           // fire step: who rolls, what, against which number and why
    const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker), fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground'), mineStep = !online.active || online.both() || online.mySide() === sd;
    const lines = fl.map((f) => `<div class="fl"><span class="who">${esc(f.who)}</span><span class="cnt">${f.dice}${ico('dice')}</span><b class="sn">SN ${f.sn}</b><span class="chips2">${modChips(f.parts)}</span></div>`).join('') || '<p class="hint">Nothing can fire.</p>';
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}</h3></div>${lines}${b.stage === 'offFire' && b.assets[b.attacker].some((id) => E.chit(g, id).kind === 'engineer') && g.fieldWorks.includes(b.area) ? `<label><input type="checkbox" ${b.engFw ? 'checked' : ''} data-sel="${regv((v) => { act(() => E.setEngFw(g, b, v === 'on')); })}"> Engineer removes the field works instead of firing (6.33)</label>` : ''}${mineStep ? '' : `<p class="hint">Waiting for the ${nm(sd)} player to roll…</p>`}</div>`;
  }
  return '';
}
function legend() {
  if (tint === 'off') return '';
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const items = tint === 'control' ? [[CONTROL_COL.allied, 'Allied', 'control'], [CONTROL_COL.german, 'German', 'control'], [CONTROL_COL.contested, 'Contested', 'both sides present']] : tint === 'tdn' ? TDN_COL.map((c, i) => [c, `TDN ${i}`, (i ? `attackers −${i} to hit` : 'no modifier')]) : [[ZONE_COL[5], 'Zone 5', '5th Panzer Army'], [ZONE_COL[6], 'Zone 6', '6th Panzer Army'], [ZONE_COL[7], 'Zone 7', '7th Army']];
  return `<div class="legend" aria-label="Overlay legend"><b>${tint === 'tdn' ? 'Terrain defence' : tint === 'control' ? 'Area control' : 'Army zones'}</b>${items.map(([c, a, b]) => `<span><i style="background:${hex(c as number)}"></i>${a} <small>${b}</small></span>`).join('')}</div>`;
}
/* ---------- home: sign in, your games, a new game, join ---------- */
let matches: Match[] = [], form = { game: 'bulge', title: '', side: 'german' as E.Side | '', scenario: 'tournament' as E.Opts['scenario'], fuel: true }, homeMsg = (() => { try { const m = sessionStorage.getItem('fab-notice') ?? ''; sessionStorage.removeItem('fab-notice'); return m; } catch { return ''; } })(), creating = false;
const inviteLink = (id: string) => `${location.origin}${location.pathname}?table=${id}`;
const homeUrl = () => location.pathname;
async function share(id: string, title: string) {
  const url = inviteLink(id);
  try { if (navigator.share) await navigator.share({ title: `FAB · ${title}`, text: 'Join my game of FAB', url }); else { await navigator.clipboard.writeText(url); say('Invite link copied'); } } catch { homeMsg = url; }
  render();
}
async function dropMatch(m: { id: string; title: string; owner: string }) {
  const own = m.owner === online.uid || online.admin;
  if (!confirm(own ? `Delete "${m.title}" for everyone? This cannot be undone.` : `Remove "${m.title}" from your games?`)) return;
  await (own ? lobby.remove(m.id) : lobby.leave(m.id));
  if (m.id === TABLE) location.href = homeUrl();
}
async function createGame() {
  const info = gameInfo(form.game); if (!info?.ready) return;
  const opts: E.Opts = { scenario: form.scenario, fuel: form.fuel }, title = form.title.trim() || `${info.name} · ${new Date().toLocaleDateString()}`;
  homeMsg = 'Creating…'; render();
  const id = await lobby.create({ game: form.game, title, opts }, form.side || null, JSON.stringify(E.newGame(undefined, opts)));
  if (id.startsWith('!')) { homeMsg = id.slice(1); return render(); }
  location.href = `${homeUrl()}?table=${id}`;
}
function joinByCode(v: string) {
  const m = v.trim().match(/[?&]table=([\w-]+)/)?.[1] ?? v.trim(); if (!/^[\w-]{3,40}$/.test(m)) { homeMsg = 'Paste the invite link or the game code.'; return render(); }
  location.href = `${homeUrl()}?table=${m}`;
}
const stateOf = (m: Match) => (m.germanName && m.alliedName ? 'In play' : 'Waiting for an opponent');
/** The first screen: never on top of a game. Signed out it is just the sign-in; signed in it is your games, a new game and a way to join one. */
function homeHtml() {
  const a = online.account, signed = !!a && !a.guest, info = gameInfo(form.game);
  const head = `<header><h1>Fast Action Battles</h1><p>Board-game battles with the series rules, played online.</p></header>`;
  if (!online.ready) return `<div class="homepage"><div class="homein">${head}<p class="hint">Connecting…</p></div></div>`;
  if (online.mode !== 'remote' || !online.hasAccounts) return `<div class="homepage"><div class="homein">${head}<section class="card"><p class="hint">Online play is not set up on this site.${online.error ? ' ' + esc(online.error) : ''}</p></section></div></div>`;
  if (!signed) return `<div class="homepage"><div class="homein">${head}<section class="card"><h2>Sign in</h2>${sessionStorage.getItem('fab-next') ? '<p class="hint">You will go straight back to the game you were invited to.</p>' : '<p class="hint">To create a game or join one. Anyone can watch a game from its link.</p>'}${accountHtml()}</section>${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}</div></div>`;
  const mine = matches.map((m) => `<div class="matchrow"><button class="open" data-do="${reg(() => { location.href = `${homeUrl()}?table=${m.id}`; })}"><b>${esc(m.title)}</b><small>${esc(gameInfo(m.game)?.name ?? m.game)} · ${esc(stateOf(m))}</small><small>German ${esc(m.germanName || 'open seat')} · Allied ${esc(m.alliedName || 'open seat')}</small></button><div class="row">${btn(`${ico('share')}`, () => { void share(m.id, m.title); }, 'ico', false, 'Invite a player')}${btn(`${ico('close')}`, () => { void dropMatch(m); }, 'ico danger', false, m.owner === online.uid || online.admin ? 'Delete this game for everyone' : 'Remove from my list')}</div></div>`).join('') || '<p class="hint">No games yet.</p>';
  const side = (v: E.Side | '', label: string) => chip(label, form.side === v, () => { form.side = v; });
  const create = creating ? `<div class="newgame"><div class="authform"><input placeholder="Game name (optional)" value="${esc(form.title)}" data-sel="${regv((x) => { form.title = x; })}"></div>
      <h4>You play</h4><div class="chips">${side('german', 'German')}${side('allied', 'Allied')}${side('', 'Decide later')}</div>
      <h4>Scenario</h4><div class="chips">${chip('Tournament · 5 turns', form.scenario === 'tournament', () => { form.scenario = 'tournament'; })}${chip('Campaign · 9 turns', form.scenario === 'campaign', () => { form.scenario = 'campaign'; })}${chip('German fuel rule', form.fuel, () => { form.fuel = !form.fuel; })}</div>
      <div class="row">${btn('Create game', () => { void createGame(); }, 'primary', !info?.ready)}${btn('Cancel', () => { creating = false; })}</div></div>` : `<div class="row">${btn(`${ico('plus')} New game`, () => { creating = true; }, 'primary')}</div>`;
  return `<div class="homepage"><div class="homein">${head}
    <section class="card"><div class="lh"><h2>Your games</h2><span class="who">${esc(a!.name || a!.email)} <button class="plain" data-auth="out">Sign out</button></span></div>${mine}${create}</section>
    <section class="card"><h2>Join with an invite</h2><div class="row authform"><input id="join" class="grow" placeholder="Paste the invite link or code">${btn('Join', () => { joinByCode(($('#join') as HTMLInputElement).value); })}</div></section>
    ${homeMsg ? `<p class="hint"><b>${esc(homeMsg)}</b></p>` : ''}${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
  </div></div>`;
}
/** A slim bar over the table when you are not seated, or while you wait for an opponent. */
function seatBar() {
  if (online.mode !== 'remote' || !online.hasAccounts) return '';
  if (online.error) return `<div class="seatbar err"><span>${esc(online.error)}</span>${ubtn('OK', () => { online.error = ''; })}</div>`;
  const a = online.account, me = online.mySide(), s = online.seats, title = matches.find((m) => m.id === TABLE)?.title ?? 'a game of FAB';
  if (!a || a.guest) return `<div class="seatbar"><span>You are watching.</span>${ubtn('Sign in to play', () => { try { sessionStorage.setItem('fab-next', TABLE); } catch { /* private mode */ } location.href = homeUrl(); }, 'primary')}</div>`;
  if (!me) { const free = (['german', 'allied'] as E.Side[]).filter((x) => !s[x]); return `<div class="seatbar"><span>${free.length ? 'Take a seat:' : 'Both seats are taken. You are watching.'}</span>${free.map((x) => ubtn(`Play ${nm(x)}`, () => { void sit(x); }, 'primary')).join('')}</div>`; }
  if (!s.german || !s.allied) return `<div class="seatbar"><span>Waiting for your opponent.</span>${ubtn(`${ico('share')} Invite`, () => { void share(TABLE, title); }, 'primary')}</div>`;
  return '';
}
/** Sign-in panel (Firebase only): Google, or email and password; guests can watch but not play. */
function accountHtml() {
  if (!online.hasAccounts) return '';
  const a = online.account;
  if (a && !a.guest) return `<h4>Account</h4><p class="hint">Signed in as <b>${esc(a.name || a.email)}</b>${a.email ? ' · ' + esc(a.email) : ''}${a.admin ? ' · <b>admin</b>' : ''}</p><div class="row"><button data-auth="out">Sign out</button></div>`;
  return `<div class="row"><button class="primary" data-auth="google">Continue with Google</button></div>
    <div class="authform"><input id="a-name" placeholder="Name (to register)" autocomplete="name"><input id="a-mail" type="email" placeholder="Email" autocomplete="email"><input id="a-pass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password"></div>
    <div class="row"><button data-auth="in">Sign in</button><button data-auth="reg">Register</button><button data-auth="reset">Forgot password</button></div>`;
}
const rulesOne = () => rulesText.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
const rulesLink = () => `https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ''}/firestore/databases/-default-/rules`;
async function copyText(t: string, what: string) { try { await navigator.clipboard.writeText(t); toast = `${what} copied`; } catch { toast = 'Copy failed: select the text below and copy it by hand'; } render(); setTimeout(() => { toast = ''; render(); }, 2500); }
function rulesHtml() {
  return `<div class="modal"><div class="sheet"><h3>Update Firebase rules <button class="ico" data-modal="menu" aria-label="Back">${ico('close')}</button></h3>
    <p class="hint">These are the rules this version of the site expects. Copy them, open the Firebase rules editor, replace everything there with them and press Publish.</p>
    <div class="row"><a class="primary" href="${rulesLink()}" target="_blank" rel="noopener" style="padding:8px 12px;text-decoration:none">Open Firebase rules ↗</a>${btn('Copy expanded', () => { void copyText(rulesText, 'Rules'); })}${btn('Copy single line', () => { void copyText(rulesOne(), 'Single-line rules'); })}</div>
    <h4>Expanded</h4><textarea readonly rows="10" style="width:100%;font:12px monospace">${esc(rulesText)}</textarea>
    <h4>Single line</h4><textarea readonly rows="4" style="width:100%;font:12px monospace">${esc(rulesOne())}</textarea></div></div>`;
}
/** A Success Number modifier as a small icon chip: the sign and size are the data, the full reason is the tooltip. */
const modIcon = (why: string) => /base/i.test(why) ? 'target' : /armor|infantry|class/i.test(why) ? 'armor_asset' : /green|veteran|elite|quality/i.test(why) ? 'star' : /terrain|tdn/i.test(why) ? 'tree' : /field/i.test(why) ? 'gear' : /river/i.test(why) ? 'wave' : /disorder/i.test(why) ? 'disorder' : /supply/i.test(why) ? 'warn' : /air|asset|artillery/i.test(why) ? 'air_mission' : 'info';
const modChips = (parts: [string, number][]) => parts.map(([w, v]) => `<span class="m2 ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" title="${esc(w)}">${ico(modIcon(w))}${v > 0 ? '+' : v < 0 ? '−' : ''}${v ? Math.abs(v) : ''}</span>`).join('');
const chip = (label: string, on: boolean, f: () => void, title = '') => `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-ui="${reg(f)}" title="${esc(title)}">${on ? ico('check') : ''}${label}</button>`;
const relayer = () => { saveLayers(); paintBoard(); };
function layersHtml() {
  const tintBtn = (v: typeof tint, label: string) => chip(label, tint === v, () => { tint = v; relayer(); });
  return `<div class="modal"><div class="sheet slim"><h3>Map layers <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
    <h4>Printed on the map</h4><div class="chips">${chip('Numbers', layers.numbers, () => { layers.numbers = !layers.numbers; relayer(); }, 'Area numbers and entry letters')}${chip('TDN', layers.tdn, () => { layers.tdn = !layers.tdn; relayer(); }, 'Terrain defence number: marker shape and colour')}${chip('Victory points', layers.vp, () => { layers.vp = !layers.vp; relayer(); })}${chip('Names', layers.names, () => { layers.names = !layers.names; relayer(); })}</div>
    <h4>Colour the areas</h4><div class="chips">${tintBtn('off', 'Off')}${tintBtn('tdn', 'TDN')}${tintBtn('zones', 'Army zones')}${tintBtn('control', 'Control')}</div>
    <p class="hint">Roads, rivers and borders stay visible under the colours.</p></div></div>`;
}
function modalHtml() {
  if (modal === 'layers') return layersHtml();
  if (modal === 'rules') return rulesHtml();
  if (modal === 'boxes') return piecesHtml();
  if (modal === 'menu') {
    const seat = (sd: E.Side) => online.seats[sd] ? (online.seats[sd] === online.uid ? 'you' : esc((sd === 'german' ? online.seats.germanName : online.seats.alliedName) || 'taken')) : 'free';
    const tabs = ['Players', 'Log', 'Settings', ...(online.admin ? ['Admin'] : [])];
    if (!tabs.includes(menuTab)) menuTab = 'Players';
    const body = menuTab === 'Log' ? `<div class="log">${[...g.log].reverse().slice(0, 120).map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
      : menuTab === 'Settings' ? `<h4>Map</h4><div class="row">${btn(`${ico('layers')} Map layers`, () => { modal = 'layers'; })}${btn(`${ico('home')} Reset view`, () => { document.querySelector<HTMLElement>('[data-home]')?.click(); })}</div><h4>Map art</h4><div class="row"><select data-sel="${regv((x) => setArt(x as 'vector' | 'scan'))}"><option value="vector" ${art === 'vector' ? 'selected' : ''}>Vector layers (traced)</option><option value="scan" ${art === 'scan' ? 'selected' : ''}>Original scan</option></select></div>
        ${online.active && !online.admin && !online.both() ? '<p class="hint">Restarting a shared game is limited to its admin.</p>' : `<h4>Restart this game</h4><div class="row"><select data-sel="${regv((x) => { newOpts.scenario = x as 'tournament' | 'campaign'; })}"><option value="tournament" ${newOpts.scenario === 'tournament' ? 'selected' : ''}>Tournament (5 turns)</option><option value="campaign" ${newOpts.scenario === 'campaign' ? 'selected' : ''}>Campaign (9 turns)</option></select>
        <label><input type="checkbox" ${newOpts.fuel ? 'checked' : ''} data-sel="${regv((x) => { newOpts.fuel = x === 'on'; })}"> German fuel rule</label><label><input type="checkbox" ${newOpts.airborne ? 'checked' : ''} data-sel="${regv((x) => { newOpts.airborne = x === 'on'; })}"> 18.5 airborne ignore supply −1</label><label><input type="checkbox" ${newOpts.advArty ? 'checked' : ''} data-sel="${regv((x) => { newOpts.advArty = x === 'on'; })}"> 18.6 advanced artillery</label>${btn('Restart', () => { if (!confirm('Restart and lose the current game?')) return; g = E.newGame(undefined, newOpts); selArea = selUnit = selChit = null; modal = null; inBattle = false; hist.clear(); note = ''; selArr = null; }, 'danger')}</div>`}`
      : menuTab === 'Admin' ? `<div class="row">${btn('Update rules', () => { modal = 'rules'; })}${btn('Free German seat', () => { void auth.freeSeat('german'); })}${btn('Free Allied seat', () => { void auth.freeSeat('allied'); })}</div>`
      : online.mode === 'remote' ? (() => {
        const a = online.account, signed = !!a && !a.guest, me = online.mySide(), title = matches.find((m) => m.id === TABLE)?.title ?? TABLE, m = matches.find((x) => x.id === TABLE), own = !!m && (m.owner === online.uid || online.admin);
        const row = (sd: E.Side) => { const who = online.seats[sd] ? (online.seats[sd] === online.uid ? 'you' : esc((sd === 'german' ? online.seats.germanName : online.seats.alliedName) || 'taken')) : 'free';
          return `<div class="seatrow"><b class="${sd}">${nm(sd)}</b><span>${who}</span>${online.seats[sd] === online.uid ? btn('Leave seat', () => { void sit(null); }) : !online.seats[sd] && signed && !me ? btn('Take seat', () => { void sit(sd); }, 'primary') : ''}</div>`; };
        return `<h4>Players</h4>${row('german')}${row('allied')}${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
          <div class="row">${btn(`${ico('share')} Invite a player`, () => { void share(TABLE, title); })}</div>
          <p class="hint">${signed ? `Signed in as <b>${esc(a!.name || a!.email)}</b>` : 'You are watching as a guest.'}</p>
          ${own && TABLE !== 'main' ? `<div class="row">${btn(`${ico('close')} Delete this game`, () => { void dropMatch(m ?? { id: TABLE, title: TABLE, owner: '' }); }, 'danger')}</div>` : ''}`; })()
      : '<p class="hint">Developer table. The Seat button in the top bar switches between German, Allied, both and watching; turn rules are enforced for the seat you hold.</p>';
    return `<div class="modal"><div class="sheet"><h3>Game <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
      <div class="tabs">${tabs.map((t) => `<button class="${t === menuTab ? 'on' : ''}" data-do="${reg(() => { menuTab = t; })}">${t}</button>`).join('')}</div>${body}
      <div class="row sheetfoot">${btn(`${ico('back')} Leave game`, () => { location.href = homeUrl(); })}</div></div></div>`;
  }
  return '';
}
const inGame = () => HAS_TABLE || DEV_FAKE || online.mode === 'local';
/** Draw the interface; if something in it throws, say so on screen instead of leaving a stale picture. */
function render() { syncView(); try { renderInner(); } catch (e) { console.error(e); $('#ui').innerHTML = `<div class="seatbar err"><span>Display problem: ${esc(String((e as Error)?.message ?? e))}</span>${ubtn('Reload', () => location.reload(), 'primary')}</div>`; bind($('#ui')); } }
function renderInner() {
  if (document.activeElement?.closest?.('.authform')) return;                                         // do not wipe what is being typed
  acts = {}; actv = {}; n = 0;
  canvas.style.display = inGame() ? '' : 'none';
  if (!inGame()) { $('#ui').innerHTML = homeHtml(); bind($('#ui')); return; }
  if (rollView && !g.battle) endRoll();                                                                   // dice left on screen after the battle is over
  const p = primary(), b = g.battle;
  const alert = g.pendingBlow ? (() => { const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!, path = g.pendingBlow!.path; return `<div class="c-ledger"><h3>${nm(other(u.side))}: bridge?</h3><p class="hint">${esc(u.name)} tries to cross into ${esc(areaName(path[path.length - 1]))}. Attempt to blow the bridge? It works on a roll of 1–5.</p><div class="row end">${btn('Let them cross', () => E.resolveBlow(g, false))}${btn('Attempt to blow it', () => E.resolveBlow(g, true), 'primary')}</div></div>`; })() : '';
  const dockMain = alert || ledger() || handCards();
  const keepH = document.querySelector<HTMLElement>('#ui .c-hand')?.scrollLeft ?? 0, keepA = document.querySelector<HTMLElement>('#ui .arrtray')?.scrollLeft ?? 0;
  $('#ui').innerHTML = topBar() + `<div class="stage">${seatBar()}${b ? battleTable() : dispatch()}${legend()}${toast ? `<div class="toast" role="status">${esc(toast)}</div>` : ''}</div><div class="dock">${dockMain}<div class="c-bar b"><div class="c-prompt" aria-live="polite">${prompt()}</div>${p ? `<button class="go" data-do="${reg(p.fn)}" ${p.dis || !allowed() ? 'disabled' : ''} ${allowed() ? '' : `title="${esc(notYou())}"`}>${p.label}${ico(p.label.startsWith('Ready') ? 'check' : p.label.startsWith('Roll') ? 'dice' : 'next')}</button>` : ''}</div></div>` + modalHtml();
  const ui = $('#ui');
  bind(ui, keepH, keepA);
}
function bind(ui: HTMLElement, keepH = 0, keepA = 0) {
  { const h = ui.querySelector<HTMLElement>('.c-hand'), a = ui.querySelector<HTMLElement>('.arrtray'); if (h) h.scrollLeft = keepH; if (a) a.scrollLeft = keepA; }
  ui.querySelectorAll<HTMLElement>('[data-ui]').forEach((e) => (e.onclick = () => { acts[e.dataset.ui!]?.(); render(); }));            // view-only choices: allowed for everyone, never touch the game
  ui.querySelectorAll<HTMLElement>('[data-do]').forEach((e) => (e.onclick = () => { if (inGame()) act(acts[e.dataset.do!]); else { acts[e.dataset.do!]?.(); render(); } }));        // on the home page nothing is a game move
  ui.querySelectorAll<HTMLElement>('[data-modal]').forEach((e) => (e.onclick = () => { modal = (e.dataset.modal || null) as typeof modal; render(); }));
  ui.querySelectorAll<HTMLElement>('[data-sel]').forEach((e) => (e.onchange = () => { const f = actv[e.dataset.sel!]; if (f) { f(e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : (e as HTMLSelectElement).value); save(); } }));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onpointerdown = (ev) => dragArrival(ev, e)));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onclick = () => { selArr = selArr === e.dataset.arr ? null : e.dataset.arr!; refresh(); frameArrival(); }));
  ui.querySelectorAll<HTMLElement>('[data-auth]').forEach((e) => (e.onclick = () => {
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '', k = e.dataset.auth;
    if (k === 'google') void auth.google(); else if (k === 'out') void auth.signOut();
    else if (k === 'in') void auth.signIn(v('a-mail'), v('a-pass')); else if (k === 'reg') void auth.register(v('a-mail'), v('a-pass'), v('a-name')); else if (k === 'reset') void auth.reset(v('a-mail'));
  }));
  ui.querySelectorAll<HTMLElement>('[data-seat]').forEach((e) => (e.onclick = () => { const order: DevSeat[] = ['both', 'german', 'allied', 'watch']; setDevSeat(order[(order.indexOf(online.devSeat) + 1) % order.length]); selUnit = selChit = selArr = null; previewArea = null; refresh(); }));
  ui.querySelectorAll<HTMLElement>('[data-home]').forEach((e) => (e.onclick = () => { goal = { t: new THREE.Vector3(17, 0, -3), dist: innerWidth < 700 ? 52 : 36, pitch: 1.0 }; yaw = viewRot(); }));
  ui.querySelectorAll<HTMLElement>('[data-tint]').forEach((e) => (e.onclick = () => { modal = 'layers'; render(); }));
  ui.querySelectorAll<HTMLElement>('[data-undo]').forEach((e) => (e.onclick = () => undo()));
  ui.querySelectorAll<HTMLElement>('[data-u]').forEach((e) => (e.onclick = () => { selUnit = e.dataset.u!; selArea = g.units.find((x) => x.id === selUnit)!.area ?? selArea; previewArea = null; refresh(); }));
  ui.querySelectorAll<HTMLElement>('.card2, .blk').forEach((e) => (e.onkeydown = (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); const id = e.dataset.chit, b2 = g.battle; if (e.classList.contains('card2') && id) { if (b2?.stage === 'setup') { const c = E.chit(g, id), why = E.canAssign(g, b2, c.side, c); if (why) say(why); else act(() => E.assign(g, b2, id, c.kind === 'air_mission' ? 'arty' : undefined)); } else if (!b2) { selChit = selChit === id ? null : id; refresh(); } } else e.click(); }));
  ui.querySelectorAll<HTMLElement>('.card2').forEach((e) => (e.onpointerdown = (ev) => { lastPointer = ev.pointerType; if (ev.pointerType === 'touch') return; if (ev.pointerType === 'mouse') ev.preventDefault(); if (g.battle || chitTargets(E.chit(g, e.dataset.chit!)).length) drag(ev, e); }));
  ui.querySelectorAll<HTMLElement>('.card2').forEach((e) => (e.onclick = () => { if (lastPointer === 'touch') return tapCard(e.dataset.chit!); if (!g.battle) { selChit = selChit === e.dataset.chit ? null : e.dataset.chit!; refresh(); } }));
  ui.querySelectorAll<HTMLElement>('.blk[data-unit]').forEach((e) => (e.onclick = () => { const b2 = g.battle; if (!b2 || b2.stage !== 'setup') return; const s = e.dataset.side as E.Side, u = g.units.find((x) => x.id === e.dataset.unit)!; if (!mine(s)) return; if (u.garrison || (s === b2.attacker && u.disorder)) return; act(() => E.setPoint(g, b2, s, u.id)); }));
}
let lastView: E.Side | null = null;
/** Standard view: German from the bottom of the map, Allied from the top; the printed items turn with it. */
function syncView() {
  const v = viewSide(); if (v === lastView) return; const first = lastView === null; lastView = v; yaw = v === 'allied' ? Math.PI : 0; if (!first) goal = { t: new THREE.Vector3(17, 0, -3), dist, pitch }; paintBoard();
}
/** Split tables: publish the blocks the other side may now see, and (attacker's seat) start combat once both sides are ready and their blocks are known. */
function driveSplit() {
  const me = online.mySide(); if (!online.split || !me) return;
  void publishReveals(g);
  const b = g.battle;
  if (b && b.stage === 'setup' && b.ready?.length === 2 && g.deferBegin && me === b.attacker && E.unitsIn(g, b.area).every((u) => u.name !== 'Hidden block')) act(() => E.beginCombat(g, b));
}
let ctlKey = '', tgtKey = '';
function refresh() {
  if (online.split) setTimeout(driveSplit, 0);
  { const key = `${selChit}|${selArea}|${tgtMode}|${g.turn}${g.phase}|${g.log.length}|${g.rolls}`;                    // the dry runs behind the highlights are costly: redo them only when something they depend on changed
    if (key !== tgtKey) { tgtKey = key; tgt = selChit ? targetsFor(() => g, g.chits.find((x) => x.id === selChit) ?? null, { area: selArea, mode: tgtMode, setArea: (a) => { selArea = a; }, setMode: (m) => { tgtMode = m; }, face: unitFace, areaName }) : null; } }
  if (tint === 'control') { const k = JSON.stringify(g.control) + E.contestedAreas(g).join(); if (k !== ctlKey) { ctlKey = k; paintBoard(); } }
  syncView(); syncBattleCam(); drawPieces(); paintAreas(); drawRoute(); badges = badgeList(); syncBadges(); render();
  if (!rollView) { const cv = $('#dice'); if (cv && cv.style.display !== 'none') { clearDice(); cv.style.display = 'none'; } }
}
function frame() {
  requestAnimationFrame(frame);
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  if (goal) { target.lerp(goal.t, 0.1); dist += (goal.dist - dist) * 0.1; pitch += (goal.pitch - pitch) * 0.1; if (target.distanceTo(goal.t) < 0.05 && Math.abs(dist - goal.dist) < 0.1) goal = null; }
  placeCam(); renderer.render(scene, cam); placeBadges();
}
frame();
loadChitArt().catch((e) => console.error(e)).finally(() => { auto(); refresh(); });
let lobbyUid = '';
const onNet = (): void => {
  if (online.mode !== 'remote' || !online.hasAccounts) return;
  if (lobbyUid !== online.uid) { lobbyUid = online.uid; lobby.watch((m) => { matches = m; render(); }); }
  const next = (() => { try { return sessionStorage.getItem('fab-next'); } catch { return null; } })();
  if (next && !HAS_TABLE && online.account && !online.account.guest) { try { sessionStorage.removeItem('fab-next'); } catch { /* private mode */ } location.href = `${homeUrl()}?table=${next}`; }     // back to the invite that sent you to sign in
};
void startOnline((rg) => { const was = g.battle, n0 = was?.rolls.length ?? 0, st0 = was?.stage, pre = was ? snap(g) : null; applyingRemote = true; g = rg;
  const nb = g.battle; const rolled = !!(was && nb && nb.area === was.area && nb.rolls.length > n0); if (pre) noteFx(pre, g, rolled); if (was && nb && nb.area === was.area && nb.rolls.length > n0 && st0 && STAGE_NAME[st0]) {      // the other player rolled: show their dice here too
    const side = st0 === 'attArty' || st0 === 'offFire' ? nb.attacker : other(nb.attacker);
    rollView = { title: `${nm(side)} ${STAGE_NAME[st0]}`, pos: null, groups: nb.rolls.slice(n0).map((r) => ({ label: r.who, col: r.kind === 'arty' ? 's' : side === 'german' ? 'k' : 'w', sn: r.sn, dice: r.dice, hits: r.hits, parts: [] })) };
    if (rollView.groups.length) { const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block'; throwDice(cv, rollView.groups, (p) => { if (rollView) { const rv = rollView; rv.pos = p; render(); showFx(pendingFx); pendingFx = []; setTimeout(() => { if (rollView === rv) endRoll(); }, 4000); } }); } else rollView = null;       // the other player's dice clear themselves
  } selUnit = selChit = selArr = null; previewArea = hoverArea = null; hist.clear(); try { save(); } finally { applyingRemote = false; } refresh(); }, () => { onNet(); syncView(); render(); }, () => g, say, () => { try { sessionStorage.setItem('fab-notice', 'That game was deleted by its creator.'); } catch { /* private mode */ } location.href = homeUrl(); });       // the table is gone: nobody stays inside it
/** Every drawn symbol and counter as SVG, for the editable sheets (docs/maps/vector/fab-*.svg). */
function sheets() {
  const seenSvg = new Set<string>(), out: Record<string, { id: string; label: string; svg: string }[]> = { chits: [], blocks: [], markers: [] };
  const add = (k: string, id: string, label: string, svg: string | null) => { if (svg && !seenSvg.has(svg)) { seenSvg.add(svg); out[k].push({ id, label, svg }); } };
  const cg = E.newGame(5, { scenario: 'campaign', fuel: true });
  for (const c of cg.chits) add('chits', c.id, `${c.side} ${c.name}${c.turn != null ? ' t' + c.turn : ''}`, chitSvg(c));
  for (const u of cg.units) add('blocks', u.id, `${u.name}${u.code ? ' ' + u.code : ''}`, u.garrison ? garrisonArt(u) : labelSvg(u));
  for (const m of ['X', 'FW', 'RA', 'RB', 'DIS', 'REC', 'E', 'B', 'P', 'R5', 'R6', 'R7', 'A7', 'A56', 'GI', 'G', 'AIR', 'AS']) add('markers', m, m, mapMarkerSvg(m));
  return out;
}
Object.assign(window, { __fab: { online, setMatches: (m: Match[]) => { matches = m; }, iconList: () => Object.keys(ICONS).map((k) => ({ k, html: ico(k) })), fxDemo: () => FX_SAMPLES.map((f) => `<div class="fx ${f.cls}" style="position:static;animation:none;margin:8px;width:max-content">${ico(f.icon)}<b>${esc(f.head)}</b><small>${esc(f.text)}</small></div>`).join(''), sheets, setModal: (m: typeof modal) => { modal = m; render(); }, info: () => renderer.info.memory, layout: () => ({ MW, MH, S, pieces: pieces.children.map((o) => ({ unit: o.userData.unit as string, x: o.position.x, z: o.position.z })) }), E, get g() { return g; }, set g(v: E.Game) { g = v; }, refresh, act, sel: (u: string, a?: number) => { selUnit = u; selArea = g.units.find((x) => x.id === u)!.area; previewArea = a ?? null; refresh(); } } });
