import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as E from '../../engine/src';
import { loadChitArt, garrisonChit } from './chits';
import { loadGolanChitArt } from './golan-art';
import { useVolume, type LabelBox } from './vol';
import type { PanelCtx } from './golan-ui';
import { History } from './history';
import * as SB from './sandbox';
import { vpStrip, vpSheet, endPanel } from './score';
import * as SBU from './sandbox-ui';
import { online, startOnline, push, sit, sendChat, setChatListener, type ChatMsg, setDevSeat, auth, lobby, publishReveals, DEV, TABLE, HAS_TABLE, DEV_FAKE, SANDBOX, TUTORIAL, seatOf, seatName, type DevSeat, type Match } from './online';
import { gameInfo, GAMES } from './games';
import { coverArt, BOXES, boxFront, boxSpine } from './covers';
import { ICONS, ico } from './icons';
import { esc, nm } from './util';
import { drawLabel, drawEntry, drawRestricted } from './board-art';
import { targetsFor, type Tgt } from './chit-play';
import { snap, diffFx, FxLayer, fxRow, FX_SAMPLES, type Fx } from './fx';
import { RULE, ruleHtml } from './rules-text';
import databaseRules from '../../database.rules.json?raw';
import { initTouch } from './touch';
import { throwDice, clearDice, type DiceGroup } from './dice3d';
import { initTutorial } from './tutorial';
import { courseFor, coursesOf } from './tutorial-script';
import { loadRelief, type Relief } from './relief';

/* ---------- which game this page shows ---------- */
const PARAMS = new URLSearchParams(location.search), GAME_PARAM = PARAMS.get('game');
const TUT = TUTORIAL ? courseFor(PARAMS.get('tutorial')) : null;                                         // the tutorial course this page runs (docs/TUTORIAL.md)
const KEY0 = TUT ? `fab-tutorial-${TUT.id}` : SANDBOX ? 'fab-sandbox' : TABLE === 'main' ? 'fab-demo2' : `fab-demo2-${TABLE}`, KEY = GAME_PARAM && GAME_PARAM !== 'bulge' ? `${KEY0}-${GAME_PARAM}` : KEY0;
function load(): E.Game | null { try { const s = localStorage.getItem(KEY); if (!s) return null; const x = JSON.parse(s); return x.chits && x.markers && x.greif && x.roadblocks && x.pendingArrivals && x.fwOwner && Array.isArray(x.recover) ? x : null; } catch { return null; } }
/** The volume (docs/design/one-engine.md): the address says which game, else the game saved for this table, else The Bulge. A shared table of another game reloads the page with its game. */
const VOL = useVolume(TUT ? TUT.game : GAME_PARAM ?? load()?.game ?? 'bulge');
const [P1, P2] = VOL.sides, first = (sd: string) => sd === P1, near = (sd: string) => sd === VOL.bottom;     // near: the side whose map edge is at the bottom, whose rows sit toward +z
const MAP = VOL.map, LAB: Record<string, LabelBox> = VOL.labels;
// World unit = 1 cm. Every FAB map is the full 34 x 22 in sheet (86.36 x 55.88 cm); the drawing's width gives the pixels per cm.
const [MW, MH] = MAP.size, S = MW / 86.36;                                    // map pixels per cm
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
const POLE = new Map<number, [number, number]>(MAP.areas.map((a) => [a.id, LAB[a.id] ? [LAB[a.id].px, LAB[a.id].py] : pole(a.polygon)]));      // where an area's pieces stand: its clear spot beside the label
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
let tut: ReturnType<typeof initTutorial> | null = null;
let g: E.Game = (() => { const s = HAS_TABLE && !SANDBOX && !TUTORIAL ? null : load(); return s && (s.game ?? 'bulge') === VOL.id ? s : E.newGame(undefined, VOL.defaultOpts); })();   // a shared table starts from what the database sends, never from an old local copy
let selArea: number | null = null, selUnit: string | null = null, selChit: string | null = null, previewArea: number | null = null, hoverArea: number | null = null, newOpts: E.Opts = { scenario: VOL.defaultOpts.scenario ?? 'tournament', fuel: !!VOL.defaultOpts.fuel };
/** A prompt of the volume asked for an area (an air assault landing): the legal ones light up, a tap runs it. */
let areaPick: { label: string; areas: Set<number>; run: (a: number) => void } | null = null;
let applyingRemote = false;
const save = () => { if (heldNext) return;                                                       // a roll is on screen: its result is already saved; the board shown is older and must not be written back
   try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage off: the game still runs */ } if (!applyingRemote) void push(g); };

/* ---------- three.js scene ---------- */
const canvas = $('#gl') as HTMLCanvasElement;
canvas.tabIndex = 0; canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-label', 'Map. Arrow keys move between areas, Enter selects or moves there, N picks the next block that can move, Escape clears.');
canvas.addEventListener('blur', () => { kbArea = null; paintAreas(); });
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101314);
const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-20, 50, 32); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 200 }); scene.add(sun);

const board: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(new THREE.PlaneGeometry(MW / S, MH / S), new THREE.MeshStandardMaterial({ map: null, roughness: 0.9 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
/* The board texture is composed in layers: ground and forest, then the area tint (so roads and rivers stay visible), then the line work, then the printed items (numbers, TDN, VP, names), turned to face the player. */
const boardCv = document.createElement('canvas'); boardCv.width = MW * 2; boardCv.height = MH * 2;
const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8;
const loadImg = (src: string) => { const i = new Image(); i.onload = () => paintBoard(); i.src = src; return i; };
const vpIcons: Record<string, HTMLImageElement> = Object.fromEntries(Object.entries(VOL.art.vpIcons).map(([k, src]) => [k, loadImg(src)]));
const baseImg = loadImg(VOL.art.base), linesImg = loadImg(VOL.art.lines);
/** The map drawings are turned into pixels once and reused: redrawing the detailed SVG on every colour change is what made phones stall. */
const flat = new Map<HTMLImageElement, HTMLCanvasElement>();
function pixels(im: HTMLImageElement): CanvasImageSource {
  const have = flat.get(im); if (have) return have;
  const c = document.createElement('canvas'); c.width = boardCv.width; c.height = boardCv.height; const x = c.getContext('2d')!; x.drawImage(im, 0, 0, c.width, c.height);
  if (x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3] || im === linesImg) { if (im !== linesImg || flat.has(baseImg)) flat.set(im, c); return c; }     // a large SVG can come out blank the first time: keep the copy only once it shows
  setTimeout(paintBoard, 120); return im;
}
function applyArt() { const mat = board.material as THREE.MeshStandardMaterial; mat.map = boardTex; mat.needsUpdate = true; paintBoard(); }
/* ---------- 3D map (View › Map): the snowy relief with contour lines, 3D woods and towns; the 2D board stays the default ---------- */
let map3d = (() => { try { return localStorage.getItem('fab-map3d') === '1'; } catch { return false; } })();
let REL: Relief | null = null, relLoading = false, focusOn = false;
const reliefMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95 });
/** The 3D map is a diorama: the relief, cut straight all round the playing area, on a dark wooden base that carries the entry strips. */
const diorama = new THREE.Group(); diorama.visible = false; scene.add(diorama);
const WOOD_BASE = 0x2e2117;
{ const slab = new THREE.Mesh(new THREE.BoxGeometry(MW / S + 1.2, 1.4, MH / S + 1.2), new THREE.MeshStandardMaterial({ color: WOOD_BASE, roughness: 0.8 })); slab.position.y = -0.7 - 0.002; slab.receiveShadow = true; diorama.add(slab); }
const relArt = new Map<HTMLImageElement, HTMLCanvasElement>();
/** On the relief the area highlights are painted by the ground itself: a picture of the area numbers, and one colour per area. */
const areaIdTex = (() => { const d = new Uint8Array(MW * MH * 4);                                   // filled by hand, row by row: a canvas would blend the numbers along the borders; a scenario sheet's boxes float on their own cards and take no pixels
  for (const a of MAP.areas.filter((x) => !(VOL.art.sheetBoxes ?? []).some((b) => b.id === x.id))) { const P = a.polygon, ys = P.map((q) => q[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(MH - 1, Math.ceil(Math.max(...ys))); y++) { const yc = y + 0.5, xs: number[] = [];
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi)); }
      xs.sort((u, v) => u - v); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(MW, Math.round(xs[k + 1])); x++) d[((MH - 1 - y) * MW + x) * 4] = a.id; } }
  const t = new THREE.DataTexture(d, MW, MH); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const tintData = new Uint8Array(128 * 4), tintTex = new THREE.DataTexture(tintData, 128, 1); tintTex.needsUpdate = true;
const relPixels = (im: HTMLImageElement) => { let c = relArt.get(im); if (!c) { c = document.createElement('canvas'); c.width = boardCv.width; c.height = boardCv.height; c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); relArt.set(im, c); } return c; };
const show3d = () => map3d && !!REL;
/** Phones and small tablets: the 3D map is drawn lighter (fewer pixels, no shadows, a coarser ground, fewer trees). */
const PHONE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
const fullRatio = Math.min(2, devicePixelRatio);
function tuneForMap() { const lite = PHONE && show3d(); renderer.setPixelRatio(lite ? Math.min(1.3, devicePixelRatio) : fullRatio); sun.castShadow = !lite; }
function applyMap3d() {
  const on = show3d(); tuneForMap(); diorama.visible = on; table.position.y = on ? -1.42 : -0.02; if (REL) REL.props.visible = on;
  paintBoard(); paintAreas();
}
function setMap3d(on: boolean) {
  if (on && !VOL.art.relief) { map3d = false; say('This map has no 3D relief yet.'); return; }
  map3d = on; try { localStorage.setItem('fab-map3d', on ? '1' : '0'); } catch { /* storage off */ }
  if (on && !REL) { if (!relLoading) { relLoading = true; say('Loading the 3D map…', true); loadRelief(MW, MH, S, MAP.areas.filter((x) => LAB[x.id]).map((x) => [LAB[x.id].x, LAB[x.id].y, LAB[x.id].w, LAB[x.id].h] as [number, number, number, number]), PHONE, VOL.art.relief!).then((r) => { REL = r; REL.patch(reliefMat, areaIdTex, tintTex); diorama.add(REL.props);
        const ground = new THREE.Mesh(REL.geometry, reliefMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; diorama.add(ground);
        diorama.add(new THREE.Mesh(REL.walls, new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9, side: THREE.DoubleSide }))); applyMap3d(); refresh(); }).catch(() => { relLoading = false; map3d = false; say('The 3D map could not be loaded. Check your connection and try again.'); }); } return; }
  applyMap3d(); refresh();
}
/** Everything standing on the map sits on the relief: pieces and markers are raised to the ground under them, flat route drawings follow it vertex by vertex. In the battle close-up the area is shown flat. */
function settle() {
  const on = show3d() && !focusOn, key = on ? 1 : 0;
  for (const grp of [pieces, markers, route, fades]) for (const o of grp.children) {
    const mesh = o as THREE.Mesh;
    if (o.position.x === 0 && o.position.z === 0 && mesh.geometry) {                           // drawn in world coordinates (route arrows, supply line)
      const gm = mesh.geometry, pa = gm.getAttribute('position') as THREE.BufferAttribute; if (gm.userData.lk === key) continue;
      const off: Float32Array = gm.userData.off ?? new Float32Array(pa.count);
      for (let k = 0; k < pa.count; k++) { const nv = on ? REL!.h(pa.getX(k), pa.getZ(k)) : 0; pa.setY(k, pa.getY(k) - off[k] + nv); off[k] = nv; }
      gm.userData.off = off; gm.userData.lk = key; pa.needsUpdate = true; continue;
    }
    let L = 0;
    if (on) { const rr = 0.8; L = REL!.h(o.position.x, o.position.z); for (const [dx, dz] of [[-rr, -rr], [rr, -rr], [-rr, rr], [rr, rr], [0, -rr], [0, rr], [-rr, 0], [rr, 0]]) L = Math.max(L, REL!.h(o.position.x + dx, o.position.z + dz)); L += 0.02; }      // the highest ground under the whole counter or block, so the relief never swallows it
    const prev = (o.userData.lift as number | undefined) ?? 0;
    if (L !== prev) { o.position.y += L - prev; o.userData.lift = L; }
  }
}
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
/** Piece pictures are decoded a few per frame, so the first load does not freeze the phone; a texture shows as soon as its picture is ready. */
const texQueue: [THREE.Texture, string][] = [];
function pumpTextures() { for (let n = 0; n < 6 && texQueue.length; n++) { const [t, src] = texQueue.shift()!; const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; lastInput = performance.now(); }; im.src = src; } }
const svgTex = (key: string, svg: string) => { if (!labelTex.has(key)) { const t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texQueue.push([t, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)]); labelTex.set(key, t); } return labelTex.get(key)!; };

