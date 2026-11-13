// FAB: Sicily pieces drawn from data (no scans), by the series rules shared with The Bulge and Golan '73:
// block faces through block-kit.ts, counters through the chit kit of chits.ts (same frames, panels, lettering and symbols).
// Colours sampled from the printed sticker and counter sheets (docs/games/sicily/counters/); Vassal images were only compared, never copied.
import { blockFace, frame, sticker, word, hex } from './block-kit';
import { chitSvg, CHIT_KIT, CHIT_ART, mapMarkerSvg, type Counter } from './chits';
import { BULGE_WOOD } from './art';

const { txt, open, flat, panel, turn, square, star, QDOT, INK, CX, CY } = CHIT_KIT;
export type Nation = 'us' | 'british' | 'german' | 'italian';
export type SSide = 'allied' | 'axis';

/** Block wood: German grey, US olive and British blue as in The Bulge; Italian orange. */
export const SICILY_WOOD: Record<Nation, number> = {
  german: BULGE_WOOD.german,
  us: BULGE_WOOD.allied,
  british: BULGE_WOOD.british,
  italian: 0xe66525,
};

/** Counter frames (base, light bevel, dark bevel), as printed: US olive, British tan, German grey, Italian orange. */
const FRAMES: Record<Nation | 'allied', string[]> = {
  us: ['#7d8d2b', '#9aa944', '#5d6a1f'],
  allied: ['#7d8d2b', '#9aa944', '#5d6a1f'],
  british: ['#d9b374', '#ebcb93', '#b08f55'],
  german: ['#b9bcc4', '#d9dbe0', '#8e919a'],
  italian: ['#f39a24', '#f8b75a', '#c4720c'],
};
/** The unit square of an asset, by nation (Italian assets print a pale green square on their orange chit). */
const SQUARE: Record<Nation, string> = { us: '#c5e184', british: '#c9a76a', german: '#d6d8db', italian: '#d4e9a8' };
/** The German paratroopers (FJ) print a steel-blue square, artillery included. */
const FJ_SQUARE = '#b9d3e0';
/** Event and Special Action panels. */
const EVENT: Record<Nation | 'allied', string> = {
  us: '#dfe9b8',
  allied: '#dfe9b8',
  british: '#efe1bd',
  german: '#dfe2e6',
  italian: '#fbe2b8',
};
const BLUE = '#1f6fc0',
  SLATE = '#4f6371';

export type SCounter = {
  id: string;
  kind: string;
  side: SSide | 'none';
  nation?: Nation;
  echelon?: string;
  turn?: number | string | null;
  name: string;
  quality?: string | null;
  symbol?: string;
  subtype?: string;
  red_flag?: boolean;
  flanking_invasion?: string;
  division?: string;
  port?: string;
  airborne?: boolean;
};
const nationOf = (c: SCounter): Nation | 'allied' => c.nation ?? (c.side === 'axis' ? 'german' : 'allied');
const T = (t: SCounter['turn']) => (t == null || t === 'scenario' ? null : t) as number | 'S' | string | null;
const ox = (c: SCounter) => open('german', FRAMES[nationOf(c)] as never);

/** The red pennant printed after the turn on some counters (air and naval support, staff, the German Special Actions...). */
const pennant = (x: number, y: number) =>
  `<path d="M${x} ${y - 25}V${y - 7}" stroke="#3a2a20" stroke-width="1.6"/><path d="M${x + 0.8} ${y - 25}L${x + 25} ${y - 18}L${x + 0.8} ${y - 11}Z" fill="#e3222b"/>`;
const head = (c: SCounter, x = 14, y = 36, size = 33) => {
  const t = T(c.turn);
  return `${turn(t, x, y, size)}${c.red_flag ? pennant(x + (t == null ? 0 : t === 'S' ? 24 : String(t).length * size * 0.56 + 3), y) : ''}`;
};
const dotAt = (q: string | null | undefined, cx: number, cy: number) => {
  if (!q || !QDOT[q]) return '';
  const [f, ring] = QDOT[q];
  return `${ring ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="${ring}"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${ring ? 8 : 7.5}" fill="${f}"/>`;
};

