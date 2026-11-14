// What the pieces are made of: the table and the groups of the scene, textures, a block, a marker tag, a 3D chit, outlines and discs, and how a battle is framed.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as E from '../../engine/src';
import { TUTORIAL } from './online';
import { loadTroops, setStudio, setZoom } from './troops';
import { MAP, MH, MW, S, VOL } from './page';
import { g } from './game-state';
import { cam, canvas, renderer, scene } from './scene';
import { areaWorld, battleFig, lastInput, refresh, setLastInput, unitR, viewRot } from './main';

export const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x3b2a1d, roughness: 1 }));
table.rotation.x = -Math.PI / 2;
table.position.y = -0.02;
scene.add(table);

// area overlays (highlights)
export const overlays = new Map<number, THREE.Mesh>();
for (const a of MAP.areas) {
  const shape = new THREE.Shape(a.polygon.map(([x, y]) => new THREE.Vector2(x / S - MW / (2 * S), -(y / S - MH / (2 * S)))));
  const m = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  scene.add(m);
  overlays.set(a.id, m);
}
export const pieces = new THREE.Group();
scene.add(pieces);
const labelTex = new Map<string, THREE.Texture>();
/** Piece pictures are decoded a few per frame, so the first load does not freeze the phone; a texture shows as soon as its picture is ready. */
const texQueue: [THREE.Texture, string][] = [];
export function pumpTextures() {
  for (let n = 0; n < 6 && texQueue.length; n++) {
    const [t, src] = texQueue.shift()!;
    const im = new Image();
    im.onload = () => {
      t.image = im;
      t.needsUpdate = true;
      for (const m of texWait.get(t) ?? []) {
        m.map = t;
        m.color.set(0xffffff);
        m.needsUpdate = true;
      }
      texWait.delete(t);
      setLastInput(performance.now());
    };
    im.src = src;
  }
}
/** A face whose picture is still loading shows the plain colour under it (wood, or the chit's ivory), not black; the picture goes on when it arrives. */
const texWait = new Map<THREE.Texture, THREE.MeshStandardMaterial[]>();
function faceMat(t: THREE.Texture, color: THREE.ColorRepresentation, roughness: number) {
  if (t.image) return new THREE.MeshStandardMaterial({ map: t, roughness });
  const m = new THREE.MeshStandardMaterial({ color, roughness });
  texWait.set(t, [...(texWait.get(t) ?? []), m]);
  return m;
}
const svgTex = (key: string, svg: string) => {
  if (!labelTex.has(key)) {
    const t = new THREE.Texture();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texQueue.push([t, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)]);
    labelTex.set(key, t);
  }
  return labelTex.get(key)!;
};

export const woodOf = (u: E.Unit) => VOL.wood[VOL.cssSide(u)] ?? (VOL.cssSide(u) === 'british' ? 0x3f6fb8 : VOL.wood[u.side]);
/** 3D figures in place of the blocks (The Bulge; Settings > Screen). Until the figures have loaded, and for any unit without figures, the block is drawn. */
export let troopsOn = (() => {
    try {
      return localStorage.getItem('fab-troops') === '1';
    } catch {
      return false;
    }
  })(),
  troopsReady = false,
  troopsAsked = false;
