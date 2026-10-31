// Counters redrawn from the printed ones: geometry measured on the scans, lettering as outlined Roboto Condensed paths, and the illustrations
// (fuel barrels, fighters, the Special Action arrow) cut out of the scan. 160 x 160 units like the 160 px raw counters.
import type { Chit } from '../../engine/src';
import { ECH } from './art';
import { GLYPHS } from './glyphs';
import { CHIT_FILES, CHIT_BOXES } from './chit-art';

/** Image data URIs by name (the cut-outs must be inline: an SVG shown as an <img> cannot load other files), filled by loadChitArt before any chit is drawn. */
export const CHIT_ART = { ...CHIT_BOXES } as unknown as { [K in keyof typeof CHIT_BOXES]: readonly number[] } & Record<keyof typeof CHIT_FILES, string>;
const blobUri = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => bad(r.error); r.readAsDataURL(b); });
export async function loadChitArt(base = './chit/') {
  await Promise.all(Object.entries(CHIT_FILES).map(async ([k, f]) => { const r = await fetch(base + f); if (!r.ok) throw new Error(`chit art ${f}: ${r.status}`); (CHIT_ART as Record<string, string>)[k] = await blobUri(await r.blob()); }));
}
/** For tools that read the files themselves: key -> data URI. */
export const setChitArt = (m: Record<string, string>) => Object.assign(CHIT_ART, m);