/* NATO symbols inside the 68-wide asset square (centre CX, CY). */
const X = (s = 34) =>
  `<path d="M${CX - s} ${CY - s}L${CX + s} ${CY + s}M${CX + s} ${CY - s}L${CX - s} ${CY + s}" stroke="${INK}" stroke-width="2.4"/>`;
const OVAL = `<rect x="${CX - 26.5}" y="${CY - 17}" width="53" height="34" rx="17" fill="none" stroke="${INK}" stroke-width="3.4"/>`;
const SLASH = `<path d="M${CX - 34} ${CY + 34}L${CX + 34} ${CY - 34}" stroke="${INK}" stroke-width="2.4"/>`;
const WINGS = `<path d="M${CX - 22} ${CY + 22}q11-14 22 0q11-14 22 0" fill="none" stroke="${INK}" stroke-width="2.6"/>`;
const RAID = `${X()}<path d="M${CX - 32} ${CY - 32}l20 3-17 17zM${CX + 32} ${CY - 32}l-20 3 17 17z" fill="${INK}"/>`; // rangers, commandos, marines
const ARTY = `<circle cx="${CX}" cy="${CY}" r="7.3" fill="${INK}"/>`;
const ENG = `<path d="M${CX - 17} ${CY - 9}H${CX + 17}V${CY - 3.5}H${CX - 17}ZM${CX - 17} ${CY - 3.5}H${CX - 11.5}V${CY + 9}H${CX - 17}ZM${CX - 3} ${CY - 3.5}H${CX + 3}V${CY + 4}H${CX - 3}ZM${CX + 11.5} ${CY - 3.5}H${CX + 17}V${CY + 9}H${CX + 11.5}Z" fill="${INK}"/>`;
const symbolOf = (c: SCounter) => {
  if (c.kind === 'artillery') return ARTY;
  if (c.kind === 'engineer') return ENG;
  if (c.subtype === 'mobile_group' || c.kind === 'armor_asset') return OVAL;
  if (c.symbol === 'recon' || c.name === 'Palermitani') return SLASH;
  if (c.airborne || c.symbol === 'airborne') return X() + WINGS;
  if (c.subtype === 'marines') return `${X()}${anchorMark(CX, CY + 22, 9)}`; // the Royal Marines: X with a small white anchor at the base
  if (['ranger', 'commando'].includes(c.subtype ?? '')) return RAID;
  return X();
};
/** Rangers, commandos and paratroopers print on a light-blue square. */
const squareFill = (c: SCounter, n: Nation) =>
  /Airborne|Airbourne/.test(c.name)
    ? '#f8e23c'
    : /Canadian/.test(c.name)
      ? '#ef4b3f' // the airborne divisions' yellow, the Canadians' red, as on their blocks
      : / FJ$/.test(c.name)
        ? FJ_SQUARE
        : ['ranger', 'commando'].includes(c.subtype ?? '')
          ? '#a6d6f3'
          : SQUARE[n];
/** The "Flanking Invasion" bracket printed up the left edge (3rd CDO, 30 RCT). */
const flanking = (c: SCounter) =>
  c.flanking_invasion
    ? `<rect x="7" y="56" width="17" height="74" fill="#fff" opacity=".85"/>${txt('Flanking Inv', 20, 128, 13, { w: 'b', rot: -90, max: 70 })}`
    : '';
const assetChit = (c: SCounter) => {
  const n = nationOf(c) as Nation;
  return `${ox(c)}${head(c)}${dotAt(c.quality, CX, 17)}${flanking(c)}${square(squareFill(c, n))}${symbolOf(c)}${txt(c.name, CX, 143, 23, { anchor: 'middle', max: 110 })}</svg>`;
};

/** Text event on a pale panel (Fading Italian Morale, Patton Soldier Slap, Axis Tactical Extract, US 7th Army Release). */
const textEvent = (c: SCounter, lines: string[]) =>
  `${ox(c)}${panel(EVENT[nationOf(c)])}${head(c, 22, 52, 32)}${lines.map((l, i) => txt(l, 84, (lines.length === 3 ? 72 : 88) + i * 30, 27, { w: 'b', anchor: 'middle', max: 104 })).join('')}</g></svg>`;

