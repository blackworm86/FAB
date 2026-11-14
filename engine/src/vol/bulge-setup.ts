// FAB Vol. I, The Bulge: the scenarios and their set-up (Tournament and Campaign from the data files, the Introductory scenario 24.3, Cold Shoulder), and who controls what at the start.
import unitsJson from '../../../data/bulge/units.json';
import scenJson from '../../../data/bulge/scenarios.json';
import { areas, edgeKey, neighbors, setPlayArea } from '../map';
import { buildChits, type Side } from '../chits';
import { boxOf, type Game, type Opts, type RawUnit, say, sideOf, type Unit } from '../game';

/* ================= setup ================= */
/** 24.3 Introductory scenario "Nuts!": its map sheet, forces, chits and draws (Play Book back page and the scenario map sheet). */
const INTRO_AREAS = [12, 13, 14, 15, 19, 20, 21, 22, 36, 37, 38, 39, 45, 46, 47, 48, 63, 64];
export const EDGE_INTRO: number[] = [];
const INTRO_UNITS: Record<string, number> = {
  '116 Pz': 12,
  '560 VG': 12,
  Lehr: 13,
  '276 VG': 15,
  '5 FJ': 19,
  '26 VG': 20,
  '2 Pz': 21,
  '112/28': 12,
  '109/28': 19,
  '110/28': 21,
  'CCR/9': 37,
};
/** Chits in play: turn 1 ones start Available; later ones enter the cup on their turn (drawn per the sheet's turn track). */
const INTRO_CHITS: Record<string, number> = {
  'L47.0': 1,
  'L46.0': 1,
  'L36.0': 1,
  'L31.0': 1,
  'L33.0': 1,
  'R17.0': 1,
  'R17.1': 1,
  'R15.0': 2,
  'L35.0': 3,
  'R48.0': 3,
  'L79.0': 2,
  'L65.0': 2,
  'L88.0': 2,
  'L62.0': 2,
  'L71.0': 2,
  'R71.0': 2,
  'SA-allied': 2,
  'L83.0': 3,
};
function introSetup(g: Game) {
  g.inPlay = [...INTRO_AREAS];
  g.lastTurn = 3;
  g.track = [
    { ge: [0, 0], al: [0, 0], sd: null },
    { ge: [4, 1], al: [3, 0], sd: null },
    { ge: [3, 0], al: [3, 0], sd: null },
  ];
  for (const u of g.units) {
    if (u.garrison) {
      if (u.area !== 38 && u.area !== 47) ((u.area = null), (u.str = 0));
      continue;
    }
    if (u.name === '10 Arm') {
      u.area = null;
      u.arrival = 2;
      u.entry = ['#46'];
      u.str = u.max;
      continue;
    } // 24.35 arrives at full strength into Martelange
    u.area = INTRO_UNITS[u.name] ?? null;
    u.str = u.max;
    if (u.area == null) u.arrival = undefined;
  }
  g.units = g.units.filter((u) => u.area != null || u.arrival != null);
  g.chits = g.chits.filter((c) => INTRO_CHITS[c.id] != null);
  for (const c of g.chits) {
    const t = INTRO_CHITS[c.id];
    c.turn = t;
    c.box = t === 1 ? 'available' : 'future';
  }
  g.fieldWorks = [12, 19, 21];
  g.riverAssault = [21];
  g.blown = [edgeKey(13, 21), edgeKey(13, 20)];
  g.markers = { german: { z5: 1, z6: 0, z7: 1 }, allied: { z56: 1, z7: 0 } };
}
/* P500 "Cold Shoulder" (Bonus Scenario sheet, docs/scenarios/FAB_BonusScen_ColdShoulder.pdf): Zone 6 only, turns 1-9. */
const COLD_UNITS: Record<string, number | null> = {
  Peiper: 5,
  '1SS(-)': 6,
  '150 Pz': 6,
  '12SS': 7,
  '326 VG': 8,
  '12 VG': 9,
  '277 VG': 9,
  '3 FJ': 10,
  '2SS': null,
  '9SS': null,
  '3 PG': null,
  '246 VG': null,
  '10SS': null,
  '17SS': null, // German reinforcements / released divisions
  '99 Inf': 9,
  '14 Cav': 10,
  'CCB/9': 25,
  '102 Cav': 27,
  '2 Inf': 27,
  '1 Inf': null,
  '7 Arm': null,
  '9 Inf': null,
  '30 Inf': null,
  '3 Arm': null,
  '84 Inf': null,
  '75 Inf': null,
  '43 Inf': null,
  '4 Cav': null,
  Guards: null,
};
/** P.5 entry areas where the sheet differs from the campaign data ("Enter at AC", "CE", "DE"). */
const COLD_ENTRY: Record<string, string[]> = {
  '1 Inf': ['A', 'C'],
  '7 Arm': ['A', 'C'],
  '84 Inf': ['C', 'E'],
  '75 Inf': ['C', 'E'],
  '4 Cav': ['C', 'E'],
  '43 Inf': ['D', 'E'],
  Guards: ['D', 'E'],
};
/** P.4 / P.5 chits by turn (1 = in the Available Box at start; later turns enter the cup, Task Forces go to Available). */
const COLD_CHITS: Record<string, number> = {
  // German, 6th Panzer Army
  'L26.0': 1,
  'R17.0': 1,
  'R17.1': 1,
  'R17.2': 1,
  'L12.0': 1,
  'L13.0': 1,
  'L25.0': 1,
  'L14.0': 1,
  'L15.0': 1,
  'L16.0': 1, // T1 engineer, 3 fuel, 3 rocket, 3 artillery
  'L22.0': 2,
  'L24.0': 2,
  'L11.0': 2,
  'L17.0': 2,
  'SA-german': 2, // T2 2 armor, v.d. Heydte, inf replacement, reusable SA
  'L49.0': 3,
  'R16.0': 3,
  'R26.0': 3, // T3 HQ, Greif Bridge, Greif Interdict
  'R38.0': 4, // T4 6th Pz Army SA
  'L23.0': 5,
  'R12.0': 5,
  'L19.0': 5, // T5 armor, 10th SS released, armor replacement
  'L21.0': 6,
  'R39.0': 6,
  'L18.0': 6, // T6 elite armor, SA, non-elite inf replacement
  'R22.0': 7,
  'R23.0': 8,
  'R13.0': 8, // T7-8 Delayed Response x2, 17th SS PzGr released
  // Allied, 1st Army
  'L63.0': 2,
  'L65.0': 2,
  'L61.0': 2,
  'L62.0': 2,
  'L64.0': 2,
  'R71.0': 2,
  'SA-allied': 2, // T2 2 engineers, 3 artillery, Task Force, reusable SA
  'L83.0': 3,
  'L98.0': 3,
  'R33.0': 3,
  'R35.0': 3,
  'L48.0': 3, // T3 engineer, HQ, Delayed Response, Regiment 1st Inf, inf replacement
  'L81.0': 4,
  'L74.0': 4,
  'R82.0': 4,
  'R34.0': 4,
  'R36.0': 4, // T4 armor, artillery, Task Force, Delayed Response, Regiment
  'R46.0': 5,
  'R37.0': 5, // T5 1st Army SA, Regiment
  'L82.0': 6,
  'L84.0': 6,
  'L53.0': 6,
  'R41.0': 6,
  'L67.0': 6,
  'L57.0': 6, // T6 infantry, engineer, British armor, Air Mission, arm + inf replacements
  'L86.0': 7,
  'L75.0': 7,
  'L76.0': 7,
  'L51.0': 7,
  'R42.0': 7,
  'R42.1': 7,
  'R42.2': 7,
  'L68.0': 7, // T7 armor, 2 artillery, British artillery, 3 Air Missions, arm replacement
  'L78.0': 8,
  'R52.0': 8,
  'R52.1': 8,
  'L59.0': 8, // T8 artillery, 2 Air Missions, inf replacement
  'R62.0': 9,
  'L77.0': 9, // T9 Air Mission, arm replacement
};
/** Chit draws: the sheet gives two rows per side; like the map's Turn Track (TRACK) they are [German player turn, Allied player turn].
 *  Check: the campaign track has Allied T2 = [7, 0] and the sheet's Allied second row starts 0 at T2 as well (no Allied draw in their own first turn). */
