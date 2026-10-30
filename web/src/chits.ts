// Asset and event chits redrawn from the printed counters: geometry measured on the scan, lettering as outlined Roboto Condensed paths, and the
// illustrated parts (fuel, Bodenplatte, Air Mission, the Special Action arrow) cut out of the scan itself. 160 x 160 units, like the 160 px raw counters.
import type { Chit } from '../../engine/src';
import { ECH } from './art';
import { GLYPHS } from './glyphs';
import { CHIT_ART } from './chit-art';

type Weight = 'r' | 'b';
/** Outlined text: `size` is the font size in units, `max` squeezes the line horizontally to fit, anchor is the x position meaning. */
function txt(s: string, x: number, y: number, size: number, o: { w?: Weight; anchor?: 'start' | 'middle' | 'end'; fill?: string; max?: number; italic?: boolean; stroke?: string } = {}) {
  const set = GLYPHS[o.w ?? 'r'], k = size / 1000; let pen = 0, d = '';
  for (const ch of s) { const g = set[ch] ?? set['?']; if (g[1]) d += `<path transform="translate(${pen} 0)" d="${g[1]}"/>`; pen += g[0]; }
  const width = pen * k, sq = o.max && width > o.max ? o.max / width : 1, w = width * sq, ox = o.anchor === 'end' ? -w : o.anchor === 'middle' ? -w / 2 : 0;
  const skew = o.italic ? ' skewX(-12)' : '';
  return `<g transform="translate(${(x + ox).toFixed(2)} ${y}) scale(${(k * sq).toFixed(5)} ${k})${skew}" fill="${o.fill ?? '#111'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${60}" paint-order="stroke" stroke-linejoin="round"` : ''}>${d}</g>`;
}
const FRAME = { german: ['#b9bcc4', '#d9dbe0', '#8e919a'], allied: ['#7d8d2b', '#9aa944', '#5d6a1f'] };
const open = (c: Chit, bg = FRAME[c.side]) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><rect width="160" height="160" fill="${bg[0]}"/><path d="M0 0H160L156 4H4V156L0 160Z" fill="${bg[1]}"/><path d="M160 160H0L4 156H156V4L160 0Z" fill="${bg[2]}"/>`;
const turn = (t: number | 'S', x: number, y: number, size: number, fill = '#111') => t === 'S'
  ? `<rect x="${x}" y="${y - 24}" width="22" height="30" fill="#fff"/>${txt('S', x + 11, y + 1, 29, { w: 'b', anchor: 'middle' })}`
  : txt(String(t), x, y, size, { w: 'b', fill });
const panel = (fill: string) => `<rect x="10" y="15" width="137" height="141" fill="#fff"/><rect x="13" y="18" width="131" height="135" fill="${fill}"/>`;
const sq = (fill: string, x = 44, y = 45, w = 73, h = 74) => `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" fill="${fill}" stroke="#0b0b10" stroke-width="3.2"/>`;
const SPLIT: Record<string, string[]> = { 'Non-Elite Inf Repl': ['Non-Elite', 'Inf Repl'], 'Non-Elite Arm Repl': ['Non-Elite', 'Arm Repl'], 'Non-Elite Rebuild or Repl': ['Non-Elite', 'Rebuild or', 'Repl'],
  '11th Pz Div Released': ['11th', 'Pz Div', 'Released'], 'Delayed Response': ['Delayed', 'Response'], 'Regt Only For 4th Inf Div': ['Regt only for', '4th Inf Div'], 'Regt Only For 1st Inf Div': ['Regt only for', '1st Inf Div'] };
const SPLIT_LC = Object.fromEntries(Object.entries(SPLIT).map(([k, v]) => [k.toLowerCase(), v]));
const wrap = (name: string) => SPLIT_LC[name.toLowerCase()] ?? (name.length > 12 ? name.split(/ (.+)/).filter(Boolean) : [name]);
const QDOT: Record<string, [string, string]> = { elite: ['#d7262b', '#fff'], veteran: ['#101014', ''], green: ['#fff', '#8a8d95'] };

