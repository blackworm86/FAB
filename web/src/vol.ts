/** The volume the page shows: its board, pieces, colours, names and the hooks the shared interface calls (docs/design/one-engine.md, increment 4).
 *  One page runs one game, chosen before the scene is built: `?game=` in the address, else the saved game of this table, else The Bulge.
 *  Everything game-specific the interface needs is read from here; the rules come from the engine's own volume (E.VOLUME). */
import * as E from '../../engine/src';
import bulgeMap from '../../data/bulge/map.json';
import bulgeLabels from '../../data/bulge/labels.json';
import zonesJson from '../../data/bulge/zones.json';
import golanMap from '../../data/golan73/map.json';
import golanLabels from '../../data/golan73/labels.json';
import golanUnits from '../../data/golan73/units.json';
import golanCounters from '../../data/golan73/counters.json';
import golanEntries from '../../data/golan73/entry_marks.json';
import sicilyMap from '../../data/sicily/map.json';
import sicilyLabels from '../../data/sicily/labels.json';
import sicilyArt from '../../data/sicily/map_art.json';
import sicilyUnits from '../../data/sicily/units.json';
import sicilyCounters from '../../data/sicily/counters.json';
import { labelSvg, BULGE_WOOD } from './art';
import { chitSvg, garrisonChit, mapMarkerSvg, saBlockSvg } from './chits';
import { golanChitSvg, golanBlockSvg, GOLAN_WOOD, type GCounter, type GUnit } from './golan-art';
import { sicilyChitSvg, sicilyBlockSvg, SICILY_WOOD, type SCounter, type SUnit } from './sicily-art';
import { sicilyTargets, sicilyPanel, sicilyBlocksBegin, sicilyBattleCard, SICILY_BOXES } from './sicily-ui';
import { targetsFor as bulgeTargets, type Tgt, type TgtCtx } from './chit-play';
import { golanTargets, golanBattleUse, golanPlayInBattle, golanBattleCard, golanPanel, golanBlocksBegin, golanEdgeMarks, GOLAN_BOXES, type PanelCtx } from './golan-ui';
import { GAMES, gameInfo, type GameInfo, type ScenarioInfo } from './games';

export type MapArea = { id: number; label: [number, number]; polygon: [number, number][] };
export type MapEntry = { letter: string; x: number; y: number; side: E.Side };
export type LabelBox = { mode: string; x: number; y: number; w: number; h: number; px: number; py: number; pr: number };
export interface VolView {
  id: string; name: string; info: GameInfo;
  sides: [E.Side, E.Side];
  /** The side whose edge of the printed map is at the bottom: that player looks up the map, the other down it from the far edge. */
  bottom: E.Side; tag: Record<string, string>; sideName: Record<string, string>;
  wood: Record<string, number>; ink: Record<string, string>; controlCol: Record<string, number>;   // block wood, text colour (CSS --ge/--al), area-control tint
  map: { size: [number, number]; areas: MapArea[]; connections: { a: number; b: number }[]; entries: MapEntry[] };
  labels: Record<string, LabelBox>;
  art: { labelFace?: Partial<import('./board-art').LabelFace>; base: string; lines: string; vpIcons: Record<string, string>; zones?: Record<string, string>; relief: string | null; reliefName: string; entryDark: (side: E.Side) => boolean;
    /** Off-map boxes printed only on a scenario's own sheet: drawn, and clickable, only while that scenario's play area includes them. */
    sheetBoxes?: { id: number; name: string; side: E.Side; x: number; y: number; w: number; h: number }[] };
  features: { fuel: boolean; zones: boolean; optional: boolean; tutorial: boolean };
  /** A piece named by the rules reference (tools/rules/icons-<game>.json), drawn with this game's art. */
  ruleArt: (key: string, g: E.Game) => { svg: string; wood?: string; name: string } | null;
  scenarios: ScenarioInfo[]; defaultOpts: Partial<E.Opts>;
  unitSvg: (u: E.Unit, g: E.Game) => string; chitSvg: (c: E.Chit) => string;
  /** CSS class of a block's wood: its side, or 'british' for The Bulge's British blocks. */
  cssSide: (u: E.Unit) => string;
  reserveTag: (u: E.Unit) => string;
  ruleKey: (kind: string) => string;
  targetsFor: (G: () => E.Game, c: E.Chit | null, ctx: TgtCtx) => Tgt | null;
  battleCard: (c: E.Chit) => boolean;
  battleUse: (g: E.Game, b: E.Battle, c: E.Chit) => string | null;
  playInBattle: (g: E.Game, b: E.Battle, c: E.Chit) => boolean;
  panel: (g: E.Game, ctx: PanelCtx) => string;
  blocksBegin: (g: E.Game) => string | null;
  edgeMarks: (g: E.Game) => { key: string; code: string }[];
  markSvg: (code: string) => string | null;
  boxes: Record<string, string>;
  fieldWorks: (g: E.Game, id: string) => void;
  limits: (g: E.Game, b: E.Battle, side: E.Side) => { arty: number; assets: number | null };
  placeOptions: (g: E.Game, id: string) => number[];      // where a block in a holding box may be placed now (Golan's alternate set-up)
  pendingPlace: (g: E.Game) => string[];
  place: (g: E.Game, id: string, area: number) => void;
}

