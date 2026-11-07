/** The 3D map: a smooth relief of the real ground bent onto the game map, with contour lines, woods and 3D towns. The Bulge: snowy Ardennes, built offline by
 *  tools/map3d (fullmap.py) into public/relief/; Golan '73: tools/golan73/relief.py into public/golan73/relief/. World unit = 1 cm, like the board. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flipSvg } from './util';

type Meta = { outline: [number, number][][]; w: number; h: number; step: number; cols: number; rows: number; metres: number; towns: [number, number][]; cities: { c: [number, number]; cells: [number, number][] }[];
  mpp?: number; exag?: number;   /** ground metres per map pixel (The Bulge 80) and how much the heights are raised (The Bulge 4) */
  dry?: boolean;                 /** a dry country (Golan): round green trees, no snow */
  overlay?: string;              /** the printed items off and on the map (entry triangles, boxes, names) come from this board file, minus its ground */
  ownLines?: boolean;            /** the board's own line work is draped as drawn (Sicily: borders, army boundaries, coast in the print's style), not redrawn */
  cut?: [number, number][][];   /** the map's own outline (Golan, The Bulge): the relief is cut straight down along it, with the sheet's flat margin outside */
  floatsFrom?: string;           /** a board file whose data-float items hover too (The Bulge: the entry strips of map-base.svg, instead of entry.png) */ };
/** A printed item that hovers over the relief instead of being draped on it (arrows, entry triangles and strips, boxes): its box on the map and its picture, also turned for the far side. */
export type Float = { x: number; y: number; w: number; h: number; img: HTMLImageElement; imgFlip: HTMLImageElement };
export type Relief = {
  /** Height of the ground (cm) at world x, z. */
  h(x: number, z: number): number;
  geometry: THREE.BufferGeometry;
  /** The cut sides of the diorama: straight walls from the base up to the ground, all round the playing area. */
  walls: THREE.BufferGeometry;
  /** The entry strips printed off the map (green Allied, grey German). */
  entry: HTMLImageElement; entryFlip: HTMLImageElement;     /** entryFlip, linesFlip: the same with the printed words turned for the player across the table */
  props: THREE.Group;
  snow: HTMLImageElement;
  /** Lines of the printed map without towns, cities and area borders (those become 3D or are drawn apart). */
  lines: HTMLImageElement; linesFlip: HTMLImageElement;
  /** Area borders: a black line on a thin white edge, so they never pass for roads. */
  borders: HTMLImageElement;
  /** The relief keeps the board's own line work (no borders redrawn on top). */
  ownLines: boolean;
  /** Contour lines and the area tints (an area-number texture and a colour per area) for the board material. */
  patch(mat: THREE.MeshStandardMaterial, areaId: THREE.Texture, tints: THREE.Texture): void;
  /** Where a ray meets the ground. */
  hit(ray: THREE.Ray): THREE.Vector3 | null;
  floats: Float[];
  /** The flat margin of the sheet outside a cut map (null when the map fills the sheet). */
  margin: THREE.BufferGeometry | null;
};

const RELIEF = 4, BASE = 0.22;                               // BASE: even the lowest valley stands this high (cm) above the wooden base                                          // the relief is shown four times higher than real, as chosen on the mockup
const img = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
const svgImg = (svg: string) => img(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
/** Take the <g data-float="x y w h"> items out of a board file: the file without them, and each item as its own small picture. */
function takeFloats(svg: string, out: { x: number; y: number; w: number; h: number; svg: string }[]) {
  const re = /<g data-float="(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)"/g; let rest = '', from = 0, m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    let depth = 0, i = m.index;
    const tag = /<g[\s>]|<\/g>/g; tag.lastIndex = i;
    for (let t: RegExpExecArray | null; (t = tag.exec(svg));) { depth += t[0] === '</g>' ? -1 : 1; if (!depth) { i = t.index + 4; break; } }
    const [x, y, w, h] = m.slice(1, 5).map(Number); out.push({ x, y, w, h, svg: svg.slice(m.index, i) });
    rest += svg.slice(from, m.index); from = i; re.lastIndex = i;
  }
  return rest + svg.slice(from);
}
const floatPic = (f: { x: number; y: number; w: number; h: number; svg: string }, flip: boolean) => svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f.x} ${f.y} ${f.w} ${f.h}" width="${Math.round(f.w * 3)}" height="${Math.round(f.h * 3)}">${flip ? flipSvg(f.svg) : f.svg}</svg>`);
const group = (svg: string, id: string) => { const m = new RegExp(`<g id="${id}"[\\s\\S]*?</g>(\\s*</g>)?`).exec(svg); return m ? m[0] : ''; };

