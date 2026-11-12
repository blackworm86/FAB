import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { variant, yawOf, radius, grid, foot, arrange, type Cell } from '../src/troops';

describe('troops', () => {
  it('each unit always shows the same one of its type\'s figures, and the figures vary between units', () => {
    expect(variant('B12', 3)).toBe(variant('B12', 3));
    const seen = new Set(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08'].map((id) => variant(id, 3)));
    expect(seen.size).toBeGreaterThan(1);
    for (const id of ['B01', 'B44', 'X']) { expect(variant(id, 2)).toBeGreaterThanOrEqual(0); expect(variant(id, 2)).toBeLessThan(2); }
  });
  it('The Bulge: Germans face west, the Allies east', () => {
    const dir = (side: string) => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOf(side));
    expect(dir('german').x).toBeCloseTo(-1); expect(dir('allied').x).toBeCloseTo(1);
  });
  it('the layout makes room for the whole figure', () => {
    expect(radius({ size: new THREE.Vector3(0.8, 0.8, 2.25) })).toBeGreaterThan(1.125);       // a Panther
    expect(radius({ size: new THREE.Vector3(0.3, 0.48, 0.3) })).toBeGreaterThanOrEqual(0.55);  // a soldier still gets a small disc
  });
  it('lays an area out as an ordered grid, centred, with nothing overlapping', () => {
    const feet: [number, number][] = [[2.3, 1.0], [0.9, 0.9], [1.9, 0.9], [0.9, 0.9]];
    for (const cols of [4, 2, 1]) {
      const at = grid([feet], cols)[0], box = at.map(([x, z], i) => [x - feet[i][0] / 2, z - feet[i][1] / 2, x + feet[i][0] / 2, z + feet[i][1] / 2]);
      for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
        const [a, b] = [box[i], box[j]]; expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]).toBe(true);
      }
      const minX = Math.min(...box.map((b) => b[0])), maxX = Math.max(...box.map((b) => b[2])), minZ = Math.min(...box.map((b) => b[1])), maxZ = Math.max(...box.map((b) => b[3]));
      expect(Math.abs(minZ + maxZ)).toBeLessThan(1e-9); if (cols === 4) expect(Math.abs(minX + maxX)).toBeLessThan(1e-9);
    }
  });
  it('a contested area: the two sides in separate rows, the first side toward -z', () => {
    const [far, nearSide] = grid([[[1, 1], [1, 1]], [[1, 1]]], 4);
    expect(Math.max(...far.map((p) => p[1]))).toBeLessThan(Math.min(...nearSide.map((p) => p[1])));
  });
  it('a turned figure takes the box round it: lengthwise, crosswise or on the diagonal', () => {
    const t = { size: new THREE.Vector3(0.5, 0.5, 1.5) }, [w0, d0] = foot(t, 0), [w1, d1] = foot(t, Math.PI / 2), [w2, d2] = foot(t, Math.PI / 4);
    expect(d0).toBeGreaterThan(w0); expect(w1).toBeCloseTo(d0); expect(d1).toBeCloseTo(w0);
    expect(w2).toBeCloseTo(d2); expect(w2).toBeGreaterThan(w0); expect(w2).toBeLessThan(w0 + d0);
  });
  // an area drawn as a 12 x 8 board (cells 0.25 apart; d = distance from the nearest border)
  const area = (w: number, h: number): Cell[] => { const c: Cell[] = []; for (let x = 0.125; x < w; x += 0.25) for (let z = 0.125; z < h; z += 0.25) c.push({ x, z, d: Math.min(x, w - x, z, h - z) }); return c; };
  const sep = (p: { x: number; z: number }[], r: number[], gap = 0.15 - 0.05) => { for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) expect(Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z)).toBeGreaterThanOrEqual(r[i] + r[j] + gap); };
  it('arrange: units fill the area (not one corner), inside it, apart, clear of the name plate', () => {
    const cells = area(12, 8), r = [0.9, 0.7, 0.7, 0.9, 0.7], units = r.map((x) => ({ r: x, group: 0 })), plate = { x: 2, z: 4, r: 0.8 };
    const p = arrange(cells, units, [0, -1], [plate], 0.15);
    sep(p, r); p.forEach((q, i) => { expect(q.x).toBeGreaterThan(r[i] - 0.3); expect(q.x).toBeLessThan(12 - r[i] + 0.3); expect(q.z).toBeGreaterThan(r[i] - 0.3); expect(q.z).toBeLessThan(8 - r[i] + 0.3); expect(Math.hypot(q.x - plate.x, q.z - plate.z)).toBeGreaterThanOrEqual(plate.r + r[i] - 0.05); });
    expect(Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x))).toBeGreaterThan(6);         // spread over the width, not bunched
  });
  it('arrange: the attackers stand toward +v, the defenders opposite, each side spread out', () => {
    const units = [0, 0, 1, 1, 1].map((g) => ({ r: 0.7, group: g })), p = arrange(area(12, 8), units, [1, 0], [], 0.15);
    sep(p, units.map((u) => u.r));
    expect(Math.min(p[0].x, p[1].x)).toBeGreaterThan(Math.max(p[2].x, p[3].x, p[4].x));
  });
  it('arrange: a room too small for everyone still gives every unit a place, in the area', () => {
    const units = [1, 2, 3, 4, 5, 6].map(() => ({ r: 0.9, group: 0 })), p = arrange(area(3, 3), units, [0, -1], [], 0.15);
    expect(p).toHaveLength(6); p.forEach((q) => { expect(q.x).toBeGreaterThan(0); expect(q.x).toBeLessThan(3); expect(q.z).toBeGreaterThan(0); expect(q.z).toBeLessThan(3); });
  });
});
