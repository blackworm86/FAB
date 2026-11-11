import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { deploy, fitAt, roomOf, slots, radius, rng } from '../src/troops';

const inf = { vehicle: false, size: new THREE.Vector3(0.22, 0.32, 0.2) }, tank = { vehicle: true, size: new THREE.Vector3(0.55, 0.54, 1.5) };
const square = (w: number) => roomOf([{ x: -w, z: -w }, { x: w, z: -w }, { x: w, z: w }, { x: -w, z: w }]);
const gap = (a: [number, number, number][], ra: number, b: [number, number, number][], rb: number) => Math.min(...a.flatMap(([x, z]) => b.map(([X, Z]) => Math.hypot(x - X, z - Z) - ra - rb)));

describe('troops', () => {
  it('one figure per step', () => { for (const n of [1, 2, 3, 4]) { expect(slots(inf, n, 1, rng(1))).toHaveLength(n); expect(slots(tank, n, 1, rng(1))).toHaveLength(n); } });
  it('deploys every unit inside the area, apart from each other, facing the given way', () => {
    const room = square(3), units = [{ t: inf, n: 4 }, { t: tank, n: 3 }, { t: null, n: 2 }];
    const d = deploy(units, room, { x: 0, z: 0 }, 6, [1, 0], [], 5)!;
    expect(d).toHaveLength(3);
    for (const p of d) for (const [x, z] of p.fig) expect(room(x, z, p.r)).toBe(true);
    for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) expect(gap(d[i].fig, d[i].r, d[j].fig, d[j].r)).toBeGreaterThanOrEqual(0.15);
    expect(d[2].fig).toHaveLength(1);                                          // a hidden unit is one block
  });
  it('draws figures as big as the area allows: a crowded area gets smaller ones', () => {
    const one = deploy([{ t: tank, n: 2 }], square(3), { x: 0, z: 0 }, 6, [0, -1], [], 1)!, four = deploy([1, 2, 3].map(() => ({ t: tank, n: 2 })), square(3), { x: 0, z: 0 }, 6, [0, -1], [], 1)!;
    expect(one[0].k).toBeGreaterThan(four[0].k);
  });
  it('keeps clear of obstacles (the printed name plate)', () => {
    const d = deploy([{ t: inf, n: 3 }], square(3), { x: 0, z: 0 }, 6, [0, -1], [{ x: 0, z: 0, r: 1 }], 2)!;
    for (const [x, z] of d[0].fig) expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(1 + d[0].r);
  });
  it('fits a formation round one spot', () => {
    const p = fitAt(tank, 4, 0.9, 5, 5, [0, -1], 3);
    for (const [x, z] of p.fig) expect(Math.hypot(x - 5, z - 5) + radius(tank, p.k)).toBeLessThanOrEqual(0.9 + 1e-9);
  });
});