/** lite (phones): a ground mesh half as fine and half the trees. */
export async function loadRelief(MW: number, MH: number, S: number, labels: [number, number, number, number][], lite = false, base = './'): Promise<Relief> {
  const meta = await fetch(base + 'relief/relief.json').then((r) => r.json() as Promise<Meta>);
  const [hb, wb, snow, linesSvg0, overlay0, floatsSrc] = await Promise.all([
    fetch(base + 'relief/height.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'relief/woods.bin').then((r) => r.arrayBuffer()),
    img(base + 'relief/snow.png'),
    fetch(base + 'map-lines.svg').then((r) => r.text()),
    meta.overlay ? fetch(base + meta.overlay).then((r) => r.text()).then((t) => t.replace(/<image id="ground"[^>]*\/>/, '')) : null,
    meta.floatsFrom ? fetch(base + meta.floatsFrom).then((r) => r.text()) : null,
  ]);
  const fl: { x: number; y: number; w: number; h: number; svg: string }[] = [];
  const linesSvg = takeFloats(linesSvg0, fl), overlay = overlay0 == null ? null : takeFloats(overlay0, fl); if (floatsSrc) takeFloats(floatsSrc, fl);
  const floats: Float[] = await Promise.all(fl.map(async (f) => { const im = await floatPic(f, false); return { x: f.x, y: f.y, w: f.w, h: f.h, img: im, imgFlip: f.svg.includes('data-flip=') ? await floatPic(f, true) : im }; }));
  const blank = () => svgImg('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
  const entry = overlay ? await svgImg(overlay) : meta.floatsFrom ? await blank() : await img(base + 'relief/entry.png'), entryFlip = overlay && overlay.includes('data-flip=') ? await svgImg(flipSvg(overlay)) : entry;
  const ZS = (meta.exag ?? RELIEF) / ((meta.mpp ?? 80) * S);   // metres → cm
  const { cols: C, rows: R, step: ST } = meta, HB = new Uint16Array(hb), WB = new Uint8Array(wb);
  const K = (meta.metres / 65535) * ZS;                   // grid value → cm
  const grid = (gx: number, gy: number) => { gx = Math.min(Math.max(gx, 0), C - 1.001); gy = Math.min(Math.max(gy, 0), R - 1.001); const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, v = (a: number, b: number) => HB[b * C + a];
    return ((v(i, j) * (1 - fx) + v(i + 1, j) * fx) * (1 - fy) + (v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx) * fy) * K; };
  const hMap = (px: number, py: number) => grid(px / ST, py / ST) + BASE;
  const landPx = (() => { const c = document.createElement('canvas'); c.width = meta.w; c.height = meta.h; const x = c.getContext('2d')!; x.drawImage(snow, 0, 0); const d = x.getImageData(0, 0, meta.w, meta.h).data, out = new Uint8Array(meta.w * meta.h); for (let k = 0; k < out.length; k++) out[k] = d[k * 4 + 3] > 127 ? 1 : 0; return out; })();
  const cutCv = meta.cut ? (() => { const c = document.createElement('canvas'); c.width = meta.w; c.height = meta.h; const x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, meta.w, meta.h); x.fillStyle = '#fff'; x.beginPath(); for (const r of meta.cut!) r.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.fill('evenodd'); return c; })() : null;
  const cutPx = cutCv ? (() => { const d = cutCv.getContext('2d')!.getImageData(0, 0, meta.w, meta.h).data, out = new Uint8Array(meta.w * meta.h); for (let k = 0; k < out.length; k++) out[k] = d[k * 4] > 127 ? 1 : 0; return out; })() : null;
  const inMap = (px: number, py: number) => px >= 0 && py >= 0 && px < meta.w && py < meta.h && (cutPx ? cutPx[(py | 0) * meta.w + (px | 0)] === 1 : landPx[(py | 0) * meta.w + (px | 0)] === 1);
  const onLand = inMap;
  const wx = (px: number) => px / S - MW / (2 * S), wz = (py: number) => py / S - MH / (2 * S);
  const toMap = (x: number, z: number) => [(x + MW / (2 * S)) * S, (z + MH / (2 * S)) * S] as const;
  const h = (x: number, z: number) => { const [px, py] = toMap(x, z); return onLand(px, py) ? hMap(px, py) : cutPx ? BASE : 0; };   // outside a cut map: the sheet's margin

  // the ground: one vertex per grid cell (4 map px)
  const G = lite ? 2 : 1, geometry = new THREE.PlaneGeometry(MW / S, MH / S, Math.ceil((C - 1) / G), Math.ceil((R - 1) / G)), pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) { const [px, py] = toMap(pos.getX(k), -pos.getY(k)); pos.setZ(k, hMap(px, py)); }     // off the land the shader cuts the ground away
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const wp: number[] = [];
  const wall = (ring: [number, number][], top: (x: number, y: number) => number) => { for (let k = 0; k + 1 < ring.length; k++) {
    const [a, b] = [ring[k], ring[k + 1]], ha = top(a[0], a[1]), hb2 = top(b[0], b[1]), A = [wx(a[0]), wz(a[1])], B = [wx(b[0]), wz(b[1])];
    wp.push(A[0], 0, A[1], B[0], 0, B[1], B[0], hb2, B[1], A[0], 0, A[1], B[0], hb2, B[1], A[0], ha, A[1]);
  } };
  for (const ring of meta.outline) wall(ring, cutPx ? () => BASE : hMap);                 // the sheet's edge: up to the margin when the map is cut, else up to the ground
  for (const ring of meta.cut ?? []) wall(ring, hMap);                                  // the map's own edge, cut straight down from the ground to the margin
  const margin = cutPx ? (() => { const m = new THREE.PlaneGeometry(MW / S, MH / S, 1, 1), q = m.getAttribute('position') as THREE.BufferAttribute; for (let k = 0; k < q.count; k++) q.setZ(k, BASE); m.computeVertexNormals(); return m; })() : null;
  const cutTex = cutCv ? new THREE.CanvasTexture(cutCv) : null;
  const walls = new THREE.BufferGeometry(); walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); walls.computeVertexNormals();

  // printed lines without towns, cities and borders; borders redrawn black on a white edge
  const linesText = meta.ownLines ? linesSvg.replace(group(linesSvg, 'cities'), '') : linesSvg.replace(group(linesSvg, 'cities'), '').replace(group(linesSvg, 'towns'), '').replace(group(linesSvg, 'boundaries'), '').replace(group(linesSvg, 'outline'), '');   // the white board outline belongs to the flat map, not to the diorama
  const lines = await svgImg(linesText), linesFlip = linesText.includes('data-flip=') ? await svgImg(flipSvg(linesText)) : lines;
  const paths = meta.ownLines ? '' : (group(linesSvg, 'boundaries').match(/<path[^>]*\/>/g) ?? []).join('');
  const head = /<svg[^>]*>/.exec(linesSvg)![0];
  const borders = await svgImg(`${head}<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-opacity=".6" stroke-width="7">${paths}</g><g stroke="#141416" stroke-width="2.9">${paths}</g></g></svg>`);

  // woods and towns in 3D: snow-capped conifers, houses with snowy roofs, a church in every town
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const props = new THREE.Group(), P = 1.1;               // props a little larger than life on the mockup, so they read at game scale
  const towns = meta.towns, cityCell = new Set(meta.cities.flatMap((c) => c.cells.map(([x, y]) => `${(x / 4) | 0},${(y / 4) | 0}`)));
  const inTown = (x: number, y: number) => towns.some(([tx, ty]) => Math.hypot(x - tx, y - ty) < 15) || [-2, 0, 2].some((a) => [-2, 0, 2].some((b) => cityCell.has(`${((x / 4) | 0) + a},${((y / 4) | 0) + b}`)));
  const nearLabel = (x: number, y: number) => labels.some(([lx, ly, w, h]) => Math.abs(x - lx) < w / 2 + 8 && Math.abs(y - ly) < h / 2 + 8);   // the printed number and name stay clear
  const trees: number[][] = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const w = WB[j * C + i] / 255; if (w > 0.3 && rnd() < w * (lite ? 0.12 : 0.26)) { const x = i * ST + (rnd() - 0.5) * ST, y = j * ST + (rnd() - 0.5) * ST; if (!inTown(x, y) && !nearLabel(x, y)) trees.push([x, y, 0.75 + rnd() * 0.6, rnd()]); } }
  const houses: number[][] = [], churches: number[][] = [];
  for (const [x, y] of towns) { churches.push([x + 1, y - 1, 1]); for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.283 + rnd() * 0.4, r = 5.5 + rnd() * 3.5; const hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r; if (!nearLabel(hx, hy)) houses.push([hx, hy, -a, 2.4 + rnd() * 0.6, 2 + rnd() * 0.8, 3.2 + rnd() * 0.8]); } }
  for (const c of meta.cities) {
    const far = Math.max(...c.cells.map(([x, y]) => Math.hypot(x - c.c[0], y - c.c[1]))) || 1;
    for (const [x, y] of c.cells) { const t = 1 - Math.hypot(x - c.c[0], y - c.c[1]) / far; houses.push([x + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.6, rnd() < 0.5 ? 0 : 1.571, 3.3, 2.6 + t * 4 + rnd() * 1.5, 3.4]); }
    churches.push([c.c[0], c.c[1], 1.6]); const f = c.cells[(c.cells.length * 0.3) | 0]; churches.push([f[0], f[1], 1.2]);
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.283, r = far + 4 + rnd() * 7, hx = c.c[0] + Math.cos(a) * r, hy = c.c[1] + Math.sin(a) * r; if (!nearLabel(hx, hy)) houses.push([hx, hy, -a, 2.6, 2.2 + rnd(), 3.4]); }
  }
  const lams: THREE.MeshLambertMaterial[] = [], lam = (color: number) => { const m = new THREE.MeshLambertMaterial({ color }); lams.push(m); return m; };
  // one tree = one mesh: a dark cone with a snow cap (vertex colours), so each tree is drawn once, not twice
  const paint = (g: THREE.BufferGeometry, c: number) => { const n = g.getAttribute('position').count, cc = new THREE.Color(c), a = new Float32Array(n * 3); for (let k = 0; k < n; k++) cc.toArray(a, k * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed(); };
  const treeGeo = meta.dry ? mergeGeometries([paint(new THREE.CylinderGeometry(0.35, 0.45, 2, 5).translate(0, 1, 0), 0x6b5a3e), paint(new THREE.IcosahedronGeometry(2.1, 0).scale(1, 0.85, 1).translate(0, 3.2, 0), 0x5e7140)])!      // oak scrub and orchards
    : mergeGeometries([paint(new THREE.ConeGeometry(2.1, 6, 5).translate(0, 3, 0), 0x2a4a38), paint(new THREE.ConeGeometry(0.95, 2.2, 5).translate(0, 4.95, 0), 0xf1f4f8)])!;
  const treeMat = lam(0xffffff); treeMat.vertexColors = true;
  const tr = new THREE.InstancedMesh(treeGeo, treeMat, trees.length), cap = new THREE.Group();
  const hs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(0xe9e0cc), houses.length);
  const rf = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 0.7072, 0.45, 4, 1).rotateY(Math.PI / 4).translate(0, 1.225, 0), lam(0xffffff), houses.length);
  const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 7, 2).translate(0, 3.5, 0), lam(0xd8cdb4), churches.length), sp = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4, 4).rotateY(Math.PI / 4).translate(0, 9, 0), lam(0x4f5a5c), churches.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), u = P / S;
  const groundMin = (x: number, y: number, r: number) => Math.min(hMap(x - r, y - r), hMap(x + r, y - r), hMap(x - r, y + r), hMap(x + r, y + r));
  trees.forEach((t, i) => { m4.compose(v.set(wx(t[0]), hMap(t[0], t[1]) - 0.01, wz(t[1])), q.identity(), sc.setScalar(t[2] * u)); tr.setMatrixAt(i, m4); });
  houses.forEach((b, i) => { m4.compose(v.set(wx(b[0]), groundMin(b[0], b[1], 1.6) - 0.01, wz(b[1])), q.setFromEuler(e.set(0, b[2], 0)), sc.set(b[3] * u, b[4] * u, b[5] * u)); hs.setMatrixAt(i, m4); rf.setMatrixAt(i, m4); rf.setColorAt(i, col.setHex(rnd() < 0.8 ? 0xf3f5f8 : 0x8a8f99)); });
  churches.forEach((c, i) => { m4.compose(v.set(wx(c[0]), groundMin(c[0], c[1], 1) - 0.01, wz(c[1])), q.identity(), sc.setScalar(c[2] * u)); tw.setMatrixAt(i, m4); sp.setMatrixAt(i, m4); });
  props.add(tr, cap, hs, rf, tw, sp);

  const labMask = (() => { const c = document.createElement('canvas'); c.width = meta.w / 2; c.height = meta.h / 2; const x = c.getContext('2d')!; x.filter = 'blur(3px)'; x.fillStyle = '#fff';
    for (const [lx, ly, w, h] of labels) { x.beginPath(); x.roundRect((lx - w / 2 - 6) / 2, (ly - h / 2 - 6) / 2, (w + 12) / 2, (h + 12) / 2, 6); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.flipY = true; return t; })();
  const patch = (mat: THREE.MeshStandardMaterial, areaId: THREE.Texture, tints: THREE.Texture) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMetre = { value: 1 / ZS }; sh.uniforms.tId = { value: areaId }; sh.uniforms.tTint = { value: tints }; sh.uniforms.tLab = { value: labMask }; sh.uniforms.tCut = { value: cutTex ?? labMask }; sh.uniforms.uCut = { value: cutTex ? 1 : 0 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vMet; uniform float uMetre;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMet = transformed.z * uMetre;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMet; uniform sampler2D tId, tTint, tLab, tCut; uniform float uCut;').replace('#include <map_fragment>', `#include <map_fragment>
        if (uCut > .5 && texture2D(tCut, vMapUv).r < .5) discard;      /* a cut map: the ground ends at the map's own outline, the margin is a flat sheet below */
        { /* contours: fine 25 m lines that fade where they crowd, a stronger line every 100 m; slate blue on snow, green in the woods */
          float wood = clamp((0.8 - diffuseColor.r) / 0.45, 0., 1.); vec3 lc = mix(vec3(.13,.21,.36), vec3(.03,.13,.05), wood);
          float c1 = vMet / 25., f1 = fwidth(c1), m1 = (1. - clamp(abs(fract(c1 + .5) - .5) / max(f1, 1e-4), 0., 1.)) * smoothstep(2.5, 7., 1. / max(f1, 1e-4));
          float c2 = vMet / 100., f2 = fwidth(c2), m2 = (1. - clamp(abs(fract(c2 + .5) - .5) / max(f2, 1e-4) - .3, 0., 1.)) * smoothstep(2., 5., 1. / max(f2, 1e-4));
          diffuseColor.rgb = mix(diffuseColor.rgb, lc, max(m1 * .32, m2 * .58) * (1. - texture2D(tLab, vMapUv).r));      /* no contour lines across the printed numbers and names */
          /* area highlights (moves, battles, tints) painted straight onto the ground, so they follow every fold of it */
          float id = floor(texture2D(tId, vMapUv).r * 255. + .5); vec4 t = texture2D(tTint, vec2((id + .5) / 256., .5)); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, min(1., t.a * 1.45)); }`);   // a little stronger than on the flat board, so snow and woods do not show through as spots
    };
    mat.customProgramCacheKey = () => 'relief';
    mat.needsUpdate = true;
    for (const m of lams) {                                  // trees and houses take the colour of a lit area too, so it reads as one patch
      m.onBeforeCompile = (sh) => {
        sh.uniforms.tId = { value: areaId }; sh.uniforms.tTint = { value: tints }; sh.uniforms.uBoard = { value: new THREE.Vector2(MW / S, MH / S) };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vAU; uniform vec2 uBoard;').replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec4 wpA = modelMatrix * instanceMatrix * vec4(transformed, 1.);
          #else
            vec4 wpA = modelMatrix * vec4(transformed, 1.);
          #endif
          vAU = vec2(wpA.x / uBoard.x + .5, .5 - wpA.z / uBoard.y);`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vAU; uniform sampler2D tId, tTint;').replace('#include <color_fragment>', `#include <color_fragment>
          { float id = floor(texture2D(tId, vAU).r * 255. + .5); vec4 t = texture2D(tTint, vec2((id + .5) / 256., .5)); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, min(1., t.a * .9)); }`);      // trees and houses only take a little of the tint: the area's own colour carries it
      };
      m.customProgramCacheKey = () => 'relief-prop'; m.needsUpdate = true;
    }
  };

  const top = meta.metres * ZS + BASE + 0.1;
  const hit = (ray: THREE.Ray) => {
    if (ray.direction.y >= -1e-4) return null;
    const p = new THREE.Vector3(), at = (t: number) => ray.at(t, p);
    let t0 = Math.max(0, (top - ray.origin.y) / ray.direction.y); const t1 = -ray.origin.y / ray.direction.y, dt = 0.12 / Math.max(0.2, -ray.direction.y);
    for (let t = t0; t <= t1 + dt; t += dt) { at(t); if (p.y <= h(p.x, p.z)) { let a = t0, b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2; at(m); if (p.y <= h(p.x, p.z)) b = m; else a = m; } return at(b).clone(); } t0 = t; }
    return at(t1).clone();
  };

  return { floats, margin, h, geometry, walls, entry, entryFlip, props, snow, lines, linesFlip, borders, patch, hit, ownLines: !!meta.ownLines };
}