function block(u: E.Unit, hidden = false) {
  const w = 1.6, h = 1.6, d = 0.8;                                    // 16 x 16 x 8 mm block
  const wood = new THREE.MeshStandardMaterial({ color: VOL.cssSide(u) === 'british' ? 0x3f6fb8 : VOL.wood[u.side], roughness: 0.75 });
  if (u.garrison) {
    const chit = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }), m = new THREE.Mesh(new RoundedBoxGeometry(1.43, 0.12, 1.43, 2, 0.1), [chit, chit, new THREE.MeshStandardMaterial({ map: svgTex(u.id, VOL.unitSvg(u, g)), roughness: 0.7 }), chit, chit, chit]);      // a counter, like the other chits // 9/16 in chit
    m.position.y = 0.06; m.castShadow = true; m.rotation.y = viewRot(); return m;
  }
  const face = hidden ? wood : new THREE.MeshStandardMaterial({ map: svgTex(`${u.id}-${u.str}`, VOL.unitSvg(u, g)), roughness: 0.6 });   // upright blocks show their blank back to the enemy
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
  const art = VOL.markSvg(text);
  if (art) {                                                         // printed marker art, drawn as a vector chit
    const key = 'art:' + text; let at = tagTex.get(key);
    if (!at) { at = new THREE.CanvasTexture(document.createElement('canvas')); const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d')!.drawImage(im, 0, 0, 256, 256); at!.image = c; at!.colorSpace = THREE.SRGBColorSpace; at!.anisotropy = 8; at!.needsUpdate = true; }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art); tagTex.set(key, at); }
    const edge = new THREE.MeshStandardMaterial({ color: 0x2a2a28 }), m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [edge, edge, new THREE.MeshStandardMaterial({ map: at }), edge, edge, edge]);
    m.castShadow = true; m.rotation.y = viewRot(); return m;
  }
  let t = tagTex.get(text + bg);
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
    x.fillStyle = '#fff'; x.font = `bold ${text.length > 2 ? 46 : 60}px Arial Narrow, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagTex.set(text + bg, t); }
  const side = new THREE.MeshStandardMaterial({ color: bg }), m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [side, side, new THREE.MeshStandardMaterial({ map: t }), side, side, side]);
  m.castShadow = true; m.rotation.y = viewRot(); return m;
}
/** Every counter is a 9/16 inch square (1.43 cm) with slightly rounded corners. */
const CHIT = 1.43;
/** A cardboard counter lying on the board: the chit's own printed art on a thin rounded square. */
function chit3d(c: E.Chit) {
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }), m = new THREE.Mesh(new RoundedBoxGeometry(CHIT, 0.12, CHIT, 2, 0.1), [edge, edge, new THREE.MeshStandardMaterial({ map: svgTex('chit:' + c.id, VOL.chitSvg(c)), roughness: 0.7 }), edge, edge, edge]);
  m.castShadow = true; m.position.y = 0.06; m.rotation.y = viewRot(); return m;
}
/** The outline of an area pushed outwards by `d` (cm), as a flat ribbon of width `w` lying on the board. */
function outlineRibbon(id: number, d: number, w: number, color: number) {
  const raw = areaWorld(id).map((q) => new THREE.Vector2(q.x, q.z)), pts: THREE.Vector2[] = [];
  raw.forEach((q, i) => { const nx = raw[(i + 1) % raw.length], k = Math.max(1, Math.ceil(q.distanceTo(nx) / 0.35)); for (let j = 0; j < k; j++) pts.push(q.clone().lerp(nx, j / k)); });      // short pieces, so on the 3D relief every piece sits on the ground
  const n = pts.length;
  const area2 = pts.reduce((a, q, i) => a + (q.x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * q.y), 0), sgn = area2 > 0 ? 1 : -1;
  const norm = (i: number) => { const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n], e1 = b.clone().sub(a).normalize(), e2 = c.clone().sub(b).normalize(); const n1 = new THREE.Vector2(e1.y, -e1.x).multiplyScalar(sgn), n2 = new THREE.Vector2(e2.y, -e2.x).multiplyScalar(sgn), m = n1.add(n2); return m.lengthSq() < 1e-6 ? n1 : m.normalize().multiplyScalar(1 / Math.max(0.5, m.dot(n2) || 1)); };
  const pos: number[] = [], idx: number[] = [];
  pts.forEach((q, i) => { const nn = norm(i), a = q.clone().addScaledVector(nn, d), b = q.clone().addScaledVector(nn, d + w); pos.push(a.x, 0.09, a.y, b.x, 0.09, b.y); });
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
}
const dotTex = new Map<string, THREE.CanvasTexture>();
/** A small round marker lying on the table: a red cross to take an asset back, a gold target for the point unit. */
function disc(kind: 'x' | 'point', size: number) {
  let t = dotTex.get(kind);
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = kind === 'x' ? '#3a3d2c' : '#e7b04a';                 /* take-back is a quiet olive disc: red stays for the one main action */ x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke();
    x.strokeStyle = kind === 'x' ? '#ddd7b5' : '#1a1608'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath();
    if (kind === 'x') { x.moveTo(40, 40); x.lineTo(88, 88); x.moveTo(88, 40); x.lineTo(40, 88); } else { x.arc(64, 64, 26, 0, 7); x.moveTo(64, 22); x.lineTo(64, 40); x.moveTo(64, 88); x.lineTo(64, 106); x.moveTo(22, 64); x.lineTo(40, 64); x.moveTo(88, 64); x.lineTo(106, 64); }
    x.stroke(); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; dotTex.set(kind, t); }
  const m = new THREE.Mesh(new THREE.CircleGeometry(size, 28), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m;
}
/** The same marker as a sprite: it always faces the camera, so the player can read it from any angle. */
function discSprite(kind: 'x' | 'point', size: number) { disc(kind, size); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex.get(kind)!, transparent: true, depthTest: false })); sp.scale.set(size * 2, size * 2, 1); sp.renderOrder = 6; return sp; }
/** Battle formation (docs/design): the battle area is shown as an ordered table, not squeezed into the polygon. Each side faces the other across the
 *  middle line: its blocks in the front row, its assets in the row behind; rows wrap at 5 and stay centred. The rest of the map is blurred, so the
 *  formation may reach past the area border. */
/** How far the battle formation reaches from the area's pole (cm), on the deeper side. */
function formationReach(b: E.Battle) {
  return Math.max(...VOL.sides.map((sd) => { const u = Math.max(1, Math.ceil(E.unitsIn(g, b.area, sd).length / 5)), n = b.assets[sd].length + E.airOf(b, sd).length, a = Math.ceil(n / 5); return 1.35 + u * 1.9 + (a ? 0.5 + a * 1.7 : 0); }), 5 * 1.95 / 2 + 1);
}
/** Panels over the battle (header at the top, report and hand at the bottom): the view is shifted so the battle sits in the clear band between them. */
let viewShift = 0, clearRatio = 1;
function fitBattleView() {
  const r = canvas.getBoundingClientRect(); let shift = 0, clear = r.height;
  if (g.battle) {
    const top = document.querySelector('#ui .c-table')?.getBoundingClientRect(), low = Array.from(document.querySelectorAll('#ui .dock > .c-ledger, #ui .dock .c-hand, #ui .dock .handtab, #ui .c-bar.b')).map((e) => e.getBoundingClientRect()).filter((q) => q.height && q.left < r.left + r.width / 2 && q.right > r.left + r.width / 2);
    const tc = top ? Math.max(0, top.bottom - r.top) : 0, bc = low.length ? Math.max(0, r.bottom - Math.min(...low.map((q) => q.top))) : 0;
    shift = Math.round((bc - tc) / 2); clear = Math.max(120, r.height - tc - bc);
  }
  if (shift !== viewShift) { viewShift = shift; if (shift) cam.setViewOffset(r.width, r.height, 0, shift, r.width, r.height); else cam.clearViewOffset(); }
  return clear / r.height;
}
function battleSpot(b: E.Battle, sd: E.Side, kind: 'unit' | 'asset', i: number, n: number) {
  const base = toWorld(...POLE.get(b.area)!), dir = near(sd) ? 1 : -1, per = 5, row = Math.floor(i / per), inRow = Math.min(per, n - row * per), col = i % per;
  const units = E.unitsIn(g, b.area, sd).length, unitRows = Math.max(1, Math.ceil(units / per));
  const depth = kind === 'unit' ? 1.35 + row * 1.9 : 1.35 + unitRows * 1.9 + 0.5 + row * 1.7;
  return { x: base.x + (col - (inRow - 1) / 2) * (kind === 'unit' ? 1.95 : 1.75), z: base.z + dir * depth };
}
/** The battle on the table: each side's assigned assets as cardboard counters in a row behind its blocks, with a red cross to take one back before the battle starts. */
function drawBattleTable(b: E.Battle) {
  const base = toWorld(...POLE.get(b.area)!);
  for (const sd of VOL.sides) {
    const live = sd === b.attacker ? ['setup', 'attArty'] : ['setup', 'attArty', 'defArty'], spent = (arty: boolean) => arty && !live.includes(b.stage);
    const airs = E.airOf(b, sd), all = [...b.assets[sd], ...airs.map((a) => a.id)], ids = all.filter((id) => { const c = E.chit(g, id); return !spent(E.isArty(c) || (c.kind === 'air_mission' && airs.find((a) => a.id === id)?.mode === 'arty')); }), dir = first(sd) ? 1 : -1;     // artillery leaves the table once it has fired
    ids.forEach((id, i) => {
      const m = chit3d(E.chit(g, id)), at = battleSpot(b, sd, 'asset', i, ids.length), x = at.x, z = at.z; m.userData.chit = id; m.position.set(x, 0.06, z); pieces.add(m);
      if (b.stage === 'setup' && mine(sd)) { const d = disc('x', 0.42); d.position.set(x + 0.5, 0.2, z - 0.5); d.userData.chit = id; pieces.add(d); }
      if (tgt?.units.has(id)) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: MAPC.ring, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.14, z); markers.add(ring); }
    });
  }
}
/** The point unit of each side carries a gold target (after the blocks are placed). */
function drawPointMarks(b: E.Battle) {
  for (const [uid, sd] of [[b.attPoint, b.attacker], [b.defPoint, other(b.attacker)]] as const) {                  // the point unit carries a gold target
    const o = pieces.children.find((x) => x.userData.unit === uid); const u = g.units.find((x) => x.id === uid); if (!o || !u || !seen(u)) continue;;
    const d = discSprite('point', 0.26), c = farSide() ? -1 : 1; d.position.set(o.position.x + 0.58 * c, o.position.y > 0.6 ? 1.95 : 0.9, o.position.z - 0.58 * c); d.userData.anchor = uid; markers.add(d);                 // a back corner of the block, clear of its pips and symbol d.userData.anchor = uid; markers.add(d);                  // on top of the block, so it is always inside the area
  }
}
function drawPieces() {
  disposeAll(pieces); disposeAll(markers);
  coveredLabels.clear();
  /** The printed number plate and name (drawn upright for the viewer) are kept clear: blocks go around them when the area has room. */
  const labelSpots = (id: number) => { const L = LAB[id]; if (!L) return []; const r = L.h / 2, out: { x: number; z: number; r: number }[] = [];
    for (let dx = -L.w / 2 + r; dx <= L.w / 2 - r + 0.1; dx += Math.max(4, r * 0.8)) { const w = toWorld(L.x + dx, L.y); out.push({ x: w.x, z: w.z, r: r / S }); }
    if (!out.length) { const w = toWorld(L.x, L.y); out.push({ x: w.x, z: w.z, r: Math.max(L.w, L.h) / 2 / S }); } return out; };
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
  if (g.battle) drawBattleTable(g.battle);                                                      // counters first, so blocks make room around them and nothing hides one
  for (const a of MAP.areas) {
    const us = E.unitsIn(g, a.id), base = toWorld(...POLE.get(a.id)!), cont = E.contestedAreas(g).includes(a.id); rows.set(a.id, { base, cont });
    const lab = us.length && g.battle?.area !== a.id ? labelSpots(a.id) : []; if (lab.length) taken.set(a.id, [...(taken.get(a.id) ?? []), ...lab]);
    const order = [...us].sort((p, q) => +(p.side !== P1) - +(q.side !== P1) || +!!p.garrison - +!!q.garrison);
    const place = (column: boolean) => {                                                           // a row of blocks, or a column when the area is too narrow for a row
      const t = taken.get(a.id) ?? [], saved = [...t]; let tight = false;
      const spots = order.map((u) => { const same = us.filter((x) => x.side === u.side), idx = column ? order.indexOf(u) - (order.length - 1) / 2 : same.indexOf(u) - (same.length - 1) / 2, row = near(u.side) ? 1.1 : -1.1;
        const p = column ? inArea(a.id, base.x, base.z + idx * 1.8, u.garrison ? 0.75 : 0.95) : inArea(a.id, base.x + idx * 1.75, base.z + (cont ? row : 0.4), u.garrison ? 0.75 : 0.95); if ((p as { tight?: boolean }).tight) tight = true; return p; });
      return { spots, tight, saved };
    };
    let lay = place(false);
    if (lay.tight && order.length > 1) { taken.set(a.id, lay.saved); const col = place(true); if (!col.tight) lay = col; else { taken.set(a.id, lay.saved); lay = place(false); } }
    if (cont && lay.tight && g.battle?.area !== a.id) {                                             // a crowded contested area: the two sides in facing rows (German row, Allied row), never mixed or stacked
      taken.set(a.id, lay.saved); const pl = toWorld(...POLE.get(a.id)!);
      lay.spots = order.map((u) => { const same = order.filter((x) => x.side === u.side), i = same.indexOf(u), per = 4, rw = Math.floor(i / per), inRow = Math.min(per, same.length - rw * per), dir = near(u.side) ? 1 : -1;
        return { x: pl.x + (i % per - (inRow - 1) / 2) * 1.75, z: pl.z + dir * (1.3 + rw * 1.75) }; });
    }
    if (g.battle?.area === a.id) { const b = g.battle; lay.spots = order.map((u) => { const same = order.filter((x) => x.side === u.side); return battleSpot(b, u.side, 'unit', same.indexOf(u), same.length); }); }
    if (lab.some((l) => lay.spots.some((p) => Math.hypot(p.x - l.x, p.z - l.z) < l.r + 0.7))) coveredLabels.add(a.id);          // no room: the area's number and name ride on a tag above
    order.forEach((u, n) => {
      const hid = !seen(u), m = block(u, hid), p = lay.spots[n]; m.userData.hidden = hid;
      const flat = cont && !hid && !u.garrison && u.up === a.id;                                                           // revealed blocks lie flat, label up, while the area is contested
      m.position.x = p.x; m.position.z = p.z;
      if (flat) { m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, viewRot(), 0); m.position.y = 0.4; }
      if (tgt?.units.has(u.id)) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 40), new THREE.MeshBasicMaterial({ color: MAPC.ring, transparent: true, opacity: 0.95, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.09, p.z); markers.add(ring); const glow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ color: MAPC.ring, transparent: true, opacity: 0.28 })); glow.rotation.x = -Math.PI / 2; glow.position.set(p.x, 0.085, p.z); markers.add(glow); }
      m.userData.unit = u.id; if (u.id === selUnit || (g.battle && !hid && (u.id === g.battle.attPoint || u.id === g.battle.defPoint))) { const o = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })); m.add(o); }
      pieces.add(m);
      const tags: [string, string][] = []; const top = flat ? 0.85 : 1.66;
      if (u.disorder && !u.garrison) tags.push([u.disorder === 1 ? 'DIS' : 'REC', u.disorder === 1 ? '#8a1f1f' : '#a8741a']);
      if (u.reserve) tags.push([VOL.reserveTag(u), '#2d6cb0']); if (u.exploit) tags.push(['E', '#d9741c']); if (u.unsupplied && !u.garrison) tags.push(['OOS', '#b8312f']); if (u.interdict) tags.push(['GI', '#8a2f9c']); if (u.bcross) tags.push(['B', '#8a6a1c']); if (g.riverAssault.includes(a.id) && u.side === g.phasing && !u.garrison) tags.push(['RA', '#2a7fb8']);
      const dc = farSide() ? -1 : 1;
      tags.forEach(([t, c], i) => {               // status markers float in a row above the block, tilted toward the player (animated in frame())
        const k = tag(t, c, CHIT * 0.6), x0 = (i - (tags.length - 1) / 2) * 0.95;
        k.rotation.order = 'YXZ'; k.rotation.set(0.95, viewRot(), 0); k.userData.float = { y: top + 1.0, ph: i * 1.1 + m.position.x * 0.3 };
        k.position.set(m.position.x + x0 * dc, top + 1.0, m.position.z); markers.add(k);
      });
    });
  }
  if (g.battle) drawPointMarks(g.battle);
  if (!g.battle && (g.phase === 'combat' || g.phase === 'btCombat')) { const must = new Set(E.mustFight(g));         // each battle area gets its own edge, so neighbouring battles never merge into one patch
    for (const id of fightable()) markers.add(outlineRibbon(id, -0.32, 0.22, must.has(id) ? MAPC.must : MAPC.fight)); }
  // area markers: inside their own area, next to the group they belong to
  for (const a of MAP.areas) {
    const { base, cont } = rows.get(a.id)!, mine: { side?: E.Side; t: string; c: string }[] = [];
    if (g.roadblocks[a.id]) mine.push({ side: g.roadblocks[a.id], t: 'RB', c: '#6b4a8a' }); if (g.interdicted[a.id]) mine.push({ t: 'AIR', c: '#2f6fb0' }); if (g.pooled === a.id) mine.push({ side: 'allied', t: 'P', c: '#3f8a5a' }); if (g.airSupply?.area === a.id) mine.push({ side: g.airSupply.side, t: 'AS', c: '#2f6fb0' });
    if (g.fieldWorks.includes(a.id)) mine.push({ side: g.fwOwner[a.id] ?? g.control[a.id], t: 'FW', c: '#7a5a2b' });
    mine.forEach((m, i) => {
      const side = m.side ?? g.control[a.id], lane = cont ? (near(side) ? 1 : -1) : 1, size = CHIT;
      const p = inArea(a.id, base.x + (i - (mine.length - 1) / 2) * 1.5, base.z + lane * 2.3, size / 2 + 0.25);
      const k = tag(m.t, m.c, size); k.position.set(p.x, 0.02, p.z); k.userData.mark = `${m.t}:${a.id}`; markers.add(k);
    });
  }
  for (const k of Object.keys(g.greif)) { const [x, y] = k.split('-').map(Number), q = toWorld(...borderMid(x, y)), p = free(q.x, q.z - 1.3, 0.8), t = tag('G', '#8a2f9c', CHIT); t.position.set(p.x, 0.07, p.z); t.rotation.y = -borderAngle(x, y); markers.add(t); }
  for (const k of g.blown) { const [x, y] = k.split('-').map(Number), q = toWorld(...borderMid(x, y)), p = free(q.x, q.z, 0.85), t = tag('X', '#d9421f', CHIT * 0.72); t.position.set(p.x, 0.07, p.z); t.rotation.y = -borderAngle(x, y); markers.add(t); }
  for (const { key, code } of VOL.edgeMarks(g)) { const [x, y] = key.split('-').map(Number), q = toWorld(...borderMid(x, y)), p = free(q.x, q.z, 0.85), t = tag(code, '#8a7a4e', CHIT * 0.8); t.position.set(p.x, 0.07, p.z); t.rotation.y = -borderAngle(x, y); markers.add(t); }      // the volume's boundary markers (Golan: minefields, bridged ditch)
}
/** Map overlays: the area tint (terrain defence or army zones) is painted into the board under the line work. */
let tint: 'off' | 'tdn' | 'zones' | 'control' | 'supply' = (() => { try { const t = localStorage.getItem('fab-tint'); return t === 'tdn' || t === 'zones' || t === 'control' || t === 'supply' ? t : 'off'; } catch { return 'off'; } })();
const TDN_COL = [0xf4e3a4, 0xc9a24f, 0x8a8f86, 0x4a5028], ZONE_COL: Record<number, number> = { 5: 0x3a3f46, 6: 0x951b81, 7: 0x009fe3 };   // the TDN colours are the printed TDN markers'
/** Map overlays (DESIGN.md › Map overlays): one meaning per colour. Reach green, stop brass, must-fight red, optional fight brass, selection brass, supply in the side's colour. */
const MAPC = { reach: 0x5d8b3a, stop: 0xe7b04a, preview: 0xf6e3a8, must: 0xd1432f, fight: 0xe7b04a, sel: 0xe7b04a, cut: 0xd1432f, supGe: 0xb9bcc0, supAl: 0x9db36a, ring: 0x8fc46a };
const CONTROL_COL: Record<string, number> = { ...VOL.controlCol, contested: 0x9b59d0 };                      // allied green, axis grey, contested violet (red and yellow are the combat highlights)
const tintOf = (id: number) => (tint === 'tdn' ? TDN_COL[E.areas.get(id)!.tdn] : tint === 'control' ? (E.contested(g, id) ? CONTROL_COL.contested : CONTROL_COL[g.control[id] ?? P1]) : ZONE_COL[E.areas.get(id)!.zone]);
const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** What is printed on the map, and how. */
const layers = (() => { const d = { numbers: true, tdn: true, vp: true, names: true }; try { return { ...d, ...JSON.parse(localStorage.getItem('fab-layers') ?? '{}') }; } catch { return d; } })();
const saveLayers = () => { try { localStorage.setItem('fab-layers', JSON.stringify(layers)); localStorage.setItem('fab-tint', tint); } catch { /* private mode */ } };
/** Whose side of the table we look from: each player sits at their own edge of the printed map (Bulge: German at the bottom; Golan: Israeli at the bottom, by the lakes); a shared screen looks from the bottom. */
let tutView: E.Side | null = null;                                                                             // the tutorial looks from the side its lesson's player plays
const viewSide = (): E.Side => (online.active && !online.both() && online.mySide() ? online.mySide()! : tutView ?? VOL.bottom);
const farSide = () => viewSide() !== VOL.bottom;
const fogSide = (): E.Side | 'spectator' | null => (online.active && !online.both() ? online.mySide() ?? 'spectator' : null);
const seen = (u: E.Unit) => E.visibleTo(g, u, fogSide());
const viewRot = () => (farSide() ? Math.PI : 0);
/** Restricted boundaries (14.1) and the border two areas share, as a polyline (vertices of one area lying on the other's outline). */
const RESTRICTED: [number, number][] = [...E.areas.keys()].flatMap((a) => E.neighbors(a).filter((b) => b > a && E.connection(a, b)?.restricted).map((b): [number, number] => [a, b]));
function sharedBorder(a: number, b: number): [number, number][] {
  const A = MAP.areas.find((x) => x.id === a)!.polygon as [number, number][], B = MAP.areas.find((x) => x.id === b)!.polygon as [number, number][];
  const near = (p: [number, number]) => { for (let i = 0, j = B.length - 1; i < B.length; j = i++) { const [ax, ay] = B[j], [bx, by] = B[i], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1))); if (Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy) < 3) return true; } return false; };
  const on = A.map(near), n = A.length; let start = on.findIndex((v, i) => v && !on[(i - 1 + n) % n]); if (start < 0) start = 0;
  const out: [number, number][] = []; for (let k = 0; k < n; k++) { const i = (start + k) % n; if (!on[i]) break; out.push(A[i]); }
  return out;
}
/** Areas drawn and clickable now: a scenario sheet's own boxes only while it is played; outside a play area, nothing is clickable. */
const SHEET_ONLY = new Set((VOL.art.sheetBoxes ?? []).map((b) => b.id));
const shownArea = (id: number) => !SHEET_ONLY.has(id) || !!g.inPlay?.includes(id);
function paintBoard() {
  if (!baseImg.naturalWidth || !linesImg.naturalWidth) return;
  const c = boardCv.getContext('2d')!, k = 2; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, boardCv.width, boardCv.height);
  const r3 = show3d() ? REL : null;
  if (r3) { c.fillStyle = hex6(WOOD_BASE); c.fillRect(0, 0, boardCv.width, boardCv.height); c.drawImage(relPixels(r3.snow), 0, 0, boardCv.width, boardCv.height); c.drawImage(relPixels(r3.entry), 0, 0, boardCv.width, boardCv.height); }
  else c.drawImage(pixels(baseImg), 0, 0, boardCv.width, boardCv.height);
  if (tint !== 'off' && tint !== 'supply') {
    c.save(); c.scale(k, k); c.globalAlpha = 0.6;
    for (const a of MAP.areas.filter((x) => shownArea(x.id))) { c.beginPath(); a.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = hex6(tintOf(a.id)); c.fill(); }
    c.restore();
  }
  if (r3) { c.drawImage(relPixels(r3.lines), 0, 0, boardCv.width, boardCv.height); c.save(); c.scale(k, k); c.lineJoin = 'round';                                       // area borders from the area shapes themselves: every edge, including the circles round Bastogne and Verviers
    for (const [w, col] of [[7, '#ffffff99'], [2.9, '#141416']] as const) { c.lineWidth = w; c.strokeStyle = col; for (const a of MAP.areas.filter((x) => shownArea(x.id))) { c.beginPath(); a.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); } }
    c.restore(); }
  else c.drawImage(pixels(linesImg), 0, 0, boardCv.width, boardCv.height);
  if (VOL.art.zones) {                                                                           // the three German army zones: a dashed line in the zone's colour just inside it
    c.save(); c.scale(k, k); c.lineWidth = 2.6; c.lineJoin = 'round'; c.setLineDash([9, 5]);
    for (const [z, d] of Object.entries(VOL.art.zones)) { c.strokeStyle = hex6(ZONE_COL[+z]); c.stroke(new Path2D(d)); }
    c.restore();
  }
  {
    c.save(); c.scale(k, k);
    for (const [a, b] of RESTRICTED) drawRestricted(c, sharedBorder(a, b));
    if (layers.numbers) for (const e of MAP.entries) { c.save(); c.translate(e.x, e.y); c.rotate(viewRot()); drawEntry(c, e, VOL.art.entryDark(e.side)); c.restore(); }
    c.restore();
  }
  boardTex.needsUpdate = true; buildLabels();
}
/* ---------- area labels: printed flat, each on its own level card, so the relief never bends them ---------- */
const labelsGrp = new THREE.Group(); scene.add(labelsGrp);
const labelTexCache = new Map<string, THREE.CanvasTexture>();
function buildLabels() {
  labelsGrp.children.forEach((o) => { (o as THREE.Mesh).geometry.dispose(); ((o as THREE.Mesh).material as THREE.Material).dispose(); }); labelsGrp.clear();
  const PAD = 12, lk = `${+layers.numbers}${+layers.tdn}${+layers.vp}${+layers.names}${Object.values(vpIcons).every((i) => i.naturalWidth > 0)}`, K = 4;
  for (const a of MAP.areas) {
    const L = LAB[a.id]; if (!L || (!layers.numbers && !layers.tdn && !layers.vp && !layers.names)) continue;
    let t = labelTexCache.get(a.id + lk);
    if (!t) { const cv = document.createElement('canvas'); cv.width = Math.ceil((L.w + 2 * PAD) * K); cv.height = Math.ceil((L.h + 2 * PAD) * K); const c = cv.getContext('2d')!; c.scale(K, K); c.translate(L.w / 2 + PAD, L.h / 2 + PAD); drawLabel(c, a, layers, vpIcons, L);
      t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; labelTexCache.set(a.id + lk, t); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry((L.w + 2 * PAD) / S, (L.h + 2 * PAD) / S), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const p = toWorld(L.x, L.y); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, viewRot(), 0); m.userData.area = a.id;
    let y = 0.006;
    if (show3d()) { y = 0; for (const dx of [-0.5, 0, 0.5]) for (const dz of [-0.5, 0, 0.5]) y = Math.max(y, REL!.h(p.x + (dx * L.w) / S, p.z + (dz * L.h) / S)); y += 0.03; }      // level, at the highest ground under it
    m.position.set(p.x, y, p.z); m.renderOrder = 2; labelsGrp.add(m);
  }
  for (const bx of (VOL.art.sheetBoxes ?? []).filter((x) => shownArea(x.id))) {                     // a scenario sheet's own box, on a card above the dimmed map around it
    const K2 = 3, cv = document.createElement('canvas'); cv.width = bx.w * K2; cv.height = bx.h * K2; const c = cv.getContext('2d')!; c.scale(K2, K2);
    c.fillStyle = hex6(VOL.controlCol[bx.side] ?? 0x666666); c.fillRect(0, 0, bx.w, bx.h); c.lineWidth = 4; c.strokeStyle = '#141416'; c.strokeRect(2, 2, bx.w - 4, bx.h - 4);
    c.fillStyle = '#fff'; c.font = '700 19px Arial Narrow, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(bx.name.toUpperCase(), bx.w / 2, 26);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bx.w / S, bx.h / S), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    const p = toWorld(bx.x + bx.w / 2, bx.y + bx.h / 2); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, 0, 0);
    let y = 0.008; if (show3d()) { y = 0; for (const dx of [-0.5, 0, 0.5]) for (const dz of [-0.5, 0, 0.5]) y = Math.max(y, REL!.h(p.x + (dx * bx.w) / S, p.z + (dz * bx.h) / S)); y += 0.04; }
    m.position.set(p.x, y + 0.004, p.z); m.renderOrder = 3; labelsGrp.add(m);      // over the dimmed areas' own labels
  }
}
applyArt();
if (map3d && VOL.art.relief) setTimeout(() => { map3d = false; setMap3d(true); }, 0); else map3d = false;           // a saved choice of the 3D map: loaded once the game is up
/** Supply overlay: your own side (or the Phasing Player when you play both); computed once per refresh. */
const supplySide = (): E.Side => online.mySide() ?? g.phasing;
let supCache = new Map<string, boolean>(), supKey = '';
function supOk(sd: E.Side, a: number) { const k = `${g.turn}${g.phase}${g.log.length}${JSON.stringify(g.control).length}${g.units.map((u) => u.area).join()}`; if (k !== supKey) { supKey = k; supCache = new Map(); } const kk = sd + a; let v = supCache.get(kk); if (v == null) { v = E.inSupply(g, sd, a); supCache.set(kk, v); } return v; }
function paintAreas() {
  const strat = g.phase === 'strategic' && selUnit, opts = selUnit ? (strat ? E.stratOptions(g, selUnit).map((a) => ({ area: a, mustStop: false })) : E.moveOptions(g, selUnit)) : [];
  const fight = g.phase === 'combat' || g.phase === 'btCombat' ? fightable() : [], must = new Set(E.mustFight(g));
  const arr = new Map(arrOpts().map((x) => [x.area, x])), ret = new Set(g.battle?.stage === 'retreat' ? E.retreatOptions(g, g.battle) : []);      // once, not per area
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial; let c = 0xffffff, o = 0; const r = opts.find((x) => x.area === id);
    if (r) { c = r.mustStop ? MAPC.stop : MAPC.reach; o = r.mustStop ? 0.34 : 0.4; } else if (fight.includes(id)) { c = must.has(id) ? MAPC.must : MAPC.fight; o = must.has(id) ? 0.34 : 0.26; }
    if (id === (previewArea ?? hoverArea) && r) { c = MAPC.preview; o = 0.5; }
    if (id === selArea && !selUnit) { c = MAPC.sel; o = Math.max(o, 0.3); }
    if (id === kbArea && document.activeElement === canvas && o < 0.3) { c = 0xffffff; o = 0.3; }              // the keyboard cursor
    if (dragTargets.includes(id)) { c = MAPC.reach; o = 0.5; }
    if (tgt) { if (tgt.areas.has(id)) { c = tgt.color.get(id) ?? MAPC.reach; o = 0.5; } else if (tgt.pick.has(id) && (!tgt.focus || tgt.color.has(id))) { c = tgt.color.get(id) ?? 0xe7b04a; o = 0.45; } else if (o === 0) { c = 0x000000; o = 0.28; } }       // a chit in hand: what it can act on glows, the rest dims
    const ar = arr.get(id); if (ar) { c = ar.sa ? MAPC.stop : MAPC.reach; o = 0.45; }
    if (ret.has(id)) { c = MAPC.reach; o = 0.5; }
    if (areaPick) { if (areaPick.areas.has(id)) { c = MAPC.reach; o = 0.5; } else if (o === 0) { c = 0x000000; o = 0.28; } }
    if (tint === 'supply' && !g.battle && o === 0 && !tgt) { const sd = supplySide(), mine2 = g.control[id] === sd; if (!mine2) { c = 0x000000; o = 0.22; } else if (supOk(sd, id)) { c = 0xffffff; o = 0.16; } else { c = MAPC.cut; o = 0.5; } }      // your supplied areas stay light, cut-off ones red, the enemy's dimmed
    if (!shownArea(id)) o = 0;
    else if (g.inPlay && !g.inPlay.includes(id)) { if (g.supplyOnly?.includes(id)) { c = 0x1d2a45; o = 0.5; } else { c = 0x000000; o = 0.62; } }      // Cold Shoulder: Zone 5 carries supply only (P.6)                                   // 24.33 outside the Introductory map sheet
    mat.color.setHex(c); mat.opacity = o; m.visible = o > 0 && !show3d();                           // a clear overlay is not drawn at all; on the relief the ground paints it
    tintData.set([mat.color.r * 255, mat.color.g * 255, mat.color.b * 255, o * 255], id * 4); tintTex.needsUpdate = true;
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
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = clampDist(dist * pinch / d); pinch = d; moved = 99; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey || lock) { yaw -= dx * 0.006; pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006)); }
  else { const k = dist * 0.0018, c = Math.cos(yaw), s = Math.sin(yaw); target.x -= (dx * c + dy * s) * k; target.z -= (-dx * s + dy * c) * k; }
});
canvas.addEventListener('pointerup', (e) => { ptrs.delete(e.pointerId); if (moved < 6) click(e); });
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { goal = null; e.preventDefault(); dist = clampDist(dist * Math.exp(e.deltaY * 0.0012)); }, { passive: false });

const ray = new THREE.Raycaster();
function pick(e: PointerEvent) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
  const hits = ray.intersectObjects(pieces.children, false), units = [...new Set(hits.map((h) => h.object.userData.unit as string | undefined).filter((x): x is string => !!x))];
  const hitPiece = hits.find((h) => h.object.userData.unit || h.object.userData.chit) ?? hits[0];                      // a marker lying on a block does not hide the block
  if (units.length > 1 && selUnit && units.includes(selUnit)) return { unit: units[(units.indexOf(selUnit) + 1) % units.length], chit: undefined, area: areaAt(ray) };   // tapping a stack again picks the next block in it
  return { unit: hitPiece?.object.userData.unit as string | undefined, chit: hitPiece?.object.userData.chit as string | undefined, area: areaAt(ray) };
}
function areaAt(ray: THREE.Raycaster): number | null {
  const hitBoard = show3d() ? (() => { const p = REL!.hit(ray.ray); return p ? { point: p } : undefined; })() : ray.intersectObject(board)[0];
  let area: number | null = null;
  if (hitBoard) { const px = (hitBoard.point.x + MW / (2 * S)) * S, py = (hitBoard.point.z + MH / (2 * S)) * S; area = MAP.areas.find((a) => shownArea(a.id) && (!g.inPlay || g.inPlay.includes(a.id)) && inside(px, py, a.polygon))?.id ?? null; }
  return area;
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
let tgt: Tgt | null = null, infoOpen = false, infoFor = '', tgtMode = '';
const abtn = (icon: string, label: string, fn: () => void, cls = '', dis = false, title = '') => btn(`${ico(icon)}<span>${esc(label)}</span>`, fn, 'ab ' + cls, dis, title || label);
const BTN_ICON: [RegExp, string][] = [[/blow|bridge.*bridge/i, 'xbold'], [/repair/i, 'engineer'], [/field works|fortify/i, 'gear'], [/roadblock|rally/i, 'flag'], [/interdict/i, 'warn'], [/alternate/i, 'swap'], [/pool/i, 'task_force'], [/intelligence/i, 'info'], [/reserve/i, 'sa_block'], [/replacement/i, 'infantry_asset'], [/drop|enter|place|boundary/i, 'next'], [/strike/i, 'air_mission']];
/** Give a chit action its icon so the buttons read at a glance; the text stays as the label. */
const iconify = (html: string) => html.replace(/<button class="([^"]*)" (data-do="[^"]+") ([^>]*)>([^<]*)<\/button>/g, (m, cls, d, rest, text) => { const ic = BTN_ICON.find(([re]) => re.test(text))?.[1]; return ic ? `<button class="${cls} ab" ${d} ${rest}>${ico(ic)}<span>${text}</span></button>` : m; });
/** The selected chit: a slim bar with its picture, a one-line instruction, an info toggle and the actions as icon buttons. */
function chitBar(c: E.Chit): string {
  if (!mine(c.side)) return `<div class="c-dispatch chitbar ${infoOpen ? 'open' : ''}"><div class="cbhead"><span class="cbimg">${chitPic(c)}</span><div class="cbt"><b>${esc(c.name)}</b><small>The other side's piece: you can only look</small></div><button class="ico" data-ui="${reg(() => { selChit = null; })}" aria-label="Put away" title="Put away">${ico('close')}</button></div><div class="inspect slimcard">${ruleHtml(VOL.ruleKey(c.kind), E.isEvent(c))}</div></div>`;
  const tg = tgt, body = chitPanel(c), [kind] = RULE[VOL.ruleKey(c.kind)] ?? [c.kind];
  const chips = tg?.chips.map((x) => `<button class="pc ${c.side}" data-do="${reg(x.fn)}" title="${esc(x.label)}">${x.img}<small>${esc(x.label)}</small></button>`).join('') ?? '';
  if (infoFor !== c.id) { infoFor = c.id; infoOpen = guide === 'full'; }      // each chit opens with its rules folded (short mode) or shown (full mode)
  return `<div class="c-dispatch chitbar ${infoOpen ? 'open' : ''}"><div class="cbhead"><span class="cbimg">${chitPic(c)}</span><div class="cbt"><b>${esc(c.name)}</b><small>${tg?.hint ? gx(esc(tg.hint), esc(kind)) : esc(kind)}</small></div>
    <button class="ico" data-ui="${reg(() => { infoOpen = !infoOpen; })}" aria-pressed="${infoOpen}" aria-label="What it does" title="What it does">${ico('info')}</button><button class="ico" data-ui="${reg(() => { selChit = null; })}" aria-label="Put away" title="Put away">${ico('close')}</button></div>
    ${tg && tg.modes.length > 1 ? `<div class="modes" role="group" aria-label="What to do">${tg.modes.map((m) => `<button class="ico ${m.id === tgtMode ? 'on' : ''}" data-ui="${reg(() => { tgtMode = m.id; refresh(); })}" title="${esc(m.label)}" aria-label="${esc(m.label)}">${ico(m.icon)}<span>${esc(m.label)}</span></button>`).join('')}</div>` : ''}${infoOpen ? `<div class="inspect slimcard">${ruleHtml(VOL.ruleKey(c.kind), E.isEvent(c))}</div>` : ''}${chips ? `<div class="cbchips">${chips}</div>` : ''}${tg?.buttons.length ? `<div class="row">${tg.buttons.map((b) => abtn(b.icon, b.label, b.fn, '', false, b.title)).join('')}</div>` : ''}${iconify(body)}</div>`;
}
function chitPanel(c: E.Chit): string {
  const a = selArea, out: string[] = [];
  if (c.box !== 'available') return '<p class="hint">Only chits in the Available Box can be used.</p>';
  if (g.phase !== 'admin') return `<p class="hint">${E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission' ? 'This chit is assigned to a battle during the Combat Phase.' : c.kind === 'fuel' ? 'Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.' : c.kind === 'sa_block' || c.kind === 'special_action_event' ? 'Special Actions are spent in battles (reinforce / retreat), Breakthrough phases and the Admin Phase.' : 'Events are played in the Admin Phase.'}</p>`;
  if (VOL.id !== 'bulge') return '';                                                              // the other volumes offer everything through the glowing targets and buttons
  if (c.kind.startsWith('replacement') || c.kind === 'event_arriving_regiment' || c.kind.startsWith('rebuild')) {
    const el = g.units.filter((x) => E.eligibleForStep(c, x));                                       // blocks on the map light up; eliminated ones come back from the chips above
    if (!el.length) out.push('<p class="hint">No reduced, supplied unit of the right class and Higher Echelon.</p>');
    if (c.kind.startsWith('rebuild')) g.units.filter((x) => x.area == null && x.max === 1 && x.side === c.side && x.q[0] !== 'elite' && !x.garrison && (c.kind.endsWith('arm') === (x.cls === 'armor')) && x.str === 0).forEach((x) => out.push(a == null ? '<p class="hint">Select an objective area to return an eliminated unit.</p>' : btn(`Return ${esc(x.name)} to ${esc(areaName(a))}`, () => E.playRebuild(g, c.id, x.id, a))));
  } else if (c.kind === 'event_bodenplatte') { out.push(btn(`Strike Allied air missions (${E.boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission').length} in the Available Box)`, () => E.playBodenplatte(g, c.id), 'primary')); }
  else if (c.kind === 'fuel') out.push('<p class="hint gx">Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.</p>');
  if (E.isEvent(c) && c.kind !== 'sa_block' && c.kind !== 'event_delayed_response' && E.boxOf(g, c.side, 'eliminated').some(E.isAsset)) out.push(btn('Alternate use', () => E.alternateUse(g, c.id), '', false, '4.21: return 2 assets to the cup instead'));
  return `<div class="row">${out.join('')}</div>`;
}

/* ---------- flow ---------- */
const STEPS = ['Prepare', 'Move', 'Fight', 'Breakthrough', 'Supply'], STEP_OF: Record<E.Phase, number> = { deploy: 1, reinforcement: 0, admin: 0, movement: 1, strategic: 1, combat: 2, reaction: 2, btMove: 3, btCombat: 3, supply: 4 };
/** The red button that ends the step. */
const endLabel = () => (g.phase === 'deploy' ? 'End set-up' : `End ${STEPS[STEP_OF[g.phase]].toLowerCase()}`);
const other = E.other;
/** The printed sequence of play (the step bar): Breakthrough covers its movement and its combat. */
const PHASES = ['Reinforcement', 'Admin', 'Movement', 'Strategic', 'Combat', 'Reaction', 'Breakthrough', 'Supply'], PHASE_OF: Record<E.Phase, number> = { deploy: 2, reinforcement: 0, admin: 1, movement: 2, strategic: 3, combat: 4, reaction: 5, btMove: 6, btCombat: 6, supply: 7 };
/** Areas a battle can start in now. Breakthrough Combat (8.22): areas contested before movement only with a Special Action available. */
const fightable = () => { const nw = g.phase === 'btCombat' ? new Set(E.newlyContested(g)) : null, sa = nw && E.saAvailable(g, g.phasing).length > 0;
  return E.contestedAreas(g).filter((a) => !g.fought.includes(a) && (!nw || nw.has(a) || sa)); };
function idle(): boolean {                                                // phases with nothing to do are skipped for the player
  const p = g.phasing, o = other(p), us = (s: E.Side) => g.units.filter((u) => u.side === s && u.area != null && !u.garrison);
  switch (g.phase) {
    case 'reinforcement': return !g.tfNew.length && !g.pendingArrivals.length && !g.recover.length && !g.artyPick;
    case 'strategic': return !us(p).some((u) => u.reserve);
    case 'combat': case 'btCombat': return !fightable().length;
    case 'reaction': return !us(o).some((u) => u.reserve);
    case 'btMove': return !us(p).some((u) => (u.reserve || u.exploit) && !u.moved) && !(us(p).some((u) => u.cls === 'armor' && !u.moved) && E.saAvailable(g, p).length);
    case 'supply': return !g.supplyPending;
    default: return false;
  }
}
function auto() { if (SANDBOX && !SBU.st.sbAuto && !SBU.st.sbHot) return; for (let i = 0; i < 12 && !g.over && !g.battle && !g.pendingBlow && idle(); i++) { try { E.endPhase(g); } catch { break; } } }
let toast = '', toastT = 0, toastInfo = false;
let sayDraw = 0;
const say = (t: string, info = false) => { toast = t; toastInfo = info; clearTimeout(toastT); toastT = window.setTimeout(() => { toast = ''; render(); }, 3200); if (!sayDraw) sayDraw = window.setTimeout(() => { sayDraw = 0; render(); }, 0); };      // a refusal shows at once, even when the caller does not redraw
let dragTargets: number[] = [];
const hist = new History<E.Game>(); let note = '', selArr: string | null = null;
/** Who may act right now: one side, or both while each handles its own assets (admin, reinforcement, battle set-up). */
const actorNow = () => E.actorOf(g);
const allowed = () => !online.active || online.both() || (online.mySide() != null && (actorNow() === 'both' || actorNow() === online.mySide()));
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
  if (online.mode === 'remote' && !online.rev) return say('The game is still loading…');
  if (heldNext) commitRoll();
  const before = g.battle ? snap(g) : null, ck0 = g.checks?.length ?? 0;
  const r = hist.run(g, () => { f(); auto(); }, (a, b) => after || (b.log.slice(a.log.length).at(-1) ?? '').replace(new RegExp(`^T\\d+ (\\[\\w+\\] )?((${TAGRE}) \\w+: )?`), '').slice(0, 60), lockOf);
  g = r.game; if (r.error) say(/pending|already/.test(r.error.message) ? `That choice is no longer open (the game is at ${g.battle?.stage ?? 'no battle'}). Refreshed.` : r.error.message); else { note = after; if (before && !rollNoted) noteFx(before, g); }       // a roll already noted its own effects, to show them once the dice have settled
  rollNoted = false;
  save(); refresh();
  if (!r.error) showChecks((g.checks ?? []).slice(ck0));
}
/** What an action showed that cannot be taken back (undo locks there). */
function lockOf(a: E.Game, b: E.Game): string {
  const up = (x: E.Game) => x.units.filter((u) => u.up != null).length, cup = (x: E.Game) => x.chits.filter((c) => c.box === 'cup').length;
  if (b.revealed && b.revealed !== a.revealed) return 'a block was revealed';
  if (up(b) > up(a)) return 'blocks revealed';
  if (cup(b) < cup(a)) return 'chits drawn';
  if (b.blown.length > a.blown.length) return 'bridge blown';
  if (a.battle && !b.battle) return 'battle closed';
  if (b.turn !== a.turn || b.phase !== a.phase || b.phasing !== a.phasing) return 'new phase';
  return '';
}
function undo() { if (!allowed()) return say(notYou()); if (heldNext) return say('Wait for the dice to land'); const lbl = hist.label, r = hist.undo(g); if (!r.game) return say(r.why ?? 'Nothing to undo'); const p = r.game; p.log.push(`T${p.turn} ${nm(online.mySide() ?? p.phasing)} undid ${lbl ? '“' + lbl + '”' : 'an action'}`); g = p; selUnit = selChit = selArr = previewArea = hoverArea = null; note = ''; save(); refresh(); }
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null, typing = !!t?.matches?.('input,select,textarea');
  if (e.key === 'Escape') { if (modal) { modal = null; render(); } else if (selUnit || selArr || selChit || selArea != null) { selUnit = selArr = selChit = null; selArea = null; previewArea = null; refresh(); } return; }
  if (t === canvas && !modal) {
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dir[e.key]) { e.preventDefault(); kbStep(...dir[e.key]); return; }
    if (e.key === 'Enter' && kbArea != null) { e.preventDefault(); kbEnter(); return; }
  }
  if ((e.key === 'n' || e.key === 'N') && !typing && !modal && !e.ctrlKey && !e.metaKey) { const mv = canMove(); if (mv.length) { selUnit = nextOf(mv, selUnit); const u = g.units.find((x) => x.id === selUnit)!; selArea = kbArea = u.area; previewArea = null; lookAt(u.area!); refresh(); } return; }
  if (e.key === 'Enter' && !typing && !t?.matches?.('button,[role=button]') && !modal) { const go = document.querySelector<HTMLButtonElement>('#ui .go:not(:disabled)'); if (go) { e.preventDefault(); go.click(); } }
 if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !(e.target as HTMLElement)?.matches?.('input,select')) { e.preventDefault(); undo(); } });