/* The approved Special Action art (docs/maps/vector/special-action-blocks.svg / -events.svg, as on The Bulge): vector arrows,
   white bold italic words, and the tank photo (Panzer for the Axis, Sherman for the Allies) in a 200 x 200 square. */
const SA_FORK =
  '145.9,131.4 127.7,113.2 127.7,110.5 152.1,110.5 152.1,117.5 175.5,102.9 152.1,88.2 152.1,95.2 127.7,95.2 127.7,92.6 145.9,74.4 150.9,79.3 157,52.5 130.1,58.6 135.1,63.5 115.1,83.5 81.8,83.5 81.8,122.2 115.1,122.2 135.1,142.2 130.1,147.2 157,153.3 150.9,126.4';
const SA_ARROW = '123.9,102.9 81.8,55.4 81.8,78.1 20,78.1 20,127.7 81.8,127.7 81.8,150.3';
const saArt = (axis: boolean) => {
  const t = PIC[axis ? 'tank_axis' : 'tank_allied'],
    [x, y, w, h] = axis ? [25.5, 86.6, 78.1, 32.5] : [25.5, 85.1, 63.3, 35.5];
  return `<polygon points="${SA_FORK}" fill="#000"/><polygon points="${SA_ARROW}" fill="#fff300" stroke="#000" stroke-width="2"/>${t ? `<image href="${t}" x="${x}" y="${y}" width="${w}" height="${h}"/>` : ''}${txt('Special', 100, 50, 38, { w: 'b', italic: true, anchor: 'middle', fill: '#fff', max: 128 })}${txt('Action', 100, 180, 38, { w: 'b', italic: true, anchor: 'middle', fill: '#fff', max: 128 })}`;
};
/** The Special Action event's panel (the command's colour), as approved for The Bulge. */
const SA_PANEL: Record<Nation | 'allied', string> = {
  us: '#b9dc8c',
  allied: '#b9dc8c',
  british: '#c9a76a',
  german: '#d6d8db',
  italian: '#f2b25c',
};
/* Pictures drawn as vectors. */
const anchorMark = (x: number, y: number, r: number) =>
  `<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><circle cx="${x}" cy="${y - r}" r="${r * 0.28}"/><path d="M${x} ${y - r * 0.72}V${y + r * 0.7}M${x - r * 0.45} ${y - r * 0.4}H${x + r * 0.45}M${x - r * 0.85} ${y + r * 0.1}Q${x - r * 0.7} ${y + r * 0.8} ${x} ${y + r * 0.7}Q${x + r * 0.7} ${y + r * 0.8} ${x + r * 0.85} ${y + r * 0.1}"/></g>`;
const anchor = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#2c8fd1" stroke="#fff" stroke-width="3"/><g fill="none" stroke="#fff" stroke-width="${(r * 0.12).toFixed(1)}" stroke-linecap="round"><circle cx="${x}" cy="${y - r * 0.5}" r="${r * 0.14}"/><path d="M${x} ${y - r * 0.36}V${y + r * 0.62}M${x - r * 0.32} ${y - r * 0.18}H${x + r * 0.32}M${x - r * 0.58} ${y + r * 0.2}Q${x - r * 0.5} ${y + r * 0.66} ${x} ${y + r * 0.62}Q${x + r * 0.5} ${y + r * 0.66} ${x + r * 0.58} ${y + r * 0.2}"/></g>`;
const usFlag = (x: number, y: number, w: number, h: number) =>
  `${Array.from({ length: 7 }, (_, i) => `<rect x="${x}" y="${(y + (i * h) / 6.5).toFixed(1)}" width="${w}" height="${(h / 13).toFixed(1)}" fill="#c8102e"/>`).join('')}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#fff" stroke-width=".5"/><rect x="${x}" y="${y}" width="${w * 0.42}" height="${h * 0.54}" fill="#2a3d8f"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${(x + 4 + (i % 4) * w * 0.1).toFixed(1)}" cy="${(y + 4 + Math.floor(i / 4) * h * 0.16).toFixed(1)}" r="1.4" fill="#fff"/>`).join('')}`;
const ukFlag = (x: number, y: number, w: number, h: number) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 60 30" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#c8102e" stroke-width="6"/></svg>`;
const itFlag = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w / 3}" height="${h}" fill="#109a4a"/><rect x="${x + w / 3}" y="${y}" width="${w / 3}" height="${h}" fill="#fff"/><rect x="${x + (2 * w) / 3}" y="${y}" width="${w / 3}" height="${h}" fill="#d52b32"/><path d="M${x + w / 2 - 6} ${y + h / 2 - 7}h12v8q0 6-6 8q-6-2-6-8z" fill="#d52b32" stroke="#2a62b0" stroke-width="1.6"/><path d="M${x + w / 2} ${y + h / 2 - 5}v12M${x + w / 2 - 4} ${y + h / 2 + 1}h8" stroke="#fff" stroke-width="2"/>`;
/** The Axis symbol: The Bulge map's VP cross (web/public/icons/vp-allied.svg), centred on (x, y) with half-size r. */
const cross = (x: number, y: number, r: number) =>
  `<g transform="translate(${x} ${y}) scale(${(r / 99.21).toFixed(4)}) translate(-130 -130)"><path d="M229.21 100.24H159.76V30.79H100.24V100.24H30.79V159.76H100.24V229.21H159.76V159.76H229.21Z" fill="#141414"/><path d="M30.79 159.76H100.24V229.21H80.39V179.61H30.79ZM30.79 100.24H100.24V30.79H80.39V80.39H30.79ZM229.21 159.76H159.76V229.21H179.61V179.61H229.21ZM229.21 100.24H159.76V30.79H179.61V80.39H229.21Z" fill="#fff"/></g>`;
