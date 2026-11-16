// Marks drawn over the map: area tags, the selected area in focus, leader lines and decision bubbles, the act-now halos and Skip, option tags, and where the badges sit.
import * as THREE from 'three';
import { lossPieces, pointSide } from './asset-uses';
import * as E from '../../engine/src';
import { ico } from './icons';
import { esc, nm } from './util';
import { btn } from './ui-kit';
import { type Tgt } from './chit-play';
import { $, areaName, LAB, MAP, MH, MW, S, toWorld, VOL } from './page';
import { areaPick, g, selArea, selUnit } from './game-state';
import { board, cam, canvas, scene } from './scene';
import { diorama, REL, setFocusOn, show3d } from './map3d';
import { markers, overlays, pieces, table } from './piece-kit';
import { labelMode, labelsGrp, seen, setTagHover, shownArea, tagHover } from './map-paint';
import { areaAt, pick, ray, target } from './camera';
import { allowed, fxLayer, mine, other, selArr } from './flow';
import { arrOpts } from './choices';
import { areaWorld, center, reinforcing } from './map-input';
import { badgeEls } from './routes';
import { rollView } from './main';

/* ---------- area tags (owner's drawing, 11 November): the TDN shape holding the area number, the TDN to subtract in its corner, the name, the VP marks.
   One size on screen, upright, in the middle of an empty area and just under the pieces of a busy one; Labels on the Layer bar: on, see-through, off. */
const TDN_SHAPE = [
  '<circle cx="12" cy="12" r="10.5"/>',
  '<rect x="1.5" y="1.5" width="21" height="21" rx="2"/>',
  '<polygon points="6,1.5 18,1.5 23.5,12 18,22.5 6,22.5 0.5,12"/>',
  '<polygon points="0.8,2 23.2,2 12,23"/>',
];
const tagEls = new Map<number, HTMLElement>();
export let tagKey = '',
  tagPpu = 0;
/** Zoom, as screen pixels per map unit: above NEAR the labels turn solid; above CLOSE (very close) No names shows the names too. */
const TAG_NEAR = 50,
  TAG_CLOSE = 90;
export function syncAreaTags() {
  const key = `${labelMode}|${g.inPlay?.join() ?? ''}`;
  if (key === tagKey) return;
  tagKey = key;
  const layer = $('#tags');
  layer.innerHTML = '';
  tagEls.clear();
  tagW.clear();
  layer.className = labelMode;
  if (labelMode === 'off') return;
  for (const a of MAP.areas) {
    const L = LAB[a.id],
      ar = E.areas.get(a.id);
    if (!L || L.mode === 'none' || !ar || !shownArea(a.id)) continue;
    const t = Math.max(0, Math.min(3, ar.tdn)),
      v = ar.vp as Record<string, number | boolean>;
    const vps = [
      ...Object.keys(VOL.art.vpIcons)
        .filter((k) => k !== 'mutual')
        .flatMap((k) => Array<string>(typeof v[k] === 'number' ? (v[k] as number) : 0).fill(VOL.art.vpIcons[k])),
      ...(v.mutual ? [VOL.art.vpIcons.mutual] : []),
    ];
    const d = document.createElement('div');
    d.className = `atag t${t}${vps.length ? ' vp' : ''}`;
    d.innerHTML = `<span class="sw"><svg viewBox="0 0 24 24" aria-hidden="true">${TDN_SHAPE[t]}<text x="12" y="${t === 3 ? 9.6 : 12}" class="${a.id >= 100 ? 'n3' : a.id >= 10 ? 'n2' : ''}">${a.id}</text></svg></span><span class="nm">${esc(areaName(a.id))}</span>${vps.map((src) => `<img alt="" src="${src}">`).join('')}`;
    layer.appendChild(d);
    tagEls.set(a.id, d);
  }
}
let namedKey = '',
  named = new Set<number>();
