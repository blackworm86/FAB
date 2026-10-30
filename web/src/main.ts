import * as THREE from 'three';
import mapJson from '../../data/bulge/map.json';
import {
  newGame, areas, unitsIn, quality, moveOptions, move, endPhase, mustFight, contestedAreas, newlyContested, startBattle, fireOdds,
  defensiveFire, attackerChoice, offensiveFire, defenderChoice, hitPmf, probAtLeast, meanHits, type Game, type Battle, type Unit,
} from '../../engine/src';

type MapArea = { id: number; label: [number, number]; polygon: [number, number][] };
const MAP = mapJson as unknown as { size: [number, number]; areas: MapArea[] };
const [MW, MH] = MAP.size, S = 100;                                  // map pixels per world unit
const toWorld = (x: number, y: number) => new THREE.Vector3(x / S - MW / (2 * S), 0, y / S - MH / (2 * S));
const $ = (s: string) => document.querySelector(s) as HTMLElement;

/* ---------- state ---------- */
let g: Game = newGame();
let selArea: number | null = null, selUnit: string | null = null, battle: Battle | null = null, lastRolls = 0;
const save = () => { try { localStorage.setItem('fab-demo', JSON.stringify(g)); } catch { /* storage off: game still runs */ } };
try { const s = localStorage.getItem('fab-demo'); if (s) g = JSON.parse(s); } catch { /* ignore */ }

/* ---------- three.js scene ---------- */
const canvas = $('#gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101314);
const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-6, 14, 9); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); scene.add(sun);

const mapTex = new THREE.TextureLoader().load('./map.jpg'); mapTex.colorSpace = THREE.SRGBColorSpace;
mapTex.repeat.set(MW / 2448, 1); mapTex.anisotropy = 8;              // the scan is 2448 wide; the playing area is the left 1740 px
const board = new THREE.Mesh(new THREE.PlaneGeometry(MW / S, MH / S), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9 }));
board.rotation.x = -Math.PI / 2; board.receiveShadow = true; scene.add(board);
const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1 }));
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
const tex = (id: string) => { if (!labelTex.has(id)) { const t = new THREE.TextureLoader().load(`./blocks/${id}.png`); t.colorSpace = THREE.SRGBColorSpace; t.center.set(0.5, 0.5); labelTex.set(id, t); } return labelTex.get(id)!; };
const WOOD = { german: 0x8e9296, allied: 0x5d8a45 };
const BRIT = new Set(['43 Inf', '53 Inf', 'Guards', '51 Inf']);

function block(u: Unit) {
  const w = 0.42, h = 0.42, d = 0.13;
  const wood = new THREE.MeshStandardMaterial({ color: BRIT.has(u.name) ? 0x3f6fb8 : WOOD[u.side], roughness: 0.75 });
  if (u.garrison) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), [wood, wood, new THREE.MeshStandardMaterial({ color: 0x9cc6e8 }), wood, wood, wood]);
    m.position.y = 0.02; return m;
  }
  const t = tex(u.id).clone(); t.needsUpdate = true; t.rotation = ((u.max - u.str) * Math.PI) / 2;   // a step loss turns the block 90° (2.3)
  const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wood, wood, wood, wood, face, wood]);
  m.position.y = h / 2; m.castShadow = true;
  if (u.disorder) m.rotation.z = u.disorder === 1 ? 0.25 : 0.12;                                      // tilt = disordered / recovering
  return m;
}
function drawPieces() {
  pieces.clear();
  for (const a of MAP.areas) {
    const us = unitsIn(g, a.id); if (!us.length) continue;
    const base = toWorld(a.label[0], a.label[1]);
    us.forEach((u, i) => {
      const m = block(u); const row = u.side === 'german' ? 0.32 : -0.32;
      m.position.x = base.x + (us.filter((x) => x.side === u.side).indexOf(u) - (us.filter((x) => x.side === u.side).length - 1) / 2) * 0.48;
      m.position.z = base.z + (contestedAreas(g).includes(a.id) ? row : 0.1) + 0.0;
      m.userData.unit = u.id; if (u.id === selUnit) { const o = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffb347 })); m.add(o); }
      pieces.add(m);
    });
  }
}
function paintAreas() {
  const opts = selUnit ? moveOptions(g, selUnit) : [];
  const fight = g.phase === 'combat' ? contestedAreas(g).filter((a) => !g.fought.includes(a)) : [];
  const must = new Set(mustFight(g));
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial;
    let c = 0xffffff, o = 0;
    const r = opts.find((x) => x.area === id);
    if (r) { c = r.mustStop ? 0xff8a3d : 0x37d67a; o = 0.32; }
    else if (fight.includes(id)) { c = must.has(id) ? 0xff4d4d : 0xffc542; o = 0.28; }
    if (id === selArea) { c = 0x4aa3ff; o = Math.max(o, 0.3); }
    mat.color.setHex(c); mat.opacity = o;
  }
}

