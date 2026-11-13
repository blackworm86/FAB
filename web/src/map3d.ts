// The 3D map (View > Map): the relief with its woods and towns, switching between it and the flat board, settling pieces on the ground.
import * as THREE from 'three';
import { loadRelief, type Relief } from './relief';
import { LAB, MAP, MH, MW, S, VOL } from './page';
import { boardCv, boardFile, boardTex, PHONE, renderer, scene, sun } from './scene';
import { fades, markers, paintAreas, paintBoard, pieces, refresh, route, say, table } from './main';

/* ---------- 3D map (View › Map): the snowy relief with contour lines, 3D woods and towns; the 2D board stays the default ---------- */
export let map3d = (() => {
  try {
    return localStorage.getItem('fab-map3d') === '1';
  } catch {
    return false;
  }
})();
export const setMap3dValue = <T extends typeof map3d>(v: T): T => ((map3d = v), v);
export let REL: Relief | null = null,
  relLoading = false,
  focusOn = false;
export const setFocusOn = <T extends typeof focusOn>(v: T): T => ((focusOn = v), v);
const reliefMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95 });
/** The 3D map is a diorama: the relief, cut straight all round the playing area, on a dark wooden base that carries the entry strips. */
export const diorama = new THREE.Group();
diorama.visible = false;
scene.add(diorama);
export const WOOD_BASE = 0x2e2117;
{
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(MW / S + 1.2, 1.4, MH / S + 1.2),
    new THREE.MeshStandardMaterial({ color: WOOD_BASE, roughness: 0.8 }),
  );
  slab.position.y = -0.7 - 0.002;
  slab.receiveShadow = true;
  diorama.add(slab);
}
const relArt = new Map<HTMLImageElement, HTMLCanvasElement>();
/** A large drawing can come out blank on a phone the first time it is turned into pixels (seen on Android with Sicily's line work): keep the copy
 *  only once it has ink; until then draw again shortly (a few tries, then keep what there is). */
