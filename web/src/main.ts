import * as THREE from 'three';
import mapJson from '../../data/bulge/map.json';
import * as E from '../../engine/src';
import { labelSvg, garrisonSvg } from './art';

type MapArea = { id: number; label: [number, number]; polygon: [number, number][] };
type MapConn = { a: number; b: number; marker: [number, number] | null };
const MAP = mapJson as unknown as { size: [number, number]; areas: MapArea[]; connections: MapConn[] };
// World unit = 1 cm. The scan is the full 34 x 22 in map (86.36 x 55.88 cm) at 2448 x 1584 px.
const [MW, MH] = MAP.size, S = 2448 / 86.36;                                  // map pixels per cm
const toWorld = (x: number, y: number) => new THREE.Vector3(x / S - MW / (2 * S), 0, y / S - MH / (2 * S));
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const areaName = (a: number) => E.areas.get(a)!.name;

/* ---------- state ---------- */
const KEY = 'fab-demo2';
function load(): E.Game | null { try { const s = localStorage.getItem(KEY); if (!s) return null; const x = JSON.parse(s); return x.chits && x.markers && x.greif ? x : null; } catch { return null; } }
let g: E.Game = load() ?? E.newGame();
let selArea: number | null = null, selUnit: string | null = null, selChit: string | null = null, msg = '', lastRolls = 0, newOpts: E.Opts = { scenario: 'tournament', fuel: true };
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
  if (u.disorder) m.rotation.z = u.disorder === 1 ? 0.25 : 0.12;                                      // tilt = disordered / recovering
  return m;
}
const markers = new THREE.Group(); scene.add(markers);
const tagTex = new Map<string, THREE.CanvasTexture>();
function tag(text: string, bg: string, size = 1.1) {
  let t = tagTex.get(text + bg);
  if (!t) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
    x.fillStyle = '#fff'; x.font = 'bold 60px Arial Narrow, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagTex.set(text + bg, t); }
  const side = new THREE.MeshStandardMaterial({ color: bg }), m = new THREE.Mesh(new THREE.BoxGeometry(size, 0.12, size), [side, side, new THREE.MeshStandardMaterial({ map: t }), side, side, side]);
  m.castShadow = true; return m;
}
function drawPieces() {
  pieces.clear(); markers.clear();
  for (const a of MAP.areas) {
    const us = E.unitsIn(g, a.id), base = toWorld(a.label[0], a.label[1]), cont = E.contestedAreas(g).includes(a.id);
    us.forEach((u) => {
      const m = block(u), same = us.filter((x) => x.side === u.side), row = u.side === 'german' ? 1.1 : -1.1;
      m.position.x = base.x + (same.indexOf(u) - (same.length - 1) / 2) * 1.75; m.position.z = base.z + (cont ? row : 0.4);
      m.userData.unit = u.id; if (u.id === selUnit) { const o = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })); m.add(o); }
      pieces.add(m);
      const tags: [string, string][] = [];
      if (u.reserve) tags.push(['R', '#2d6cb0']); if (u.exploit) tags.push(['E', '#d9741c']); if (u.unsupplied && !u.garrison) tags.push(['S', '#b8312f']); if (u.interdict) tags.push(['I', '#8a2f9c']);
      tags.forEach(([t, c], i) => { const k = tag(t, c, 0.6); k.position.set(m.position.x - 0.55 + i * 0.7, (u.garrison ? 0.3 : 1.75), m.position.z); markers.add(k); });
    });
    const area: [string, string][] = [];
    if (g.fieldWorks.includes(a.id)) area.push(['FW', '#7a5a2b']); if (g.riverAssault.includes(a.id)) area.push(['RA', '#2a7fb8']);
    area.forEach(([t, c], i) => { const k = tag(t, c, 1.0); k.position.set(base.x - 3.4 + i * 1.2, 0.07, base.z - 0.1); markers.add(k); });
  }
  for (const k of Object.keys(g.greif)) { const [x, y] = k.split('-').map(Number), c = MAP.connections.find((q) => q.a === x && q.b === y); if (!c?.marker) continue; const p = toWorld(c.marker[0], c.marker[1]), t = tag('G', '#8a2f9c', 1.0); t.position.set(p.x, 0.07, p.z - 1.1); markers.add(t); }
  for (const k of g.blown) { const [x, y] = k.split('-').map(Number), c = MAP.connections.find((q) => q.a === x && q.b === y); if (!c?.marker) continue; const p = toWorld(c.marker[0], c.marker[1]), t = tag('X', '#d9421f', 1.0); t.position.set(p.x, 0.07, p.z); markers.add(t); }
}
function paintAreas() {
  const strat = g.phase === 'strategic' && selUnit, opts = selUnit ? (strat ? E.stratOptions(g, selUnit).map((a) => ({ area: a, mustStop: false })) : E.moveOptions(g, selUnit)) : [];
  const fight = g.phase === 'combat' || g.phase === 'btCombat' ? E.contestedAreas(g).filter((a) => !g.fought.includes(a)) : [], must = new Set(E.mustFight(g));
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial; let c = 0xffffff, o = 0; const r = opts.find((x) => x.area === id);
    if (r) { c = r.mustStop ? 0xff8a3d : 0x37d67a; o = 0.32; } else if (fight.includes(id)) { c = must.has(id) ? 0xff4d4d : 0xffc542; o = 0.28; }
    if (id === selArea) { c = 0x4aa3ff; o = Math.max(o, 0.3); }
    mat.color.setHex(c); mat.opacity = o;
  }
}

