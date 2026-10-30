import * as THREE from 'three';
import mapJson from '../../data/bulge/map.json';
import * as E from '../../engine/src';
import { labelSvg, garrisonSvg } from './art';
import { chitSvg } from './chits';
import { throwDice, clearDice, isHit, type DiceGroup } from './dice3d';

type MapArea = { id: number; label: [number, number]; polygon: [number, number][] };
type MapConn = { a: number; b: number; marker: [number, number] | null };
const MAP = mapJson as unknown as { size: [number, number]; areas: MapArea[]; connections: MapConn[] };
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
const POLE = new Map<number, [number, number]>(MAP.areas.map((a) => [a.id, pole(a.polygon)]));
/** Marker spot on the shared border of two areas (the scan carries no marker positions for most connections). */
function borderMid(a: number, b: number): [number, number] {
  const A = MAP.areas.find((x) => x.id === a)!, B = MAP.areas.find((x) => x.id === b)!, near = A.polygon.filter((p) => B.polygon.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8));
  if (near.length) { const mx = near.reduce((s, p) => s + p[0], 0) / near.length, my = near.reduce((s, p) => s + p[1], 0) / near.length; return [mx, my]; }
  const pa = POLE.get(a)!, pb = POLE.get(b)!; return [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const areaName = (a: number) => E.areas.get(a)!.name;

/* ---------- state ---------- */
const KEY = 'fab-demo2';
function load(): E.Game | null { try { const s = localStorage.getItem(KEY); if (!s) return null; const x = JSON.parse(s); return x.chits && x.markers && x.greif && x.roadblocks ? x : null; } catch { return null; } }
let g: E.Game = load() ?? E.newGame();
let selArea: number | null = null, selUnit: string | null = null, selChit: string | null = null, previewArea: number | null = null, hoverArea: number | null = null, msg = '', newOpts: E.Opts = { scenario: 'tournament', fuel: true };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* storage off: the game still runs */ } };

/* ---------- three.js scene ---------- */
const canvas = $('#gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101314);
const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-20, 50, 32); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 200 }); scene.add(sun);

const mapTex = new THREE.TextureLoader().load('./map.jpg'); mapTex.colorSpace = THREE.SRGBColorSpace;
mapTex.repeat.set(MW / 2448, 1); mapTex.anisotropy = 8;              // the scan is 2448 wide; the playing area is the left 1740 px
const board = new THREE.Mesh(new THREE.PlaneGeometry(MW / S, MH / S), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
/** Map art: the traced vector layers (default) or the original scan, which stays in the repo for the later 3D scenery pass. */
let art: 'vector' | 'scan' = (() => { try { return localStorage.getItem('fab-art') === 'scan' ? 'scan' : 'vector'; } catch { return 'vector'; } })();
let vecTex: THREE.CanvasTexture | null = null;
function applyArt() {
  const mat = board.material as THREE.MeshStandardMaterial;
  if (art === 'scan') { mat.map = mapTex; mat.needsUpdate = true; return; }
  if (vecTex) { mat.map = vecTex; mat.needsUpdate = true; return; }
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = MW * 2; c.height = MH * 2; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    vecTex = new THREE.CanvasTexture(c); vecTex.colorSpace = THREE.SRGBColorSpace; vecTex.anisotropy = 8; if (art === 'vector') applyArt();
  };
  img.src = './map-vector.svg';
}
const setArt = (a: 'vector' | 'scan') => { art = a; try { localStorage.setItem('fab-art', a); } catch { /* private mode */ } applyArt(); };
applyArt();
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