type Weight = 'r' | 'b';
function txt(s: string, x: number, y: number, size: number, o: { w?: Weight; anchor?: 'start' | 'middle' | 'end'; fill?: string; max?: number; italic?: boolean; stroke?: string; sw?: number; rot?: number } = {}) {
  const set = GLYPHS[o.w ?? 'r'], k = size / 1000; let pen = 0, d = '';
  for (const ch of s) { const g = set[ch] ?? set['?']; if (g[1]) d += `<path transform="translate(${pen} 0)" d="${g[1]}"/>`; pen += g[0]; }
  const width = pen * k, sq = o.max && width > o.max ? o.max / width : 1, w = width * sq, ox = o.anchor === 'end' ? -w : o.anchor === 'middle' ? -w / 2 : 0;
  const skew = o.italic ? ' skewX(-12)' : '', rot = o.rot ? ` rotate(${o.rot})` : '';
  return `<g transform="translate(${x} ${y})${rot}"><g transform="translate(${ox.toFixed(2)} 0) scale(${(k * sq).toFixed(5)} ${k})${skew}" fill="${o.fill ?? '#111'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 60}" paint-order="stroke" stroke-linejoin="round"` : ''}>${d}</g></g>`;
}
const BRIT = ['#d9b374', '#ebcb93', '#b08f55'];
const FRAME = { german: ['#b9bcc4', '#d9dbe0', '#8e919a'], allied: ['#7d8d2b', '#9aa944', '#5d6a1f'] };
const open = (side: 'german' | 'allied', bg = FRAME[side]) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><rect width="160" height="160" fill="${bg[0]}"/><path d="M0 0H160L156 4H4V156L0 160Z" fill="${bg[1]}"/><path d="M160 160H0L4 156H156V4L160 0Z" fill="${bg[2]}"/>`;
const flat = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><rect width="160" height="160" fill="${fill}"/>`;
const turn = (t: number | 'S' | string | null | undefined, x: number, y: number, size: number, fill = '#111') => t == null ? '' : t === 'S'
  ? `<rect x="${x}" y="${y - 24}" width="22" height="30" fill="#fff"/>${txt('S', x + 11, y + 1, 29, { w: 'b', anchor: 'middle' })}`
  : txt(String(t), x, y, size, { w: 'b', fill });
const SHIFT = '<g transform="translate(1.5 -5.5)">';                           // the printed panels sit 5.5 units high on the scan crop; centre them on the chit
const panel = (fill: string) => `${SHIFT}<rect x="10" y="15" width="137" height="141" fill="#fff"/><rect x="13" y="18" width="131" height="135" fill="${fill}"/>`;
const CX = 80, CY = 77;                                                          // centre of the unit square on asset chits
const square = (fill: string, cy = CY, s = 68) => `<rect x="${CX - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${fill}" stroke="#0b0b10" stroke-width="3.4"/>`;
const INK = '#0b0b10';
const SPLIT: Record<string, string[]> = { 'non-elite inf repl': ['Non-Elite', 'Inf Repl'], 'non-elite arm repl': ['Non-Elite', 'Arm Repl'], 'non-elite rebuild or repl': ['Non-Elite', 'Rebuild or', 'Repl'],
  '11th pz div released': ['11th', 'Pz Div', 'Released'], '10th ss pz div released': ['10th SS', 'Pz Div', 'Released'], '17th ss pz gr div released': ['17th SS', 'Pz Gr Div', 'Released'], '6th ss mtn div released': ['6th SS', 'Mtn Div', 'Released'],
  'delayed response': ['Delayed', 'Response'], 'regt only for 4th inf div': ['Regt only for', '4th Inf Div'], 'regt only for 1st inf div': ['Regt only for', '1st Inf Div'] };
const wrap = (name: string) => SPLIT[name.toLowerCase()] ?? (name.length > 12 ? name.split(/ (.+)/).filter(Boolean) : [name]);
const QDOT: Record<string, [string, string]> = { elite: ['#d7262b', '#fff'], veteran: ['#101014', ''], green: ['#fff', '#8a8d95'] };
/** The German Balkenkreuz: black cross with flared arms and a white border. r is the half-length of an arm. */
const cross = (x: number, y: number, r: number, fill = '#0d0d0f', edge = '#fff') => { const a = r * 0.2, b = r * 0.34, p = [[-a, -a], [-b, -r], [b, -r], [a, -a], [r, -b], [r, b], [a, a], [b, r], [-b, r], [-a, a], [-r, b], [-r, -b]].map(([u, v]) => `${(x + u).toFixed(1)} ${(y + v).toFixed(1)}`).join('L'); return `<path d="M${p}Z" fill="${edge}" stroke="${edge}" stroke-width="${(r * 0.26).toFixed(1)}" stroke-linejoin="round"/><path d="M${p}Z" fill="${fill}"/>`; };
const star = (x: number, y: number, r: number, fill = '#fff') => `<path d="M${Array.from({ length: 10 }, (_, i) => `${(x + (i % 2 ? r * .4 : r) * Math.sin(i * Math.PI / 5)).toFixed(1)} ${(y - (i % 2 ? r * .4 : r) * Math.cos(i * Math.PI / 5)).toFixed(1)}`).join('L')}Z" fill="${fill}"/>`;
const img = (href: string, x = 0, y = 0, w = 160, h = 160) => `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const asBox = (b: readonly number[]) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });

/** Garrison asset (area number in a white box) or Task Force (turn and star): the light-blue X square on an olive chit. */
export function garrisonChit(label: string, num: string, boxed = true, dotFill = '#fff') {
  return `${open('allied')}${boxed ? `<rect x="14" y="17" width="21" height="38" fill="#fff"/>${txt(num, 30, 51, 21, { rot: -90 })}` : txt(num, 31, 55, 24, { w: 'r', rot: -90 })}<circle cx="82" cy="19" r="8.5" fill="${dotFill}" stroke="#8d9068" stroke-width="1.6"/>${square('#8ec3ea', CY + 2, 70)}<path d="M${CX - 35} ${CY + 2 - 35}L${CX + 35} ${CY + 2 + 35}M${CX + 35} ${CY + 2 - 35}L${CX - 35} ${CY + 2 + 35}" stroke="${INK}" stroke-width="3"/>${txt(label, 82, 141, 23, { anchor: 'middle', max: 100 })}</svg>`;
}