/* ---------- camera ---------- */
let target = new THREE.Vector3(3, 0, -1), yaw = 0, pitch = 1.0, dist = 9;
function placeCam() { cam.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(target); }
const ptrs = new Map<number, [number, number]>(); let moved = 0, pinch = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; pinch = 0; });
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.min(30, Math.max(2, dist * pinch / d)); pinch = d; moved = 99; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey) { yaw -= dx * 0.006; pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006)); }
  else { const k = dist * 0.0018, c = Math.cos(yaw), s = Math.sin(yaw); target.x -= (dx * c + dy * s) * k; target.z -= (-dx * s + dy * c) * k; }
});
canvas.addEventListener('pointerup', (e) => { ptrs.delete(e.pointerId); if (moved < 6) click(e); });
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.min(30, Math.max(2, dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });

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
function click(e: PointerEvent) {
  const { unit, area } = pick(e);
  if (selUnit && area != null && moveOptions(g, selUnit).some((o) => o.area === area)) { try { move(g, selUnit, area); } catch (err) { flash(String(err)); } selUnit = null; selArea = area; return refresh(); }
  if (unit) { const u = g.units.find((x) => x.id === unit)!; selArea = u.area; selUnit = u.side === g.phasing && g.phase === 'movement' && !u.moved ? unit : null; }
  else { selArea = area; selUnit = null; }
  refresh();
}

