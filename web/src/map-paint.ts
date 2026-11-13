// Painting the map: the layers (TDN, zones, control, supply), whose view it is and what that side sees, the board picture, the printed area labels, and the colours of the areas.
import * as THREE from 'three';
import * as E from '../../engine/src';
import { noSupplyTargets } from './supply-plan';
import { online } from './online';
import { drawEntry, drawRestricted, setLabelFace } from './board-art';
import { labHuman } from './lab';
import { MAP, P1, S, toWorld, VOL } from './page';
import { areaPick, g, hoverArea, previewArea, selArea, selUnit } from './game-state';
import { applyArt, baseImg, BOARD_K, boardCv, boardTex, canvas, facing, linesImg, pixels, scene, vpIcons } from './scene';
import { map3d, REL, relPixels, setMap3d, setMap3dValue, show3d, tintData, tintTex, WOOD_BASE } from './map3d';
import { overlays } from './piece-kit';
import { arrOpts, dragTargets, fightable, kbArea, optsFor, other, tgt } from './main';

/** Map overlays: the area tint (terrain defence or army zones) is painted into the board under the line work. */
export let tint: 'off' | 'tdn' | 'zones' | 'control' | 'supply' = (() => {
  try {
    const t = localStorage.getItem('fab-tint');
    return t === 'tdn' || t === 'zones' || t === 'control' || t === 'supply' ? t : 'off';
  } catch {
    return 'off';
  }
})();
export const setTint = <T extends typeof tint>(v: T): T => ((tint = v), v);
export const TDN_COL = [0xf4e3a4, 0xc9a24f, 0x8a8f86, 0x4a5028],
  ZONE_COL: Record<number, number> = { 5: 0x3a3f46, 6: 0x951b81, 7: 0x009fe3 }; // the TDN colours are the printed TDN markers'
/** Map overlays (DESIGN.md › Map overlays): one meaning per colour. Reach green, stop brass, must-fight red, optional fight brass, selection brass, supply in the side's colour. */
/** How strong the lime of "you can move there" is: Sicily's yellow-green map needs it stronger to stand out. */
const REACH_O = VOL.id === 'sicily' ? 0.62 : 0.4;
export const MAPC = {
  reach: 0xc8e86a,
  stop: 0xe7b04a,
  preview: 0xf6e3a8,
  must: 0xd1432f,
  fight: 0xd1432f,
  sel: 0xe7b04a,
  cut: 0xd8d4c0,
  supGe: 0xb9bcc0,
  supAl: 0x9db36a,
  ring: 0xc8e86a,
};
export const CONTROL_COL: Record<string, number> = { ...VOL.controlCol, contested: 0x9b59d0 }; // allied green, axis grey, contested violet (red and yellow are the combat highlights)
const tintOf = (id: number) =>
  tint === 'tdn'
    ? TDN_COL[E.areas.get(id)!.tdn]
    : tint === 'control'
      ? E.contested(g, id)
        ? CONTROL_COL.contested
        : CONTROL_COL[g.control[id] ?? P1]
      : ZONE_COL[E.areas.get(id)!.zone];
export const hex6 = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** What is printed on the map, and how. */
const layers = { numbers: true, tdn: true, vp: true, names: true }; // the printed labels gave way to the area tags (labelMode); entry letters stay on the board
/** Area tags: on, see-through (the one under the mouse in full) or off; the player's choice, kept on this device. */
export let labelMode: 'on' | 'tr' | 'off' = (() => {
    try {
      const v = localStorage.getItem('fab-labels');
      return v === 'tr' || v === 'off' ? v : 'on';
    } catch {
      return 'on';
    }
  })(),
  tagHover: number | null = null;
export const setLabelMode = <T extends typeof labelMode>(v: T): T => ((labelMode = v), v);
export const setTagHover = <T extends typeof tagHover>(v: T): T => ((tagHover = v), v);
export const saveLayers = () => {
  try {
    localStorage.setItem('fab-layers', JSON.stringify(layers));
    localStorage.setItem('fab-tint', tint);
  } catch {
    /* private mode */
  }
};
/** Whose side of the table we look from: each player sits at their own edge of the printed map (Bulge: German at the bottom; Golan: Israeli at the bottom, by the lakes); a shared screen looks from the bottom. */
export let tutView: E.Side | null = null; // the tutorial looks from the side its lesson's player plays
export const setTutView = <T extends typeof tutView>(v: T): T => ((tutView = v), v);
export const viewSide = (): E.Side =>
  labHuman() ?? (online.active && !online.both() && online.mySide() ? online.mySide()! : (tutView ?? VOL.bottom));