const tfAreas = () => [...E.areas.keys()].filter((a) => g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
/** Place an arriving block; an area outside its listed ones costs a Special Action, and the player picks which one (8.27). In a set-up step the block is deployed. */
function arrive(id: string, area: number) {
  if (g.phase === 'deploy') return VOL.place(g, id, area);
  if (!g.pendingArrivals.includes(id)) return E.placeTaskForce(g, id, area);
  const u = g.units.find((x) => x.id === id)!, o = E.arrivalOptions(g, id).find((x) => x.area === area);
  if (o?.sa) pickSA(u.side, u.ech, (sa) => E.placeArrival(g, id, area, sa)); else E.placeArrival(g, id, area);
}
/** When more than one Special Action could pay for an action, the player chooses which (a single-use event keeps the reusable block for later, 8.1).
 *  Runs inside an action: with one choice it pays at once, otherwise it opens the chooser and the chosen counter pays in a new action. */
const ARMY_NAME: Record<string, string> = { de_5pz: '5th Panzer Army', de_6pz: '6th Panzer Army', de_7a: '7th Army', de_sr: 'Strategic Reserve', us_1a: 'US 1st Army', us_3a: 'US 3rd Army', us_sr: 'US reserve', br_xxx: 'British' };
/* ---------- chat between the two players; watchers read it ---------- */
const chatOn = () => online.mode === 'remote' || DEV_FAKE;
/* ---------- the action feed: the newest log lines, fading, above the dock ---------- */
let followFoe = (() => { try { return localStorage.getItem('fab-follow') !== '0'; } catch { return true; } })();
let feed: { t: number; text: string; side: string }[] = [], feedLen = -1;
function feedHtml(): string {
  const n = g.log.length; if (feedLen < 0 || n < feedLen) feedLen = n;                       // a new or rewound game shows nothing old
  for (const l of g.log.slice(feedLen)) { if (/\[sandbox\]|: phase start$/.test(l)) continue; const text = l.replace(/^T\d+ /, '').replace(new RegExp(`^(${TAGRE}) (\\w+): \\2 phase$`), `$1 Turn ${g.turn}: $2`).replace(new RegExp(`^(${TAGRE}) [a-zA-Z]+: `), '$1 ');   /* the step is in the top bar; the feed keeps only the news */ feed.push({ t: Date.now(), text, side: sideByTag(text.split(/\s/)[0]) }); }
  feedLen = n; const now = Date.now(); feed = feed.filter((f) => now - f.t < 9000).slice(-3); if (g.battle) return '';         // the battle has its own report
  if (feed.length) setTimeout(() => { if (feed.some((f) => Date.now() - f.t >= 9000)) render(); }, 9100);
  return feed.length ? `<div class="feed ${g.phase === 'admin' || g.phase === 'reinforcement' ? 'top' : ''}" aria-live="polite">${feed.map((f) => `<div class="fl2 ${f.side}" style="animation-delay:${-(now - f.t) / 1000}s">${sideTag(f.text)}</div>`).join('')}</div>` : '';
}
let chatOpen = false, chatDraft = '', chatSeen = (() => { try { return Number(localStorage.getItem('fab-chat-seen-' + TABLE) ?? 0); } catch { return 0; } })();
const QUICK = ['Your turn', 'Ready', 'One moment', 'Nice move', 'Good game'];
const unread = () => online.chat.filter((m) => m.t > chatSeen && m.uid !== online.uid).length;
const markSeen = () => { const last = online.chat.at(-1)?.t ?? 0; if (last > chatSeen) { chatSeen = last; try { localStorage.setItem('fab-chat-seen-' + TABLE, String(last)); } catch { /* private mode */ } } };
let chatKnown = -1;
setChatListener((m: ChatMsg[]) => {                                                                   // a short banner for a new message while the chat is closed
  const fresh = chatKnown < 0 ? [] : m.filter((x) => x.t > chatKnown && x.uid !== online.uid); chatKnown = Math.max(chatKnown, m.at(-1)?.t ?? 0);
  if (chatOpen) { markSeen(); const l = document.getElementById('chat-list'); if (l) { l.innerHTML = chatRows(); l.scrollTop = l.scrollHeight; } } else if (fresh.length) { const x = fresh.at(-1)!; say(`${nm(x.side)}: ${x.text}`); }
});
async function chatSend(text: string) { const e = await sendChat(text); if (e) { say(/permission/i.test(e) ? 'Chat not allowed by the database: the game\'s security rules need publishing (Admin > Update rules).' : e); render(); } else { chatDraft = ''; const i = document.getElementById('chat-in') as HTMLInputElement | null; if (i) i.value = ''; } }
function chatBtn() { if (!chatOn()) return ''; const n = unread(); return `<button class="ico chatbtn ${chatOpen ? 'on' : ''}" data-ui="${reg(() => { chatOpen = !chatOpen; if (chatOpen) markSeen(); })}" title="Chat" aria-label="Chat${n ? `, ${n} new` : ''}">${ico('chat')}${n ? `<i class="unread">${n > 9 ? '9+' : n}</i>` : ''}<span class="bl">Chat</span></button>`; }
function chatRows() {
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return online.chat.map((m) => `<div class="cm ${m.side} ${m.uid === online.uid ? 'me' : ''}"><small>${m.name && m.name.toLowerCase() !== m.side ? `<b>${esc(m.name)}</b> · ` : ''}<span class="sd">${nm(m.side)}</span> · ${time(m.t)}</small><p>${esc(m.text)}</p></div>`).join('') || '<p class="hint">No messages yet.</p>';
}
function chatHtml() {
  if (!chatOn() || !chatOpen) return '';
  const me = online.mySide(), rows = chatRows();
  return `<aside class="chat" aria-label="Chat"><div class="chead"><b>${ico('chat')} Chat</b><button class="ico" data-ui="${reg(() => { chatOpen = false; })}" aria-label="Close chat">${ico('close')}</button></div>
    <div class="clist" id="chat-list">${rows}</div>
    ${me ? `<div class="cquick">${QUICK.map((q) => `<button data-ui="${reg(() => { void chatSend(q); })}">${q}</button>`).join('')}</div>
    <div class="cin authform"><input id="chat-in" maxlength="300" placeholder="Message to your opponent" value="${esc(chatDraft)}" autocomplete="off" enterkeyhint="send"><button class="primary" id="chat-send" aria-label="Send">${ico('next')}</button></div>`
    : '<p class="hint cwatch">You are watching: only the two players can write.</p>'}</aside>`;
}
let scoreOpen = false, endHidden = false;                                                      // VP breakdown sheet; the end panel can be put aside to look at the final map
let auditWarn: string[] = [];                                                                         // problems found in moves written by the other browser
let saPick: { side: E.Side; run: (id: string) => void; cands: E.Chit[] } | null = null;
function pickSA(side: E.Side, ech: string | undefined, run: (id?: string) => void) {
  const seen = new Set<string>(), cands = E.saAvailable(g, side, ech).filter((c) => { const k = c.kind + c.ech; if (seen.has(k)) return false; seen.add(k); return true; });   // one choice per kind of counter
  if (cands.length <= 1) return run(cands[0]?.id);
  saPick = { side, run, cands };
}
/** An Air Mission played in a battle (17.21): extra artillery, or +2 to one of your units there (then tap it). */
let airPick: { id: string; side: E.Side; step: 'choose' | 'unit' } | null = null;
function airPickHtml() {
  if (!airPick || airPick.step !== 'choose' || !g.battle) return '';
  const p = airPick;
  return `<div class="modal"><div class="sheet slim"><h3>${ico('air_mission')} Air Mission <button class="ico" data-ui="${reg(() => { airPick = null; })}" aria-label="Cancel">${ico('close')}</button></h3>
    <p class="hint gx">Combat support (17.21): it is this battle's one event, and it can never take a step loss.</p>
    <div class="row">${btn(`${ico('artillery')} Extra artillery`, () => { airPick = null; E.assign(g, g.battle!, p.id, 'arty'); }, 'primary', false, 'Fires like an artillery asset, outside the artillery limit')}${ubtn(`${ico('plus')} +2 to one unit`, () => { airPick = { ...p, step: 'unit' }; }, '', false, 'Then tap one of your blocks in this battle: +2 to its Success Number')}</div></div></div>`;
}
function saPickHtml() {
  if (!saPick) return '';
  const p = saPick;
  return `<div class="modal"><div class="sheet sapick"><h3>Which Special Action? <button class="ico" data-ui="${reg(() => { saPick = null; })}" aria-label="Cancel">${ico('close')}</button></h3>
    <p class="hint gx">A single-use event only helps its own Higher Echelon and is eliminated; the reusable block goes to the Used Box and comes back next turn.</p>
    <div class="pcgrid">${p.cands.map((c) => `<div class="sapc"><button class="pc ${c.side}" data-ui="${reg(() => { saPick = null; act(() => p.run(c.id)); })}" title="${esc(c.name)}">${chitPic(c)}</button><small>${esc(c.kind === 'sa_block' ? 'Reusable block' : `Event${ARMY_NAME[c.ech] ? ' · ' + ARMY_NAME[c.ech] : ''}`)}</small></div>`).join('')}</div></div></div>`;
}
function arrOpts(): { area: number; sa: boolean }[] {
  if (!selArr || (g.phase !== 'reinforcement' && g.phase !== 'deploy')) return [];
  { const au = g.units.find((x) => x.id === selArr); if (au && !mine(au.side)) return []; const ac = g.chits.find((x) => x.id === selArr); if (ac && !mine(ac.side)) return []; }
  if (g.phase === 'deploy') return VOL.placeOptions(g, selArr).map((area) => ({ area, sa: false }));
  return g.pendingArrivals.includes(selArr) ? E.arrivalOptions(g, selArr) : g.tfNew.includes(selArr) ? tfAreas().map((area) => ({ area, sa: false })) : [];
}

/* ---------- camera focus ---------- */
type Goal = { t: THREE.Vector3; dist: number; pitch: number; fast?: boolean } | null; let goal: Goal = null, saved: Goal = null, inBattle = false;
/** Reinforcing a battle by Special Action (the defender): neighbouring blocks that may join light up and a tap moves one in. */
let reinforcing = false;
function reinforceTargets(): Tgt | null {
  const b = g.battle; if (!reinforcing || !b || b.stage !== 'setup') return null;
  const t: Tgt = { units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: 'Tap a glowing neighbouring block to bring it in' }, def = other(b.attacker);
  for (const u of g.units.filter((x) => x.side === def && x.area != null && x.area !== b.area)) { try { const c = structuredClone(g); E.defenderReinforceSA(c, c.battle!, u.id); t.units.set(u.id, () => { reinforcing = false; pickSA(def, u.ech, (sa) => E.defenderReinforceSA(g, g.battle!, u.id, sa)); }); } catch { /* not a legal reinforcement */ } }
  return t;
}
let frameKey = '';
/** The battle camera: held on the contested area (fitted to it), where the player can still zoom and orbit but not pan away. */
let lock: { c: THREE.Vector3; d: number } | null = null;
const clampDist = (d: number) => (lock ? Math.min(lock.d * 1.7, Math.max(lock.d * 0.45, d)) : Math.min(innerWidth < 700 ? 64 : 110, Math.max(7, d)));      // phones: never so far out that the map leaves a black band
function areaWorld(id: number) { return MAP.areas.find((a) => a.id === id)!.polygon.map(([x, y]) => toWorld(x, y)); }
function syncBattleCam() {
  const b = g.battle; let key = b ? `${b.area}:${b.stage === 'setup' ? 's' : 'f'}` : '';
  const wide = reinforcing || b?.stage === 'retreat';
  if (b && wide) key += 'r';
  if (b && !wide) key += ':' + Math.round(clearRatio * 5);      // refit when the panels around the battle grow or shrink
  if (b && key !== frameKey) {
    if (!inBattle) saved = { t: target.clone(), dist, pitch };
    const pts = areaWorld(b.area), xs = pts.map((q) => q.x), zs = pts.map((q) => q.z), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
    const c = new THREE.Vector3((Math.max(...xs) + Math.min(...xs)) / 2, 0, (Math.max(...zs) + Math.min(...zs)) / 2), r = Math.max(Math.max(w, h) / 2 + 3, formationReach(b) + 2.5); let fit = Math.max(16, r * (innerWidth < innerHeight ? 3.0 : 2.6));

    if (!wide) { const pl = toWorld(...POLE.get(b.area)!); c.set(pl.x, 0, pl.z); }                                  // the battle formation is centred on the area's pole
    if (!wide) fit = fit / Math.max(0.55, Math.min(1, clearRatio * 1.25));      // only the band between the panels shows the battle
    lock = wide ? null : { c, d: fit }; goal = { t: c, dist: wide ? fit * 1.8 : fit, pitch: 1.15, fast: true }; yaw = viewRot();
  }
  if (!b) { reinforcing = false; lock = null; if (inBattle && saved) goal = saved; }
  frameKey = key; inBattle = !!b;
}

/* ---------- map interaction ---------- */
const optsFor = (id: string): E.Opt[] => g.phase === 'strategic' ? E.stratOptions(g, id).map((a) => ({ area: a, cost: 0, fuel: VOL.features.fuel && first(g.units.find((x) => x.id === id)!.side), mustStop: false, path: [] })) : E.moveOptions(g, id);
const fuelLeft = () => E.boxOf(g, P1, 'available').filter((c) => c.kind === 'fuel').length;
const center = (a: number) => toWorld(...POLE.get(a)!);
function confirmMove() {
  const id = selUnit!, to = previewArea!, u = g.units.find((x) => x.id === id)!, from = u.area!; selUnit = null; previewArea = null; selArea = to;
  act(() => { if (g.phase === 'strategic') E.stratMove(g, id, to); else E.move(g, id, to); }, `${u.name}: ${areaName(from)} → ${areaName(to)}`);
}
function click(e: PointerEvent) {
  let { unit, area } = pick(e);
  if (tut) { const t = tut.gate(unit, area); if (t === false) return; if (t.unit) unit = t.unit; if (t.area != null) area = t.area; }
  if (SANDBOX && SBU.st.sbPlace) { const id = SBU.st.sbPlace; if (area == null) return; SBU.st.sbPlace = null; return SBU.sbx(() => SB.place(g, id, area)); }
  if (areaPick) { const ap = areaPick; areaPick = null; if (area != null && ap.areas.has(area)) return act(() => ap.run(area)); say(`${ap.label}: cancelled.`); return refresh(); }
  if (reinforcing && g.battle) { const fn = unit ? tgt?.units.get(unit) : undefined; if (fn) return act(fn); reinforcing = false; if (unit) say('That block cannot reinforce this battle (8.23: good order, an adjacent uncontested area, and a Special Action for its Higher Echelon).'); return refresh(); }
  { const c0 = selChit ? g.chits.find((x) => x.id === selChit) : null, tg = c0 && g.phase === 'admin' ? tgt : null;
    if (tg) {
      const fnU = unit ? tg.units.get(unit) : undefined, fnA = area != null ? tg.areas.get(area) ?? tg.any?.(area) ?? undefined : undefined;
      if (fnU || fnA) { return act((fnU ?? fnA)!); }
      const pk = area != null ? tg.pick.get(area) : undefined; if (pk) { pk(); return refresh(); }
      if (area != null && (tg.areas.size || tg.units.size || tg.any)) { say(tg.hint || 'That is not a target for this chit: tap a glowing area or block.'); return; }      // a tap that does nothing says why
    } }
  const rb = g.battle;
  if (rb?.stage === 'retreat' && area != null && E.retreatOptions(g, rb).includes(area)) return act(() => E.chooseRetreat(g, rb, area));
  if (g.battle && !g.pendingBlow) {                                                                         // a battle is on the table: tapping a block makes it that side's point unit
    const b = g.battle, u = unit ? g.units.find((x) => x.id === unit) : null, { chit: tapped } = pick(e);
    { const fn = tgt?.units.get(tapped ?? unit ?? ''); if (fn && b.stage === 'attFirst') return act(fn); }
    if (b.stage === 'setup' && airPick?.step === 'unit') { const p = airPick; if (u && u.side === p.side && u.area === b.area && !u.garrison) { airPick = null; return act(() => E.assign(g, b, p.id, 'support', u.id)); } airPick = null; say('Tap one of your own blocks in this battle for the +2. Cancelled.'); return refresh(); }
    if (b.stage === 'setup' && tapped) { const c = E.chit(g, tapped); if (mine(c.side)) act(() => E.unassign(g, b, tapped)); else say('Those are the other player\'s assets.'); return; }
    if (b.stage === 'setup' && u && seen(u) && mine(u.side) && !u.garrison && !(u.side === b.attacker && u.disorder)) act(() => E.setPoint(g, b, u.side, u.id));
    return;
  }
  if (g.pendingBlow) return;
  if (selArr && area != null && arrOpts().some((o) => o.area === area)) { const id = selArr; selArr = null; return act(() => arrive(id, area)); }
  if (selUnit && area != null && optsFor(selUnit).some((o) => o.area === area)) { previewArea = area; return confirmMove(); }      // two taps: block, then where it goes (Undo takes it back)
  if ((g.phase === 'combat' || g.phase === 'btCombat') && area != null && fightable().includes(area)) { selArea = selArea === area ? null : area; selUnit = null; previewArea = null; return refresh(); }
  const uu = unit ? g.units.find((x) => x.id === unit) : null;
  if (uu && seen(uu) && (mine(uu.side) || !['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase))) { selUnit = unit!; selArea = uu.area; if (innerWidth < 700 && uu.area != null) lookAt(uu.area); }      // phones: the block's panel covers the lower map, so bring the block into view else { selArea = area; selUnit = null; }
  previewArea = null; hoverArea = null; refresh();
}
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || !selUnit || g.battle) return;
  const a = pick(e).area, h = a != null && optsFor(selUnit).some((o) => o.area === a) ? a : null;
  if (h !== hoverArea) { hoverArea = h; if (previewArea == null) refresh(); }
});

const route = new THREE.Group(); scene.add(route);
/* ---------- routes on the map: movement arrows by kind of move, the supply lifeline (docs/design/route-style-v2.png) ---------- */
function pathPts(path: number[]) { const raw = path.map((a) => { const c = center(a); return new THREE.Vector3(c.x, 0, c.z); }); if (raw.length === 2) raw.splice(1, 0, raw[0].clone().lerp(raw[1], 0.5).add(new THREE.Vector3(0.6, 0, -0.6))); return new THREE.CatmullRomCurve3(raw, false, 'centripetal', 0.5).getSpacedPoints(Math.max(40, path.length * 30)); }
/** A flat band along the points; width and colour/alpha change along the way (t = 0 at the tail, 1 at the head). */
function band(pts: THREE.Vector3[], w: (t: number) => number, col: (t: number) => [number, number, number, number], y: number, order: number) {
  const pos: number[] = [], cl: number[] = [], idx: number[] = [];
  pts.forEach((p, i) => { const t = i / (pts.length - 1), a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = new THREE.Vector3().subVectors(b, a).setY(0).normalize(), n = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(w(t) / 2), c = col(t);
    pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z); cl.push(...c, ...c); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k, k - 1, k + 1); } });
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4)); g2.setIndex(idx);
  const m = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = order; return m;
}
function quad(v: THREE.Vector3[], c: [number, number, number, number], y: number, order: number) {
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(v.flatMap((p) => [p.x, y, p.z]), 3)); g2.setIndex(v.length === 4 ? [0, 1, 3, 1, 2, 3] : [0, 1, 2]);
  const m = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: c[3], depthTest: false, side: THREE.DoubleSide })); m.renderOrder = order; return m;
}
const rgb = (h: number, a = 1): [number, number, number, number] => { const c = new THREE.Color(h); return [c.r, c.g, c.b, a]; };
type MoveKind = 'normal' | 'fuel' | 'minimum' | 'blown' | 'strat';
const MOVE_COL: Record<MoveKind, [number, number]> = { normal: [0x8fc46a, 0x2c4419], fuel: [0xe7b04a, 0x5a3f08], minimum: [0xc9ccd2, 0x3a3d44], blown: [0xd1432f, 0x5c0f0a], strat: [0xddd7b5, 0x3a3826] };      // green = a normal move, brass = it burns fuel, steel = minimum move, red = across a blown bridge, paper = strategic
/** Movement: a tapered operations arrow with a soft shadow, a dark rim, a light core and a notched head; the tail fades in. */
function moveArrow(path: number[], kind: MoveKind, blownAt = -1) {
  const pts = pathPts(path), [main, rim] = MOVE_COL[kind], n = pts.length, hl = Math.min(n - 2, 14), body = pts.slice(0, n - hl + 2), tip = pts[n - 1], base = pts[n - hl], d = new THREE.Vector3().subVectors(tip, base).setY(0).normalize(), nn = new THREE.Vector3(-d.z, 0, d.x);
  const W = (t: number) => 0.32 + t * 0.5, fade = (t: number) => Math.min(1, 0.15 + t * 2.2), sh = new THREE.Vector3(0.18, 0, 0.26);
  route.add(band(body.map((p) => p.clone().add(sh)), (t) => W(t) + 0.35, (t) => [0, 0, 0, 0.28 * fade(t)], 0.04, 7));
  route.add(band(body, (t) => W(t) + 0.26, (t) => rgb(rim, 0.95 * fade(t)), 0.05, 8));
  route.add(band(body, W, (t) => rgb(main, fade(t)), 0.06, 9));
  route.add(band(body, (t) => W(t) * 0.28, (t) => [1, 1, 1, 0.35 * fade(t)], 0.07, 10));
  const hw = 1.25, notch = base.clone().addScaledVector(d, 0.45), o3 = (v: THREE.Vector3, o: number) => v.clone().add(new THREE.Vector3(o, 0, o));
  const H = (o: number, grow: number, c: [number, number, number, number], y: number, ord: number) => route.add(quad([o3(tip.clone().addScaledVector(d, grow), o), o3(base.clone().addScaledVector(nn, hw + grow), o), o3(notch, o), o3(base.clone().addScaledVector(nn, -hw - grow), o)], c, y, ord));
  H(0.2, 0.2, [0, 0, 0, 0.28], 0.04, 7); H(0, 0.16, rgb(rim, 0.95), 0.05, 8); H(0, 0, rgb(main, 1), 0.06, 9);
  if (kind === 'blown' && blownAt >= 0) {                                             // a white break where the arrow crosses the blown bridge
    const k = Math.min(n - 2, Math.round((blownAt + 0.5) / (path.length - 1) * (n - 1))), mid = pts[k], dd = new THREE.Vector3().subVectors(pts[k + 1], mid).setY(0).normalize(), m2 = new THREE.Vector3(-dd.z, 0, dd.x);
    for (const s2 of [-1, 1]) route.add(quad([mid.clone().addScaledVector(dd, s2 * 0.25).addScaledVector(m2, 0.9), mid.clone().addScaledVector(dd, s2 * 0.45).addScaledVector(m2, 0.9), mid.clone().addScaledVector(dd, s2 * 0.45).addScaledVector(m2, -0.9), mid.clone().addScaledVector(dd, s2 * 0.25).addScaledVector(m2, -0.9)], [1, 1, 1, 0.95], 0.08, 11));
  }
}
/** Supply: a calm dotted lifeline, beads at even steps, a ring on every area it passes and a glowing source. */
function supplyLine(path: number[]) {
  const pts = pathPts(path), blue = 0xddd7b5, deep = 0x2a2a1c;      // supply: a paper-coloured lifeline (blue is for rivers only)
  const disc = (x: number, z: number, r1: number, r2: number, c: [number, number, number, number], y: number, o: number) => { const m = new THREE.Mesh(r1 ? new THREE.RingGeometry(r1, r2, 40) : new THREE.CircleGeometry(r2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: c[3], depthTest: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = o; route.add(m); };
  route.add(band(pts, () => 0.5, () => rgb(blue, 0.14), 0.04, 7));
  for (let i = 0; i < pts.length; i += 6) { disc(pts[i].x, pts[i].z, 0, 0.2, rgb(deep, 0.9), 0.05, 8); disc(pts[i].x, pts[i].z, 0, 0.13, rgb(blue, 1), 0.06, 9); }
  path.forEach((a, i) => { const c = center(a);
    if (i === path.length - 1) { disc(c.x, c.z, 0, 1.25, rgb(blue, 0.18), 0.045, 7); disc(c.x, c.z, 0.78, 0.98, rgb(deep, 0.9), 0.05, 8); disc(c.x, c.z, 0.82, 0.94, rgb(blue, 1), 0.06, 9); disc(c.x, c.z, 0, 0.34, rgb(blue, 1), 0.06, 9); }
    else if (i) { disc(c.x, c.z, 0.36, 0.5, rgb(deep, 0.9), 0.05, 8); disc(c.x, c.z, 0.39, 0.47, rgb(blue, 1), 0.06, 9); } });
}
function drawRoute() {
  disposeAll(route); if (!selUnit || g.battle) return;
  const u = g.units.find((x) => x.id === selUnit); if (!u || u.area == null) return;
  const to = previewArea ?? hoverArea;
  if (to == null) { const p = seen(u) && !u.garrison ? E.supplyPath(g, u.side, u.area) : null; if (p && p.length > 1) supplyLine(p); return; }   // no destination chosen: the way the block traces supply (9.3)
  const o = optsFor(selUnit).find((x) => x.area === to); if (!o) return;
  const path = o.path.length ? o.path : [u.area, to], bk = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`), bi = path.findIndex((a, i) => i > 0 && g.blown.includes(bk(path[i - 1], a)));
  const kind: MoveKind = g.phase === 'strategic' ? 'strat' : bi > 0 ? 'blown' : o.fuel && u.side === 'german' && g.opts.fuel ? 'fuel' : (u.unsupplied || u.disorder || u.adjOnly) && path.length === 2 ? 'minimum' : 'normal';
  moveArrow(path, kind, bi - 1);
  const fk = `${selUnit}>${previewArea}`;
  if (previewArea != null && innerWidth < 700 && fk !== framedRoute) {                            // phones: the whole route in view, above the one-line ticket
    framedRoute = fk; const pts = path.map(center), x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), z0 = Math.min(...pts.map((p) => p.z)), z1 = Math.max(...pts.map((p) => p.z));
    const span = Math.max(x1 - x0, (z1 - z0) * 1.3, 8), c = viewRot() ? -1 : 1;
    goal = { t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2 + c * span * 0.34), dist: clampDist(span * 2.5 + 10), pitch };
  }
}
let framedRoute = '';
type Badge = { area: number; text: string; cls: string; key?: string };
const coveredLabels = new Set<number>();
let badges: Badge[] = [];
function badgeList(): Badge[] {
  const out: Badge[] = [];
  if (selUnit && !g.battle) { const u = g.units.find((x) => x.id === selUnit)!; for (const o of optsFor(selUnit)) out.push({ area: o.area, text: g.phase === 'strategic' ? '' : `${o.cost}`, cls: o.mustStop ? 'stop' : o.fuel && u.side === 'german' ? 'fuel' : 'ok' }); }
  for (const o of arrOpts()) if (o.sa) out.push({ area: o.area, text: 'SA', cls: 'stop' });              // plain entry areas are lit; only the ones that cost a Special Action are marked
  if (g.battle?.stage === 'retreat') for (const a of E.retreatOptions(g, g.battle)) out.push({ area: a, text: 'Retreat', cls: 'ok' });
  if (!g.battle && (g.phase === 'combat' || g.phase === 'btCombat') && allowed()) { const must = new Set(E.mustFight(g)); for (const a of fightable()) out.push({ area: a, text: must.has(a) ? 'Must fight' : 'May fight', cls: must.has(a) ? 'war' : 'opt' }); }
  if (!g.battle && layers.numbers) for (const a of coveredLabels) out.push({ area: a, text: `${a} ${areaName(a)}`, cls: 'tint lab', key: `L${a}` });
  return out;
}
const badgeEls = new Map<string, HTMLElement>();
function syncBadges() {
  const layer = $('#badges'); layer.innerHTML = ''; badgeEls.clear();
  for (const b of badges) { const d = document.createElement('div'); d.className = 'bdg ' + b.cls; d.textContent = b.text; layer.appendChild(d); badgeEls.set(b.key ?? String(b.area), d); }
}
/** Focus on the battle. The whole table is drawn blurred and dimmed by the browser; a second canvas draws the contested area again, sharp, with its pieces (so nothing inside is cut),
 *  and the area's exact edge glows. */
const canvas2 = document.getElementById('gl2') as HTMLCanvasElement;
let renderer2: THREE.WebGLRenderer | null = null, focusMesh: THREE.Mesh | null = null, focusFor = -1;
function focusGeometry(id: number) {
  const poly = MAP.areas.find((a) => a.id === id)!.polygon, shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x / S - MW / (2 * S), -(y / S - MH / (2 * S))))), geo = new THREE.ShapeGeometry(shape), pos = geo.getAttribute('position'), uv: number[] = [];
  for (let k = 0; k < pos.count; k++) uv.push(((pos.getX(k) + MW / (2 * S)) * S) / MW, 1 - ((-pos.getY(k) + MH / (2 * S)) * S) / MH);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return geo;
}
const inPoly = (x: number, z: number, pts: THREE.Vector3[]) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].z > z) !== (pts[j].z > z) && x < ((pts[j].x - pts[i].x) * (z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) c = !c; } return c; };
/** Second pass: only the battle area and what stands in it, on a transparent canvas laid over the blurred one. */
function renderFocus() {
  const b = g.battle, on = !!b && !reinforcing && b.stage !== 'retreat'; focusOn = on;              // choosing where to retreat needs the neighbouring areas sharp
  canvas.classList.toggle('blurred', on); canvas2.style.display = on ? 'block' : 'none';
  if (!on) return;
  if (!renderer2) { renderer2 = new THREE.WebGLRenderer({ canvas: canvas2, antialias: true, alpha: true }); renderer2.setPixelRatio(Math.min(2, devicePixelRatio)); }
  const r = canvas.getBoundingClientRect(); if (canvas2.width !== Math.round(r.width * renderer2.getPixelRatio()) || canvas2.height !== Math.round(r.height * renderer2.getPixelRatio())) renderer2.setSize(r.width, r.height, false);
  if (!focusMesh || focusFor !== b!.area) { if (focusMesh) { scene.remove(focusMesh); focusMesh.geometry.dispose(); (focusMesh.material as THREE.Material).dispose(); } focusMesh = new THREE.Mesh(focusGeometry(b!.area), new THREE.MeshStandardMaterial({ roughness: 0.9 })); focusMesh.rotation.x = -Math.PI / 2; focusMesh.position.y = 0.002; focusFor = b!.area; scene.add(focusMesh); }
  (focusMesh.material as THREE.MeshStandardMaterial).map = (board.material as THREE.MeshStandardMaterial).map; (focusMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  const poly = areaWorld(b!.area), hidden: THREE.Object3D[] = [], bg = scene.background;
  const hide = (o: THREE.Object3D) => { if (o.visible) { o.visible = false; hidden.push(o); } };
  hide(board); hide(table); hide(diorama); for (const l of labelsGrp.children) if (l.userData.area !== b!.area) hide(l); for (const [id, m] of overlays) if (id !== b!.area || show3d()) hide(m);         // the close-up is flat: a tint draped on the relief would float above it
  for (const grp of [pieces, markers]) for (const o of grp.children) { const a = o.userData.anchor ? pieces.children.find((x) => x.userData.unit === o.userData.anchor) : null, q = a ?? o, uid = (q.userData.unit ?? q.userData.anchor) as string | undefined, cid = q.userData.chit as string | undefined;
    const ofBattle = (uid && g.units.find((u) => u.id === uid)?.area === b!.area) || (cid && E.sidesOf(g).some((s) => b!.assets[s].includes(cid) || E.airOf(b!, s).some((a) => a.id === cid)));      // the battle formation may reach past the border: keep it sharp
    if (!ofBattle && !inPoly(q.position.x, q.position.z, poly)) hide(o); }      // a marker follows the piece it belongs to
  focusMesh.visible = true; scene.background = null; renderer2.render(scene, cam); scene.background = bg; focusMesh.visible = false; for (const o of hidden) o.visible = true;
}
function placeFocus() {
  const sv = document.getElementById('glow') as unknown as SVGSVGElement, b = g.battle;
  if (!b || reinforcing || b.stage === 'retreat') { sv.style.display = 'none'; return; }
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(), pts = areaWorld(b.area).map((q) => { v.set(q.x, 0.01, q.z).project(cam); return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height] as [number, number]; });
  sv.style.display = 'block'; sv.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); const pg = sv.firstElementChild!; pg.setAttribute('points', pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ')); pg.setAttribute('class', b.stage === 'setup' ? 'gl set' : 'gl fire');
}
/** Screen position and radius of a piece on the table (block or counter), or null when it is not drawn. */
function pieceScreen(id: string) {
  const o = pieces.children.find((x) => x.userData.unit === id || x.userData.chit === id); if (!o) return null;
  const r = canvas.getBoundingClientRect(), p = o.getWorldPosition(new THREE.Vector3()), a = p.clone().project(cam), b = p.clone().add(new THREE.Vector3(0.95, 0, 0)).project(cam);
  return { x: r.left + (a.x * 0.5 + 0.5) * r.width, y: r.top + (-a.y * 0.5 + 0.5) * r.height, rad: Math.max(14, Math.abs(b.x - a.x) * 0.5 * r.width) };
}
/** The leader-line layer: thin lines from a bubble to the blocks it is about, with a dashed ring on each. */
const leaders = (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.id = 'leaders'; document.body.appendChild(s); return s; })();
let leaderLast = '';                                                                                    // the lines are rewritten only when they change
const leaderSvg = (bx: number, by: number, pts: { x: number; y: number; rad: number }[], cls: string) => pts.map((p) => { const ang = Math.atan2(by - p.y, bx - p.x), ex = p.x + Math.cos(ang) * p.rad, ey = p.y + Math.sin(ang) * p.rad, mx = bx + (bx < p.x ? 18 : -18);
  return `<path class="ln ${cls}" d="M${bx.toFixed(1)} ${by.toFixed(1)} H${mx.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle class="rg ${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.rad.toFixed(1)}"/><circle class="dt ${cls}" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5"/>`; }).join('');
/** Decisions made on the table: a small bubble just off the battle area, never over its pieces, with a line to each block it is about. */
function placeBubbles() {
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(); let svg = '';
  document.querySelectorAll<HTMLElement>('#ui .mapbubble').forEach((e) => {
    const a = +e.dataset.area!, pts = areaWorld(a).map((q) => { v.set(q.x, 0, q.z).project(cam); return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height }; });
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)), cy = pts.reduce((t, p) => t + p.y, 0) / pts.length, w = e.offsetWidth || 160, h = e.offsetHeight || 44;
    const fitsR = maxX + 28 + w < r.width - 8, fitsL = minX - 28 - w > 8, below = !fitsR && !fitsL, maxY = Math.max(...pts.map((p) => p.y));       // phones: no room beside the area, so the bubble goes under it
    const right = fitsR || !fitsL, x = below ? Math.max(8, Math.min(r.width - w - 8, (minX + maxX) / 2 - w / 2)) : right ? Math.min(r.width - w - 8, maxX + 28) : Math.max(8, minX - 28 - w), y = below ? Math.min(r.height - h - 70, maxY + 18) : Math.min(r.height - h - 70, Math.max(60, cy - h / 2));
    const pr = (e.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? r; e.style.transform = `translate(${x + r.left - pr.left}px, ${y + r.top - pr.top}px)`;          // the bubble lives in the stage, the lines over the canvas
    const tg = (e.dataset.tg ?? '').split(',').filter(Boolean).map(pieceScreen).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ x: p.x - r.left, y: p.y - r.top, rad: p.rad }));
    svg += below ? leaderSvg(x + w / 2, y, tg, 'gold') : leaderSvg(right ? x : x + w, y + h / 2, tg, 'gold');
  });
  if (svg !== leaderLast) { leaders.innerHTML = svg; leaderLast = svg; } leaders.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); leaders.style.left = r.left + 'px'; leaders.style.top = r.top + 'px'; leaders.style.width = r.width + 'px'; leaders.style.height = r.height + 'px';
}
/** The first loss of a failed attack (6.41a) is chosen on the table: the point unit or one battle asset lights up. */
function decisionTargets(): Tgt | null {
  const b = g.battle; if (!b || b.stage !== 'attFirst' || !allowed()) return null;
  const t: Tgt = { units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: '' };
  t.units.set(b.attPoint, () => E.chooseFirstLoss(g, g.battle!, b.attPoint));
  for (const id of b.assets[b.attacker].filter((x) => E.isBattleAsset(E.chit(g, x)))) t.units.set(id, () => E.chooseFirstLoss(g, g.battle!, id));
  return t;
}
/** The choice the battle is waiting for, as a bubble over the deciding side's row. */
function decisionBubble(): string {
  const b = g.battle;
  if (!b && !g.over && !rollView && allowed() && (g.phase === 'combat' || g.phase === 'btCombat') && selArea != null && fightable().includes(selArea)) { const p = primary(); if (p) return `<div class="mapbubble fighttag" data-area="${selArea}" data-tg=""><button class="primary" data-do="${reg(p.fn)}">${ico('burst')} Fight here</button></div>`; } if (!b || rollView || !['attChoice', 'defChoice', 'attFirst'].includes(b.stage)) return '';
  const who = b.stage === 'defChoice' ? other(b.attacker) : b.attacker;
  const tg = b.stage === 'attFirst' ? [b.attPoint, ...b.assets[b.attacker].filter((x) => E.isBattleAsset(E.chit(g, x)))] : E.unitsIn(g, b.area, who).map((u) => u.id).concat(b.assets[who].filter((x) => E.isBattleAsset(E.chit(g, x))));
  const at = `data-area="${b.area}" data-tg="${tg.join(',')}"`;                                       // placed off the area by placeBubbles, with a line to each block it is about
  if (!allowed()) return `<div class="mapbubble wait" ${at}><b>${nm(who)} decides…</b></div>`;
  if (b.stage === 'attFirst') return `<div class="mapbubble" ${at}><b>${b.pending} hit${b.pending > 1 ? 's' : ''}</b><span>Tap the point unit or an asset to take the first loss</span></div>`;
  if (b.stage === 'attChoice') return `<div class="mapbubble" ${at}><b class="hits" title="${b.pending} hit${b.pending > 1 ? 's' : ''}">${b.pending}<small>hit${b.pending > 1 ? 's' : ''}</small></b><div class="row">${btn(`${ico('back')}<span>Abort</span>`, () => E.attackerChoice(g, g.battle!, true), 'ab', false, 'Abort: all attackers disordered, no losses')}${btn(`${ico('xbold')}<span>Take losses</span>`, () => E.attackerChoice(g, g.battle!, false), 'ab', false, 'Continue and take the step losses')}</div></div>`;
  if (b.stage !== 'defChoice') return '';
  const arty = b.pendingKind === 'arty';
  return `<div class="mapbubble" ${at}><b class="hits" title="${b.pending} hit${b.pending > 1 ? 's' : ''}">${b.pending}<small>hit${b.pending > 1 ? 's' : ''}</small></b><div class="row">${btn(`${ico('xbold')}<span>Take losses</span>`, () => E.defenderChoice(g, g.battle!, false), 'ab', false, 'Stand and take the step losses')}${btn(`${ico(arty ? 'disorder' : 'back')}<span>${arty ? 'Disorder' : 'Retreat'}</span>`, () => E.defenderChoice(g, g.battle!, true), 'ab', false, arty ? 'Disorder all defenders to absorb 1 hit' : 'Retreat (absorbs 1 hit, units disordered)')}</div></div>`;
}
/** Who can move now: a green arrow over every block that has somewhere to go; the side's other blocks get a grey dash. Hidden once a block is picked or a battle opens. */
let moveMarks: { el: HTMLElement; unit: string }[] = [];
/** Other things a block can do this step: build field works (4.33-style fortify) or take a reserve marker. */
const fwOk = (u: E.Unit) => ['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved && u.area != null && !u.unsupplied && !u.disorder && !E.contested(g, u.area) && !g.fieldWorks.includes(u.area) && ((g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || !!u.exploit)));
const rsOk = (u: E.Unit) => g.phase === 'movement' && u.side === g.phasing && E.canReserve(g, u);
function syncMoveMarks() {
  const layer = document.getElementById('marks')!; layer.innerHTML = ''; moveMarks = [];
  const actor = g.phase === 'reaction' ? other(g.phasing) : g.phasing;
  if (g.over || g.battle || g.pendingBlow || selUnit || !['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase) || !allowed() || !mine(actor)) return;
  for (const u of g.units.filter((x) => x.side === actor && x.area != null && !x.garrison && seen(x))) {
    let can = false; if (!u.moved) { try { can = (g.phase === 'strategic' ? (u.reserve ? E.stratOptions(g, u.id).length : 0) : E.moveOptions(g, u.id).length) > 0; } catch { can = false; } }
    const fw = fwOk(u), rs = rsOk(u), el = document.createElement('div'); el.className = 'mm ' + (can ? 'go' : 'no'); el.innerHTML = ico(can ? 'back' : 'minus') + (fw ? '<i class="mmx fw" title="Can fortify"></i>' : '') + (rs ? '<i class="mmx rs" title="Can go in reserve"></i>' : ''); el.title = can ? `${u.name} can move` : `${u.name} cannot move`; layer.appendChild(el); moveMarks.push({ el, unit: u.id });
  }
}
/* ---------- option tags on the map: what a Special Action buys, which battles are free (docs/playtest3 mockups) ---------- */
let optTags: { el: HTMLElement; unit?: string; area?: number }[] = [];
const btArmor = () => (g.phase === 'btMove' && !g.battle && allowed() && mine(g.phasing) && E.saAvailable(g, g.phasing).length ? g.units.filter((u) => u.side === g.phasing && u.area != null && u.cls === 'armor' && !u.exploit && !u.moved && (() => { try { E.activateBreakthrough(structuredClone(g), u.id); return true; } catch { return false; } })()).map((u) => u.id) : []);
function syncTags() {
  const layer = document.getElementById('marks')!; optTags.forEach((t) => t.el.remove()); optTags = [];
  const add = (text: string, cls: string, at: { unit?: string; area?: number }) => { const el = document.createElement('div'); el.className = 'otag ' + cls; el.textContent = text; layer.appendChild(el); optTags.push({ el, ...at }); };
  if (g.over || g.pendingBlow) return;
  if (!selUnit) for (const id of btArmor()) add('SA · 1 AREA', 'sa', { unit: id });
  if (g.phase === 'btCombat' && !g.battle && allowed() && mine(g.phasing)) {
    const nw = new Set(E.newlyContested(g)), sa = E.saAvailable(g, g.phasing).length > 0;
    for (const a of E.contestedAreas(g).filter((x) => !g.fought.includes(x))) add(nw.has(a) ? 'FIGHT' : sa ? 'NEEDS SA' : 'NEEDS SA · NONE LEFT', nw.has(a) ? 'fight' : sa ? 'sa' : 'off', { area: a });
  }
  if (selArr) for (const o of arrOpts()) if (o.sa) add('SA', 'sa', { area: o.area });
}
function placeTags() {
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  for (const t of optTags) { let p: THREE.Vector3 | null = null; if (t.unit) { const o = pieces.children.find((x) => x.userData.unit === t.unit); if (o) p = new THREE.Vector3(o.position.x, 3.2, o.position.z); } else if (t.area != null) { const c = center(t.area); p = new THREE.Vector3(c.x, 0.5, c.z); }
    if (!p) { t.el.style.display = 'none'; continue; } v.copy(p).project(cam); t.el.style.display = v.z < 1 ? '' : 'none'; const hw = (t.el.offsetWidth || 60) / 2 + 4, px = Math.min(r.width - hw, Math.max(hw, (v.x * 0.5 + 0.5) * r.width)); t.el.style.transform = `translate(${px}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`; }      // tags stay on screen
}
function placeMoveMarks() {
  placeTags();
  if (!moveMarks.length) return;
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  for (const m of moveMarks) { const o = pieces.children.find((x) => x.userData.unit === m.unit); if (!o) { m.el.style.display = 'none'; continue; } v.set(o.position.x, 2.3, o.position.z).project(cam); m.el.style.display = v.z < 1 ? '' : 'none'; m.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`; }
}
function placeBadges() {
  placeMoveMarks();
  { const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(); fxLayer.place((area, unit) => { const ps = unit ? pieceScreen(unit) : null, c = center(area); v.set(c.x, 0, c.z).project(cam); const cx = r.left + (v.x * 0.5 + 0.5) * r.width, cy = r.top + (-v.y * 0.5 + 0.5) * r.height; return ps ? { x: ps.x, y: ps.y, cx, cy, rad: ps.rad, visible: true } : { x: cx, y: cy - 30, cx: cx - 1, cy, rad: 0, visible: v.z < 1 }; }); }
  placeFocus(); placeBubbles();
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  for (const [k, d] of badgeEls) { const id = +k.replace(/^L/, ''), p = d.classList.contains('lab') ? toWorld(LAB[id].x, LAB[id].y) : d.classList.contains('tint') ? toWorld(LAB[id].x, LAB[id].y + LAB[id].h / 2 + 40) : center(id); if (d.classList.contains('lab')) v.set(p.x, show3d() ? REL!.h(p.x, p.z) + 0.6 : 0.6, p.z).project(cam); else v.set(p.x, 2.2, p.z - 4).project(cam);      /* a label tag sits on its own area, not shifted like the move badges */ d.style.display = v.z < 1 ? '' : 'none'; d.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`; }
}

/* ---------- battle state shared with the view ---------- */
interface RollView { remote?: boolean; morale?: boolean; check?: boolean; title: string; groups: (DiceGroup & { parts: [string, number][]; hits: number })[]; pos: { x: number; y: number; group: number; v: number }[] | null }
let menuTab = 'Players';
let rollView: RollView | null = null, modal: 'menu' | 'boxes' | 'rules' | 'layers' | null = null, handSide: E.Side | null = null;
const STAGE_NAME: Record<string, string> = { exploit: 'Exploitation morale check', attArty: 'artillery', defArty: 'artillery', defFire: 'Defensive fire', offFire: 'Offensive fire' };
function rollStage(b: E.Battle) {
  if (!allowed()) return say(notYou());
  const side = b.stage === 'attArty' || b.stage === 'offFire' || b.stage === 'exploit' ? b.attacker : other(b.attacker), kind = b.stage.endsWith('Arty') ? 'arty' : 'ground', fl = b.stage === 'exploit' ? [] : E.fireList(g, b, side, kind), n0 = b.rolls.length, stage = b.stage;
  const next = structuredClone(g), before = snap(g); E.roll_step(next, next.battle!); rollFx = []; noteFx(before, next, true); rollNoted = true;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage off */ } void push(next);          // the result is stored at once; the board shows it when the dice land
  const fresh = next.battle!.rolls.slice(n0); heldNext = next;
  rollView = { morale: stage === 'exploit', title: `${nm(side)} ${STAGE_NAME[stage]}`, pos: null, groups: fresh.map((r) => ({ label: r.who, col: r.kind === 'arty' ? 's' : first(side) ? 'k' : 'w', sn: r.sn, dice: r.dice, hits: r.hits, parts: fl.find((f) => f.who === r.who)?.parts ?? [] })) };
  if (!rollView.groups.length) { rollView = null; commitRoll(); return; }
  refresh();
  const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => { if (rollView) { const rv = rollView; rv.pos = p; render(); afterDice(rv); } });          // the result clears by itself; a tap on it skips the wait
}
/** A roll is shown on the board as it was; when the dice land the result is applied: blocks that lose a step turn, what is removed fades. */
let heldNext: E.Game | null = null;
const anims: { t0: number; dur: number; fn: (k: number) => void; end?: () => void }[] = [];
const fades = new THREE.Group(); scene.add(fades);
function commitRoll() {
  const next = heldNext; if (!next) return; heldNext = null;
  const prev = g, gone = new Set<string>();
  for (const u of prev.units) { const n = next.units.find((x) => x.id === u.id); if (u.area != null && n && n.area == null) gone.add('u:' + u.id); }
  for (const c of prev.chits) { const n = next.chits.find((x) => x.id === c.id); if (c.box === 'map' && n && n.box !== 'map') gone.add('c:' + c.id); }
  for (const a of prev.fieldWorks) if (!next.fieldWorks.includes(a)) gone.add('m:FW:' + a);
  const keyOf = (o: THREE.Object3D) => o.userData.unit ? 'u:' + o.userData.unit : o.userData.chit ? 'c:' + o.userData.chit : o.userData.mark ? 'm:' + o.userData.mark : '';
  for (const o of [...pieces.children, ...markers.children]) if (gone.has(keyOf(o))) {          // a copy of what goes away, faded out over the new board
    const cl = o.clone(true); cl.traverse((x) => { const m = x as THREE.Mesh; if (!m.material) return; m.material = ([] as THREE.Material[]).concat(m.material).map((mt) => { const c = mt.clone(); c.transparent = true; return c; }) as never; });
    fades.add(cl); const mats: THREE.Material[] = []; cl.traverse((x) => { const m = x as THREE.Mesh; if (m.material) mats.push(...([] as THREE.Material[]).concat(m.material)); });
    anims.push({ t0: performance.now(), dur: 900, fn: (k) => { mats.forEach((mt) => { mt.opacity = 1 - k; }); cl.position.y += 0.004; }, end: () => { fades.remove(cl); mats.forEach((mt) => mt.dispose()); } });
  }
  const turned = next.units.filter((u) => { const o = prev.units.find((x) => x.id === u.id); return o && u.area != null && u.str < o.str; }).map((u) => u.id);
  g = next; save(); refresh();
  for (const id of turned) anims.push({ t0: performance.now(), dur: 700, fn: (k) => { const m = pieces.children.find((o) => o.userData.unit === id); if (m) m.rotation.y = viewRot() + (1 - (1 - (1 - k) ** 3)) * Math.PI / 2; } });   // the block turns to its new strength
}
function runAnims() {
  const now = performance.now();
  for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i], k = Math.min(1, (now - a.t0) / a.dur); a.fn(k); if (k >= 1) { a.end?.(); anims.splice(i, 1); } }
}
/** Morale checks outside a battle (supply, Greif interdict): the camera goes to the unit and the dice are thrown on screen with PASS or FAIL. */
function showChecks(cs: E.Check[]) {
  if (!cs.length || rollView) return;
  const a = cs.find((c) => c.area != null)?.area; if (a != null) { const p = center(a); goal = { t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, 30), pitch }; }
  rollView = { check: true, morale: true, title: cs[0].why.replace(/ \(.*\)$/, ''), pos: null, groups: cs.map((c) => ({ label: c.who, col: 'w', sn: c.sn, dice: [c.die], hits: c.ok ? 1 : 0, parts: [] })) };
  refresh(); const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => { if (rollView) { const rv = rollView; rv.pos = p; render(); setTimeout(() => { if (rollView === rv) { hideDice(); render(); setTimeout(() => { if (rollView === rv) endRoll(); }, 2600); } }, 1300); } });
}
/** After the dice settle: a moment to read them, then they leave and the results play on the board (turning blocks, fading pieces, pop-ups). */
function afterDice(rv: RollView) {
  setTimeout(() => {
    if (rollView !== rv) return;
    hideDice(); commitRoll(); showFx(pendingFx); pendingFx = []; render();
    if (rv.remote || (autoRoll && !rv.check)) setTimeout(() => { if (rollView === rv) endRoll(); }, rv.remote ? 3200 : 2600);           // results move on by themselves (a hit choice or retreat then waits on the table); with auto off, your roll waits for Continue
  }, 1100);
}
function hideDice() { clearDice(); const cv = $('#dice') as HTMLElement | null; if (cv) cv.style.display = 'none'; }
function endRoll() { commitRoll(); rollView = null; clearDice(); ($('#dice') as HTMLElement).style.display = 'none'; refresh(); }

/* ---------- cards and drag and drop ---------- */

const chitUri = new Map<string, string>();
const chitImg = (c: E.Chit) => { let u = chitUri.get(c.id); if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(VOL.chitSvg(c)); chitUri.set(c.id, u); } return u; };
/** Can this chit be played right now (its phase, its targets)? Cards that can glow; worked out once per game change. */
let liveKey = '', liveSet = new Set<string>();
function usableNow(c: E.Chit): boolean {
  const k = `${g.turn}${g.phasing}${g.phase}${g.log.length}${g.battle?.stage}${online.devSeat}`; if (k !== liveKey) { liveKey = k; liveSet = new Set(); const b = g.battle;
    for (const x of g.chits) { if (x.box !== 'available' || !mine(x.side)) continue;
      let ok = false;
      if (b) ok = b.stage === 'setup' && VOL.battleCard(x) && !VOL.battleUse(g, b, x);
      else if (g.phase === 'admin') { const t = VOL.targetsFor(() => g, x, { area: null, mode: '', setArea: () => {}, setMode: () => {}, face: (u) => unitPic(u), areaName }); ok = !!t && (t.units.size + t.areas.size + t.pick.size + t.chips.length + t.modes.length + t.buttons.length > 0 || !!t.any); }
      else if (x.kind === 'sa_block' || x.kind === 'special_action_event') ok = g.phase === 'btMove' || g.phase === 'btCombat';
      else if (x.kind === 'air_mission') ok = VOL.id === 'bulge' && g.phase === 'supply' && E.airSupplyAreas(g, x.side).length > 0;
      if (ok) liveSet.add(x.id); } }
  return liveSet.has(c.id);
}
const card = (c: E.Chit, r = 0, why: string | null = null) => `<div tabindex="0" role="button" class="card2 ${c.side} ${c.kind === 'sa_block' ? 'wood' : ''} ${why ? 'bad' : usableNow(c) ? 'live' : ''} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" style="--r:${r}deg" title="${esc(why ?? c.name + ' · ' + c.ech)}" aria-label="${esc(c.name)}">${chitPic(c)}</div>`;
/** How much neighbouring cards overlap so the whole hand fits: each card keeps at least 34 px (46 on phones) visible, and the hand scrolls when even that does not fit. */
const overlapFor = (n: number) => { const cw = innerWidth >= 900 ? 72 : 62, avail = innerWidth - 40, visible = n > 1 ? Math.min(cw, Math.max(innerWidth < 900 ? 46 : 34, (avail - cw) / (n - 1))) : cw; return n > 1 ? Math.round(cw - visible) : 0; };
const handStyle = (n: number) => `style="--ov:${overlapFor(n)}px"`;
const fan = (cs: string[]) => cs.map((h, i) => h.replace('--r:0deg', `--r:${((i - (cs.length - 1) / 2) * Math.min(5, 40 / cs.length)).toFixed(1)}deg`)).join('');
/** Place every asset that may legally join, artillery first, for both sides. */
function autoFill(b: E.Battle) {
  const order = (c: E.Chit) => (E.isArty(c) ? 0 : c.kind === 'engineer' ? 2 : 1);
  for (const c of g.chits.filter((x) => x.box === 'available' && (E.isArty(x) || E.isBattleAsset(x)) && mine(x.side)).sort((x, y) => order(x) - order(y))) { if (!E.canAssign(g, b, c.side, c)) E.assign(g, b, c.id); }
}
/** Where an event or asset chit can be played on the map (Admin Phase): the areas to light while it is dragged. */
/** Where a dragged chit may be dropped: exactly the areas it can be used in (its zone, its rules), from the same dry runs as a tap. */
function chitTargets(c: E.Chit): number[] {
  if (g.phase !== 'admin' || c.box !== 'available' || !mine(c.side)) return [];
  const t = VOL.targetsFor(() => g, c, { area: null, mode: '', setArea: () => {}, setMode: () => {}, face: (u) => unitPic(u), areaName });
  if (!t) return [];
  const out = new Set<number>([...t.areas.keys(), ...t.pick.keys()]);
  for (const id of t.units.keys()) { const a = g.units.find((x) => x.id === id)?.area; if (a != null) out.add(a); }
  return [...out];
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
    const why = VOL.battleUse(g, b, c); if (why) { refusal = `${c.name}: ${why}`; return render(); } refusal = '';
    if (!E.isArty(c) && !E.isBattleAsset(c) && c.kind !== 'air_mission') return act(() => { VOL.playInBattle(g, b, c); });      // a combat event of the volume
    if (c.kind === 'air_mission') { airPick = { id, side: c.side, step: 'choose' }; return render(); }
    return act(() => E.assign(g, b, id));
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
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); ghost?.remove(); over?.classList.remove('over'); document.querySelectorAll('.slot.legal').forEach((sl) => sl.classList.remove('legal'));
    const b = g.battle;
    if (!b && dragTargets.length) {                                                                    // an event or asset dropped on the map
      const cands = dragTargets; dragTargets = [];
      if (ghost && document.elementFromPoint(e.clientX, e.clientY) === canvas) { const area = pick(e).area; if (area != null && cands.includes(area)) return playChitOn(c, area); say('That chit cannot be played there'); }
      refresh(); return;
    }
    if (b?.stage === 'setup' && handInfo && !ghost) { handInspect = handInspect === id ? null : id; render(); return; }
    if (!b || b.stage !== 'setup') { if (!ghost) { selChit = selChit === id ? null : id; refresh(); } return; }
    const s = c.side;
    if (ghost && document.elementFromPoint(e.clientX, e.clientY) === canvas) {                                // dropped on the table: the card joins the battle
      const { unit: du, area } = pick(e); if (area !== b.area) return say('Drop it on the battle area.');
      if (!mine(s)) return say('Those are the other player\'s assets.');
      const why = VOL.battleUse(g, b, c); if (why) { refusal = `${c.name}: ${why}`; return render(); } refusal = '';
      return act(() => { if (VOL.playInBattle(g, b, c)) return; if (c.kind === 'air_mission') { const t = du ? g.units.find((x) => x.id === du) : null; if (t && t.side === s && t.area === b.area) E.assign(g, b, id, 'support', du!); else E.assign(g, b, id, 'arty'); } else E.assign(g, b, id); });
    }
    const z = ghost ? at(e) as HTMLElement | undefined : undefined;
    let zone = z?.dataset.zone, unit = z?.dataset.unit;
    if (!ghost && c.kind === 'air_mission') { if (!mine(s)) return say('Those are the other player\'s assets.'); const why0 = VOL.battleUse(g, b, c); if (why0) return say(why0); airPick = { id, side: s, step: 'choose' }; return render(); }      // a tap asks which use
    if (!ghost) zone = E.isArty(c) ? 'arty' : 'asset';               // a plain click files the card where it belongs
    if (!zone && !unit) return;
    const why = VOL.battleUse(g, b, c) ?? (z?.dataset.side && z.dataset.side !== s ? 'That slot belongs to the other side' : null) ?? (zone === 'arty' && c.kind === 'engineer' ? 'Engineers go in the Assets slot' : zone === 'asset' && (E.isArty(c)) ? 'Artillery goes in the Artillery slot' : null);
    if (!mine(s)) return say('Those are the other player\'s assets.');
    if (why) { refusal = `${c.name}: ${why}`; return render(); } refusal = '';
    act(() => { if (VOL.playInBattle(g, b, c)) return; if (c.kind === 'air_mission') { if (unit) E.assign(g, b, id, 'support', unit); else E.assign(g, b, id, 'arty'); } else E.assign(g, b, id); });
  };
  const cancel = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); dragTargets = []; refresh(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel, { once: true });
}

/* ---------- views ---------- */
function topBar() {
  const tr = (g.track ?? E.VOLUME.track)[g.turn - 1], i = first(g.phasing) ? 0 : 1, pAt = PHASE_OF[g.phase], phaseLabel = g.phase === 'deploy' ? 'Set-up' : PHASES[pAt];
  return `<div class="c-bar t"><button class="ico" data-modal="menu" title="Menu, log and new game" aria-label="Menu, log and new game">${ico('menu')}</button><div class="c-crumbs">${PHASES.map((s, k) => `<span class="${k === pAt ? 'on' : k < pAt ? 'done' : ''}" title="${k + 1}. ${s}">${s}</span>`).join('')}</div>
    <div class="c-stat"><span class="tp" title="Turn ${g.turn}, ${nm(g.phasing)} player turn">T${g.turn} · <b class="${g.phasing}">${nm(g.phasing).toUpperCase()}</b><i class="ph"> · ${phaseLabel.toUpperCase()} <small>${pAt + 1}/8</small></i></span>${online.active && online.mode === 'remote' ? `<span class="syncdot ${/NOT SAVED/.test(online.sync) ? 'bad' : /saving|connecting/.test(online.sync) ? 'wait' : 'ok'}" title="${esc(online.sync)}" aria-label="${esc(online.sync)}"></span>` : ''}${online.active ? `<span>YOU<b class="${online.mySide() ?? ''}">${online.both() ? 'BOTH' : (online.mySide() ?? 'WATCHING').toUpperCase()}</b></span>` : ''}${online.devSwitch() ? `<button class="ico dev" data-seat title="Developer: switch seat (${nm(P1)}, ${nm(P2)}, both, watching)" aria-label="Switch seat">${ico('swap')}<span class="bl">Seat</span></button>` : ''}${g.phase === 'admin' || g.phase === 'reinforcement' ? `<span title="Chits drawn this turn (${nm(P1)} / ${nm(P2)})">DRAW<b>${tr.ge[i]}/${tr.al[i]}</b></span>` : ''}${chatBtn()}<button class="ico ${tint !== 'off' ? 'on' : ''}" data-tint title="View: map layers, colours, reset the camera" aria-label="View">${ico('eye')}<span class="bl">View</span></button><button class="ico" data-modal="boxes" title="Pieces: boxes, arrivals" aria-label="Pieces">${ico('boxes')}<span class="bl">Pieces</span></button></div></div>`;
}
const COARSE = matchMedia('(pointer: coarse)').matches;
/** The verb matches the device: tap on touch screens, click with a mouse. */
const verb = (h: string) => (COARSE ? h : h.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click'));
function prompt() {
  const chip = online.active && !online.both() && online.mySide() && !g.over ? `<span class="turnchip ${allowed() ? 'tc-go' : 'tc-wait'}">${nm(online.mySide()!)} · ${allowed() ? 'your move' : 'waiting'}</span> ` : '';
  return chip + verb(promptText());
}
/** Explanations: full for learning, short for experienced players (Menu > Settings, or the guide button in the bottom bar). `gx` = explanation only, `gs` = short form only. */
let guide: 'full' | 'short' = (() => { try { return localStorage.getItem('fab-guide') === 'full' ? 'full' : 'short'; } catch { return 'short'; } })();
const setGuide = (v: 'full' | 'short') => { guide = v; try { localStorage.setItem('fab-guide', v); } catch { /* private mode */ } document.body.classList.toggle('guide-short', v === 'short'); };
document.body.classList.toggle('guide-short', guide === 'short');
const gx = (long: string, short = '') => `${short ? `<span class="gs">${short}</span>` : ''}<span class="gx">${long}</span>`;
/** Before a roll: who fires, how many dice, what they need, at whom. */
function stakes(b: E.Battle) {
  const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker), fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground');
  if (!fl.length) return 'Nothing can fire.';
  const dice = fl.reduce((a, f) => a + f.dice, 0), sns = [...new Set(fl.map((f) => f.sn))].sort((x, y) => x - y);
  return `<b>${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}:</b> ${dice} ${dice === 1 ? 'die' : 'dice'} · hit on ${sns.length === 1 ? `${sns[0]} or less` : `${sns[0]}–${sns.at(-1)} or less`}${gx(` · at ${E.unitsIn(g, b.area, other(sd)).length} ${nm(other(sd))} block${E.unitsIn(g, b.area, other(sd)).length === 1 ? '' : 's'}`)}`;
}
function promptText() {
  const b = g.battle;
  if (rollView?.pos) return gx('<b>Read the dice:</b> green hits, salmon misses. Then continue.', '<b>Read the dice,</b> then continue.');
  if (areaPick) return `<b>${esc(areaPick.label)}</b>, or tap elsewhere to cancel.`;
  if (reinforcing && b) return '<b>Tap a glowing neighbouring block</b> to bring it in, or tap the map to cancel.';
  if (airPick?.step === 'unit' && b) return '<b>Air Mission +2:</b> tap one of your blocks in the battle.';
  if (online.active && !allowed() && !g.over) return online.mySide() == null ? '<b>Watching.</b> Take a seat in the menu.' : `<b>Waiting for the ${nm(actorNow() as E.Side)} player…</b>`;
  if (g.over) return `<b>${esc(g.over)}</b> <button data-ui="${reg(() => { endHidden = false; })}">Result</button>`;
  if (g.pendingBlow) return `<b>${nm(other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side))}</b>: attempt to blow the bridge?`;
  if (b?.stage === 'retreat') return '<b>Choose the retreat area.</b>';
  if (b && b.stage === 'setup' && b.ready?.length === 2) return '<b>Both ready.</b> Blocks are revealed…';
  if (b) return b.stage === 'setup' ? (() => { const me = online.mySide(), rd = (sd: E.Side) => b.ready?.includes(sd); return online.active && !online.both() && me ? `<b>${rd(me) ? 'You are ready.' : 'Tap an asset to add it, then press Ready.'}</b> Opponent: ${rd(other(me)) ? 'ready' : 'preparing'}.` : `<b>Tap a card to add it.</b>${gx(' Tap a block to make it the point unit.')}`; })() : b.stage === 'done' ? '' : rollView ? '' : b.stage.endsWith('Choice') ? 'Choose how to take the hits.' : STAGE_NAME[b.stage] ? stakes(b) : '';
  const m = E.mustFight(g).length;
  switch (g.phase) {
    case 'deploy': return '<b>Set-up:</b> pick a block in the tray, then a lit area.';
    case 'reinforcement': return '<b>Pick a new block</b>, then a lit entry area.';
    case 'admin': return selChit && tgt?.hint ? `<b>${esc(tgt.hint)}</b>${tgt.areas.size + tgt.units.size > 0 ? ` · ${tgt.areas.size + tgt.units.size} lit` : ''}` : `<b>Tap a card</b>${gx(' to play it, or end the step.')}`;
    case 'movement': return selUnit ? `Tap a <b>green</b> area${gx(' to move there. <b>Brass</b>: must stop there. Wrong move? <b>Undo</b>.', ' · <b>brass</b> = stop')}` : `<b>Tap one of your blocks</b>${gx(' to move it, or <b>Can move</b> to go through them.', ' to move it.')}`;
    case 'strategic': return '<b>Tap a reserve block</b>, then a green area.';
    case 'combat': case 'btCombat': if (g.phase === 'btCombat' && !m && E.contestedAreas(g).some((a) => !g.fought.includes(a) && !E.newlyContested(g).includes(a))) return gx('<b>Breakthrough combat.</b> Newly contested areas are free; areas already contested before movement need a Special Action (brass tags).', '<b>Breakthrough combat:</b> orange = needs SA');
      return m ? `<b>${m} battle${m > 1 ? 's' : ''} to fight.</b> Tap a red area.` : fightable().length ? '<b>Tap a contested area</b> to fight, or end the step.' : 'No battles left.';
    case 'reaction': return `<b>${nm(other(g.phasing))} reserves</b> may react: select a reserve block.`;
    case 'btMove': return btArmor().length ? gx('<b>Breakthrough movement.</b> Reserve and exploiting blocks may move; armor that has not moved can move one area for a Special Action (brass tags).', '<b>Breakthrough:</b> orange = SA move') : `<b>Reserve and exploitation blocks</b> may move.${gx(' Select one.')}`;
    default: return g.phase === 'supply' && g.supplyPending ? `<b>Supply check</b>${gx(': roll for the units that are cut off.')}` : 'Supply checked. End the phase.';
  }
}
function primary(): { label: string; fn: () => void; dis?: boolean } | null {
  const b = g.battle;
  if (rollView?.pos && !rollView.remote) return { label: 'Continue', fn: () => endRoll() };          // the dice have landed: one clear step on, the report stays readable until then
  if (g.over || g.pendingBlow || rollView) return null;
  if (g.phase === 'supply' && g.supplyPending && !b && mine(g.phasing)) { const n = E.supplyChecks(g).length; return { label: n ? `Roll ${n} supply check${n > 1 ? 's' : ''}` : 'Continue', fn: () => act(() => E.rollSupply(g)) }; }      // the one red button is the next thing to do
  if (b) {
    if (b.stage === 'setup') {
      const solo = !online.active || online.both(), me = online.mySide();
      if (solo) { const why = VOL.blocksBegin(g); return { label: why ? 'Begin combat' : 'Begin combat', fn: () => (why ? say(why) : act(() => E.beginCombat(g, g.battle!))), dis: !!why }; }
      if (!me) return null;
      const on = b.ready?.includes(me);
      return { label: on ? 'Waiting… tap to undo' : 'Ready', fn: () => act(() => { if (g.battle) E.setReady(g, g.battle, me, !on); }), dis: !on && !!VOL.blocksBegin(g) };   // the live battle: a remote write may have replaced the one this button was drawn for
    }
    if (b.stage === 'done') return { label: 'Close battle', fn: () => act(() => { E.closeBattle(g); selArea = null; }) };
    if (b.stage.endsWith('Choice') || b.stage === 'retreat' || b.stage === 'attFirst') return null;
    return { label: `Roll ${STAGE_NAME[b.stage].toLowerCase()}`, fn: () => rollStage(g.battle!) };
  }
  const must = E.mustFight(g);
  if (g.phase === 'combat' || g.phase === 'btCombat') {                                              // the player picks the battle and starts it; nothing opens by itself
    const sel = selArea != null && fightable().includes(selArea) ? selArea : null;
    if (sel != null) return { label: `Fight ${areaName(sel)}`, fn: () => { selUnit = null; battleFx = []; rollFx = []; if (g.phase === 'btCombat' && !E.newlyContested(g).includes(sel)) pickSA(g.phasing, undefined, (sa) => E.startBattle(g, sel, true, sa)); else E.startBattle(g, sel, g.phase === 'btCombat'); } };
    if (must.length) return null;                                                                     // the prompt says: tap a red area
  }
  if (online.active && !online.both() && (g.phase === 'admin' || g.phase === 'reinforcement')) {            // both sides work in these steps: the other side says it is done, the Phasing Player ends the step
    const me = online.mySide(); if (!me) return null;
    if (me !== g.phasing) { const on = !!g.done?.includes(me); return { label: on ? 'Done · tap to undo' : 'Done', fn: () => act(() => E.setDone(g, me, !on)) }; }
    const wait = !g.done?.includes(other(me));
    if (wait && SANDBOX && SBU.st.sbHot) return { label: `Pass to ${nm(other(me))}`, fn: () => SBU.hotPass(other(me)) };
    return { label: wait ? `Waiting for ${nm(other(me))}` : endLabel(), fn: () => act(() => { E.endPhase(g); selUnit = null; previewArea = null; selChit = null; selArea = null; }), dis: wait || !!g.recover.length || !!g.artyPick };
  }
  return { label: endLabel(), fn: () => act(() => { E.endPhase(g); selUnit = null; previewArea = null; selChit = null; selArea = null; }), dis: !!E.mustFight(g).length || !!g.recover.length || !!g.artyPick || (g.phase === 'supply' && !!g.supplyPending) || (g.phase === 'deploy' && VOL.pendingPlace(g).some((id) => mine(g.units.find((u) => u.id === id)!.side))) };
}
/* ---------- the actions dock: shortcuts with counts, labelled undo ---------- */
const lookAt = (a: number) => { const p = center(a); goal = { t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, 30), pitch }; };
let canMoveKey = '', canMoveIds: string[] = [];
/** My blocks that can still move in this step (cached until the game changes). */
function canMove(): string[] {
  const k = `${g.turn}${g.phase}${g.phasing}${g.log.length}${hist.length}${online.devSeat}`; if (k === canMoveKey) return canMoveIds; canMoveKey = k;
  canMoveIds = ['movement', 'reaction', 'btMove'].includes(g.phase) ? g.units.filter((u) => u.area != null && !u.moved && !u.garrison && mine(u.side) && E.moveOptions(g, u.id).length).map((u) => u.id) : [];
  return canMoveIds;
}
/** The next item after the current one, round and round. */
const nextOf = <T,>(list: T[], cur: T | null) => list[(list.indexOf(cur as T) + 1) % list.length];
/** Ending a step while blocks can still move takes a second press: the button first says how many are left (a stray tap or Enter never ends a phase). */
let endArmed = false, endArmT = 0, autoRoll = (() => { try { return localStorage.getItem('fab-autoroll') !== '0'; } catch { return true; } })();
function guardEnd(p: { label: string; fn: () => void }) {
  if (!p.label.startsWith('End') || !canMove().length || endArmed) return () => { endArmed = false; clearTimeout(endArmT); p.fn(); };
  return () => { endArmed = true; render(); clearTimeout(endArmT); endArmT = window.setTimeout(() => { endArmed = false; render(); }, 4000); };
}
/* ---------- the map from the keyboard: Tab onto the map, arrows between neighbouring areas, Enter selects or moves, N the next block that can move ---------- */
let kbArea: number | null = null;
const NEXT = new Map<number, number[]>(); for (const c of MAP.connections) { NEXT.set(c.a, [...(NEXT.get(c.a) ?? []), c.b]); NEXT.set(c.b, [...(NEXT.get(c.b) ?? []), c.a]); }
function screenOf(a: number) { const p = center(a), r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, show3d() ? REL!.h(p.x, p.z) : 0, p.z).project(cam); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }
function kbStep(dx: number, dy: number) {
  const from = kbArea ?? previewArea ?? selArea ?? (selUnit ? g.units.find((u) => u.id === selUnit)?.area ?? null : null);
  if (from == null) { const r = canvas.getBoundingClientRect(); let best = 1e9; for (const a of MAP.areas) { const s = screenOf(a.id), d = Math.hypot(s.x - r.left - r.width / 2, s.y - r.top - r.height / 2); if (d < best) { best = d; kbArea = a.id; } } }
  else { const o = screenOf(from); let best = 0.35, pick2: number | null = null;
    for (const n of NEXT.get(from) ?? []) { const s = screenOf(n), vx = s.x - o.x, vy = s.y - o.y, l = Math.hypot(vx, vy) || 1, dot = (vx * dx + vy * dy) / l; if (dot > best) { best = dot; pick2 = n; } }
    if (pick2 == null) return; kbArea = pick2; }
  hoverArea = selUnit && optsFor(selUnit).some((o) => o.area === kbArea) ? kbArea : null;
  const s = screenOf(kbArea!), r = canvas.getBoundingClientRect(); if (s.x < r.left + 60 || s.x > r.right - 60 || s.y < r.top + 60 || s.y > r.bottom - 60) lookAt(kbArea!);
  say(`${areaName(kbArea!)} [${kbArea}]`, true); refresh();
}
function kbEnter() { if (kbArea == null) return; const a = MAP.areas.find((x) => x.id === kbArea)!, w = toWorld(LAB[a.id]?.px ?? a.label[0], LAB[a.id]?.py ?? a.label[1]), r = canvas.getBoundingClientRect(), v = new THREE.Vector3(w.x, show3d() ? REL!.h(w.x, w.z) : 0, w.z + 0.6).project(cam);
  click({ clientX: r.left + (v.x * 0.5 + 0.5) * r.width, clientY: r.top + (-v.y * 0.5 + 0.5) * r.height } as PointerEvent); }
function dockChips(): string {
  if (g.over || !allowed()) return '';
  const out: string[] = [], c = (label: string, n: number | null, hot: boolean, fn: (() => void) | null, title = '') => out.push(`<button class="dchip ${hot ? 'hot' : ''}" ${fn ? `data-ui="${reg(fn)}"` : 'disabled'} title="${esc(title || label)}">${esc(label)}${n != null ? `<b>${n}</b>` : ''}</button>`);
  if (g.battle) return '';
  if (g.phase === 'admin' || g.phase === 'reinforcement') {
    const live = g.chits.filter((x) => x.box === 'available' && mine(x.side) && usableNow(x));
    if (live.length) c('Playable chits', live.length, true, () => { selChit = nextOf(live.map((x) => x.id), selChit); }, 'Tap to pick the next chit that can be played now');
    if (g.recover.length) c('Recover an asset', null, true, null, 'Choose the asset to bring back (shown above)');
    if (g.artyPick) c('Artillery attrition', 1, true, null, 'Choose the used artillery asset to eliminate (16.12)');
    if (online.active && !online.both()) { const o = other(online.mySide() ?? g.phasing); c(`${nm(o)}: ${g.done?.includes(o) ? 'done ✓' : 'working…'}`, null, false, null); }
  }
  { const bt = btArmor(); if (bt.length) c('Breakthrough (SA)', bt.length, true, () => { selUnit = nextOf(bt, selUnit); const u = g.units.find((x) => x.id === selUnit)!; selArea = u.area; previewArea = null; lookAt(u.area!); }, '8.21: armor that has not moved may move one area for a Special Action'); }
  const mv = canMove();
  if (mv.length) c('Can move', mv.length, true, () => { selUnit = nextOf(mv, selUnit); const u = g.units.find((x) => x.id === selUnit)!; selArea = u.area; previewArea = null; lookAt(u.area!); }, 'Tap to select the next block that can still move');
  { const mineU = g.units.filter((u) => u.area != null && mine(u.side) && seen(u)), fw = mineU.filter(fwOk).map((u) => u.id), rs = mineU.filter(rsOk).map((u) => u.id);
    const pick = (ids: string[]) => () => { selUnit = nextOf(ids, selUnit); const u = g.units.find((x) => x.id === selUnit)!; selArea = u.area; previewArea = null; lookAt(u.area!); };
    if (fw.length) c('Fortify', fw.length, false, pick(fw), 'Blocks that can build field works (gold dot): tap to go through them');
    if (rs.length) c('Reserve', rs.length, false, pick(rs), 'Blocks that can take a reserve marker (blue dot): tap to go through them'); }
  if (g.phase === 'combat' || g.phase === 'btCombat') {
    const must = E.mustFight(g), all = fightable();
    if (must.length) c('Must fight', must.length, true, () => { selArea = nextOf(must, selArea); lookAt(selArea!); });
    else if (all.length) c('Battles', all.length, false, () => { selArea = nextOf(all, selArea); lookAt(selArea!); });
  }
  if (g.phase === 'btMove' || g.phase === 'btCombat') { const n = E.saAvailable(g, g.phasing).length; if (n && mine(g.phasing)) c('Special Actions', n, false, null, 'Special Actions you can spend now'); }
  if (VOL.id === 'bulge' && g.phase === 'supply' && g.supplyPending && mine(g.phasing) && !g.airSupply && E.boxOf(g, g.phasing, 'available').some((x) => x.kind === 'air_mission') && E.airSupplyAreas(g, g.phasing).length) c('Air supply available', null, true, null, '17.21: an Air Mission can supply one cut-off area (in the Supply check panel)');
  return out.length ? `<div class="dchips">${out.join('')}</div>` : '';
}
function undoBtn(): string {
  if (!allowed() || g.over) return '';
  const can = hist.length > 0, txt = can ? `Undo: ${hist.label || 'last action'}` : hist.lock ? `Locked: ${hist.lock}` : '';
  if (!txt) return `<button class="dundo idle" disabled aria-hidden="true" tabindex="-1">${ico('undo')}<span></span></button>`;      // always in place, so nothing shifts
  return `<button class="dundo" ${can ? `data-undo` : 'disabled'} title="${esc(can ? txt + ' (Ctrl+Z)' : 'Undo is locked once dice are rolled or something hidden is shown')}">${ico(can ? 'undo' : 'lock')}<span>${esc(txt)}</span></button>`;
}
const recoverSel: Record<string, string | null> = {};
let piecesTab: 'boxes' | 'arrivals' = 'boxes', piecesSide: E.Side | null = null, inspectId: string | null = null;
/** A short reading of what a chit does, in the series' own vocabulary; the printed rule is the authority. */

/** A chit's picture; the reusable Special Action is a wooden block (8.1), drawn like the arriving blocks. */
/** Every piece is drawn the same way everywhere: blocks (and the reusable Special Action) as 3D wooden blocks, chits, garrisons and Task Forces as cardboard counters. */
const chitPic = (c: E.Chit) => (c.kind === 'sa_block' ? b3(chitImg(c), c.side) : `<img class="cb" alt="" draggable="false" src="${chitImg(c)}">`);
const unitPic = (u: E.Unit) => (u.garrison ? `<img class="cb" alt="" draggable="false" src="${unitFace(u)}">` : b3(unitFace(u), sideOfUnit(u)));
const pieceBtn = (c: E.Chit, f: () => void, on = false, dis = false) => `<button class="pc ${c.side} ${on ? 'on' : ''} ${c.box === 'available' && usableNow(c) ? 'live' : ''}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(c.name)}" aria-label="${esc(chitLabel(c))}">${chitPic(c)}</button>`;
const ruleCard = (c: E.Chit) => { const [t] = RULE[VOL.ruleKey(c.kind)] ?? [c.kind, '']; return `<span class="big">${chitPic(c)}</span><div><h4>${esc(c.name)} <small>${esc(t)}</small></h4>${ruleHtml(VOL.ruleKey(c.kind), E.isEvent(c))}</div>`; };
const seatedView = () => online.active && !online.both() && !!online.mySide();
function piecesHtml() {
  const sd = piecesSide ?? viewSide(), tabs = chip('Boxes', piecesTab === 'boxes', () => { piecesTab = 'boxes'; inspectId = null; }, 'Pieces in the boxes', 'boxes') + chip('Arrivals', piecesTab === 'arrivals', () => { piecesTab = 'arrivals'; inspectId = null; }, 'Arrivals by turn', 'calendar') + '<span class="sp"></span>' + [...VOL.sides].sort((x, y) => +(y === viewSide()) - +(x === viewSide())).map((x) => chip(VOL.tag[x], sd === x, () => { piecesSide = x; inspectId = null; }, seatedView() ? (x === viewSide() ? 'My pieces' : 'Opponent\'s pieces') : nm(x) + ' pieces')).join('');
  let body = '';
  if (piecesTab === 'boxes') {
    const sec = (title: string, bx: E.Chit['box']) => { const cs = E.boxOf(g, sd, bx); return `<h4>${title} <small>${cs.length}</small></h4><div class="pcgrid">${cs.map((c) => pieceBtn(c, () => { inspectId = inspectId === c.id ? null : c.id; }, inspectId === c.id)).join('') || '<small class="none">none</small>'}</div>`; };
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    body = `${pick ? `<div class="inspect">${ruleCard(pick)}</div>` : '<p class="hint gx">Tap a piece to read what it does.</p>'}<h4>Cup <small>${E.boxOf(g, sd, 'cup').length} chits, drawn at random</small></h4>${sec('Available', 'available')}${sec('Used', 'used')}${sec('Eliminated', 'eliminated')}${(() => { const dead = g.units.filter((u) => u.side === sd && u.area == null && u.str <= 0 && !u.garrison && (u.arrival == null || u.arrival <= g.turn) && seen(u)); return dead.length ? `<h4>Eliminated blocks <small>${dead.length}${dead.some((u) => g.elimLarge.includes(u.id)) ? ` · ${dead.filter((u) => g.elimLarge.includes(u.id)).length} large (+1 VP each to the other side)` : ''}</small></h4><div class="oobrow">${dead.map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic({ ...u, str: u.max })}<small>${esc(u.name)}</small></div>`).join('')}</div>` : ''; })()}${(() => { const held = g.units.filter((u) => u.side === sd && u.area == null && u.str > 0 && u.box && seen(u)), boxes = [...new Set(held.map((u) => u.box!))];      // the volume's holding boxes (Golan: reserves, the air assault battalion, evacuated strongpoints)
      return boxes.map((bx) => `<h4>${esc(VOL.boxes[bx] ?? bx)} <small>${held.filter((u) => u.box === bx).length}</small></h4><div class="oobrow">${held.filter((u) => u.box === bx).map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic(u)}<small>${esc(u.name)}</small></div>`).join('')}</div>`).join(''); })()}`;
  } else {
    const rows: string[] = [];
    for (let t = 1; t <= g.lastTurn; t++) {
      const us = g.units.filter((u) => u.side === sd && u.arrival === t), cs = g.chits.filter((c) => c.side === sd && c.turn === t);
      if (!us.length && !cs.length) continue;
      rows.push(`<div class="oob ${t === g.turn ? 'now' : t < g.turn ? 'past' : ''}"><h4>Turn ${t}${t === g.turn ? ' · now' : ''}</h4><div class="oobrow">${us.map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic(u)}<small>${esc(u.name)}</small><small class="en">${u.entry ? 'Entry ' + u.entry.join('/') : ''}</small></div>`).join('')}${cs.map((c) => pieceBtn(c, () => { inspectId = inspectId === c.id ? null : c.id; }, inspectId === c.id)).join('')}</div></div>`);
    }
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    body = `${g.opts.randomReinf ? '<p class="warnbox"><span><b>Random reinforcements (18.9):</b> units are drawn from those due this turn and next, so the actual turn may differ.</span></p>' : ''}${pick ? `<div class="inspect">${ruleCard(pick)}</div>` : ''}${rows.join('') || '<p class="hint">No more arrivals.</p>'}`;
  }
  return `<div class="modal"><div class="sheet wide"><h3>${seatedView() ? (sd === viewSide() ? 'My pieces' : 'Opponent\'s pieces') : nm(sd) + ' pieces'} <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3><div class="chips tabrow">${tabs}</div>${body}</div></div>`;
}
/** What the volume's own prompts may use: buttons, who is mine, an area pick on the map. */
const panelCtx = (): PanelCtx => ({ get: () => g, btn, ubtn, mine, areaName, ico, pickArea: (label, areas, run) => { areaPick = { label, areas: new Set(areas), run }; selUnit = selChit = selArr = null; refresh(); } });
function dispatch() {
  if (g.battle || g.over) return '';
  const row = (k: string, v: string, c = '') => `<div class="r"><span>${k}</span><b class="${c}">${v}</b></div>`;
  const c = selChit ? g.chits.find((x) => x.id === selChit) : null;
  if (c && g.phase === 'admin') return chitBar(c);
  if (g.phase === 'supply' && g.supplyPending && !rollView) {                                         // 9.4: who is cut off and what they need, then the roll
    const list = E.supplyChecks(g), own = mine(g.phasing), air = E.boxOf(g, g.phasing, 'available').filter((x) => x.kind === 'air_mission'), as = own && air.length && !g.airSupply ? E.airSupplyAreas(g, g.phasing) : [];
    const airRow = as.length ? `<div class="airsup"><b>${ico('air_mission')} Air supply (17.21)</b><span class="hint gx">Spend an Air Mission to supply one cut-off area until the next Supply Phase:</span><div class="row">${as.map((ar) => btn(esc(areaName(ar)), () => E.playAirSupply(g, air[0].id, ar))).join('')}</div></div>` : '';
    const rows = list.map(({ unit: x, sn, rounds }) => `<button class="supl" data-ui="${reg(() => { if (x.area != null) { const c2 = center(x.area); goal = { t: new THREE.Vector3(c2.x, 0, c2.z), dist: Math.min(dist, 30), pitch, fast: true }; } })}" title="Show on the map">${unitPic(x)}<span><b>${esc(x.name)}</b><small>${esc(areaName(x.area!))} · ${E.quality(x)}${x.disorder ? ' · disordered' : ''}${rounds > 1 ? ' · two checks (14.93)' : ''}</small></span><b class="sn">needs ${sn} or less</b></button>`).join('');
    return `<div class="c-dispatch supply"><h3 class="${g.phasing}">Supply check</h3><p class="hint gx">${list.length ? `9.4: each cut-off ${nm(g.phasing)} unit rolls morale. Fail: disordered; already disordered: a step loss (green 8+, veteran 10: surrenders).` : `Every ${nm(g.phasing)} unit is in supply.`}</p>${airRow}
      <div class="row">${own ? `<span class="hint">${list.length ? 'Roll with the red button below.' : 'Nobody is cut off.'}</span>` : `<span class="hint">Waiting for the ${nm(g.phasing)} player to roll.</span>`}</div><div class="suplist">${rows}</div></div>`;
  }
  if (g.phase === 'reinforcement' && g.artyPick) {                                                     // 16.12: the German player picks the artillery lost to attrition
    const cs = E.boxOf(g, 'german', 'used').filter((c) => c.kind === 'artillery'), own = mine('german');
    return `<div class="c-dispatch recover"><h3>German artillery attrition</h3><p class="hint">16.12: ${own ? 'choose' : 'the German player chooses'} one regular artillery asset (not rocket artillery) in the Used Box. It is eliminated; the rest of the Used Box goes back to the cup.</p>
      <div class="pcgrid">${cs.map((c) => pieceBtn(c, () => act(() => E.chooseArtyLoss(g, c.id)), false, !own)).join('')}</div></div>`;
  }
  if (g.phase === 'reinforcement' && g.recover.length) return `<div class="c-dispatch recover"><h3>Unused Special Action</h3><p class="hint gx">Each side may bring one asset back from the Used Box (4.1a).</p>${g.recover.map((sd) => {
    const cs = E.boxOf(g, sd, 'used').filter((c) => E.isAsset(c)), pick = recoverSel[sd] ? cs.find((c) => c.id === recoverSel[sd]) : null, own = mine(sd);
    return `<h4 class="${sd}">${nm(sd)}</h4><div class="pcgrid">${cs.map((c) => pieceBtn(c, () => { recoverSel[sd] = recoverSel[sd] === c.id ? null : c.id; }, recoverSel[sd] === c.id, !own)).join('') || '<small>Nothing in the Used Box</small>'}</div>
      <div class="row">${btn(pick ? `Bring back ${esc(pick.name)}` : 'Choose an asset', () => { E.recoverAsset(g, sd, pick!.id); recoverSel[sd] = null; }, 'primary', !pick || !own)}${btn('None', () => E.recoverAsset(g, sd, null), '', !own)}</div>
      ${pick ? `<details class="rdet"><summary><b>${esc(pick.name)}</b> · ${esc((RULE[VOL.ruleKey(pick.kind)] ?? [pick.kind])[0])} <span>What it does</span></summary>${ruleHtml(VOL.ruleKey(pick.kind), E.isEvent(pick))}</details>` : ''}`;
  }).join('')}</div>`;
  const u = selUnit ? g.units.find((x) => x.id === selUnit) : null;
  if (u) {
    const to = previewArea ?? hoverArea, o = to != null ? optsFor(u.id).find((x) => x.area === to) : null, n = fuelLeft(), strat = g.phase === 'strategic';
    const tags = [u.disorder === 1 ? 'disordered' : u.disorder === 2 ? 'recovering' : '', u.unsupplied ? 'unsupplied' : '', u.reserve ? 'reserve' : '', u.exploit ? 'exploit' : '', u.interdict ? 'interdicted' : ''].filter(Boolean);
    let route = '';
    const sp = u.area != null && !u.garrison ? E.supplyPath(g, u.side, u.area) : null, supLine = u.area == null || u.garrison ? '' : sp ? `<p class="hint sup ok gx">${ico('fuel')} In supply: ${sp.length > 1 ? `traces through ${sp.length - 1} area${sp.length > 2 ? 's' : ''} to ${esc(areaName(sp.at(-1)!))} (blue line)` : 'it stands on a supply source'}.</p>` : `<p class="hint sup bad">${ico('warn')} Out of supply. ${esc(E.supplyWhy(g, u.side, u.area))}</p>`;
    if (o) route = `<div class="route"><p class="tline"><b>→ ${esc(areaName(o.area))}</b> · ${strat ? 'strategic' : `${o.cost} MP`}${VOL.features.fuel && first(u.side) && g.opts.fuel && o.fuel ? ' · <span class="bad">fuel −1</span>' : ''}${o.mustStop ? ' · <span class="bad">stops: battle</span>' : ''}</p><h4>→ ${esc(areaName(o.area))}</h4>${strat ? row('Strategic move', 'any distance') : row('Movement', `${o.cost} MP`)}${VOL.features.fuel && first(u.side) && g.opts.fuel ? row('Fuel', o.fuel ? `−1 &nbsp;(${n} → ${n - 1})` : 'not needed', o.fuel ? 'bad' : '') : ''}${o.mustStop ? row('Stops here', 'enemy present, battle follows', 'bad') : ''}${btn('Move here', () => { previewArea = o.area; confirmMove(); }, 'primary')}</div>`;
    else if (optsFor(u.id).length) route = `<p class="hint gx">${optsFor(u.id).length} destination(s). Hover or click a highlighted area.</p>`;
    const can = ['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved;
    const fw = can && u.area != null && !u.unsupplied && !u.disorder && !E.contested(g, u.area) && !g.fieldWorks.includes(u.area) && ((g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit)));
    const noFuel = VOL.features.fuel && first(u.side) && g.opts.fuel && ['movement', 'strategic', 'btMove', 'reaction'].includes(g.phase) && mine(u.side) && !u.garrison && !E.boxOf(g, P1, 'available').some((x) => x.kind === 'fuel');
    const warns = (noFuel ? `<div class="warnbox">${ico('fuel')}<span><b>No fuel left</b>${gx('. German blocks may move at most 3 MP this turn and cannot use strategic movement (16.13).', ': 3 MP max, no strategic move.')}</span></div>` : '')
      + (u.interdict && mine(u.side) && ['movement', 'reaction', 'btMove', 'admin'].includes(g.phase) ? `<div class="warnbox bad">${ico('warn')}<span><b>Greif Interdict</b>${gx(' on this block. Moving it, building field works or taking a reserve marker triggers a morale check (+2). Fail: it may only stay or move one area (17.11).', ': moving triggers a morale check (+2).')}</span></div>` : '');
    return `<div class="c-dispatch ${o ? 'previewing' : ''}">${warns}<h3 class="${u.side}">${esc(u.name)}</h3><div class="pipsrow">${pips(u)} <small>${u.garrison ? 'asset' : u.cls} · ${tags.join(' · ') || 'in order'}</small></div>${seen(u) ? supLine : ''}${route}
      <div class="row">${g.phase === 'movement' && u.side === g.phasing ? (u.reserve ? btn('Remove reserve', () => E.setReserve(g, u.id, false)) : btn('Reserve', () => E.setReserve(g, u.id, true), '', !E.canReserve(g, u))) : ''}${fw ? btn('Fortify', () => VOL.fieldWorks(g, u.id)) : ''}${g.phase === 'btMove' && u.side === g.phasing && u.cls === 'armor' && !u.exploit && !u.reserve && !u.moved ? btn('Activate (SA)', () => pickSA(u.side, u.ech, (sa) => E.activateBreakthrough(g, u.id, sa)), '', !E.saAvailable(g, u.side, u.ech).length) : ''}${E.peiperCan(g, u) ? btn(`${u.peiperFull ? ico('check') : ''}KG Peiper: full move (18.3)`, () => E.setPeiperFull(g, u.id, !u.peiperFull), u.peiperFull ? 'primary' : '', false, 'Once per game, up to turn 3: this exploitation move uses Peiper\'s full movement allowance instead of one area') : ''}</div></div>`;
  }
  return '';
}
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** Fly the camera over the legal entry areas of the selected arriving block. */
function frameArrival() { const all = arrOpts(), o = all.some((x) => !x.sa) ? all.filter((x) => !x.sa) : all; if (selArr && o.length) { const pts = o.map((x) => center(x.area)), cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length, r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))); goal = { t: new THREE.Vector3(cx, 0, cz), dist: Math.min(innerWidth < 700 ? 52 : 70, Math.max(24, r * 2.3 + 10)), pitch: 1.15 }; } }
/** Drag an arriving block from the tray onto an entry area of the map. A click without moving still just selects it. */
function dragArrival(ev: PointerEvent, el: HTMLElement) {
  if (ev.button !== 0) return;
  const id = el.dataset.arr!, x0 = ev.clientX, y0 = ev.clientY; let ghost: HTMLElement | null = null;
  const mv = (e: PointerEvent) => {
    if (!ghost && ev.pointerType !== 'mouse' && Math.abs(e.clientX - x0) > 8 && Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0)) { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); return; }      // a sideways swipe scrolls the tray, it is not a drag
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { ghost = el.querySelector('.b3')!.cloneNode(true) as HTMLElement; ghost.classList.add('ghost'); document.body.appendChild(ghost); if (selArr !== id) { selArr = id; paintAreas(); badges = badgeList(); syncBadges(); frameArrival(); } }                 // no re-render here: replacing the dragged element would cut a touch drag short
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    if (!ghost) return; ghost.remove(); e.preventDefault(); const clean = () => { if (selArr === id) { selArr = null; refresh(); } };
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (top !== canvas && top?.closest('.dock, .c-bar, .c-dispatch, .modal, .legend')) { say('Drop it on a highlighted entry area of the map'); return clean(); }
    const area = pick(e).area; if (area == null || !arrOpts().some((o) => o.area === area)) { say('That is not a legal entry area for this block'); return clean(); }
    selArr = null; act(() => arrive(id, area));
  };
  const cancel = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel, { once: true });
}
/** A block drawn as a real 3D object (front label, right and top faces), for the tray and the battle view. */
const unitFace = (u: E.Unit) => svgUri(VOL.unitSvg(u, g));
const b3 = (face: string, side: E.Side | 'british', chit = false) => `<span class="b3 ${side} ${chit ? 'flat' : ''}" aria-hidden="true"><i class="f"><img alt="" draggable="false" src="${face}"></i><i class="r"></i><i class="t"></i></span>`;
const sideOfUnit = (u: E.Unit) => VOL.cssSide(u);
function tray() {
  const ids = g.phase === 'deploy' ? VOL.pendingPlace(g) : g.pendingArrivals, us = ids.map((id) => g.units.find((x) => x.id === id)!).filter((u) => mine(u.side)), tf = g.phase === 'deploy' ? [] : g.tfNew.map((id) => E.chit(g, id)).filter((c) => mine(c.side));
  if (!us.length && !tf.length) return '';
  return `<div class="arrtray" role="group" aria-label="${g.phase === 'deploy' ? 'Blocks to place' : 'Arriving reinforcements'}"><span class="why">${g.phase === 'deploy' ? 'Drag a block to a highlighted set-up area, or click it to see them.' : 'Drag a block to a highlighted entry area, or click it to see them.'}</span>${us.map((u) => `<button class="arr ${u.id === selArr ? 'sel' : ''}" data-arr="${u.id}" title="${esc(u.name)}">${b3(unitFace(u), sideOfUnit(u), !!u.garrison)}<small>${esc(u.name)}</small></button>`).join('')}${tf.map((c) => `<button class="arr ${c.id === selArr ? 'sel' : ''}" data-arr="${c.id}" title="Task Force">${b3(svgUri(garrisonChit('Task Force', `${c.turn}-*`, false)), 'allied', true)}<small>Task Force</small></button>`).join('')}</div>`;
}
/** One slim line above the hand: what the chosen card does and whether it can join, without covering the map. */
function cardTip() {
  const c = handInspect ? g.chits.find((x) => x.id === handInspect) : null, b = g.battle;
  if (!c || !b) return '<div class="cardtip"><span>Tap a card to read its rule.</span></div>';
  const [t, d] = RULE[VOL.ruleKey(c.kind)] ?? [c.kind, ''], why = VOL.battleUse(g, b, c);
  return `<div class="cardtip">${chitPic(c)}<div><b>${esc(c.name)} <small>${esc(t)}</small></b><span>${esc(d.split("\n")[0])}</span>${why ? `<em>Cannot join: ${esc(why)}</em>` : '<em class="ok">Can join this battle</em>'}</div></div>`;
}
function handCards() {
  const b = g.battle;
  if (!b && (g.phase === 'reinforcement' || g.phase === 'deploy')) return tray();
  if (b) {
    if (b.stage !== 'setup') return '';
    const cs = ([b.attacker, other(b.attacker)] as E.Side[]).filter(mine).sort().flatMap((s) => E.boxOf(g, s, 'available').filter((c) => VOL.battleCard(c)));
    const ok = cs.filter((c) => !VOL.battleUse(g, b, c));
    const bad = cs.filter((c) => VOL.battleUse(g, b, c));
    return `<div class="handtab">${mine(b.attacker) ? btn(`${ico('close')}<span class="bl">Cancel</span>`, () => { E.cancelBattle(g); }, 'ico danger', !!b.locked, b.locked ? 'A Special Action was spent, so the battle must be fought' : 'Withdraw the attack and return every assigned asset') : ''}<button class="ico ${handInfo ? 'on' : ''}" data-ui="${reg(() => { handInfo = !handInfo; if (!handInfo) handInspect = null; })}" aria-pressed="${handInfo}" title="Rules: tap a card to read what it does instead of adding it" aria-label="Rules">${ico('info')}</button>${ok.length ? btn(`${ico('wand')}<span class="bl">Auto-fill</span>`, () => autoFill(g.battle!), 'ico', false, 'Auto-fill: place every asset that can legally join, artillery first') : ''}</div>${handInfo ? cardTip() : ''}<div class="c-hand" ${handStyle(ok.length + bad.length)}>${fan([...ok.map((c) => card(c)), ...bad.map((c) => card(c, 0, VOL.battleUse(g, b, c)))])}</div>`;
  }
  if (g.phase !== 'admin') return '';
  const own = online.active && !online.both() ? online.mySide() : null, s = handSide ?? own ?? (g.battle && !mine(g.phasing) ? other(g.phasing) : g.phasing), cs = [...E.boxOf(g, s, 'available')].sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
  return `<div class="handtab"><button data-ui="${reg(() => { handSide = other(s); })}" class="${s}">${nm(s)} hand · ${cs.length} ${ico('swap')}</button></div><div class="c-hand" ${handStyle(cs.length)}>${fan(cs.map((c) => card(c)))}</div>`;
}
function stats(b: E.Battle, s: E.Side) {
  const ls = (['arty', 'ground'] as const).flatMap((k) => E.fireList(g, b, s, k)), pmf = E.hitPmf(ls.map((f) => ({ dice: f.dice, sn: f.sn })));
  return { mean: E.meanHits(pmf), p: (n: number) => Math.round(E.probAtLeast(pmf, n) * 100) };
}
function battleTable() {
  const b = g.battle; if (!b) return '';
  const L = E.areas.get(b.area)!, att = b.attacker, setup = b.stage === 'setup';
  const side = (s: E.Side) => {
    const us = E.unitsIn(g, b.area, s), lim = VOL.limits(g, b, s), ids = b.assets[s].map((id) => E.chit(g, id)), airs = E.airOf(b, s);
    const arty = ids.filter((c) => E.isArty(c)).length + airs.filter((a) => a.mode === 'arty').length, rest = ids.length - ids.filter((c) => E.isArty(c)).length;
    return `<div class="bside ${s} ${mine(s) ? 'mine' : 'theirs'}"><h4 title="${nm(s)} ${s === att ? 'attacking' : 'defending'}"><span class="tag">${VOL.tag[s]}</span>${ico(s === att ? 'next' : 'shield')}${online.active && !online.both() ? `<small>${mine(s) ? 'you' : 'foe'}</small>` : ''}</h4>
      <span class="chp" title="Artillery assigned">${ico('artillery')}${arty}/${lim.arty}<small>arty</small></span>${rest || setup ? `<span class="chp" title="Battle assets and events">${ico('armor_asset')}${rest}<small>assets</small></span>` : ''}
      </div>`;
  };
  const saRow = (() => { const s = other(att), us = E.unitsIn(g, b.area, s); if (!setup || !E.saAvailable(g, s).length) return ''; return `<div class="bsarow ${saOpen || reinforcing ? 'open' : ''}"><small class="gx">${nm(s)} Special Action</small>${ubtn(`${ico('plus')}<span>Special Action…</span>`, () => { saOpen = !saOpen; }, `satog ${saOpen ? 'on' : ''}`, !mine(s), 'Retreat before combat or bring in a neighbouring block (uses a Special Action)')}<span class="sabtns">${btn(`${ico('back')}<span class="bsa">Retreat (SA)</span>`, () => pickSA(s, us[0]?.ech, (sa) => E.defenderRetreatSA(g, g.battle!, sa)), 'ico', !mine(s) || !us.some((u) => !u.garrison), 'Retreat before combat (8.24): uses a Special Action; your units leave without disorder, garrisons stay; the attacker gets an exploitation chance')}${ubtn(`${ico('plus')}<span class="bsa">Reinforce (SA)</span>`, () => { reinforcing = !reinforcing; refresh(); }, `ico ${reinforcing ? 'on' : ''}`, !mine(s), 'Bring in a neighbouring block (uses a Special Action)')}</span></div>`; })();
  const covered = E.unitsIn(g, b.area).some((u) => !seen(u)), al = stats(b, P2), ge = stats(b, P1), tot = al.mean + ge.mean || 1;
  return `<div class="c-table slim ${rollView ? 'rolling' : ''}">${side(P2)}<div class="bmid"><div class="c-title">${g.fought.length + fightable().length > 1 ? `<small class="cnt" title="Battle ${g.fought.length + 1} of ${g.fought.length + fightable().length}">${Math.min(g.fought.length + 1, g.fought.length + fightable().length)}/${g.fought.length + fightable().length}</small>` : ''}${b.bt ? '<small class="cnt" title="Breakthrough combat">BT</small>' : ''}<b>${esc(L.name)}</b><span class="chp" title="Terrain defence number ${L.tdn}: attackers −${L.tdn} to hit">${ico('tree')}${L.tdn}</span>${g.fieldWorks.includes(b.area) ? `<span class="chp" title="Field works">${ico('gear')}</span>` : ''}${b.riverAssault ? `<span class="chp" title="River assault">${ico('wave')}</span>` : ''}</div>
    <div class="c-vs">${covered ? '<div class="big">?<span>:</span>?</div>' : `<div class="big" title="Expected hits per combat round: ${nm(P2)} : ${nm(P1)}"><small class="xs al">${VOL.tag[P2]}</small>${al.mean.toFixed(1)}<span>:</span>${ge.mean.toFixed(1)}<small class="xs ge">${VOL.tag[P1]}</small></div>${gx('<small class="xcap">expected hits per round</small>')}<div class="gauge"><i style="width:${(al.mean / tot) * 100}%"></i></div>`}</div></div>${side(P1)}${saRow}${setup ? engChoice(b) : ''}${setup && refusal ? `<div class="refuse">${ico('xbold')}<span><b>Not allowed:</b> ${esc(refusal)}</span></div>` : ''}</div>`;
}
/** 6.33: an attacking engineer in a battle with enemy field works either fires or removes them; two plain buttons, chosen at set-up (or before offensive fire). */
function engChoice(b: E.Battle): string {
  if (!b.assets[b.attacker].some((id) => E.chit(g, id).kind === 'engineer') || !g.fieldWorks.includes(b.area) || (g.fwOwner[b.area] ?? other(b.attacker)) === b.attacker || !['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage)) return '';
  const own = mine(b.attacker), pickB = (on: boolean, label: string) => `<button class="${b.engFw === on ? 'on' : ''}" ${own ? `data-do="${reg(() => E.setEngFw(g, g.battle!, on))}"` : 'disabled'} aria-pressed="${b.engFw === on}">${label}</button>`;
  return `<div class="engch"><b>Engineer (6.33)</b>${gx(' · the defenders sit in field works. If the engineer survives artillery and defensive fire, it can remove them just before your units fire (no −1 then), instead of firing itself. Choose before offensive fire:', ' vs FW:')}<div class="row">${pickB(false, gx('Fire with the ground units', 'Fire'))}${pickB(true, gx('Remove the field works', 'Remove FW'))}</div></div>`;
}
let refusal = '', saOpen = false;      // the last refused battle chit, shown in the set-up panel
/** Die faces as small tiles: green when the die succeeds against the Success Number (a 1 always does, a 10 never), salmon when it misses. */
const ok10 = (d: number, sn: number) => d === 1 || (d !== 10 && d <= sn);
const faces = (dice: number[], sn: number) => `<span class="faces">${dice.map((d) => `<i class="${ok10(d, sn) ? 'h' : 'm'}" title="${ok10(d, sn) ? 'hit' : 'miss'}" aria-label="${d}, ${ok10(d, sn) ? 'hit' : 'miss'}">${d}<s aria-hidden="true">${ico(ok10(d, sn) ? 'check' : 'close')}</s></i>`).join('')}</span>`;
/** Every roll of this battle so far, newest first: who rolled, against what, and the faces; it stays with the battle until it ends. */
function rollRecord(b: E.Battle, open = false) {
  if (!b.rolls.length) return '';
  const rows = [...b.rolls].reverse().map((r) => `<div class="rr"><span class="who">${esc(r.who)}</span><span class="sn">SN ${r.sn}</span>${faces(r.dice, r.sn)}<b class="${r.hits ? 'hit' : 'miss'}">${r.hits}${r.kind === 'morale' ? (r.hits ? ' pass' : ' fail') : ` hit${r.hits === 1 ? '' : 's'}`}</b></div>`).join('');
  return `<details class="rrec" ${open ? 'open' : ''}><summary>${ico('dice')} Dice so far <small>${b.rolls.length} roll${b.rolls.length === 1 ? '' : 's'}</small></summary>${rows}</details>`;
}
function ledger() {
  const b = g.battle; if ((!b || g.pendingBlow) && !rollView?.check) return '';
  if (rollView) {
    const rv = rollView, hits = rv.groups.reduce((a, x) => a + x.hits, 0);
    return `<div class="c-ledger tight" data-ui="${reg(() => { if (rollView?.pos) endRoll(); })}" title="Tap to continue"><div class="lh"><h3>${esc(rv.title)}</h3><b class="tot ${hits ? 'hit' : 'miss'}">${rv.pos ? rv.morale ? `${hits} of ${rv.groups.length} pass` : `${hits} hit${hits === 1 ? '' : 's'}` : '…'}</b></div>${rv.remote && !rv.pos ? `<p class="hint">${ico('dice')} The other player is rolling…</p>` : ''}${rv.pos ? rollFx.map(fxRow).join('') : ''}${rv.groups.map((x) => `<div class="ln2"><span class="who">${esc(x.label)}</span><span class="sn">SN ${x.sn}</span>${rv.pos ? faces(x.dice, x.sn) : `<span class="cnt">${x.dice.length}${ico('dice')}</span>`}<b class="${x.hits ? 'hit' : 'miss'}">${x.hits}</b>${x.parts.length ? `<span class="chips2">${modChips(x.parts)}</span>` : ''}</div>`).join('')}
      </div>`;
  }
  if (!b || g.pendingBlow) return '';
  if (b.stage === 'exploit') {                                                                         // 6.8: the attacker rolls a morale check for each armor-class unit, or declines
    const us = (b.exploitIds ?? []).map((id) => g.units.find((x) => x.id === id)!).filter((u) => u.area === b.area), mineStep = !online.active || online.both() || online.mySide() === b.attacker;
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${b.attacker}">Exploitation!</h3></div><p class="resline">${esc(b.result ?? '')}</p><p class="hint gx">6.8: each attacking armor-class unit makes a morale check. A pass marks it for exploitation: it may move again in the Breakthrough Phase.</p>
      ${us.map((u) => `<div class="fl"><span class="who">${esc(seen(u) ? u.name : 'Hidden block')}</span><span class="cnt">1${ico('dice')}</span><b class="sn">needs ${E.exploitSn(g, u)} or less</b></div>`).join('')}
      ${mineStep ? `<div class="row">${btn('Decline (stay hidden)', () => E.declineExploit(g, b), '', false, '6.8: you may decline the opportunity and keep the blocks hidden')}</div>` : `<p class="hint">Waiting for the ${nm(b.attacker)} player to roll.</p>`}</div>`;
  }
  if (b.stage === 'done') return `<div class="c-ledger tight aar"><div class="lh"><h3>Battle over · ${esc(areaName(b.area))}</h3></div><p class="resline">${esc(b.result ?? '')}</p>${battleFx.length ? `<div class="aarfx">${battleFx.map(fxRow).join('')}</div>` : '<p class="hint">No losses on either side.</p>'}${rollRecord(b, true)}</div>`;
  if (b.stage.endsWith('Choice')) { const sd = b.stage === 'attChoice' ? b.attacker : other(b.attacker);           // the bubble on the table holds the choice; the report keeps the dice that caused it
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${b.pending} hit${b.pending === 1 ? '' : 's'} to take</h3></div>${rollRecord(b, true)}</div>`; }
  if (b.stage === 'retreat' && b.retreat) return '';                                                    // the lit areas on the table are the choice
  if (STAGE_NAME[b.stage]) {                                                                           // fire step: who rolls, what, against which number and why
    const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker), fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground'), mineStep = !online.active || online.both() || online.mySide() === sd;
    const lines = fl.map((f) => `<div class="fl"><span class="who">${esc(f.who)}</span><span class="cnt">${f.dice}${ico('dice')}</span><b class="sn">SN ${f.sn}</b><span class="chips2">${modChips(f.parts)}</span></div>`).join('') || '<p class="hint">Nothing can fire.</p>';
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}</h3></div>${b.stage === 'offFire' && engChoice(b) ? engChoice(b) : ''}${lines}${mineStep ? '' : `<p class="hint">Waiting for the ${nm(sd)} player to roll…</p>`}${rollRecord(b)}</div>`;
  }
  return '';
}
function legend() {
  if (tint === 'off') return '';
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const items = tint === 'supply' ? [[0xffffff, 'Supplied', `${nm(supplySide())} areas`], [MAPC.cut, `Cut off (${cutOffCount(supplySide())})`, 'no path to a source'], [0x000000, 'Enemy', 'not your areas']] : tint === 'control' ? [[CONTROL_COL[P2], nm(P2), 'control'], [CONTROL_COL[P1], nm(P1), 'control'], [CONTROL_COL.contested, 'Contested', 'both sides present']] : tint === 'tdn' ? TDN_COL.map((c, i) => [c, `TDN ${i}`, (i ? `attackers −${i} to hit` : 'no modifier')]) : [[ZONE_COL[5], 'Zone 5', '5th Panzer Army'], [ZONE_COL[6], 'Zone 6', '6th Panzer Army'], [ZONE_COL[7], 'Zone 7', '7th Army']];
  return `<div class="legend" aria-label="Overlay legend"><b>${tint === 'tdn' ? 'Terrain defence' : tint === 'control' ? 'Area control' : tint === 'supply' ? 'Supply' : 'Army zones'}</b>${items.map(([c, a, b]) => `<span><i style="background:${hex(c as number)}"></i>${a} <small>${b}</small></span>`).join('')}</div>`;
}
/* ---------- home: sign in, your games, a new game, join ---------- */
let matches: Match[] = [], form = { game: gameInfo(GAME_PARAM ?? '')?.ready ? GAME_PARAM! : 'bulge', title: '', side: '' as string, scenario: gameInfo(GAME_PARAM ?? '')?.defaultScenario ?? 'tournament', fuel: true, rules: {} as Partial<E.Opts> }, homeMsg = (() => { try { const m = sessionStorage.getItem('fab-notice') ?? ''; sessionStorage.removeItem('fab-notice'); return m; } catch { return ''; } })(), creating = false;
{ try { const sc = sessionStorage.getItem('fab-new'); sessionStorage.removeItem('fab-new'); const [gm, scn] = (sc ?? '').split(':'), gi = gameInfo(gm ?? ''); if (gi?.ready && gi.scenarios.some((x) => x.id === scn)) { form.game = gm; form.scenario = scn; form.side = gi.sides[0]; creating = true; } } catch { /* private mode */ } }   // the tutorial's last buttons open a new game (game:scenario)
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
/* ---------- optional rules (Play Book 18): one chooser for every place a game is created ---------- */
let optOpen = false;
const optOn = (o: Partial<E.Opts>) => E.OPTIONAL_RULES.filter((r) => (r.key === 'bid' ? !!o.bid : !!o[r.key]));
const SCEN_NAME: Record<string, string> = Object.fromEntries(GAMES.flatMap((x) => x.scenarios.map((sc) => [sc.id, sc.name])));
const tableUrl = (id: string, game: string) => `${homeUrl()}?table=${id}${game && game !== 'bulge' ? `&game=${game}` : ''}`;
function optChooser(o: Partial<E.Opts>): string {
  const n = optOn(o).length, bid = o.bid ?? 0;
  const rows = E.OPTIONAL_RULES.map((r) => r.key === 'bid'
    ? `<div class="orow"><span class="orn">${r.rule}</span><span class="ort"><b>${r.name}</b><small>${esc(r.text)}</small></span><span class="ostep" role="group" aria-label="Agreed bid">${ubtn('−', () => { o.bid = Math.max(-5, bid - 1) || undefined; }, '', bid <= -5, 'Bid to be the Germans: fewer starting fuel')}<b>${bid > 0 ? '+' : ''}${bid}</b>${ubtn('+', () => { o.bid = Math.min(5, bid + 1) || undefined; }, '', bid >= 5, 'Bid to be the Allies: extra German bid fuel')}</span></div>`
    : `<button class="orow tog ${o[r.key] ? 'on' : ''}" aria-pressed="${!!o[r.key]}" data-ui="${reg(() => { (o as Record<string, unknown>)[r.key] = !o[r.key] || undefined; })}"><span class="orn">${r.rule}</span><span class="ort"><b>${r.name}</b><small>${esc(r.text)}</small></span><span class="sw ${o[r.key] ? 'on' : ''}">${o[r.key] ? 'ON' : 'OFF'}</span></button>`).join('');
  return `<div class="optrules"><button class="ohead" aria-expanded="${optOpen}" data-ui="${reg(() => { optOpen = !optOpen; })}">${ico(optOpen ? 'minus' : 'plus')}<b>Optional rules (18)</b><span>${n ? `${n} on` : 'none'}</span></button>${optOpen ? `<div class="olist">${rows}</div>` : ''}</div>`;
}
/** The optional rules a game uses, as short tags ('18.1 Bridge repair limits', 'bid +2'). */
function rulesInUse(o: Partial<E.Opts>, extra = true): string {
  const on = optOn(o); if (!on.length) return '<span class="hint">Optional rules: none</span>';
  return `<span class="rulesuse">${on.map((r) => `<span title="${esc(r.text)}">${r.rule} ${esc(r.key === 'bid' ? `Bid ${o.bid! > 0 ? '+' : ''}${o.bid}` : r.name)}</span>`).join('')}${extra && o.bridgeLimit && inGame() ? `<span>German bridge repairs left: ${g.bridgesLeft ?? 6}</span>` : ''}</span>`;
}
async function createGame() {
  const info = gameInfo(form.game); if (!info?.ready) return;
  const opts: E.Opts = JSON.parse(JSON.stringify({ ...(info.optional ? form.rules : {}), scenario: form.scenario || info.defaultScenario, fuel: info.fuel ? form.fuel : false })), title = form.title.trim() || `${info.name} · ${new Date().toLocaleDateString()}`;
  homeMsg = 'Creating…'; render();
  E.useGame(info.id); const json = JSON.stringify(E.newGame(undefined, opts)); E.useGame(VOL.id);      // the new game is of the chosen volume; this page stays on its own
  const id = await lobby.create({ game: form.game, title, opts }, form.side ? (form.side === info.sides[0] ? 'german' : 'allied') : null, json);
  if (id.startsWith('!')) { homeMsg = id.slice(1); return render(); }
  location.href = tableUrl(id, form.game);
}
function joinByCode(v: string) {
  const m = v.trim().match(/[?&]table=([\w-]+)/)?.[1] ?? v.trim(); if (!/^[\w-]{3,40}$/.test(m)) { homeMsg = 'Paste the invite link or the game code.'; return render(); }
  location.href = `${homeUrl()}?table=${m}`;
}
const stateOf = (m: Match) => (m.germanName && m.alliedName ? 'In play' : 'Waiting for an opponent');
/** The first screen: never on top of a game. Signed out it is just the sign-in; signed in it is your games, a new game and a way to join one. */
const tutUrl = (course: string) => `${homeUrl()}?tutorial=${course}`;
/** The learn card of a volume: one row per course (the full course, and "what's new" for players of an earlier volume). Works offline. */
const tutCard = (game: string) => { const cs = coursesOf(game); return !cs.length ? '' : `<section class="card tutcard"><h2>${ico('info')} Learn to play</h2>${cs.map((c) => { let at = 0; try { at = Number(localStorage.getItem(`fab-tut:${c.id}`) ?? 0) || 0; } catch { /* private mode */ } return `<div class="course"><div><b>${esc(c.title)}</b><small>${esc(c.sub)}</small><p class="hint">${esc(c.blurb)}</p></div>${ubtn(`${ico('next')}<span>${at ? 'Resume' : 'Start'}</span>`, () => { location.href = tutUrl(c.id); }, cs[0] === c ? 'primary' : '', false, `${c.title}: an interactive tutorial on the Play Book examples`)}</div>`; }).join('')}</section>`; };
const WHEN: Record<string, string> = Object.fromEntries(GAMES.map((x) => [x.id, x.when]));
/** The shelf: one box cover per FAB volume; tapping one shows that volume's tables (option A of the home mockup). */
function shelfHtml() {
  const pick = (id: string) => reg(() => { form.game = id; form.scenario = gameInfo(id)?.defaultScenario ?? ''; form.side = ''; creating = false; });
  const st = (x: { ready: boolean }) => `<span class="cst ${x.ready ? 'ready' : 'soon'}">${x.ready ? 'Play' : 'Soon'}</span>`;
  const spines = `<div class="spines" role="group" aria-label="Choose a battle">${GAMES.map((x, i) => `<button class="spine ${x.ready ? '' : 'soon'}" style="--off:${[0, 10, 4][i] ?? 0}px" aria-pressed="${form.game === x.id}" data-ui="${pick(x.id)}" aria-label="${esc(x.name)}, ${x.ready ? 'ready to play' : 'in preparation'}">${boxSpine(BOXES[i])}${st(x)}</button>`).join('')}</div>`;
  return `<h2 class="sec">Choose a battle</h2>${spines}<div class="shelf">${GAMES.map((x, i) => `<button class="cover ${x.ready ? '' : 'soon'}" aria-pressed="${form.game === x.id}" data-ui="${pick(x.id)}" aria-label="${esc(x.name)}, ${x.ready ? 'ready to play' : 'in preparation'}">${boxFront(BOXES[i])}${st(x)}</button>`).join('')}</div>`;
}
const soonCard = (x: { name: string; id: string }) => `<section class="card soonbox"><h2>${esc(x.name)} is in preparation</h2><p class="hint">Rules, map and counters are being transcribed. You'll be able to play it here when the engine supports it.</p><p class="hint">${esc(WHEN[x.id] ?? '')}</p><div class="row">${ubtn('Go to The Bulge', () => { form.game = 'bulge'; form.scenario = 'tournament'; })}</div></section>`;
function homeHtml() {
  const a = online.account, signed = !!a && !a.guest, info = gameInfo(form.game), ready = !!info?.ready;
  const head = `<header><h1>Fast Action Battles</h1><p>Board-game battles with the series rules, played online.</p></header>${shelfHtml()}`, learn = !ready ? soonCard(info!) : tutCard(form.game);
  if (!online.ready) return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}<p class="hint">Connecting…</p></div></div>`;
  if (online.mode !== 'remote' || !online.hasAccounts) return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}<section class="card"><p class="hint">Online play is not set up on this site.${online.error ? ' ' + esc(online.error) : ''}</p></section>${learn}</div></div>`;
  if (!signed) return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}<section class="card"><h2>Sign in</h2>${(() => { try { return sessionStorage.getItem('fab-next'); } catch { return null; } })() ? '<p class="hint">You will go straight back to the game you were invited to.</p>' : '<p class="hint">To create a game or join one. Anyone can watch a game from its link.</p>'}${accountHtml()}</section>${learn}${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}</div></div>`;
  const mine = matches.filter((m) => (m.game ?? 'bulge') === form.game).sort((x, y) => +!!y.myMove - +!!x.myMove).map((m, mi) => `<div class="matchrow ${m.myMove ? 'yours' : ''}"><button class="open" data-do="${reg(() => { location.href = tableUrl(m.id, m.game ?? 'bulge'); })}"><b>${esc(m.title)}${m.myMove ? '<span class="stampy">Your move</span>' : ''}</b><small class="seats"><span class="st ${m.germanName && m.alliedName ? 'live' : 'wait'}" aria-hidden="true"></span><small class="stw">${esc(stateOf(m))}</small><b>${info!.tag[info!.sides[0]]}</b> ${esc(m.germanName || '—')} <b>${info!.tag[info!.sides[1]]}</b> ${esc(m.alliedName || '—')}</small><small class="mrules">${SCEN_NAME[(m.opts as Partial<E.Opts> | undefined)?.scenario ?? 'tournament'] ?? ''}${(m.opts as Partial<E.Opts> | undefined)?.fuel === false ? ' · no fuel rule' : ''}${optOn(m.opts as Partial<E.Opts>).length ? ` · optional ${optOn(m.opts as Partial<E.Opts>).map((r) => r.rule).join(', ')}` : ''}</small></button><div class="row">${btn(`${ico('share')}`, () => { void share(m.id, m.title); }, 'ico', false, 'Invite a player')}${btn(`${ico('trash')}`, () => { void dropMatch(m); }, 'ico danger', false, m.owner === online.uid || online.admin ? 'Delete this game for everyone' : 'Remove from my list')}</div>${m.myMove ? `<button class="${mi === 0 ? 'go' : 'primary'} resume" data-do="${reg(() => { location.href = tableUrl(m.id, m.game ?? 'bulge'); })}">Resume${m.turn ? ` turn ${m.turn}` : ''}${m.step && STEP_NAME[m.step] ? ` · ${STEP_NAME[m.step]}` : ''}${ico('next')}</button>` : ''}</div>`).join('') || '<p class="hint">No games yet.</p>';
  const tile = (v: string, label: string, tag: string) => `<button class="tile ${form.side === v ? 'on' : ''} ${v}" aria-pressed="${form.side === v}" data-ui="${reg(() => { form.side = v; })}" title="${label}"><b>${tag}</b><small>${label}</small></button>`;
  const create = creating ? `<div class="sheetbox"><div class="lh"><h3>${ico('plus')} New game</h3>${ubtn(ico('close'), () => { creating = false; }, 'ico', false, 'Cancel')}</div>
      <div class="authform"><input placeholder="Name (optional)" value="${esc(form.title)}" data-sel="${regv((x) => { form.title = x; })}"></div>
      <div class="tiles">${info!.sides.map((sd) => tile(sd, info!.sideName[sd], info!.tag[sd])).join('')}${tile('', 'Later', '?')}</div>
      <div class="chips"><div class="scens">${info!.scenarios.filter((sc) => !sc.testing).map((sc) => chip(`${esc(sc.name)}<small>${esc(sc.sub)}</small>`, form.scenario === sc.id, () => { form.scenario = sc.id; }, sc.title)).join('')}</div>${info!.fuel ? `<div class="optrules fuelrow"><button class="orow tog ${form.fuel ? 'on' : ''}" aria-pressed="${form.fuel}" data-ui="${reg(() => { form.fuel = !form.fuel; })}"><span class="orn">16.13</span><span class="ort"><b>German fuel</b><small>Moves over 3 MP and strategic moves spend a fuel asset.</small></span><span class="sw ${form.fuel ? 'on' : ''}">${form.fuel ? 'ON' : 'OFF'}</span></button></div>` : ''}</div>${info!.optional ? optChooser(form.rules) : ''}
      <div class="row createrow">${btn(`${ico('check')}<span>Create game</span>`, () => { void createGame(); }, 'primary', !info?.ready)}</div></div>` : '';
  return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">
    <header class="hbar"><div><h1>Fast Action Battles</h1><p>Board-game battles with the series rules, played online.</p></div><div class="who"><span class="avatar" title="${esc(a!.name || a!.email)}">${esc((a!.name || a!.email || '?').slice(0, 1).toUpperCase())}</span>${online.admin ? ubtn(ico('wand'), () => { location.href = `${homeUrl()}?sandbox=1&game=${VOL.id}${DEV ? '&dev=1' : ''}`; }, 'ico', false, 'Admin: sandbox test table') + ubtn(ico('lock'), () => { modal = 'rules'; }, 'ico', false, 'Admin: update the database rules') : ''}<button class="ico" data-auth="out" title="Sign out" aria-label="Sign out">${ico('logout')}</button></div></header>
    ${shelfHtml()}${ready ? `<section class="card"><div class="lh"><h2>${ico('users')} ${esc(info!.name)} · your tables</h2>${creating ? '' : ubtn(`${ico('plus')}<span>New</span>`, () => { creating = true; }, 'primary', false, 'Start a new game')}</div>${create}${mine || '<p class="hint">No tables yet: tap New to set one up.</p>'}</section>` : ''}
    ${learn}<section class="card joincard"><div class="row authform"><input id="join" class="grow" placeholder="Invite link or code" aria-label="Invite link or code">${ubtn(`${ico('next')}<span>Join</span>`, () => { joinByCode(($('#join') as HTMLInputElement).value); }, 'primary', false, 'Join a game with an invite')}</div></section>
    ${homeMsg ? `<p class="hint"><b>${esc(homeMsg)}</b></p>` : ''}${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
  </div></div>`;
}
/** A slim bar over the table when you are not seated, or while you wait for an opponent. */
function seatBar() {
  if (online.mode !== 'remote' || !online.hasAccounts) return '';
  if (online.error) return `<div class="seatbar err"><span>${esc(online.error)}</span>${ubtn('OK', () => { online.error = ''; })}</div>`;
  const a = online.account, me = online.mySide(), s = online.seats, title = matches.find((m) => m.id === TABLE)?.title ?? 'a game of FAB';
  if (!a || a.guest) return `<div class="seatbar"><span>You are watching.</span>${ubtn('Sign in to play', () => { try { sessionStorage.setItem('fab-next', TABLE); } catch { /* private mode */ } location.href = homeUrl(); }, 'primary')}</div>`;
  if (!me) { const free = VOL.sides.filter((x) => !seatOf(s, x)); return `<div class="seatbar"><span>${free.length ? 'Take a seat:' : 'Both seats are taken. You are watching.'}</span>${free.map((x) => ubtn(`Play ${nm(x)}`, () => { void sit(x); }, 'primary')).join('')}</div>`; }
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
/** The rules this version of the site expects (database.rules.json), as pretty text and as one line. */
const rulesText = databaseRules;
const rulesOne = () => JSON.stringify(JSON.parse(rulesText));
const rulesLink = () => { const p = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '', u = (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined) ?? ''; let name = ''; try { name = new URL(u).hostname.split('.')[0]; } catch { /* not configured */ } return `https://console.firebase.google.com/project/${p}/database/${name}/rules`; };
async function copyText(t: string, what: string) { try { await navigator.clipboard.writeText(t); toast = `${what} copied`; toastInfo = true; } catch { toast = 'Copy failed: select the text below and copy it by hand'; toastInfo = false; } render(); setTimeout(() => { toast = ''; render(); }, 2500); }
function rulesHtml() {
  return `<div class="modal"><div class="sheet"><h3>Update Firebase rules <button class="ico" data-modal="${inGame() ? 'menu' : ''}" aria-label="Back">${ico('close')}</button></h3>
    <p class="hint">These are the rules this version of the site expects. Copy them, open the Firebase rules editor, replace everything there with them and press Publish.</p>
    <div class="row"><a class="primary" href="${rulesLink()}" target="_blank" rel="noopener" style="padding:8px 12px;text-decoration:none">Open Firebase rules ↗</a>${btn('Copy expanded', () => { void copyText(rulesText, 'Rules'); })}${btn('Copy single line', () => { void copyText(rulesOne(), 'Single-line rules'); })}</div>
    <h4>Expanded</h4><textarea readonly rows="10" style="width:100%;font:12px monospace">${esc(rulesText)}</textarea>
    <h4>Single line</h4><textarea readonly rows="4" style="width:100%;font:12px monospace">${esc(rulesOne())}</textarea></div></div>`;
}
/** A Success Number modifier as a small icon chip: the sign and size are the data, the full reason is the tooltip. */
const modIcon = (why: string) => /base/i.test(why) ? 'target' : /strongpoint/i.test(why) ? 'shield' : /brigade/i.test(why) ? 'users' : /armor|infantry|class/i.test(why) ? 'armor_asset' : /green|veteran|elite|quality/i.test(why) ? 'star' : /terrain|tdn/i.test(why) ? 'tree' : /field/i.test(why) ? 'gear' : /river|assault/i.test(why) ? 'wave' : /disorder/i.test(why) ? 'disorder' : /supply/i.test(why) ? 'warn' : /night/i.test(why) ? 'eye' : /air|asset|artillery|rocket/i.test(why) ? 'air_mission' : 'info';
/** A short word for a modifier, shown beside its icon with full explanations on; a tap names it in full. */
const modWord = (why: string) => /base/i.test(why) ? 'base' : /strongpoint/i.test(why) ? 'strongpoint' : /brigade/i.test(why) ? 'brigade' : /night/i.test(why) ? 'night' : /assault/i.test(why) ? 'assault' : /armor/i.test(why) ? 'armor' : /infantry/i.test(why) ? 'infantry' : /green|veteran|elite|quality/i.test(why) ? 'quality' : /terrain|tdn/i.test(why) ? 'terrain' : /field/i.test(why) ? 'field works' : /river/i.test(why) ? 'river' : /disorder/i.test(why) ? 'disordered' : /supply/i.test(why) ? 'supply' : /rocket/i.test(why) ? 'rocket' : /air/i.test(why) ? 'air' : /artillery/i.test(why) ? 'artillery' : /defender/i.test(why) ? 'defender' : '';
const modChips = (parts: [string, number][]) => parts.map(([w, v]) => `<span class="m2 ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" role="button" tabindex="0" data-ui="${reg(() => say(`${v > 0 ? '+' : '−'}${Math.abs(v)}: ${w}`, true))}" title="${esc(w)}" aria-label="${esc(`${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)}, ${w}`)}">${ico(modIcon(w))}${v > 0 ? '+' : v < 0 ? '−' : ''}${v ? Math.abs(v) : ''}${modWord(w) ? ` <small>${modWord(w)}</small>` : ''}</span>`).join('');
/** A toggle chip. With `icon` the icon replaces the tick; with an empty label it is icon-only and `title` names it. */
const chip = (label: string, on: boolean, f: () => void, title = '', icon = '') => `<button class="chip ${on ? 'on' : ''} ${label ? '' : 'iconly'}" aria-pressed="${on}" data-ui="${reg(f)}" title="${esc(title || label)}" aria-label="${esc(title || label)}">${icon ? ico(icon) : on ? ico('check') : ''}${label ? `<span>${label}</span>` : ''}</button>`;
const relayer = () => { saveLayers(); paintBoard(); paintAreas(); };
/** The camera takes in all the areas a side holds (the supply colour then always shows something). */
/** The opening view: the whole map, or a scenario's own sheet (its play area) framed from above. */
function homeGoal() {
  const ids = g.inPlay ? MAP.areas.filter((a) => g.inPlay!.includes(a.id)).flatMap((a) => a.polygon.map(([x, y]) => toWorld(x, y))) : [];      // every corner of the sheet
  if (!ids.length) return { t: new THREE.Vector3(17, 0, -3), dist: innerWidth < 700 ? 52 : 36, pitch: 1.0 };
  const x0 = Math.min(...ids.map((p) => p.x)), x1 = Math.max(...ids.map((p) => p.x)), z0 = Math.min(...ids.map((p) => p.z)), z1 = Math.max(...ids.map((p) => p.z));
  return { t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * (innerWidth < 700 ? 1.7 : 1.12) + 3), pitch: 1.0 };
}
function frameSide(sd: E.Side) { const ids = MAP.areas.filter((a) => g.control[a.id] === sd && (!g.inPlay || g.inPlay.includes(a.id))).map((a) => center(a.id)); if (!ids.length) return;
  const x0 = Math.min(...ids.map((p) => p.x)), x1 = Math.max(...ids.map((p) => p.x)), z0 = Math.min(...ids.map((p) => p.z)), z1 = Math.max(...ids.map((p) => p.z));
  goal = { t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * 0.95 + 8), pitch }; }
