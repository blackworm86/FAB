// d10, "success on <= Success Number"; a 1 always succeeds and a 10 always fails (rule 2.1).
export const rng = (seed: number) => () => { // mulberry32: small, seedable, good enough for dice
  seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const d10 = (r: () => number) => 1 + Math.floor(r() * 10);
export const succeeds = (roll: number, sn: number) => (roll === 1 ? true : roll === 10 ? false : roll <= sn);
export const hitProb = (sn: number) => Math.min(9, Math.max(1, sn)) / 10;