const BRIT = new Set(['43 Inf', '53 Inf', 'Guards', '51 Inf']);
type RawMap = { size: [number, number]; areas: MapArea[]; connections: { a: number; b: number }[]; entries: { letter: string; x: number; y: number; side?: string; area?: number }[]; assembly?: Record<string, { name: string; box: [number, number, number, number] }> };

/** The Bulge: the art and panels the interface has had since the start. */
function bulge(): VolView {
  const m = bulgeMap as unknown as RawMap, info = gameInfo('bulge')!;
  const garrisonArt = (u: E.Unit, g: E.Game) => {
    if (u.id.startsWith('DR-') && u.chitId) return chitSvg(E.chit(g, u.chitId));                 // 4.35: the engineer chit itself stands as the defended roadblock
    if (u.heydte) return chitSvg({ kind: 'infantry_asset', name: 'v.d. Heydte', side: 'german', ech: 'de_sr', q: 'veteran', turn: null });
    const tf = u.id.startsWith('TF-') ? E.chit(g, u.chitId!).turn : null;
    return garrisonChit(tf != null ? 'Task Force' : u.name.replace('Garrison ', ''), tf != null ? `${tf}-*` : u.id.replace(/^G/, ''), tf == null);
  };
  return {
    id: 'bulge', name: 'The Bulge', info, sides: ['german', 'allied'], bottom: 'german', tag: info.tag, sideName: info.sideName,
    wood: { german: 0x8e9296, allied: 0x5d8a45 }, ink: { german: '#b9bcc0', allied: '#9db36a' }, controlCol: { german: 0x8a9096, allied: 0x6aa84f },
    map: { size: m.size, areas: m.areas, connections: m.connections, entries: m.entries.map((e) => ({ letter: e.letter, x: e.x, y: e.y, side: e.side === 'german' ? 'german' : 'allied' })) },
    labels: bulgeLabels as unknown as Record<string, LabelBox>,
    art: { base: './map-base.svg', lines: './map-lines.svg', vpIcons: { allied: './icons/vp-allied.svg', german: './icons/vp-german.svg', mutual: './icons/vp-mutual.svg' }, zones: zonesJson as Record<string, string>, relief: './', reliefName: 'The snowy Ardennes in relief, with contour lines, woods and towns', entryDark: (s) => s === 'german' },
    features: { fuel: true, zones: true, optional: true, tutorial: true },
    scenarios: info.scenarios, defaultOpts: { scenario: 'tournament', fuel: true },
    unitSvg: (u, g) => (u.garrison ? garrisonArt(u, g) : labelSvg(u)), chitSvg: (c) => chitSvg(c),
    cssSide: (u) => (u.side === 'german' ? 'german' : BRIT.has(u.name) ? 'british' : 'allied'),
    ruleArt: bulgeRuleArt,
    reserveTag: (u) => (u.side === 'german' ? ({ z5: 'R5', z6: 'R6', z7: 'R7' } as Record<string, string>)[u.reserve ?? ''] ?? 'R5' : u.reserve === 'z7' ? 'A7' : 'A56'),
    ruleKey: (k) => k, targetsFor: bulgeTargets,
    battleCard: (c) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission', battleUse: (g, b, c) => E.canAssign(g, b, c.side, c), playInBattle: () => false,
    panel: () => '', blocksBegin: () => null, edgeMarks: () => [], markSvg: (code) => mapMarkerSvg(code), boxes: {},
    fieldWorks: (g, id) => E.buildFieldWorks(g, id),
    limits: (g, b, s) => { const l = E.assetLimits(g, b, s); return { arty: l.arty, assets: l.battle ? null : 0 }; },
    placeOptions: () => [], pendingPlace: () => [], place: () => {},
  };
}

