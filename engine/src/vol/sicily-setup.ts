// FAB Vol. II, Sicily: the set-up. The scenarios' forces and chits (22.14, 22.24-22.26, 22.37), the Axis garrisons placed face down, the Allied landing plan (historical or alternate) and the invasion units in their beachhead boxes.
import { areas as mapAreas, setPlayArea } from '../map';
import { INVASION_CAPABLE, boxId, isBox } from '../sicily/map';
import { type Chit } from '../chits';
import { say, secureRandom, unitsIn, updateControl, type Game, type Opts, type Side, type Unit } from '../game';
import {
  CHIT_KINDS,
  COUNTERS,
  isSunrise,
  nation,
  need,
  onPhase,
  type Plan,
  PLANS,
  SCEN,
  SETUPS,
  type SicilyState,
  state,
  unit,
  UNITS,
} from './sicily';

/* ================= set-up (22.14, 22.24-22.26, 22.37) ================= */
export function newSicilyGame(seed: number, opts: Partial<Opts>): Game {
  setPlayArea(null);
  const scenario = ['sunrise_bridge', 'tournament', 'campaign', 'campaign_hist'].includes(opts.scenario ?? '')
      ? opts.scenario!
      : 'tournament',
    S = SETUPS[scenario === 'campaign_hist' ? 'campaign' : scenario];
  const sunrise = scenario === 'sunrise_bridge',
    hist = scenario === 'campaign_hist';
  const where = new Map(S.units.map((p) => [p.id, p])),
    fixedUntried = sunrise ? S.untried.areas! : hist ? S.historical_option!.untried_areas : null;
  const inScenario = new Set(S.units.map((p) => p.id)),
    later = new Map<string, { turn: number; entry: string[] }>();
  for (const [t, sides] of Object.entries(S.reinforcements ?? {}))
    for (const sd of Object.values(sides))
      for (const r of sd.units) later.set(r.id, { turn: +t, entry: r.entry.map((e) => (typeof e === 'number' ? `#${e}` : e)) });
  const untriedIds = sunrise ? S.untried.ids : UNITS.filter((u) => u.kind === 'untried').map((u) => u.id);
  const units: Unit[] = [];
  for (const u of UNITS) {
    if (u.kind === 'special_action_block') continue;
    const p = where.get(u.id),
      arr = later.get(u.id),
      untried = u.kind === 'untried';
    if (sunrise && !p && !arr && !untriedIds.includes(u.id)) continue; // Sunrise Bridge: only the Scenario Forces sheet
    const max = u.steps ?? 1;
    const x: Unit = {
      id: u.id,
      name: u.name,
      side: u.side,
      nation: u.nation,
      cls: (u.cls ?? 'infantry') as 'armor' | 'infantry',
      q: (u.quality_by_step ?? ['green']).map((q) => q ?? 'green'),
      max,
      str: max,
      area: null,
      disorder: 0,
      unsupplied: false,
      moved: false,
      reserve: null,
      exploit: false,
      ech: u.echelon,
      symbol: u.symbol,
      division: u.division ?? undefined,
      motorized: u.motorized || undefined,
      untried: untried || undefined,
      code:
        u.start_area != null
          ? String(u.start_area)
          : u.arrival === 'invasion'
            ? 'Inv'
            : untried
              ? 'S*'
              : u.arrival_turn
                ? String(u.arrival_turn)
                : '',
    };
    if (p?.area != null) x.area = p.area;
    else if (untried) x.box = 'deploy';
    else if (p?.box === 'airborne_assault' || (u.arrival === 'invasion' && u.symbol === 'airborne')) x.box = 'airborne_assault';
    else if (p?.box === 'at_sea' || u.arrival === 'invasion')
      x.box = 'deploy'; // the invasion units: placed on the beachheads once the landing plan is chosen
    else if (arr) {
      x.arrival = arr.turn;
      x.entry = arr.entry;
    } else if (!sunrise && u.arrival_turn) {
      x.arrival = u.arrival_turn;
      x.entry = u.entry;
    } else if (!sunrise) continue;
    if (!sunrise || p || arr || untriedIds.includes(u.id)) units.push(x);
  }
  const lastTurn = S.turns;
  const avail = new Set([...(S.available.allied ?? []), ...(S.available.axis ?? [])]),
    hold = S.holding_boxes;
  const laterChit = new Map<string, number>();
  for (const [t, sides] of Object.entries(S.reinforcements ?? {}))
    for (const sd of Object.values(sides)) for (const id of sd.chits) laterChit.set(id, +t);
  const chits: Chit[] = [];
  for (const c of COUNTERS) {
    if (!CHIT_KINDS.has(c.kind) || c.side === 'none') continue;
    for (const id of c.ids?.length ? c.ids : [c.id]) {
      let box: Chit['box'],
        turn: number | string | null = c.turn;
      if (avail.has(id)) {
        box = 'available';
        turn = 'S';
      } else if (hold.captured_airfields?.includes(id)) box = 'captured_airfields';
      else if (hold.captured_ports_vp?.includes(id)) box = 'captured_ports_vp';
      else if (sunrise) {
        if (!laterChit.has(id)) continue;
        box = 'future';
        turn = laterChit.get(id)!;
      } else if (typeof c.turn === 'number' && c.turn <= lastTurn) box = 'future';
      else continue;
      chits.push({
        id,
        counter: c.id,
        name: c.name,
        kind: c.kind,
        side: c.side,
        ech: c.echelon,
        q: c.quality ?? undefined,
        turn,
        box,
        division: c.division,
        subtype: c.subtype,
        nation: c.nation ?? undefined,
        strategic: c.red_flag || undefined,
        flank: c.flanking_invasion ? (c.flanking_invasion === 'once_per_game' ? 'once' : 'each') : undefined,
      });
    }
  }
  for (const u of UNITS.filter((x) => x.kind === 'special_action_block'))
    chits.push({
      id: u.id,
      counter: u.id,
      name: 'Special Action (reusable)',
      kind: 'sa_block',
      side: u.side,
      ech: u.side,
      turn: 2,
      box: 'future',
      nation: u.nation,
    }); // 8.1, from turn 2
  const control: Record<number, Side> = {};
  for (const a of mapAreas.keys()) if (!isBox(a) && (!S.areas_in_play || S.areas_in_play.includes(a))) control[a] = 'axis'; // 22.13, 22.23: all land areas start Axis-controlled
  const vol: SicilyState = {
    beachheads: {},
    captured: [],
    released: [],
    usReleased: false,
    morale: 0,
    moraleCup: 0,
    triggered: [],
    portDamage: { P1: 0, P2: 0, P3: 0 },
    portWorked: [],
    strat: {},
    extract: false,
    patton: false,
    airfieldsTaken: [],
    airfieldHoles: 0,
    flank: {},
    cdoUsed: false,
    beachAssault: {},
    dropPending: false,
    airborneAreas: [],
    navalShock: {},
    rangerFw: {},
    sunrise,
    sunriseZoneA: S.zones?.zone_a_areas ?? [],
  };
  const res = (ids: string[] | undefined) => ids?.length ?? 0;
  const markers = {
    allied: {
      us: res(hold.allied_reserve_markers?.filter((m) => m.startsWith('M01'))),
      br: res(hold.allied_reserve_markers?.filter((m) => m.startsWith('M02'))),
    },
    axis: { res: res(hold.axis_reserve_markers) + Object.keys(S.reserve_markers_on_units ?? {}).length },
  };
  const g: Game = {
    game: 'sicily',
    sides: ['allied', 'axis'],
    turn: 1,
    lastTurn,
    phasing: 'axis',
    phase: 'deploy',
    units,
    chits,
    control,
    fieldWorks: [],
    fwOwner: {},
    riverAssault: [],
    blown: [],
    contestedAtMoveStart: [],
    fought: [],
    markers,
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
    opts: { ...opts, scenario, fuel: false },
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
    vol: vol as unknown as Record<string, unknown>,
  };
  for (const id of S.reserve?.axis ?? []) {
    const u = g.units.find((x) => x.id === id);
    if (u) {
      u.reserve = 'res';
      g.markers.axis.res--;
    }
  } // 25R: the 15th PG starts in reserve
  if (S.areas_in_play) {
    g.inPlay = [...S.areas_in_play, ...(S.invasion?.beachheads ?? []).map(boxId), boxId('P1'), boxId('P2')];
    setPlayArea(g.inPlay);
  }
  if (S.track)
    g.track = Object.keys(S.track)
      .sort((a, b) => +a - +b)
      .map((k) => ({ ge: S.track![k].allied, al: S.track![k].axis, sd: null }));
  if (fixedUntried) autoUntried(g, fixedUntried); // 22.14, 22.37: the garrisons go where the scenario says, still shuffled
  if (sunrise) {
    choosePlan(g, 'historical', 'B1');
  } // 22.14: the five British beachheads are B1-B5
  else if (hist) choosePlan(g, 'historical', 'B1'); // 22.37: the historical landing plan, B1-B5
  say(
    g,
    sunrise
      ? 'Sunrise Bridge: the Axis garrisons are shuffled face down into areas 1-7, 13, 14 and 26; the British land at B1-B5. Place the invasion units on the beachheads, then the Allied Movement Phase of turn 1.'
      : `${S.name}: the Axis places its ${untriedIds.length} untried garrisons face down, one per area; the Allies then choose a landing plan, place the beachheads and the invasion units; then the Allied Movement Phase of turn 1 (the Admin Phase is skipped, 22.27).`,
  );
  return g;
}
/** A seeded shuffle that spends no dice (the set-up must not change the game's rolls; online, not from the shared seed). */
const shuffled = <T>(g: Game, xs: T[], salt: number) => {
  const sr = secureRandom();
  let h = ((sr == null ? g.seed : Math.floor(sr * 2 ** 32)) ^ salt) >>> 0;
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** 15.3: the untried garrisons go face down at random, one per listed area. */
function autoUntried(g: Game, areas: number[]) {
  const pool = shuffled(
    g,
    g.units.filter((u) => u.untried && u.box === 'deploy'),
    11,
  );
  for (const a of shuffled(g, areas, 13)) {
    const u = pool.shift();
    if (!u) break;
    u.box = undefined;
    u.area = a;
  }
}
/** The areas an untried garrison may still be placed in (22.24: anywhere, one per area, not with two tried units), or a beachhead box for an invasion unit. */
export function deployOptions(g: Game, unitId: string): number[] {
  const u = unit(g, unitId);
  if (g.phase !== 'deploy' || u.box !== 'deploy') return [];
  if (u.untried)
    return [...mapAreas.keys()].filter(
      (a) =>
        !isBox(a) &&
        (!g.inPlay || g.inPlay.includes(a)) &&
        !unitsIn(g, a).some((x) => x.untried) &&
        unitsIn(g, a, 'axis').filter((x) => !x.untried).length < 2,
    );
  const V = state(g);
  if (!V.plan) return [];
  return Object.keys(V.beachheads)
    .map(Number)
    .filter((b) => V.beachheads[b] === nation(u) && unitsIn(g, b).length < 2); // 14.24: two units per box
}
export function deploy(g: Game, unitId: string, a: number) {
  need(deployOptions(g, unitId).includes(a), 'not a set-up area for this unit');
  const u = unit(g, unitId);
  u.box = undefined;
  u.area = a;
  if (!isBox(a)) updateControl(g, a);
}
/** The quick set-up: the garrisons at random, the historical plan from B1, the invasion units two per beachhead. */
export function autoDeploy(g: Game) {
  need(g.phase === 'deploy', 'only while setting up');
  autoGarrisons(g);
  if (!state(g).plan) choosePlan(g, 'historical', 'B1', 'D1');
  autoLanding(g);
}
/** 22.24: the Axis garrisons still to place go at random (one per area, never with two tried units). */
export function autoGarrisons(g: Game) {
  for (const u of shuffled(
    g,
    g.units.filter((x) => x.untried && x.box === 'deploy'),
    17,
  )) {
    const o = deployOptions(g, u.id);
    if (o.length) deploy(g, u.id, shuffled(g, o, u.id.charCodeAt(2) + u.id.charCodeAt(3))[0]);
  }
}
/** 14.24: the invasion units still to place go two per beachhead of their nationality. */
export function autoLanding(g: Game) {
  for (const u of g.units.filter((x) => x.box === 'deploy' && !x.untried)) {
    const o = deployOptions(g, u.id);
    if (o.length) deploy(g, u.id, o[0]);
  }
}
/** 22.25 / 22.26: the landing plan. `british` is the first of the five consecutive British boxes, `us` the first of the four US boxes (alternate plan only). */
export function planOptions(g: Game, plan: Plan): { british: string[]; us: string[] } {
  if (isSunrise(g) || g.opts.scenario === 'campaign_hist') return { british: ['B1'], us: [] };
  const def = PLANS[plan],
    starts = (d: { consecutive_in?: string[]; beachheads: number }) =>
      (d.consecutive_in ?? []).slice(0, (d.consecutive_in?.length ?? 0) - d.beachheads + 1);
  return { british: starts(def.british), us: def.us.consecutive_in ? starts(def.us) : [] };
}
export function choosePlan(g: Game, plan: Plan, british: string, us?: string) {
  need(g.phase === 'deploy' && !state(g).plan, 'the landing plan is chosen once, while setting up');
  need(!g.units.some((u) => u.untried && u.box === 'deploy'), 'the Axis places its garrisons first (22.24)');
  const o = planOptions(g, plan);
  need(o.british.includes(british), 'not a legal first British landing box');
  const V = state(g),
    def = PLANS[plan],
    S = SCEN(g);
  const seq = (list: string[], first: string, n: number) => list.slice(list.indexOf(first), list.indexOf(first) + n);
  const br = isSunrise(g) ? S.invasion!.beachheads : seq(def.british.consecutive_in!, british, def.british.beachheads);
  let usb: string[] = [];
  if (!isSunrise(g)) {
    if (def.us.boxes) usb = def.us.boxes;
    else {
      need(us && o.us.includes(us), 'not a legal first American landing box');
      usb = seq(def.us.consecutive_in!, us!, def.us.beachheads);
    }
  }
  V.plan = plan;
  V.beachheads = {};
  for (const b of br) {
    V.beachheads[boxId(b)] = 'british';
    g.control[boxId(b)] = 'allied';
  }
  for (const b of usb) {
    V.beachheads[boxId(b)] = 'us';
    g.control[boxId(b)] = 'allied';
  }
  placeFieldWorks(g);
  say(
    g,
    `${plan === 'historical' ? 'Historical' : 'Alternate'} landing plan: British beachheads ${br.join(', ')}${usb.length ? `, American beachheads ${usb.join(', ')}` : ''} (${plan === 'historical' ? '22.25' : '22.26'})`,
    'allied',
  );
}
/** 22.14, 22.24: once the Axis set-up is done, a field works marker on each invasion-capable coastal area holding an Axis unit. */
function placeFieldWorks(g: Game) {
  for (const a of INVASION_CAPABLE)
    if ((!g.inPlay || g.inPlay.includes(a)) && unitsIn(g, a, 'axis').length && !g.fieldWorks.includes(a)) {
      g.fieldWorks.push(a);
      g.fwOwner[a] = 'axis';
    }
}
export function onDeployEnd(g: Game) {
  need(!g.units.some((u) => u.untried && u.box === 'deploy'), 'place every Axis garrison first (22.24)');
  need(!!state(g).plan, 'choose the Allied landing plan first (22.24)');
  need(!g.units.some((u) => u.box === 'deploy'), 'place every invasion unit on a beachhead first (14.24)');
}
/** End of the set-up: the Allied Operational Movement Phase of turn 1 (the Admin Phase is skipped, 22.27). */
export function afterDeploy(g: Game) {
  g.phase = 'movement';
  g.phasing = 'allied';
  g.units.forEach((u) => {
    u.moved = false;
    u.spent = 0;
  });
  g.contestedAtMoveStart = [];
  g.stratMoves = 0;
  onPhase(g, 'movement', 'start');
  return true;
}
