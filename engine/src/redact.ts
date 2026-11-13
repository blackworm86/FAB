/** Opaque ids for hidden blocks: only the owning seat knows the salt, so an alias says nothing about the block (SHA-256, so it cannot be run backwards). */
const K = Array.from({ length: 64 }, (_, i) => {
  let p = 0,
    n = 2;
  for (let c = 0; c <= i; n++) {
    let ok = true;
    for (let d = 2; d * d <= n; d++)
      if (n % d === 0) {
        ok = false;
        break;
      }
    if (ok) {
      p = n;
      c++;
    }
  }
  return Math.floor((Math.cbrt(p) % 1) * 2 ** 32) >>> 0;
});
const H0 = [2, 3, 5, 7, 11, 13, 17, 19].map((p) => Math.floor((Math.sqrt(p) % 1) * 2 ** 32) >>> 0);
export function sha256(msg: string): string {
  const b = new TextEncoder().encode(msg),
    l = b.length,
    n = (((l + 8) >> 6) + 1) << 4,
    w = new Uint32Array(n);
  for (let i = 0; i < l; i++) w[i >> 2] |= b[i] << (24 - 8 * (i & 3));
  w[l >> 2] |= 0x80 << (24 - 8 * (l & 3));
  w[n - 1] = l * 8;
  const h = H0.slice(),
    r = (x: number, k: number) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 16) {
    const s = new Uint32Array(64);
    s.set(w.subarray(o, o + 16));
    for (let i = 16; i < 64; i++)
      s[i] =
        (s[i - 16] +
          (r(s[i - 15], 7) ^ r(s[i - 15], 18) ^ (s[i - 15] >>> 3)) +
          s[i - 7] +
          (r(s[i - 2], 17) ^ r(s[i - 2], 19) ^ (s[i - 2] >>> 10))) >>>
        0;
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + s[i]) >>> 0,
        t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) >>> 0;
    }
    [a, bb, c, d, e, f, g, hh].forEach((v, i) => {
      h[i] = (h[i] + v) >>> 0;
    });
  }
  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}
export const alias = (salt: string, id: string) => 'h' + sha256(`${salt}|${id}`).slice(0, 24);