/** Golan '73: the hand-drawn map, the Assembly areas as two boxes under it, the Golan counters and blocks (golan-art.ts). */
function golan(): VolView {
  const m = golanMap as unknown as RawMap, info = gameInfo('golan73')!, G = E.golan;
  const sheetBoxes = [{ id: G.REAR, name: 'Syrian Rear Area', side: 'syrian' as E.Side, x: 945, y: 292, w: 215, h: 130 }, { id: G.NAF_NORTH, name: 'Northern Assembly Area', side: 'israeli' as E.Side, x: 1000, y: 1095, w: 215, h: 130 }];      // Battle for Nafakh: beside the areas they feed, as on its sheet
  const boxes = [...Object.entries(m.assembly ?? {}).map(([k, b]) => { const [x, y, w, h] = b.box; return { id: k === 'B' ? G.ASSEMBLY.B : G.ASSEMBLY.A, name: b.name, x, y, w, h }; }), ...sheetBoxes];
  const areas: MapArea[] = [...m.areas, ...boxes.map((b) => ({ id: b.id, label: [b.x + b.w / 2, b.y + b.h / 2] as [number, number], polygon: [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]] as [number, number][] }))];
  const labels: Record<string, LabelBox> = { ...(golanLabels as unknown as Record<string, LabelBox>) };
  const RAW_UNITS = new Map((golanUnits as unknown as GUnit[]).map((u) => [u.id, u])), RAW_COUNTERS = new Map((golanCounters as unknown as (GCounter & { ids?: string[] })[]).map((c) => [c.id, c]));
  const unitArt = (u: E.Unit) => { const raw = RAW_UNITS.get(u.id); return golanBlockSvg({ ...(raw ?? { id: u.id, name: u.name, side: u.side as 'israeli' | 'syrian' }), name: u.name, side: u.side as 'israeli' | 'syrian', steps: u.max, quality_by_step: u.q, symbol: u.symbol ?? raw?.symbol, division: u.division ?? raw?.division, kind: u.kind ?? raw?.kind }, u.str); };
  const chitArt = (c: E.Chit) => {
    if (c.kind === 'sa_block') return golanBlockSvg({ id: c.id, name: c.name, side: c.side as 'israeli' | 'syrian', kind: 'special_action_block' });
    const raw = RAW_COUNTERS.get(c.counter ?? c.id);
    return golanChitSvg({ id: c.counter ?? c.id, kind: c.kind, side: c.side as 'israeli' | 'syrian', name: c.name, turn: c.turn, quality: c.q ?? raw?.quality, area: c.area ?? raw?.area, subtype: raw?.subtype, symbol: raw?.symbol, brigade: c.brigade, echelon: raw?.echelon });
  };
  const EDGE: Record<string, () => string> = { MINE: () => golanChitSvg({ id: 'M01', kind: 'minefield', side: 'israeli', name: 'Minefield' }), ATB: () => golanChitSvg({ id: 'M13', kind: 'marker_at_ditch_bridged', side: 'none', name: 'AT Ditch Bridged' }),
    R: () => golanChitSvg({ id: 'M03', kind: 'reserve_marker', side: 'syrian', name: 'Reserve' }), RI: () => golanChitSvg({ id: 'R', kind: 'reserve_marker', side: 'israeli', name: 'Reserve' }) };      // the Syrian one as printed
  return {
    id: 'golan73', name: "Golan '73", info, sides: ['syrian', 'israeli'], bottom: 'israeli', tag: info.tag, sideName: info.sideName,
    wood: { ...GOLAN_WOOD }, ink: { syrian: '#8fc46a', israeli: '#6fd0ea' }, controlCol: { syrian: 0x4f9a4a, israeli: 0x3ab0d0 },
    map: { size: m.size, areas, connections: m.connections, entries: (golanEntries as { letter: string; x: number; y: number }[]).map((e) => ({ ...e, side: 'syrian' })) },      // the letters sit in the printed triangles (tools/golan73/board.py)
    labels,
    art: { labelFace: { family: '"Crimson Pro", "Times New Roman", serif', style: 'normal', weight: 600, halo: '#ddd3ae', ink: '#2a2418' }, base: './golan73/map-base.svg', lines: './golan73/map-lines.svg', vpIcons: { syrian: './icons/vp-golan-syrian.svg', israeli: './icons/vp-mutual.svg', mutual: './icons/vp-mutual.svg' }, relief: './golan73/', reliefName: 'The Golan Heights in relief, from Mt Hermon to the Sea of Galilee, with contour lines', entryDark: () => false, sheetBoxes },
    features: { fuel: false, zones: false, optional: true, tutorial: true },
    scenarios: info.scenarios, defaultOpts: { scenario: 'badr', fuel: false },
    unitSvg: (u, g) => (u.garrison && u.chitId ? chitArt(E.chit(g, u.chitId)) : unitArt(u)), chitSvg: chitArt,
    cssSide: (u) => u.side,
    reserveTag: (u) => (u.side === 'syrian' ? 'R' : 'RI'),
    ruleKey: (k) => (k === 'air_mission' || k === 'event_release' ? `golan:${k}` : k), targetsFor: golanTargets,
    battleCard: golanBattleCard, battleUse: golanBattleUse, playInBattle: golanPlayInBattle,
    ruleArt: golanRuleArt,
    panel: golanPanel, blocksBegin: golanBlocksBegin, edgeMarks: golanEdgeMarks, markSvg: (code) => EDGE[code]?.() ?? mapMarkerSvg(code), boxes: GOLAN_BOXES,
    fieldWorks: (g, id) => G.unitFieldWorks(g, id),
    limits: (g, b, s) => { const l = G.limits(g, b, s); return { arty: l.artillery, assets: l.battle }; },
    placeOptions: (g, id) => (g.phase === 'deploy' ? G.deployOptions(g, id) : []), pendingPlace: (g) => (g.phase === 'deploy' ? g.units.filter((u) => u.box === 'deploy').map((u) => u.id) : []), place: (g, id, a) => G.deploy(g, id, a),
  };
}