/** The areas the current instruction or main button names: the battles to fight, the retreat areas, the areas to pick. */
function namedAreas() {
  const k = `${g.turn}${g.phasing}${g.phase}${g.log.length}${g.battle?.stage}${areaPick ? [...areaPick.areas].join() : ''}`;
  if (k !== namedKey) {
    namedKey = k;
    named = new Set([
      ...(g.phase === 'combat' || g.phase === 'btCombat' ? E.mustFight(g) : []),
      ...(g.battle?.stage === 'retreat' ? E.retreatOptions(g, g.battle) : []),
      ...(areaPick ? areaPick.areas : []),
    ]);
  }
  return named;
}
function placeAreaTags() {
  const layer = $('#tags');
  if (labelMode === 'off' || !tagEls.size) return;
  const inBattle = !!g.battle && g.battle.stage !== 'retreat'; // choosing where to retreat: the names are needed
  layer.style.display = inBattle ? 'none' : '';
  if (inBattle) return; // the battle has the screen
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3(),
    under = new Map<number, number>();
  {
    const a = target.clone().project(cam),
      b = target
        .clone()
        .add(new THREE.Vector3(1, 0, 0))
        .project(cam);
    tagPpu = Math.hypot((b.x - a.x) * r.width, (b.y - a.y) * r.height) / 2;
  }
  layer.classList.toggle('solid', tagPpu >= TAG_NEAR);
  layer.classList.toggle('close', tagPpu >= TAG_CLOSE); // very close: No names shows the names too
  let inView: number | null = null;
  if (tagPpu >= TAG_NEAR) {
    ray.setFromCamera(new THREE.Vector2(0, 0), cam);
    inView = areaAt(ray);
  } // close up: the area in the middle of the screen keeps its tag on screen
  for (const u of g.units)
    if (u.area != null && tagEls.has(u.area)) {
      const p = pieceScreen(u.id);
      if (p) under.set(u.area, Math.max(under.get(u.area) ?? -1e9, p.y - r.top + p.rad * 0.8));
    }
  const tagShown: { id: number; d: HTMLElement; px: number; py: number }[] = [],
    thin = innerWidth < 700 && tagPpu < TAG_NEAR, // phone, zoomed out: labels that would sit on another one step aside (design review 16 Nov)
    shown: { id: number; d: HTMLElement; px: number; py: number; k: number }[] = [];
  for (const [id, d] of tagEls) {
    const c = center(id);
    v.set(c.x, show3d() ? REL!.h(c.x, c.z) : 0, c.z).project(cam);
    const sx = (v.x * 0.5 + 0.5) * r.width,
      by = under.get(id),
      sy = by != null ? by + 15 : (-v.y * 0.5 + 0.5) * r.height; // a busy area: just under its lowest piece
    const hov = id === tagHover || id === selArea;
    const pin = id === inView,
      px = pin ? Math.min(r.width - 90, Math.max(90, sx)) : sx,
      py = pin ? Math.min(r.height - 30, Math.max(30, sy)) : sy;
    d.style.display = v.z < 1 || pin ? '' : 'none'; // every area keeps its label at every tilt and zoom (owner's issue #15)
    d.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
    d.classList.toggle('hov', hov);
    if (d.style.display === '') tagShown.push({ id, d, px, py });
    if (thin && d.style.display === '') shown.push({ id, d, px, py, k: hov || pin ? 3 : by != null ? 2 : 1 });
  }
  if (innerWidth < 700 && badgeBoxes.length)
    for (const t of tagShown) {
      const w = tagW.get(t.id) ?? t.d.offsetWidth ?? 80,
        q = { x0: t.px - w / 2, x1: t.px + w / 2, y0: t.py - 11, y1: t.py + 11 };
      if (badgeBoxes.some((o) => q.x0 < o.x1 && q.x1 > o.x0 && q.y0 < o.y1 && q.y1 > o.y0)) t.d.style.display = 'none';
    } // phone: a label under a move badge steps aside (the badge is what matters while a block is selected)
  if (thin) {
    const kept: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const t of shown.sort((a, b) => b.k - a.k)) {
      let w = tagW.get(t.id);
      if (w == null) tagW.set(t.id, (w = t.d.offsetWidth || 80)); // measured once: a label's width does not change while it is shown
      const q = { x0: t.px - w / 2, x1: t.px + w / 2, y0: t.py - 11, y1: t.py + 11 };
      if (t.k < 3 && kept.some((o) => q.x0 < o.x1 && q.x1 > o.x0 && q.y0 < o.y1 && q.y1 > o.y0)) t.d.style.display = 'none';
      else kept.push(q);
    }
  }
}
const tagW = new Map<number, number>();
let badgeBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
canvas.addEventListener('pointermove', (e) => {
  if (labelMode === 'off' || e.buttons) return;
  const a = pick(e).area ?? null;
  if (a !== tagHover) setTagHover(a);
});
/** Focus on the battle. The whole table is drawn blurred and dimmed by the browser; a second canvas draws the contested area again, sharp, with its pieces (so nothing inside is cut),
 *  and the area's exact edge glows. */
const canvas2 = document.getElementById('gl2') as HTMLCanvasElement;
let renderer2: THREE.WebGLRenderer | null = null,
  focusMesh: THREE.Mesh | null = null,
  focusFor = -1;