const MK = (inner: string, bg = '#0b0b10') => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 160 160"><rect width="160" height="160" fill="${bg}"/>${inner}</svg>`;
const outl = (str: string, x: number, y: number, size: number, o: { fill?: string; rot?: number; max?: number } = {}) => txt(str, x, y, size, { w: 'b', anchor: 'middle', fill: o.fill ?? '#fff', stroke: '#1b1b18', sw: 120, rot: o.rot, max: o.max });
const ARROW = (fill: string, rot = 0, cx = 80, cy = 80, k = 1) => `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${k})"><path d="M-48 -13H14V-30L50 0L14 30V13H-48Z" fill="${fill}" stroke="#2a1a10" stroke-width="2.2" stroke-linejoin="round"/></g>`;
function marker(name: string): string | null {
  switch (name) {
    case 'Field Works': {                                              // the brown toothed ring on a pale tile
      const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="-6" y="-46" width="12" height="16" rx="1" fill="#7a4636" transform="rotate(${i * 45})"/>`).join('');
      return MK(`<rect x="6" y="6" width="148" height="148" fill="#ecdcd6" stroke="#cfb9b0" stroke-width="2"/><g transform="translate(80 80)">${teeth}<circle r="29" fill="none" stroke="#7a4636" stroke-width="10"/></g>`, '#d7c4bc');
    }
    case 'Blown Bridge': return MK(`<rect x="12" y="12" width="136" height="136" fill="#d8301c"/><path d="${Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 30 : 62, a = i * Math.PI / 12; return `${i ? 'L' : 'M'}${(80 + r * Math.cos(a)).toFixed(1)} ${(84 + r * Math.sin(a) * .8).toFixed(1)}`; }).join('')}Z" fill="#f59a1c"/><circle cx="80" cy="84" r="26" fill="#f8d23a"/><path d="M36 112L68 90L80 100L96 88L124 112Z" fill="#2a1a10"/><circle cx="62" cy="80" r="2" fill="#2a1a10"/><circle cx="98" cy="78" r="2" fill="#2a1a10"/>${outl('Blown', 80, 44, 36, { fill: '#e8d6c8', max: 112 })}${outl('Bridge', 80, 138, 34, { fill: '#cfc6cf', max: 112 })}`);
    case 'Road Block': return MK(`<rect x="8" y="8" width="144" height="144" fill="#b2561d"/><rect x="18" y="18" width="124" height="124" fill="#fff"/><path d="M18 78H142V142H18Z" fill="#b4c84a"/><path d="M18 100H142V142H18Z" fill="#d6b840"/><g fill="#fff" stroke="#c4311c" stroke-width="3" stroke-linejoin="round"><path d="M34 100L48 72L62 100Z"/><path d="M66 100L80 72L94 100Z"/><path d="M98 100L112 72L126 100Z"/></g><rect x="54" y="104" width="52" height="12" fill="#222"/>${outl('Road', 80, 56, 38, { max: 100 })}${outl('Block', 80, 134, 38, { max: 100 })}`, '#c8d1c4');
    case 'No Fuel': { const b = asBox(CHIT_ART.fuelBox); return MK(`<rect x="8" y="8" width="144" height="144" fill="#c9cbcf"/><g opacity=".75">${img(CHIT_ART.fuel, 24, 28, 112, 92)}</g><circle cx="80" cy="76" r="54" fill="none" stroke="#d3262a" stroke-width="13"/><path d="M42 114L118 38" stroke="#d3262a" stroke-width="13"/>`, '#dfe0e2'); void b; }
    case 'Exploitation': { const t = asBox(CHIT_ART.tankBox); return MK(`<rect x="4" y="4" width="152" height="152" fill="#dd4a22"/><rect x="14" y="14" width="132" height="132" fill="#dcdee2"/><path d="M14 98H146V146H14Z" fill="#b3bdd1"/>${ARROW('#e0452a', -14, 96, 112, 1.05)}<image href="${CHIT_ART.tank}" x="${t.x}" y="${t.y + 1}" width="${t.w}" height="${t.h}"/>${txt('Exploitation', 80, 64, 31, { w: 'b', anchor: 'middle', fill: '#f2de2a', stroke: '#16140a', sw: 110, max: 124 })}`, '#e0541f'); }
    case 'River Assault': return MK(`<image href="${CHIT_ART.artRiver}" x="11" y="11" width="138" height="138"/>`, '#efe9b4');
    case 'Boundary Crossing': return MK(`<image href="${CHIT_ART.artBoundary}" x="11" y="11" width="138" height="138"/>`, '#1c2828');
    case 'Remaining German Bridge Repairs': return MK(`<image href="${CHIT_ART.artBridge}" x="11" y="11" width="138" height="138"/>`, '#8b9196');
  }
  return null;
}

/** The printed marker art by short code used on the map: X blown bridge, FW field works, RA river assault, RB road block, DIS disordered, REC recovering. */
export const mapMarkerSvg = (code: string): string | null => {
  const m: Record<string, string> = { X: 'Blown Bridge', FW: 'Field Works', RA: 'River Assault', RB: 'Road Block' };
  if (m[code]) return marker(m[code]);
  const counters: Record<string, Counter> = {
    DIS: { kind: 'marker', name: 'Disordered / Recovering', side: 'none', ech: 'none' }, REC: { id: 'back_recovering', kind: 'back', name: 'Recovering', side: 'none', ech: 'none' },
    E: { kind: 'marker', name: 'Exploitation', side: 'none', ech: 'none' }, B: { kind: 'marker', name: 'Boundary Crossing', side: 'german', ech: 'german' }, P: { id: 'back_pooled', kind: 'back', name: 'Pooled Assets', side: 'none', ech: 'none' },
    R5: { kind: 'reserve_marker', name: 'Zone 5 Reserve Unit', side: 'german', ech: 'german' }, R6: { kind: 'reserve_marker', name: 'Zone 6 Reserve Unit', side: 'german', ech: 'german' }, R7: { kind: 'reserve_marker', name: 'Zone 7 Reserve Unit', side: 'german', ech: 'german' },
    A7: { kind: 'reserve_marker', name: 'Zone 7 Reserve Unit', side: 'allied', ech: 'allied' }, A56: { kind: 'reserve_marker', name: 'Zones 5/6 Reserve Unit', side: 'allied', ech: 'allied' },
    GI: { kind: 'event_greif_interdict', name: 'Greif Team Interdict', side: 'german', ech: 'german', turn: 2 }, G: { kind: 'event_greif_bridge', name: 'Greif Team Bridge', side: 'german', ech: 'german', turn: 2 },
    AIR: { kind: 'air_mission', name: 'Air Mission', side: 'allied', ech: 'allied', turn: 6 }, AS: { kind: 'air_mission', name: 'Air Mission', side: 'allied', ech: 'allied', turn: 6 },
  };
  return counters[code] ? chitSvg(counters[code]) : null;
};

export type Counter = { id?: string; kind: string; name: string; side: 'german' | 'allied' | 'none'; ech: string; turn?: number | 'S' | null; q?: string | null };
export function chitSvg(c: Chit | Counter): string {
  const k = c.kind, name = c.name, ech = ECH[c.ech] ?? '#bbb', side = c.side === 'german' ? 'german' : 'allied', t = (c as Counter).turn ?? null, q = c.q ?? undefined;
  const dot = (cx: number, cy: number) => { if (!q) return ''; const [f, ring] = QDOT[q]; return `${ring ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="${ring}"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${ring ? 8 : 7.5}" fill="${f}"/>`; };
  const unit = (sym: string, fill = ech, bg?: string[]) => `${open(side, (c.ech === 'br_xxx' ? BRIT : bg) as never)}${turn(t, 14, 36, 33)}${dot(CX, 17)}${square(fill)}${sym}${txt(name, CX, 143, 23, { anchor: 'middle', max: 104 })}</svg>`;
  if (k === 'artillery') return unit(`<circle cx="${CX}" cy="${CY}" r="7.3" fill="${INK}"/>`);
  if (k === 'rocket_artillery') return unit(`<path d="M${CX - 24} ${CY}H${CX + 18}" stroke="${INK}" stroke-width="3.4"/><path d="M${CX + 12} ${CY - 9.5}L${CX + 25} ${CY}L${CX + 12} ${CY + 9.5}Z" fill="${INK}"/>`);
  if (k === 'engineer') return unit(`<path d="M${CX - 17} ${CY - 9}H${CX + 17}V${CY - 3.5}H${CX - 17}ZM${CX - 17} ${CY - 3.5}H${CX - 11.5}V${CY + 9}H${CX - 17}ZM${CX - 3} ${CY - 3.5}H${CX + 3}V${CY + 4}H${CX - 3}ZM${CX + 11.5} ${CY - 3.5}H${CX + 17}V${CY + 9}H${CX + 11.5}Z" fill="${INK}"/>`);
  if (k === 'armor_asset') return unit(`<rect x="${CX - 26.5}" y="${CY - 17}" width="53" height="34" rx="17" fill="none" stroke="${INK}" stroke-width="3.4"/>`);
  if (k === 'infantry_asset') {
    const bird = name.startsWith('v.d.') || name.startsWith('509'), bg = name.startsWith('v.d.') ? ['#8fb7e3', '#b3d0ee', '#6f97c4'] : undefined;
    const x = `<path d="M${CX - 34} ${CY - 34}L${CX + 34} ${CY + 34}M${CX + 34} ${CY - 34}L${CX - 34} ${CY + 34}" stroke="${INK}" stroke-width="2.4"/>`, b = bird ? `<path d="M${CX - 24} ${CY + 8}C${CX - 17} ${CY - 1} ${CX - 8} ${CY - 2} ${CX - 2} ${CY + 6}L${CX} ${CY + 18}L${CX + 2} ${CY + 6}C${CX + 8} ${CY - 2} ${CX + 17} ${CY - 1} ${CX + 24} ${CY + 8}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` : '';
    const extra = name.startsWith('v.d.') ? `${txt('31', 14, 66, 17)}${txt('52', 14, 86, 17)}` : '';
    return `${open(side, bg as never)}${turn(t, 14, 36, 33)}${extra}${dot(CX, 17)}${square(ech)}${x}${b}${txt(name, CX, 143, 23, { anchor: 'middle', max: 104 })}</svg>`;
  }
  if (k === 'task_force') return garrisonChit('Task Force', `${t}-*`, false);
  if (k === 'garrison') return garrisonChit(name.replace('Garrison ', ''), String((c as Counter).id === 'L96' ? 38 : (c as Counter).id === 'L97' ? 23 : (c as Counter).id === 'L106' ? 32 : 47));
  if (k === 'replacement_inf' || k === 'replacement_arm' || k === 'rebuild_or_replace_inf' || k === 'rebuild_or_replace_arm') {
    const rebuild = k.startsWith('rebuild'), inf = k.endsWith('inf'), ink = rebuild ? '#1c2b0d' : '#2c0c2a', fill = rebuild ? '#a9d37a' : ech, ls = wrap(name), n = ls.length;
    const sym = inf ? `<rect x="61" y="40" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/><path d="M61 40L104 69M104 40L61 69" stroke="#111" stroke-width="1.6"/>` : `<rect x="61" y="40" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/><rect x="68" y="46" width="29" height="17" rx="8.5" fill="none" stroke="#111" stroke-width="1.8"/>`;
    return `${open(side)}${panel(fill)}${turn(t, 22, 52, 32)}${sym}${ls.map((l, i) => txt(l, 82, (n === 2 ? 99 : 94) + i * (n === 2 ? 28 : 24), n === 2 ? 27 : 23, { anchor: 'middle', fill: ink, max: 108 })).join('')}</g></svg>`;
  }
  if (k === 'command_staff') return `${open(side, ['#f07a17', '#f89a47', '#c25d0a'])}<g transform="translate(0 -4)">${turn(t, 12, 51, 33)}${txt('Command', 36, 42, 25, { max: 99 })}<rect x="48" y="55" width="66" height="64" fill="none" stroke="#fff" stroke-width="4.6"/>${txt('HQ', 81, 102, 46, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt('Staff Asset', 82, 150, 26, { anchor: 'middle', max: 104 })}</g></svg>`;
  if (k === 'fuel' || k === 'fuel_bid') {
    const b = asBox(CHIT_ART.fuelBox), captured = name.startsWith('Captured'), bid = k === 'fuel_bid';
    return `${open(side, ['#f07a17', '#f89a47', '#c25d0a'])}${bid ? txt('Bid', 14, 34, 26, { w: 'b' }) : ''}${captured ? txt('Captured', 80, 24, 23, { anchor: 'middle', max: 100 }) : ''}${img(CHIT_ART.fuel, b.x + 2, b.y + 6, b.w * 1.12, b.h * 1.12)}${txt('Fuel', 100, 112, 38, { w: 'b', anchor: 'middle', fill: '#ffe100', stroke: '#111', sw: 90, max: 84 })}${txt('Asset', 83, 146, 27, { w: 'b', anchor: 'middle', max: 76 })}</svg>`;
  }
  if (k === 'event_bodenplatte') { const b = asBox(CHIT_ART.bodenBox); return `${open(side, ['#9fcff0', '#c4e3f7', '#78a8cc'])}${turn(t, 14, 38, 32)}${img(CHIT_ART.boden, b.x, b.y + 2, b.w, b.h)}${txt('Operation', 80, 118, 31, { w: 'b', anchor: 'middle', fill: '#fff', stroke: '#222', sw: 130, max: 128 })}${txt('Bodenplatte', 80, 148, 31, { w: 'b', anchor: 'middle', fill: '#fff', stroke: '#222', sw: 130, max: 128 })}</svg>`; }
  if (k === 'air_mission') { const b = asBox(CHIT_ART.airBox); return `${flat('#1f5db0')}<rect x="8" y="8" width="144" height="144" fill="#9fcff0" stroke="#fff" stroke-width="3"/>${turn(t, 16, 44, 32)}${txt('Allied', 98, 36, 22, { anchor: 'middle' })}${img(CHIT_ART.air, b.x + 2, b.y + 8, b.w, b.h)}${txt('Air', 14, 112, 36, { w: 'b', fill: '#fff', stroke: '#222', sw: 130 })}${txt('Mission', 14, 144, 36, { w: 'b', fill: '#fff', stroke: '#222', sw: 130, max: 130 })}</svg>`; }
  if (k === 'special_action_event') {
    const dark = ['#4d5b2c', '#8e2d82', '#3d6dcc'].includes(ech), f = dark ? '#fff' : '#111';
    return `${open(side)}${panel(ech)}${turn(t, 22, 52, 32)}${txt('Special', 86, 44, 26, { w: 'b', italic: true, anchor: 'middle', fill: f, max: 78 })}<image href="${CHIT_ART.saArrow}" x="18" y="52" width="130" height="72"/>${txt('Action', 86, 147, 26, { w: 'b', italic: true, anchor: 'middle', fill: f, max: 78 })}</g></svg>`;
  }
  if (k === 'event_greif_bridge') return `${open(side)}${panel('#e8412b')}${turn(t, 22, 52, 32)}<path d="M20 69H54" stroke="#fff" stroke-width="2.4"/><path d="M50 62L62 69L50 76Z" fill="#fff"/><path d="M76 61Q80 64 86 64H112Q118 64 122 61M76 76Q80 73 86 73H112Q118 73 122 76" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>${txt('Greif Team', 81, 114, 29, { w: 'b', anchor: 'middle', max: 108 })}${txt('Bridge', 81, 145, 30, { anchor: 'middle', max: 108 })}</g></svg>`;
  if (k === 'event_greif_interdict') return `${open(side)}${panel('#e8412b')}${turn(t, 22, 52, 32)}${txt('?', 78, 78, 68, { anchor: 'middle', fill: '#fff' })}${txt('Greif Team', 81, 114, 29, { w: 'b', anchor: 'middle', max: 108 })}${txt('Interdict', 81, 145, 30, { anchor: 'middle', max: 108 })}</g></svg>`;
  if (k === 'event_delayed_response') return `${open(side)}${panel('#f07a17')}<ellipse cx="82" cy="100" rx="46" ry="44" fill="#fff"/>${turn(t, 22, 52, 32)}${txt('Delayed', 84, 85, 31, { anchor: 'middle', max: 100 })}${txt('Response', 82, 128, 31, { anchor: 'middle', max: 108 })}</g></svg>`;
  if (k === 'event_arriving_regiment') return `${open(side)}${panel('#a9d37a')}${turn(t, 22, 52, 32)}${txt('III', 79, 46, 14, { w: 'b', anchor: 'middle', max: 22 })}<rect x="57" y="53" width="44" height="26" fill="#fff" stroke="#111" stroke-width="2.4"/><path d="M57 53L101 79M101 53L57 79" stroke="#111" stroke-width="1.6"/>${wrap(name).map((l, i) => txt(l, 81, 107 + i * 28, 22, { anchor: 'middle', fill: '#1c2b0d', max: 108 })).join('')}</g></svg>`;
  if (k === 'event_release') { const ls = wrap(name); return `${open(side)}${panel('#f07a17')}${turn(t, 22, 52, 32)}${ls.map((l, i) => txt(l, 88, 66 + i * 35, 33, { anchor: 'middle', max: 92 })).join('')}</g></svg>`; }
  /* markers and backs */
  const id = (c as Counter).id ?? '';
  if (k === 'reserve_marker') {
    const ge = c.side === 'german', parts = name.replace(' Reserve Unit', '');
    return ge ? `${flat('#2c3a44')}${cross(80, 34, 19)}${txt(parts, 80, 100, 38, { w: 'b', anchor: 'middle', fill: '#fff', max: 120 })}${txt('Reserve Unit', 80, 134, 24, { anchor: 'middle', fill: '#fff', max: 130 })}</svg>`
      : `${flat('#0f55b5')}${star(80, 38, 22)}${txt(parts, 80, 100, 38, { w: 'b', anchor: 'middle', fill: '#fff', max: 128 })}${txt('Reserve Unit', 80, 134, 24, { anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
  }
  if (k === 'marker_vp') return `${flat('#8d9291')}${cross(80, 80, 62)}</svg>`;
  if (k === 'marker') {
    if (name === 'Game Turn') return `${flat('#2c3a44')}${txt('Game', 80, 74, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}${txt('Turn', 80, 126, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
    if (name === 'VPs') return `${flat('#2c3a44')}${cross(80, 52, 30)}${txt('VPs', 80, 138, 50, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
    if (name === 'Disordered / Recovering') return `${flat('#f4c423')}<path d="${Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 36 : 74, a = i * Math.PI / 8; return `${i ? 'L' : 'M'}${(80 + r * Math.cos(a)).toFixed(1)} ${(80 + r * Math.sin(a)).toFixed(1)}`; }).join('')}Z" fill="#ea5a24" stroke="#c0301c" stroke-width="2"/>${txt('D', 80, 118, 98, { w: 'b', anchor: 'middle' })}</svg>`;
    const m = marker(name); if (m) return m;
  }
  if (id === 'GEAR') return marker('Field Works')!;
  switch (id) {
    case 'back_blown': return marker('Blown Bridge')!;
    case 'back_roadblock': return marker('Road Block')!;
    case 'back_no_fuel': return marker('No Fuel')!;
    case 'back_recovering': return `${flat('#f2e9b8')}<rect x="14" y="14" width="132" height="132" fill="#e9dd5b" stroke="#fff" stroke-width="5"/>${txt('R', 80, 120, 108, { w: 'b', anchor: 'middle', fill: '#2e8b3a' })}</svg>`;
    case 'back_star': return `${flat('#0f55b5')}${star(80, 82, 62, '#e6eaf0')}</svg>`;
    case 'back_vps': return `${flat('#0f55b5')}${star(80, 52, 32, '#e6eaf0')}${txt('VPs', 80, 138, 50, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
    case 'back_game_turn': return `${flat('#0f55b5')}${txt('Game', 80, 74, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}${txt('Turn', 80, 126, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
    case 'back_pooled': return `${flat('#0f55b5')}<rect x="20" y="20" width="120" height="120" fill="#f6e92a" stroke="#fff" stroke-width="3"/>${txt('Pooled', 80, 76, 40, { w: 'b', anchor: 'middle', max: 104 })}${txt('Assets', 80, 120, 40, { w: 'b', anchor: 'middle', max: 104 })}</svg>`;
    case 'back_optional': return `${flat('#a9acb0')}<rect x="24" y="22" width="112" height="116" fill="#f6e92a" stroke="#fff" stroke-width="3"/>${txt('Optional', 80, 60, 30, { w: 'b', anchor: 'middle', max: 96 })}${txt('Rule', 80, 94, 30, { w: 'b', anchor: 'middle' })}${txt('18.1', 80, 128, 30, { w: 'b', anchor: 'middle' })}</svg>`;
    case 'back_bid': return `${flat('#a9acb0')}${txt('Bid', 80, 90, 40, { w: 'b', anchor: 'middle', rot: -35 })}</svg>`;
    case 'back_grey_asset': return `${flat('#a9acb0')}${['Asset', 'or', 'Event'].map((l, i) => txt(l, 80, 54 + i * 34, 33, { w: 'b', anchor: 'middle', rot: -6, max: 100 })).join('')}</svg>`;
    case 'back_green_asset': return `${flat('#7d8d2b')}${['Asset', 'or', 'Event'].map((l, i) => txt(l, 80, 54 + i * 34, 33, { w: 'b', anchor: 'middle', rot: -6, max: 100 })).join('')}</svg>`;
    case 'back_task_force': return `${flat('#7d8d2b')}${txt('Task Force', 80, 98, 32, { w: 'b', anchor: 'middle', rot: -38, max: 110 })}</svg>`;
    case 'back_garrison': return `${flat('#7d8d2b')}${txt('Garrison', 80, 96, 32, { w: 'b', anchor: 'middle', rot: -38, max: 110 })}</svg>`;
    case 'back_zone5_de': case 'back_zone6_de': case 'back_zone7_de': { const z = id[9]; return `${flat('#2c3a44')}${cross(80, 38, 17)}${txt(`Zone ${z}`, 80, 96, 34, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt('Reserve Unit', 80, 126, 20, { anchor: 'middle', fill: '#fff', max: 120 })}</svg>`; }
    case 'back_zone7_al': case 'back_zones56_al': return `${flat('#0f55b5')}${star(80, 38, 20)}${txt(id === 'back_zone7_al' ? 'Zone 7' : 'Zones 5/6', 80, 96, 34, { w: 'b', anchor: 'middle', fill: '#fff', max: 128 })}${txt('Reserve Unit', 80, 126, 20, { anchor: 'middle', fill: '#fff', max: 120 })}</svg>`;
  }
  return `${open(side)}${panel(ech)}${turn(t, 22, 52, 32)}${wrap(name).map((l, i) => txt(l, 82, 94 + i * 26, 23, { anchor: 'middle', max: 108 })).join('')}</g></svg>`;
}