/** Sicily: the hand-drawn map with its landing and port boxes as areas, the Sicily counters and blocks (sicily-art.ts), its own prompts (sicily-ui.ts). */
function sicily(): VolView {
  const m = sicilyMap as unknown as { size: [number, number]; areas: MapArea[] }, info = gameInfo('sicily')!, S = E.sicily;
  const boxes = (sicilyArt as unknown as { boxes: { box: string; rect: [number, number, number, number] }[] }).boxes.map((b) => ({ id: S.boxId(b.box), rect: b.rect }));
  const areas: MapArea[] = [...m.areas.map((a) => ({ id: a.id, label: a.label, polygon: a.polygon })), ...boxes.map((b) => { const [x0, y0, x1, y1] = b.rect; return { id: b.id, label: [(x0 + x1) / 2, (y0 + y1) / 2 + 8] as [number, number], polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as [number, number][] }; })];
  const labels: Record<string, LabelBox> = { ...(sicilyLabels as unknown as Record<string, LabelBox>) };
  for (const b of boxes) { const [x0, y0, x1, y1] = b.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; labels[b.id] = { mode: 'none', x: cx, y: cy, w: 0, h: 0, px: cx, py: cy + 8, pr: Math.min(x1 - x0, y1 - y0) / 2 - 4 }; }   // the box prints its own code; pieces stand in its middle
  const RAW_UNITS = new Map((sicilyUnits as unknown as SUnit[]).map((u) => [u.id, u])), RAW_COUNTERS = new Map((sicilyCounters as unknown as (SCounter & { ids?: string[] })[]).map((c) => [c.id, c]));
  const GARRISON: SUnit = { id: 'untried', name: 'Coastal/Garrison', side: 'axis', nation: 'italian', symbol: 'garrison', steps: 1, quality_by_step: ['green'], sticker_code: 'S*', colours: { stripe: null, box: '#c8e5a2', sticker: '#f99116' } };
  const unitArt = (u: E.Unit) => {
    // 15.3: an untried garrison is drawn face down on the table (main.ts) until a battle reveals it; then its own label shows
    const raw = RAW_UNITS.get(u.id);
    return sicilyBlockSvg({ ...(raw ?? { id: u.id, name: u.name, side: u.side as 'allied' | 'axis' }), name: u.name, side: u.side as 'allied' | 'axis', nation: (u.nation ?? raw?.nation) as SUnit['nation'], steps: u.max, quality_by_step: u.q, symbol: u.symbol ?? raw?.symbol }, u.str);
  };
  const RESERVE: Record<string, string> = { R: 'M03', R7: 'M01', R8: 'M02' };                 // the reserve tags over a block: Sicily's own printed reserve markers (6th, 7th, 8th Army)
  const chitArt = (c: E.Chit) => {
    if (c.kind === 'sa_block') return sicilyBlockSvg({ id: c.id, name: c.name, side: c.side as 'allied' | 'axis', nation: c.nation as SUnit['nation'], kind: 'special_action_block' });
    const raw = RAW_COUNTERS.get(c.counter ?? c.id);
    return sicilyChitSvg({ ...(raw ?? { id: c.id, kind: c.kind, side: c.side as 'allied' | 'axis', name: c.name }), id: c.id, kind: c.kind, side: c.side as 'allied' | 'axis', name: c.name, turn: c.turn, quality: c.q ?? raw?.quality, nation: (c.nation ?? raw?.nation) as SCounter['nation'] });
  };
  return {
    id: 'sicily', name: 'Sicily', info, sides: ['allied', 'axis'], bottom: 'allied', tag: info.tag, sideName: info.sideName,
    wood: { ...SICILY_WOOD, allied: SICILY_WOOD.us, axis: SICILY_WOOD.german }, ink: { allied: '#7fb3e8', axis: '#b9bcc0' }, controlCol: { allied: 0x3f7fc8, axis: 0x8a9096 },
    map: { size: m.size, areas, connections: E.VOLUMES.sicily.map.connections, entries: [] },
    labels,
    art: { labelFace: { family: '"Crimson Pro", "Times New Roman", serif', style: 'italic', weight: 600, halo: '#e6dbbd', ink: '#22201a' }, base: './sicily/map-base.svg', lines: './sicily/map-lines.svg', vpIcons: { german: './icons/vp-german.svg', allied: './icons/vp-allied.svg', mutual: './icons/vp-mutual.svg' }, relief: './sicily/', reliefName: 'Sicily in relief, from the Etna to the western capes, with contour lines, groves and woods', entryDark: () => false },
    features: { fuel: false, zones: false, optional: true, tutorial: true },
    scenarios: info.scenarios, defaultOpts: { scenario: 'tournament', fuel: false },
    unitSvg: (u, g) => (u.garrison && u.chitId ? chitArt(E.chit(g, u.chitId)) : unitArt(u)), chitSvg: chitArt,
    cssSide: (u) => u.nation ?? (u.side === 'axis' ? 'german' : 'us'),
    reserveTag: (u) => (u.side === 'axis' ? 'R' : u.nation === 'british' ? 'R8' : 'R7'),
    ruleKey: (k) => (['air_mission', 'engineer', 'command_staff'].includes(k) ? `sicily:${k}` : k), targetsFor: sicilyTargets,
    battleCard: sicilyBattleCard, battleUse: (g, b, c) => E.canAssign(g, b, c.side, c), playInBattle: () => false,
    ruleArt: (key) => { const u = RAW_UNITS.get(key); if (u) return { svg: sicilyBlockSvg(u), wood: hexc(SICILY_WOOD[u.nation ?? 'us']), name: u.name }; const c = RAW_COUNTERS.get(key); return c ? { svg: sicilyChitSvg(c), name: c.name } : null; },
    panel: sicilyPanel, blocksBegin: sicilyBlocksBegin, edgeMarks: () => [], markSvg: (code) => (RESERVE[code] ? sicilyChitSvg(RAW_COUNTERS.get(RESERVE[code])!) : mapMarkerSvg(code)), boxes: SICILY_BOXES,
    fieldWorks: (g, id) => S.unitFieldWorks(g, id),
    limits: (_g, b, s) => ({ arty: s === b.attacker ? 2 : 1, assets: null }),
    placeOptions: (g, id) => (g.phase === 'deploy' ? S.deployOptions(g, id) : []), pendingPlace: (g) => (g.phase === 'deploy' ? g.units.filter((u) => u.box === 'deploy').map((u) => u.id) : []), place: (g, id, a) => S.deploy(g, id, a),
  };
}