/* ---------- panel ---------- */
const PH = ['movement', 'combat', 'supply'] as const;
const pips = (u: Unit) => Array.from({ length: u.str }, () => `<i class="pip ${quality(u)}"></i>`).join('');
const sideName = (s: string) => (s === 'german' ? 'German' : 'Allied');
let msg = '';
function flash(s: string) { msg = s; refresh(); }
function unitRow(u: Unit) {
  const tags = [u.garrison ? 'garrison' : u.cls, u.disorder === 1 ? '<span class="tag bad">disordered</span>' : u.disorder === 2 ? '<span class="tag warn">recovering</span>' : '', u.unsupplied ? '<span class="tag bad">unsupplied</span>' : '', u.moved && g.phase === 'movement' && u.side === g.phasing ? '<span class="tag">moved</span>' : '', u.reserve ? '<span class="tag">reserve</span>' : ''].filter(Boolean).join(' ');
  return `<button class="unit ${u.id === selUnit ? 'sel' : ''}" data-u="${u.id}"><b class="side-${u.side}">${u.name}</b> <span class="why">${tags}</span><span class="pips">${pips(u)}</span></button>`;
}
function oddsBlock(b: Battle, attackerFires: boolean) {
  const o = fireOdds(g, b, attackerFires); if (!o.length) return '<p class="hint">No one can fire.</p>';
  const pmf = hitPmf(o.map((x) => ({ dice: x.unit.str, sn: x.sn })));
  return `<div class="odds"><span class="h">Firer</span><span class="h">dice</span><span class="h">SN</span>${o.map((x) => `<span title="${x.parts.map(([w, v]) => `${w} ${v > 0 ? '+' : ''}${v}`).join('\n')}">${x.unit.name}</span><span>${x.unit.str}</span><span>${x.sn}</span>`).join('')}</div>
    <p class="hint">Expected hits <b>${meanHits(pmf).toFixed(2)}</b> · ≥1 hit <b>${Math.round(probAtLeast(pmf, 1) * 100)}%</b> · ≥2 <b>${Math.round(probAtLeast(pmf, 2) * 100)}%</b> · ≥3 <b>${Math.round(probAtLeast(pmf, 3) * 100)}%</b></p>`;
}
function battlePanel(b: Battle) {
  const name = areas.get(b.area)!.name, att = unitsIn(g, b.area, b.attacker).filter((u) => !u.garrison && !u.disorder), def = unitsIn(g, b.area).filter((u) => u.side !== b.attacker);
  const sel = (id: string, us: Unit[], cur: string, dis: boolean) => `<select id="${id}" ${dis ? 'disabled' : ''}>${us.map((u) => `<option value="${u.id}" ${u.id === cur ? 'selected' : ''}>${u.name}</option>`).join('')}</select>`;
  const rolls = b.rolls.slice(lastRolls).map((r) => `<div><b>${r.who}</b> <span class="why">SN ${r.sn}</span><div class="dice">${r.dice.map((d) => `<span class="die ${d === 1 || (d !== 10 && d <= r.sn) ? 'hit' : ''}">${d}</span>`).join('')}</div></div>`).join('');
  let action = '';
  if (b.stage === 'defFire') action = `<button class="primary" id="b-go">Roll defensive fire</button>`;
  if (b.stage === 'attChoice') action = `<p class="hint">${b.pendingHits} more hit(s) on the attacker. Abort (all attackers disordered, no more losses) or continue (take them as step losses)?</p><div class="row"><button id="b-abort">Abort attack</button><button class="primary" id="b-cont">Continue</button></div>`;
  if (b.stage === 'offFire') action = `<button class="primary" id="b-go">Roll offensive fire</button>`;
  if (b.stage === 'defChoice') action = `<p class="hint">${b.pendingHits} hit(s) on the defender. Retreat all units (absorbs 1 hit, they become disordered) or stand and take step losses?</p><div class="row"><button id="b-stand">Stand</button><button class="primary" id="b-ret">Retreat</button></div>`;
  if (b.stage === 'done') action = `<p class="hint"><b>${b.result}</b></p><button class="primary" id="b-close">Close battle</button>`;
  return `<div><h2>Battle</h2><h3>${name}</h3><p class="hint">TDN ${areas.get(b.area)!.tdn}${g.fieldWorks.includes(b.area) ? ' · field works' : ''}${g.riverAssault.includes(b.area) ? ' · river assault' : ''}</p></div>
    <div class="row"><label class="why">Attacker point</label>${sel('p-att', att, b.attPoint, b.stage !== 'defFire')}<label class="why">Defender point</label>${sel('p-def', def, b.defPoint, b.stage !== 'defFire')}</div>
    ${b.stage === 'defFire' || b.stage === 'attChoice' ? `<div><h2>Defensive fire (${sideName(b.attacker === 'german' ? 'allied' : 'german')})</h2>${oddsBlock(b, false)}</div>` : ''}
    ${b.stage !== 'done' && b.stage !== 'defChoice' ? `<div><h2>Offensive fire (${sideName(b.attacker)})</h2>${oddsBlock(b, true)}</div>` : ''}
    ${rolls ? `<div class="list">${rolls}</div>` : ''}${action}`;
}
function render() {
  const must = mustFight(g);
  const head = `<div><h2>Turn ${g.turn} of ${g.lastTurn} · <span class="side-${g.phasing}">${sideName(g.phasing)}</span> player</h2>
    <div class="phase">${PH.map((p) => `<span class="${p === g.phase ? 'on' : ''}">${p}</span>`).join('')}</div></div>`;
  let body = '';
  if (g.over) body = `<p class="hint"><b>${g.over}</b></p><button class="primary" id="b-new">New game</button>`;
  else if (battle) body = battlePanel(battle);
  else {
    if (g.phase === 'movement') body += `<p class="hint">Select one of your blocks, then click a green area to move (orange = it must stop there). Each unit moves once.</p>`;
    if (g.phase === 'combat') {
      const avail = contestedAreas(g).filter((a) => !g.fought.includes(a));
      body += `<div><h2>Battles</h2>${avail.length ? `<div class="list">${avail.map((a) => `<button class="unit" data-fight="${a}"><b>${areas.get(a)!.name}</b><span class="why">${must.includes(a) ? '<span class="tag bad">mandatory</span>' : newlyContested(g).includes(a) ? '' : 'optional'}</span></button>`).join('')}</div>` : '<p class="hint">No contested areas left.</p>'}</div>`;
    }
    if (g.phase === 'supply') body += `<p class="hint">Supply was checked, disorder adjusted and markers removed. Unsupplied units are tagged.</p>`;
    if (selArea != null) { const us = unitsIn(g, selArea), a = areas.get(selArea)!;
      body += `<div><h2>Area ${a.id}</h2><h3>${a.name}</h3><p class="hint">TDN ${a.tdn} · zone ${a.zone} · controlled by ${sideName(g.control[a.id])}${g.fieldWorks.includes(a.id) ? ' · field works' : ''}${g.riverAssault.includes(a.id) ? ' · river assault' : ''}</p>
      ${us.length ? `<div class="list">${us.map(unitRow).join('')}</div>` : '<p class="hint">Empty.</p>'}</div>`;
      if (selUnit) { const o = moveOptions(g, selUnit); body += `<p class="hint">${o.length} reachable area(s). Cheapest costs: ${o.slice(0, 6).map((x) => `${areas.get(x.area)!.name} ${x.cost}`).join(', ')}${o.length > 6 ? '…' : ''}</p>`; }
    }
    body += `<div class="row"><button class="primary" id="b-end" ${must.length ? 'disabled' : ''}>End ${g.phase} phase</button><button id="b-new">New game</button></div>${must.length ? `<p class="why">${must.length} mandatory battle(s) left.</p>` : ''}`;
  }
  $('#panel').innerHTML = head + (msg ? `<p class="hint" style="color:var(--bad)">${msg}</p>` : '') + body + `<div><h2>Log</h2><div class="log">${[...g.log].reverse().slice(0, 60).map((l) => `<div>${l}</div>`).join('')}</div></div>`;
  msg = '';
  $('#hud').textContent = `Left-drag pan · right-drag / Shift rotate · wheel zoom   |   T${g.turn} ${sideName(g.phasing)} ${g.phase}`;
  bind();
}
function bind() {
  const on = (id: string, f: () => void) => { const e = document.getElementById(id); if (e) e.onclick = () => { try { f(); } catch (err) { msg = (err as Error).message; } save(); refresh(); }; };
  on('b-end', () => { endPhase(g); selUnit = null; });
  on('b-new', () => { g = newGame(); battle = null; selArea = selUnit = null; });
  document.querySelectorAll<HTMLElement>('[data-u]').forEach((b) => (b.onclick = () => { const u = g.units.find((x) => x.id === b.dataset.u)!; selUnit = u.side === g.phasing && g.phase === 'movement' && !u.moved ? u.id : null; refresh(); }));
  document.querySelectorAll<HTMLElement>('[data-fight]').forEach((b) => (b.onclick = () => { try { battle = startBattle(g, +b.dataset.fight!); lastRolls = 0; selArea = battle.area; } catch (err) { msg = (err as Error).message; } refresh(); }));
  if (!battle) return;
  const b = battle;
  const pa = document.getElementById('p-att') as HTMLSelectElement | null, pd = document.getElementById('p-def') as HTMLSelectElement | null;
  if (pa) pa.onchange = () => { b.attPoint = pa.value; refresh(); }; if (pd) pd.onchange = () => { b.defPoint = pd.value; refresh(); };
  on('b-go', () => { lastRolls = b.rolls.length; if (b.stage === 'defFire') defensiveFire(g, b); else offensiveFire(g, b); });
  on('b-abort', () => attackerChoice(g, b, true)); on('b-cont', () => { lastRolls = b.rolls.length; attackerChoice(g, b, false); });
  on('b-stand', () => defenderChoice(g, b, false)); on('b-ret', () => defenderChoice(g, b, true));
  on('b-close', () => { battle = null; lastRolls = 0; });
}
function refresh() { drawPieces(); paintAreas(); render(); }

function frame() {
  requestAnimationFrame(frame);
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) { renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
  placeCam(); renderer.render(scene, cam);
}
refresh(); frame();
