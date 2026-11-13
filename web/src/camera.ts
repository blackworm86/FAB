// The camera: where it looks, dragging, pinching and the wheel, and which area is under the pointer.
import * as THREE from 'three';
import { MAP, MH, MW, S } from './page';
import { g, selUnit } from './game-state';
import { board, cam, canvas } from './scene';
import { REL, show3d } from './map3d';
import { pieces } from './piece-kit';
import { shownArea } from './map-paint';
import {
  camTouched,
  clampDist,
  click,
  goal,
  lock,
  mapMenu,
  phaseOpen,
  render,
  setCamTouched,
  setGoal,
  setMapMenu,
  setPhaseOpen,
} from './main';

/* ---------- camera ---------- */
export let target = new THREE.Vector3(17, 0, -3),
  yaw = 0,
  pitch = 1.0,
  dist = 36,
  opened = false;
export const setOpened = <T extends typeof opened>(v: T): T => ((opened = v), v);
export const setPitch = <T extends typeof pitch>(v: T): T => ((pitch = v), v);
export const setDist = <T extends typeof dist>(v: T): T => ((dist = v), v);
export const setYaw = <T extends typeof yaw>(v: T): T => ((yaw = v), v);
export function placeCam() {
  const hx = MW / (2 * S),
    hz = MH / (2 * S);
  target.x = Math.max(-hx, Math.min(hx, target.x));
  target.z = Math.max(-hz, Math.min(hz, target.z)); /* the view never wanders off the map */
  cam.position.set(
    target.x + dist * Math.sin(yaw) * Math.cos(pitch),
    dist * Math.sin(pitch),
    target.z + dist * Math.cos(yaw) * Math.cos(pitch),
  );
  cam.lookAt(target);
}
export const ptrs = new Map<number, [number, number]>();
let moved = 0,
  pinch = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  setGoal(null);
  setCamTouched(true);
  if (phaseOpen || mapMenu) {
    setPhaseOpen(false);
    setMapMenu(false);
    render();
  }
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  moved = 0;
  pinch = 0;
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()],
      d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) dist = clampDist((dist * pinch) / d);
    pinch = d;
    moved = 99;
    return;
  }
  const dx = e.clientX - p[0],
    dy = e.clientY - p[1];
  moved += Math.abs(dx) + Math.abs(dy);
  if (e.buttons === 2 || e.shiftKey || lock) {
    yaw -= dx * 0.006;
    pitch = Math.min(1.5, Math.max(0.35, pitch + dy * 0.006));
  } else {
    const k = dist * 0.0018,
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    target.x -= (dx * c + dy * s) * k;
    target.z -= (-dx * s + dy * c) * k;
  }
});
canvas.addEventListener('pointerup', (e) => {
  ptrs.delete(e.pointerId);
  if (moved < 6) click(e);
});
canvas.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
canvas.addEventListener(
  'wheel',
  (e) => {
    setGoal(null);
    setCamTouched(true);
    e.preventDefault();
    dist = clampDist(dist * Math.exp(e.deltaY * 0.0012));
  },
  { passive: false },
);

export const ray = new THREE.Raycaster();
export function pick(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
  const own = (o: THREE.Object3D) => {
    let x: THREE.Object3D | null = o;
    while (x && x.parent !== pieces) x = x.parent;
    return x ?? o;
  }; // a figure answers for its unit
  const hits = ray.intersectObjects(pieces.children, true).map((h) => ({ ...h, object: own(h.object) })),
    units = [...new Set(hits.map((h) => h.object.userData.unit as string | undefined).filter((x): x is string => !!x))];
  const hitPiece = hits.find((h) => h.object.userData.unit || h.object.userData.chit) ?? hits[0]; // a marker lying on a block does not hide the block
  if (units.length > 1 && selUnit && units.includes(selUnit))
    return { unit: units[(units.indexOf(selUnit) + 1) % units.length], chit: undefined, area: areaAt(ray) }; // tapping a stack again picks the next block in it
  return {
    unit: hitPiece?.object.userData.unit as string | undefined,
    chit: hitPiece?.object.userData.chit as string | undefined,
    area: areaAt(ray),
  };
}
export function areaAt(ray: THREE.Raycaster): number | null {
  const hitBoard = show3d()
    ? (() => {
        const p = REL!.hit(ray.ray);
        return p ? { point: p } : undefined;
      })()
    : ray.intersectObject(board)[0];
  let area: number | null = null;
  if (hitBoard) {
    const px = (hitBoard.point.x + MW / (2 * S)) * S,
      py = (hitBoard.point.z + MH / (2 * S)) * S;
    area = MAP.areas.find((a) => shownArea(a.id) && (!g.inPlay || g.inPlay.includes(a.id)) && inside(px, py, a.polygon))?.id ?? null;
  }
  return area;
}
function inside(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