const burst = (x: number, y: number, r1: number, r2: number, n = 12) =>
  `<path d="${Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1,
      a = (i * Math.PI) / n;
    return `${i ? 'L' : 'M'}${(x + r * Math.sin(a)).toFixed(1)} ${(y - r * Math.cos(a)).toFixed(1)}`;
  }).join('')}Z" fill="#7fc1ea" opacity=".75"/>`;

/** The printed pictures of Air and Naval Support, cut from the counter sheet scan (web/public/sicily/chit/); the rest of the counter is vector. */
const PIC: Record<string, string> = {};
const PICS = ['air_us', 'air_br', 'air_axis', 'naval_us', 'naval_br', 'tank_axis', 'tank_allied'] as const;
export async function loadSicilyChitArt(base = './sicily/chit/') {
  await Promise.all(
    PICS.map(async (k) => {
      const r = await fetch(`${base}${k}.png`);
      if (!r.ok) throw new Error(`sicily chit art ${k}: ${r.status}`);
      const b = await r.blob();
      PIC[k] = await new Promise<string>((ok) => {
        const f = new FileReader();
        f.onload = () => ok(String(f.result));
        f.readAsDataURL(b);
      });
    }),
  );
}
/** The picture in the middle band of the counter, at its printed proportions (about 2.1 : 1). */
const picture = (k: string) =>
  PIC[k] ? `<image href="${PIC[k]}" x="6" y="38" width="148" height="72" preserveAspectRatio="xMidYMid meet"/>` : '';
const picKey = (c: SCounter, kind: 'air' | 'naval') => `${kind}_${c.side === 'axis' ? 'axis' : c.nation === 'british' ? 'br' : 'us'}`;
/** Air Support: the Allied fighter over a sky panel (the Axis counter flies the same art on its grey frame). */
const airChit = (c: SCounter) =>
  `${ox(c)}${head(c)}${picture(picKey(c, 'air'))}${txt('Air Support', 80, 140, 26, { w: 'b', italic: true, anchor: 'middle', max: 128 })}</svg>`;
const navalChit = (c: SCounter) =>
  `${ox(c)}${head(c)}${picture(picKey(c, 'naval'))}${txt('Naval Support', 80, 140, 24, { w: 'b', italic: true, anchor: 'middle', max: 128 })}</svg>`;
const delayed = (c: SCounter) =>
  `${ox(c)}${head(c)}<rect x="40" y="44" width="80" height="56" fill="#e3222b"/>${txt('Asset', 80, 82, 28, { w: 'b', italic: true, anchor: 'middle', fill: '#fff', max: 72 })}${txt('Delayed', 80, 140, 30, { w: 'b', italic: true, anchor: 'middle', max: 128 })}</svg>`;