function focusGeometry(id: number) {
  const poly = MAP.areas.find((a) => a.id === id)!.polygon,
    shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x / S - MW / (2 * S), -(y / S - MH / (2 * S))))),
    geo = new THREE.ShapeGeometry(shape),
    pos = geo.getAttribute('position'),
    uv: number[] = [];
  for (let k = 0; k < pos.count; k++) uv.push(((pos.getX(k) + MW / (2 * S)) * S) / MW, 1 - ((-pos.getY(k) + MH / (2 * S)) * S) / MH);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}
const inPoly = (x: number, z: number, pts: THREE.Vector3[]) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (pts[i].z > z !== pts[j].z > z && x < ((pts[j].x - pts[i].x) * (z - pts[i].z)) / (pts[j].z - pts[i].z) + pts[i].x) c = !c;
  }
  return c;
};
/** Second pass: only the battle area and what stands in it, on a transparent canvas laid over the blurred one. */
export function renderFocus() {
  const b = g.battle,
    on = !!b && !reinforcing && b.stage !== 'retreat';
  setFocusOn(on); // choosing where to retreat needs the neighbouring areas sharp
  canvas.classList.toggle('blurred', on);
  canvas2.style.display = on ? 'block' : 'none';
  if (!on) return;
  if (!renderer2) {
    renderer2 = new THREE.WebGLRenderer({ canvas: canvas2, antialias: true, alpha: true });
    renderer2.setPixelRatio(Math.min(2, devicePixelRatio));
  }
  const r = canvas.getBoundingClientRect();
  if (
    canvas2.width !== Math.round(r.width * renderer2.getPixelRatio()) ||
    canvas2.height !== Math.round(r.height * renderer2.getPixelRatio())
  )
    renderer2.setSize(r.width, r.height, false);
  if (!focusMesh || focusFor !== b!.area) {
    if (focusMesh) {
      scene.remove(focusMesh);
      focusMesh.geometry.dispose();
      (focusMesh.material as THREE.Material).dispose();
    }
    focusMesh = new THREE.Mesh(focusGeometry(b!.area), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
    focusMesh.rotation.x = -Math.PI / 2;
    focusMesh.position.y = 0.002;
    focusFor = b!.area;
    scene.add(focusMesh);
  }
  (focusMesh.material as THREE.MeshStandardMaterial).map = (board.material as THREE.MeshStandardMaterial).map;
  (focusMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  const poly = areaWorld(b!.area),
    hidden: THREE.Object3D[] = [],
    bg = scene.background;
  const hide = (o: THREE.Object3D) => {
    if (o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  };
  hide(board);
  hide(table);
  hide(diorama);
  for (const l of labelsGrp.children) if (l.userData.area !== b!.area) hide(l);
  for (const [id, m] of overlays) if (id !== b!.area || show3d()) hide(m); // the close-up is flat: a tint draped on the relief would float above it
  for (const grp of [pieces, markers])
    for (const o of grp.children) {
      const a = o.userData.anchor ? pieces.children.find((x) => x.userData.unit === o.userData.anchor) : null,
        q = a ?? o,
        uid = (q.userData.unit ?? q.userData.anchor) as string | undefined,
        cid = q.userData.chit as string | undefined;
      const ofBattle =
        (uid && g.units.find((u) => u.id === uid)?.area === b!.area) ||
        (cid && E.sidesOf(g).some((s) => b!.assets[s].includes(cid) || E.airOf(b!, s).some((a) => a.id === cid))); // the battle formation may reach past the border: keep it sharp
      if (!ofBattle && !inPoly(q.position.x, q.position.z, poly)) hide(o);
    } // a marker follows the piece it belongs to
  focusMesh.visible = true;
  scene.background = null;
  renderer2.render(scene, cam);
  scene.background = bg;
  focusMesh.visible = false;
  for (const o of hidden) o.visible = true;
}
function placeFocus() {
  const sv = document.getElementById('glow') as unknown as SVGSVGElement,
    b = g.battle;
  if (!b || reinforcing || b.stage === 'retreat') {
    sv.style.display = 'none';
    return;
  }
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3(),
    pts = areaWorld(b.area).map((q) => {
      v.set(q.x, 0.01, q.z).project(cam);
      return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height] as [number, number];
    });
  sv.style.display = 'block';
  sv.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  const pg = sv.firstElementChild!;
  pg.setAttribute('points', pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' '));
  pg.setAttribute('class', b.stage === 'setup' ? 'gl set' : 'gl fire');
}
/** Screen position and radius of a piece on the table (block or counter), or null when it is not drawn. */
export function pieceScreen(id: string) {
  const o = pieces.children.find((x) => x.userData.unit === id || x.userData.chit === id);
  if (!o) return null;
  const r = canvas.getBoundingClientRect(),
    p = o.getWorldPosition(new THREE.Vector3()),
    a = p.clone().project(cam),
    b = p
      .clone()
      .add(new THREE.Vector3(0.95, 0, 0))
      .project(cam);
  return {
    x: r.left + (a.x * 0.5 + 0.5) * r.width,
    y: r.top + (-a.y * 0.5 + 0.5) * r.height,
    rad: Math.max(14, Math.abs(b.x - a.x) * 0.5 * r.width),
  };
}
/** The leader-line layer: thin lines from a bubble to the blocks it is about, with a dashed ring on each. */
const leaders = (() => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'leaders';
  document.body.appendChild(s);
  return s;
})();
let leaderLast = ''; // the lines are rewritten only when they change
const leaderSvg = (bx: number, by: number, pts: { x: number; y: number; rad: number }[], cls: string) =>
  pts
    .map((p) => {
      const ang = Math.atan2(by - p.y, bx - p.x),
        ex = p.x + Math.cos(ang) * p.rad,
        ey = p.y + Math.sin(ang) * p.rad,
        mx = bx + (bx < p.x ? 18 : -18);
      return `<path class="ln ${cls}" d="M${bx.toFixed(1)} ${by.toFixed(1)} H${mx.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle class="rg ${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.rad.toFixed(1)}"/><circle class="dt ${cls}" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5"/>`;
    })
    .join('');