const COLD_TRACK = [
  [0, 0, 0, 0],
  [5, 2, 4, 0],
  [5, 2, 4, 1],
  [4, 2, 4, 1],
  [4, 2, 4, 1],
  [4, 2, 5, 2],
  [3, 2, 5, 3],
  [3, 1, 6, 3],
  [2, 1, 6, 4],
].map(([a, b, c, d]) => ({ ge: [a, b], al: [c, d], sd: null }));
export const isZone = (a: number, z: number) => areas.get(a)?.zone === z;
function coldSetup(g: Game) {
  g.lastTurn = 9;
  g.track = COLD_TRACK;
  g.inPlay = [...areas.keys()].filter((a) => isZone(a, 6));
  g.supplyOnly = [...areas.keys()].filter((a) => isZone(a, 5)); // P.3 / P.6
  for (const u of g.units) {
    if (u.garrison) {
      if (u.area !== 32) ((u.area = null), (u.str = 0));
      continue;
    } // the garrison asset in Spa
    if (!(u.name in COLD_UNITS)) {
      u.area = null;
      u.arrival = undefined;
      u.str = 0;
      continue;
    }
    const at = COLD_UNITS[u.name];
    if (at != null) {
      u.area = at;
      u.arrival = undefined;
    } else u.area = null;
    if (COLD_ENTRY[u.name]) u.entry = COLD_ENTRY[u.name];
  }
  g.units = g.units.filter((u) => u.area != null || u.arrival != null || u.name === '10SS' || u.name === '17SS');
  g.chits = g.chits.filter((c) => COLD_CHITS[c.id] != null);
  for (const c of g.chits) {
    const t = COLD_CHITS[c.id];
    c.turn = t === 1 ? 'S' : t;
    c.box = t === 1 ? 'available' : 'future';
  }
  g.fieldWorks = [9, 10, 27];
  g.riverAssault = [];
  g.blown = [];
  g.markers = { german: { z5: 0, z6: 2, z7: 0 }, allied: { z56: 2, z7: 0 } }; // 2 Zone 6 reserve markers (one goes on Peiper), 2 Allied Zone 5/6
}
/** P.7: German-controlled Zone 6 areas (at the end of turn 9: 11+ German victory, 10 draw, 9 or less Allied victory). */
export const coldAreas = (g: Game) => [...areas.keys()].filter((a) => isZone(a, 6) && g.control[a] === 'german').length;
export function bulgeNewGame(seed: number, opts: Partial<Opts>): Game {
  const o: Opts = { scenario: 'tournament', fuel: true, ...opts },
    sc = scenJson.tournament,
    last = o.scenario === 'campaign' || o.scenario === 'cold' ? 9 : 5;
  const units: Unit[] = [];
  for (const r of unitsJson as RawUnit[]) {
    if (r.kind) continue;
    const max = r.steps!,
      red = (sc.reduced as Record<string, number>)[r.name] ?? (sc.reinforcementsReduced as Record<string, number>)[r.name];
    units.push({
      id: r.id,
      name: r.name,
      side: sideOf(r.side),
      cls: r.cls as 'armor' | 'infantry',
      q: r.quality_by_step!,
      max,
      str: red ?? max,
      area: r.start_area ?? null,
      disorder: 0,
      unsupplied: false,
      moved: false,
      reserve: null,
      exploit: false,
      arrival: r.arrival_turn,
      entry: r.entry,
      ech: r.echelon,
      symbol: r.symbol,
      code: r.start_area
        ? String(r.start_area)
        : r.arrival_turn
          ? `${r.arrival_turn}-${r.entry!.length > 1 ? r.entry![0] + r.entry![r.entry!.length - 1] : r.entry![0]}`
          : 'Res',
    });
  }
  for (const a of sc.garrisons)
    units.push({
      id: `G${a}`,
      name: `Garrison ${areas.get(a)!.name}`,
      side: 'allied',
      cls: 'infantry',
      q: ['green'],
      max: 1,
      str: 1,
      area: a,
      garrison: true,
      disorder: 0,
      unsupplied: false,
      moved: true,
      reserve: null,
      exploit: false,
    });
  const g: Game = {
    game: 'bulge',
    sides: ['german', 'allied'],
    turn: 1,
    lastTurn: last,
    phasing: 'german',
    phase: 'combat',
    units,
    chits: buildChits(last),
    control: {},
    fieldWorks: [...sc.fieldWorks],
    fwOwner: {},
    riverAssault: [...sc.riverAssault],
    blown: [...sc.blownBridges],
    contestedAtMoveStart: [],
    fought: [],
    markers: { german: { z5: 2, z6: 2, z7: 1 }, allied: { z56: 3, z7: 2 } },
    stratMoves: 0,
    riverCross: [],
    blowTried: [],
    entered: {},
    pendingBlow: null,
    greif: {},
    greifTried: [],
    fwBuilt: [],
    tfNew: [],
    elimLarge: [],
    captured: [],
    fuelAdded: false,
    opts: o,
    roadblocks: {},
    interdicted: {},
    pooled: null,
    airSupply: null,
    revealed: null,
    arrived: [],
    pendingArrivals: [],
    recover: [],
    battle: null,
    seed,
    rolls: 0,
    log: [],
  };
  let frontZ5: Record<number, Side> = {};
  if (o.scenario === 'cold') {
    setPlayArea(null);
    frontZ5 = campaignControl(units);
    coldSetup(g);
  } // Zone 5 keeps the campaign front line (P.3: Allied west of it)
  if (o.scenario === 'intro') introSetup(g);
  setPlayArea(g.inPlay);
  for (const fa of g.fieldWorks) g.fwOwner[fa] = units.some((u) => u.side === 'allied' && u.area === fa) ? 'allied' : 'german';
  if (o.scenario !== 'intro') {
    const peiper = units.find((u) => u.name === 'Peiper')!;
    peiper.reserve = 'z6';
    g.markers.german.z6--;
  }
  g.control = campaignControl(g.units);
  if (o.bridgeLimit) g.bridgesLeft = 6; // 18.1
  if (o.bid && o.bid > 0)
    for (let i = 0; i < o.bid; i++)
      g.chits.push({
        id: `BID-${i}`,
        name: 'Bid Fuel Asset',
        kind: 'fuel',
        side: 'german',
        ech: 'german',
        turn: 'S',
        box: 'available',
        bid: true,
      }); // 18.2 extra fuel, not recycled
  if (o.bid && o.bid < 0)
    for (const c of boxOf(g, 'german', 'available')
      .filter((x) => x.kind === 'fuel')
      .slice(0, Math.min(5, -o.bid)))
      c.box = 'used'; // 18.2 bidding to be the Germans: fewer starting fuel assets (they recycle normally)
  if (o.scenario === 'cold') for (const a of g.supplyOnly!) g.control[a] = frontZ5[a];
  say(g, `${SCEN_NAME[o.scenario]} scenario set up. All contested areas must be fought this phase.`);
  return g;
}
/** Area control from a deployment: the Allies hold their areas and everything west of the front (reachable without crossing a German area); the Germans the rest (P.3, 24.x). */
function campaignControl(units: Unit[]): Record<number, Side> {
  const ger = new Set(units.filter((u) => u.side === 'german' && u.area).map((u) => u.area!)),
    out: Record<number, Side> = {};
  const todo = units.filter((u) => u.side === 'allied' && u.area).map((u) => u.area!),
    seen = new Set(todo);
  while (todo.length)
    for (const n of neighbors(todo.pop()!))
      if (!seen.has(n) && !ger.has(n)) {
        seen.add(n);
        todo.push(n);
      }
  for (const a of areas.keys()) out[a] = seen.has(a) ? 'allied' : 'german';
  for (const a of [1, 2, 3, 4, 5, 6, 7, 8, 14, 15]) if (!units.some((u) => u.side === 'allied' && u.area === a)) out[a] = 'german';
  return out;
}
export const SCEN_NAME: Record<string, string> = {
  tournament: 'Tournament',
  campaign: 'Campaign',
  intro: 'Introductory (Nuts!)',
  cold: 'Cold Shoulder',
  badr: 'Operation Badr',
  badr_alt: 'Operation Badr, alternate set-up',
};