const staff = (c: SCounter) =>
  `${ox(c)}${head(c)}<rect x="48" y="44" width="64" height="58" fill="${c.nation === 'italian' ? '#8d969c' : '#3c7a3a'}" stroke="#fff" stroke-width="4"/>${txt('HQ', 80, 86, 36, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt('Staff Asset', 80, 140, 25, { w: 'b', anchor: 'middle', max: 124 })}</svg>`;
const specialAction = (c: SCounter) =>
  `${ox(c)}<rect x="14" y="14" width="132" height="132" fill="${SA_PANEL[nationOf(c)]}" stroke="#fff" stroke-width="2.6"/><g transform="translate(22 27) scale(.6)">${saArt(c.side === 'axis')}</g>${head(c, 18, 44, 30)}</svg>`;
const replacement = (c: SCounter) => {
  const arm = c.kind === 'replacement_arm',
    n = nationOf(c),
    ls = c.name
      .replace(/ Non-Elite Repl$/, '')
      .split(' ')
      .concat([]);
  const lines = [ls.join(' '), 'Non-Elite', 'Repl'];
  const sym = `<rect x="61" y="36" width="43" height="29" fill="#fff" stroke="#111" stroke-width="2.4"/>${arm ? '<rect x="68" y="42" width="29" height="17" rx="8.5" fill="none" stroke="#111" stroke-width="2"/>' : '<path d="M61 36L104 65M104 36L61 65" stroke="#111" stroke-width="1.6"/>'}`;
  return `${ox(c)}${panel(EVENT[n])}${head(c, 22, 52, 32)}${sym}${lines.map((l, i) => txt(l, 82, 92 + i * 24, 22, { anchor: 'middle', max: 108 })).join('')}</g></svg>`;
};
const reserve = (c: SCounter) => {
  const n = c.nation ?? (c.side === 'axis' ? 'italian' : 'us'),
    army = c.name.replace(/ Reserve$/, '');
  const flag =
    n === 'us' ? usFlag(46, 18, 68, 40) : n === 'british' ? ukFlag(46, 18, 68, 40) : `${itFlag(54, 18, 66, 40)}${pennant(30, 40)}`;
  return `${open('german', FRAMES[n] as never)}${flag}${txt(army, 80, 98, 32, { w: 'b', anchor: 'middle', max: 128 })}${txt('Reserve', 80, 134, 32, { w: 'b', anchor: 'middle', max: 128 })}</svg>`;
};
const beachhead = (c: SCounter) =>
  `${ox(c)}${txt(c.nation === 'us' ? 'US Beach' : 'Br Beach', 80, 46, 30, { w: 'b', anchor: 'middle', max: 128 })}${txt('Head', 80, 78, 30, { w: 'b', anchor: 'middle' })}${anchor(80, 114, 22)}</svg>`;
/** Restricted (front) / Released (back): the division's unit square under XX, the word up the left edge, the division stripe and name below. */
const DIV_COL: Record<string, string> = {};
const dark = (h: string) => {
  const v = parseInt(h.slice(1), 16);
  return (v >> 16) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 < 120;
};
export function restricted(c: SCounter, released = false, stripe?: string, symbol = 'inf', box?: string) {
  const n = nationOf(c),
    name = c.name.replace(/^Restricted /, '').replace(/ \(Arm Bde\)$/, ''),
    brigade = /Arm Bde|4th Armour|231st/.test(c.name);
  const band = brigade ? null : (stripe ?? DIV_COL[c.division ?? ''] ?? null); // as printed: the division colour fills the bottom of the counter; the brigades have none
  const sym = symbol === 'armor' ? OVAL : symbol === 'airborne' ? X() + WINGS : X();
  const tag = released ? ['#f3ecc8', '#3a3a2a', 'Released'] : ['#e3222b', '#fff', 'Restricted'];
  return `${ox(c)}${band ? `<rect x="0" y="116" width="160" height="44" fill="${band}"/>` : ''}<rect x="9" y="14" width="19" height="80" fill="${tag[0]}"/>${txt(tag[2], 24, 90, 14, { w: 'b', rot: -90, fill: tag[1], max: 74 })}${txt(brigade ? 'X' : 'XX', 86, 32, 21, { w: 'b', anchor: 'middle' })}<g transform="translate(86 74) scale(1.06) translate(${-CX} ${-CY})">${square(box ?? SQUARE[n as Nation] ?? '#ddd')}${sym}</g>${txt(name, 80, 146, 24, { w: 'b', anchor: 'middle', max: 142, fill: band && dark(band) ? '#fff' : '#111' })}</svg>`;
}
const portDamage = (c: SCounter, level = 1) =>
  `${flat(level === 1 ? BLUE : '#0b4a86')}${burst(80, 64, 58, 22)}${txt(String(level), 80, 62, 46, { w: 'b', anchor: 'middle', fill: '#fff' })}${txt(c.name.replace(/ Damage.*$/, ''), 80, 104, 28, { w: 'b', anchor: 'middle', fill: '#fff', max: 128 })}${txt('Damage', 80, 136, 24, { w: 'b', anchor: 'middle', fill: '#cfe3f5', max: 120 })}</svg>`;
