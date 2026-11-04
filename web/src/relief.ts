/** The 3D map: a smooth snowy relief of the real Ardennes, bent onto the game map, with contour lines, woods and 3D towns.
 *  Data is built offline by tools/map3d (fullmap.py) into public/relief/. World unit = 1 cm, like the board. */
import * as THREE from 'three';

type Meta = { outline: [number, number][][]; w: number; h: number; step: number; cols: number; rows: number; metres: number; towns: [number, number][]; cities: { c: [number, number]; cells: [number, number][] }[] };
export type Relief = {
  /** Height of the ground (cm) at world x, z. */
  h(x: number, z: number): number;
  geometry: THREE.BufferGeometry;
  /** The cut sides of the diorama: straight walls from the base up to the ground, all round the playing area. */
  walls: THREE.BufferGeometry;
  /** The entry strips printed off the map (green Allied, grey German). */
  entry: HTMLImageElement;
  props: THREE.Group;
  snow: HTMLImageElement;
  /** Lines of the printed map without towns, cities and area borders (those become 3D or are drawn apart). */
  lines: HTMLImageElement;
  /** Area borders: a black line on a thin white edge, so they never pass for roads. */
  borders: HTMLImageElement;
  /** Contour lines and the area tints (an area-number texture and a colour per area) for the board material. */
  patch(mat: THREE.MeshStandardMaterial, areaId: THREE.Texture, tints: THREE.Texture): void;
  /** Where a ray meets the ground. */
  hit(ray: THREE.Ray): THREE.Vector3 | null;
};