const inkTries = new Map<HTMLImageElement, number>();
export function keepIfInked(im: HTMLImageElement, c: HTMLCanvasElement) {
  if (!im.complete || !im.naturalWidth) {
    setTimeout(paintBoard, 200);
    return false;
  }
  const s = document.createElement('canvas');
  s.width = 512;
  s.height = Math.max(1, Math.round((512 * c.height) / c.width));
  const x = s.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(c, 0, 0, s.width, s.height);
  const d = x.getImageData(0, 0, s.width, s.height).data;
  for (let i = 3; i < d.length; i += 16) if (d[i]) return true;
  const n = (inkTries.get(im) ?? 0) + 1;
  inkTries.set(im, n);
  if (n >= 12) return true;
  setTimeout(paintBoard, 250);
  return false;
}
/** On the relief the area highlights are painted by the ground itself: a picture of the area numbers, and one colour per area. */
const areaIdTex = (() => {
  const d = new Uint8Array(MW * MH * 4); // filled by hand, row by row: a canvas would blend the numbers along the borders; a scenario sheet's boxes float on their own cards and take no pixels
  for (const a of MAP.areas.filter((x) => !(VOL.art.sheetBoxes ?? []).some((b) => b.id === x.id))) {
    const P = a.polygon,
      ys = P.map((q) => q[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(MH - 1, Math.ceil(Math.max(...ys))); y++) {
      const yc = y + 0.5,
        xs: number[] = [];
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i],
          [xj, yj] = P[j];
        if (yi > yc !== yj > yc) xs.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(MW, Math.round(xs[k + 1])); x++) d[((MH - 1 - y) * MW + x) * 4] = a.id;
    }
  }
  const t = new THREE.DataTexture(d, MW, MH);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
export const tintData = new Uint8Array(256 * 4),
  tintTex = new THREE.DataTexture(tintData, 256, 1);
tintTex.needsUpdate = true;
export const relPixels = (im: HTMLImageElement) => {
  let c = relArt.get(im);
  if (!c) {
    c = document.createElement('canvas');
    c.width = boardCv.width;
    c.height = boardCv.height;
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    if (keepIfInked(im, c)) relArt.set(im, c);
  }
  return c;
};
export const show3d = () => map3d && !!REL;
/** Phones and small tablets: the 3D map is drawn lighter (fewer pixels, no shadows, a coarser ground, fewer trees). */
const fullRatio = PHONE ? Math.min(2, devicePixelRatio) : Math.max(1.5, Math.min(2, devicePixelRatio)); // a desktop draws at least 1.5x and the browser scales it down: smooth edges on a standard screen
function tuneForMap() {
  const lite = PHONE && show3d();
  renderer.setPixelRatio(lite ? Math.min(1.3, devicePixelRatio) : fullRatio);
  sun.castShadow = !lite;
}
function applyMap3d() {
  const on = show3d();
  tuneForMap();
  diorama.visible = on;
  table.position.y = on ? -1.42 : -0.02;
  if (REL) REL.props.visible = on;
  paintBoard();
  paintAreas();
}
export function setMap3d(on: boolean) {
  if (on && !VOL.art.relief) {
    map3d = false;
    say('This map has no 3D relief yet.');
    return;
  }
  map3d = on;
  try {
    localStorage.setItem('fab-map3d', on ? '1' : '0');
  } catch {
    /* storage off */
  }
  if (on && !REL) {
    if (!relLoading) {
      relLoading = true;
      say('Loading the 3D map…', true);
      loadRelief(
        MW,
        MH,
        S,
        MAP.areas
          .filter((x) => LAB[x.id])
          .map((x) => [LAB[x.id].x, LAB[x.id].y, LAB[x.id].w, LAB[x.id].h] as [number, number, number, number]),
        PHONE,
        VOL.art.relief!,
        (u) =>
          boardFile(
            new URL(u, location.href).pathname.endsWith(new URL(VOL.art.lines, location.href).pathname)
              ? VOL.art.lines
              : new URL(u, location.href).pathname.endsWith(new URL(VOL.art.base, location.href).pathname)
                ? VOL.art.base
                : u,
          ),
      )
        .then((r) => {
          REL = r;
          REL.patch(reliefMat, areaIdTex, tintTex);
          diorama.add(REL.props);
          const ground = new THREE.Mesh(REL.geometry, reliefMat);
          ground.rotation.x = -Math.PI / 2;
          ground.receiveShadow = true;
          diorama.add(ground);
          if (REL.margin) {
            const mg = new THREE.Mesh(REL.margin, new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95 }));
            mg.rotation.x = -Math.PI / 2;
            mg.receiveShadow = true;
            diorama.add(mg);
          } // the sheet's flat margin round a cut map
          diorama.add(
            new THREE.Mesh(REL.walls, new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9, side: THREE.DoubleSide })),
          );
          applyMap3d();
          refresh();
        })
        .catch(() => {
          relLoading = false;
          map3d = false;
          say('The 3D map could not be loaded. Check your connection and try again.');
        });
    }
    return;
  }
  applyMap3d();
  refresh();
}
/** Everything standing on the map sits on the relief: pieces and markers are raised to the ground under them, flat route drawings follow it vertex by vertex. In the battle close-up the area is shown flat. */
export function settle() {
  const on = show3d() && !focusOn,
    key = on ? 1 : 0;
  for (const grp of [pieces, markers, route, fades])
    for (const o of grp.children) {
      const mesh = o as THREE.Mesh;
      if (o.position.x === 0 && o.position.z === 0 && mesh.geometry) {
        // drawn in world coordinates (route arrows, supply line)
        const gm = mesh.geometry,
          pa = gm.getAttribute('position') as THREE.BufferAttribute;
        if (gm.userData.lk === key) continue;
        const off: Float32Array = gm.userData.off ?? new Float32Array(pa.count);
        for (let k = 0; k < pa.count; k++) {
          const nv = on ? REL!.h(pa.getX(k), pa.getZ(k)) : 0;
          pa.setY(k, pa.getY(k) - off[k] + nv);
          off[k] = nv;
        }
        gm.userData.off = off;
        gm.userData.lk = key;
        pa.needsUpdate = true;
        continue;
      }
      let L = 0;
      if (on) {
        const rr = 0.8;
        L = REL!.h(o.position.x, o.position.z);
        for (const [dx, dz] of [
          [-rr, -rr],
          [rr, -rr],
          [-rr, rr],
          [rr, rr],
          [0, -rr],
          [0, rr],
          [-rr, 0],
          [rr, 0],
        ])
          L = Math.max(L, REL!.h(o.position.x + dx, o.position.z + dz));
        L += 0.02;
      } // the highest ground under the whole counter or block, so the relief never swallows it
      const prev = (o.userData.lift as number | undefined) ?? 0;
      if (L !== prev) {
        o.position.y += L - prev;
        o.userData.lift = L;
      }
    }
}