/** Pick the volume this page runs and switch the engine to it. Done once, before anything reads the map. */
export function useVolume(id: string | null | undefined): VolView {
  const gid = GAMES.some((x) => x.id === id && x.ready) ? id! : 'bulge';
  E.useGame(gid);
  const v = gid === 'golan73' ? golan() : gid === 'sicily' ? sicily() : bulge();
  document.documentElement.style.setProperty('--ge', v.ink[v.sides[0]]); document.documentElement.style.setProperty('--al', v.ink[v.sides[1]]);
  if (v.id !== 'bulge') aliasSideCss({ german: v.sides[0], allied: v.sides[1] });
  document.title = `FAB: ${v.name}`;
  return v;
}
/** The stylesheet names its side classes after The Bulge's sides (.german, .allied); another volume gets the same rules under its own side names. */
function aliasSideCss(map: Record<string, string>) {
  const re = /\.(german|allied)\b/g, own = new Set<string>(), seen = (rules: CSSRuleList) => { for (const r of Array.from(rules)) { if (r instanceof CSSStyleRule) own.add(r.selectorText); else if (r instanceof CSSGroupingRule) seen(r.cssRules); } };
  for (const ss of Array.from(document.styleSheets)) { try { seen(ss.cssRules); } catch { /* cross-origin */ } }
  const walk = (rules: CSSRuleList, into: CSSStyleSheet | CSSGroupingRule) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && re.test(r.selectorText)) { const sel = r.selectorText.replace(re, (_, k) => `.${map[k]}`); if (own.has(sel)) continue;        // the volume styles this itself (e.g. its block wood): keep its own
        try { into.insertRule(r.cssText.replace(re, (_, k) => `.${map[k]}`), into.cssRules.length); } catch { /* an odd rule: skip it */ } }
      else if (r instanceof CSSGroupingRule) walk(r.cssRules, r);
    }
  };
  for (const ss of Array.from(document.styleSheets)) { let rules: CSSRuleList; try { rules = ss.cssRules; } catch { continue; } walk(rules, ss); }      // Google Fonts is cross-origin: not readable, nothing of ours in it
}