export const setTroopsOn = <T extends typeof troopsOn>(v: T): T => ((troopsOn = v), v);
export let troopSize = (() => {
  try {
    return +(localStorage.getItem('fab-troop-size') ?? '') || 1.5;
  } catch {
    return 1.5;
  }
})();
export const setTroopSize = <T extends typeof troopSize>(v: T): T => ((troopSize = v), v);
setZoom(troopSize);
/** Volumes with figures in web/public/pezzi (<volume>.json). */
export const FIG_VOLS = ['bulge', 'golan73', 'sicily'];
export function wantTroops() {
  if (!troopsOn || TUTORIAL || !FIG_VOLS.includes(VOL.id)) return false;
  if (!troopsAsked) {
    troopsAsked = true;
    setStudio(renderer);
    void loadTroops(VOL.id)
      .then((ok) => {
        troopsReady = ok;
        if (ok) refresh();
      })
      .catch(() => {
        /* no figures: blocks stay */
      });
  }
  return troopsReady;
}
export function block(u: E.Unit, hidden = false) {
  const flat = hidden && !!u.untried; // Sicily 15.3: an untried garrison lies face down on the table, its label against the map
  const w = 1.6,
    h = 1.6,
    d = 0.8; // 16 x 16 x 8 mm block
  const wood = new THREE.MeshStandardMaterial({ color: woodOf(u), roughness: 0.75 }); // the wood by the block's class (Sicily: its nationality), else by its side
  if (u.garrison) {
    const chit = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }),
      m = new THREE.Mesh(new RoundedBoxGeometry(1.43, 0.12, 1.43, 2, 0.1), [
        chit,
        chit,
        faceMat(svgTex(u.id, VOL.unitSvg(u, g)), 0xd9d4c4, 0.7),
        chit,
        chit,
        chit,
      ]); // a counter, like the other chits // 9/16 in chit
    m.position.y = 0.06;
    m.castShadow = true;
    m.rotation.y = viewRot();
    return m;
  }
  const face = hidden ? wood : faceMat(svgTex(`${u.id}-${u.str}`, VOL.unitSvg(u, g)), wood.color, 0.6); // upright blocks show their blank back to the enemy
  const m = new THREE.Mesh(flat ? new THREE.BoxGeometry(w, d, h) : new THREE.BoxGeometry(w, h, d), [wood, wood, wood, wood, face, wood]);
  m.rotation.y = viewRot();
  m.position.y = (flat ? d : h) / 2;
  m.castShadow = true;
  return m;
}
export const markers = new THREE.Group();
scene.add(markers);
/** Remove a group's children and free their geometry and materials; the cached textures are shared and stay. */
export function disposeAll(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((!m.isMesh && !(o as THREE.LineSegments).isLineSegments) || o.userData.shared) return;
    m.geometry?.dispose();
    for (const mat of ([] as THREE.Material[]).concat(m.material)) mat.dispose();
  });
  group.clear();
}
const tagTex = new Map<string, THREE.CanvasTexture>();
export function tag(text: string, bg: string, size = 1.1) {
  const art = text.startsWith('chit:') ? VOL.chitSvg(E.chit(g, text.slice(5))) : VOL.markSvg(text); // chit:<id>: the very chit placed (an air mission), in its game's own art
  if (art) {
    // printed marker art, drawn as a vector chit
    const key = 'art:' + text;
    let at = tagTex.get(key);
    if (!at) {
      at = new THREE.CanvasTexture(document.createElement('canvas'));
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        c.getContext('2d')!.drawImage(im, 0, 0, 256, 256);
        at!.image = c;
        at!.colorSpace = THREE.SRGBColorSpace;
        at!.anisotropy = 8;
        at!.needsUpdate = true;
      };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art);
      tagTex.set(key, at);
    }
    const edge = new THREE.MeshStandardMaterial({ color: 0x2a2a28 }),
      m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [
        edge,
        edge,
        new THREE.MeshStandardMaterial({ map: at }),
        edge,
        edge,
        edge,
      ]);
    m.castShadow = true;
    m.rotation.y = viewRot();
    return m;
  }
  let t = tagTex.get(text + bg);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = bg;
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#fff';
    x.lineWidth = 8;
    x.strokeRect(4, 4, 120, 120);
    x.fillStyle = '#fff';
    x.font = `bold ${text.length > 2 ? 46 : 60}px Arial Narrow, Arial, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 64, 68);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    tagTex.set(text + bg, t);
  }
  const side = new THREE.MeshStandardMaterial({ color: bg }),
    m = new THREE.Mesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.1), [
      side,
      side,
      new THREE.MeshStandardMaterial({ map: t }),
      side,
      side,
      side,
    ]);
  m.castShadow = true;
  m.rotation.y = viewRot();
  return m;
}
/** Every counter is a 9/16 inch square (1.43 cm) with slightly rounded corners. */
export const CHIT = 1.43;
/** A cardboard counter lying on the board: the chit's own printed art on a thin rounded square. */
export function chit3d(c: E.Chit) {
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9d4c4 }),
    m = new THREE.Mesh(new RoundedBoxGeometry(CHIT, 0.12, CHIT, 2, 0.1), [
      edge,
      edge,
      faceMat(svgTex('chit:' + c.id, VOL.chitSvg(c)), 0xd9d4c4, 0.7),
      edge,
      edge,
      edge,
    ]);
  m.castShadow = true;
  m.position.y = 0.06;
  m.rotation.y = viewRot();
  return m;
}
/** The outline of an area pushed outwards by `d` (cm), as a flat ribbon of width `w` lying on the board. */
export function outlineRibbon(id: number, d: number, w: number, color: number) {
  const raw = areaWorld(id).map((q) => new THREE.Vector2(q.x, q.z)),
    pts: THREE.Vector2[] = [];
  raw.forEach((q, i) => {
    const nx = raw[(i + 1) % raw.length],
      k = Math.max(1, Math.ceil(q.distanceTo(nx) / 0.35));
    for (let j = 0; j < k; j++) pts.push(q.clone().lerp(nx, j / k));
  }); // short pieces, so on the 3D relief every piece sits on the ground
  const n = pts.length;
  const area2 = pts.reduce((a, q, i) => a + (q.x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * q.y), 0),
    sgn = area2 > 0 ? 1 : -1;
  const norm = (i: number) => {
    const a = pts[(i + n - 1) % n],
      b = pts[i],
      c = pts[(i + 1) % n],
      e1 = b.clone().sub(a).normalize(),
      e2 = c.clone().sub(b).normalize();
    const n1 = new THREE.Vector2(e1.y, -e1.x).multiplyScalar(sgn),
      n2 = new THREE.Vector2(e2.y, -e2.x).multiplyScalar(sgn),
      m = n1.add(n2);
    return m.lengthSq() < 1e-6 ? n1 : m.normalize().multiplyScalar(1 / Math.max(0.5, m.dot(n2) || 1));
  };
  const pos: number[] = [],
    idx: number[] = [];
  pts.forEach((q, i) => {
    const nn = norm(i),
      a = q.clone().addScaledVector(nn, d),
      b = q.clone().addScaledVector(nn, d + w);
    pos.push(a.x, 0.09, a.y, b.x, 0.09, b.y);
  });
  for (let i = 0; i < n; i++) {
    const a = i * 2,
      b = ((i + 1) % n) * 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }),
  );
}
const dotTex = new Map<string, THREE.CanvasTexture>();
/** A small round marker lying on the table: a red cross to take an asset back, a gold target for the point unit. */
export function disc(kind: 'x' | 'point', size: number) {
  let t = dotTex.get(kind);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = kind === 'x' ? '#3a3d2c' : '#e7b04a';
    /* take-back is a quiet olive disc: red stays for the one main action */ x.beginPath();
    x.arc(64, 64, 60, 0, 7);
    x.fill();
    x.lineWidth = 8;
    x.strokeStyle = '#fff';
    x.stroke();
    x.strokeStyle = kind === 'x' ? '#ddd7b5' : '#1a1608';
    x.lineWidth = 14;
    x.lineCap = 'round';
    x.beginPath();
    if (kind === 'x') {
      x.moveTo(40, 40);
      x.lineTo(88, 88);
      x.moveTo(88, 40);
      x.lineTo(40, 88);
    } else {
      x.arc(64, 64, 26, 0, 7);
      x.moveTo(64, 22);
      x.lineTo(64, 40);
      x.moveTo(64, 88);
      x.lineTo(64, 106);
      x.moveTo(22, 64);
      x.lineTo(40, 64);
      x.moveTo(88, 64);
      x.lineTo(106, 64);
    }
    x.stroke();
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    dotTex.set(kind, t);
  }
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size, 28),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
/** The same marker as a sprite: it always faces the camera, so the player can read it from any angle. */
export function discSprite(kind: 'x' | 'point', size: number) {
  disc(kind, size);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex.get(kind)!, transparent: true, depthTest: false }));
  sp.scale.set(size * 2, size * 2, 1);
  sp.renderOrder = 6;
  return sp;
}
/** Battle formation (docs/design): the battle area is shown as an ordered table, not squeezed into the polygon. Each side faces the other across the
 *  middle line: its blocks in the front row, its assets in the row behind; rows wrap at 5 and stay centred. The rest of the map is blurred, so the
 *  formation may reach past the area border. */
/** How far the battle formation reaches from the area's pole (cm), on the deeper side. */
export function formationReach(b: E.Battle) {
  const bf = battleFig(b);
  if (bf)
    return Math.max(
      3,
      ...bf.spots.map((q, i) => Math.hypot(q.x - bf.c0.x, q.z - bf.c0.z) + unitR(bf.order[i])),
      ...VOL.sides.map((sd) => {
        const n = b.assets[sd].length + E.airOf(b, sd).length;
        return n ? bf.side[sd].D + Math.ceil(n / 5) * 1.7 : 0;
      }),
    );
  return Math.max(
    ...VOL.sides.map((sd) => {
      const u = Math.max(1, Math.ceil(E.unitsIn(g, b.area, sd).length / 5)),
        n = b.assets[sd].length + E.airOf(b, sd).length,
        a = Math.ceil(n / 5);
      return 1.35 + u * 1.9 + (a ? 0.5 + a * 1.7 : 0);
    }),
    (5 * 1.95) / 2 + 1,
  );
}
/** Panels over the battle (header at the top, report and hand at the bottom): the view is shifted so the battle sits in the clear band between them. */
export let viewShift = 0,
  clearRatio = 1;
export const setClearRatio = <T extends typeof clearRatio>(v: T): T => ((clearRatio = v), v);
export function fitBattleView() {
  const r = canvas.getBoundingClientRect();
  let shift = 0,
    clear = r.height;
  if (g.battle) {
    const top = document.querySelector('#ui .c-table')?.getBoundingClientRect(),
      low = Array.from(document.querySelectorAll('#ui .dock > .c-ledger, #ui .dock .c-hand, #ui .dock .handtab, #ui .c-bar.b'))
        .map((e) => e.getBoundingClientRect())
        .filter((q) => q.height && q.left < r.left + r.width / 2 && q.right > r.left + r.width / 2);
    const tc = top ? Math.max(0, top.bottom - r.top) : 0,
      bc = low.length ? Math.max(0, r.bottom - Math.min(...low.map((q) => q.top))) : 0;
    shift = Math.round((bc - tc) / 2);
    clear = Math.max(120, r.height - tc - bc);
  }
  if (shift !== viewShift) {
    viewShift = shift;
    if (shift) cam.setViewOffset(r.width, r.height, 0, shift, r.width, r.height);
    else cam.clearViewOffset();
  }
  return clear / r.height;
}
