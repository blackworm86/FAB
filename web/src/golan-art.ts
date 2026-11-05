// Golan '73 pieces, drawn with the same kit as The Bulge counters (chits.ts) so both games look like one series:
// the same bevelled frame, unit square, lettering, quality dot and turn number. Israeli chits use the khaki frame and
// Syrian chits the gold frame of the Golan sheet; blocks are cyan (Israel) and green (Syria) wood.
import { chitSvg, CHIT_KIT, mapMarkerSvg, type Counter } from './chits';

const { txt, open, flat, panel, turn, square, star, MK, wrap, QDOT, INK, CX, CY } = CHIT_KIT;
export type GSide = 'israeli' | 'syrian';
/** Wooden block colours (the physical game): cyan for Israel, green for Syria. */
export const GOLAN_WOOD: Record<GSide, number> = { israeli: 0x2aa3c8, syrian: 0x3f8240 };
/** Block label paper and unit-square colours. */
const LABEL: Record<GSide, string> = { israeli: '#cdc49e', syrian: '#d8a43c' };
const CREAM: Record<GSide, string> = { israeli: '#f3f0e2', syrian: '#f8efc8' };
/** Division colour bar across the block label, a little below the centre (18.5 for Israel; the Syrian stripes show the division for set-up and the operational sectors). */
export const DIVISION: Record<string, string> = {
  '36th_armored': '#e5852e', '240th_armored': '#a6568c', '146th_armored': '#86c3e5',
  '5th_inf': '#f0cf2c', '9th_inf': '#86c4e8', '7th_inf': '#d8412e', '1st_tank': '#7f9c6b', '3rd_tank': '#e8d4a2',
};
export const ECH_GOLAN: Record<string, string> = { is_northern_command: CREAM.israeli, sy_golan_front: CREAM.syrian };

