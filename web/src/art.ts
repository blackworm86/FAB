// Vector art drawn from data (no scans). One SVG per block label / chit; strength turns the label as the block would turn.
import type { Unit } from '../../engine/src';

export const ECH: Record<string, string> = { de_5pz: '#d6d8db', de_6pz: '#8e2d82', de_7a: '#3fa0dc', de_sr: '#f07f1e', us_1a: '#b9dc8c', us_3a: '#4d5b2c', us_sr: '#a6d6f3', br_xxx: '#e0412e' };
const LABEL_BG: Record<string, string> = { german: '#b7bbc1', us: '#8fa83f', british: '#e3bb7d' };
const PIP: Record<string, [string, string]> = { elite: ['#d7262b', '#fff'], veteran: ['#151515', '#151515'], green: ['#fff', '#151515'] };

function symbol(kind: string, fill: string) {
  const box = `<rect x="27" y="27" width="46" height="34" fill="${fill}" stroke="#111" stroke-width="2.4"/>`;
  const X = `<path d="M27 27 L73 61 M73 27 L27 61" stroke="#111" stroke-width="2.2"/>`;
  const oval = `<rect x="36" y="35" width="28" height="18" rx="9" fill="none" stroke="#111" stroke-width="2.2"/>`;
  const extra: Record<string, string> = {
    inf: X, armor: oval, mech: X + oval, cavalry: `<path d="M27 61 L73 27" stroke="#111" stroke-width="2.2"/>` + oval,
    airborne: X + `<path d="M38 55 q6 -8 12 0 q6 -8 12 0" fill="none" stroke="#111" stroke-width="2"/>`, mountain: X + `<path d="M44 61 L50 51 L56 61 Z" fill="#111"/>`,
  };
  return box + (extra[kind] ?? X);
}
function pips(n: number, q: string, edge: number) {               // edge 0 top, 1 right, 2 bottom, 3 left (clockwise, as strength drops)
  if (!n || !q) return '';
  const [f, s] = PIP[q], out: string[] = [];
  for (let i = 0; i < n; i++) { const t = 50 + (i - (n - 1) / 2) * 9.5; out.push(`<circle cx="${t}" cy="11" r="4" fill="${f}" stroke="${s}" stroke-width="1.4"/>`); }
  return `<g transform="rotate(${edge * 90} 50 50)">${out.join('')}</g>`;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** 100x100 SVG of the block label at its current strength (full strength edge on top, rotated 90° CCW per step lost). */
export function labelSvg(u: Unit) {
  const side = u.name in BRIT ? 'british' : u.side === 'german' ? 'german' : 'us';
  const edges = Array.from({ length: u.max }, (_, k) => pips(u.max - k, u.q[u.max - k - 1], k)).join('');
  const code = u.code ? `<rect x="6" y="20" width="12" height="${8 + u.code.length * 7}" fill="#fff"/><text transform="translate(15 ${23 + u.code.length * 3.5}) rotate(-90)" font-size="9" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700">${esc(u.code)}</text>` : '';
  const inner = `<rect width="100" height="100" fill="${LABEL_BG[side]}"/>${code}${symbol(u.symbol ?? 'inf', ECH[u.ech ?? ''] ?? '#ccc')}${edges}
    <text x="88" y="80" font-size="13" text-anchor="end" font-family="Arial Narrow, Arial" font-weight="700">${esc(u.name)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><g transform="rotate(${-90 * (u.max - u.str)} 50 50)">${inner}</g></svg>`;
}
const BRIT: Record<string, 1> = { '43 Inf': 1, '53 Inf': 1, Guards: 1, '51 Inf': 1 };

/** Garrison chit (light-blue US Strategic Reserve infantry). */
export function garrisonSvg(name: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="#8fa83f"/><circle cx="50" cy="16" r="5" fill="#fff" stroke="#111" stroke-width="1.5"/>
    <rect x="28" y="28" width="44" height="34" fill="#a6d6f3" stroke="#111" stroke-width="2.4"/><path d="M28 28 L72 62 M72 28 L28 62" stroke="#111" stroke-width="2.2"/>
    <text x="50" y="84" font-size="13" text-anchor="middle" font-family="Arial Narrow, Arial">${esc(name.replace('Garrison ', ''))}</text></svg>`;
}