/** Decisions made on the table: a small bubble just off the battle area, never over its pieces, with a line to each block it is about. */
function placeBubbles() {
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3();
  let svg = '';
  document.querySelectorAll<HTMLElement>('#ui .lossnum').forEach((e) => {
    const p = pieceScreen(e.dataset.pc!),
      pr = (e.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? r;
    e.style.display = p ? '' : 'none';
    if (p) e.style.transform = `translate(${p.x - pr.left + p.rad * 0.7}px, ${p.y - pr.top - p.rad * 0.7}px) translate(-50%, -50%)`;
  }); // the numbers of the loss list, on the glowing pieces (interaction system)
  document.querySelectorAll<HTMLElement>('#ui .mapbubble').forEach((e) => {
    const a = +e.dataset.area!,
      pts = areaWorld(a).map((q) => {
        v.set(q.x, 0, q.z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
      });
    const minX = Math.min(...pts.map((p) => p.x)),
      maxX = Math.max(...pts.map((p) => p.x)),
      cy = pts.reduce((t, p) => t + p.y, 0) / pts.length,
      w = e.offsetWidth || 160,
      h = e.offsetHeight || 44;
    const top = Math.max(60, (document.querySelector('#ui .c-table')?.getBoundingClientRect().bottom ?? 0) - r.top + 8); // never over the battle header
    const fitsR = maxX + 28 + w < r.width - 8,
      fitsL = minX - 28 - w > 8,
      below = !fitsR && !fitsL,
      maxY = Math.max(...pts.map((p) => p.y)); // phones: no room beside the area, so the bubble goes under it
    const right = fitsR || !fitsL,
      x = below
        ? Math.max(8, Math.min(r.width - w - 8, (minX + maxX) / 2 - w / 2))
        : right
          ? Math.min(r.width - w - 8, maxX + 28)
          : Math.max(8, minX - 28 - w),
      y = below
        ? ((floor) => (maxY + 18 + h <= floor ? maxY + 18 : Math.max(top, Math.min(floor - h, Math.min(...pts.map((p) => p.y)) - h - 18))))(
            Math.min(r.height - 70, (document.querySelector('#ui .c-ledger')?.getBoundingClientRect().top ?? 1e9) - r.top - 8),
          )
        : Math.min(r.height - h - 70, Math.max(top, cy - h / 2));
    const pr = (e.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? r;
    e.style.transform = `translate(${x + r.left - pr.left}px, ${y + r.top - pr.top}px)`; // the bubble lives in the stage, the lines over the canvas
    const tg = (e.dataset.tg ?? '')
      .split(',')
      .filter(Boolean)
      .map(pieceScreen)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ x: p.x - r.left, y: p.y - r.top, rad: p.rad }));
    svg += below
      ? leaderSvg(x + w / 2, y > maxY ? y : y + h, tg, 'gold') /* from the edge that faces the area: under it or, short of room, over it */
      : leaderSvg(right ? x : x + w, y + h / 2, tg, 'gold');
  });
  if (svg !== leaderLast) {
    leaders.innerHTML = svg;
    leaderLast = svg;
  }
  leaders.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  leaders.style.left = r.left + 'px';
  leaders.style.top = r.top + 'px';
  leaders.style.width = r.width + 'px';
  leaders.style.height = r.height + 'px';
}
/** The first loss of a failed attack (6.41a) is chosen on the table: the point unit or one battle asset lights up. */
export function decisionTargets(): Tgt | null {
  const b = g.battle,
    p0 = pointSide(),
    ps = b && p0 && (p0 === b.attacker || E.pointPending(g, b, p0)) ? p0 : null; // as long as the point list is shown
  if (!b || (((b.stage !== 'attFirst' && b.stage !== 'loss') || !allowed()) && !ps)) return null;
  const t: Tgt = {
    units: new Map(),
    areas: new Map(),
    pick: new Map(),
    color: new Map(),
    chips: [],
    buttons: [],
    modes: [],
    any: null,
    hint: '',
  };
  if (ps) {
    for (const id of E.pointChoices(g, b, ps)) t.units.set(id, () => E.setPoint(g, g.battle!, ps, id));
    t.hint = 'Tap a glowing block to make it your point unit (6.24)';
    return t;
  }
  if (b.stage === 'loss') {
    for (const id of E.lossOptions(g, b)) t.units.set(id, () => E.chooseLoss(g, g.battle!, id));
    t.hint = 'Tap a glowing block or asset to take the next step loss (6.43)';
    return t;
  } // 6.43: the owner places each loss
  t.units.set(b.attPoint, () => E.chooseFirstLoss(g, g.battle!, b.attPoint));
  for (const id of b.assets[b.attacker].filter((x) => E.isBattleAsset(E.chit(g, x))))
    t.units.set(id, () => E.chooseFirstLoss(g, g.battle!, id));
  return t;
}
/** The choice the battle is waiting for, as a bubble over the deciding side's row. */
export function decisionBubble(): string {
  const b = g.battle;
  if (b && !rollView && (b.stage === 'loss' || b.stage === 'attFirst') && allowed())
    return lossPieces()
      .filter((x) => x.ok)
      .map((x, i) => `<i class="lossnum" data-pc="${x.id}">${i + 1}</i>`)
      .join(''); // losses: the list above the bar; the same numbers on the map, no bubble (interaction system)
  return ''; // the hit choice: the count once in the report, the choices in the bar, no box on the map (design review 16 Nov, problem 3)
}
/** A retreat destination by name: an area, or the sea (Sicily 14.28). */
export const retName = (a: number) => (a === E.SEA ? 'sea' : areaName(a));
/** The big choice of a battle step (take the hits or abort / retreat): the bar shows these as its buttons when the main button has nothing to do. */
export function barChoices(): { label: string; sub: string; title: string; fn: () => void }[] {
  const b = g.battle;
  if (!b || rollView || !allowed()) return [];
  const n = b.pending,
    st = `${n} step${n > 1 ? 's' : ''}`;
  if (b.stage === 'attChoice')
    return [
      {
        label: 'Take losses',
        sub: `lose ${st}, fight on`,
        title: 'Continue and take the step losses',
        fn: () => E.attackerChoice(g, g.battle!, false),
      },
      {
        label: 'Abort',
        sub: 'all disordered, no losses',
        title: 'Abort: all attackers disordered, no losses',
        fn: () => E.attackerChoice(g, g.battle!, true),
      },
    ];
  if (b.stage === 'retreat') {
    const o = E.retreatOptions(g, b);
    return o.length && o.length <= 2
      ? o.map((a) => ({
          label: `Retreat to ${retName(a)}`,
          sub: '',
          title: `Retreat to ${retName(a)}`,
          fn: () => E.chooseRetreat(g, g.battle!, a),
        }))
      : []; // more than two: the lit areas on the map are the choice
  }
  if (b.stage !== 'defChoice') return [];
  const arty = b.pendingKind === 'arty';
  let where = ''; // where a retreat would lead, before it is chosen (owner, 14 Nov: it looked as if there was nowhere to go)
  if (!arty)
    try {
      const t = structuredClone(g),
        ids = E.unitsIn(g, b.area, other(b.attacker)).map((u) => u.id);
      E.defenderChoice(t, t.battle!, true);
      const o =
        t.battle?.stage === 'retreat'
          ? E.retreatOptions(t, t.battle)
          : [...new Set(t.units.filter((u) => ids.includes(u.id) && u.area != null && u.area !== b.area).map((u) => u.area!))];
      const stuck = E.retreatBlocked(g, b); // 6.6: a unit with nowhere to go loses a step instead; Retreat stays a legal choice
      where = stuck.length
        ? ` · no retreat area: ${stuck.map((u) => u.name).join(', ')} lose${stuck.length > 1 ? '' : 's'} a step instead`
        : o.length === 1
          ? ` · to ${retName(o[0])}`
          : o.length
            ? ` · ${o.length} areas to choose`
            : '';
    } catch {
      /* the engine says why when it is pressed */
    }
  return [
    {
      label: 'Take losses',
      sub: `lose ${st}, hold the area`,
      title: 'Stand and take the step losses',
      fn: () => E.defenderChoice(g, g.battle!, false),
    },
    arty
      ? {
          label: 'Disorder',
          sub: '1 hit fewer, all disordered',
          title: 'Disorder all defenders to absorb 1 hit',
          fn: () => E.defenderChoice(g, g.battle!, true),
        }
      : {
          label: 'Retreat',
          sub: `1 hit fewer${where || ', leave disordered'}`,
          title: 'Retreat (absorbs 1 hit, units disordered)',
          fn: () => E.defenderChoice(g, g.battle!, true),
        },
  ];
}
/** Who can move now: a green arrow over every block that has somewhere to go; the side's other blocks get a grey dash. Hidden once a block is picked or a battle opens. */
let moveMarks: { el: HTMLElement; unit: string }[] = [];
/** Other things a block can do this step: build field works (4.33-style fortify) or take a reserve marker. */
export const fwOk = (u: E.Unit) =>
  ['movement', 'reaction', 'btMove'].includes(g.phase) &&
  E.mayAct(g, u) && // the volume's own limits (Sicily 15.3a: one untried garrison per Movement Phase)
  !u.garrison &&
  !u.moved &&
  u.area != null &&
  !u.unsupplied &&
  !u.disorder &&
  !E.contested(g, u.area) &&
  !g.fieldWorks.includes(u.area) &&
  ((g.phase === 'movement' && u.side === g.phasing) ||
    (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) ||
    (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || !!u.exploit)));