/* ---------- emblems and pictures, all vector ---------- */
const tri = (x: number, y: number, r: number, up: boolean) => { const s = up ? -1 : 1; return `M${x} ${y + s * r}L${(x + r * 0.866).toFixed(1)} ${(y - s * r / 2).toFixed(1)}L${(x - r * 0.866).toFixed(1)} ${(y - s * r / 2).toFixed(1)}Z`; };
/** Star of David (Israel), drawn as two outlined triangles. */
export const davidStar = (x: number, y: number, r: number, col = '#fff', w = r * 0.16) => `<path d="${tri(x, y, r, true)}${tri(x, y, r, false)}" fill="none" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linejoin="miter"/>`;
/** Crescent and star (the Syrian emblem on the Golan counters). */
export const crescent = (x: number, y: number, r: number, col = '#fff', bg = '#3d5a2c') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${x + r * 0.32}" cy="${y - r * 0.08}" r="${r * 0.82}" fill="${bg}"/>${star(x + r * 0.62, y - r * 0.05, r * 0.36, col)}`;
const bolt = (x: number, y: number, s: number) => `<path d="M${x + 6 * s} ${y - 34 * s}L${x - 20 * s} ${y + 4 * s}H${x - 2 * s}L${x - 10 * s} ${y + 34 * s}L${x + 20 * s} ${y - 8 * s}H${x + 2 * s}Z" fill="#ffe14d" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
const tankPic = (x: number, y: number, s: number, f = '#2b2d2a') => `<g transform="translate(${x} ${y}) scale(${s})" fill="${f}"><rect x="-30" y="2" width="60" height="12" rx="6"/><path d="M-26 2L-20 -8H22L28 2Z"/><path d="M-10 -8V-16H12L14 -8Z"/><rect x="12" y="-15" width="30" height="4" rx="1.5"/></g>`;
const gunPic = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#2b2d2a"><circle cx="-14" cy="10" r="8"/><circle cx="8" cy="10" r="8"/><path d="M-26 2H20L24 -4H-22Z"/><path d="M-4 -2L38 -26L41 -21L2 4Z"/><path d="M-22 2L-40 14L-36 17L-16 6Z"/></g>`;
const jetPic = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#3a4a5e"><path d="M-40 0L30 -4L40 0L30 4Z"/><path d="M-6 -2L-22 -26H-14L10 -2ZM-6 2L-22 26H-14L10 2Z"/><path d="M-36 -1L-42 -12H-36L-28 -1ZM-36 1L-42 12H-36L-28 1Z"/></g>`;
const samPic = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-34" y="10" width="68" height="10" rx="4" fill="#2b2d2a"/><path d="M-20 10L-8 -2H8L14 10Z" fill="#2b2d2a"/>${[-14, 0, 14].map((d) => `<g transform="translate(${d} -2) rotate(-38)"><rect x="-3" y="-34" width="6" height="34" fill="#e9eaea" stroke="#2b2d2a" stroke-width="1.6"/><path d="M-3 -34L0 -42L3 -34Z" fill="#c03a2a"/></g>`).join('')}</g>`;
const ssmPic = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-38" y="6" width="70" height="12" rx="3" fill="#2b2d2a"/><circle cx="-26" cy="20" r="5" fill="#2b2d2a"/><circle cx="-6" cy="20" r="5" fill="#2b2d2a"/><circle cx="20" cy="20" r="5" fill="#2b2d2a"/><path d="M20 6V-6H34L38 6Z" fill="#2b2d2a"/><g transform="rotate(-24 -10 4)"><rect x="-40" y="-2" width="48" height="8" rx="2" fill="#e9eaea" stroke="#2b2d2a" stroke-width="1.6"/><path d="M8 -2L18 2L8 6Z" fill="#c03a2a"/></g></g>`;
const bridgePic = (x: number, y: number) => `<g transform="translate(${x} ${y})"><path d="M-46 14H46" stroke="#5a3a20" stroke-width="10"/><path d="M-46 4H46" stroke="#e9e2cf" stroke-width="6"/><path d="M-40 14V26M-14 14V26M14 14V26M40 14V26" stroke="#5a3a20" stroke-width="5"/><path d="M-52 34L-30 18H30L52 34" fill="none" stroke="#2b2d2a" stroke-width="3" stroke-dasharray="5 4"/></g>`;
const skull = (x: number, y: number) => `<g transform="translate(${x} ${y})"><path d="M-30 18L30 34M-30 34L30 18" stroke="#f3eee0" stroke-width="7" stroke-linecap="round"/><circle cy="-4" r="20" fill="#f3eee0"/><rect x="-10" y="10" width="20" height="10" rx="2" fill="#f3eee0"/><circle cx="-7.5" cy="-4" r="5.5" fill="#2b2420"/><circle cx="7.5" cy="-4" r="5.5" fill="#2b2420"/></g>`;
const moroccoFlag = (x: number, y: number, w: number, h: number) => { const cx = x + w / 2, cy = y + h / 2, r = h * 0.3; const p = Array.from({ length: 5 }, (_, i) => [cx + r * Math.sin(i * 4 * Math.PI / 5), cy - r * Math.cos(i * 4 * Math.PI / 5)]);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c1272d" stroke="${INK}" stroke-width="1.6"/><path d="M${p.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join('L')}Z" fill="none" stroke="#006233" stroke-width="3"/>`; };

/* ---------- NATO symbols inside the unit square (CX, CY, 68 wide) ---------- */
const X = (cy = CY, s = 34) => `<path d="M${CX - s} ${cy - s}L${CX + s} ${cy + s}M${CX + s} ${cy - s}L${CX - s} ${cy + s}" stroke="${INK}" stroke-width="2.4"/>`;
const OVAL = (cy = CY) => `<rect x="${CX - 26.5}" y="${cy - 17}" width="53" height="34" rx="17" fill="none" stroke="${INK}" stroke-width="3.4"/>`;
/** Special forces / commando: the X with arrow tips on the upper arms. */
const SF = (cy = CY) => `${X(cy)}<path d="M${CX - 34} ${cy - 34}l14 2-12 12zM${CX + 34} ${cy - 34}l-14 2 12 12z" fill="${INK}"/>`;
const AT = (cy = CY) => `<path d="M${CX - 30} ${cy + 26}L${CX} ${cy - 20}L${CX + 30} ${cy + 26}" fill="none" stroke="${INK}" stroke-width="3.4"/>`;

export type GCounter = { id: string; kind: string; side: GSide | 'none'; echelon?: string; turn?: number | string | null; name: string; quality?: string | null; subtype?: string | null; symbol?: string; area?: number; brigade?: string };
const T = (t: GCounter['turn']) => (t === 'scenario' ? null : t) as number | 'S' | null;
const dotAt = (q: string | null | undefined, cx: number, cy: number) => { if (!q || !QDOT[q]) return ''; const [f, ring] = QDOT[q]; return `${ring ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="${ring}"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${ring ? 8 : 7.5}" fill="${f}"/>`; };
/** A unit-type chit: frame, turn, quality dot, the unit square with its symbol, the name. */
const unitChit = (c: GCounter, sym: string, sq = CREAM[c.side as GSide]) => `${open(c.side as GSide)}${turn(T(c.turn), 14, 36, 33)}${dotAt(c.quality, CX, 17)}${square(sq)}${sym}${txt(c.name, CX, 143, 23, { anchor: 'middle', max: 104 })}</svg>`;
/** An event chit: frame, panel in the event colour, turn, picture, one or two lines of lettering. */
const eventChit = (c: GCounter, fill: string, pic: string, lines: string[], o: { ink?: string; size?: number } = {}) => `${open(c.side as GSide)}${panel(fill)}${turn(T(c.turn), 22, 52, 32)}${pic}${lines.map((l, i) => txt(l, 81, (lines.length > 1 ? 116 : 140) + i * 26, o.size ?? 24, { w: 'b', italic: true, anchor: 'middle', fill: o.ink ?? INK, max: 112 })).join('')}</g></svg>`;
const emblem = (side: GSide, x: number, y: number, r: number) => side === 'israeli' ? davidStar(x, y, r) : crescent(x, y, r * 0.8, '#fff', SIDE_BG[side]);
const SIDE_BG: Record<GSide, string> = { israeli: '#0f55b5', syrian: '#3d5a2c' };

/** The SVG of one Golan counter (asset, event or marker), 160 x 160 units. */
export function golanChitSvg(c: GCounter): string {
  const side = c.side as GSide, k = c.kind;
  const asBulge = (over: Partial<Counter> = {}) => chitSvg({ id: c.id, kind: k, name: c.name, side: c.side, ech: c.echelon ?? 'none', turn: T(c.turn), q: c.quality ?? null, ...over } as Counter);
  switch (k) {
    case 'artillery': case 'rocket_artillery': case 'engineer': case 'armor_asset': case 'command_staff': case 'special_action_event': case 'replacement_arm': return asBulge();
    case 'infantry_asset': return c.subtype === 'anti_tank' ? unitChit(c, AT()) : c.subtype === 'special_forces' ? unitChit(c, SF()) : asBulge();
    case 'commando': return unitChit(c, SF());
    case 'event_release': { const m = c.name.replace(/ Released$/, '').match(/^(.*?) ((?:Tank|Mech|Inf)\b.*)$/), ls = m ? [m[1], m[2], 'Released'] : [c.name];
      return `${open(side)}${panel('#f07a17')}${turn(T(c.turn), 22, 52, 32)}${ls.map((l, i) => txt(l, 84, 66 + i * 33, i === 0 ? 33 : 26, { anchor: 'middle', max: 104 })).join('')}</g></svg>`; }
    case 'garrison': return `${open(side)}<rect x="14" y="17" width="21" height="38" fill="#fff"/>${txt(String(c.area ?? ''), 30, 51, 21, { rot: -90 })}${dotAt(c.quality, CX + 2, 19)}${square(CREAM[side], CY + 2, 70)}${X(CY + 2, 35)}${txt(c.name, CX, 145, 21, { anchor: 'middle', max: 112 })}</svg>`;
    case 'task_force': return unitChit({ ...c, name: 'Task Force' }, c.symbol === 'armor' ? OVAL() : X());
    case 'replacement_mech': { const ls = ['Mech', 'Replacement']; return `${open(side)}${panel(CREAM[side])}${turn(T(c.turn), 22, 52, 32)}<rect x="61" y="40" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/><path d="M61 40L104 69M104 40L61 69" stroke="#111" stroke-width="1.6"/><rect x="68" y="46" width="29" height="17" rx="8.5" fill="none" stroke="#111" stroke-width="1.8"/>${ls.map((l, i) => txt(l, 82, 99 + i * 28, 27, { anchor: 'middle', max: 108 })).join('')}</g></svg>`; }
    case 'event_arriving_battalion': { const m = c.name.match(/^(Battalion only for) (.+)$/), lines = m ? [m[1], m[2]] : wrap(c.name);
      return `${open(side)}${panel('#a9d37a')}${turn(T(c.turn), 22, 52, 32)}${txt('II', 79, 46, 14, { w: 'b', anchor: 'middle', max: 22 })}<rect x="57" y="53" width="44" height="26" fill="#fff" stroke="#111" stroke-width="2.4"/><rect x="65" y="58" width="28" height="16" rx="8" fill="none" stroke="#111" stroke-width="1.8"/>${lines.map((l, i) => txt(l, 81, 107 + i * 28, 21, { anchor: 'middle', max: 118 })).join('')}</g></svg>`; }
    case 'air_mission': return `${flat('#1f5db0')}<rect x="8" y="8" width="144" height="144" fill="#9fcff0" stroke="#fff" stroke-width="3"/>${turn(T(c.turn), 16, 44, 32)}<g transform="translate(108 34)">${side === 'israeli' ? davidStar(0, 0, 15, '#1f5db0', 3) : crescent(0, 0, 12, '#3d5a2c', '#9fcff0')}</g>${jetPic(80, 78, 1.25)}${txt('Air', 80, 120, 32, { w: 'b', anchor: 'middle', fill: '#fff', stroke: '#222', sw: 130 })}${txt('Support', 80, 148, 30, { w: 'b', anchor: 'middle', fill: '#fff', stroke: '#222', sw: 130, max: 130 })}</svg>`;
    case 'sam': return eventChit(c, '#bfe0f4', samPic(80, 66, 1.05), ['SAM'], { size: 30 });
    case 'event_ew': return eventChit(c, '#bfe0f4', bolt(80, 64, 1), ['EW'], { size: 30 });
    case 'event_counterbattery': return eventChit(c, '#bfe0f4', gunPic(78, 66, 1.05), ['Counter-', 'battery'], { size: 23 });
    case 'event_ssm_strike': return eventChit(c, '#bfe0f4', ssmPic(82, 62, 1.05), ['SSM Strike'], { size: 24 });
    case 'event_dugman5': return eventChit(c, '#bfe0f4', jetPic(82, 62, 1.15), ['Operation', 'Dugman 5'], { size: 23 });
    case 'event_lt_zvika': return unitChit({ ...c, quality: c.quality ?? 'elite' }, tankPic(CX, CY + 4, 0.95, INK), '#bfe0f4');
    case 'event_king_hassan': return eventChit(c, CREAM[side], moroccoFlag(54, 46, 54, 36), ["King Hassan's", 'Troublemakers'], { size: 19 });
    case 'event_ssm': return eventChit(c, '#bfe0f4', ssmPic(82, 62, 1), ['SSM Strike']);
    case 'minefield': return MK(`<rect x="8" y="8" width="144" height="144" fill="#b9a776" stroke="#8a7a4e" stroke-width="2"/>${txt('DANGER', 80, 42, 28, { w: 'b', anchor: 'middle', fill: '#a3261c', max: 120 })}<rect x="40" y="52" width="80" height="60" rx="6" fill="#3a2e24"/>${skull(80, 80)}${txt('MINEFIELD', 80, 140, 25, { w: 'b', anchor: 'middle', fill: INK, max: 128 })}`, '#8a7a4e');
    case 'marker_at_ditch_bridged': return MK(`<rect x="8" y="8" width="144" height="144" fill="#b48a52"/>${txt('AT Ditch', 80, 42, 30, { w: 'b', italic: true, anchor: 'middle', fill: '#2b1d10', max: 128 })}${bridgePic(80, 70)}${txt('Bridged', 80, 138, 32, { w: 'b', italic: true, anchor: 'middle', fill: '#2b1d10', max: 128 })}`, '#7a5a30');
    case 'marker_control': return golanControl(side === 'syrian' ? 'syrian' : 'israeli');
    case 'reserve_marker': { const s = side === 'syrian' ? 'syrian' : 'israeli', [a, b] = s === 'israeli' ? ['Northern Cmd', 'Reserve Unit'] : ['Syrian Army', 'Reserve Unit'];
      return `${flat(SIDE_BG[s])}${emblem(s, 80, 40, 24)}${txt(a, 80, 100, 32, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}${txt(b, 80, 134, 24, { anchor: 'middle', fill: '#fff', max: 130 })}</svg>`; }
    case 'field_works': return CHIT_KIT.marker('Field Works')!;
    case 'marker': {
      if (c.name === 'Game Turn' || c.name === 'VPs') return golanTrack(c.name, side === 'syrian' ? 'syrian' : 'israeli');
      if (c.name === 'Out of Supply') return mapMarkerSvg('OOS') ?? asBulge();
      return asBulge({ side: 'none' });
    }
  }
  return `${flat('#ddd')}${txt(c.name, 80, 86, 20, { anchor: 'middle', max: 140 })}</svg>`;
}
/** Two-sided track markers: Game Turn and VPs, one face per side. */
export const golanTrack = (name: 'Game Turn' | 'VPs' | string, side: GSide) => name === 'VPs'
  ? `${flat(SIDE_BG[side])}${emblem(side, 80, 52, 30)}${txt('VPs', 80, 138, 50, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`
  : `${flat(SIDE_BG[side])}${txt('Game', 80, 74, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}${txt('Turn', 80, 126, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
export const golanControl = (side: GSide) => `${flat(SIDE_BG[side])}<rect x="10" y="10" width="140" height="140" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>${emblem(side, 80, 80, 50)}</svg>`;
/** Counter backs: Asset or Event (khaki / gold), the Strongpoint back of the task forces, the garrison back. */
export function golanBackSvg(id: string): string {
  const lines = (fill: string, ls: string[], rot = -6, size = 33) => `${flat(fill)}${ls.map((l, i) => txt(l, 80, (ls.length === 1 ? 92 : 54) + i * 34, size, { w: 'b', anchor: 'middle', rot, max: 110 })).join('')}</svg>`;
  switch (id) {
    case 'back_is_asset': return lines(LABEL.israeli, ['Asset', 'or', 'Event']);
    case 'back_sy_asset': return lines(LABEL.syrian, ['Asset', 'or', 'Event']);
    case 'back_is_strongpoint': return lines(LABEL.israeli, ['Strongpoint'], -38, 30);
    case 'back_garrison': return lines(LABEL.israeli, ['Garrison'], -38, 32);
    case 'back_game_turn_is': return golanTrack('Game Turn', 'israeli');
    case 'back_vps_sy': return golanTrack('VPs', 'syrian');
    case 'back_control_sy': return golanControl('syrian');
  }
  return lines('#ccc', [id]);
}

/* ---------- block labels (100 x 100, like art.ts labelSvg: full strength edge on top, turned 90° per step lost) ---------- */
export type GUnit = { id: string; name: string; side: GSide; steps?: number; quality_by_step?: string[]; symbol?: string; division?: string | null; start_area?: number; arrival_turn?: number | string; entry?: string[]; kind?: string; cls?: string };
const PIP: Record<string, [string, string]> = { elite: ['#d7262b', '#fff'], veteran: ['#151515', '#151515'], green: ['#fff', '#151515'] };
function bsym(kind: string | undefined, fill: string) {
  const box = `<rect x="29" y="31" width="42" height="30" fill="${fill}" stroke="#111" stroke-width="2.4"/>`;
  const x = '<path d="M29 31L71 61M71 31L29 61" stroke="#111" stroke-width="2.1"/>', oval = '<rect x="37" y="38" width="26" height="16" rx="8" fill="none" stroke="#111" stroke-width="2.1"/>';
  const extra: Record<string, string> = { inf: x, armor: oval, mech: x + oval, recon: '<path d="M29 61L71 31" stroke="#111" stroke-width="2.1"/>' + oval, airborne: x + '<path d="M40 56q5-7 10 0q5-7 10 0" fill="none" stroke="#111" stroke-width="1.8"/>' };
  return box + (extra[kind ?? 'inf'] ?? x);
}
function bpips(n: number, q: string, edge: number, starPip: boolean) {
  if (!n || !q) return '';
  const [f, s] = PIP[q] ?? PIP.veteran, out: string[] = [];
  for (let i = 0; i < n; i++) { const t = 50 + (i - (n - 1) / 2) * (starPip ? 12 : 9.5);
    out.push(starPip ? `<path d="${tri(t, 11, 5, true)}${tri(t, 11, 5, false)}" fill="none" stroke="${q === 'elite' ? '#d7262b' : '#151515'}" stroke-width="1.5"/>` : `<circle cx="${t}" cy="11" r="4" fill="${f}" stroke="${s}" stroke-width="1.4"/>`); }
  return `<g transform="rotate(${edge * 90} 50 50)">${out.join('')}</g>`;
}
const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** 512 px SVG of a Golan block label at strength str. */
export function golanBlockSvg(u: GUnit, str = u.steps ?? 1): string {
  const bg = LABEL[u.side], max = u.steps ?? 1, q = u.quality_by_step ?? [];
  if (u.kind === 'special_action_block') return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><rect x="6" y="6" width="88" height="88" fill="none" stroke="#111" stroke-width="1.2" opacity=".35"/><g transform="translate(50 30) scale(.62) translate(-80 -40)">${emblem(u.side, 80, 40, 26).replace(/#fff/g, '#1a1a1a')}</g><text x="50" y="70" font-size="15" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-style="italic">Special</text><text x="50" y="86" font-size="15" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-style="italic">Action</text></svg>`;
  if (u.kind === 'ghost') return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/>${davidStar(50, 44, 22, '#1d4f9a', 4)}<text x="50" y="86" font-size="16" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-style="italic">Ghost</text><text x="12" y="20" font-size="11" font-family="Arial Narrow, Arial" font-weight="700">S*</text></svg>`;
  const strong = u.kind === 'strongpoint', stripe = u.division && DIVISION[u.division] ? `<rect x="0" y="50" width="100" height="13" fill="${DIVISION[u.division]}"/>` : '';
  const edges = Array.from({ length: max }, (_, k) => bpips(max - k, q[max - k - 1], k, strong)).join('');
  const code = u.arrival_turn != null ? `${u.arrival_turn}${u.entry?.length ? `-${u.entry.join('')}` : ''}` : u.start_area != null ? String(u.start_area) : strong ? 'S*' : '';
  const codeEl = code ? (u.start_area != null && u.arrival_turn == null ? `<rect x="5" y="20" width="16" height="12" fill="#fff"/><text x="13" y="29.5" font-size="9.5" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700">${e(code)}</text>` : `<text x="90" y="27" font-size="10" text-anchor="end" font-family="Arial Narrow, Arial" font-weight="700">${e(code)}</text>`) : '';
  const name = strong ? 'Strongpoint' : u.name;
  const inner = `<rect width="100" height="100" fill="${bg}"/>${stripe}${codeEl}${bsym(u.symbol, CREAM[u.side])}${edges}<text x="88" y="80" font-size="${name.length > 9 ? 11 : 13}" text-anchor="end" font-family="Arial Narrow, Arial" font-weight="700">${e(name)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><g transform="rotate(${-90 * (max - str)} 50 50)">${inner}</g></svg>`;
}