/* ---------- camera ---------- */
let target = new THREE.Vector3(10, 0, -3.5), yaw = 0, pitch = 1.0, dist = 32;
function placeCam() { cam.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(target); }
const ptrs = new Map<number, [number, number]>(); let moved = 0, pinch = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(110, Math.max(7, dist * pinch / d)); pinch = d; moved = 99; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey) { yaw -= dx * 0.006; pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006)); }
  else { const k = dist * 0.0018, c = Math.cos(yaw), s = Math.sin(yaw); target.x -= (dx * c + dy * s) * k; target.z -= (-dx * s + dy * c) * k; }
});
canvas.addEventListener('pointerup', (e) => { ptrs.delete(e.pointerId); if (moved < 6) click(e); });
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(110, Math.max(7, dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });

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

/* ---------- interaction ---------- */
function act(f: () => void) { try { f(); msg = ''; } catch (e) { msg = (e as Error).message; } save(); refresh(); }
function click(e: PointerEvent) {
  const { unit, area } = pick(e);
  if (g.pendingBlow) return;
  if (selUnit && area != null) {
    if (g.phase === 'strategic' && E.stratOptions(g, selUnit).includes(area)) { const id = selUnit; selUnit = null; selArea = area; return act(() => E.stratMove(g, id, area)); }
    if (g.phase !== 'strategic' && E.moveOptions(g, selUnit).some((o) => o.area === area)) { const id = selUnit; selUnit = null; selArea = area; return act(() => { E.move(g, id, area); }); }
  }
  if (unit) { selUnit = unit; selArea = g.units.find((x) => x.id === unit)!.area; } else { selArea = area; selUnit = null; }
  refresh();
}