export const sicilyControl = (side: SSide) =>
  side === 'allied' ? `${flat(BLUE)}${star(80, 82, 62)}</svg>` : `${flat('#a6aaae')}${cross(80, 80, 62)}</svg>`; // the Axis side: The Bulge map's VP symbol on the printed grey
export const sicilyTrack = (name: string, side: SSide) => {
  const bg = side === 'allied' ? BLUE : SLATE;
  return name === 'VPs'
    ? `${flat(bg)}${side === 'allied' ? star(80, 52, 30) : cross(80, 52, 30)}${txt('VPs', 80, 138, 50, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`
    : `${flat(bg)}${txt('Game', 80, 74, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}${txt('Turn', 80, 126, 52, { w: 'b', anchor: 'middle', fill: '#fff', max: 130 })}</svg>`;
};

/** The SVG of one Sicily counter (asset, event or marker), 160 x 160 units. */
export function sicilyChitSvg(c: SCounter): string {
  switch (c.kind) {
    case 'infantry_asset':
    case 'armor_asset':
    case 'artillery':
    case 'engineer':
      return assetChit(c);
    case 'air_mission':
      return airChit(c);
    case 'naval_support':
      return navalChit(c);
    case 'event_asset_delayed':
      return delayed(c);
    case 'command_staff':
      return staff(c);
    case 'special_action_event':
      return specialAction(c);
    case 'replacement_inf':
    case 'replacement_arm':
      return replacement(c);
    case 'event_fading_morale':
      return textEvent(c, ['Fading', 'Italian', 'Morale']);
    case 'event_patton_slap':
      return textEvent(c, ['Patton', 'Soldier', 'Slap']);
    case 'event_tactical_extract':
      return textEvent(c, ['Axis', 'Tactical', 'Extract']);
    case 'event_army_release':
      return textEvent(c, ['US 7th', 'Army', 'Release']);
    case 'reserve_marker':
      return reserve(c);
    case 'marker_beachhead':
      return beachhead(c);
    case 'marker_restricted':
      return restricted(c);
    case 'marker_port_damage':
      return portDamage(c, 1);
    case 'marker_control':
      return sicilyControl('allied');
    case 'field_works':
      return CHIT_KIT.marker('Field Works')!;
    case 'marker': {
      if (c.name === 'Game Turn' || c.name === 'VPs') return sicilyTrack(c.name, c.name === 'VPs' ? 'axis' : 'allied'); // two-sided: Game Turn Allied / Axis, VPs Axis / Allied (counter_backs.json)
      const code: Record<string, string> = {
        'River Assault': 'RA',
        Disordered: 'DIS',
        Exploitation: 'E',
        'Out of Supply': 'OOS',
        'Blown Bridge': 'X',
        'Road Block': 'RB',
      };
      return (
        (code[c.name] && mapMarkerSvg(code[c.name])) ||
        chitSvg({ id: c.id, kind: 'marker', name: c.name, side: 'none', ech: 'none' } as Counter)
      );
    }
  }
  return `${flat('#ddd')}${txt(c.name, 80, 86, 20, { anchor: 'middle', max: 140 })}</svg>`;
}
/** Counter backs: Asset or Event (olive / grey), Released, the second damage level, the Axis faces of the two-sided markers. */
export function sicilyBackSvg(id: string, front?: SCounter): string {
  const lines = (fill: string) =>
    `${flat(fill)}${['Asset', 'or', 'Event'].map((l, i) => txt(l, 80, 54 + i * 34, 33, { w: 'b', anchor: 'middle', rot: -6, max: 100 })).join('')}</svg>`;
  switch (id) {
    case 'back_allied_asset':
      return lines('#a6b65c');
    case 'back_axis_asset':
      return lines('#b9bcc2');
    case 'back_released':
      return front
        ? restricted(front, true)
        : restricted({ id, kind: 'marker_restricted', side: 'allied', nation: 'us', name: 'Released' }, true);
    case 'back_control_axis':
      return sicilyControl('axis');
    case 'back_game_turn_axis':
      return sicilyTrack('Game Turn', 'axis');
    case 'back_vps_allies':
      return sicilyTrack('VPs', 'allied');
    case 'back_road_block':
      return mapMarkerSvg('RB')!;
    case 'back_out_of_supply':
      return mapMarkerSvg('OOS')!;
    case 'back_recovering':
      return mapMarkerSvg('REC')!;
    case 'back_blown_bridge':
      return mapMarkerSvg('X')!;
  }
  const dmg = id.match(/^back_(\w+)_damage_2$/);
  if (dmg)
    return portDamage({ id, kind: 'marker_port_damage', side: 'none', name: dmg[1][0].toUpperCase() + dmg[1].slice(1) + ' Damage' }, 2);
  return `${flat('#ccc')}${txt(id, 80, 86, 16, { anchor: 'middle', max: 140 })}</svg>`;
}