export const farSide = () => viewSide() !== VOL.bottom;
const fogSide = (): E.Side | 'spectator' | null =>
  labHuman() ?? (online.active && !online.both() ? (online.mySide() ?? 'spectator') : null);
export const seen = (u: E.Unit) => E.visibleTo(g, u, fogSide());
/** Sicily's untried garrisons (15.3) stand face down for both players, the owner too, until a battle reveals them. */
export const faceDown = (u: E.Unit) => !seen(u) || (!!u.untried && u.up !== u.area);
export const viewRot = () => (farSide() ? Math.PI : 0);
/** Printed words (area labels, board text, entry letters) face the way the camera looks, whatever the seat: hotseat, the sandbox's Both seat, or a board turned by hand. */
export let camFar = false;
export const setCamFar = <T extends typeof camFar>(v: T): T => ((camFar = v), v);
const textRot = () => (camFar ? Math.PI : 0);
/** Restricted boundaries (14.1) and the border two areas share, as a polyline (vertices of one area lying on the other's outline). */
const RESTRICTED: [number, number][] = [...E.areas.keys()].flatMap((a) =>
  E.neighbors(a)
    .filter((b) => b > a && E.connection(a, b)?.restricted)
    .map((b): [number, number] => [a, b]),
);
function sharedBorder(a: number, b: number): [number, number][] {
  const A = MAP.areas.find((x) => x.id === a)!.polygon as [number, number][],
    B = MAP.areas.find((x) => x.id === b)!.polygon as [number, number][];
  const near = (p: [number, number]) => {
    for (let i = 0, j = B.length - 1; i < B.length; j = i++) {
      const [ax, ay] = B[j],
        [bx, by] = B[i],
        dx = bx - ax,
        dy = by - ay,
        t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy) < 3) return true;
    }
    return false;
  };
  const on = A.map(near),
    n = A.length;
  let start = on.findIndex((v, i) => v && !on[(i - 1 + n) % n]);
  if (start < 0) start = 0;
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (!on[i]) break;
    out.push(A[i]);
  }
  return out;
}
/** Areas drawn and clickable now: a scenario sheet's own boxes only while it is played; outside a play area, nothing is clickable. */
const SHEET_ONLY = new Set((VOL.art.sheetBoxes ?? []).map((b) => b.id));
export const shownArea = (id: number) => !SHEET_ONLY.has(id) || !!g.inPlay?.includes(id);
export function paintBoard() {
  if (!baseImg.naturalWidth || !linesImg.naturalWidth) return;
  const far = camFar;
  const c = boardCv.getContext('2d')!,
    k = BOARD_K;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, boardCv.width, boardCv.height);
  const r3 = show3d() ? REL : null;
  if (r3) {
    c.fillStyle = hex6(WOOD_BASE);
    c.fillRect(0, 0, boardCv.width, boardCv.height);
    c.drawImage(relPixels(r3.snow), 0, 0, boardCv.width, boardCv.height);
    c.drawImage(relPixels(far ? r3.entryFlip : r3.entry), 0, 0, boardCv.width, boardCv.height);
  } else c.drawImage(pixels(facing(baseImg)), 0, 0, boardCv.width, boardCv.height);
  if (tint !== 'off' && tint !== 'supply') {
    c.save();
    c.scale(k, k);
    c.globalAlpha = 0.6;
    for (const a of MAP.areas.filter((x) => shownArea(x.id))) {
      c.beginPath();
      a.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = hex6(tintOf(a.id));
      c.fill();
    }
    c.restore();
  }
  if (r3) {
    c.drawImage(relPixels(far ? r3.linesFlip : r3.lines), 0, 0, boardCv.width, boardCv.height);
    c.save();
    c.scale(k, k);
    c.lineJoin = 'round';
    if (r3.ownLines) c.globalAlpha = 0; // a relief with its own line work keeps the board's borders as drawn                                       // area borders from the area shapes themselves: every edge, including the circles round Bastogne and Verviers
    for (const [w, col] of [
      [7, '#ffffff99'],
      [2.9, '#141416'],
    ] as const) {
      c.lineWidth = w;
      c.strokeStyle = col;
      for (const a of MAP.areas.filter((x) => shownArea(x.id))) {
        c.beginPath();
        a.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.stroke();
      }
    }
    c.restore();
  } else c.drawImage(pixels(facing(linesImg)), 0, 0, boardCv.width, boardCv.height);
  if (VOL.art.zones && tint === 'zones') {
    // the three German army zones, when coloured: a dashed line in the zone's colour just inside it (the board prints the army boundaries)
    c.save();
    c.scale(k, k);
    c.lineWidth = 2.6;
    c.lineJoin = 'round';
    c.setLineDash([9, 5]);
    for (const [z, d] of Object.entries(VOL.art.zones)) {
      c.strokeStyle = hex6(ZONE_COL[+z]);
      c.stroke(new Path2D(d));
    }
    c.restore();
  }
  {
    c.save();
    c.scale(k, k);
    if (VOL.id === 'bulge') for (const [a, b] of RESTRICTED) drawRestricted(c, sharedBorder(a, b), undefined, far); // the other volumes print their restricted terrain in their line work
    if (layers.numbers)
      for (const e of MAP.entries) {
        if (floatAt(e.x, e.y)) continue;
        c.save();
        c.translate(e.x, e.y);
        c.rotate(textRot());
        drawEntry(c, e, VOL.art.entryDark(e.side));
        c.restore();
      }
    c.restore();
  }
  boardTex.needsUpdate = true;
  buildLabels();
}
/* ---------- area labels: printed flat, each on its own level card, so the relief never bends them ---------- */
export const labelsGrp = new THREE.Group();
scene.add(labelsGrp);
const labelTexCache = new Map<string, THREE.CanvasTexture>();
export let labelTilt = 0;
export const setLabelTilt = <T extends typeof labelTilt>(v: T): T => ((labelTilt = v), v);
if (VOL.art.labelFace) {
  setLabelFace(VOL.art.labelFace);
  document.fonts
    ?.load(`600 15px ${VOL.art.labelFace.family ?? 'serif'}`)
    .then(() => {
      labelTexCache.clear();
      buildLabels();
    })
    .catch(() => {
      /* the fallback serif stands in */
    });
} // the print's own lettering, drawn again once its face has loaded
/** In 3D the printed arrows, entry triangles and strips and the boxes hover a little above the ground under them (relief.ts takes them off the draped board). */
const floatAt = (x: number, y: number) =>
  show3d() ? REL!.floats.find((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) : undefined;
function floatCards() {
  if (!show3d()) return;
  REL!.floats.forEach((f, i) => {
    const key = `float${i}:${+camFar}${+layers.numbers}`,
      K = 3;
    let t = labelTexCache.get(key);
    if (!t) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(f.w * K);
      cv.height = Math.ceil(f.h * K);
      const c = cv.getContext('2d')!;
      c.drawImage(camFar ? f.imgFlip : f.img, 0, 0, cv.width, cv.height);
      if (layers.numbers)
        for (const e of MAP.entries)
          if (floatAt(e.x, e.y) === f) {
            c.save();
            c.scale(K, K);
            c.translate(e.x - f.x, e.y - f.y);
            c.rotate(textRot());
            drawEntry(c, e, VOL.art.entryDark(e.side));
            c.restore();
          } // the entry letter rides on its triangle or strip
      t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      labelTexCache.set(key, t);
    }
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1),
      pos = geo.getAttribute('position') as THREE.BufferAttribute;
    let top = 0;
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j <= 6; j++) {
        const p = toWorld(f.x + (i / 6) * f.w, f.y + (j / 6) * f.h);
        top = Math.max(top, REL!.h(p.x, p.z));
      } // a printed card stays flat, as on the board: one level, just above the highest ground under it
    for (let k = 0; k < pos.count; k++) {
      const p = toWorld(f.x + (pos.getX(k) + 0.5) * f.w, f.y + (0.5 - pos.getY(k)) * f.h);
      pos.setXYZ(k, p.x, top + 0.05, p.z);
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    m.renderOrder = 2;
    labelsGrp.add(m);
  });
}
function buildLabels() {
  labelsGrp.children.forEach((o) => {
    (o as THREE.Mesh).geometry.dispose();
    ((o as THREE.Mesh).material as THREE.Material).dispose();
  });
  labelsGrp.clear();
  floatCards();
  labelTilt = -1; // new labels take the current tilt on the next frame
  const PAD = 12,
    lk = `${+layers.numbers}${+layers.tdn}${+layers.vp}${+layers.names}${Object.values(vpIcons).every((i) => i.naturalWidth > 0)}`,
    K = 4;
  /* the area's number, TDN, VP and name: the area tags (syncTags), not printed cards */
  for (const bx of (VOL.art.sheetBoxes ?? []).filter((x) => shownArea(x.id))) {
    // a scenario sheet's own box, on a card above the dimmed map around it
    const K2 = 3,
      cv = document.createElement('canvas');
    cv.width = bx.w * K2;
    cv.height = bx.h * K2;
    const c = cv.getContext('2d')!;
    c.scale(K2, K2);
    c.fillStyle = hex6(VOL.controlCol[bx.side] ?? 0x666666);
    c.fillRect(0, 0, bx.w, bx.h);
    c.lineWidth = 4;
    c.strokeStyle = '#141416';
    c.strokeRect(2, 2, bx.w - 4, bx.h - 4);
    c.fillStyle = '#fff';
    c.font = '700 19px Arial Narrow, Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText(bx.name.toUpperCase(), bx.w / 2, 26);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(bx.w / S, bx.h / S),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    const p = toWorld(bx.x + bx.w / 2, bx.y + bx.h / 2);
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, textRot(), 0);
    let y = 0.008;
    if (show3d()) {
      y = 0;
      for (const dx of [-0.5, 0, 0.5])
        for (const dz of [-0.5, 0, 0.5]) y = Math.max(y, REL!.h(p.x + (dx * bx.w) / S, p.z + (dz * bx.h) / S));
      y += 0.04;
    }
    m.position.set(p.x, y + 0.004, p.z);
    m.renderOrder = 3;
    labelsGrp.add(m); // over the dimmed areas' own labels
  }
}
applyArt();
if (map3d && VOL.art.relief)
  setTimeout(() => {
    setMap3dValue(false);
    setMap3d(true);
  }, 0);