export const rsOk = (u: E.Unit) => g.phase === 'movement' && u.side === g.phasing && E.canReserve(g, u);
/** Units the player set aside this step ("Skip"): no halo, out of "Can move"; a new step clears the list. */
export let skipped = new Set<string>(),
  skipKey = '';
export const skipNow = () => {
  const k = `${g.turn}|${g.phasing}|${g.phase}`;
  if (k !== skipKey) {
    skipKey = k;
    skipped = new Set();
  }
  return skipped;
};
/** Can this unit still do something this step (move, build field works, take a reserve marker)? */
export function canAct(u: E.Unit) {
  if (skipNow().has(u.id)) return false;
  let can = false;
  if (!u.moved) {
    try {
      can = (g.phase === 'strategic' ? (u.reserve ? E.stratOptions(g, u.id).length : 0) : E.moveOptions(g, u.id).length) > 0;
    } catch {
      can = false;
    }
  }
  return can || fwOk(u) || rsOk(u);
}
/** Units that can still act wear an ivory halo on the ground (lime is only 'you can go there': design review 16 Nov) (owner, 11 Nov: no marks floating over the pips). */
const halos = new THREE.Group();
scene.add(halos);
const haloMat = [
  new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
];
/** A figure's 'can act' glow: a disc filling its circle; each spot is painted once (stencil), so overlapping discs make one even blob (owner, 14 Nov). */
const glowMat = new THREE.MeshBasicMaterial({
  color: 0xfff1cc,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  side: THREE.DoubleSide,
  stencilWrite: true,
  stencilRef: 0x80,
  stencilFuncMask: 0x80,
  stencilWriteMask: 0x80,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
});
/** A flat halo shape laid on the ground round (c): on the 3D relief every vertex sits just above the terrain under it, so hills and woods never hide it. */
function drapeHalo(geo: THREE.BufferGeometry, c: THREE.Vector3, y: number, mat: THREE.Material) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = c.x + pos.getX(i),
      z = c.z - pos.getY(i);
    pos.setXYZ(i, x, show3d() ? Math.max(y, REL!.h(x, z) + 0.12) : y, z);
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 3;
  return m;
}
export function syncMoveMarks() {
  document
    .getElementById('marks')!
    .querySelectorAll('.mm')
    .forEach((e) => e.remove());
  moveMarks = [];
  halos.children.forEach((o) => (o as THREE.Mesh).geometry.dispose());
  halos.clear();
  const actor = g.phase === 'reaction' ? other(g.phasing) : g.phasing;
  if (
    g.over ||
    g.battle ||
    g.pendingBlow ||
    selUnit ||
    !['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase) ||
    !allowed() ||
    !mine(actor)
  )
    return;
  const box = new THREE.Box3(),
    size = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (const u of g.units.filter((x) => x.side === actor && x.area != null && !x.garrison && seen(x) && canAct(x))) {
    const o = pieces.children.find((x) => x.userData.unit === u.id);
    if (!o) continue;
    o.updateMatrixWorld(true);
    let base: THREE.Object3D = o;
    o.traverse((x) => {
      if (x.userData.base) base = x;
    }); // a figure: its base, not its gun or floating pips
    box.setFromObject(base).getSize(size);
    box.getCenter(c);
    const y = box.min.y + 0.04;
    const rect = (w: number, d: number) => {
      const r = Math.min(w, d) / 2,
        x = w / 2,
        z = d / 2,
        sh = new THREE.Shape();
      sh.moveTo(-x + r, -z);
      sh.lineTo(x - r, -z);
      sh.quadraticCurveTo(x, -z, x, -z + r);
      sh.lineTo(x, z - r);
      sh.quadraticCurveTo(x, z, x - r, z);
      sh.lineTo(-x + r, z);
      sh.quadraticCurveTo(-x, z, -x, z - r);
      sh.lineTo(-x, -z + r);
      sh.quadraticCurveTo(-x, -z, -x + r, -z);
      return sh;
    };
    const circ = (base as THREE.Object3D).userData.r as number | undefined; // a figure: the glow inside its circle (owner, 14 Nov)
    if (circ) {
      const kk = ((base as THREE.Object3D).userData.k as number | undefined) ?? 0.14;
      const gl = drapeHalo(new THREE.RingGeometry(Math.max(0.05, circ - kk - 0.34), circ - kk, 56), c, y, glowMat); // a band inside the ring: the middle shows the formation colour
      gl.renderOrder = 5;
      halos.add(gl);
      continue;
    }
    (
      [
        [0.1, 0.3, 0],
        [0.3, 0.62, 1],
      ] as const
    ).forEach(([a, b, k]) => {
      const sh = rect(size.x + 2 * b, size.z + 2 * b);
      sh.holes.push(new THREE.Path(rect(size.x + 2 * a, size.z + 2 * a).getPoints()));
      halos.add(drapeHalo(new THREE.ShapeGeometry(sh, 6), c, y, haloMat[k]));
    });
  }
}
/* ---------- option tags on the map: what a Special Action buys, which battles are free (docs/playtest3 mockups) ---------- */
let optTags: { el: HTMLElement; unit?: string; area?: number }[] = [];
export const btArmor = () =>
  g.phase === 'btMove' && !g.battle && allowed() && mine(g.phasing) && E.saAvailable(g, g.phasing).length
    ? g.units
        .filter(
          (u) =>
            u.side === g.phasing &&
            u.area != null &&
            u.cls === 'armor' &&
            !u.exploit &&
            !u.moved &&
            (() => {
              try {
                E.activateBreakthrough(structuredClone(g), u.id);
                return true;
              } catch {
                return false;
              }
            })(),
        )
        .map((u) => u.id)
    : [];
export function syncTags() {
  const layer = document.getElementById('marks')!;
  optTags.forEach((t) => t.el.remove());
  optTags = [];
  const add = (text: string, cls: string, at: { unit?: string; area?: number }) => {
    const el = document.createElement('div');
    el.className = 'otag ' + cls;
    el.textContent = text;
    layer.appendChild(el);
    optTags.push({ el, ...at });
  };
  if (g.over || g.pendingBlow) return;
  if (!selUnit) for (const id of btArmor()) add('SA · 1 AREA', 'sa', { unit: id });
  if (g.phase === 'btCombat' && !g.battle && allowed() && mine(g.phasing)) {
    const nw = new Set(E.newlyContested(g)),
      sa = E.saAvailable(g, g.phasing).length > 0;
    for (const a of E.contestedAreas(g).filter((x) => !g.fought.includes(x)))
      add(nw.has(a) ? 'FIGHT' : sa ? 'COSTS A SPECIAL ACTION' : 'NO SPECIAL ACTION LEFT', nw.has(a) ? 'fight' : sa ? 'sa' : 'off', {
        area: a,
      });
  }
  if (selArr) for (const o of arrOpts()) if (o.sa) add('SA', 'sa', { area: o.area });
}
function placeTags() {
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3();
  for (const t of optTags) {
    let p: THREE.Vector3 | null = null;
    if (t.unit) {
      const o = pieces.children.find((x) => x.userData.unit === t.unit);
      if (o) p = new THREE.Vector3(o.position.x, 3.2, o.position.z);
    } else if (t.area != null) {
      const c = center(t.area);
      p = new THREE.Vector3(c.x, 0.5, c.z);
    }
    if (!p) {
      t.el.style.display = 'none';
      continue;
    }
    v.copy(p).project(cam);
    t.el.style.display = v.z < 1 ? '' : 'none';
    const hw = (t.el.offsetWidth || 60) / 2 + 4,
      px = Math.min(r.width - hw, Math.max(hw, (v.x * 0.5 + 0.5) * r.width));
    t.el.style.transform = `translate(${px}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`;
  } // tags stay on screen
}
function placeMoveMarks() {
  placeTags();
  if (!moveMarks.length) return;
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3();
  for (const m of moveMarks) {
    const o = pieces.children.find((x) => x.userData.unit === m.unit);
    if (!o) {
      m.el.style.display = 'none';
      continue;
    }
    v.set(o.position.x, 2.3, o.position.z).project(cam);
    m.el.style.display = v.z < 1 ? '' : 'none';
    m.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`;
  }
}
export function placeBadges() {
  placeMoveMarks();
  {
    const r = canvas.getBoundingClientRect(),
      v = new THREE.Vector3();
    fxLayer.place((area, unit) => {
      const ps = unit ? pieceScreen(unit) : null,
        c = center(area);
      v.set(c.x, 0, c.z).project(cam);
      const cx = r.left + (v.x * 0.5 + 0.5) * r.width,
        cy = r.top + (-v.y * 0.5 + 0.5) * r.height;
      return ps
        ? { x: ps.x, y: ps.y, cx, cy, rad: ps.rad, visible: true }
        : { x: cx, y: cy - 30, cx: cx - 1, cy, rad: 0, visible: v.z < 1 };
    });
  }
  placeFocus();
  placeBubbles();
  const r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3();
  badgeBoxes = [];
  const dockBottom = (document.querySelector('#ui .mapdock')?.getBoundingClientRect().bottom ?? r.top) - r.top, // the Layer bar and map tools: move badges stay below them
    cardTop = innerWidth < 700 ? (document.querySelector('#ui .c-dispatch')?.getBoundingClientRect().top ?? r.bottom) - r.top : r.height, // and, on the phone, above the block card
    placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const [k, d] of badgeEls) {
    const id = +k.replace(/^[LS]/, ''),
      p = d.classList.contains('lab')
        ? toWorld(LAB[id].x, LAB[id].y)
        : d.classList.contains('tint')
          ? toWorld(LAB[id].x, LAB[id].y + LAB[id].h / 2 + 40)
          : center(id);
    if (d.classList.contains('lab') || d.classList.contains('src')) v.set(p.x, show3d() ? REL!.h(p.x, p.z) + 0.6 : 0.6, p.z).project(cam);
    else v.set(p.x, 2.2, p.z - 4).project(cam);
    /* a label tag sits on its own area, not shifted like the move badges */ let sx = (v.x * 0.5 + 0.5) * r.width,
      sy = (-v.y * 0.5 + 0.5) * r.height;
    const sy0 = sy;
    d.style.display = v.z < 1 ? '' : 'none'; // shown before it is measured: a hidden badge measures 0 wide and was clamped half off the edge (re-test)
    const keep = selUnit && /\b(ok|stop|fuel)\b/.test(d.className),
      hw = d.offsetWidth / 2 + 6,
      hh = d.offsetHeight / 2 + 6,
      out = sx < hw || sx > r.width - hw || sy < hh || sy > r.height - hh;
    if (keep) {
      const top = Math.max(hh, dockBottom + hh),
        bot = Math.min(r.height, cardTop) - hh;
      sx = Math.min(r.width - hw, Math.max(hw, sx));
      sy = Math.min(bot, Math.max(top, sy));
      const w = hw - 4,
        h = hh - 4,
        hit = (x: number, y: number) => placed.some((o) => x - w < o.x1 && x + w > o.x0 && y - h < o.y1 && y + h > o.y0),
        fits = (x: number, y: number) => y >= top && y <= bot && x >= hw && x <= r.width - hw && !hit(x, y);
      let free = fits(sx, sy);
      for (const [ex, ey] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [0, 2],
        [0, -2],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ])
        if (!free && fits(sx + ex * 2 * w, sy + ey * 2 * h)) {
          sx += ex * 2 * w;
          sy += ey * 2 * h;
          free = true;
        } // neighbouring areas' badges sit side by side instead of piling up (design review 16 Nov, phone)
      if (!free && innerWidth < 700) {
        d.style.display = 'none';
        continue;
      } // phone: a destination with no room left for its badge is not drawn (its area is still green): badges never overlap
      placed.push({ x0: sx - w, x1: sx + w, y0: sy - h, y1: sy + h });
      badgeBoxes.push({ x0: sx - hw, x1: sx + hw, y0: sy - hh, y1: sy + hh });
      d.classList.toggle('edge', out || sy !== sy0);
    } // a destination off screen keeps its tag at the edge, so no "no supply" warning is missed
    d.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
  }
  placeAreaTags();
}
