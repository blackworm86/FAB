/** Victory-point symbols as small, thick 3D tokens floating over their areas, turning slowly (mockup: ?vp3d=1).
 *  German: blue disc, white rim, raised white star. Allied: black cross with a white edge. Both sides: red pentagon with a raised yellow star. */
import * as THREE from 'three';

const star = (r: number, ri: number, n = 5) => { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? ri : r; const x = Math.cos(a) * rr, y = -Math.sin(a) * rr; if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); return s; };
const poly = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, -y) : s.moveTo(x, -y))); s.closePath(); return s; };
const cross = (k: number) => poly([[-2, -2], [-3.4, -10], [3.4, -10], [2, -2], [10, -3.4], [10, 3.4], [2, 2], [3.4, 10], [-3.4, 10], [-2, 2], [-10, 3.4], [-10, -3.4]].map(([x, y]) => [x * k, y * k] as [number, number]));
const ext = (s: THREE.Shape, depth: number, bevel = 0.04) => { const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 }); g.translate(0, 0, -depth / 2); return g; };
const mat = (c: number, rough = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05 });
const disc = (r: number) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s; };

const R = 0.72, D = 0.34;          // ~1.5 cm across (about a block), 3.4 mm thick
function german() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ext(disc(R + 0.06), D, 0.03), mat(0xffffff)));            // white rim
  const face = new THREE.Mesh(ext(disc(R - 0.02), D + 0.04, 0.03), mat(0x2f78c8, 0.4)); g.add(face);
  const st = ext(star(R * 0.72, R * 0.29), 0.06, 0.015);
  for (const z of [1, -1]) { const m = new THREE.Mesh(st, mat(0xffffff, 0.35)); m.position.z = z * (D / 2 + 0.05); g.add(m); }
  return g;
}
function allied() {
  const g = new THREE.Group(), k = R / 10;
  g.add(new THREE.Mesh(ext(cross(k * 1.16), D * 0.9, 0.03), mat(0xffffff)));     // white edge
  g.add(new THREE.Mesh(ext(cross(k), D + 0.06, 0.03), mat(0x121214, 0.45)));
  return g;
}
function mutual() {
  const g = new THREE.Group(), r = R * 1.05, pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  g.add(new THREE.Mesh(ext(poly(pts), D, 0.03), mat(0xc3281c, 0.45)));
  const st = ext(star(r * 0.95, r * 0.38), 0.07, 0.015);
  for (const z of [1, -1]) { const m = new THREE.Mesh(st, mat(0xf2d21b, 0.35)); m.position.z = z * (D / 2 + 0.04); g.add(m); }
  return g;
}

export interface VpArea { label: [number, number]; vp: { allied: number; german: number; mutual?: boolean } }
/** Tokens at the same spots as the printed symbols (map pixels, rotated with the view), floating above the board. */
export function buildVp3d(areas: VpArea[], toWorld: (x: number, y: number) => THREE.Vector3, rot: number) {
  const root = new THREE.Group(), tokens: THREE.Object3D[] = [];
  const put = (o: THREE.Group, a: VpArea, dx: number, dy: number, i: number) => {
    const c = Math.cos(rot), s = Math.sin(rot), x = a.label[0] + dx * c - dy * s, y = a.label[1] + dx * s + dy * c, p = toWorld(x, y);
    o.position.set(p.x, 2.7, p.z); o.userData.phase = (a.label[0] * 0.013 + i * 1.7) % (Math.PI * 2); o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; } });
    root.add(o); tokens.push(o);
  };
  for (const a of areas) {
    const v = a.vp; if (!v) continue;
    for (let i = 0; i < v.allied; i++) put(allied(), a, (i - (v.allied - 1) / 2) * 46, -50, i);
    for (let i = 0; i < v.german; i++) put(german(), a, (i - (v.german - 1) / 2) * 46, -50, i);
    if (v.mutual) put(mutual(), a, 0, -50, 0);
  }
  const update = (t: number) => { for (const o of tokens) { const ph = o.userData.phase as number; o.rotation.set(-0.35, rot + Math.sin(t * 0.0005 + ph) * 0.6, 0, 'YXZ'); o.position.y = 2.7 + Math.sin(t * 0.0011 + ph) * 0.15; } };      // faces the player, sways ±35° and bobs: always readable, never edge-on
  return { root, update };
}