const RELIEF = 4, BASE = 0.22;                               // BASE: even the lowest valley stands this high (cm) above the wooden base                                          // the relief is shown four times higher than real, as chosen on the mockup
const img = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
const svgImg = (svg: string) => img(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
const group = (svg: string, id: string) => { const m = new RegExp(`<g id="${id}"[\\s\\S]*?</g>(\\s*</g>)?`).exec(svg); return m ? m[0] : ''; };

export async function loadRelief(MW: number, MH: number, S: number, labels: [number, number][], base = './'): Promise<Relief> {
  const [meta, hb, wb, snow, linesSvg, entry] = await Promise.all([
    fetch(base + 'relief/relief.json').then((r) => r.json() as Promise<Meta>),
    fetch(base + 'relief/height.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'relief/woods.bin').then((r) => r.arrayBuffer()),
    img(base + 'relief/snow.png'),
    fetch(base + 'map-lines.svg').then((r) => r.text()),
    img(base + 'relief/entry.png'),
  ]);
  const { cols: C, rows: R, step: ST } = meta, HB = new Uint16Array(hb), WB = new Uint8Array(wb);
  const K = (meta.metres / 65535) * (RELIEF / (80 * S));   // grid value → cm (1 map px ≈ 80 m on the ground)
  const grid = (gx: number, gy: number) => { gx = Math.min(Math.max(gx, 0), C - 1.001); gy = Math.min(Math.max(gy, 0), R - 1.001); const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, v = (a: number, b: number) => HB[b * C + a];
    return ((v(i, j) * (1 - fx) + v(i + 1, j) * fx) * (1 - fy) + (v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx) * fy) * K; };
  const hMap = (px: number, py: number) => grid(px / ST, py / ST) + BASE;
  const landPx = (() => { const c = document.createElement('canvas'); c.width = meta.w; c.height = meta.h; const x = c.getContext('2d')!; x.drawImage(snow, 0, 0); const d = x.getImageData(0, 0, meta.w, meta.h).data, out = new Uint8Array(meta.w * meta.h); for (let k = 0; k < out.length; k++) out[k] = d[k * 4 + 3] > 127 ? 1 : 0; return out; })();
  const onLand = (px: number, py: number) => px >= 0 && py >= 0 && px < meta.w && py < meta.h && landPx[(py | 0) * meta.w + (px | 0)] === 1;
  const wx = (px: number) => px / S - MW / (2 * S), wz = (py: number) => py / S - MH / (2 * S);
  const toMap = (x: number, z: number) => [(x + MW / (2 * S)) * S, (z + MH / (2 * S)) * S] as const;
  const h = (x: number, z: number) => { const [px, py] = toMap(x, z); return onLand(px, py) ? hMap(px, py) : 0; };

  // the ground: one vertex per grid cell (4 map px)
  const geometry = new THREE.PlaneGeometry(MW / S, MH / S, C - 1, R - 1), pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) { const [px, py] = toMap(pos.getX(k), -pos.getY(k)); pos.setZ(k, hMap(px, py)); }     // off the land the shader cuts the ground away
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const wp: number[] = [];
  for (const ring of meta.outline) for (let k = 0; k + 1 < ring.length; k++) {
    const [a, b] = [ring[k], ring[k + 1]], ha = hMap(a[0], a[1]), hb2 = hMap(b[0], b[1]), A = [wx(a[0]), wz(a[1])], B = [wx(b[0]), wz(b[1])];
    wp.push(A[0], 0, A[1], B[0], 0, B[1], B[0], hb2, B[1], A[0], 0, A[1], B[0], hb2, B[1], A[0], ha, A[1]);
  }
  const walls = new THREE.BufferGeometry(); walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); walls.computeVertexNormals();

  // printed lines without towns, cities and borders; borders redrawn black on a white edge
  const lines = await svgImg(linesSvg.replace(group(linesSvg, 'cities'), '').replace(group(linesSvg, 'towns'), '').replace(group(linesSvg, 'boundaries'), '').replace(group(linesSvg, 'outline'), ''));   // the white board outline belongs to the flat map, not to the diorama
  const paths = (group(linesSvg, 'boundaries').match(/<path[^>]*\/>/g) ?? []).join('');
  const head = /<svg[^>]*>/.exec(linesSvg)![0];
  const borders = await svgImg(`${head}<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-opacity=".6" stroke-width="7">${paths}</g><g stroke="#141416" stroke-width="2.9">${paths}</g></g></svg>`);

  // woods and towns in 3D: snow-capped conifers, houses with snowy roofs, a church in every town
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const props = new THREE.Group(), P = 1.1;               // props a little larger than life on the mockup, so they read at game scale
  const towns = meta.towns, cityCell = new Set(meta.cities.flatMap((c) => c.cells.map(([x, y]) => `${(x / 4) | 0},${(y / 4) | 0}`)));
  const inTown = (x: number, y: number) => towns.some(([tx, ty]) => Math.hypot(x - tx, y - ty) < 15) || [-2, 0, 2].some((a) => [-2, 0, 2].some((b) => cityCell.has(`${((x / 4) | 0) + a},${((y / 4) | 0) + b}`)));
  const nearLabel = (x: number, y: number) => labels.some(([lx, ly]) => Math.abs(x - lx) < 50 && y - ly > -36 && y - ly < 24);   // the printed number and name stay clear
  const trees: number[][] = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const w = WB[j * C + i] / 255; if (w > 0.3 && rnd() < w * 0.26) { const x = i * ST + (rnd() - 0.5) * ST, y = j * ST + (rnd() - 0.5) * ST; if (!inTown(x, y) && !nearLabel(x, y)) trees.push([x, y, 0.75 + rnd() * 0.6, rnd()]); } }
  const houses: number[][] = [], churches: number[][] = [];
  for (const [x, y] of towns) { churches.push([x + 1, y - 1, 1]); for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.283 + rnd() * 0.4, r = 5.5 + rnd() * 3.5; houses.push([x + Math.cos(a) * r, y + Math.sin(a) * r, -a, 2.4 + rnd() * 0.6, 2 + rnd() * 0.8, 3.2 + rnd() * 0.8]); } }
  for (const c of meta.cities) {
    const far = Math.max(...c.cells.map(([x, y]) => Math.hypot(x - c.c[0], y - c.c[1]))) || 1;
    for (const [x, y] of c.cells) { const t = 1 - Math.hypot(x - c.c[0], y - c.c[1]) / far; houses.push([x + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.6, rnd() < 0.5 ? 0 : 1.571, 3.3, 2.6 + t * 4 + rnd() * 1.5, 3.4]); }
    churches.push([c.c[0], c.c[1], 1.6]); const f = c.cells[(c.cells.length * 0.3) | 0]; churches.push([f[0], f[1], 1.2]);
    for (let k = 0; k < 16; k++) { const a = rnd() * 6.283, r = far + 4 + rnd() * 7; houses.push([c.c[0] + Math.cos(a) * r, c.c[1] + Math.sin(a) * r, -a, 2.6, 2.2 + rnd(), 3.4]); }
  }
  const lams: THREE.MeshLambertMaterial[] = [], lam = (color: number) => { const m = new THREE.MeshLambertMaterial({ color }); lams.push(m); return m; };
  const treeGeo = new THREE.ConeGeometry(2.1, 6, 5).translate(0, 3, 0), capGeo = new THREE.ConeGeometry(0.95, 2.2, 5).translate(0, 4.95, 0);
  const tr = new THREE.InstancedMesh(treeGeo, lam(0xffffff), trees.length), cap = new THREE.InstancedMesh(capGeo, lam(0xf1f4f8), trees.length);
  const hs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), lam(0xe9e0cc), houses.length);
  const rf = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 0.7072, 0.45, 4, 1).rotateY(Math.PI / 4).translate(0, 1.225, 0), lam(0xffffff), houses.length);
  const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 7, 2).translate(0, 3.5, 0), lam(0xd8cdb4), churches.length), sp = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4, 4).rotateY(Math.PI / 4).translate(0, 9, 0), lam(0x4f5a5c), churches.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), u = P / S;
  const groundMin = (x: number, y: number, r: number) => Math.min(hMap(x - r, y - r), hMap(x + r, y - r), hMap(x - r, y + r), hMap(x + r, y + r));
  trees.forEach((t, i) => { m4.compose(v.set(wx(t[0]), hMap(t[0], t[1]) - 0.01, wz(t[1])), q.identity(), sc.setScalar(t[2] * u)); tr.setMatrixAt(i, m4); cap.setMatrixAt(i, m4); tr.setColorAt(i, col.setRGB(0.13 + t[3] * 0.06, 0.24 + t[3] * 0.08, 0.18 + t[3] * 0.05)); });
  houses.forEach((b, i) => { m4.compose(v.set(wx(b[0]), groundMin(b[0], b[1], 1.6) - 0.01, wz(b[1])), q.setFromEuler(e.set(0, b[2], 0)), sc.set(b[3] * u, b[4] * u, b[5] * u)); hs.setMatrixAt(i, m4); rf.setMatrixAt(i, m4); rf.setColorAt(i, col.setHex(rnd() < 0.8 ? 0xf3f5f8 : 0x8a8f99)); });
  churches.forEach((c, i) => { m4.compose(v.set(wx(c[0]), groundMin(c[0], c[1], 1) - 0.01, wz(c[1])), q.identity(), sc.setScalar(c[2] * u)); tw.setMatrixAt(i, m4); sp.setMatrixAt(i, m4); });
  props.add(tr, cap, hs, rf, tw, sp);

  const patch = (mat: THREE.MeshStandardMaterial, areaId: THREE.Texture, tints: THREE.Texture) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMetre = { value: 1 / ((RELIEF / (80 * S))) }; sh.uniforms.tId = { value: areaId }; sh.uniforms.tTint = { value: tints };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vMet; uniform float uMetre;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMet = transformed.z * uMetre;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMet; uniform sampler2D tId, tTint;').replace('#include <map_fragment>', `#include <map_fragment>
        { /* contours: fine 25 m lines that fade where they crowd, a stronger line every 100 m; slate blue on snow, green in the woods */
          float wood = clamp((0.8 - diffuseColor.r) / 0.45, 0., 1.); vec3 lc = mix(vec3(.13,.21,.36), vec3(.03,.13,.05), wood);
          float c1 = vMet / 25., f1 = fwidth(c1), m1 = (1. - clamp(abs(fract(c1 + .5) - .5) / max(f1, 1e-4), 0., 1.)) * smoothstep(2.5, 7., 1. / max(f1, 1e-4));
          float c2 = vMet / 100., f2 = fwidth(c2), m2 = (1. - clamp(abs(fract(c2 + .5) - .5) / max(f2, 1e-4) - .3, 0., 1.)) * smoothstep(2., 5., 1. / max(f2, 1e-4));
          diffuseColor.rgb = mix(diffuseColor.rgb, lc, max(m1 * .32, m2 * .58));
          /* area highlights (moves, battles, tints) painted straight onto the ground, so they follow every fold of it */
          float id = floor(texture2D(tId, vMapUv).r * 255. + .5); if (id < .5) discard; vec4 t = texture2D(tTint, vec2((id + .5) / 128., .5)); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, min(1., t.a * 1.45)); }`);   // a little stronger than on the flat board, so snow and woods do not show through as spots
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
          { float id = floor(texture2D(tId, vAU).r * 255. + .5); vec4 t = texture2D(tTint, vec2((id + .5) / 128., .5)); diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, min(1., t.a * 2.2)); }`);
      };
      m.customProgramCacheKey = () => 'relief-prop'; m.needsUpdate = true;
    }
  };

  const top = (meta.metres * RELIEF) / (80 * S) + BASE + 0.1;
  const hit = (ray: THREE.Ray) => {
    if (ray.direction.y >= -1e-4) return null;
    const p = new THREE.Vector3(), at = (t: number) => ray.at(t, p);
    let t0 = Math.max(0, (top - ray.origin.y) / ray.direction.y); const t1 = -ray.origin.y / ray.direction.y, dt = 0.12 / Math.max(0.2, -ray.direction.y);
    for (let t = t0; t <= t1 + dt; t += dt) { at(t); if (p.y <= h(p.x, p.z)) { let a = t0, b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2; at(m); if (p.y <= h(p.x, p.z)) b = m; else a = m; } return at(b).clone(); } t0 = t; }
    return at(t1).clone();
  };

  return { h, geometry, walls, entry, props, snow, lines, borders, patch, hit };
}
