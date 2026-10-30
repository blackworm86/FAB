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
export function garrisonSvg(name: string, german = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="${german ? '#b7bbc1' : '#8fa83f'}"/><circle cx="50" cy="16" r="5" fill="#fff" stroke="#111" stroke-width="1.5"/>
    <rect x="28" y="28" width="44" height="34" fill="${german ? '#f07f1e' : '#a6d6f3'}" stroke="#111" stroke-width="2.4"/><path d="M28 28 L72 62 M72 28 L28 62" stroke="#111" stroke-width="2.2"/>
    <text x="50" y="84" font-size="13" text-anchor="middle" font-family="Arial Narrow, Arial">${esc(name.replace('Garrison ', ''))}</text></svg>`;
}

/* ---------- asset and event chits, redrawn after the printed counters (160 x 160) ---------- */
import type { Chit } from '../../engine/src';
const CHIT_FRAME = { german: '#b8bbc0', allied: '#8a9a3a' };
const QDOT: Record<string, string> = { elite: '#d7262b', veteran: '#151515', green: '#ffffff' };
const NARROW = 'font-family="Arial Narrow, Arial, sans-serif"';
const lines = (s: string, max = 11): string[] => { const out: string[] = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; };
const planeSvg = (x: number, y: number, k: number, fill = '#6d7378') => `<g transform="translate(${x} ${y}) scale(${k})" fill="${fill}" stroke="#222" stroke-width="1"><path d="M-30 0 L22 -3 Q34 0 22 3 Z"/><path d="M-4 -2 L-14 -26 L-8 -26 L10 -2 Z"/><path d="M-4 2 L-14 26 L-8 26 L10 2 Z"/><path d="M-30 0 L-38 -9 L-33 -9 L-24 -1 Z"/><circle cx="18" cy="0" r="3" fill="#ddd"/></g>`;
const fit = (t: string, size: number, max: number) => ` textLength="${Math.min(t.length * size * 0.44, max).toFixed(1)}" lengthAdjust="spacingAndGlyphs"`;
const turnMark = (t: number | 'S', x = 8, y = 36, fill = '#111') => t === 'S' ? `<rect x="${x}" y="${y - 24}" width="24" height="28" fill="#fff"/><text x="${x + 12}" y="${y - 1}" font-size="26" font-weight="700" text-anchor="middle" ${NARROW} fill="#111">S</text>` : `<text x="${x}" y="${y}" font-size="30" font-weight="700" ${NARROW} fill="${fill}">${t}</text>`;
const barrels = () => [[52, 70], [82, 62], [110, 72]].map(([x, y]) => `<g><rect x="${x - 15}" y="${y}" width="30" height="36" rx="3" fill="#7d7468" stroke="#222" stroke-width="2"/><ellipse cx="${x}" cy="${y}" rx="15" ry="6" fill="#a39a8c" stroke="#222" stroke-width="2"/><path d="M${x - 15} ${y + 12} h30 M${x - 15} ${y + 26} h30" stroke="#222" stroke-width="2"/></g>`).join('');
const specialArrow = () => `<path d="M24 74 H78 V54 L116 80 L78 106 V86 H24 Z" fill="#ffe100" stroke="#111" stroke-width="3"/><path d="M80 66 L128 50 M80 80 H134 M80 94 L128 110" stroke="#111" stroke-width="7" stroke-linecap="round" fill="none"/><rect x="34" y="68" width="34" height="14" rx="3" fill="#2b6b2a" stroke="#111" stroke-width="2"/><rect x="44" y="62" width="14" height="8" fill="#2b6b2a" stroke="#111" stroke-width="2"/><path d="M58 64 h14" stroke="#111" stroke-width="2.5"/>`;

export function chitSvg(c: Chit) {
  const frame = CHIT_FRAME[c.side], ech = ECH[c.ech] ?? '#ccc', k = c.kind;
  const open = (bg: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><rect width="160" height="160" fill="${bg}"/>`;
  const panel = (fill: string) => `<rect x="14" y="14" width="132" height="132" fill="${fill}" stroke="#fff" stroke-width="4"/>`;
  const label = (fill: string, y0 = 102, max = 11, size = 21, weight = 400) => lines(c.name, max).map((l, i) => `<text x="80" y="${y0 + i * (size + 1)}" font-size="${size}" font-weight="${weight}" text-anchor="middle" ${NARROW} fill="${fill}"${fit(l, size, 112)}>${esc(l)}</text>`).join('');
  if (['artillery', 'rocket_artillery', 'engineer', 'armor_asset', 'infantry_asset'].includes(k)) {
    const sym = k === 'artillery' ? '<circle cx="80" cy="64" r="7" fill="#111"/>'
      : k === 'rocket_artillery' ? '<path d="M56 64 H102 M92 54 L104 64 L92 74" fill="none" stroke="#111" stroke-width="4"/>'
      : k === 'engineer' ? '<path d="M58 78 H102 V70 H96 V54 H88 V70 H84 V54 H76 V70 H72 V54 H64 V70 H58 Z" fill="#111"/>'
      : k === 'armor_asset' ? '<rect x="60" y="54" width="40" height="22" rx="11" fill="none" stroke="#111" stroke-width="4"/>'
      : '<path d="M44 28 L116 100 M116 28 L44 100" stroke="#111" stroke-width="3"/><path d="M52 90 q8 -16 16 0 t16 0 t16 0" fill="none" stroke="#111" stroke-width="3"/>';
    const bg = c.name.startsWith('v.d.') ? '#9fc5ee' : frame;
    return `${open(bg)}${turnMark(c.turn)}${c.q ? `<circle cx="104" cy="18" r="7" fill="${QDOT[c.q]}" stroke="#111" stroke-width="2"/>` : ''}
      <rect x="42" y="26" width="76" height="76" fill="${c.name.startsWith('v.d.') ? 'none' : ech}" stroke="#111" stroke-width="3.5"/>${c.name.startsWith('v.d.') ? '<text x="22" y="68" font-size="17" text-anchor="middle" ' + NARROW + ' fill="#111">31</text><text x="22" y="88" font-size="17" text-anchor="middle" ' + NARROW + ' fill="#111">52</text>' : ''}${sym}${label('#111', 132, 14, 22)}</svg>`;
  }
  if (k === 'replacement_inf' || k === 'replacement_arm' || k === 'rebuild_or_replace_inf' || k === 'rebuild_or_replace_arm') {
    const rebuild = k.startsWith('rebuild'), inf = k.endsWith('inf'), ink = rebuild ? '#1b2410' : '#2a0f29', fill = rebuild ? '#bfe18f' : ech;
    const s = inf ? `<rect x="58" y="28" width="44" height="26" fill="#fff" stroke="${ink}" stroke-width="3"/><path d="M58 28 L102 54 M102 28 L58 54" stroke="#111" stroke-width="2"/>` : `<rect x="58" y="30" width="44" height="22" rx="11" fill="#fff" stroke="#111" stroke-width="3"/>`;
    return `${open(frame)}${panel(fill)}${turnMark(c.turn, 22, 44)}${s}${label(ink, 86, 11, 24)}</svg>`;
  }
  if (k === 'command_staff') return `${open(frame)}<rect x="8" y="8" width="144" height="144" fill="#f07f1e"/>${turnMark(c.turn, 16, 44)}<text x="92" y="38" font-size="24" text-anchor="middle" ${NARROW} fill="#111" textLength="77.3" lengthAdjust="spacingAndGlyphs">Command</text><rect x="46" y="50" width="68" height="50" fill="none" stroke="#fff" stroke-width="4"/><text x="80" y="90" font-size="40" font-weight="700" text-anchor="middle" ${NARROW} fill="#fff">HQ</text><text x="80" y="130" font-size="22" text-anchor="middle" ${NARROW} fill="#111" textLength="111.3" lengthAdjust="spacingAndGlyphs">Staff Asset</text></svg>`;
  if (k === 'fuel') return `${open(frame)}${panel('#f07f1e')}${turnMark(c.turn, 22, 44)}${barrels()}<text x="96" y="118" font-size="30" font-weight="900" text-anchor="middle" ${NARROW} fill="#ffe100" stroke="#111" stroke-width="2" paint-order="stroke">Fuel</text><text x="88" y="138" font-size="20" font-weight="700" text-anchor="middle" ${NARROW} fill="#111">Asset</text></svg>`;
  if (k === 'special_action_event') return `${open(frame)}${panel('#8e2d82')}${turnMark(c.turn, 22, 44)}<text x="92" y="40" font-size="22" font-style="italic" font-weight="700" text-anchor="middle" ${NARROW} fill="#fff" textLength="70.8" lengthAdjust="spacingAndGlyphs">Special</text>${specialArrow()}<text x="92" y="132" font-size="22" font-style="italic" font-weight="700" text-anchor="middle" ${NARROW} fill="#fff" textLength="60.7" lengthAdjust="spacingAndGlyphs">Action</text></svg>`;
  if (k === 'air_mission') return `${open(frame)}<rect x="8" y="8" width="144" height="144" fill="#2a6fb5"/>${turnMark(c.turn, 16, 44, '#fff')}<text x="104" y="34" font-size="20" text-anchor="middle" ${NARROW} fill="#fff">Allied</text><rect x="16" y="46" width="128" height="52" fill="#bcd9f3"/>${planeSvg(100, 62, 1.1, '#8a9096')}${planeSvg(58, 84, 0.85, '#7d8379')}<text x="80" y="124" font-size="30" font-weight="900" text-anchor="middle" ${NARROW} fill="#fff" stroke="#222" stroke-width="1.5" paint-order="stroke">Air</text><text x="80" y="148" font-size="26" font-weight="900" text-anchor="middle" ${NARROW} fill="#fff" stroke="#222" stroke-width="1.5" paint-order="stroke" textLength="83.7" lengthAdjust="spacingAndGlyphs">Mission</text></svg>`;
  if (k === 'event_bodenplatte') return `${open(frame)}<rect x="8" y="8" width="144" height="144" fill="#cfe6f7" stroke="#fff" stroke-width="4"/>${turnMark(c.turn, 16, 44)}${planeSvg(100, 56, 1.1)}${planeSvg(52, 80, 0.9, '#5d6a52')}<text x="80" y="116" font-size="26" font-weight="900" text-anchor="middle" ${NARROW} fill="#fff" stroke="#222" stroke-width="1.8" paint-order="stroke" textLength="107.6" lengthAdjust="spacingAndGlyphs">Operation</text><text x="80" y="143" font-size="26" font-weight="900" text-anchor="middle" ${NARROW} fill="#fff" stroke="#222" stroke-width="1.8" paint-order="stroke" textLength="118" lengthAdjust="spacingAndGlyphs">Bodenplatte</text></svg>`;
  if (k === 'event_delayed_response') return `${open(frame)}${panel('#f07f1e')}${turnMark(c.turn, 22, 44)}<ellipse cx="82" cy="86" rx="56" ry="38" fill="#fff"/>${label('#111', 80, 9, 26)}</svg>`;
  if (k === 'event_greif_bridge') return `${open(frame)}${panel('#e0412e')}${turnMark(c.turn, 22, 44)}<path d="M30 70 H64 M54 60 L66 70 L54 80 M80 62 H128 M80 78 H128 M84 62 q22 16 44 0 M84 78 q22 -16 44 0" fill="none" stroke="#fff" stroke-width="3.5"/><text x="80" y="108" font-size="26" font-weight="900" text-anchor="middle" ${NARROW} fill="#111" textLength="118" lengthAdjust="spacingAndGlyphs">Greif Team</text><text x="80" y="134" font-size="24" text-anchor="middle" ${NARROW} fill="#fff" textLength="66.2" lengthAdjust="spacingAndGlyphs">Bridge</text></svg>`;
  if (k === 'event_greif_interdict') return `${open(frame)}${panel('#e0412e')}${turnMark(c.turn, 22, 44)}<text x="98" y="72" font-size="52" font-weight="700" text-anchor="middle" ${NARROW} fill="#fff">?</text><text x="80" y="108" font-size="26" font-weight="900" text-anchor="middle" ${NARROW} fill="#111" textLength="118" lengthAdjust="spacingAndGlyphs">Greif Team</text><text x="80" y="134" font-size="24" text-anchor="middle" ${NARROW} fill="#fff" textLength="99.4" lengthAdjust="spacingAndGlyphs">Interdict</text></svg>`;
  if (k === 'event_arriving_regiment') return `${open(frame)}${panel('#bfe18f')}${turnMark(c.turn, 22, 44)}<text x="86" y="40" font-size="14" text-anchor="middle" ${NARROW} fill="#111">III</text><rect x="64" y="46" width="44" height="26" fill="#fff" stroke="#111" stroke-width="3"/><path d="M64 46 L108 72 M108 46 L64 72" stroke="#111" stroke-width="2"/>${label('#111', 100, 12, 22)}</svg>`;
  if (k === 'event_release') return `${open(frame)}${panel('#f07f1e')}${turnMark(c.turn, 22, 44)}${label('#111', 74, 10, 28)}</svg>`;
  return `${open(frame)}${panel(ech)}${turnMark(c.turn, 22, 44)}${label('#111', 90)}</svg>`;
}