else setMap3dValue(false); // a saved choice of the 3D map: loaded once the game is up
/** Supply overlay: your own side (or the Phasing Player when you play both); computed once per refresh. */
export let supEnemy = false; // the Supply layer shows the enemy's supply instead of yours
export const setSupEnemy = <T extends typeof supEnemy>(v: T): T => ((supEnemy = v), v);
export const supplySide = (): E.Side => {
  const me = online.mySide() ?? g.phasing;
  return supEnemy ? other(me) : me;
};
let supCache = new Map<string, boolean>(),
  supKey = '';
export function supOk(sd: E.Side, a: number) {
  const k = `${g.turn}${g.phase}${g.log.length}${JSON.stringify(g.control).length}${g.units.map((u) => u.area).join()}`;
  if (k !== supKey) {
    supKey = k;
    supCache = new Map();
  }
  const kk = sd + a;
  let v = supCache.get(kk);
  if (v == null) {
    v = E.inSupply(g, sd, a);
    supCache.set(kk, v);
  }
  return v;
}
/** Dark diagonal stripes over the area's own colour for areas that are (or would be) out of supply: a pattern, never a colour of its own. */
const hatchTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 32, 32);
  x.strokeStyle = '#23251a';
  x.lineWidth = 6;
  x.beginPath();
  for (const d of [-32, 0, 32]) {
    x.moveTo(d, 32);
    x.lineTo(d + 32, 0);
  }
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.7, 0.7);
  return t;
})();
/** Destinations of the selected block where it would end up out of supply (supply-plan.ts), recomputed when the block or the board changes. */
export let noSup = new Set<number>(),
  noSupKey = '';
