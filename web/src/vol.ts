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
import { labelSvg } from './art';
import { chitSvg, garrisonChit, mapMarkerSvg } from './chits';
import { golanChitSvg, golanBlockSvg, GOLAN_WOOD, type GCounter, type GUnit } from './golan-art';
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
  art: { base: string; lines: string; vpIcons: Record<string, string>; zones?: Record<string, string>; relief: string | null; reliefName: string; entryDark: (side: E.Side) => boolean };
  features: { fuel: boolean; zones: boolean; optional: boolean; tutorial: boolean };
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
  const boxes = Object.entries(m.assembly ?? {}).map(([k, b]) => { const [x, y, w, h] = b.box; return { id: k === 'B' ? G.ASSEMBLY.B : G.ASSEMBLY.A, name: b.name, x, y, w, h }; });
  const areas: MapArea[] = [...m.areas, ...boxes.map((b) => ({ id: b.id, label: [b.x + b.w / 2, b.y + b.h / 2] as [number, number], polygon: [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]] as [number, number][] }))];
  const labels: Record<string, LabelBox> = { ...(golanLabels as unknown as Record<string, LabelBox>) };
  const RAW_UNITS = new Map((golanUnits as unknown as GUnit[]).map((u) => [u.id, u])), RAW_COUNTERS = new Map((golanCounters as unknown as (GCounter & { ids?: string[] })[]).map((c) => [c.id, c]));
  const unitArt = (u: E.Unit) => { const raw = RAW_UNITS.get(u.id); return golanBlockSvg({ ...(raw ?? { id: u.id, name: u.name, side: u.side as 'israeli' | 'syrian' }), name: u.name, side: u.side as 'israeli' | 'syrian', steps: u.max, quality_by_step: u.q, symbol: u.symbol ?? raw?.symbol, division: u.division ?? raw?.division, kind: u.kind ?? raw?.kind }, u.str); };
  const chitArt = (c: E.Chit) => {
    if (c.kind === 'sa_block') return golanBlockSvg({ id: c.id, name: c.name, side: c.side as 'israeli' | 'syrian', kind: 'special_action_block' });
    const raw = RAW_COUNTERS.get(c.counter ?? c.id);
    return golanChitSvg({ id: c.counter ?? c.id, kind: c.kind, side: c.side as 'israeli' | 'syrian', name: c.name, turn: c.turn, quality: c.q ?? raw?.quality, area: c.area ?? raw?.area, subtype: raw?.subtype, symbol: raw?.symbol, brigade: c.brigade, echelon: raw?.echelon });
  };
  const EDGE: Record<string, string> = { MINE: golanChitSvg({ id: 'M01', kind: 'minefield', side: 'israeli', name: 'Minefield' }), ATB: golanChitSvg({ id: 'M13', kind: 'marker_at_ditch_bridged', side: 'none', name: 'AT Ditch Bridged' }),
    R: golanChitSvg({ id: 'R', kind: 'reserve_marker', side: 'syrian', name: 'Reserve' }), RI: golanChitSvg({ id: 'R', kind: 'reserve_marker', side: 'israeli', name: 'Reserve' }) };
  return {
    id: 'golan73', name: "Golan '73", info, sides: ['syrian', 'israeli'], bottom: 'israeli', tag: info.tag, sideName: info.sideName,
    wood: { ...GOLAN_WOOD }, ink: { syrian: '#8fc46a', israeli: '#6fd0ea' }, controlCol: { syrian: 0x4f9a4a, israeli: 0x3ab0d0 },
    map: { size: m.size, areas, connections: m.connections, entries: (golanEntries as { letter: string; x: number; y: number }[]).map((e) => ({ ...e, side: 'syrian' })) },      // the letters sit in the printed triangles (tools/golan73/board.py)
    labels,
    art: { base: './golan73/map-base.svg', lines: './golan73/map-lines.svg', vpIcons: { syrian: './icons/vp-golan-syrian.svg', israeli: './icons/vp-mutual.svg', mutual: './icons/vp-mutual.svg' }, relief: './golan73/', reliefName: 'The Golan Heights in relief, from Mt Hermon to the Sea of Galilee, with contour lines', entryDark: () => false },
    features: { fuel: false, zones: false, optional: false, tutorial: false },
    scenarios: info.scenarios, defaultOpts: { scenario: 'badr', fuel: false },
    unitSvg: (u, g) => (u.garrison && u.chitId ? chitArt(E.chit(g, u.chitId)) : unitArt(u)), chitSvg: chitArt,
    cssSide: (u) => u.side,
    reserveTag: (u) => (u.side === 'syrian' ? 'R' : 'RI'),
    ruleKey: (k) => (k === 'air_mission' || k === 'event_release' ? `golan:${k}` : k), targetsFor: golanTargets,
    battleCard: golanBattleCard, battleUse: golanBattleUse, playInBattle: golanPlayInBattle,
    panel: golanPanel, blocksBegin: golanBlocksBegin, edgeMarks: golanEdgeMarks, markSvg: (code) => EDGE[code] ?? mapMarkerSvg(code), boxes: GOLAN_BOXES,
    fieldWorks: (g, id) => G.unitFieldWorks(g, id),
    limits: (g, b, s) => { const l = G.limits(g, b, s); return { arty: l.artillery, assets: l.battle }; },
    placeOptions: (g, id) => (g.phase === 'deploy' ? G.deployOptions(g, id) : []), pendingPlace: (g) => (g.phase === 'deploy' ? g.units.filter((u) => u.box === 'deploy').map((u) => u.id) : []), place: (g, id, a) => G.deploy(g, id, a),
  };
}

/** Pick the volume this page runs and switch the engine to it. Done once, before anything reads the map. */
export function useVolume(id: string | null | undefined): VolView {
  const gid = GAMES.some((x) => x.id === id && x.ready) ? id! : 'bulge';
  E.useGame(gid);
  const v = gid === 'golan73' ? golan() : bulge();
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
