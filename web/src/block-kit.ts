// The series rule for drawing a block face, shared by every volume (The Bulge, Golan '73, Sicily...).
// Measured from the printed stickers (Bulge sticker sheet, Golan '73 Vassal labels): see docs/design/blocks.md.
// Face 100 x 100: the block's wood shows as a 5-wide frame round a 90 x 90 sticker. Full strength is the top edge; the
// next strength down is the right edge, then the bottom, then the left (the block turns 90° counter-clockwise per step lost).
//   top / right / left pips: centred, 18 in from their edge (r 3.7, 10.8 apart)
//   bottom pips: left of the name, which sits bottom right (right end at 86.5, baseline 88)
//   unit box 24.5..74.5 x 27.5..70.5, thick black outline, filled with the command's (or division's) colour
//   colour stripe (if any) edge to edge across the sticker, 54.5..66, behind the unit box
//   set-up or arrival code reads up the left edge from the top: white box for a set-up area, coloured box for special
//   holding boxes, plain lettering for an arrival turn and entry
//   yellow arrow at the far end of the edge holding the strength a reduced unit starts or arrives with

export type Pips = (string | null | undefined)[];
export type BlockSpec = {
  wood: string; paper: string; box: string; symbol?: string; steps: number; q: Pips;
  name: string; nameBg?: string; code?: { t: string; bg?: string } | null; stripe?: string | null; arrowAt?: number | null;
  /** Star-of-David pips (the Israeli strongpoints) instead of dots. */
  star?: boolean;
  /** Which edge (0 top, 1 right, 2 bottom, 3 left) holds strength s. Default: max - s. */
  edgeOf?: (s: number) => number;
  /** A picture that replaces the unit box, code, stripe and name (strongpoints and other special stickers). */
  body?: string;
  /** Type scale of the volume's stickers (The Bulge prints larger pips and lettering than Golan). */
  size?: Partial<Sizes>;
};
export type Sizes = { pip: number; gap: number; name: number; code: number };
const GOLAN_SIZES: Sizes = { pip: 3.7, gap: 10.8, name: 13.5, code: 11 };
export const PIP: Record<string, [string, string]> = { elite: ['#e3222b', '#fff'], veteran: ['#141414', '#141414'], green: ['#fff', '#141414'] };
export const FONT = 'font-family="Arial Narrow, Arial, sans-serif" font-weight="700"';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Width of bold condensed lettering (the stickers' Arial Narrow), so the layout does not depend on the fonts installed. */
export const textW = (s: string, size: number) => [...s].reduce((a, c) => a + (/[il1.\-()*/ ]/.test(c) ? 0.3 : /[mwMW]/.test(c) ? 0.68 : /[A-Z0-9]/.test(c) ? 0.5 : 0.45), 0) * size;
/** Bold narrow lettering, always set to its condensed width (and squeezed into w when longer). */
export const word = (s: string, x: number, y: number, size: number, w: number, o: { anchor?: string; fill?: string; italic?: boolean; rot?: number } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.fill ? ` fill="${o.fill}"` : ''}${o.italic ? ' font-style="italic"' : ''}${o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : ''} ${FONT} textLength="${Math.min(textW(s, size), w).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(s)}</text>`;
const tri = (x: number, y: number, r: number, up: boolean) => { const s = up ? -1 : 1; return `M${x} ${y + s * r}L${(x + r * 0.866).toFixed(1)} ${(y - s * r / 2).toFixed(1)}L${(x - r * 0.866).toFixed(1)} ${(y - s * r / 2).toFixed(1)}Z`; };
/** The opening of a face: the SVG and the wood. */
export const frame = (wood: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="${wood}"/>`;
export const sticker = (paper: string) => `<rect x="5" y="5" width="90" height="90" fill="${paper}"/>`;
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** The unit box and its NATO symbol. */
export function unitBox(kind: string | undefined, fill: string) {
  const L = 24.5, T = 27.5, W = 50, H = 43, R = L + W, B = T + H;
  const box = `<rect x="${L}" y="${T}" width="${W}" height="${H}" fill="${fill}" stroke="#111" stroke-width="2.5"/>`;
  const x = `<path d="M${L} ${T}L${R} ${B}M${R} ${T}L${L} ${B}" stroke="#111" stroke-width="2.1"/>`, oval = '<rect x="34" y="38.5" width="31" height="21.5" rx="10.75" fill="none" stroke="#111" stroke-width="2.5"/>';
  const slash = `<path d="M${L} ${B}L${R} ${T}" stroke="#111" stroke-width="2.1"/>`;
  const extra: Record<string, string> = { inf: x, armor: oval, mech: x + oval, recon: slash + oval, cavalry: slash + oval,
    airborne: x + '<path d="M38.5 66q5.75-9 11.5 0q5.75-9 11.5 0" fill="none" stroke="#111" stroke-width="1.9"/>',
    mountain: x + `<path d="M43 ${B}L50 ${B - 9}L57 ${B}Z" fill="#111"/>` };
  return box + (extra[kind ?? 'inf'] ?? x);
}
/** One edge's pips drawn as if that edge were on top, then turned into place: centred on cx, the yellow arrow at the far end. */
function edgeRow(n: number, q: string | null | undefined, k: number, cx: number, arrow: boolean, star: boolean, z: Sizes) {
  if (!n) return '';
  const gap = star ? 11.5 : z.gap, out: string[] = [], [f, s] = PIP[q ?? 'veteran'] ?? PIP.veteran;
  for (let i = 0; i < n; i++) { const t = cx + (i - (n - 1) / 2) * gap;
    out.push(star ? `<path d="${tri(t, 18, 5, true)}${tri(t, 18, 5, false)}" fill="none" stroke="#1d3f8a" stroke-width="1.7"/>` : `<circle cx="${t.toFixed(1)}" cy="18" r="${z.pip}" fill="${f}" stroke="${s}" stroke-width="1.3"/>`); }
  if (arrow) {                  // after the last pip, at the end the block turns toward (below on the right edge, left on the bottom); on the left edge below too, under the code
    const d = k === 3 ? -1 : 1, a = cx + d * (((n - 1) / 2) * gap + z.pip + 5.8);
    out.push(`<path d="M${a + 4 * d} 13.2V22.8L${a - 4.5 * d} 18Z" fill="#e2e22a" stroke="#4a4a14" stroke-width=".9" stroke-linejoin="round"/>`); }
  return `<g transform="rotate(${k * 90} 50 50)">${out.join('')}</g>`;
}
const NAME_W = 64;
/** 512 px SVG of a block face at strength str, by the series rule. */
export function blockFace(b: BlockSpec, str = b.steps): string {
  const max = b.steps, edgeOf = b.edgeOf ?? ((s: number) => max - s), z = { ...GOLAN_SIZES, ...b.size }, NAME = z.name;
  const nameW = Math.min(textW(b.name, NAME), NAME_W);
  const edges = Array.from({ length: max }, (_, i) => { const s = max - i, k = edgeOf(s);
    let cx = 50;
    if (k === 2 && !b.body) cx = 100 - Math.min(50, 86.5 - nameW - 5 - (((s - 1) / 2) * z.gap + z.pip + 0.5));       // beside the name; that edge is drawn upside down, so measured from the right
    return edgeRow(s, b.q[s - 1], k, cx, b.arrowAt === s && s < max, !!b.star, z); }).join('');
  let body = b.body;
  if (body == null) {
    const c = b.code, f = z.code, h = c ? 7 + c.t.length * f * 0.51 : 0, bw = f + 1.5;
    const code = !c ? '' : `${c.bg ? `<rect x="8.5" y="11" width="${bw}" height="${h.toFixed(1)}" fill="${c.bg}"/>` : ''}${word(c.t, 8.5 + bw / 2 + f * 0.36, 11 + h / 2, f, h - 4, { anchor: 'middle', rot: -90 })}`;
    const nameBg = b.nameBg ? `<rect x="${(85 - nameW).toFixed(1)}" y="${88 - NAME * 0.82}" width="${(nameW + 3.5).toFixed(1)}" height="${NAME + 0.5}" fill="${b.nameBg}"/>` : '';
    body = `${b.stripe ? `<rect x="5" y="54.5" width="90" height="11.5" fill="${b.stripe}"/>` : ''}${unitBox(b.symbol, b.box)}${code}${nameBg}${word(b.name, 86.5, 88, NAME, NAME_W, { anchor: 'end' })}`;
  }
  return `${frame(b.wood)}<g transform="rotate(${-90 * edgeOf(str)} 50 50)">${sticker(b.paper)}${body}${edges}</g></svg>`;
}