function syncNoSup() {
  const k = selUnit && !g.battle && g.phase !== 'strategic' ? `${selUnit}|${g.log.length}|${g.units.map((u) => u.area).join()}` : '';
  if (k !== noSupKey) {
    noSupKey = k;
    noSup = k
      ? noSupplyTargets(
          g,
          selUnit!,
          optsFor(selUnit!).map((o) => o.area),
        )
      : new Set();
  }
}
export function paintAreas() {
  syncNoSup();
  const strat = g.phase === 'strategic' && selUnit,
    opts = selUnit ? (strat ? E.stratOptions(g, selUnit).map((a) => ({ area: a, mustStop: false })) : E.moveOptions(g, selUnit)) : [];
  const fight = g.phase === 'combat' || g.phase === 'btCombat' ? fightable() : [],
    must = new Set(E.mustFight(g));
  const arr = new Map(arrOpts().map((x) => [x.area, x])),
    ret = new Set(g.battle?.stage === 'retreat' ? E.retreatOptions(g, g.battle) : []); // once, not per area
  for (const [id, m] of overlays) {
    const mat = m.material as THREE.MeshBasicMaterial;
    let c = 0xffffff,
      o = 0;
    const r = opts.find((x) => x.area === id);
    if (r) {
      c = r.mustStop ? MAPC.stop : MAPC.reach;
      o = r.mustStop ? 0.34 : REACH_O;
    } else if (fight.includes(id) && must.has(id)) {
      c = MAPC.must;
      o = 0.34;
    }
    if (id === (previewArea ?? hoverArea) && r) {
      c = MAPC.preview;
      o = 0.5;
    }
    if (id === selArea && !selUnit) {
      c = MAPC.sel;
      o = Math.max(o, 0.3);
    }
    if (id === kbArea && document.activeElement === canvas && o < 0.3) {
      c = 0xffffff;
      o = 0.3;
    } // the keyboard cursor
    if (dragTargets.includes(id)) {
      c = MAPC.reach;
      o = 0.5;
    }
    if (tgt) {
      if (tgt.areas.has(id)) {
        c = tgt.color.get(id) ?? MAPC.reach;
        o = 0.5;
      } else if (tgt.pick.has(id) && (!tgt.focus || tgt.color.has(id))) {
        c = tgt.color.get(id) ?? 0xe7b04a;
        o = 0.45;
      } else if (o === 0) {
        c = 0x000000;
        o = 0.28;
      }
    } // a chit in hand: what it can act on glows, the rest dims
    const ar = arr.get(id);
    if (ar) {
      c = ar.sa ? MAPC.stop : MAPC.reach;
      o = 0.45;
    }
    if (ret.has(id)) {
      c = MAPC.reach;
      o = 0.5;
    }
    if (areaPick) {
      if (areaPick.areas.has(id)) {
        c = MAPC.reach;
        o = 0.5;
      } else if (o === 0) {
        c = 0x000000;
        o = 0.28;
      }
    }
    let hatch = false;
    if (tint === 'supply' && !g.battle && o === 0 && !tgt) {
      const sd = supplySide();
      if (g.control[id] === sd) {
        if (supOk(sd, id)) {
          c = VOL.controlCol[sd] ?? 0xffffff;
          o = 0.45;
        } else {
          c = MAPC.cut;
          o = 0.6;
          hatch = true;
        }
      }
    } // your supplied areas in your colour, cut-off ones hatched red, the enemy's left clear
    if (r && noSup.has(id)) hatch = true; // a destination where the block would be out of supply
    if (!shownArea(id)) o = 0;
    else if (g.inPlay && !g.inPlay.includes(id)) {
      if (g.supplyOnly?.includes(id)) {
        c = 0x1d2a45;
        o = 0.5;
      } else {
        c = 0x000000;
        o = 0.62;
      }
    } // Cold Shoulder: Zone 5 carries supply only (P.6)                                   // 24.33 outside the Introductory map sheet
    if ((mat.map === hatchTex) !== hatch) {
      mat.map = hatch ? hatchTex : null;
      mat.needsUpdate = true;
    }
    mat.color.setHex(c);
    mat.opacity = o;
    m.visible = o > 0 && !show3d(); // a clear overlay is not drawn at all; on the relief the ground paints it
    tintData.set([mat.color.r * 255, mat.color.g * 255, mat.color.b * 255, o * 255], id * 4);
    tintTex.needsUpdate = true;
  }
}
