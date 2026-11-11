import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { variant, yawOf, radius, grid, foot } from '../src/troops';

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
});
