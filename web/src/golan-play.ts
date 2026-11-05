// FAB: Golan '73, hot-seat table (golan.html). The same 3D table as The Bulge, with the Golan board, pieces and engine
// (engine/src/golan). Both sides play on one device; the game is kept in this browser. Online play comes later.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import mapJson from '../../data/golan73/map.json';
import labelsJson from '../../data/golan73/labels.json';
import unitsJson from '../../data/golan73/units.json';
import * as G from '../../engine/src/golan';
import { drawLabel, drawEntry } from './board-art';
import { golanChitSvg, golanBlockSvg, golanBackSvg, GOLAN_WOOD, type GCounter, type GUnit as ArtUnit } from './golan-art';
import { loadChitArt, mapMarkerSvg } from './chits';
import { esc } from './util';

type Side = G.GSide;
type MapArea = { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number }; label: [number, number]; polygon: [number, number][] };
const MAP = mapJson as unknown as { size: [number, number]; areas: MapArea[]; entries: { letter: string; x: number; y: number }[]; assembly: Record<'A' | 'B', { box: [number, number, number, number]; name: string }> };
const LAB = labelsJson as unknown as Record<string, { x: number; y: number; w: number; h: number; mode: string; px: number; py: number; pr: number }>;
const [MW, MH] = MAP.size, S = MW / 86.36;                                  // the 34 x 22 in sheet, in cm
const toWorld = (x: number, y: number) => new THREE.Vector3(x / S - MW / (2 * S), 0, y / S - MH / (2 * S));
const $ = (q: string) => document.querySelector(q) as HTMLElement;
const NAME: Record<Side, string> = { israeli: 'Israeli', syrian: 'Syrian' };
const PHASE_NAME: Record<string, string> = { deploy: 'Set-up', reinforcement: 'Reinforcement', admin: 'Admin', movement: 'Movement', strategic: 'Strategic', combat: 'Combat', reaction: 'Reaction', btMove: 'Breakthrough move', btCombat: 'Breakthrough combat', supply: 'Supply' };
const boxCentre = (k: 'A' | 'B') => { const [x, y, w, h] = MAP.assembly[k].box; return [x + w / 2, y + h / 2] as [number, number]; };
const placeName = (a: number) => (a === G.ASSEMBLY.A ? 'Assembly Area A' : a === G.ASSEMBLY.B ? 'Assembly Area B' : `${a} ${G.area(a).name}`);

/* ---------- game state, saved in this browser; undo for moves that rolled no dice ---------- */
const KEY = 'fab-golan-hotseat';
let g: G.GGame = (() => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as G.GGame; } catch { /* storage off */ } return G.newGolanGame(Date.now() % 1e9); })();
const undoStack: string[] = [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* full or off */ } };
let toast = '', toastT = 0;
const say = (t: string) => { toast = t; clearTimeout(toastT); toastT = window.setTimeout(() => { toast = ''; render(); }, 4200); render(); };
/** Run an engine action; on an error nothing changes and the reason is shown. */
function act(f: () => void) {
  const before = JSON.stringify(g), rng = g.rng;
  try { f(); } catch (e) { g = JSON.parse(before); say((e as Error).message); return false; }
  if (g.rng === rng) undoStack.push(before); else undoStack.length = 0;                       // a roll cannot be taken back
  if (undoStack.length > 60) undoStack.shift();
  sel = null; pick = null; save(); refresh(); return true;
}
function undo() { const s = undoStack.pop(); if (!s) return say('Nothing to undo (dice already rolled).'); g = JSON.parse(s); sel = null; pick = null; save(); refresh(); }
/** Would this action be allowed? (Tried on a copy of the game.) */
function allowed(f: (x: G.GGame) => void) { const x = structuredClone(g); try { f(x); return true; } catch { return false; } }

/* ---------- three.js table ---------- */
const canvas = $('#gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101314);
const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-20, 50, 32); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 35, bottom: -35, far: 200 }); scene.add(sun);
const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1 }));
table.rotation.x = -Math.PI / 2; table.position.y = -0.02; scene.add(table);
const boardCv = document.createElement('canvas'); boardCv.width = MW * 2; boardCv.height = MH * 2;
const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8;
const board = new THREE.Mesh(new THREE.PlaneGeometry(MW / S, MH / S), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
const img = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(i); i.src = src; });
/** The board: ground, line work, then the printed labels (number plate, VPs, name) and the Syrian entry letters. */
async function paintBoard() {
  const [base, lines, syr, mut] = await Promise.all([img('./golan73/map-base.svg'), img('./golan73/map-lines.svg'), img('./icons/vp-golan-syrian.svg'), img('./icons/vp-mutual.svg')]);
  const c = boardCv.getContext('2d')!; c.drawImage(base, 0, 0, boardCv.width, boardCv.height); c.drawImage(lines, 0, 0, boardCv.width, boardCv.height);
  c.save(); c.scale(2, 2);
  const layers = { numbers: true, tdn: true, vp: true, names: true }, icons = { allied: syr, german: syr, mutual: mut };
  for (const a of MAP.areas) { const L = LAB[a.id]; c.save(); c.translate(L.x, L.y); drawLabel(c, a, layers, icons, L, { tdn: a.tdn, name: a.name, vp: { allied: a.vp.syrian, german: 0, mutual: a.vp.mutual } }); c.restore(); }
  for (const e of MAP.entries) { c.save(); c.translate(e.x, e.y); drawEntry(c, { letter: e.letter, side: 'german' }); c.restore(); }
  c.restore(); boardTex.needsUpdate = true;
}
/* area highlights: one flat shape per area (and per Assembly box), coloured as the situation asks */
const overlays = new Map<number, THREE.Mesh>();
const flat = (pts: [number, number][], id: number) => {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x / S - MW / (2 * S), -(y / S - MH / (2 * S)))));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.visible = false; scene.add(m); overlays.set(id, m);
};
for (const a of MAP.areas) flat(a.polygon, a.id);
for (const k of ['A', 'B'] as const) { const [x, y, w, h] = MAP.assembly[k].box; flat([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], G.ASSEMBLY[k]); }