function block(u: E.Unit) {
  const w = 1.6, h = 1.6, d = 0.8;                                    // 16 x 16 x 8 mm block
  const wood = new THREE.MeshStandardMaterial({ color: BRIT.has(u.name) ? 0x3f6fb8 : WOOD[u.side], roughness: 0.75 });
  if (u.garrison) {
    const chit = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }), m = new THREE.Mesh(new THREE.BoxGeometry(1.43, 0.18, 1.43), [chit, chit, new THREE.MeshStandardMaterial({ map: svgTex(u.id, garrisonSvg(u.name, u.side === 'german')) }), chit, chit, chit]); // 9/16 in chit
    m.position.y = 0.09; m.castShadow = true; return m;
  }
  const face = new THREE.MeshStandardMaterial({ map: svgTex(`${u.id}-${u.str}`, labelSvg(u)), roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wood, wood, wood, wood, face, wood]);
  m.position.y = h / 2; m.castShadow = true;
  return m;
}
const markers = new THREE.Group(); scene.add(markers);
const tagTex = new Map<string, THREE.CanvasTexture>();
function tag(text: string, bg: string, size = 1.1) {
  let t = tagTex.get(text + bg);
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
    x.fillStyle = '#fff'; x.font = `bold ${text.length > 2 ? 46 : 60}px Arial Narrow, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagTex.set(text + bg, t); }
  const side = new THREE.MeshStandardMaterial({ color: bg }), m = new THREE.Mesh(new THREE.BoxGeometry(size, 0.12, size), [side, side, new THREE.MeshStandardMaterial({ map: t }), side, side, side]);
  m.castShadow = true; return m;
}
function drawPieces() {
  pieces.clear(); markers.clear();
  for (const a of MAP.areas) {
    const us = E.unitsIn(g, a.id), base = toWorld(...POLE.get(a.id)!), cont = E.contestedAreas(g).includes(a.id);
    us.forEach((u) => {
      const m = block(u), same = us.filter((x) => x.side === u.side), row = u.side === 'german' ? 1.1 : -1.1;
      m.position.x = base.x + (same.indexOf(u) - (same.length - 1) / 2) * 1.75; m.position.z = base.z + (cont ? row : 0.4);
      m.userData.unit = u.id; if (u.id === selUnit) { const o = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })); m.add(o); }
      pieces.add(m);
      const tags: [string, string][] = [];
      if (u.disorder && !u.garrison) { const k = tag(u.disorder === 1 ? 'DIS' : 'REC', u.disorder === 1 ? '#8a1f1f' : '#a8741a', 1.25); k.position.set(m.position.x, 1.66, m.position.z); markers.add(k); }
      if (u.reserve) tags.push(['R', '#2d6cb0']); if (u.exploit) tags.push(['E', '#d9741c']); if (u.unsupplied && !u.garrison) tags.push(['S', '#b8312f']); if (u.interdict) tags.push(['I', '#8a2f9c']); if (u.bcross) tags.push(['B', '#8a6a1c']);
      tags.forEach(([t, c], i) => { const k = tag(t, c, 0.6); k.position.set(m.position.x - 0.55 + i * 0.7, (u.garrison ? 0.3 : 1.75), m.position.z); markers.add(k); });
    });
    const area: [string, string][] = [];
    if (g.roadblocks[a.id]) area.push(['RB', '#6b4a8a']); if (g.interdicted[a.id]) area.push(['I', '#2f6fb0']); if (g.pooled === a.id) area.push(['P', '#3f8a5a']); if (g.airSupply?.area === a.id) area.push(['AS', '#2f6fb0']);
    if (g.fieldWorks.includes(a.id)) area.push(['FW', '#7a5a2b']); if (g.riverAssault.includes(a.id)) area.push(['RA', '#2a7fb8']);
    const owner = us.some((u) => u.side === g.control[a.id]) ? g.control[a.id] : us[0]?.side ?? g.control[a.id], grp = us.filter((u) => u.side === owner), gx = grp.length ? Math.max(...grp.map((u) => base.x + (grp.indexOf(u) - (grp.length - 1) / 2) * 1.75)) + 1.7 : base.x + 1.7, gz = base.z + (cont ? (owner === 'german' ? 1.1 : -1.1) : 0.4);
    area.forEach(([t, c], i) => { const k = tag(t, c, 1.1); k.position.set(gx + i * 1.3, 0.07, gz); markers.add(k); });
  }
  for (const k of Object.keys(g.greif)) { const [x, y] = k.split('-').map(Number), p = toWorld(...borderMid(x, y)), t = tag('G', '#8a2f9c', 1.2); t.position.set(p.x, 0.07, p.z - 1.3); markers.add(t); }
  for (const k of g.blown) { const [x, y] = k.split('-').map(Number), p = toWorld(...borderMid(x, y)), t = tag('X', '#d9421f', 1.5); t.position.set(p.x, 0.07, p.z); t.rotation.y = 0.4; markers.add(t); }
}
/** Map overlays: terrain defence numbers (TDN) or the army zones, tinted over the board. */
let tint: 'off' | 'tdn' | 'zones' = (() => { try { const t = localStorage.getItem('fab-tint'); return t === 'tdn' || t === 'zones' ? t : 'off'; } catch { return 'off'; } })();
const TDN_COL = [0xd9d26a, 0xe8a33d, 0xd9622b, 0x9c2a2a], ZONE_COL: Record<number, number> = { 5: 0x4c8ed9, 6: 0xc2429a, 7: 0x4fb06a };
const tintOf = (id: number) => (tint === 'tdn' ? TDN_COL[E.areas.get(id)!.tdn] : ZONE_COL[E.areas.get(id)!.zone]);
const cycleTint = () => { tint = tint === 'off' ? 'tdn' : tint === 'tdn' ? 'zones' : 'off'; try { localStorage.setItem('fab-tint', tint); } catch { /* private mode */ } refresh(); };
function paintAreas() {
  const strat = g.phase === 'strategic' && selUnit, opts = selUnit ? (strat ? E.stratOptions(g, selUnit).map((a) => ({ area: a, mustStop: false })) : E.moveOptions(g, selUnit)) : [];
  const fight = g.phase === 'combat' || g.phase === 'btCombat' ? E.contestedAreas(g).filter((a) => !g.fought.includes(a)) : [], must = new Set(E.mustFight(g));
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial; let c = 0xffffff, o = 0; const r = opts.find((x) => x.area === id);
    if (r) { c = r.mustStop ? 0xff8a3d : 0x37d67a; o = 0.32; } else if (fight.includes(id)) { c = must.has(id) ? 0xff4d4d : 0xffc542; o = 0.28; }
    if (id === (previewArea ?? hoverArea) && r) { c = 0xffe08a; o = 0.5; }
    if (id === selArea && !selUnit) { c = 0x4aa3ff; o = Math.max(o, 0.3); }
    const ar = arrOpts().find((x) => x.area === id); if (ar) { c = ar.sa ? 0xff8a3d : 0x37d67a; o = 0.45; }
    if (g.battle?.stage === 'retreat' && E.retreatOptions(g, g.battle).includes(id)) { c = 0x37d67a; o = 0.5; }
    if (o === 0 && tint !== 'off') { c = tintOf(id); o = 0.38; }
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
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const btn = (label: string, f: () => void, cls = '', dis = false, title = '') => `<button class="${cls}" data-do="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(title)}">${label}</button>`;
const sideName = (s: E.Side) => (s === 'german' ? 'German' : 'Allied');
const PHASE_NAME: Record<E.Phase, string> = { reinforcement: 'Reinforce', admin: 'Admin', movement: 'Move', strategic: 'Strat', combat: 'Combat', reaction: 'Reaction', btMove: 'Break. move', btCombat: 'Break. combat', supply: 'Supply' };
const pips = (u: E.Unit) => Array.from({ length: u.str }, () => `<i class="pip ${E.quality(u)}"></i>`).join('');
const ABBR: Record<string, string> = { artillery: 'Arty', rocket_artillery: 'Rkt', engineer: 'Eng', armor_asset: 'Armor', infantry_asset: 'Inf', task_force: 'TF', fuel: 'Fuel', command_staff: 'Staff', sa_block: 'SA', replacement_inf: 'Repl inf', replacement_arm: 'Repl arm',
  rebuild_or_replace_inf: 'Rebuild inf', rebuild_or_replace_arm: 'Rebuild arm', event_arriving_regiment: 'Regt', special_action_event: 'SA event', air_mission: 'Air', event_release: 'Release', event_greif_bridge: 'Greif bridge', event_greif_interdict: 'Greif interdict', event_bodenplatte: 'Bodenplatte', event_delayed_response: 'Delayed' };
const chitLabel = (c: E.Chit) => `${ABBR[c.kind] ?? c.kind}${['fuel', 'sa_block', 'special_action_event', 'air_mission', 'replacement_inf', 'replacement_arm', 'event_delayed_response'].includes(c.kind) || c.name.length > 14 ? '' : ' ' + c.name}${c.turn !== 'S' && E.isEvent(c) ? ' T' + c.turn : ''}`;
const chitChip = (c: E.Chit, extra = '') => `<button class="chit ${c.side} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" title="${esc(c.name + ' · ' + c.ech)}">${esc(chitLabel(c))}${extra}</button>`;
function chitPanel(c: E.Chit): string {
  const a = selArea, out: string[] = [], u = selUnit ? g.units.find((x) => x.id === selUnit)! : null;
  const head = `<div><h2>${c.side === 'german' ? 'German' : 'Allied'} ${esc(ABBR[c.kind] ?? c.kind)}</h2><h3>${esc(c.name)}</h3><p class="hint">${esc(c.ech)} · in the ${c.box} box</p></div>`;
  if (c.box !== 'available') return head + '<p class="hint">Only chits in the Available Box can be used.</p>';
  if (g.phase !== 'admin') return head + `<p class="hint">${E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission' ? 'This chit is assigned to a battle during the Combat Phase.' : c.kind === 'fuel' ? 'Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.' : c.kind === 'sa_block' || c.kind === 'special_action_event' ? 'Special Actions are spent in battles (reinforce / retreat), Breakthrough phases and the Admin Phase.' : 'Events are played in the Admin Phase.'}</p>`;
  if (c.kind === 'engineer') {
    if (a == null) out.push('<p class="hint">Click an area on the map: the engineer works from there.</p>');
    else {
      out.push(`<p class="hint">From ${esc(areaName(a))}:</p>`);
      const bt = E.bridgeTargets(g, c.side, a), rt = E.repairTargets(g, c.side, a);
      bt.forEach((t) => out.push(btn(`Blow bridge → ${esc(areaName(t))}`, () => E.blowBridges(g, c.id, a, [t]))));
      if (bt.length > 1) out.push(btn('Blow both bridges', () => E.blowBridges(g, c.id, a, bt.slice(0, 2))));
      rt.forEach((t) => out.push(btn(`Repair bridge → ${esc(areaName(t))}`, () => E.repairBridge(g, c.id, a, t))));
      out.push(btn('Build field works here', () => E.fieldWorksFor(g, c.id, a)));
      if (E.roadblockAreas(g, c.side).includes(a)) out.push(btn('Roadblock here', () => E.roadblock(g, c.id, a, false), '', false, '4.34'), btn('Defended roadblock (engineer stays)', () => E.roadblock(g, c.id, a, true), '', false, '4.35'));
    }
  } else if (c.kind.startsWith('replacement') || c.kind === 'event_arriving_regiment' || c.kind.startsWith('rebuild')) {
    const el = g.units.filter((x) => E.eligibleForStep(g, c, x));
    el.forEach((x) => out.push(btn(`+1 step: ${esc(x.name)} (${x.str}/${x.max}) in ${esc(areaName(x.area!))}`, () => E.playReplacement(g, c.id, x.id))));
    if (!el.length) out.push('<p class="hint">No reduced, supplied unit of the right class and Higher Echelon.</p>');
    if (c.kind.startsWith('rebuild')) g.units.filter((x) => x.area == null && x.max === 1 && x.side === c.side && x.q[0] !== 'elite' && !x.garrison && (c.kind.endsWith('arm') === (x.cls === 'armor')) && x.str === 0).forEach((x) => out.push(a == null ? '<p class="hint">Select an objective area to return an eliminated unit.</p>' : btn(`Return ${esc(x.name)} to ${esc(areaName(a))}`, () => E.playRebuild(g, c.id, x.id, a))));
  } else if (c.kind === 'special_action_event' || c.kind === 'sa_block') {
    if (a != null) out.push(btn(`Rally the troops around ${esc(areaName(a))}`, () => E.rally(g, g.control[a], a)));
    if (u) out.push(btn(`Quality replacement: ${esc(u.name)}`, () => E.qualityReplacement(g, u.id)));
    if (a == null && !u) out.push('<p class="hint">Select an area (rally) or a block (quality replacement).</p>');
  } else if (c.kind === 'air_mission') {
    out.push(a == null ? '<p class="hint">Select an area to interdict (Germans pay +1 MP to enter and leave it). In battles it works as artillery or +2 support; at the end of the turn it can air-supply an area.</p>' : btn(`Interdict ${esc(areaName(a))}`, () => E.playInterdiction(g, c.id, a)));
  } else if (c.kind === 'command_staff') {
    if (c.side === 'german') out.push(u && u.side === 'german' ? btn(`Boundary crossing: ${esc(u.name)}`, () => E.staffBoundary(g, c.id, u.id), '', false, '14.62a') : '<p class="hint">Select a German block for Boundary Crossing Pre-authorized.</p>');
    else out.push(a != null ? btn(`Pool assets in ${esc(areaName(a))}`, () => E.staffPool(g, c.id, a), '', false, '14.62b') : '<p class="hint">Select an area to pool assets there.</p>');
    if (u && u.side !== c.side) out.push(btn(`Intelligence: reveal ${esc(u.name)}`, () => E.staffIntel(g, c.id, u.id), '', false, '8.32'));
    g.units.filter((x) => x.side === c.side && x.cls === 'infantry' && x.area != null && !x.garrison && x.str < x.max).forEach((x) => out.push(btn(`Replacements found: ${esc(x.name)}`, () => E.staffReplacement(g, c.id, x.id))));
    if (u && u.side === c.side) out.push(btn(`Reserves: mark ${esc(u.name)}`, () => E.staffReserve(g, c.id, u.id), '', !E.canReserve(g, u)));
  } else if (c.kind === 'event_greif_bridge') {
    if (a == null) out.push('<p class="hint">Select an area: the bridges on its river boundaries are offered.</p>');
    else E.neighbors(a).filter((t) => E.connection(a, t)!.river && !g.blown.includes(a < t ? `${a}-${t}` : `${t}-${a}`)).forEach((t) => out.push(btn(`Place on bridge ${esc(areaName(a))} – ${esc(areaName(t))}`, () => E.playGreifBridge(g, c.id, a, t))));
  } else if (c.kind === 'event_greif_interdict') {
    out.push(u && u.side === 'allied' ? btn(`Interdict ${esc(u.name)}`, () => E.playInterdict(g, c.id, u.id)) : '<p class="hint">Select an Allied block on the map.</p>');
  } else if (c.kind === 'event_bodenplatte') { out.push(btn(`Strike Allied air missions (${E.boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission').length} in the Available Box)`, () => E.playBodenplatte(g, c.id), 'primary')); }
  else if (c.name === 'v.d. Heydte' && E.heydteWindow(g, c)) {
    out.push('<p class="hint">Just drawn: it may parachute into a vacant Allied-controlled Hohes Venn or Stoumont, otherwise it stays a battle asset.</p>', btn('Drop at Hohes Venn', () => E.heydteDrop(g, c.id, 31)), btn('Drop at Stoumont', () => E.heydteDrop(g, c.id, 52)));
  } else if (c.kind === 'event_release') { [4, 6].forEach((ar) => out.push(btn(`Enter at ${esc(areaName(ar))}`, () => E.releaseUnit(g, c.id, ar as 4 | 6)))); }
  else if (c.kind === 'fuel') out.push('<p class="hint">Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.</p>');
  else if (E.isArty(c) || E.isBattleAsset(c) || (c.kind as string) === 'air_mission') out.push('<p class="hint">Assigned to a battle in the Combat Phase.</p>');
  if (E.isEvent(c) && c.kind !== 'sa_block') out.push(btn('Use as alternate event (2 assets back to the cup)', () => E.alternateUse(g, c.id), '', false, '4.21'));
  return head + `<div class="row">${out.join('')}</div>`;
}

/* ---------- flow ---------- */
const STEPS = ['Prepare', 'Move', 'Fight', 'Breakthrough', 'Supply'], STEP_OF: Record<E.Phase, number> = { reinforcement: 0, admin: 0, movement: 1, strategic: 1, combat: 2, reaction: 2, btMove: 3, btCombat: 3, supply: 4 };
const other = E.other;
const fightable = () => E.contestedAreas(g).filter((a) => !g.fought.includes(a));
function idle(): boolean {                                                // phases with nothing to do are skipped for the player
  const p = g.phasing, o = other(p), us = (s: E.Side) => g.units.filter((u) => u.side === s && u.area != null && !u.garrison);
  switch (g.phase) {
    case 'reinforcement': return !g.tfNew.length && !g.pendingArrivals.length;
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
let hist: string[] = [], note = '', selArr: string | null = null;
/** One game action. Snapshots let the player undo until a die has been rolled; a failed action leaves the game untouched. */
function act(f: () => void, after = '') {
  const snap = JSON.stringify(g), r0 = g.rolls;
  try { f(); msg = ''; auto(); note = after; if (g.rolls !== r0) hist = []; else { hist.push(snap); if (hist.length > 60) hist.shift(); } }
  catch (e) { g = JSON.parse(snap); say((e as Error).message); }
  save(); refresh();
}
function undo() { const s = hist.pop(); if (!s || g.battle?.stage === 'retreat' && false) return; g = JSON.parse(s); selUnit = selChit = selArr = previewArea = hoverArea = null; note = ''; save(); refresh(); }
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !(e.target as HTMLElement)?.matches?.('input,select')) { e.preventDefault(); undo(); } });
const tfAreas = () => [...E.areas.keys()].filter((a) => g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
function arrOpts(): { area: number; sa: boolean }[] {
  if (!selArr || g.phase !== 'reinforcement') return [];
  return g.pendingArrivals.includes(selArr) ? E.arrivalOptions(g, selArr) : g.tfNew.includes(selArr) ? tfAreas().map((area) => ({ area, sa: false })) : [];
}

/* ---------- camera focus ---------- */
type Goal = { t: THREE.Vector3; dist: number; pitch: number } | null; let goal: Goal = null, saved: Goal = null, inBattle = false;
function syncBattleCam() {
  if (g.battle && !inBattle) { saved = { t: target.clone(), dist, pitch }; const a = E.areas.get(g.battle.area)!, p = toWorld(...POLE.get(a.id)!); goal = { t: new THREE.Vector3(p.x, 0, p.z + 3.2), dist: 17, pitch: 1.0 }; }
  if (!g.battle && inBattle && saved) goal = saved;
  inBattle = !!g.battle;
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
  const rb = g.battle;
  if (rb?.stage === 'retreat' && area != null && E.retreatOptions(g, rb).includes(area)) return act(() => E.chooseRetreat(g, rb, area));
  if (g.pendingBlow || g.battle) return;
  if (selArr && area != null && arrOpts().some((o) => o.area === area)) { const id = selArr; selArr = null; return act(() => { if (g.pendingArrivals.includes(id)) E.placeArrival(g, id, area); else E.placeTaskForce(g, id, area); }); }
  if (selUnit && area != null && optsFor(selUnit).some((o) => o.area === area)) { previewArea = area; refresh(); return; }
  if ((g.phase === 'combat' || g.phase === 'btCombat') && area != null && fightable().includes(area)) { selArea = area; selUnit = null; return act(() => { E.startBattle(g, area, g.phase === 'btCombat'); lastFire = []; }); }
  if (unit) { selUnit = unit; selArea = g.units.find((x) => x.id === unit)!.area; } else { selArea = area; selUnit = null; }
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
  if (!selUnit && (g.phase === 'combat' || g.phase === 'btCombat') && !g.battle) { const must = E.mustFight(g); for (const a of fightable()) out.push({ area: a, text: must.includes(a) ? 'FIGHT' : 'fight?', cls: must.includes(a) ? 'war' : 'opt' }); }
  if (tint !== 'off') for (const a of E.areas.values()) out.push({ area: a.id, text: tint === 'tdn' ? `TDN ${a.tdn}` : `Z${a.zone}`, cls: 'tint' });
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
  const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
  for (const [k, d] of badgeEls) { const p = d.classList.contains('tint') ? toWorld(...(MAP.areas.find((x) => x.id === +k)!.label)).add(new THREE.Vector3(0, 0, 2.3)) : center(+k); v.set(p.x, 0.5, p.z + 1.6).project(cam); d.style.display = v.z < 1 ? '' : 'none'; d.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`; }
}

/* ---------- battle state shared with the view ---------- */
interface RollView { title: string; groups: (DiceGroup & { parts: [string, number][]; hits: number })[]; pos: { x: number; y: number; group: number; v: number }[] | null }
let rollView: RollView | null = null, lastFire: E.Fire[] = [], modal: 'menu' | 'boxes' | null = null, handSide: E.Side | null = null;
const STAGE_NAME: Record<string, string> = { attArty: 'artillery', defArty: 'artillery', defFire: 'Defensive fire', offFire: 'Offensive fire' };
function rollStage(b: E.Battle) {
  const side = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker), kind = b.stage.endsWith('Arty') ? 'arty' : 'ground', fl = E.fireList(g, b, side, kind), n0 = b.rolls.length, stage = b.stage;
  E.roll_step(g, b); save();
  const fresh = b.rolls.slice(n0);
  rollView = { title: `${side === 'german' ? 'German' : 'Allied'} ${STAGE_NAME[stage]}`, pos: null, groups: fresh.map((r) => ({ label: r.who, col: r.kind === 'arty' ? 's' : side === 'german' ? 'k' : 'w', sn: r.sn, dice: r.dice, hits: r.hits, parts: fl.find((f) => f.who === r.who)?.parts ?? [] })) };
  if (!rollView.groups.length) { rollView = null; return refresh(); }
  refresh();
  const cv = $('#dice') as HTMLCanvasElement; cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => { if (rollView) { rollView.pos = p; render(); } });
}
function endRoll() { rollView = null; clearDice(); ($('#dice') as HTMLElement).style.display = 'none'; refresh(); }

/* ---------- cards and drag and drop ---------- */
const ICONS: Record<string, string> = {
  artillery: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  rocket_artillery: '<path d="M5 19l5-5M14 4c4 0 6 2 6 6-2 3-4 5-8 7l-5-5c2-4 4-6 7-8z"/><circle cx="15" cy="9" r="1.5"/><path d="M5 14l-2 4 4-2M10 19l-2 3 4-2"/>',
  engineer: '<path d="M3 20V9h3V6h3v3h6V6h3v3h3v11zM3 20h18M9 20v-5h6v5"/>',
  armor_asset: '<rect x="3" y="12" width="18" height="6" rx="3"/><path d="M7 12V8h8l2 4M15 9h7"/>',
  infantry_asset: '<rect x="3" y="6" width="18" height="12"/><path d="M3 6l18 12M21 6L3 18"/>',
  task_force: '<path d="M6 21V4M6 5h12l-3 4 3 4H6"/>',
  fuel: '<path d="M7 5h8l2 3v13H7zM9 5V3h4v2M10 12h4M17 11h3v6"/>',
  command_staff: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
  air_mission: '<path d="M2 14l9-2 3-9h2l-1 9 6 2v2l-6-1-1 5 2 1v1l-4-1-4 1v-1l2-1-1-5-7 1z"/>',
  sa_block: '<path d="M5 17l7-7 7 7M5 11l7-7 7 7"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>', undo: '<path d="M9 7L4 12l5 5M4 12h10a5 5 0 010 10h-2"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', boxes: '<rect x="3" y="4" width="18" height="5"/><path d="M5 9v10h14V9M10 13h4"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>', plus: '<path d="M12 5v14M5 12h14"/>',
};
const ico = (k: string, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] ?? '<rect x="5" y="5" width="14" height="14"/>'}</svg>`;
const chitUri = new Map<string, string>();
const chitImg = (c: E.Chit) => { let u = chitUri.get(c.id); if (!u) { u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(chitSvg(c)); chitUri.set(c.id, u); } return u; };
const card = (c: E.Chit, r = 0, why: string | null = null) => `<div tabindex="0" role="button" class="card2 ${c.side} ${why ? 'bad' : ''} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" style="--r:${r}deg" title="${esc(why ?? c.name + ' · ' + c.ech)}" aria-label="${esc(c.name)}"><img alt="" draggable="false" src="${chitImg(c)}"></div>`;
const fan = (cs: string[]) => cs.map((h, i) => h.replace('--r:0deg', `--r:${((i - (cs.length - 1) / 2) * Math.min(5, 40 / cs.length)).toFixed(1)}deg`)).join('');
function drag(ev: PointerEvent, el: HTMLElement) {
  const id = el.dataset.chit!, c = E.chit(g, id), x0 = ev.clientX, y0 = ev.clientY; let ghost: HTMLElement | null = null, over: Element | null = null;
  const at = (e: PointerEvent) => document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.side && (n as HTMLElement).dataset?.zone || (n as HTMLElement).dataset?.unit);
  const mv = (e: PointerEvent) => {
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) { ghost = el.cloneNode(true) as HTMLElement; ghost.classList.add('ghost'); document.body.appendChild(ghost); }
    if (!ghost) return; ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    const z = at(e) ?? null; if (z !== over) { over?.classList.remove('over'); over = z; over?.classList.add('over'); }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost?.remove(); over?.classList.remove('over');
    const b = g.battle; if (!b || b.stage !== 'setup') { if (!ghost) { selChit = selChit === id ? null : id; refresh(); } return; }
    const z = ghost ? at(e) as HTMLElement | undefined : undefined, s = c.side;
    let zone = z?.dataset.zone, unit = z?.dataset.unit;
    if (!ghost) zone = E.isArty(c) || c.kind === 'air_mission' ? 'arty' : 'asset';               // a plain click files the card where it belongs
    if (!zone && !unit) return;
    const why = E.canAssign(g, b, s, c) ?? (z?.dataset.side && z.dataset.side !== s ? 'That slot belongs to the other side' : null) ?? (zone === 'arty' && c.kind === 'engineer' ? 'Engineers go in the Assets slot' : zone === 'asset' && (E.isArty(c)) ? 'Artillery goes in the Artillery slot' : null);
    if (why) return say(why);
    act(() => { if (c.kind === 'air_mission') { if (unit) E.assign(g, b, id, 'support', unit); else E.assign(g, b, id, 'arty'); } else E.assign(g, b, id); });
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

/* ---------- views ---------- */
const nm = (s: E.Side) => (s === 'german' ? 'German' : 'Allied');
function topBar() {
  const v = E.victory(g), tr = E.TRACK[g.turn - 1], i = g.phasing === 'german' ? 0 : 1, at = STEP_OF[g.phase];
  return `<div class="c-bar t"><button class="ico" data-modal="menu" title="Menu, log and new game" aria-label="Menu, log and new game">${ico('menu')}</button><div class="c-crumbs">${STEPS.map((s, k) => `<span class="${k === at ? 'on' : k < at ? 'done' : ''}">${s}</span>`).join('')}</div>
    <button class="ico ${tint !== 'off' ? 'on' : ''}" data-tint title="Map overlay: terrain defence / army zones / off" aria-label="Map overlay">${ico('layers')}</button><button class="ico" data-undo title="Undo (Ctrl+Z)" aria-label="Undo" ${hist.length ? '' : 'disabled'}>${ico('undo')}</button><div class="c-stat"><span>TURN<b>${g.turn}</b></span><span>SIDE<b class="${g.phasing}">${nm(g.phasing).slice(0, 3).toUpperCase()}</b></span><span>NET VP<b>${v.net > 0 ? 'GE +' + v.net : v.net < 0 ? 'AL +' + -v.net : '0'}</b></span><span title="Draws this phase (German / Allied)">DRAW<b>${tr.ge[i]}/${tr.al[i]}</b></span><button class="ico" data-modal="boxes" title="Chit boxes" aria-label="Chit boxes">${ico('boxes')}</button></div></div>`;
}
function prompt() {
  const b = g.battle;
  if (note && !b && hist.length) return `${esc(note)} <button data-do="${reg(() => undo())}">Undo</button>`;
  if (g.over) return `<b>${esc(g.over)}</b>`;
  if (g.pendingBlow) return `<b>${nm(other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side))}</b>: attempt to blow the bridge?`;
  if (b?.stage === 'retreat') return '<b>Choose where the unit retreats.</b> Click a green area or a button.';
  if (b) return b.stage === 'setup' ? '<b>Drag cards onto the slots.</b> Only assets that can join are in your hand. Click a block to make it the point unit.' : b.stage === 'done' ? `<b>${esc(b.result ?? '')}</b>` : rollView ? 'Dice are cast automatically. <b>1 always hits, 10 always misses.</b>' : b.stage.endsWith('Choice') ? 'Choose how to take the hits.' : `Next: <b>${STAGE_NAME[b.stage]}</b>`;
  const m = E.mustFight(g).length;
  switch (g.phase) {
    case 'reinforcement': return '<b>Select a new block or chit</b> in the tray; its legal entry areas light up. Unplaced blocks enter automatically when you end the step.';
    case 'admin': return 'Chits were drawn. <b>Click a card</b> to use engineers, events, staff or Special Actions, or end the step.';
    case 'movement': return selUnit ? 'Click a <b>green</b> area to preview the route, then press <b>Move here</b>. <b>Orange</b>: must stop there.' : '<b>Select one of your blocks</b> to move it. Moves over 3 MP cost the Germans a fuel asset.';
    case 'strategic': return '<b>Select a reserve block</b>, then a green area to strategic-move.';
    case 'combat': case 'btCombat': return m ? `<b>${m} battle(s) must be fought.</b> Click a red area.` : fightable().length ? '<b>Click a contested area</b> to start a battle, or end the step.' : 'No battles left.';
    case 'reaction': return `<b>${nm(other(g.phasing))} reserves</b> may react: select a reserve block.`;
    case 'btMove': return '<b>Reserve and exploitation blocks</b> may move. Select one.';
    default: return 'Supply is checked automatically.';
  }
}
function primary(): { label: string; fn: () => void; dis?: boolean } | null {
  const b = g.battle;
  if (g.over || g.pendingBlow || rollView) return null;
  if (b) {
    if (b.stage === 'setup') return { label: 'Begin combat ▸', fn: () => act(() => E.beginCombat(g, b)) };
    if (b.stage === 'done') return { label: 'Close battle ▸', fn: () => act(() => E.closeBattle(g)) };
    if (b.stage.endsWith('Choice') || b.stage === 'retreat') return null;
    return { label: `Roll ${STAGE_NAME[b.stage].toLowerCase()} ▸`, fn: () => rollStage(b) };
  }
  return { label: `End ${STEPS[STEP_OF[g.phase]].toLowerCase()} ▸`, fn: () => act(() => { E.endPhase(g); selUnit = null; previewArea = null; selChit = null; }), dis: !!E.mustFight(g).length };
}
function dispatch() {
  if (g.battle || g.over) return '';
  const row = (k: string, v: string, c = '') => `<div class="r"><span>${k}</span><b class="${c}">${v}</b></div>`;
  const c = selChit ? g.chits.find((x) => x.id === selChit) : null;
  if (c && g.phase === 'admin') return `<div class="c-dispatch">${chitPanel(c)}</div>`;
  if (g.phase === 'reinforcement' && selArr) { const o = arrOpts(), name = g.pendingArrivals.includes(selArr) ? g.units.find((x) => x.id === selArr)!.name : 'Task Force'; return `<div class="c-dispatch"><h3>${esc(name)}</h3><p class="hint">${o.length ? 'Click a highlighted area on the map, or pick one:' : 'No legal area right now.'}</p><div class="row">${o.filter((x) => !x.sa).slice(0, 14).map((x) => btn(esc(areaName(x.area)), () => { const id = selArr!; selArr = null; if (g.pendingArrivals.includes(id)) E.placeArrival(g, id, x.area); else E.placeTaskForce(g, id, x.area); })).join('')}</div>${o.some((x) => x.sa) ? `<details><summary class=\"why\">Other entry areas (cost a Special Action, 8.27)</summary><div class=\"row\">${o.filter((x) => x.sa).map((x) => btn(esc(areaName(x.area)), () => { const id = selArr!; selArr = null; E.placeArrival(g, id, x.area); })).join('')}</div></details>` : ''}</div>`; }
  if (g.phase === 'btCombat' && !selUnit && selArea == null) { const air = E.boxOf(g, g.phasing, 'available').filter((x) => x.kind === 'air_mission'), as = E.airSupplyAreas(g, g.phasing); if (air.length && as.length && !g.airSupply) return `<div class="c-dispatch"><h3>Air supply</h3><p class="hint">Before the Supply Phase an Air Mission can supply one cut-off area (17.2).</p><div class="row">${as.map((ar) => btn(esc(areaName(ar)), () => E.playAirSupply(g, air[0].id, ar))).join('')}</div></div>`; }
  const u = selUnit ? g.units.find((x) => x.id === selUnit) : null;
  if (u) {
    const to = previewArea ?? hoverArea, o = to != null ? optsFor(u.id).find((x) => x.area === to) : null, n = fuelLeft(), strat = g.phase === 'strategic';
    const tags = [u.disorder === 1 ? 'disordered' : u.disorder === 2 ? 'recovering' : '', u.unsupplied ? 'unsupplied' : '', u.reserve ? 'reserve' : '', u.exploit ? 'exploit' : '', u.interdict ? 'interdicted' : ''].filter(Boolean);
    let route = '';
    if (o) route = `<div class="route"><h4>→ ${esc(areaName(o.area))}</h4>${strat ? row('Strategic move', 'any distance') : row('Movement', `${o.cost} MP`)}${u.side === 'german' && g.opts.fuel ? row('Fuel', o.fuel ? `−1 &nbsp;(${n} → ${n - 1})` : 'not needed', o.fuel ? 'bad' : '') : ''}${o.mustStop ? row('Stops here', 'enemy present, battle follows', 'bad') : ''}${btn('Move here', () => { previewArea = o.area; confirmMoveNow(); }, 'primary')}</div>`;
    else if (optsFor(u.id).length) route = `<p class="hint">${optsFor(u.id).length} destination(s). Hover or click a highlighted area.</p>`;
    const can = ['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved;
    const fw = can && u.area != null && !u.unsupplied && !u.disorder && !E.contested(g, u.area) && !g.fieldWorks.includes(u.area) && ((g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit)));
    return `<div class="c-dispatch"><h3 class="${u.side}">${esc(u.name)}</h3><div class="pipsrow">${pips(u)} <small>${u.garrison ? 'asset' : u.cls} · ${tags.join(' · ') || 'in order'}</small></div>${route}
      <div class="row">${g.phase === 'movement' && u.side === g.phasing ? (u.reserve ? btn('Remove reserve', () => E.setReserve(g, u.id, false)) : btn('Reserve', () => E.setReserve(g, u.id, true), '', !E.canReserve(g, u))) : ''}${fw ? btn('Fortify', () => E.buildFieldWorks(g, u.id)) : ''}${g.phase === 'btMove' && u.side === g.phasing && u.cls === 'armor' && !u.exploit && !u.reserve && !u.moved ? btn('Activate (SA)', () => E.activateBreakthrough(g, u.id), '', !E.saAvailable(g, u.side, u.ech).length) : ''}</div></div>`;
  }
  if (selArea != null) {
    const a = E.areas.get(selArea)!, us = E.unitsIn(g, selArea);
    return `<div class="c-dispatch"><h3>${esc(a.name)}</h3>${row('Terrain TDN', `${a.tdn}`)}${row('Control', nm(g.control[a.id]))}${g.fieldWorks.includes(a.id) ? row('Field works', 'yes') : ''}${(a.vp.allied || a.vp.german || a.vp.mutual) ? row('Victory area', a.vp.mutual ? 'both' : a.vp.german ? 'German ' + a.vp.german : 'Allied ' + a.vp.allied) : ''}
      ${us.map((u) => `<button class="unit" data-u="${u.id}"><b class="${u.side}">${esc(u.name)}</b><span class="pipsrow">${pips(u)}</span></button>`).join('') || '<p class="hint">Empty.</p>'}</div>`;
  }
  return '';
}
function confirmMoveNow() { confirmMove(); }
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
function tray() {
  const us = g.pendingArrivals.map((id) => g.units.find((x) => x.id === id)!), tf = g.tfNew.map((id) => E.chit(g, id));
  if (!us.length && !tf.length) return '';
  return `<div class="arrtray" role="group" aria-label="Arriving reinforcements">${us.map((u) => `<button class="arr ${u.id === selArr ? 'sel' : ''}" data-arr="${u.id}" title="${esc(u.name)}"><span class="blk3d ${u.side}"><img alt="" src="${svgUri(u.garrison ? garrisonSvg(u.name, u.side === 'german') : labelSvg(u))}"></span><small>${esc(u.name)}</small></button>`).join('')}${tf.map((c) => `<button class="arr ${c.id === selArr ? 'sel' : ''}" data-arr="${c.id}" title="Task Force"><span class="chit3d"><img alt="" src="${svgUri(garrisonSvg('Task Force', false))}"></span><small>Task Force</small></button>`).join('')}</div>`;
}
function handCards() {
  const b = g.battle;
  if (!b && g.phase === 'reinforcement') return tray();
  if (b) {
    if (b.stage !== 'setup') return '';
    const cs = ([b.attacker, other(b.attacker)] as E.Side[]).sort().flatMap((s) => E.boxOf(g, s, 'available').filter((c) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission'));
    const ok = cs.filter((c) => !E.canAssign(g, b, c.side, c));
    return `<div class="c-hand">${fan(ok.map((c) => card(c)))}</div>${cs.length > ok.length ? `<div class="handtab"><span class="why">${cs.length - ok.length} more assets cannot join this battle</span></div>` : ''}`;
  }
  if (g.phase !== 'admin') return '';
  const s = handSide ?? g.phasing, cs = E.boxOf(g, s, 'available');
  return `<div class="handtab"><button data-do="${reg(() => { handSide = other(s); })}" class="${s}">${nm(s)} hand · ${cs.length} ${ico('swap')}</button></div><div class="c-hand">${fan(cs.map((c) => card(c)))}</div>`;
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
    const mini = (c: E.Chit) => `<span class="mini ${c.side}" title="${esc(c.name)}"><img alt="${esc(c.name)}" src="${chitImg(c)}">${setup ? `<button class="x" aria-label="Remove ${esc(c.name)}" data-do="${reg(() => E.unassign(g, b, c.id))}">${ico('close')}</button>` : ''}</span>`;
    const sa = setup && s !== att ? E.saAvailable(g, s).length : 0;
    return `<div class="c-side ${s}"><h4>${nm(s)} <small>${s === att ? 'attacking' : 'defending'}</small></h4>
      <div class="c-row">${us.map((u) => `<div tabindex="0" role="button" class="blk ${s} ${u.id === pt ? 'pt' : ''} ${air && b.air[s]!.mode === 'support' && b.air[s]!.unit === u.id ? 'air' : ''}" data-unit="${u.id}" data-side="${s}" title="${esc(u.name)}${u.id === pt ? ' (point unit)' : ''}"><em>${pips(u)}</em><b>${esc(u.name)}</b></div>`).join('')}</div>
      <div class="c-slots"><div class="slot" data-side="${s}" data-zone="arty"><span class="lab">ARTY ${arty.length}/${lim.arty}</span>${arty.map(mini).join('') || '<small>drop</small>'}</div><div class="slot" data-side="${s}" data-zone="asset"><span class="lab">ASSETS</span>${rest.map(mini).join('') || '<small>drop</small>'}</div></div>
      ${sa ? `<div class="row">${btn('Retreat (SA)', () => E.defenderRetreatSA(g, b), '', !!b.assets[s].length || us.some((u) => u.garrison) || !us.length)}</div>` : ''}</div>`;
  };
  const al = stats(b, 'allied'), ge = stats(b, 'german'), tot = al.mean + ge.mean || 1, side2 = att === 'german' ? ge : al;
  return `<div class="c-table" style="${rollView ? 'opacity:.3' : ''}"><div class="c-title">${b.bt ? 'BREAKTHROUGH · ' : ''}${esc(L.name)} <small>TDN ${L.tdn}${g.fieldWorks.includes(b.area) ? ' · field works' : ''}${b.riverAssault ? ' · river assault' : ''}</small></div>${side('allied')}
    <div class="c-vs"><small>EXPECTED HITS</small><div class="big">${al.mean.toFixed(1)}<span>:</span>${ge.mean.toFixed(1)}</div><div class="gauge"><i style="width:${(al.mean / tot) * 100}%"></i></div><small>${nm(att)} ≥2 hits ${side2.p(2)}% · ≥3 ${side2.p(3)}%</small></div>${side('german')}</div>`;
}
function ledger() {
  const b = g.battle; if (!b || g.pendingBlow) return '';
  if (rollView) {
    const rv = rollView, hits = rv.groups.reduce((s, x) => s + x.hits, 0), labels = (rv.pos ?? []).map((p) => { const gr = rv.groups[p.group], hit = isHit(p.v, gr.sn); return `<div class="lbl ${hit ? 'hit' : 'miss'}" style="left:${p.x}px;top:${p.y}px">${p.v}<em>${hit ? 'hit' : 'miss'}${p.v === 1 || p.v === 10 ? ' · always' : ''}</em></div>`; }).join('');
    return `<div class="labels">${labels}</div><div class="c-ledger"><h3>${esc(rv.title)} · ${rv.pos ? `${hits} hit${hits === 1 ? '' : 's'}` : 'rolling…'}</h3>${rv.groups.map((x) => `<div class="ln"><span class="who">${esc(x.label)}</span><span class="mods">${x.parts.map(([w, v]) => `<span class="m ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${esc(w)}${v ? ` ${v > 0 ? '+' : '−'}${Math.abs(v)}` : ''}</span>`).join('')}</span><span class="sn">SN ${x.sn}</span><span class="res">${x.dice.map((d) => `<b class="${isHit(d, x.sn) ? 'hit' : 'miss'}">${d}</b>`).join(' ')}</span><span class="cnt">${x.hits}</span></div>`).join('')}
      <div class="row end"><button class="primary" data-do="${reg(() => endRoll())}" ${rv.pos ? '' : 'disabled'}>Continue ▸</button></div></div>`;
  }
  if (b.stage === 'retreat' && b.retreat) { const u = g.units.find((x) => x.id === b.retreat!.queue[0])!; return `<div class="c-ledger"><h3>${esc(u.name)} retreats</h3><p class="hint">Pick the area. The block becomes disordered.</p><div class="row">${E.retreatOptions(g, b).map((a) => btn(esc(areaName(a)), () => E.chooseRetreat(g, b, a), 'primary')).join('')}</div></div>`; }
  if (b.stage === 'attChoice') return `<div class="c-ledger"><h3>${b.pending} hit(s) on the attackers</h3><p class="hint">Abort the attack (all attackers disordered, no more losses) or continue and take them as step losses?</p><div class="row end">${btn('Abort attack', () => E.attackerChoice(g, b, true))}${btn('Take losses', () => E.attackerChoice(g, b, false), 'primary')}</div></div>`;
  if (b.stage === 'defChoice') return `<div class="c-ledger"><h3>${b.pending} hit(s) on the defenders</h3><p class="hint">${b.pendingKind === 'arty' ? 'Disorder all defenders to absorb 1 hit, or take every hit as a step loss?' : 'Retreat all units (absorbs 1 hit, they become disordered) or stand and take step losses?'}</p><div class="row end">${btn('Take losses', () => E.defenderChoice(g, b, false))}${btn(b.pendingKind === 'arty' ? 'Disorder (absorb 1)' : 'Retreat', () => E.defenderChoice(g, b, true), 'primary')}</div></div>`;
  if (b.stage === 'offFire' && b.assets[b.attacker].some((id) => E.chit(g, id).kind === 'engineer') && g.fieldWorks.includes(b.area)) return `<div class="c-ledger slim"><label><input type="checkbox" ${b.engFw ? 'checked' : ''} data-sel="${regv((v) => { b.engFw = v === 'on'; })}"> Engineer removes the field works instead of firing (6.33)</label></div>`;
  return '';
}
function legend() {
  if (tint === 'off') return '';
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const items = tint === 'tdn' ? TDN_COL.map((c, i) => [c, `TDN ${i}`, (i ? `attackers −${i} to hit` : 'no modifier')]) : [[ZONE_COL[5], 'Zone 5', '5th Panzer Army'], [ZONE_COL[6], 'Zone 6', '6th Panzer Army'], [ZONE_COL[7], 'Zone 7', '7th Army']];
  return `<div class="legend" aria-label="Overlay legend"><b>${tint === 'tdn' ? 'Terrain defence' : 'Army zones'}</b>${items.map(([c, a, b]) => `<span><i style="background:${hex(c as number)}"></i>${a} <small>${b}</small></span>`).join('')}</div>`;
}
function modalHtml() {
  if (modal === 'boxes') return `<div class="modal"><div class="sheet"><h3>Chit boxes <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>${(['allied', 'german'] as E.Side[]).map((s) => {
    const l = (bx: E.Chit['box']) => E.boxOf(g, s, bx).map((c) => `<span class="mini ${s}">${esc(chitLabel(c))}</span>`).join('') || '<small>empty</small>';
    return `<h4 class="${s}">${nm(s)} · cup ${E.boxOf(g, s, 'cup').length}</h4><div class="chips"><b>Available</b> ${l('available')}</div><div class="chips"><b>Used</b> ${l('used')}</div><div class="chips"><b>Eliminated</b> ${l('eliminated')}</div>`; }).join('')}</div></div>`;
  if (modal === 'menu') return `<div class="modal"><div class="sheet"><h3>Menu <button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3><h4>New game</h4><div class="row"><select data-sel="${regv((x) => { newOpts.scenario = x as 'tournament' | 'campaign'; })}"><option value="tournament" ${newOpts.scenario === 'tournament' ? 'selected' : ''}>Tournament (5 turns)</option><option value="campaign" ${newOpts.scenario === 'campaign' ? 'selected' : ''}>Campaign (9 turns)</option></select>
    <label><input type="checkbox" ${newOpts.fuel ? 'checked' : ''} data-sel="${regv((x) => { newOpts.fuel = x === 'on'; })}"> German fuel rule</label><label><input type="checkbox" ${newOpts.airborne ? 'checked' : ''} data-sel="${regv((x) => { newOpts.airborne = x === 'on'; })}"> 18.5 airborne ignore supply −1</label><label><input type="checkbox" ${newOpts.advArty ? 'checked' : ''} data-sel="${regv((x) => { newOpts.advArty = x === 'on'; })}"> 18.6 advanced artillery</label>${btn('Start', () => { g = E.newGame(undefined, newOpts); selArea = selUnit = selChit = null; modal = null; inBattle = false; hist = []; note = ''; selArr = null; }, 'primary')}</div>
    <h4>Map art</h4><div class="row"><select data-sel="${regv((x) => setArt(x as 'vector' | 'scan'))}"><option value="vector" ${art === 'vector' ? 'selected' : ''}>Vector layers (traced)</option><option value="scan" ${art === 'scan' ? 'selected' : ''}>Original scan</option></select></div>
    <h4>Log</h4><div class="log">${[...g.log].reverse().slice(0, 120).map((l) => `<div>${esc(l)}</div>`).join('')}</div></div></div>`;
  return '';
}
function render() {
  acts = {}; actv = {}; n = 0;
  const p = primary(), b = g.battle;
  const alert = g.pendingBlow ? (() => { const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!, path = g.pendingBlow!.path; return `<div class="c-ledger"><h3>${nm(other(u.side))}: bridge?</h3><p class="hint">${esc(u.name)} tries to cross into ${esc(areaName(path[path.length - 1]))}. Attempt to blow the bridge? It works on a roll of 1–5.</p><div class="row end">${btn('Let them cross', () => E.resolveBlow(g, false))}${btn('Attempt to blow it', () => E.resolveBlow(g, true), 'primary')}</div></div>`; })() : '';
  $('#ui').innerHTML = topBar() + (b ? battleTable() : dispatch()) + handCards() + alert + ledger() + `<div class="c-bar b"><div class="c-prompt" aria-live="polite">${prompt()}</div>${p ? `<button class="go" data-do="${reg(p.fn)}" ${p.dis ? 'disabled' : ''}>${p.label}</button>` : ''}</div>` + legend() + (toast ? `<div class="toast" role="status">${esc(toast)}</div>` : '') + modalHtml();
  const ui = $('#ui');
  ui.querySelectorAll<HTMLElement>('[data-do]').forEach((e) => (e.onclick = () => act(acts[e.dataset.do!])));
  ui.querySelectorAll<HTMLElement>('[data-modal]').forEach((e) => (e.onclick = () => { modal = (e.dataset.modal || null) as typeof modal; render(); }));
  ui.querySelectorAll<HTMLElement>('[data-sel]').forEach((e) => (e.onchange = () => { const f = actv[e.dataset.sel!]; if (f) { f(e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : (e as HTMLSelectElement).value); save(); } }));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onclick = () => { selArr = selArr === e.dataset.arr ? null : e.dataset.arr!; refresh(); const all = arrOpts(), o = all.some((x) => !x.sa) ? all.filter((x) => !x.sa) : all; if (selArr && o.length) { const pts = o.map((x) => center(x.area)), cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length, r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))); goal = { t: new THREE.Vector3(cx, 0, cz), dist: Math.min(70, Math.max(24, r * 2.3 + 10)), pitch: 1.15 }; } }));
  ui.querySelectorAll<HTMLElement>('[data-tint]').forEach((e) => (e.onclick = cycleTint));
  ui.querySelectorAll<HTMLElement>('[data-undo]').forEach((e) => (e.onclick = () => undo()));
  ui.querySelectorAll<HTMLElement>('[data-u]').forEach((e) => (e.onclick = () => { selUnit = e.dataset.u!; selArea = g.units.find((x) => x.id === selUnit)!.area ?? selArea; previewArea = null; refresh(); }));
  ui.querySelectorAll<HTMLElement>('.card2, .blk').forEach((e) => (e.onkeydown = (ev) => { if (ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); const id = e.dataset.chit, b2 = g.battle; if (e.classList.contains('card2') && id) { if (b2?.stage === 'setup') { const c = E.chit(g, id), why = E.canAssign(g, b2, c.side, c); if (why) say(why); else act(() => E.assign(g, b2, id, c.kind === 'air_mission' ? 'arty' : undefined)); } else if (!b2) { selChit = selChit === id ? null : id; refresh(); } } else e.click(); }));
  ui.querySelectorAll<HTMLElement>('.card2').forEach((e) => (e.onpointerdown = (ev) => { ev.preventDefault(); if (g.battle) drag(ev, e); else { selChit = selChit === e.dataset.chit ? null : e.dataset.chit!; refresh(); } }));
  ui.querySelectorAll<HTMLElement>('.blk[data-unit]').forEach((e) => (e.onclick = () => { const b2 = g.battle; if (!b2 || b2.stage !== 'setup') return; const s = e.dataset.side as E.Side, u = g.units.find((x) => x.id === e.dataset.unit)!; if (u.garrison || (s === b2.attacker && u.disorder)) return; if (s === b2.attacker) b2.attPoint = u.id; else b2.defPoint = u.id; save(); render(); }));
}
function refresh() {
  syncBattleCam(); drawPieces(); paintAreas(); drawRoute(); badges = badgeList(); syncBadges(); render();
  if (!rollView) { const cv = $('#dice'); if (cv && cv.style.display !== 'none') { clearDice(); cv.style.display = 'none'; } }
}
function frame() {
  requestAnimationFrame(frame);
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  if (goal) { target.lerp(goal.t, 0.1); dist += (goal.dist - dist) * 0.1; pitch += (goal.pitch - pitch) * 0.1; if (target.distanceTo(goal.t) < 0.05 && Math.abs(dist - goal.dist) < 0.1) goal = null; }
  placeCam(); renderer.render(scene, cam); placeBadges();
}
auto(); refresh(); frame();
Object.assign(window, { __fab: { E, get g() { return g; }, set g(v: E.Game) { g = v; }, refresh, act, sel: (u: string, a?: number) => { selUnit = u; selArea = g.units.find((x) => x.id === u)!.area; previewArea = a ?? null; refresh(); } } });