const cutOffCount = (sd: E.Side) => MAP.areas.filter((a) => g.control[a.id] === sd && !supOk(sd, a.id)).length;
function layersHtml() {
  const tintBtn = (v: typeof tint, label: string, icon: string, title: string) => chip(label, tint === v, () => { tint = v; relayer(); if (v === 'supply') frameSide(supplySide()); }, title, icon);
  const mapChips = VOL.art.relief ? `<h4>Map</h4><div class="chips">${chip('2D', !map3d, () => setMap3d(false), 'The printed board, flat')}${chip('3D', map3d, () => setMap3d(true), VOL.art.reliefName)}</div>` : '';
  const lay = (k: 'numbers' | 'tdn' | 'vp' | 'names', icon: string, title: string, label = '') => chip(label, layers[k], () => { layers[k] = !layers[k]; relayer(); }, title, icon);
  return `<div class="modal"><div class="sheet slim"><h3>${ico('eye')} View <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
    <h4>Printed</h4><div class="chips">${lay('numbers', 'hash', 'Area numbers and entry letters', 'Numbers')}${lay('tdn', 'tree', 'Terrain defence number', 'TDN')}${lay('vp', 'star', 'Victory points', 'VP')}${lay('names', 'text', 'Place names', 'Names')}</div>
    <h4>Colour</h4><div class="chips">${tintBtn('off', 'None', 'close', 'No colour')}${tintBtn('tdn', 'TDN', 'tree', 'Terrain defence')}${VOL.features.zones ? tintBtn('zones', 'Zones', 'layers', 'Army zones') : ''}${tintBtn('control', 'Control', 'flag', 'Who holds each area')}${tintBtn('supply', 'Supply', 'fuel', 'Supply: which of your areas trace supply')}</div><h4>Map key</h4><div class="mapkey"><span><i style="background:#5d8b3a"></i>Can go there</span><span><i style="background:#e7b04a"></i>Must stop · costs a Special Action</span><span><i class="fuel"></i>Uses fuel</span><span><i style="background:#d1432f"></i>Must fight · cut off</span><span><i style="background:transparent;border:2px solid #e7b04a"></i>May fight</span><span><b class="ar" style="color:#8fc46a">━▶</b>Move · <b class="ar" style="color:#e7b04a">━▶</b>with fuel · <b class="ar" style="color:#c9ccd2">━▶</b>minimum move · <b class="ar" style="color:#ddd7b5">━▶</b>strategic</span><span>${ico('back')}<small>over a block: it can still move</small></span></div>${mapChips}<h4>Camera</h4><div class="row"><button data-home>${ico('home')} Reset the camera</button></div></div></div>`;
}
/** The game log, newest first, grouped by turn; each line tinted by the side it concerns. */
/** A log line with its side prefix (GE / AL) as a coloured tag: side shown by colour and name. */
const TAGRE = VOL.sides.map((s) => VOL.tag[s]).join('|'), sideByTag = (t: string) => VOL.sides.find((s) => VOL.tag[s] === t || VOL.sideName[s] === t) ?? '';
const sideTag = (x: string) => { const m = new RegExp(`^(${TAGRE})\\b ?`).exec(x); return m ? `<b class="stag ${sideByTag(m[1])}">${m[1]}</b> ${esc(x.slice(m[0].length))}` : esc(x); };
const STEP_NAME: Record<string, string> = { deploy: 'Set-up', reinforcement: 'Reinforcement', admin: 'Admin', movement: 'Movement', strategic: 'Strategic movement', combat: 'Combat', reaction: 'Reaction', btMove: 'Breakthrough movement', btCombat: 'Breakthrough combat', supply: 'Supply' };
/** The game log, newest first: a heading per turn, a smaller one per step, each line with its side tag (the step is in the heading, not on the line). */
function logHtml() {
  const groups: { turn: string; steps: { step: string; lines: string[] }[] }[] = [];
  for (const l of g.log) {
    const m = /^T(\d+) /.exec(l), t = m ? m[1] : '0', rest = m ? l.slice(m[0].length) : l, s = new RegExp(`^(${TAGRE}) (\\w+): `).exec(rest), step = s && STEP_NAME[s[2]] ? s[2] : '', text = step ? `${s![1]} ${rest.slice(s![0].length)}` : rest;
    if (groups.at(-1)?.turn !== t) groups.push({ turn: t, steps: [] });
    const gr = groups.at(-1)!; if (gr.steps.at(-1)?.step !== step) gr.steps.push({ step, lines: [] }); if (!new RegExp(`^(${TAGRE}) (phase start|[a-zA-Z]+ phase)$`).test(text)) gr.steps.at(-1)!.lines.push(text);   /* the heading already says which step began */
  }
  const side = (x: string) => sideByTag(x.split(/\s/)[0]);
  return `<div class="log">${groups.reverse().map((gr) => `<h5>${gr.turn === '0' ? 'Set-up' : `Turn ${gr.turn}`}</h5>${[...gr.steps].reverse().map((st) => `${st.step ? `<h6>${STEP_NAME[st.step]}</h6>` : ''}${[...st.lines].reverse().map((x) => `<div class="ll ${side(x)}">${sideTag(x)}</div>`).join('')}`).join('')}`).join('') || '<p class="hint">Nothing yet.</p>'}</div>`;
}
function modalHtml() {
  if (modal === 'layers') return layersHtml();
  if (modal === 'rules') return rulesHtml();
  if (modal === 'boxes') return piecesHtml();
  if (modal === 'menu') {
    const tabs = ['Players', 'Log', 'Settings', ...(online.admin ? ['Admin'] : [])];
    if (!tabs.includes(menuTab)) menuTab = 'Players';
    const body = menuTab === 'Log' ? logHtml()
      : menuTab === 'Settings' ? `<h4>Dice</h4><div class="row">${ubtn(`<span class="sw ${autoRoll ? 'on' : ''}">${autoRoll ? 'AUTO' : 'WAIT'}</span> After a roll, move on by itself (decisions still wait for you)`, () => { autoRoll = !autoRoll; try { localStorage.setItem('fab-autoroll', autoRoll ? '1' : '0'); } catch { /* private mode */ } }, autoRoll ? 'on' : '')}</div><h4>Keyboard</h4><dl class="keys"><dt>Tab</dt><dd>to the map (or “Skip to the map” first)</dd><dt>← ↑ → ↓</dt><dd>move between neighbouring areas</dd><dt>Enter</dt><dd>select or move there; on a button, press it</dd><dt>N</dt><dd>next block that can move</dd><dt>Esc</dt><dd>clear the selection, close a window</dd><dt>Ctrl+Z</dt><dd>undo</dd></dl><h4>Rules in use</h4><p>${rulesInUse(g.opts)}</p>${coursesOf(VOL.id).length ? `<h4>Learn</h4><div class="row">${coursesOf(VOL.id).map((c) => ubtn(`${ico('info')} ${esc(c.title)}`, () => { location.href = tutUrl(c.id); })).join('')}</div>` : ''}<h4>Map</h4><div class="row">${ubtn(`${ico('layers')} Map layers`, () => { modal = 'layers'; })}${ubtn(`${ico('home')} Reset view`, () => { document.querySelector<HTMLElement>('[data-home]')?.click(); })}</div><h4>Explanations</h4><div class="row">${ubtn(`<span class="sw ${guide === 'full' ? 'on' : ''}">${guide === 'full' ? 'FULL' : 'SHORT'}</span> Explain each option and rule`, () => setGuide(guide === 'full' ? 'short' : 'full'), guide === 'full' ? 'on' : '')}</div><h4>Opponent</h4><div class="row">${ubtn(`<span class="sw ${followFoe ? 'on' : ''}">${followFoe ? 'ON' : 'OFF'}</span> Point the camera at the other player's moves`, () => { followFoe = !followFoe; try { localStorage.setItem('fab-follow', followFoe ? '1' : '0'); } catch { /* private mode */ } }, followFoe ? 'on' : '')}</div>
        ${online.active && !online.admin && !online.both() ? '<p class="hint">Restarting a shared game is limited to its admin.</p>' : `<h4>Restart this game</h4><div class="row"><select data-sel="${regv((x) => { newOpts.scenario = x as E.Opts['scenario']; })}">${VOL.scenarios.filter((sc) => SANDBOX || !sc.testing).map((sc) => `<option value="${sc.id}" ${newOpts.scenario === sc.id ? 'selected' : ''}>${esc(sc.name)} (${esc(sc.sub)})</option>`).join('')}</select>
        ${VOL.features.fuel ? `<label><input type="checkbox" ${newOpts.fuel ? 'checked' : ''} data-sel="${regv((x) => { newOpts.fuel = x === 'on'; })}"> German fuel rule</label>` : ''}</div>${VOL.features.optional ? optChooser(newOpts) : ''}<div class="row">${ubtn('Restart', () => { if (!confirm('Restart and lose the current game?')) return; g = E.newGame(undefined, newOpts); selArea = selUnit = selChit = null; modal = null; inBattle = false; hist.clear(); note = ''; selArr = null; save(); refresh(); }, 'danger')}</div>`}`
      : menuTab === 'Admin' ? `<div class="row">${ubtn(`${ico('wand')} Sandbox`, () => { location.href = `${homeUrl()}?sandbox=1`; })}${ubtn('Update rules', () => { modal = 'rules'; })}${VOL.sides.map((sd) => ubtn(`Free ${nm(sd)} seat`, () => { void auth.freeSeat(sd); })).join('')}</div>`
      : online.mode === 'remote' ? (() => {
        const a = online.account, signed = !!a && !a.guest, me = online.mySide(), title = matches.find((m) => m.id === TABLE)?.title ?? TABLE, m = matches.find((x) => x.id === TABLE), own = !!m && (m.owner === online.uid || online.admin);
        const row = (sd: E.Side) => { const seat = seatOf(online.seats, sd), who = seat ? (seat === online.uid ? 'you' : esc(seatName(online.seats, sd) || 'taken')) : 'free';
          return `<div class="seatrow"><b class="${sd}">${nm(sd)}</b><span>${who}</span>${seat === online.uid ? ubtn('Leave seat', () => { void sit(null); }) : !seat && signed && !me ? ubtn('Take seat', () => { void sit(sd); }, 'primary') : ''}</div>`; };
        return `<h4>Players</h4>${VOL.sides.map(row).join('')}<p class="inuse">${rulesInUse(g.opts)}</p>${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
          <div class="row">${ubtn(`${ico('share')} Invite a player`, () => { void share(TABLE, title); })}</div>
          <p class="hint">Connection: ${esc(online.sync)}</p>
          <p class="hint">${signed ? `Signed in as <b>${esc(a!.name || a!.email)}</b>` : 'You are watching as a guest.'}</p>
          ${own && TABLE !== 'main' ? `<div class="row">${ubtn(`${ico('close')} Delete this game`, () => { void dropMatch(m ?? { id: TABLE, title: TABLE, owner: '' }); }, 'danger')}</div>` : ''}`; })()
      : `<p class="hint">Developer table. The Seat button in the top bar switches between ${nm(P1)}, ${nm(P2)}, both and watching; turn rules are enforced for the seat you hold.</p>`;
    return `<div class="modal"><div class="sheet menu"><h3>Game <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
      <div class="tabs">${tabs.map((t) => `<button class="${t === menuTab ? 'on' : ''}" data-ui="${reg(() => { menuTab = t; })}" title="${t}" aria-label="${t}">${ico(({ Players: 'users', Log: 'list', Settings: 'sliders', Admin: 'lock' } as Record<string, string>)[t] ?? 'info')}<span>${t}</span></button>`).join('')}</div><div class="mbody">${body}</div>
      <div class="row sheetfoot">${ubtn(`${ico('back')}<span>Leave game</span>`, () => { location.href = homeUrl(); })}</div></div></div>`;
  }
  return '';
}
const inGame = () => HAS_TABLE || DEV_FAKE || SANDBOX || TUTORIAL || online.mode === 'local';
/** Draw the interface; if something in it throws, say so on screen instead of leaving a stale picture. */
/* A tap must land on the button it started on: while a finger or mouse is down on the interface, redraws wait (playtest: Ready/Roll/Done taps were lost). */
let pressing = false, renderWaiting = false;
document.addEventListener('pointerdown', (e) => { pressing = !!(e.target as HTMLElement).closest?.('#ui button, #ui [role=button], #ui .card2'); }, true);
const release = () => { if (!pressing) return; pressing = false; if (renderWaiting) setTimeout(() => { if (renderWaiting && !pressing) render(); }, 0); };
document.addEventListener('pointerup', release, true); document.addEventListener('pointercancel', release, true); window.addEventListener('blur', release);
/** Keyboard focus survives a redraw: the same control (by its role and text) gets it back, or the new main button. */
let kbUser = false; window.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') kbUser = true; }, true); window.addEventListener('pointerdown', () => { kbUser = false; }, true);
function focusKey(el: Element | null) { if (!el || !(el as HTMLElement).closest?.('#ui') || !el.matches('button,[role=button],input,select,[tabindex]')) return null; return { tag: el.tagName, cls: Array.from(el.classList).filter((c) => !['on', 'hot'].includes(c)).sort().join('.'), text: (el.textContent ?? '').trim().slice(0, 40), label: el.getAttribute('aria-label') ?? '' }; }
function render() { if (pressing) { renderWaiting = true; return; } renderWaiting = false; syncView(); const fk = kbUser ? focusKey(document.activeElement) : null; try { renderInner(); } catch (e) { console.error(e); $('#ui').innerHTML = `<div class="seatbar err"><span>Display problem: ${esc(String((e as Error)?.message ?? e))}</span>${ubtn('Reload', () => location.reload(), 'primary')}${SANDBOX ? ubtn('Undo last edit', () => { const p = hist.undo(g).game; if (p) { g = p; save(); refresh(); } }) + ubtn('New sandbox game', () => { g = E.newGame(); hist.clear(); save(); refresh(); }) : ''}</div>`; bind($('#ui')); }   if (fk && !document.activeElement?.closest?.('#ui')) { const all = Array.from(document.querySelectorAll<HTMLElement>('#ui button, #ui [role=button], #ui input, #ui select, #ui [tabindex]'));
    const back = all.find((e) => { const k = focusKey(e); return k && k.tag === fk.tag && k.cls === fk.cls && (k.text === fk.text || (k.label && k.label === fk.label)); }) ?? document.querySelector<HTMLElement>('#ui .go:not(:disabled)'); back?.focus({ preventScroll: true }); } }
function renderInner() {
  if (document.activeElement?.closest?.('.authform')) return;                                         // do not wipe what is being typed
  acts = {}; actv = {}; n = 0; if (!g.battle || g.battle.stage !== 'setup') refusal = '';
  canvas.style.display = inGame() ? '' : 'none';
  if (!inGame()) { $('#ui').innerHTML = (modal === 'rules' ? rulesHtml() : '') + homeHtml(); bind($('#ui')); return; }
  if (SANDBOX && !(online.admin || (DEV && online.ready))) { canvas.style.display = 'none'; $('#ui').innerHTML = `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein"><section class="card"><h2>${ico('lock')} Sandbox</h2><p class="hint">${online.ready ? 'The sandbox is for admins. Sign in with an admin account on the home page.' : 'Checking your account…'}</p><div class="row">${ubtn(`${ico('back')} Home`, () => { location.href = homeUrl(); })}</div></section></div></div>`; bind($('#ui')); return; }
  if (rollView && !g.battle && !rollView.check) endRoll();                                                                   // dice left on screen after the battle is over
  const p = primary(), b = g.battle;
  const alert = g.pendingBlow ? (() => { const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!, path = g.pendingBlow!.path; return `<div class="c-ledger"><h3>${nm(other(u.side))}: bridge?</h3><p class="hint">${esc(u.name)} tries to cross into ${esc(areaName(path[path.length - 1]))}. Attempt to blow the bridge? It works on a roll of 1–5.</p><div class="row end">${btn('Let them cross', () => E.resolveBlow(g, false))}${btn('Attempt to blow it', () => E.resolveBlow(g, true), 'primary')}</div></div>`; })() : '';
  const dockMain = alert || ledger() || handCards();
  const keepD = document.querySelector<HTMLElement>('#ui .c-dispatch')?.scrollTop ?? 0;           // a panel being read keeps its place when the screen updates
  const keepH = document.querySelector<HTMLElement>('#ui .c-hand')?.scrollLeft ?? 0, keepA = document.querySelector<HTMLElement>('#ui .arrtray')?.scrollLeft ?? 0;
  $('#ui').innerHTML = `<a class="skipmap" href="#" data-ui="${reg(() => { (document.getElementById('gl') as HTMLElement).focus(); })}">Skip to the map</a><div class="tops">${topBar()}${vpStrip(g, reg(() => { scoreOpen = true; }))}</div>` + `<div class="stage">${SANDBOX ? (SBU.st.sbOpen ? SBU.sandboxPanel() : SBU.sandboxFab()) : ''}${seatBar()}${auditWarn.length ? `<div class="seatbar err audit"><span>${ico('warn')} <b>Rules check:</b> ${auditWarn.map(esc).join(' ')}</span>${ubtn('OK', () => { auditWarn = []; })}</div>` : ''}${VOL.panel(g, panelCtx())}${b ? battleTable() : dispatch()}${decisionBubble()}${feedHtml()}${legend()}${SBU.hotCoverHtml()}${saPickHtml()}${airPickHtml()}${chatHtml()}${scoreOpen ? vpSheet(g, unitPic, reg(() => { scoreOpen = false; }), ico('close')) : ''}${g.over && !endHidden ? endPanel(g, unitPic, ubtn(`${ico('layers')} Map`, () => { endHidden = true; }) + ubtn(`${ico('plus')} New game`, () => { if (SANDBOX) { SBU.sbReset({ ...g.opts }); endHidden = false; } else location.href = homeUrl(); }, 'primary') + ubtn(`${ico('home')} Home`, () => { location.href = homeUrl(); })) : ''}${toast ? `<div class="toast${toastInfo ? ' info' : ''}" role="status">${esc(toast)}</div>` : ''}</div><div class="dock">${dockMain}<div class="c-bar b"><div class="c-prompt" aria-live="polite">${prompt()}</div><button class="ico guidebtn ${guide === 'full' ? 'on' : ''}" data-ui="${reg(() => setGuide(guide === 'full' ? 'short' : 'full'))}" title="${guide === 'full' ? 'Hide the explanations (short prompts)' : 'Show the explanations of each option'}" aria-label="Explanations" aria-pressed="${guide === 'full'}">${ico('info')}</button>${undoBtn()}${!p || !allowed() ? '<span class="gowait slot" aria-hidden="true"></span>' : p.dis && /^Waiting/.test(p.label) ? `<span class="gowait">${esc(p.label)}…</span>` : p ? `<button class="go" data-do="${reg(guardEnd(p))}" ${p.dis || !allowed() ? 'disabled' : ''} ${allowed() ? '' : `title="${esc(notYou())}"`}>${endArmed && p.label.startsWith('End') ? `End anyway? ${canMove().length} can move` : p.label}${ico(p.label.startsWith('Ready') ? 'check' : p.label.startsWith('Roll') ? 'dice' : 'next')}</button>` : ''}${dockChips()}</div></div>` + modalHtml();
  const ui = $('#ui');
  { const d = ui.querySelector<HTMLElement>('.c-dispatch'); if (d) d.scrollTop = keepD; }
  bind(ui, keepH, keepA);
}
function bind(ui: HTMLElement, keepH = 0, keepA = 0) {
  ui.querySelectorAll<HTMLElement>('.dchips').forEach((row) => {                                  // a row of chips that runs off the right edge fades there, so it reads as "more to the right"
    const edge = () => row.classList.toggle('more', row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    edge(); row.addEventListener('scroll', edge, { passive: true });
  });
  { const h = ui.querySelector<HTMLElement>('.c-hand'), a = ui.querySelector<HTMLElement>('.arrtray'); if (h) h.scrollLeft = keepH; if (a) a.scrollLeft = keepA; }
  ui.querySelectorAll<HTMLElement>('[data-ui]').forEach((e) => (e.onclick = () => { acts[e.dataset.ui!]?.(); render(); }));            // view-only choices: allowed for everyone, never touch the game
  ui.querySelectorAll<HTMLElement>('[data-do]').forEach((e) => (e.onclick = () => { if (inGame()) act(acts[e.dataset.do!]); else { acts[e.dataset.do!]?.(); render(); } }));        // on the home page nothing is a game move
  ui.querySelectorAll<HTMLElement>('[data-modal]').forEach((e) => (e.onclick = () => { inspectId = null; modal = (e.dataset.modal || null) as typeof modal; render(); }));                          // a window opens with nothing selected
  ui.querySelectorAll<HTMLElement>('[data-sel]').forEach((e) => (e.onchange = () => { const f = actv[e.dataset.sel!]; if (f) { f(e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : (e as HTMLSelectElement).value); save(); } }));
  ui.querySelectorAll<HTMLInputElement>('#lb-q').forEach((e) => { const run = () => { SBU.st.sbFilter = e.value; const w = SBU.st.sbFilter.toLowerCase().split(/\s+/).filter(Boolean); ui.querySelectorAll<HTMLElement>('.lbgrid .lbt').forEach((t) => { t.style.display = w.every((x) => t.dataset.k!.includes(x)) ? '' : 'none'; }); }; e.oninput = run; run(); });
  { const i = ui.querySelector<HTMLInputElement>('#chat-in'), b = ui.querySelector<HTMLElement>('#chat-send'), l = ui.querySelector<HTMLElement>('#chat-list');
    if (l) l.scrollTop = l.scrollHeight;
    if (i) { i.oninput = () => { chatDraft = i.value; }; i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); void chatSend(i.value); } }; }
    if (b && i) b.onclick = () => { void chatSend(i.value); }; }
  ui.querySelectorAll<HTMLTextAreaElement>('#sb-note').forEach((e) => (e.oninput = () => { SBU.st.sbDraft = e.value; }));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onpointerdown = (ev) => dragArrival(ev, e)));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onclick = () => { selArr = selArr === e.dataset.arr ? null : e.dataset.arr!; refresh(); frameArrival(); }));
  ui.querySelectorAll<HTMLElement>('[data-auth]').forEach((e) => (e.onclick = () => {
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '', k = e.dataset.auth;
    if (k === 'google') void auth.google(); else if (k === 'out') void auth.signOut();
    else if (k === 'in') void auth.signIn(v('a-mail'), v('a-pass')); else if (k === 'reg') void auth.register(v('a-mail'), v('a-pass'), v('a-name')); else if (k === 'reset') void auth.reset(v('a-mail'));
  }));
  ui.querySelectorAll<HTMLElement>('[data-seat]').forEach((e) => (e.onclick = () => { const order: DevSeat[] = ['both', ...VOL.sides, 'watch']; setDevSeat(order[(order.indexOf(online.devSeat) + 1) % order.length]); selUnit = selChit = selArr = null; previewArea = null; refresh(); }));
  ui.querySelectorAll<HTMLElement>('[data-home]').forEach((e) => (e.onclick = () => { goal = homeGoal(); yaw = viewRot(); }));
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
  const v = viewSide(); if (v === lastView) return; const fresh = lastView === null; lastView = v; yaw = v !== VOL.bottom ? Math.PI : 0; if (!fresh) goal = g.inPlay ? homeGoal() : { t: new THREE.Vector3(17, 0, -3), dist, pitch }; paintBoard();
}
/** Split tables: publish the blocks the other side may now see, and (attacker's seat) start combat once both sides are ready and their blocks are known. */
function driveSplit() {
  const me = online.mySide(); if (online.mode !== 'remote' || !me || !online.rev) return;
  void publishReveals(g);
  const b = g.battle;
  if (b && b.stage === 'setup' && b.ready?.length === 2 && g.deferBegin && me === b.attacker && E.unitsIn(g, b.area).every((u) => u.name !== 'Hidden block') && !VOL.blocksBegin(g)) act(() => E.beginCombat(g, b));
}
let ctlKey = '', tgtKey = '';
let playKey: string | null = null;
function refresh() {
  { const ph = `${g.turn}${g.phasing}${g.phase}`; if (ph !== lastPhase) { lastPhase = ph; fxLayer.clear(); } }
  E.setPlayArea(g.inPlay);
  { const k = (g.inPlay ?? []).join(); if (k !== playKey) { const first = playKey === null; playKey = k; if (!first) paintBoard(); if (g.inPlay || !first) goal = homeGoal(); } }
  SBU.hotseatSync();
  if (online.mode === 'remote') setTimeout(driveSplit, 0);
  { const key = `${online.devSeat}|${online.mySide()}|${g.battle?.attPoint}|${reinforcing}|${g.battle?.stage}|${g.battle?.pending}|${selChit}|${selArea}|${tgtMode}|${g.turn}${g.phase}|${g.log.length}|${g.rolls}`;                    // the dry runs behind the highlights are costly: redo them only when something they depend on changed
    if (key !== tgtKey) { tgtKey = key; tgt = reinforcing ? reinforceTargets() : decisionTargets() ?? (selChit && mine(g.chits.find((x) => x.id === selChit)?.side ?? P1) ? VOL.targetsFor(() => g, g.chits.find((x) => x.id === selChit) ?? null, { area: selArea, mode: tgtMode, setArea: (a) => { selArea = a; }, setMode: (m) => { tgtMode = m; }, face: (u) => unitPic(u), areaName }) : null); } }
  if (tint === 'control') { const k = JSON.stringify(g.control) + E.contestedAreas(g).join(); if (k !== ctlKey) { ctlKey = k; paintBoard(); } }
  syncView(); syncBattleCam(); drawPieces(); paintAreas(); drawRoute(); badges = g.battle ? [] : badgeList(); syncBadges(); syncMoveMarks(); syncTags(); render();
  if (!rollView) { const cv = $('#dice'); if (cv && cv.style.display !== 'none') { clearDice(); cv.style.display = 'none'; } }
}
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;                               // no floating motion for players who asked for less motion
let lastPhase = '';
let lastInput = performance.now(), tick = 0;
/** ?fps=1: a small corner counter (frames per second, slowest frame) for measuring on a real phone. */
const fpsEl = new URLSearchParams(location.search).has('fps') ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fps' }) : null;
let fpsN = 0, fpsT = performance.now(), fpsWorst = 0, fpsLast = performance.now();
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize']) window.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
function frame() {
  requestAnimationFrame(frame);
  pumpTextures();
  if (!goal && !anims.length && !rollView && performance.now() - lastInput > 2000 && tick++ % 3) return;   if (fpsEl) { const now = performance.now(); fpsWorst = Math.max(fpsWorst, now - fpsLast); fpsLast = now; fpsN++; if (now - fpsT > 1000) { fpsEl.textContent = `${Math.round(fpsN * 1000 / (now - fpsT))} fps · slowest ${Math.round(fpsWorst)} ms${now - lastInput > 2000 ? ' · idle' : ''}`; fpsN = 0; fpsT = now; fpsWorst = 0; } }
    // idle: about 20 frames a second is enough for the floating markers, and spares the battery
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  if (goal) { const k = goal.fast ? 0.28 : 0.1; target.lerp(goal.t, k); dist += (goal.dist - dist) * k; pitch += (goal.pitch - pitch) * k; if (target.distanceTo(goal.t) < 0.05 && Math.abs(dist - goal.dist) < 0.1) goal = null; }
  if (lock && !goal) target.copy(lock.c);
  if (!CALM) { const t = performance.now() / 1000; for (const k of markers.children) { const f = k.userData.float; if (f) { k.position.y = f.y + ((k.userData.lift as number | undefined) ?? 0) + Math.sin(t * 1.6 + f.ph) * 0.07; k.rotation.y = viewRot() + Math.sin(t * 0.9 + f.ph) * 0.22; } } }   // a slow 4 s bob and 7 s sway, each marker out of step
  { const old = Math.round(clearRatio * 5); clearRatio = fitBattleView(); if (g.battle && Math.round(clearRatio * 5) !== old) syncBattleCam(); }
  if (REL && PHONE) { const near = dist < 40; REL.props.children[0].visible = REL.props.children[1].visible = near; }   // phones: trees only when zoomed in (thousands of them are the heaviest part)
  placeCam(); runAnims(); settle(); renderer.render(scene, cam); renderFocus(); placeBadges();
}
SBU.initSandboxUi({
  get g() { return g; }, set g(v) { g = v; }, get selUnit() { return selUnit; }, set selUnit(v) { selUnit = v; }, get selChit() { return selChit; }, set selChit(v) { selChit = v; },
  get selArr() { return selArr; }, set selArr(v) { selArr = v; }, get selArea() { return selArea; }, set selArea(v) { selArea = v; }, get previewArea() { return previewArea; }, set previewArea(v) { previewArea = v; },
  get rollView() { return rollView; }, set rollView(v) { rollView = v as RollView | null; },
  ABBR, actorNow, areaName, b3, chitImg, unitFace, unitPic, chitPic, hist, refresh, render, save, say, reg, regv, ubtn, optChooser,
  scenarios: VOL.scenarios, defaultOpts: VOL.defaultOpts, optional: VOL.features.optional,
});
initTouch(document.body);
const toScreen = (p: THREE.Vector3) => { const r = canvas.getBoundingClientRect(), v = p.clone().project(cam); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; };
tut = TUT ? initTutorial({
  game: () => g, act,
  load: (x) => { if (heldNext) commitRoll(); rollView = null; hideDice(); g = x; hist.clear(); selUnit = selChit = selArr = null; selArea = previewArea = hoverArea = null; modal = null; scoreOpen = false; reinforcing = false; battleFx = []; rollFx = []; tgtKey = ''; save(); refresh(); },
  unitScreen: (id) => pieceScreen(id), areaScreen: (a) => { const c = center(a); return toScreen(new THREE.Vector3(c.x, 0, c.z)); },
  lookAt: (a) => { const p = center(a); goal = { t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, innerWidth < 700 ? 34 : 30), pitch }; },
  select: (id) => { if (g.pendingArrivals.includes(id)) selArr = id; else { selUnit = id; selArea = g.units.find((u) => u.id === id)?.area ?? null; } refresh(); },
  moving: () => ptrs.size > 0,
  pan: (dx, dy) => { goal = null; const k = dist * 0.0018, c = Math.cos(yaw), sn = Math.sin(yaw); target.x -= (dx * c + dy * sn) * k; target.z -= (-dx * sn + dy * c) * k; },
  fold: () => { if (infoOpen) { infoOpen = false; render(); } },
  toast: (t) => say(t), busy: () => !!rollView || !!heldNext,
  guide: () => guide, setGuide: (v) => { setGuide(v); render(); },
  view: (sd) => { if (VOL.sides.includes(sd)) { tutView = sd as E.Side; refresh(); } },
  home: (to) => { try { if (to) sessionStorage.setItem('fab-new', `${to.game}:${to.scenario}`); } catch { /* private mode */ } location.href = homeUrl(); },
}, TUT) : null;
frame();
Promise.all([loadChitArt(), VOL.id === 'golan73' ? loadGolanChitArt() : null]).catch((e) => console.error(e)).finally(() => { auto(); refresh(); });
let lobbyUid = '';
const onNet = (): void => {
  if (online.mode !== 'remote' || !online.hasAccounts) return;
  if (lobbyUid !== online.uid) { lobbyUid = online.uid; lobby.watch((m) => { matches = m; render(); }); }
  const next = (() => { try { return sessionStorage.getItem('fab-next'); } catch { return null; } })();
  if (next && !HAS_TABLE && online.account && !online.account.guest) { try { sessionStorage.removeItem('fab-next'); } catch { /* private mode */ } location.href = `${homeUrl()}?table=${next}`; }     // back to the invite that sent you to sign in
};
void startOnline((rg) => { applyingRemote = true; if (heldNext) commitRoll(); const prevG = g;                      // a roll still on screen is finished locally, never pushed back over what arrived
  if ((rg.game ?? 'bulge') !== VOL.id) { const u = new URL(location.href); u.searchParams.set('game', rg.game ?? 'bulge'); location.replace(u.href); return; }      // a shared table of another game: this page is built for one game, so it reloads as that one
  { const by = online.lastBy, w: E.Side | null = online.seats.german === by ? P1 : online.seats.allied === by ? P2 : null;           // referee-lite: check what the other browser wrote
    if (by && by !== online.uid && prevG.turn) { const p = E.auditChange(prevG, rg, w); if (p.length) { auditWarn = [...auditWarn, ...p].slice(-6); console.warn('rules check', p); } } } const ckLast = JSON.stringify(g.checks?.at(-1) ?? null); const was = g.battle, n0 = was?.rolls.length ?? 0, st0 = was?.stage, pre = was ? snap(g) : null; applyingRemote = true; g = rg;
  const nb = g.battle; if (nb && !was) { battleFx = []; rollFx = []; } const rolled = !!(was && nb && nb.area === was.area && nb.rolls.length > n0); if (pre) { try { noteFx(pre, g, rolled); } catch (e) { console.error(e); } }                  // a failure while describing the changes must never stop the screen from updating
  if (was && nb && nb.area === was.area && nb.rolls.length > n0 && st0 && STAGE_NAME[st0]) {      // the other player rolled: show their dice here too
    const side = st0 === 'attArty' || st0 === 'offFire' || st0 === 'exploit' ? nb.attacker : other(nb.attacker);
    rollView = { remote: true, morale: st0 === 'exploit', title: `${nm(side)} ${STAGE_NAME[st0]}`, pos: null, groups: nb.rolls.slice(n0).map((r) => ({ label: r.who, col: r.kind === 'arty' ? 's' : first(side) ? 'k' : 'w', sn: r.sn, dice: r.dice, hits: r.hits, parts: [] })) };
    if (rollView.groups.length) { heldNext = g; g = prevG; }                                       // the board keeps the old state until the dice land
    if (rollView.groups.length) { const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block'; throwDice(cv, rollView.groups, (p) => { if (rollView) { const rv = rollView; rv.pos = p; render(); afterDice(rv); } }); } else rollView = null;       // the other player's dice clear themselves
  }
  { const same = prevG.turn === g.turn && prevG.phase === g.phase && prevG.phasing === g.phasing && !!prevG.battle === !!g.battle;
    const keep = (prev: E.Game, id: string | null, f: (x: E.Game) => unknown) => (same && id && JSON.stringify(f(prev)) === JSON.stringify(f(g)) ? id : null);   // the other player's write keeps what you picked, unless it changed that very piece
    selUnit = keep(prevG, selUnit, (x) => x.units.find((u) => u.id === selUnit)); selChit = keep(prevG, selChit, (x) => x.chits.find((c) => c.id === selChit));
    selArr = keep(prevG, selArr, (x) => [x.pendingArrivals.includes(selArr!), x.units.find((u) => u.id === selArr)?.area]);
    if (!same) selArea = null; if (!selUnit) previewArea = null; hoverArea = null; } hist.remote(prevG, g, lockOf); if (rolled) hist.clear('dice rolled'); if (followFoe && online.lastBy && online.lastBy !== online.uid && !g.battle) { const mv = g.units.find((u) => { const o = prevG.units.find((x) => x.id === u.id); return o && u.area != null && o.area !== u.area; }); if (mv) lookAt(mv.area!); } try { save(); } finally { applyingRemote = false; } refresh();
  { const cs = g.checks ?? [], k = cs.findIndex((c) => JSON.stringify(c) === ckLast); const fresh = ckLast === 'null' ? [] : k >= 0 ? cs.slice(k + 1) : []; if (fresh.length) showChecks(fresh); } }, () => { onNet(); syncView(); render(); }, say, () => { try { sessionStorage.setItem('fab-notice', 'That game was deleted by its creator.'); } catch { /* private mode */ } location.href = homeUrl(); });       // the table is gone: nobody stays inside it
/** Every drawn symbol and counter as SVG, for the editable sheets (docs/maps/vector/fab-*.svg). */
function sheets() {
  const seenSvg = new Set<string>(), out: Record<string, { id: string; label: string; svg: string }[]> = { chits: [], blocks: [], markers: [] };
  const add = (k: string, id: string, label: string, svg: string | null) => { if (svg && !seenSvg.has(svg)) { seenSvg.add(svg); out[k].push({ id, label, svg }); } };
  const cg = E.newGame(5, VOL.id === 'bulge' ? { scenario: 'campaign', fuel: true } : VOL.defaultOpts);
  for (const c of cg.chits) add('chits', c.id, `${c.side} ${c.name}${c.turn != null ? ' t' + c.turn : ''}`, VOL.chitSvg(c));
  for (const u of cg.units) add('blocks', u.id, `${u.name}${u.code ? ' ' + u.code : ''}`, VOL.unitSvg(u, cg));
  for (const m of ['X', 'FW', 'RA', 'RB', 'DIS', 'REC', 'E', 'B', 'P', 'R5', 'R6', 'R7', 'A7', 'A56', 'GI', 'G', 'OOS', 'AIR']) add('markers', m, m, VOL.markSvg(m));
  return out;
}
if (import.meta.env.DEV || DEV_FAKE || SANDBOX || TUTORIAL) Object.assign(window, { __fab: { tut: () => tut, unitAt: (id: string) => { const m = pieces.children.find((o) => o.userData.unit === id || o.userData.chit === id); if (!m) return null; const r = canvas.getBoundingClientRect(), v = m.getWorldPosition(new THREE.Vector3()).project(cam); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }, game: () => g, setGame: (x: E.Game) => { g = x; hist.clear(); save(); refresh(); }, at: (a: number) => { const p = center(a), r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, 0, p.z).project(cam); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; }, project: (x: number, y: number, z: number) => { const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height }; }, online, setMatches: (m: Match[]) => { matches = m; }, iconList: () => Object.keys(ICONS).map((k) => ({ k, html: ico(k) })), fxDemo: () => FX_SAMPLES.map((f) => `<div class="fx ${f.cls}" style="position:static;animation:none;margin:8px;width:max-content">${ico(f.icon)}<b>${esc(f.head)}</b><small>${esc(f.text)}</small></div>`).join(''), sheets, setModal: (m: typeof modal) => { modal = m; render(); }, info: () => renderer.info.memory, rel: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls, trees: (REL?.props.children[0] as THREE.InstancedMesh | undefined)?.count }), board: () => boardCv.toDataURL("image/png"), view: (x: number, z: number, d: number, pt: number, yw: number) => { goal = { t: new THREE.Vector3(x, 0, z), dist: d, pitch: pt, fast: true }; yaw = yw; }, layout: () => ({ MW, MH, S, pieces: pieces.children.map((o) => ({ unit: o.userData.unit as string, x: o.position.x, z: o.position.z })) }), E, get g() { return g; }, set g(v: E.Game) { g = v; }, refresh, act, sel: (u: string, a?: number) => { selUnit = u; selArea = g.units.find((x) => x.id === u)!.area; previewArea = a ?? null; refresh(); } } });
