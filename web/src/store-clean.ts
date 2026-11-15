/** Whatever arrives from the database was written by another browser, and the table puts game data into the page as HTML in many places.
 *  Every text (and key) loses the characters that could start a tag or leave an attribute, so game data can never run as script on this screen (audit, 15 November 2026).
 *  Honest games contain none of them (test/store-clean.test.ts), so nothing changes for them. */
export function clean<T>(v: T): T {
  if (typeof v === 'string') return v.replace(/[<>"`]/g, (c) => (c === '<' ? '‹' : c === '>' ? '›' : '″')) as T;
  if (Array.isArray(v)) return v.map(clean) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [clean(k), clean(x)])) as T;
  return v;
}