/* ---------- the pieces the rules reference shows next to a rule ---------- */
const hexc = (n: number) => '#' + n.toString(16).padStart(6, '0');
const MARK_NAME: Record<string, string> = { DIS: 'Disordered', REC: 'Recovering', E: 'Exploitation', X: 'Blown Bridge', FW: 'Field Works', RA: 'River Assault', RB: 'Road Block', OOS: 'Out of Supply', B: 'Boundary Crossing',
  R5: 'Zone 5 Reserve', R6: 'Zone 6 Reserve', R7: 'Zone 7 Reserve', A7: 'Zone 7 Reserve (Allied)', A56: 'Zones 5/6 Reserve (Allied)', GI: 'Greif Team Interdict', G: 'Greif Team Bridge', AIR: 'Air Mission' };
/** The Bulge: u:<block name>, c:<chit id>, k:<chit kind> (the first of that kind), m:<marker code>, sa:<side>. */
function bulgeRuleArt(key: string, g: E.Game) {
  const [t, v] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (t === 'u') { const u = g.units.find((x) => x.name === v); return u ? { svg: labelSvg(u), wood: hexc(BULGE_WOOD[u.side as 'german' | 'allied'] ?? 0x888888), name: u.name } : null; }
  if (t === 'c' || t === 'k') { const c = g.chits.find((x) => (t === 'c' ? x.id === v || x.id.startsWith(v + '.') : x.kind === v)); return c ? { svg: chitSvg(c), name: c.name } : null; }
  if (t === 'm') { const svg = mapMarkerSvg(v); return svg ? { svg, name: MARK_NAME[v] ?? v } : null; }
  if (t === 'sa') return { svg: saBlockSvg(v as 'german' | 'allied'), name: `${v === 'german' ? 'German' : 'Allied'} Special Action` };
  return null;
}
/** Golan '73: a block or counter id as printed (I23, SC17, M01). */
const G_UNIT = new Map((golanUnits as unknown as GUnit[]).map((u) => [u.id, u])), G_COUNTER = new Map((golanCounters as unknown as GCounter[]).map((c) => [c.id, c]));
function golanRuleArt(key: string) {
  const u = G_UNIT.get(key); if (u) return { svg: golanBlockSvg(u), wood: hexc(GOLAN_WOOD[u.side as 'israeli' | 'syrian']), name: u.name };
  const c = G_COUNTER.get(key); return c ? { svg: golanChitSvg(c), name: c.name } : null;
}

