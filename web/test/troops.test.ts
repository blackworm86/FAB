import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { variant, yawOf, radius } from '../src/troops';

describe('troops', () => {
  it('each unit always shows the same one of its type\'s figures, and the figures vary between units', () => {
    expect(variant('B12', 3)).toBe(variant('B12', 3));
    const seen = new Set(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08'].map((id) => variant(id, 3)));
    expect(seen.size).toBeGreaterThan(1);
    for (const id of ['B01', 'B44', 'X']) { expect(variant(id, 2)).toBeGreaterThanOrEqual(0); expect(variant(id, 2)).toBeLessThan(2); }
  });
  it('Germans face west, the Allies east', () => {
    const dir = (side: string) => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOf(side));
    expect(dir('german').x).toBeCloseTo(-1); expect(dir('allied').x).toBeCloseTo(1);
  });
  it('the layout makes room for the whole figure', () => {
    expect(radius({ size: new THREE.Vector3(0.8, 0.8, 2.25) })).toBeGreaterThan(1.125);       // a Panther
    expect(radius({ size: new THREE.Vector3(0.3, 0.48, 0.3) })).toBeGreaterThanOrEqual(0.55);  // a soldier still gets a small disc
  });
});