/* pieces */
const pieces = new THREE.Group(); scene.add(pieces);
const texCache = new Map<string, THREE.Texture>();
const svgTex = (key: string, svg: string) => {
  let t = texCache.get(key); if (t) return t;
  t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(key, t);
  const im = new Image(); im.onload = () => { t!.image = im; t!.needsUpdate = true; }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return t;
};
const artUnit = (u: G.GUnit): ArtUnit => ({ id: u.id, name: u.name, side: u.side, steps: u.max, quality_by_step: u.q, symbol: u.symbol, division: u.division, kind: u.kind, start_area: undefined, arrival_turn: u.arrival, entry: u.entry });
const RAW_UNITS = new Map((unitsJson as unknown as ArtUnit[]).map((u) => [u.id, u]));
const blockSvg = (u: G.GUnit) => golanBlockSvg({ ...(RAW_UNITS.get(u.id) as ArtUnit), ...artUnit(u), start_area: (RAW_UNITS.get(u.id) as ArtUnit).start_area }, u.str);
const chitArt = (c: G.GChit) => golanChitSvg({ id: c.counter, kind: c.kind, side: c.side, name: c.name, turn: c.turn as number | string | null, quality: c.quality, area: c.area } as GCounter);
function blockMesh(u: G.GUnit) {
  const wood = new THREE.MeshStandardMaterial({ color: GOLAN_WOOD[u.side], roughness: 0.75 });
  const face = new THREE.MeshStandardMaterial({ map: svgTex(`${u.id}-${u.str}`, blockSvg(u)), roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.8), [wood, wood, wood, wood, face, wood]);
  m.position.y = 0.8; m.castShadow = true; m.userData.unit = u.id; return m;
}
function counterMesh(key: string, svg: string, size = 1.43) {
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 });
  const m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [edge, edge, new THREE.MeshStandardMaterial({ map: svgTex(key, svg), roughness: 0.7 }), edge, edge, edge]);
  m.castShadow = true; m.position.y = 0.06; return m;
}
const markerMesh = (code: string, size = 0.9) => { const svg = mapMarkerSvg(code); return svg ? counterMesh('mk:' + code, svg, size) : null; };
/** Where pieces of an area stand: the label file's piece spot; the Assembly areas: their box. */
const spot = (a: number) => (G.isAssembly(a) ? boxCentre(a === G.ASSEMBLY.A ? 'A' : 'B') : [LAB[a].px, LAB[a].py] as [number, number]);
function edgeMid(a: number, b: number) {
  const pa = MAP.areas.find((x) => x.id === a)!.polygon, pb = MAP.areas.find((x) => x.id === b)!.polygon, near: [number, number][] = [];
  for (const p of pa) if (pb.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 5)) near.push(p);
  if (!near.length) { const [x1, y1] = spot(a), [x2, y2] = spot(b); return [(x1 + x2) / 2, (y1 + y2) / 2]; }
  return [near.reduce((s, p) => s + p[0], 0) / near.length, near.reduce((s, p) => s + p[1], 0) / near.length];
}
function drawPieces() {
  pieces.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mat of ([] as THREE.Material[]).concat(m.material)) mat.dispose(); } }); pieces.clear();
  const byArea = new Map<number, G.GUnit[]>();
  for (const u of g.units) if (u.box === 'map' && u.area != null) (byArea.get(u.area) ?? byArea.set(u.area, []).get(u.area)!).push(u);
  const areasWith = new Set([...byArea.keys(), ...g.chits.filter((c) => c.box === 'map' && c.area != null && (c.stand || c.mission)).map((c) => c.area!), ...g.riverAssault, ...g.fieldWorks, ...Object.keys(g.roadblocks).map(Number)]);
  for (const a of areasWith) {
    const us = byArea.get(a) ?? [], [px, py] = spot(a), base = toWorld(px, py), two = G.isAssembly(a) ? false : us.some((u) => u.side === 'israeli') && us.some((u) => u.side === 'syrian');
    const rows: Record<Side, G.GUnit[]> = { syrian: us.filter((u) => u.side === 'syrian'), israeli: us.filter((u) => u.side === 'israeli') };
    for (const side of ['syrian', 'israeli'] as Side[]) {
      const list = rows[side], wide = G.isAssembly(a) ? 5 : 3;
      list.forEach((u, i) => {
        const m = blockMesh(u), col = i % wide, row = Math.floor(i / wide), n = Math.min(list.length, wide);
        m.position.x = base.x + (col - (n - 1) / 2) * 1.85; m.position.z = base.z + (two ? (side === 'syrian' ? -1.05 : 1.05) : 0) + row * 1.9 * (side === 'syrian' && two ? -1 : 1);
        if (g.battle?.area === a && ((g.battle.attPoint === u.id) || (g.battle.defPoint === u.id))) m.position.y += 0.25;
        if (sel === u.id) { m.position.y += 0.5; }
        pieces.add(m);
        const tags = [u.disorder === 1 ? 'DIS' : u.disorder === 2 ? 'REC' : '', u.exploit ? 'E' : '', u.unsupplied ? 'OOS' : ''].filter(Boolean);
        tags.forEach((t, k) => { const mk = markerMesh(t, 0.75); if (mk) { mk.position.set(m.position.x - 0.45 + k * 0.8, 1.7 + m.position.y - 0.8, m.position.z + 0.5); pieces.add(mk); } });
        if (u.reserve) { const r = counterMesh(`res-${u.side}`, golanChitSvg({ id: 'R', kind: 'reserve_marker', side: u.side, name: 'Reserve' }), 0.8); r.position.set(m.position.x + 0.45, 1.7 + m.position.y - 0.8, m.position.z - 0.45); pieces.add(r); }
      });
    }
    const standers = g.chits.filter((c) => c.box === 'map' && c.area === a && (c.stand || c.mission));
    standers.forEach((c, i) => { const m = counterMesh('chit:' + c.id, chitArt(c)); m.position.set(base.x + 2.9 + i * 1.6, 0.06, base.z + (two ? 0 : 0.2)); m.userData.chit = c.id; pieces.add(m); });
    const marks = [g.riverAssault.includes(a) ? 'RA' : '', g.fieldWorks.includes(a) ? 'FW' : '', g.roadblocks[a] ? 'RB' : ''].filter(Boolean);
    marks.forEach((t, i) => { const m = markerMesh(t); if (m) { m.position.set(base.x - 2.6 - i * 1.0, 0.06, base.z); pieces.add(m); } });
  }
  const edge = (keys: string[], svg: string, k: string) => { for (const key of keys) { const [a, b] = key.split('-').map(Number), [x, y] = edgeMid(a, b), m = counterMesh(k, svg, 1.0); const w = toWorld(x, y); m.position.set(w.x, 0.06, w.z); pieces.add(m); } };
  edge(g.minefields, golanChitSvg({ id: 'M01', kind: 'minefield', side: 'israeli', name: 'Minefield' }), 'mine');
  edge(g.bridgedDitch, golanChitSvg({ id: 'M13', kind: 'marker_at_ditch_bridged', side: 'none', name: 'AT Ditch Bridged' }), 'atb');
  edge(g.blownBridges, mapMarkerSvg('X') ?? '', 'blown');
}
function paintAreas() {
  const h = highlights();
  for (const [id, m] of overlays) { const c = h.get(id); const mat = m.material as THREE.MeshBasicMaterial; m.visible = !!c; if (c) { mat.color.setHex(c[0]); mat.opacity = c[1]; } }
}
const COL = { reach: 0x6fc24a, stop: 0xe7b04a, must: 0xd1432f, fight: 0xe7b04a, pick: 0x4aa3ff, sel: 0xffffff };
/** Area colours for the moment: where the selected block may go, the battles, the targets of an action. */
function highlights(): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  if (pick) { for (const a of pick.areas) out.set(a, [COL.pick, 0.45]); return out; }
  if (g.battle?.stage === 'retreat') { for (const a of G.retreatOptions(g, g.battle)) out.set(a, [COL.reach, 0.5]); return out; }
  if (sel) {
    const u = G.unit(g, sel);
    if (u.box === 'arriving') for (const a of G.arrivalOptions(g, sel)) out.set(a, [COL.reach, 0.45]);
    else if (u.box === 'deploy') for (const a of G.deployOptions(g, sel)) out.set(a, [COL.reach, 0.45]);
    else if (g.phase === 'strategic') for (const a of G.stratOptions(g, sel)) out.set(a, [COL.reach, 0.45]);
    else for (const r of G.moveOptions(g, sel)) out.set(r.area, [r.mustStop ? COL.stop : COL.reach, 0.42]);
    return out;
  }
  if ((g.phase === 'combat' || g.phase === 'btCombat') && !g.battle) {
    const must = new Set(G.mustFight(g));
    for (const a of fightable()) out.set(a, [must.has(a) ? COL.must : COL.fight, must.has(a) ? 0.4 : 0.26]);
  }
  if (g.battle) out.set(g.battle.area, [COL.sel, 0.25]);
  return out;
}
const fightable = () => [...G.areas.keys()].filter((a) => !g.fought.includes(a) && (G.contested(g, a) || G.newlyContested(g).includes(a)) && G.fighters(g, a, g.player, true).length);