/* ---------- panel ---------- */
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
function unitRow(u: E.Unit) {
  const tags = [u.garrison ? 'asset' : u.cls, u.disorder === 1 ? '<span class="tag bad">disordered</span>' : u.disorder === 2 ? '<span class="tag warn">recovering</span>' : '', u.unsupplied ? '<span class="tag bad">unsupplied</span>' : '', u.reserve ? '<span class="tag">reserve</span>' : '', u.exploit ? '<span class="tag warn">exploit</span>' : '', u.interdict ? '<span class="tag bad">interdict</span>' : '', u.paradrop ? `<span class="tag warn">${u.paradrop === 'pending' ? 'paradrop' : u.paradrop === 'partial' ? 'scattered' : 'landed'}</span>` : '', u.moved && ['movement', 'reaction', 'btMove'].includes(g.phase) ? '<span class="tag">moved</span>' : ''].filter(Boolean).join(' ');
  return `<button class="unit ${u.id === selUnit ? 'sel' : ''}" data-u="${u.id}"><b class="side-${u.side}">${esc(u.name)}</b> <span class="why">${tags}</span><span class="pips">${pips(u)}</span></button>`;
}
function oddsHtml(list: E.Fire[]) {
  if (!list.length) return '<p class="hint">Nobody can fire.</p>';
  const pmf = E.hitPmf(list.map((f) => ({ dice: f.dice, sn: f.sn })));
  return `<div class="odds"><span class="h">Firer</span><span class="h">dice</span><span class="h">SN</span>${list.map((f) => `<span title="${esc(f.parts.map(([w, v]) => `${w} ${v > 0 ? '+' : ''}${v}`).join('\n'))}">${esc(f.who)}</span><span>${f.dice}</span><span>${f.sn}</span>`).join('')}</div>
    <p class="hint">Expected hits <b>${E.meanHits(pmf).toFixed(2)}</b> · ≥1 <b>${Math.round(E.probAtLeast(pmf, 1) * 100)}%</b> · ≥2 <b>${Math.round(E.probAtLeast(pmf, 2) * 100)}%</b> · ≥3 <b>${Math.round(E.probAtLeast(pmf, 3) * 100)}%</b></p>`;
}
const dice = (rs: E.Roll[]) => rs.map((r) => `<div><b>${esc(r.who)}</b> <span class="why">SN ${r.sn}</span><div class="dice">${r.dice.map((d) => `<span class="die ${d === 1 || (d !== 10 && d <= r.sn) ? 'hit' : ''}">${d}</span>`).join('')}</div></div>`).join('');

