/** Figures instead of blocks (docs/PARALLEL.md §3): a unit drawn as small soldiers, a tank or a gun on a base in the block's wood.
 *  shortcut: the figures are built from simple shapes until the pipeline (tools/figures/) delivers .glb models, then load those here. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type FigKind = 'infantry' | 'tank' | 'gun' | 'hidden';
const mat = (c: number, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
const cyl = (r: number, l: number, m: THREE.Material, n = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, n), m); o.castShadow = true; return o; };

/** Uniform and paint of each side (the base keeps the block's wood, so the side still reads from afar). */
const DRESS: Record<string, { cloth: number; paint: number }> = {
  us: { cloth: 0x5e5b3b, paint: 0x4b5232 }, allied: { cloth: 0x5e5b3b, paint: 0x4b5232 }, british: { cloth: 0x7a6a45, paint: 0x5a5a3a },
  german: { cloth: 0x5c6157, paint: 0x9a8b5a }, axis: { cloth: 0x5c6157, paint: 0x9a8b5a },
};

function soldier(cloth: THREE.Material, skin: THREE.Material, steel: THREE.Material, x: number, z: number, turn: number) {
  const s = new THREE.Group();
  s.add(box(0.1, 0.24, 0.09, cloth, -0.035, 0.12, 0), box(0.1, 0.24, 0.09, cloth, 0.035, 0.12, 0));       // legs
  s.add(box(0.2, 0.24, 0.12, cloth, 0, 0.36, 0));                                                          // body
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin); head.position.y = 0.53; s.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel); helmet.position.y = 0.55; s.add(helmet);
  const rifle = box(0.03, 0.03, 0.42, mat(0x3a2a1a), 0.09, 0.38, 0.08); rifle.rotation.x = -0.5; s.add(rifle);
  s.position.set(x, 0, z); s.rotation.y = turn; return s;
}
function tank(paint: THREE.Material) {
  const t = new THREE.Group(), track = mat(0x2a2a26, 0.95);
  t.add(box(1.25, 0.2, 0.2, track, 0, 0.1, 0.28), box(1.25, 0.2, 0.2, track, 0, 0.1, -0.28));
  const hull = box(1.2, 0.2, 0.62, paint, 0, 0.28, 0); t.add(hull);
  const turret = box(0.52, 0.2, 0.44, paint, -0.08, 0.48, 0); t.add(turret);
  const gun = cyl(0.035, 0.75, paint); gun.rotation.z = Math.PI / 2; gun.position.set(0.5, 0.49, 0); t.add(gun);
  return t;
}
function gun(paint: THREE.Material, cloth: THREE.Material, skin: THREE.Material, steel: THREE.Material) {
  const t = new THREE.Group(), wheel = mat(0x262622, 0.95);
  for (const z of [0.22, -0.22]) { const w = cyl(0.17, 0.07, wheel, 14); w.rotation.x = Math.PI / 2; w.position.set(0, 0.17, z); t.add(w); }
  t.add(box(0.12, 0.26, 0.38, paint, 0.02, 0.3, 0));                                                        // shield
  const barrel = cyl(0.04, 0.8, paint); barrel.rotation.z = Math.PI / 2 - 0.35; barrel.position.set(0.3, 0.42, 0); t.add(barrel);
  for (const z of [0.12, -0.12]) { const tr = box(0.6, 0.05, 0.05, paint, -0.32, 0.12, z); tr.rotation.y = z > 0 ? -0.2 : 0.2; t.add(tr); }   // split trail
  t.add(soldier(cloth, skin, steel, -0.35, 0.32, -0.6));
  return t;
}
/** A covered shape under a tarp: the same for every hidden unit, so it tells nothing of what is under it. */
function tarp() {
  const t = new THREE.Group(), cloth = mat(0x5d5a4a, 1);
  const lump = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth); lump.scale.set(1.25, 0.8, 0.95); lump.castShadow = true; t.add(lump);
  for (const x of [-0.3, 0, 0.3]) { const rope = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 4, 24, Math.PI), mat(0x2e2b22)); rope.position.x = x; rope.rotation.y = Math.PI / 2; rope.scale.set(0.95 - Math.abs(x) * 0.5, 0.8, 1); t.add(rope); }
  return t;
}

/** The figure on its base: the base is the root mesh (picked and outlined like a block), the printed face stands on a card at its front.
 *  `face` is the block label's texture, or null for a hidden unit. */
export function figure(kind: FigKind, side: string, wood: number, face: THREE.Texture | null) {
  const d = DRESS[side] ?? DRESS.us, cloth = mat(d.cloth), paint = mat(d.paint, 0.7), skin = mat(0xc89a74), steel = mat(kind === 'infantry' ? d.cloth : 0x4a4a42, 0.6);
  const woodM = mat(wood, 0.75), base = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.16, 1.6, 2, 0.05), woodM); base.castShadow = base.receiveShadow = true;
  const on = new THREE.Group(); on.position.y = 0.08; base.add(on);
  if (kind === 'hidden') { const t = tarp(); t.position.z = -0.05; on.add(t); }
  else {
    const back = new THREE.Group(); back.position.z = -0.25; on.add(back);
    if (kind === 'infantry') for (const [x, z, r] of [[-0.45, 0.05, 0.3], [0, -0.25, -0.1], [0.45, 0.1, -0.35]]) back.add(soldier(cloth, skin, steel, x, z, r));
    if (kind === 'tank') { const t = tank(paint); t.rotation.y = 0.35; back.add(t); }
    if (kind === 'gun') { const t = gun(paint, cloth, skin, steel); t.rotation.y = 0.5; back.add(t); }
    if (face) {                                                                                           // the printed face, so strength stays readable
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.04), [woodM, woodM, woodM, woodM, new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }), woodM]);
      card.position.set(0, 0.17, 0.42); card.rotation.x = -1.3; card.castShadow = true; on.add(card);
    }
  }
  base.position.y = 0.08; return base;
}