/* ---------- block labels (100 x 100, the series rule in block-kit.ts) ---------- */
export type SUnit = {
  id: string;
  name: string;
  side: SSide;
  nation?: Nation;
  kind?: string;
  symbol?: string;
  steps?: number;
  quality_by_step?: (string | null)[];
  sticker_code?: string | null;
  start_area?: number | null;
  arrival_turn?: number | null;
  colours?: { stripe?: string | null; box?: string | null; sticker?: string | null };
};
/** The name as printed on the sticker: "2nd", "1st Cdn", "15th PG", "Livorno"... */
const printed = (u: SUnit) =>
  u.name === 'Coastal/Garrison'
    ? 'Coastal/Garrison'
    : u.nation === 'us' || u.nation === 'british'
      ? u.name.replace(/^1st Canadian( Armoured)?$/, '1st Cdn').replace(/ (Infantry|Armored|Armoured|Airborne)$/, '')
      : u.name;
const SYMBOL: Record<string, string> = { motorized_inf: 'motorized', mountain_inf: 'mountain', garrison: 'garrison' };
/** 512 px SVG of a Sicily block face at strength str. */
export function sicilyBlockSvg(u: SUnit, str = u.steps ?? 1): string {
  const n: Nation = u.nation ?? (u.side === 'axis' ? 'german' : 'us'),
    wood = hex(SICILY_WOOD[n]),
    paper = u.colours?.sticker ?? '#ccc',
    max = u.steps ?? 1;
  if (u.kind === 'special_action_block') {
    // the approved Special Action label: grey (Axis) or blue (Allied) with the tank photo
    const ax = u.side === 'axis',
      w = hex(ax ? SICILY_WOOD.german : SICILY_WOOD.us);
    return `${frame(w)}<rect x="5" y="5" width="90" height="90" fill="${ax ? '#b7bbc1' : '#0082ce'}"/><svg x="5" y="5" width="90" height="90" viewBox="0 0 200 200">${saArt(ax)}</svg></svg>`;
  }
  const c = u.sticker_code,
    code = !c ? null : c === 'Inv' ? { t: 'Inv', bg: '#fff' } : u.start_area != null ? { t: c, bg: '#f8e23c' } : { t: c };
  return blockFace(
    {
      wood,
      paper,
      box: u.colours?.box ?? '#ddd',
      symbol: SYMBOL[u.symbol ?? ''] ?? u.symbol,
      steps: max,
      q: u.quality_by_step ?? [],
      name: printed(u),
      code,
      stripe: u.colours?.stripe ?? null,
      stripeAt: [57.5, 13],
    },
    str,
  );
}
