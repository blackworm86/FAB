// The three.js scene: renderer, camera object, light, the board and its printed-map texture.
import * as THREE from 'three';
import { checkUpdate } from './update';
import { tr } from './i18n';
import { esc, flipSvg } from './util';
import { $, MH, MW, S, VOL } from './page';
import { camFar, kbArea, keepIfInked, paintAreas, paintBoard, setKbArea } from './main';

/* ---------- three.js scene ---------- */
export const canvas = $('#gl') as HTMLCanvasElement;
canvas.tabIndex = 0;
canvas.setAttribute('role', 'application');
canvas.setAttribute(
  'aria-label',
  'Map. Arrow keys move between areas, Enter selects or moves there, N picks the next block that can move, Escape clears.',
);
canvas.addEventListener('blur', () => {
  setKbArea(null);
  paintAreas();
});
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true }); // stencil: overlapping figure circles merge into one outline
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.shadowMap.enabled = true;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101314);
export const cam = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a2622, 1.0));
export const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-20, 50, 32);
sun.castShadow = true;
{
  const r = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820 ? 1024 : 4096;
  sun.shadow.mapSize.set(r, r);
} // a phone: 16 times less graphics memory
Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, far: 220 });
sun.shadow.normalBias = 0.06;
sun.shadow.bias = -0.0004;
scene.add(sun); // the shadow box covers the whole table; the bias stops a surface from shadowing itself (stripes across the figures)

export const board: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(
  new THREE.PlaneGeometry(MW / S, MH / S),
  new THREE.MeshStandardMaterial({ map: null, roughness: 0.9 }),
);
board.rotation.x = -Math.PI / 2;
board.receiveShadow = true;
scene.add(board);
/* The board texture is composed in layers: ground and forest, then the area tint (so roads and rivers stay visible), then the line work, then the printed items (numbers, TDN, VP, names), turned to face the player. */
export const PHONE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
/** Board pixels per map pixel. Every board layer is kept as a canvas of this size; at 2x Sicily's and Golan's are 67 MB each, and a phone over its
 *  canvas-memory budget hands out blank canvases, so the line work (drawn after the ground) went missing. Phones: 1x, in every game. */
export const BOARD_K = PHONE ? 1 : 2;
export const boardCv = document.createElement('canvas');
boardCv.width = MW * BOARD_K;
boardCv.height = MH * BOARD_K;
export const boardTex = new THREE.CanvasTexture(boardCv);
boardTex.colorSpace = THREE.SRGBColorSpace;
boardTex.anisotropy = 8;
const loadImg = (src: string) => {
  const i = new Image();
  i.onload = () => paintBoard();
  i.src = src;
  return i;
};
export const vpIcons: Record<string, HTMLImageElement> = Object.fromEntries(
  Object.entries(VOL.art.vpIcons).map(([k, src]) => [k, loadImg(src)]),
);
/** Each board file is downloaded once: its text gives both the picture and, when it has printed words, the copy turned for the far side. */
const boardText = new Map<string, Promise<string>>();
export const boardFile = (src: string) => {
  let p = boardText.get(src);
  if (!p) {
    p = fetch(src).then((r) => r.text());
    boardText.set(src, p);
  }
  return p;
};
const svgUrl = (t: string) => URL.createObjectURL(new Blob([t], { type: 'image/svg+xml' }));
export const baseImg = new Image(),
  linesImg = new Image();
baseImg.onload = linesImg.onload = () => paintBoard();
baseImg.onerror = linesImg.onerror = () => void checkUpdate(); // a blank map after the site changed: reload into the new version
const flipped = new Map<HTMLImageElement, HTMLImageElement>();
for (const [im, src] of [
  [baseImg, VOL.art.base],
  [linesImg, VOL.art.lines],
] as const)
  boardFile(src)
    .then((t0) => {
      const t = t0.replace(/>([^<>]*(?:ARMY ZONE|Army)[^<>]*)</g, (_, x: string) => `>${esc(tr(x))}<`);
      /* the printed army lettering follows the language */ im.src = svgUrl(t);
      if (t.includes('data-flip=')) flipped.set(im, loadImg(svgUrl(flipSvg(t))));
    })
    .catch(() => {
      im.src = src;
    });
export const facing = (im: HTMLImageElement) => {
  const f = camFar ? flipped.get(im) : undefined;
  return f && f.naturalWidth ? f : im;
};
/** The map drawings are turned into pixels once and reused: redrawing the detailed SVG on every colour change is what made phones stall. */
const flat = new Map<HTMLImageElement, HTMLCanvasElement>();
export function pixels(im: HTMLImageElement): CanvasImageSource {
  const have = flat.get(im);
  if (have) return have;
  const c = document.createElement('canvas');
  c.width = boardCv.width;
  c.height = boardCv.height;
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0, c.width, c.height);
  const lines = im === linesImg || im === flipped.get(linesImg);
  if (lines ? keepIfInked(im, c) : x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3]) {
    flat.set(im, c);
    return c;
  }
  if (lines) return c; // a large SVG can come out blank the first time: keep the copy only once it shows
  setTimeout(paintBoard, 120);
  return im;
}
export function applyArt() {
  const mat = board.material as THREE.MeshStandardMaterial;
  mat.map = boardTex;
  mat.needsUpdate = true;
  paintBoard();
}