/** Garrison asset (area number in a white box) or Task Force (turn and star), the light-blue X square on an olive chit. */
export function garrisonChit(label: string, num: string, boxed = true) {
  return `${open({ side: 'allied' } as Chit)}${boxed ? `<rect x="14" y="17" width="21" height="38" fill="#fff"/><g transform="translate(30 50) rotate(-90)">${txt(num, 0, 0, 21, { w: 'r' })}</g>` : `<g transform="translate(31 55) rotate(-90)">${txt(num, 0, 0, 24, { w: 'r' })}</g>`}<circle cx="82" cy="22" r="8.5" fill="#fff" stroke="#8d9068" stroke-width="1.6"/>${sq('#8ec3ea', 46, 40, 73, 73)}<path d="M47.5 41.5L117.5 111.5M117.5 41.5L47.5 111.5" stroke="#0b0b10" stroke-width="3"/>${txt(label, 82, 143, 23, { anchor: 'middle', max: 100 })}</svg>`;
}
export function chitSvg(c: Chit): string {
  const ech = ECH[c.ech] ?? '#bbb', k = c.kind, name = c.name;
  const dot = (cx: number, cy: number) => { const [f, ring] = QDOT[c.q ?? 'veteran']; return c.q ? `${ring ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="${ring}"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${ring ? 8 : 7.5}" fill="${f}"/>` : ''; };
  if (['artillery', 'rocket_artillery', 'engineer', 'armor_asset'].includes(k)) {
    const sym = k === 'artillery' ? '<circle cx="80.5" cy="83" r="8.6" fill="#0b0b10"/>'
      : k === 'rocket_artillery' ? '<path d="M56 80 H103" stroke="#0b0b10" stroke-width="3.6"/><path d="M96 70 L109 80 L96 90 Z" fill="#0b0b10"/>'
      : k === 'engineer' ? '<path d="M67 75H100V81H67ZM67 81H71.6V93H67ZM81 81H87.4V88H81ZM95 81H100V93H95Z" fill="#0b0b10"/>'
      : '<rect x="57" y="65" width="48" height="33" rx="16.5" fill="none" stroke="#0b0b10" stroke-width="3.4"/>';
    const y0 = k === 'armor_asset' ? 38 : 46;
    return `${open(c)}${turn(c.turn, 14, 36, 33)}${sq(ech, 44, y0, 73, 74)}${k === 'engineer' ? '' : ''}${sym.replace(/ y="/g, ' y="')}${dot(81, y0 - 17)}${txt(name, 81, 149, 23, { anchor: 'middle', max: 104 })}</svg>`;
  }
  if (k === 'infantry_asset') {                                                    // v.d. Heydte: airborne, light-blue chit
    return `${open(c, ['#8fb7e3', '#b3d0ee', '#6f97c4'])}${turn(c.turn, 14, 36, 33)}${txt('31', 14, 66, 17)}${txt('52', 14, 86, 17)}<circle cx="82" cy="17" r="7" fill="#0b0b10"/>${sq('#8e2d82', 46, 33, 73, 77)}<path d="M48 35L117 108M117 35L48 108" stroke="#0b0b10" stroke-width="2.4"/><path d="M57 84C64 76 73 75 79 83L81 97L83 83C89 75 98 76 105 84" fill="none" stroke="#0b0b10" stroke-width="2.6" stroke-linecap="round"/>${txt('v.d.Heydte', 81, 143, 22, { anchor: 'middle', max: 100 })}</svg>`;
  }
  if (k === 'task_force') return garrisonChit('Task Force', `${c.turn}-*`, false);
  if (k === 'replacement_inf' || k === 'replacement_arm' || k === 'rebuild_or_replace_inf' || k === 'rebuild_or_replace_arm') {
    const rebuild = k.startsWith('rebuild'), inf = k.endsWith('inf'), ink = rebuild ? '#1c2b0d' : '#2c0c2a', fill = rebuild ? '#a9d37a' : ech, ls = wrap(name), n = ls.length;
    const sym = inf ? `<rect x="61" y="40" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/><path d="M61 40L104 69M104 40L61 69" stroke="#111" stroke-width="1.6"/>` : `<rect x="61" y="40" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/><rect x="68" y="46" width="29" height="17" rx="8.5" fill="none" stroke="#111" stroke-width="1.8"/>`;
    return `${open(c)}${panel(fill)}${turn(c.turn, 22, 52, 32)}${sym}${ls.map((l, i) => txt(l, 82, (n === 2 ? 99 : 94) + i * (n === 2 ? 28 : 24), n === 2 ? 27 : 23, { anchor: 'middle', fill: ink, max: 108 })).join('')}</svg>`;
  }
  if (k === 'command_staff') return `${open(c, ['#f07a17', '#f89a47', '#c25d0a'])}${turn(c.turn, 12, 51, 33)}${txt('Command', 36, 42, 25, { max: 99 })}<rect x="48" y="55" width="66" height="64" fill="none" stroke="#fff" stroke-width="4.6"/>${txt('HQ', 81, 102, 46, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt('Staff Asset', 82, 150, 26, { anchor: 'middle', max: 104 })}</svg>`;
  if (k === 'fuel') return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><image href="${CHIT_ART.fuel}" width="160" height="160"/></svg>`;
  if (k === 'event_bodenplatte') return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><image href="${CHIT_ART.boden}" width="160" height="160"/></svg>`;
  if (k === 'air_mission') return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><image href="${CHIT_ART.air}" width="160" height="160"/><rect x="14" y="26" width="22" height="26" fill="${CHIT_ART.airSky}"/>${turn(c.turn, 15, 52, 33)}</svg>`;
  if (k === 'special_action_event') {
    const dark = ['#4d5b2c', '#8e2d82', '#3d6dcc'].includes(ech) || ech === '#4d5b2c';
    return `${open(c)}${panel(ech)}${turn(c.turn, 22, 52, 32)}${txt('Special', 86, 44, 26, { w: 'b', italic: true, anchor: 'middle', fill: dark ? '#fff' : '#111', max: 78 })}<image href="${CHIT_ART.saArrow}" x="18" y="52" width="130" height="72"/>${txt('Action', 86, 147, 26, { w: 'b', italic: true, anchor: 'middle', fill: dark ? '#fff' : '#111', max: 78 })}</svg>`;
  }
  if (k === 'event_greif_bridge') return `${open(c)}${panel('#e8412b')}${turn(c.turn, 22, 52, 32)}<path d="M22 66H59" stroke="#fff" stroke-width="3.4"/><path d="M52 58L71 66L52 74Z" fill="#fff"/><path d="M78 60Q80 54 86 54H117Q122 54 126 51M78 74Q80 71 86 71H117Q122 71 126 77" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>${txt('Greif Team', 81, 114, 29, { w: 'b', anchor: 'middle', max: 108 })}${txt('Bridge', 81, 145, 30, { anchor: 'middle', max: 108 })}</svg>`;
  if (k === 'event_greif_interdict') return `${open(c)}${panel('#e8412b')}${turn(c.turn, 22, 52, 32)}${txt('?', 76, 77, 66, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt('Greif Team', 81, 114, 29, { w: 'b', anchor: 'middle', max: 108 })}${txt('Interdict', 81, 145, 30, { anchor: 'middle', max: 108 })}</svg>`;
  if (k === 'event_delayed_response') return `${open(c)}${panel('#f07a17')}<ellipse cx="82" cy="100" rx="46" ry="44" fill="#fff"/>${turn(c.turn, 22, 52, 32)}${txt('Delayed', 84, 85, 31, { anchor: 'middle', max: 100 })}${txt('Response', 82, 128, 31, { anchor: 'middle', max: 108 })}</svg>`;
  if (k === 'event_arriving_regiment') return `${open(c)}${panel('#a9d37a')}${turn(c.turn, 22, 52, 32)}${txt('III', 79, 46, 14, { w: 'b', anchor: 'middle', max: 22 })}<rect x="57" y="53" width="44" height="26" fill="#fff" stroke="#111" stroke-width="2.4"/><path d="M57 53L101 79M101 53L57 79" stroke="#111" stroke-width="1.6"/>${wrap(name).map((l, i) => txt(l, 81, 107 + i * 28, 22, { anchor: 'middle', fill: '#1c2b0d', max: 108 })).join('')}</svg>`;
  if (k === 'event_release') { const ls = wrap(name); return `${open(c, FRAME.german)}${panel('#f07a17')}${turn(c.turn, 22, 52, 32)}${ls.map((l, i) => txt(l, 82, 66 + i * 35, 33, { anchor: 'middle', max: 106 })).join('')}</svg>`; }
  return `${open(c)}${panel(ech)}${turn(c.turn, 22, 52, 32)}${wrap(name).map((l, i) => txt(l, 82, 94 + i * 26, 23, { anchor: 'middle', max: 108 })).join('')}</svg>`;
}