/* ---------- camera ---------- */
const target = new THREE.Vector3(0, 0, 8); let yaw = 0, pitch = 1.05, dist = 84;
function placeCam() { cam.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(target); }
const ptrs = new Map<number, [number, number]>(); let moved = 0, pinch = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(120, Math.max(12, dist * pinch / d)); pinch = d; moved = 99; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey) { yaw -= dx * 0.006; pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006)); }
  else { const k = dist * 0.0018, c = Math.cos(yaw), s = Math.sin(yaw); target.x -= (dx * c + dy * s) * k; target.z -= (-dx * s + dy * c) * k; }
});
canvas.addEventListener('pointerup', (e) => { ptrs.delete(e.pointerId); if (moved < 6) click(e); });
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(120, Math.max(12, dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
const ray = new THREE.Raycaster();
function rayAt(e: PointerEvent) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); }
const inside = (x: number, y: number, poly: [number, number][]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
function areaAt(): number | null {
  const hit = ray.intersectObject(board)[0]; if (!hit) return null;
  const x = (hit.point.x + MW / (2 * S)) * S, y = (hit.point.z + MH / (2 * S)) * S;
  for (const k of ['A', 'B'] as const) { const [bx, by, bw, bh] = MAP.assembly[k].box; if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return G.ASSEMBLY[k]; }
  return MAP.areas.find((a) => inside(x, y, a.polygon))?.id ?? null;
}

/* ---------- what the player is doing ---------- */
let sel: string | null = null;                                                    // selected block
let pick: { areas: Set<number>; units?: Set<string>; label: string; run: (target: number | string) => void } | null = null;
let battleRolls = 0;                                                               // b.rolls already shown
const actor = (): Side => (g.phase === 'reaction' ? G.enemyOf(g.player) : g.player);
function click(e: PointerEvent) {
  rayAt(e);
  const hitPiece = ray.intersectObjects(pieces.children, false)[0]?.object;
  const uid = hitPiece?.userData.unit as string | undefined, a = areaAt();
  if (pick) {
    if (uid && pick.units?.has(uid)) return void pick.run(uid);
    if (a != null && pick.areas.has(a)) return void pick.run(a);
    pick = null; return refresh();
  }
  if (g.battle) { if (g.battle.stage === 'retreat' && a != null) act(() => G.chooseRetreat(g, g.battle!, a)); return; }
  if (sel && a != null && highlights().has(a)) {
    const u = G.unit(g, sel), id = sel;
    if (u.box === 'arriving') return void act(() => G.placeArrival(g, id, a));
    if (u.box === 'deploy') return void act(() => G.deploy(g, id, a));
    if (g.phase === 'strategic') return void act(() => G.stratMove(g, id, a));
    return void act(() => G.move(g, id, a));
  }
  if (uid) { const u = G.unit(g, uid); sel = sel === uid ? null : uid; if (u.side !== actor()) sel = uid; return refresh(); }
  if (a != null && (g.phase === 'combat' || g.phase === 'btCombat') && fightable().includes(a)) return void openBattle(a);
  if (a != null) { const mine = G.onMap(g, a).filter((u) => u.side === actor() && !u.kind); if (mine.length) { const i = sel ? mine.findIndex((u) => u.id === sel) : -1; sel = mine[(i + 1) % mine.length].id; return refresh(); } }
  sel = null; refresh();
}
function openBattle(a: number) {
  const reEngage = g.phase === 'btCombat' && !G.newlyContested(g).includes(a) && !(g.turn === 1 && g.player === 'syrian' && g.freeCombatRound > 0);
  if (reEngage) { const sa = G.saAvailable(g, g.player)[0]; if (!sa) return say('Fighting again here costs a Special Action, and none is available.'); return void act(() => { G.startBattle(g, a, { chitId: sa.id }); }); }
  act(() => { G.startBattle(g, a); }); battleRolls = 0;
}
/** Pick an area (or unit) for an action: the valid ones light up, a tap runs it. */
function pickArea(label: string, candidates: number[], test: (x: G.GGame, a: number) => void, run: (a: number) => void) {
  const ok = candidates.filter((a) => allowed((x) => test(x, a)));
  if (!ok.length) return say(`${label}: no area qualifies right now.`);
  pick = { areas: new Set(ok), label, run: (t) => { pick = null; run(t as number); } }; sel = null; refresh();
}
function pickUnit(label: string, test: (x: G.GGame, id: string) => void, run: (id: string) => void) {
  const ok = g.units.filter((u) => allowed((x) => test(x, u.id))).map((u) => u.id);
  if (!ok.length) return say(`${label}: no unit qualifies right now.`);
  const areasOf = new Set(ok.map((id) => G.unit(g, id).area).filter((a): a is number => a != null));
  pick = { areas: new Set(), units: new Set(ok), label, run: (t) => { pick = null; run(t as string); } };
  for (const a of areasOf) pick.areas.add(a);
  const prev = pick.run; pick.run = (t) => { if (typeof t === 'number') { const id = ok.find((x) => G.unit(g, x).area === t); if (id) prev(id); } else prev(t); };
  sel = null; refresh();
}
const ALL_AREAS = [...G.areas.keys()];
const pairPick = (label: string, test: (x: G.GGame, a: number, b: number) => void, run: (a: number, b: number) => void) =>
  pickArea(`${label}: first area`, ALL_AREAS, (x, a) => { if (!G.neighbors(a).some((b) => b < 100 && allowedOn(x, (y) => test(y, a, b)))) throw new Error(); },
    (a) => pickArea(`${label}: second area`, G.neighbors(a).filter((b) => b < 100), (x, b) => test(x, a, b), (b) => act(() => run(a, b))));
const allowedOn = (x: G.GGame, f: (y: G.GGame) => void) => { try { f(structuredClone(x)); return true; } catch { return false; } };

/* ---------- the actions a counter offers now ---------- */
type Opt = { label: string; run: () => void; test?: (x: G.GGame) => void };
function chitOptions(c: G.GChit): Opt[] {
  const side = c.side as Side, k = c.kind, o: Opt[] = [], b = g.battle;
  if (b && b.stage === 'setup') {
    if (['artillery', 'rocket_artillery', 'armor_asset', 'infantry_asset', 'engineer', 'task_force', 'commando'].includes(k)) o.push({ label: 'Commit to the battle', run: () => act(() => G.assign(g, g.battle!, c.id)), test: (x) => G.assign(x, x.battle!, c.id) });
    if (k === 'air_mission') {
      o.push({ label: 'Air support: fire as artillery', run: () => act(() => G.assign(g, g.battle!, c.id, 'arty')), test: (x) => G.assign(x, x.battle!, c.id, 'arty') });
      o.push({ label: 'Air support: back one unit', run: () => pickUnit('Unit to support', (x, id) => { const u = G.unit(x, id); if (u.side !== side || u.area !== x.battle!.area || u.kind === 'ghost') throw new Error(); G.assign(x, x.battle!, c.id, 'support', id); }, (id) => act(() => G.assign(g, g.battle!, c.id, 'support', id))) });
    }
    if (k === 'event_ew') o.push(side === b.attacker ? { label: 'Jam the defence (EW)', run: () => act(() => G.playJamming(g, g.battle!, c.id)), test: (x) => G.playJamming(x, x.battle!, c.id) } : { label: 'Countermeasures (+2)', run: () => act(() => G.answerJamming(g, g.battle!, c.id)), test: (x) => G.answerJamming(x, x.battle!, c.id) });
    if (k === 'event_counterbattery') o.push({ label: 'Counterbattery strike', run: () => act(() => G.playCounterbattery(g, g.battle!, c.id)), test: (x) => G.playCounterbattery(x, x.battle!, c.id) });
    if ((k === 'sa_block' || k === 'special_action_event') && side !== b.attacker) {
      o.push({ label: 'Retreat before combat', run: () => act(() => G.defenderRetreatSA(g, g.battle!, c.id)), test: (x) => G.defenderRetreatSA(x, x.battle!, c.id) });
      o.push({ label: 'Reinforce the battle', run: () => pickUnit('Unit to bring in', (x, id) => G.defenderReinforceSA(x, x.battle!, id, c.id), (id) => act(() => G.defenderReinforceSA(g, g.battle!, id, c.id))) });
    }
    return o.filter((x) => !x.test || allowed(x.test));
  }
  if (g.phase === 'btMove' && (k === 'sa_block' || k === 'special_action_event')) o.push({ label: 'Breakthrough move for an armor unit', run: () => pickUnit('Armor unit', (x, id) => G.activateBreakthrough(x, id, c.id), (id) => act(() => G.activateBreakthrough(g, id, c.id))) });
  if (g.phase === 'reinforcement' && (k === 'sa_block' || k === 'special_action_event')) o.push({ label: 'Reroute an arriving unit', run: () => pickUnit('Arriving unit', (x, id) => { if (!G.rerouteOptions(x, id).length) throw new Error(); }, (id) => pickArea('Entry area', G.rerouteOptions(g, id), (x, a) => G.reroute(x, id, a, c.id), (a) => act(() => G.reroute(g, id, a, c.id)))) });
  if (g.phase !== 'admin') return o;
  const area1 = (label: string, f: (x: G.GGame, a: number) => void) => o.push({ label, run: () => pickArea(label, ALL_AREAS, f, (a) => act(() => f(g, a))) });
  const unit1 = (label: string, f: (x: G.GGame, id: string) => void) => o.push({ label, run: () => pickUnit(label, f, (id) => act(() => f(g, id))) });
  const now = (label: string, f: (x: G.GGame) => void) => o.push({ label, run: () => act(() => f(g)), test: f });
  switch (k) {
    case 'engineer':
      o.push({ label: 'Blow a bridge', run: () => pairPick('Blow a bridge', (x, a, b2) => G.blowBridges(x, c.id, a, [b2]), (a, b2) => G.blowBridges(g, c.id, a, [b2])) });
      o.push({ label: 'Repair a bridge', run: () => pairPick('Repair a bridge', (x, a, b2) => G.repairBridge(x, c.id, a, b2), (a, b2) => G.repairBridge(g, c.id, a, b2)) });
      o.push({ label: 'Bridge the AT ditch', run: () => pairPick('Bridge the AT ditch', (x, a, b2) => G.bridgeDitch(x, c.id, a, b2), (a, b2) => G.bridgeDitch(g, c.id, a, b2)) });
      if (side === 'syrian') o.push({ label: 'Lift a minefield', run: () => pairPick('Lift a minefield', (x, a, b2) => G.removeMinefield(x, c.id, a, b2), (a, b2) => G.removeMinefield(g, c.id, a, b2)) });
      area1('Build field works', (x, a) => G.engineerFieldWorks(x, c.id, a));
      area1('Roadblock', (x, a) => G.roadblock(x, c.id, a));
      area1('Defended roadblock', (x, a) => G.roadblock(x, c.id, a, true));
      break;
    case 'air_mission': area1('Air interdiction', (x, a) => G.airInterdiction(x, c.id, a)); area1('Air reconnaissance', (x, a) => G.airRecon(x, c.id, a)); break;
    case 'commando': area1('Commando raid', (x, a) => G.placeRaid(x, c.id, a)); break;
    case 'event_release': now('Release the unit', (x) => G.playRelease(x, c.id)); break;
    case 'event_ssm_strike': now('Fire the SSMs', (x) => G.playSSM(x, c.id)); break;
    case 'event_king_hassan': now('Play the event', (x) => G.playKingHassan(x, c.id)); break;
    case 'event_lt_zvika': area1('Place Lt. Zvika', (x, a) => G.playLtZvika(x, c.id, a)); break;
    case 'replacement_arm': case 'replacement_mech': unit1('Add a step to a unit', (x, id) => G.playReplacement(x, c.id, id)); break;
    case 'event_arriving_battalion': {
      const bros = g.units.filter((u) => u.brigade === c.brigade);
      unit1('+2 steps to one unit', (x, id) => G.playArrivingBattalion(x, c.id, { add: id }));
      if (bros.length === 2) now('+1 step to each unit', (x) => G.playArrivingBattalion(x, c.id, { split: [bros[0].id, bros[1].id] }));
      for (const u of bros.filter((x) => x.box === 'eliminated')) for (const asm of ['A', 'B'] as const) now(`Bring back ${u.name} in Assembly ${asm}`, (x) => G.playArrivingBattalion(x, c.id, { rebuild: u.id, assembly: asm }));
      break;
    }
    case 'sa_block': case 'special_action_event':
      area1('Rally the troops', (x, a) => G.rally(x, side, a, c.id));
      unit1('Quality replacement', (x, id) => G.qualityReplacement(x, id, c.id));
      if (side === 'israeli') o.push({ label: 'Merge two units', run: () => pickUnit('Unit to fold in', (x, id) => { if (!x.units.some((v) => allowedOn(x, (y) => G.mergeUnits(y, id, v.id, c.id)))) throw new Error(); }, (from) => pickUnit('Unit that receives the steps', (x, id) => G.mergeUnits(x, from, id, c.id), (into) => act(() => G.mergeUnits(g, from, into, c.id)))) });
      if (side === 'syrian') now('Release the next 3rd Tank Division unit', (x) => G.releaseOperationalReserve(x, c.id));
      { const lost = g.chits.find((x) => x.side === side && x.box === 'eliminated' && x.kind === (side === 'syrian' ? 'sam' : 'air_mission')); if (lost) now(side === 'syrian' ? 'Replace a lost SAM' : 'Replace a lost air asset', (x) => G.replaceAsset(x, side, lost.id, c.id)); }
      break;
    case 'command_staff':
      unit1('Staff: replacement step', (x, id) => G.staffReplacement(x, c.id, id));
      unit1('Staff: reserve marker', (x, id) => G.staffReserve(x, c.id, id));
      unit1('Staff: reveal an enemy unit', (x, id) => G.staffIntel(x, c.id, id));
      break;
  }
  if (k.startsWith('event') || k === 'special_action_event') {
    const back = g.chits.filter((x) => x.side === side && x.box === 'eliminated' && allowed((y) => G.alternateEventUse(y, c.id, [x.id]))).slice(0, 2);
    if (back.length) now(`Instead: bring back ${back.map((x) => x.name).join(' and ')}`, (x) => G.alternateEventUse(x, c.id, back.map((y) => y.id)));
  }
  return o.filter((x) => !x.test || allowed(x.test));
}

/* ---------- HTML ---------- */
const acts: Record<string, () => void> = {}; let nAct = 0;
const reg = (f: () => void) => { const k = 'a' + nAct++; acts[k] = f; return k; };
const btn = (label: string, f: () => void, cls = '', dis = false, title = '') => `<button class="${cls}" data-do="${reg(f)}" ${dis ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`;
const chitUri = (c: G.GChit) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.kind === 'sa_block' ? golanBlockSvg({ id: c.id, name: c.name, side: c.side as Side, kind: 'special_action_block' }) : chitArt(c));
const unitUri = (u: G.GUnit) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(blockSvg(u));
let openChit: string | null = null, dockSide: Side | null = null;
const qual = (u: G.GUnit) => u.q[u.str - 1] ?? 'veteran';
function topBar() {
  const v = G.computeVictory(g), t = G.TURN_TRACK[g.turn], sd = t?.suddenDeath;
  const crumbs = (g.phase === 'deploy' ? ['deploy'] : ['reinforcement', ...G.PHASES]).map((p) => `<span class="${p === g.phase ? 'on' : ''}">${PHASE_NAME[p]}</span>`).join('');
  return `<header class="g-top"><a class="g-home" href="./">FAB</a><b class="g-title">Golan '73</b>
    <span class="g-turn">Turn ${g.turn}/${g.lastTurn}<small>${esc(t?.name ?? '')}${t?.night ? ' · night' : ''}</small></span>
    <span class="g-side ${actor()}">${NAME[actor()]} player</span>
    <span class="g-vp" title="Sudden death from turn 4: ${sd ? `Syria ${sd.syrian}, Israel ${sd.israeli} net VP` : 'not yet'}">VP ${v.leader ? `${NAME[v.leader]} +${v.net}` : 'even'}<small>Syr ${v.syrian} · Isr ${v.israeli}</small></span>
    <nav class="c-crumbs g-crumbs">${crumbs}</nav>
    <span class="g-tools">${btn('Undo', undo, 'ico', !undoStack.length, 'Take back the last move (not dice)')}${btn('New game', newGameMenu, 'ico')}</span></header>`;
}
function newGameMenu() {
  modal = `<div class="g-modal"><h2>New game</h2><p class="hint">Both sides play on this device.</p>
    ${btn('Operation Badr: historical set-up', () => { modal = ''; g = G.newGolanGame(Date.now() % 1e9, 'badr'); undoStack.length = 0; save(); refresh(); }, 'primary')}
    ${btn('Operation Badr: alternate set-up', () => { modal = ''; g = G.newGolanGame(Date.now() % 1e9, 'badr_alt'); undoStack.length = 0; save(); refresh(); })}
    ${btn('Cancel', () => { modal = ''; refresh(); }, 'ico')}</div>`;
  refresh();
}
let modal = '';
function unitCard(u: G.GUnit) {
  const st = [u.disorder === 1 ? 'disordered' : u.disorder === 2 ? 'recovering' : 'good order', u.reserve ? 'reserve' : '', u.exploit ? 'exploitation' : '', u.unsupplied ? 'unsupplied' : ''].filter(Boolean).join(' · ');
  const opts: string[] = [];
  if (u.box === 'map' && u.side === actor()) {
    if (g.phase === 'movement' || g.phase === 'deploy') opts.push(u.reserve ? btn('Remove reserve marker', () => act(() => G.setReserve(g, u.id, false))) : btn('Mark in reserve', () => act(() => G.setReserve(g, u.id, true)), '', !allowed((x) => G.setReserve(x, u.id, true))));
    if (['movement', 'reaction', 'btMove'].includes(g.phase)) opts.push(btn('Dig in (field works)', () => act(() => G.unitFieldWorks(g, u.id)), '', !allowed((x) => G.unitFieldWorks(x, u.id))));
  }
  const where = u.box === 'map' ? placeName(u.area!) : u.box === 'arriving' ? 'arriving: pick an entry area' : u.box === 'deploy' ? 'to place: pick an area' : u.box.replace(/_/g, ' ');
  const hint = u.box === 'map' && u.side === actor() ? (g.phase === 'strategic' ? (G.stratOptions(g, u.id).length ? 'Green areas: strategic move.' : 'Only supplied reserve units strat-move.') : G.moveOptions(g, u.id).length ? 'Green: move there. Amber: it must stop there.' : 'It cannot move now.') : '';
  return `<section class="g-unit"><img src="${unitUri(u)}" alt=""><div><h3>${esc(u.name)} <small>${NAME[u.side]}</small></h3>
    <p>${u.str}/${u.max} steps · ${qual(u)} · ${esc(where)}</p><p class="hint">${esc(st)}</p><p class="hint">${esc(hint)}</p><div class="row">${opts.join('')}</div></div></section>`;
}
function battlePanel(b: G.GBattle) {
  const att = b.attacker, def = G.enemyOf(att), A = (s: Side) => (s === att ? 'Attacker' : 'Defender');
  const kind = b.airAssault ? 'air assault' : b.assault ? 'crossing / river assault' : b.bt ? 'breakthrough combat' : 'combat';
  const side = (s: Side) => {
    const us = G.onMap(g, b.area).filter((u) => u.side === s), st = G.standing(g, b.area, s), as = [...b.assets[s].map((id) => G.chit(g, id)), ...b.air[s].map((a) => G.chit(g, a.id))];
    const point = s === att ? b.attPoint : b.defPoint;
    const row = (html: string, id: string, take = false) => `<li class="${id === point ? 'pt' : ''}">${html}${take && b.stage === 'setup' ? btn('×', () => act(() => G.unassign(g, g.battle!, id)), 'ico', false, 'Take back') : ''}</li>`;
    return `<div class="g-bside ${s}"><h4>${NAME[s]} · ${A(s)}</h4><ul>
      ${us.map((u) => row(`<img src="${unitUri(u)}" alt=""><span>${esc(u.name)} <small>${u.str}/${u.max} ${qual(u)}${u.disorder ? ' · dis.' : ''}${u.kind ? ` · ${u.kind}` : ''}</small></span>`, u.id)).join('')}
      ${st.map((c) => row(`<img src="${chitUri(c)}" alt=""><span>${esc(c.name)} <small>stands here</small></span>`, c.id)).join('')}
      ${as.map((c) => row(`<img src="${chitUri(c)}" alt=""><span>${esc(c.name)}${b.air[s].find((a) => a.id === c.id) ? ` <small>${b.air[s].find((a) => a.id === c.id)!.mode === 'arty' ? 'as artillery' : 'supporting ' + esc(G.unit(g, b.air[s].find((a) => a.id === c.id)!.unit!).name)}</small>` : ''}</span>`, c.id, true)).join('')}
      ${b.event[s] ? `<li><span>Event: ${esc(G.chit(g, b.event[s]!).name)}</span></li>` : ''}</ul></div>`;
  };
  const step = b.stage as string, firing: Record<string, [Side, 'arty' | 'ground', string]> = { attArty: [att, 'arty', 'artillery'], defArty: [def, 'arty', 'artillery'], defFire: [def, 'ground', 'defensive ground fire'], offFire: [att, 'ground', 'offensive ground fire'] };
  let body = '';
  const newRolls = b.rolls.slice(battleRolls);
  const rollHtml = newRolls.length ? `<div class="g-rolls">${newRolls.map((r) => `<div><b>${esc(r.who)}</b> <small>${r.kind === 'sam' ? 'SAM' : `needs ${r.sn} or less`}</small> ${r.dice.map((d) => `<i class="die ${(d === 1 || (d !== 10 && d <= r.sn)) && r.kind !== 'sam' ? 'hit' : ''}">${d}</i>`).join('')}${r.kind !== 'sam' ? ` <small>${r.hits} hit${r.hits === 1 ? '' : 's'}</small>` : ''}</div>`).join('')}</div>` : '';
  if (step === 'setup') {
    const lim = (s: Side) => { const l = G.limits(g, b, s); return `${l.artillery} artillery · ${l.battle} battle assets · ${l.air} air · 1 event`; };
    body = `<p class="hint">Commit assets from each side's Available Box (cards below; switch side with the tabs). ${esc(NAME[att])}: ${lim(att)}. ${esc(NAME[def])}: ${lim(def)}.</p>`;
    if (b.ew?.pending) body += `<p class="g-alert">${NAME[def]}: answer the jamming — play your EW card for +2, or ${btn('roll without it', () => act(() => G.answerJamming(g, g.battle!)))}.</p>`;
    if (g.samTarget) body += samPrompt();
    if (att === 'syrian' && G.area(b.area).syria === false && b.assets.syrian.some((id) => G.chit(g, id).kind === 'engineer')) {
      const ditch = G.neighbors(b.area).filter((n) => n < 100 && G.connection(b.area, n)?.atDitch && !g.bridgedDitch.includes(G.edgeKey(b.area, n)));
      if (ditch.length) body += `<p class="hint">Engineer: bridge the AT ditch instead of firing (14.51b): ${ditch.map((n) => btn(`towards ${n}`, () => act(() => G.setEngineerBridge(g, g.battle!, n)), b.engBridge === G.edgeKey(b.area, n) ? 'on' : '')).join(' ')}</p>`;
    }
    body += `<div class="row">${btn('Begin combat', () => { battleRolls = b.rolls.length; act(() => G.beginCombat(g, g.battle!)); }, 'primary', !!b.ew?.pending || !!g.samTarget)}${btn('Withdraw', () => act(() => G.cancelBattle(g)), 'ico', !!b.locked)}</div>`;
  } else if (firing[step]) {
    const [s, k, what] = firing[step], fl = G.fireList(g, b, s, k);
    body = `${rollHtml}<h4>${NAME[s]} ${what}</h4><table class="g-fire">${fl.map((f) => `<tr title="${esc(f.parts.map(([w, v]) => `${w} ${v >= 0 ? '+' : ''}${v}`).join(', '))}"><td>${esc(f.who)}</td><td>${f.dice} ${f.dice === 1 ? 'die' : 'dice'}</td><td>SN ${f.sn}</td></tr>`).join('')}</table>
      <div class="row">${btn(`Roll ${what}`, () => { battleRolls = b.rolls.length; act(() => G.rollStep(g, g.battle!)); }, 'primary')}</div>`;
  } else if (step === 'attFirst') {
    const opts = [b.attPoint!, ...b.assets[att].filter((id) => !['artillery', 'rocket_artillery'].includes(G.chit(g, id).kind))];
    body = `${rollHtml}<p>${NAME[att]}: the first hit is a step loss on the point unit or one battle asset.</p><div class="row">${opts.map((id) => btn(esc(g.units.find((u) => u.id === id)?.name ?? G.chit(g, id).name), () => act(() => G.chooseFirstLoss(g, g.battle!, id)))).join('')}</div>`;
  } else if (step === 'attChoice') {
    body = `${rollHtml}<p>${NAME[att]}: ${b.pending} more hit(s). Abort the attack (all attackers disordered${b.assault ? ', back across the boundary' : ''}) or take the losses?</p><div class="row">${btn('Take the losses', () => act(() => G.attackerChoice(g, g.battle!, false)), 'primary')}${btn('Abort the attack', () => act(() => G.attackerChoice(g, g.battle!, true)))}</div>`;
  } else if (step === 'defChoice') {
    const art = b.pendingKind === 'arty';
    body = `${rollHtml}<p>${NAME[def]}: ${b.pending} hit(s). ${art ? 'Absorb one by disordering all defending units?' : 'Absorb one by retreating all units?'}</p><div class="row">${btn(art ? 'Disorder to absorb one' : 'Retreat to absorb one', () => act(() => G.defenderChoice(g, g.battle!, true)))}${btn('Take the losses', () => act(() => G.defenderChoice(g, g.battle!, false)), 'primary')}</div>`;
  } else if (step === 'retreat') {
    body = `${rollHtml}<p>${NAME[b.retreat!.side]}: pick where ${esc(G.unit(g, b.retreat!.queue[0]).name)} retreats (green areas on the map).</p>`;
  } else if (step === 'exploit') {
    body = `${rollHtml}<p>Exploitation opportunity: each attacking armor unit may take a morale check for an exploitation marker.</p><div class="row">${btn('Roll the checks', () => { battleRolls = b.rolls.length; act(() => G.rollStep(g, g.battle!)); }, 'primary')}${btn('Decline', () => act(() => G.declineExploit(g, g.battle!)))}</div>`;
  } else if (step === 'done') {
    body = `${rollHtml}<p class="g-result">${esc(b.result ?? '')}</p><div class="row">${btn('Close', () => { battleRolls = 0; act(() => G.closeBattle(g)); }, 'primary')}</div>`;
  }
  return `<section class="g-battle"><h3>Battle for ${b.area} ${esc(G.area(b.area).name)} <small>${kind} · TDN ${G.area(b.area).tdn}</small></h3><div class="g-bsides">${side(att)}${side(def)}</div>${body}</section>`;
}
function samPrompt() {
  const sam = g.chits.filter((c) => c.kind === 'sam' && c.box === 'available'), air = G.chit(g, g.samTarget!);
  return `<p class="g-alert">Syria may fire a SAM at the Israeli ${esc(air.name)}${air.area != null ? ` over ${air.area}` : ''}: ${sam.length ? btn(`Fire a SAM (${sam.length} available)`, () => act(() => { G.fireSam(g, sam[0].id); })) : ''} ${btn('Let it fly', () => act(() => G.declineSam(g)))}</p>`;
}
/** What the player should do now, and whether the phase can end. */
function prompt(): [string, string | null] {
  if (g.result) return [`Game over: ${g.result}`, null];
  if (pick) return [`${pick.label}: tap a blue area${pick.units ? ' or block' : ''}.`, null];
  if (g.battle) return ['A battle is in progress: see the battle panel.', 'finish the battle'];
  if (g.samTarget) return ['Syria may answer the Israeli air mission with a SAM.', 'answer the air mission'];
  const arriving = g.units.filter((u) => u.box === 'arriving' && G.arrivalOptions(g, u.id).length);
  if (g.phase === 'deploy') return ['Place each unit: tap it in the tray, then a green area.', g.units.some((u) => u.box === 'deploy') ? 'place every unit' : null];
  if (g.phase === 'reinforcement') return [arriving.length ? 'Place the arriving units (tray below), then end the phase.' : 'Reinforcements are in. You may use the Special Action to reroute.', arriving.length ? 'place the arriving units' : null];
  if (g.phase === 'admin') return ['Admin: play events, engineers, air missions and Special Actions from the cards (both players).', null];
  if (g.phase === 'movement') return [`${NAME[actor()]} movement: tap a block, then a green area.`, null];
  if (g.phase === 'strategic') return ['Strategic movement: reserve units move by road through friendly areas.', null];
  if (g.phase === 'reaction') return [`${NAME[actor()]} reaction: reserve units may move.`, null];
  if (g.phase === 'btMove') return ['Breakthrough move: reserve and exploitation units (or one bought with a Special Action).', null];
  if (g.phase === 'combat' || g.phase === 'btCombat') {
    const must = G.mustFight(g);
    const aa = G.airAssaultTargets(g).length ? ' The 82nd Para may air-assault first.' : '';
    return [must.length ? `Combat is required in ${must.join(', ')} (red). Tap an area to fight.${aa}` : `Tap a contested area to fight, or end the phase.${aa}`, must.length ? 'fight the required battles' : null];
  }
  return ['', null];
}
function dock() {
  const s = dockSide ?? (g.battle ? g.battle.attacker : actor());
  const cards = g.chits.filter((c) => c.side === s && c.box === 'available');
  const tray = g.units.filter((u) => (u.box === 'arriving' || u.box === 'deploy') && (g.phase !== 'deploy' || u.side === (dockSide ?? u.side)));
  const tabs = (['syrian', 'israeli'] as Side[]).map((x) => btn(`${NAME[x]} <small>${g.chits.filter((c) => c.side === x && c.box === 'available').length}</small>`, () => { dockSide = x; openChit = null; refresh(); }, `tab ${x === s ? 'on' : ''}`)).join('');
  const oc = openChit ? g.chits.find((c) => c.id === openChit && c.box === 'available') : undefined, opts = oc ? chitOptions(oc) : [];
  const [msg, block] = prompt();
  const endBtn = g.result ? '' : btn(`End ${PHASE_NAME[g.phase].toLowerCase()} phase`, () => { dockSide = null; act(() => G.endPhase(g)); }, 'go', !!block, block ? `First ${block}` : '');
  const aa = (g.phase === 'combat' && !g.battle && G.airAssaultTargets(g).length) ? btn('82nd Para air assault', () => pickArea('Air assault', G.airAssaultTargets(g), (x, a) => G.airAssault(x, a), (a) => act(() => G.airAssault(g, a)))) : '';
  const rec = (['syrian', 'israeli'] as Side[]).flatMap((x) => (g.phase === 'reinforcement' ? g.recoverable[x] ?? [] : []).map((id) => btn(`Recover ${esc(G.chit(g, id).name)} (${NAME[x]})`, () => act(() => G.recoverAsset(g, x, id)))));
  return `<footer class="g-dock"><div class="g-prompt"><span>${esc(msg)}</span>${aa}${rec.join('')}${endBtn}</div>
    ${tray.length ? `<div class="g-tray">${tray.map((u) => `<button class="g-blk ${sel === u.id ? 'on' : ''}" data-do="${reg(() => { sel = sel === u.id ? null : u.id; refresh(); })}" title="${esc(u.name)}"><img src="${unitUri(u)}" alt="${esc(u.name)}"></button>`).join('')}</div>` : ''}
    <div class="g-hand"><div class="g-tabs">${tabs}</div><div class="g-cards">${cards.map((c) => `<button class="g-card ${openChit === c.id ? 'on' : ''}" data-do="${reg(() => { openChit = openChit === c.id ? null : c.id; refresh(); })}" title="${esc(c.name)}"><img src="${chitUri(c)}" alt="${esc(c.name)}"></button>`).join('') || '<span class="hint">No counters in the Available Box.</span>'}</div>
    ${oc ? `<div class="g-opts"><b>${esc(oc.name)}</b>${opts.length ? opts.map((x) => btn(esc(x.label), x.run)).join('') : '<span class="hint">Nothing to do with it right now.</span>'}</div>` : ''}</div></footer>`;
}
function side() {
  const parts: string[] = [];
  if (g.battle) parts.push(battlePanel(g.battle));
  else if (g.samTarget) parts.push(`<section>${samPrompt()}</section>`);
  if (sel && !g.battle) { const u = g.units.find((x) => x.id === sel); if (u) parts.push(unitCard(u)); }
  const boxes = (s: Side) => { const k = (b: G.Box) => g.units.filter((u) => u.side === s && u.box === b); const n = (b: G.ChitBox) => g.chits.filter((c) => c.side === s && c.box === b).length;
    return `<p class="hint">${NAME[s]}: cup ${n('cup')} · used ${n('used')} · eliminated ${n('eliminated')} counters, ${k('eliminated').length} blocks lost${s === 'syrian' ? ` · Op. reserve ${k('operational_reserve').length} · Strat. reserve ${k('strategic_reserve').length}` : ''} · reserve markers ${g.reserveMarkers[s]}</p>`; };
  parts.push(`<section class="g-boxes">${boxes('syrian')}${boxes('israeli')}</section>`);
  parts.push(`<section class="g-log">${g.log.slice(-9).reverse().map((l) => `<p><small>T${l.turn} ${PHASE_NAME[l.phase] ?? l.phase}</small> ${esc(l.text)}</p>`).join('')}</section>`);
  return `<aside class="g-panel">${parts.join('')}</aside>`;
}
function render() {
  for (const k of Object.keys(acts)) delete acts[k];
  $('#ui').innerHTML = topBar() + side() + dock() + (toast ? `<div class="g-toast">${esc(toast)}</div>` : '') + (modal ? `<div class="g-veil">${modal}</div>` : '') + (g.result ? `<div class="g-veil"><div class="g-modal"><h2>${esc(g.result)}</h2>${btn('New game', newGameMenu, 'primary')}</div></div>` : '');
}
$('#ui').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-do]') as HTMLElement | null; if (b) acts[b.dataset.do!]?.(); });
function refresh() { drawPieces(); paintAreas(); render(); }

/* ---------- loop ---------- */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function loop() { placeCam(); renderer.render(scene, cam); requestAnimationFrame(loop); }
await loadChitArt();
void golanBackSvg;
await paintBoard(); refresh(); loop();
(window as unknown as { __golan: unknown }).__golan = { game: () => g, openBattle, select: (id: string) => { sel = id; refresh(); }, tapArea: (a: number) => { if (pick?.areas.has(a)) pick.run(a); else if (sel && highlights().has(a)) { const u = G.unit(g, sel), id = sel; if (u.box === 'arriving') act(() => G.placeArrival(g, id, a)); else if (u.box === 'deploy') act(() => G.deploy(g, id, a)); else if (g.phase === 'strategic') act(() => G.stratMove(g, id, a)); else act(() => G.move(g, id, a)); } else if (g.battle?.stage === 'retreat') act(() => G.chooseRetreat(g, g.battle!, a)); } };