/** 4.5 What the Play Book example figures need from a game: its printed board, where the areas are, their names, and block faces
 *  (a unit of the game by id, or a generic block for a hypothetical unit). `g` is any game of this volume (its units and chits). */
export function figKit(V: VolView, g: E.Game): import('./figures').FigKit {
  const area = (a: number) => V.map.areas.find((x) => x.id === a), hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const generic = (name: string, cls: 'armor' | 'infantry' = 'infantry') => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" fill="#f1ecd8"/><rect x="25" y="27" width="50" height="34" fill="none" stroke="#111" stroke-width="4"/>${cls === 'armor' ? '<ellipse cx="50" cy="44" rx="16" ry="9" fill="none" stroke="#111" stroke-width="4"/>' : '<path d="M25 27L75 61M75 27L25 61" stroke="#111" stroke-width="4"/>'}<text x="50" y="87" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${name.length > 9 ? 15 : 21}" textLength="${name.length > 9 ? 84 : ''}" lengthAdjust="spacingAndGlyphs">${name.replace(/[&<]/g, '')}</text></svg>`;
  return {
    base: V.art.base, lines: V.art.lines, size: V.map.size, label: (a) => area(a)?.label ?? null, poly: (a) => area(a)?.polygon ?? null,
    name: (a) => E.areas.get(a)?.name ?? String(a), labelFont: V.art.labelFace?.family ?? '"Arial Narrow", Arial, sans-serif',
    face: (p, str) => {
      if (p.unit) { const u = g.units.find((x) => x.id === p.unit); if (!u) return null; return { svg: V.unitSvg({ ...u, str: str ?? u.max, area: u.area ?? 0 }, g), wood: hex(V.wood[u.side] ?? 0x777777), side: u.side }; }
      const side = p.side ?? V.sides[0]; return { svg: generic(p.label ?? '', p.cls), wood: hex(V.wood[side] ?? 0x777777), side };
    },
  };
}