function boxesHtml() {
  return (['german', 'allied'] as E.Side[]).map((s) => {
    const av = E.boxOf(g, s, 'available'), cnt = (b: E.Chit['box']) => E.boxOf(g, s, b).length;
    const list = (b: E.Chit['box']) => E.boxOf(g, s, b).map((c) => chitChip(c)).join('') || '<span class="why">empty</span>';
    return `<div class="box"><b class="side-${s}">${sideName(s)}</b> <span class="why">cup ${cnt('cup')} · used ${cnt('used')} · eliminated ${cnt('eliminated')}</span>
      <div class="chips">${av.map((c) => chitChip(c)).join('') || '<span class="why">Available Box empty</span>'}</div>
      <details><summary class="why">Used / Eliminated boxes</summary><div class="chips">${list('used')}</div><div class="chips">${list('eliminated')}</div></details></div>`;
  }).join('');
}
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
  } else if (c.kind === 'command_staff') {
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
  else if (E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission') out.push('<p class="hint">Assigned to a battle in the Combat Phase.</p>');
  if (E.isEvent(c) && c.kind !== 'sa_block') out.push(btn('Use as alternate event (2 assets back to the cup)', () => E.alternateUse(g, c.id), '', false, '4.21'));
  return head + `<div class="row">${out.join('')}</div>`;
}

function battlePanel(b: E.Battle): string {
  const att = b.attacker, def = E.other(att), L = E.areas.get(b.area)!;
  const head = `<div><h2>${b.bt ? 'Breakthrough battle' : 'Battle'}</h2><h3>${esc(L.name)}</h3><p class="hint">TDN ${L.tdn}${g.fieldWorks.includes(b.area) ? ' · field works' : ''}${b.riverAssault ? ' · river assault' : ''} · ${sideName(att)} attacks</p></div>`;
  const attU = E.unitsIn(g, b.area, att).filter((u) => !u.garrison && !u.disorder), defU = E.unitsIn(g, b.area, def);
  const sel = (cur: string, us: E.Unit[], f: (v: string) => void) => `<select data-sel="${regv(f)}">${us.map((u) => `<option value="${u.id}" ${u.id === cur ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
  const units = `<div><h2>Units</h2><div class="row"><span class="why">Attacker point</span>${sel(b.attPoint, attU, (v) => { b.attPoint = v; })}<span class="why">Defender point</span>${sel(b.defPoint, defU, (v) => { b.defPoint = v; })}</div>
     <div class="list">${[...attU, ...E.unitsIn(g, b.area, att).filter((u) => u.disorder), ...defU].map(unitRow).join('')}</div></div>`;
  if (b.stage === 'setup') {
    const sa = E.saAvailable(g, def).length, canRet = !b.assets[def].length && defU.some((u) => !u.garrison) && !defU.some((u) => u.garrison);
    const reinf = g.units.filter((u) => u.side === def && u.area != null && E.neighbors(b.area).includes(u.area) && !E.contested(g, u.area) && !u.disorder && !u.garrison && E.blocks(g, b.area, def).length < 2);
    const saHtml = sa ? `<div><h2>${sideName(def)} Special Action (${sa} available)</h2><div class="row">${btn('Retreat before combat', () => E.defenderRetreatSA(g, b), '', !canRet)}${reinf.map((u) => btn(`Reinforce: ${esc(u.name)} from ${esc(areaName(u.area!))}`, () => E.defenderReinforceSA(g, b, u.id))).join('')}</div></div>` : '';
    const assets = [att, def].map((s) => {
      const asg = [...b.assets[s].map((id) => E.chit(g, id)), ...(b.air[s] ? [E.chit(g, b.air[s]!.id)] : [])];
      const avail = E.boxOf(g, s, 'available').filter((c) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission');
      const lim = E.assetLimits(g, b, s);
      return `<div><h2>${sideName(s)} assets <span class="why">(artillery up to ${lim.arty}${lim.mixed ? ', mixed echelons: artillery only' : ''})</span></h2>
        <div class="chips">${asg.map((c) => `<span class="chit ${c.side} sel">${esc(chitLabel(c))} ${btn('×', () => E.unassign(g, b, c.id), 'x')}</span>`).join('') || '<span class="why">none assigned</span>'}</div>
        <div class="chips">${avail.map((c) => {
          const why = E.canAssign(g, b, s, c);
          if (c.kind === 'air_mission') return why ? `<button class="chit ${s}" disabled title="${esc(why)}">${esc(chitLabel(c))}</button>` : `<span class="chit ${s}">${esc(chitLabel(c))} ${btn('as artillery', () => E.assign(g, b, c.id, 'arty'))} ${btn('+2 for point unit', () => E.assign(g, b, c.id, 'support', s === att ? b.attPoint : b.defPoint))}</span>`;
          return `<button class="chit ${s}" data-do="${reg(() => E.assign(g, b, c.id))}" ${why ? 'disabled' : ''} title="${esc(why ?? 'assign to this battle')}">${esc(chitLabel(c))}</button>`;
        }).join('') || '<span class="why">nothing available</span>'}</div></div>`;
    }).join('');
    const preview = (['arty', 'ground'] as const).map((k) => [att, def].map((s) => { const l = E.fireList(g, b, s, k); return l.length ? `<div><h2>${sideName(s)} ${k === 'arty' ? 'artillery' : 'ground fire'}</h2>${oddsHtml(l)}</div>` : ''; }).join('')).join('');
    return head + saHtml + units + assets + preview + `<div class="row">${btn('Begin combat', () => E.beginCombat(g, b), 'primary')}</div>`;
  }
  const label: Record<string, string> = { attArty: `${sideName(att)} artillery`, defArty: `${sideName(def)} artillery`, defFire: `${sideName(def)} ground fire (defensive)`, offFire: `${sideName(att)} ground fire (offensive)` };
  const fresh = b.rolls.slice(lastRolls), rolls = fresh.length ? `<div class="list">${dice(fresh)}</div>` : '';
  if (b.stage === 'done') return head + units + rolls + `<p class="hint"><b>${esc(b.result ?? '')}</b></p>` + btn('Close battle', () => { E.closeBattle(g); lastRolls = 0; }, 'primary');
  if (b.stage === 'attChoice') return head + units + rolls + `<p class="hint">${b.pending} more hit(s) on the attacker. Abort the attack (all attackers disordered, no more losses) or continue (take them as step losses)?</p><div class="row">${btn('Abort attack', () => E.attackerChoice(g, b, true))}${btn('Continue', () => { lastRolls = b.rolls.length; E.attackerChoice(g, b, false); }, 'primary')}</div>`;
  if (b.stage === 'defChoice') return head + units + rolls + (b.pendingKind === 'arty'
    ? `<p class="hint">${b.pending} artillery hit(s) on the defender. Disorder all defenders to absorb 1 hit, or take them all as step losses?</p><div class="row">${btn('Take losses', () => E.defenderChoice(g, b, false))}${btn('Disorder (absorb 1)', () => E.defenderChoice(g, b, true), 'primary')}</div>`
    : `<p class="hint">${b.pending} ground-fire hit(s) on the defender. Retreat all units (absorbs 1 hit; they become disordered) or stand and take step losses?</p><div class="row">${btn('Stand', () => E.defenderChoice(g, b, false))}${btn('Retreat', () => E.defenderChoice(g, b, true), 'primary')}</div>`);
  const side = b.stage === 'attArty' || b.stage === 'offFire' ? att : def, kind = b.stage.endsWith('Arty') ? 'arty' : 'ground';
  const hasEng = b.stage === 'offFire' && b.assets[att].some((id) => E.chit(g, id).kind === 'engineer') && g.fieldWorks.includes(b.area);
  return head + units + rolls + `<div><h2>${label[b.stage]}</h2>${oddsHtml(E.fireList(g, b, side, kind))}</div>
    ${hasEng ? `<label class="why"><input type="checkbox" ${b.engFw ? 'checked' : ''} data-sel="${regv((v) => { b.engFw = v === 'on'; })}"> Engineer removes the field works instead of firing (6.33)</label>` : ''}
    <div class="row">${btn(`Roll ${label[b.stage].toLowerCase()}`, () => { lastRolls = b.rolls.length; E.roll_step(g, b); }, 'primary')}</div>`;
}

function render() {
  acts = {}; actv = {}; n = 0;
  const v = E.victory(g), tr = E.TRACK[g.turn - 1], i = g.phasing === 'german' ? 0 : 1, sd = tr.sd, b = g.battle;
  const ph = (['reinforcement', ...E.PHASES] as E.Phase[]).map((p) => `<span class="${p === g.phase ? 'on' : ''}">${PHASE_NAME[p]}</span>`).join('');
  const head = `<div><h2>Turn ${g.turn} of ${g.lastTurn} · <span class="side-${g.phasing}">${sideName(g.phasing)}</span> player</h2><div class="phase">${ph}</div>
    <p class="hint">VP: German ${v.german} · Allied ${v.allied} · net <b>${v.net > 0 ? 'German +' + v.net : v.net < 0 ? 'Allied +' + -v.net : '0'}</b>${sd ? ` · sudden death at German ${sd[0]} / Allied ${sd[1]}` : ' · no sudden death before turn 4'} · draws this phase: German ${tr.ge[i]}, Allied ${tr.al[i]}</p></div>`;
  let body = '';
  if (g.over) body += `<p class="hint"><b>${esc(g.over)}</b></p>`;
  if (g.pendingBlow) {
    const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!, p = g.pendingBlow.path, def = E.other(u.side);
    body += `<div class="alert"><h2>${sideName(def)}: bridge?</h2><p class="hint">${esc(u.name)} tries to cross into ${esc(areaName(p[p.length - 1]))} from ${esc(areaName(p[p.length - 2]))}. Attempt to blow the bridge? It works on a roll of 1–5.</p><div class="row">${btn('Attempt to blow it', () => E.resolveBlow(g, true), 'primary')}${btn('Let them cross', () => E.resolveBlow(g, false))}</div></div>`;
  } else if (b) body += battlePanel(b);
  else {
    const un = (id: string) => g.units.find((x) => x.id === id)!;
    if (g.phase === 'reinforcement') body += `<p class="hint">Reinforcements were placed and the Used Box recycled into the cup. ${g.tfNew.length ? 'Place new Task Forces: select a supplied friendly area on the map, then choose.' : ''}</p>` + g.tfNew.map((id) => btn(`Place Task Force in ${selArea != null ? esc(areaName(selArea)) : '(select an area)'}`, () => E.placeTaskForce(g, id, selArea!), '', selArea == null)).join('');
    if (g.phase === 'admin') body += `<p class="hint">Chits were drawn. Both players may now use engineers, events, staff and Special Actions: select a chit below.</p>`;
    if (g.phase === 'movement') body += `<p class="hint">Select one of your blocks, then click a green area to move (orange: it must stop there). A unit may instead be placed in reserve. Moves over 3 MP cost the Germans a fuel asset.</p>`;
    if (g.phase === 'strategic') body += `<p class="hint">Select a block with a reserve marker; green areas show where it can strat-move (Germans: one unit, one fuel asset).</p><div class="list">${g.units.filter((x) => x.side === g.phasing && x.reserve && x.area != null).map(unitRow).join('') || '<span class="why">No reserves.</span>'}</div>`;
    if (g.phase === 'combat' || g.phase === 'btCombat') {
      const avail = E.contestedAreas(g).filter((a) => !g.fought.includes(a)), must = E.mustFight(g);
      body += `<div><h2>Battles</h2>${avail.length ? `<div class="list">${avail.map((a) => `<button class="unit" data-do="${reg(() => { E.startBattle(g, a, g.phase === 'btCombat'); lastRolls = 0; selArea = a; })}"><b>${esc(areaName(a))}</b><span class="why">${must.includes(a) ? '<span class="tag bad">mandatory</span>' : g.phase === 'btCombat' && !E.newlyContested(g).includes(a) ? 'costs a Special Action' : 'optional'}</span></button>`).join('')}</div>` : '<p class="hint">No contested areas left.</p>'}</div>`;
    }
    if (g.phase === 'reaction') body += `<p class="hint">${sideName(E.other(g.phasing))} reserves may move (full allowance) to uncontested areas or into contested ones to reinforce. Select a reserve block.</p><div class="list">${g.units.filter((x) => x.side !== g.phasing && x.reserve && x.area != null).map(unitRow).join('') || '<span class="why">No reserves.</span>'}</div>`;
    if (g.phase === 'btMove') body += `<p class="hint">Reserve and exploitation-marked blocks may move. Other armor units can be activated with a Special Action (one area).</p><div class="list">${g.units.filter((x) => x.side === g.phasing && (x.reserve || x.exploit) && x.area != null && !x.moved).map(unitRow).join('') || '<span class="why">No eligible blocks.</span>'}</div>`;
    if (g.phase === 'supply') body += '<p class="hint">Supply was checked, disorder adjusted, unsupplied morale rolled and markers removed.</p>';
    const u = selUnit ? g.units.find((x) => x.id === selUnit) : null;
    if (u) {
      const o = g.phase === 'strategic' ? [] : E.moveOptions(g, u.id);
      body += `<div><h2>Block</h2>${unitRow(u)}<div class="row">${g.phase === 'movement' && u.side === g.phasing ? (u.reserve ? btn('Remove reserve marker', () => E.setReserve(g, u.id, false)) : btn('Place in reserve', () => E.setReserve(g, u.id, true), '', !E.canReserve(g, u))) : ''}${['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved ? btn('Build field works', () => E.buildFieldWorks(g, u.id), '', !(u.area != null && !u.unsupplied && !u.disorder && !E.contested(g, u.area) && !g.fieldWorks.includes(u.area) && ((g.phase === 'movement' && u.side === g.phasing) || (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) || (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit))))) : ''}${g.phase === 'btMove' && u.side === g.phasing && u.cls === 'armor' && !u.exploit && !u.reserve && !u.moved ? btn(`Activate (Special Action, ${E.saAvailable(g, u.side, u.ech).length} left)`, () => E.activateBreakthrough(g, u.id), '', !E.saAvailable(g, u.side, u.ech).length) : ''}</div>
        ${o.length ? `<p class="hint">${o.length} reachable area(s): ${o.slice(0, 7).map((x) => `${esc(areaName(x.area))} ${x.cost}${x.fuel ? '⛽' : ''}`).join(', ')}${o.length > 7 ? '…' : ''}</p>` : ''}</div>`;
    }
    if (selArea != null) {
      const us = E.unitsIn(g, selArea), a = E.areas.get(selArea)!;
      body += `<div><h2>Area ${a.id}</h2><h3>${esc(a.name)}</h3><p class="hint">TDN ${a.tdn} · zone ${a.zone} · ${sideName(g.control[a.id])}-controlled${g.fieldWorks.includes(a.id) ? ' · field works' : ''}${g.riverAssault.includes(a.id) ? ' · river assault' : ''}${(a.vp.allied || a.vp.german || a.vp.mutual) ? ` · VP area (${a.vp.mutual ? 'both' : a.vp.german ? 'German ' + a.vp.german : 'Allied ' + a.vp.allied})` : ''}</p>${us.length ? `<div class="list">${us.map(unitRow).join('')}</div>` : '<p class="hint">Empty.</p>'}</div>`;
    }
    void un;
    const must = E.mustFight(g);
    body += `<div class="row">${btn(`End ${PHASE_NAME[g.phase].toLowerCase()} phase`, () => E.endPhase(g), 'primary', !!must.length || !!g.over)}</div>${must.length ? `<p class="why">${must.length} mandatory battle(s) left.</p>` : ''}`;
  }
  const c = selChit ? g.chits.find((x) => x.id === selChit) : null;
  const chitHtml = c && !b ? chitPanel(c) : '';
  const settings = `<details><summary class="why">New game</summary><div class="row"><select data-sel="${regv((x) => { newOpts.scenario = x as 'tournament' | 'campaign'; })}"><option value="tournament" ${newOpts.scenario === 'tournament' ? 'selected' : ''}>Tournament (5 turns)</option><option value="campaign" ${newOpts.scenario === 'campaign' ? 'selected' : ''}>Campaign (9 turns)</option></select>
    <label class="why"><input type="checkbox" ${newOpts.fuel ? 'checked' : ''} data-sel="${regv((x) => { newOpts.fuel = x === 'on'; })}"> German fuel rule</label>${btn('Start', () => { g = E.newGame(undefined, newOpts); selArea = selUnit = selChit = null; lastRolls = 0; }, 'primary')}</div></details>`;
  $('#panel').innerHTML = head + (msg ? `<p class="hint" style="color:var(--bad)">${esc(msg)}</p>` : '') + body + (b || g.pendingBlow ? '' : `<div><h2>Assets and events</h2>${boxesHtml()}</div>` + chitHtml) + settings + `<div><h2>Log</h2><div class="log">${[...g.log].reverse().slice(0, 80).map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>`;
  $('#hud').textContent = `Left-drag pan · right-drag / Shift rotate · wheel zoom   |   T${g.turn} ${sideName(g.phasing)} ${PHASE_NAME[g.phase]}`;
  document.querySelectorAll<HTMLElement>('[data-do]').forEach((e) => (e.onclick = () => act(acts[e.dataset.do!])));
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-sel]').forEach((e) => (e.onchange = () => { const f = actv[e.dataset.sel!]; if (f) { f(e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : e.value); save(); } }));
  document.querySelectorAll<HTMLElement>('[data-u]').forEach((e) => (e.onclick = () => { selUnit = e.dataset.u!; selArea = g.units.find((x) => x.id === selUnit)!.area ?? selArea; refresh(); }));
  document.querySelectorAll<HTMLElement>('[data-chit]').forEach((e) => (e.onclick = () => { selChit = selChit === e.dataset.chit ? null : e.dataset.chit!; refresh(); }));
}
function refresh() { drawPieces(); paintAreas(); render(); }
function frame() {
  requestAnimationFrame(frame);
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  placeCam(); renderer.render(scene, cam);
}
refresh(); frame();
