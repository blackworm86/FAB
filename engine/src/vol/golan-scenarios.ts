// FAB Vol. III, Golan '73: the two smaller scenarios. The Battle for Nafakh (22.4: its own map sheet, four turns) and Operation Al-Owda (20.3: the hypothetical Israeli-surprise game, with its side cards, ghosts and commandos).
import setupsJson from '../../../data/golan73/setups.json';
import { areas, edgeKey } from '../map';
import { HERMON, NAF_NORTH, REAR, isAssembly } from '../golan/map';
import { blocks, chit, contested, needAdmin, rngf, say, spendSA, unitsIn, type Game, type Side, type Unit } from '../game';
import { asGarrison, isAlOwda, isNafakh, nameOf, need, regular, state, unit, vacant, WEST_OF_JORDAN } from './golan';

/* ================= 22.4 Battle for Nafakh: its own map sheet, four turns, from the Syrian Movement Phase of turn 1 ================= */
type Nafakh = {
  turns: number;
  areas_in_play: number[];
  units: { id: string; area?: number; box?: string; recovering?: boolean }[];
  reduced: Record<string, number>;
  on_map_chits: { id: string; area: number }[];
  garrisons: { id: string; area: number }[];
  available: Record<Side, string[]>;
  minefields: { fixed: number[][]; player_placed?: number };
  reserve: { markers: Record<Side, number> };
  special_action_release: { id: string; turns: number[] };
  reinforcements: Record<string, Record<Side, { units: { id: string; entry: string[]; steps?: number }[]; chits: string[] }>>;
  sheet: {
    entry: Record<string, number>;
    control_israeli: number[];
    supply: Record<Side, number[]>;
    track: Record<string, Record<Side, number[]>>;
  };
};
export const NAF = (setupsJson as unknown as Record<string, Nafakh>).nafakh;
const nafBox = (b: string) => (b === 'northern_assembly' ? NAF_NORTH : b === 'syrian_rear_area' ? REAR : NAF.sheet.entry[b]);
export function nafakhSetup(g: Game): Game {
  g.opts = { scenario: 'nafakh', fuel: false };
  g.lastTurn = NAF.turns;
  g.phasing = 'israeli';
  g.phase = 'deploy';
  g.log = []; // 22.44: Israel lays its minefield and may mark one reserve, then the Syrian Movement Phase of turn 1
  g.inPlay = [...NAF.areas_in_play, NAF_NORTH, REAR];
  g.track = Array.from({ length: NAF.turns }, (_, i) => ({
    ge: NAF.sheet.track[i + 1].syrian,
    al: NAF.sheet.track[i + 1].israeli,
    sd: null,
  }));
  g.riverAssault = [];
  g.fieldWorks = [];
  g.markers = { syrian: { res: NAF.reserve.markers.syrian }, israeli: { res: NAF.reserve.markers.israeli } };
  const V = state(g);
  V.freeCombatRound = 0;
  V.minefields = NAF.minefields.fixed.map(([a, b]) => edgeKey(a, b));
  V.nafakh = { s03Free: false, golani: false, staffOut: false };
  V.minesLeft = NAF.minefields.player_placed ?? 0;
  V.startAt = 'movement';
  const place = new Map(NAF.units.map((p) => [p.id, p])),
    arrive = new Map<string, { turn: number; entry: string[]; steps?: number }>();
  for (const [t, sides] of Object.entries(NAF.reinforcements))
    for (const s of ['israeli', 'syrian'] as const)
      for (const r of sides[s].units) arrive.set(r.id, { turn: +t, entry: r.entry, steps: r.steps });
  g.units = g.units.filter((u) => !u.garrison && (place.has(u.id) || arrive.has(u.id) || u.id === NAF.special_action_release.id));
  for (const u of g.units) {
    const p = place.get(u.id),
      a = arrive.get(u.id);
    Object.assign(u, {
      reserve: null,
      from: undefined,
      disorder: 0,
      str: NAF.reduced[u.id] ?? u.max,
      arrival: undefined,
      entry: undefined,
      box: undefined,
      area: null,
    });
    if (p) {
      u.area = p.area ?? nafBox(p.box!);
      if (p.recovering) u.disorder = 2;
    } // 22.46: the 52nd starts recovering
    else if (a) {
      u.arrival = a.turn;
      u.entry = a.entry.map((e) => `#${nafBox(e)}`);
      if (a.steps) u.str = a.steps;
    } // 22.45: full strength unless listed reduced
    else u.box = 'sa_release'; // Golani: only by a Special Action on turns 3-4
  }
  const avail = new Set([...NAF.available.israeli, ...NAF.available.syrian]),
    later = new Map<string, number>(),
    onMap = new Map([...NAF.on_map_chits, ...NAF.garrisons].map((x) => [x.id, x.area]));
  for (const [t, sides] of Object.entries(NAF.reinforcements))
    for (const s of ['israeli', 'syrian'] as const) for (const id of sides[s].chits) later.set(id, +t);
  g.chits = g.chits.filter((c) => avail.has(c.id) || later.has(c.id) || onMap.has(c.id));
  for (const c of g.chits) {
    c.area = undefined;
    c.mission = undefined;
    if (onMap.has(c.id)) {
      c.box = 'map';
      c.area = onMap.get(c.id);
      c.turn = 'S';
    } else if (avail.has(c.id)) {
      c.box = 'available';
      c.turn = 'S';
    } else {
      c.box = 'future';
      c.turn = later.get(c.id)!;
    }
  }
  for (const c of g.chits.filter((x) => x.box === 'map')) {
    // the garrisons, and Lt. Zvika already in Sindiana
    if (c.kind === 'garrison') g.units.push(asGarrison(c, 'G', c.area!));
    if (c.kind === 'event_lt_zvika') {
      c.q = 'elite';
      g.units.push(asGarrison(c, 'Z', c.area!, 'armor', 'elite'));
    }
  }
  for (const a of NAF.areas_in_play) g.control[a] = NAF.sheet.control_israeli.includes(a) ? 'israeli' : 'syrian'; // 22.43
  g.control[NAF_NORTH] = 'israeli';
  g.control[REAR] = 'syrian';
  say(
    g,
    'Battle for Nafakh, October 7th AM: the 1st Tank Division drives on the Israeli command centre. Israel lays one minefield (the one between Ein Zivan and Bunker 109 is already there) and may put a reserve marker on one unit; then the Syrian Movement Phase of turn 1.',
  );
  return g;
}
/** 22.46: the 33rd may leave Tel Fazra only once a Special Action is spent on it. */
export function freeThe33rd(g: Game, chitId?: string) {
  const V = state(g);
  need(isNafakh(g) && V.nafakh && !V.nafakh.s03Free, 'the 33rd is already free to move');
  need(g.phasing === 'syrian' && (g.phase === 'admin' || g.phase === 'movement'), 'in the Syrian Admin or Movement Phase');
  spendSA(g, 'syrian', undefined, 'the 33rd leaves its mop-up of the AT ditch crossings (22.46)', chitId);
  V.nafakh!.s03Free = true;
}
/** 22.45: on turns 3-4 a Special Action brings Golani into play at the sheet's Israeli entry area (beside Oretal). */
export function releaseGolani(g: Game, chitId?: string) {
  const V = state(g),
    u = unit(g, NAF.special_action_release.id),
    at = NAF.sheet.entry.A;
  need(isNafakh(g) && V.nafakh && u.box === 'sa_release', 'Golani is not waiting to be released');
  needAdmin(g, 'israeli');
  need(g.phasing === 'israeli' && NAF.special_action_release.turns.includes(g.turn), 'in the Israeli Admin Phase of turn 3 or 4');
  need(
    g.control[at] === 'israeli' && !unitsIn(g, at, 'syrian').length && blocks(g, at, 'israeli').length < 2,
    `${nameOf(at)} must be Israeli-held with room for a unit`,
  );
  spendSA(g, 'israeli', undefined, 'Golani released (22.45)', chitId);
  u.box = undefined;
  u.area = at;
  V.nafakh!.golani = true;
  say(g, `Golani enters at ${nameOf(at)}`, 'israeli');
}
/** 22.46: whenever Syria holds Nafakh, the Israeli reusable Special Action is lost and the HQ Staff goes to the cup; drawing it brings the Special Action back. */
export function nafakhStaff(g: Game) {
  const V = state(g);
  if (!isNafakh(g) || !V.nafakh) return;
  const staff = g.chits.find((c) => c.kind === 'command_staff' && c.side === 'israeli'),
    sa = g.chits.find((c) => c.kind === 'sa_block' && c.side === 'israeli');
  if (g.control[42] === 'syrian' && staff?.box === 'map') {
    staff.box = 'cup';
    staff.area = undefined;
    V.nafakh.staffOut = true;
    if (sa && sa.box !== 'future') sa.box = 'eliminated';
    say(g, 'Syria holds Nafakh: the Israeli reusable Special Action is lost; the HQ Staff goes into the cup (22.46)', 'israeli');
  }
  if (V.nafakh.staffOut && staff && staff.box !== 'cup' && staff.box !== 'map') {
    V.nafakh.staffOut = false;
    if (sa && sa.box === 'eliminated') {
      sa.box = 'available';
      say(g, 'The HQ Staff is back: the reusable Special Action returns (22.46)', 'israeli');
    }
  }
}
/** 22.47: strength points of regular units in Nafakh. */
export const strengthIn = (g: Game, side: Side) =>
  unitsIn(g, 42, side)
    .filter(regular)
    .reduce((s, u) => s + u.str, 0);
export function nafakhResult(g: Game) {
  const held = g.control[42],
    clear = held && !contested(g, 42);
  if (clear) return `${held === 'syrian' ? 'Syrian' : 'Israeli'} Decisive Victory: uncontested control of Nafakh (22.47)`;
  const s = strengthIn(g, 'syrian'),
    i = strengthIn(g, 'israeli');
  return `${s > i ? 'Syrian' : 'Israeli'} Marginal Victory: ${Math.max(s, i)} to ${Math.min(s, i)} strength points in Nafakh${s === i ? ', a tie goes to Israel' : ''} (22.47)`;
}

/* ================= 20.3 Operation Al-Owda (hypothetical): the whole map but Mt Hermon, six turns, the Syrians place their own units =================
   From the scenario rules, the Al-Owda Setup Cards, Turn Track and Reference Map (data/golan73/setups.json "alowda"). */
type SideCard = { available: string[]; chits: Record<string, string[]>; reserve_markers: number; start?: Record<string, number> };
type AlOwda = {
  turns: number;
  out_of_play: { units: string[] };
  track: Record<string, Record<Side, [number, number]>>;
  vp_line_east: number[];
  israeli: SideCard & {
    air_support_holding: string[];
    garrisons: number[];
    vp: number;
    fixed_reinforcements: Record<string, { id: string; entry: string[] }[]>;
    draw_cup: {
      start: string[];
      ghosts: number;
      added: Record<string, string[]>;
      draws: Record<string, number>;
      entry: Record<string, string[]>;
    };
  };
  syrian: SideCard & { commando_landing: string[]; reinforcements: Record<string, string[]>; entry: string[] };
};
export const ALO = (setupsJson as unknown as Record<string, AlOwda>).alowda;
export const VP_EAST = new Set(ALO.vp_line_east);
export function alowdaSetup(g: Game): Game {
  g.opts = { scenario: 'alowda', fuel: false };
  g.lastTurn = ALO.turns;
  g.phase = 'deploy';
  g.phasing = 'syrian';
  g.log = [];
  g.inPlay = [...areas.keys()].filter((a) => a !== HERMON && a !== REAR && a !== NAF_NORTH); // 20.37: Mt Hermon is already Syrian; no sudden death
  g.track = Array.from({ length: ALO.turns }, (_, i) => ({
    ge: ALO.track[String(i + 1)].syrian,
    al: ALO.track[String(i + 1)].israeli,
    sd: null,
  })); // the Al-Owda Turn Track: no sudden death
  g.riverAssault = [];
  g.control[HERMON] = 'syrian';
  const V = state(g);
  V.freeCombatRound = 0;
  V.startAt = 'movement';
  const I = ALO.israeli,
    S = ALO.syrian,
    cup = I.draw_cup;
  V.alowda = { raids: 0, cup: [...cup.start, ...Array.from({ length: cup.ghosts }, (_, k) => `ghost${k + 1}`)], drawn: [] };
  const fixed = new Map(
    Object.entries(I.fixed_reinforcements).flatMap(([t, l]) => l.map((r) => [r.id, { turn: +t, entry: r.entry }] as const)),
  );
  const syArr = new Map(Object.entries(S.reinforcements).flatMap(([t, l]) => l.map((id) => [id, +t] as const)));
  const cupIds = new Set([...cup.start, ...Object.values(cup.added).flat()]);
  g.units = g.units.filter((u) => !ALO.out_of_play.units.includes(u.id) && !(u.garrison && !I.garrisons.includes(u.area ?? -1))); // garrisons: only those on the card (not Mt Hermon)
  for (const u of g.units) {
    u.reserve = null;
    u.from = undefined;
    if (u.side === 'syrian' && regular(u) && u.area != null) {
      u.box = 'deploy';
      u.area = null;
    } // 20.35: the sixteen at the player's discretion
    if (syArr.has(u.id)) {
      u.box = undefined;
      u.area = null;
      u.arrival = syArr.get(u.id);
      u.entry = [...S.entry];
    } // 20.36: any friendly Entry Area V-Z; no Operational or Strategic Reserve
    if (I.start?.[u.id] != null) {
      u.area = I.start[u.id];
      u.box = undefined;
    } // 20.34: the area printed on the block on the card
    if (fixed.has(u.id)) {
      u.arrival = fixed.get(u.id)!.turn;
      u.entry = fixed.get(u.id)!.entry;
    }
    if (cupIds.has(u.id)) {
      u.arrival = undefined;
      u.entry = cup.entry[u.id];
      u.box = cup.start.includes(u.id) ? 'draw_cup' : 'draw_later';
    }
  }
  const avail = new Set([...I.available, ...S.available]),
    holding = new Set(I.air_support_holding),
    landing = new Set(S.commando_landing);
  const at = new Map<string, number>();
  for (const side of [I, S]) for (const [t, l] of Object.entries(side.chits)) for (const id of l) at.set(id, +t);
  g.chits = g.chits.filter(
    (c) =>
      c.kind === 'sa_block' ||
      c.box === 'evacuated_strongpoints' ||
      (c.kind === 'garrison' && c.box === 'map' && I.garrisons.includes(c.area ?? -1)) ||
      avail.has(c.id) ||
      holding.has(c.id) ||
      landing.has(c.id) ||
      at.has(c.id),
  );
  for (const c of g.chits) {
    if (c.kind === 'sa_block' || c.box === 'evacuated_strongpoints' || c.kind === 'garrison') continue;
    if (avail.has(c.id) || landing.has(c.id)) {
      c.box = 'available';
      c.turn = 'S';
    } else if (holding.has(c.id)) c.box = 'air_support_holding';
    else {
      c.box = 'future';
      c.turn = at.get(c.id)!;
    } // the turn on the card, not the label (20.36)
  }
  g.markers = { syrian: { res: S.reserve_markers }, israeli: { res: I.reserve_markers } };
  say(
    g,
    'Operation Al-Owda: the Syrian plan to attack at dawn. Israel places its strongpoints and ghosts and its four reserve markers; Syria places its sixteen units, one per tank-symbol area, its two reserve markers, and lands the 181st and 182nd commandos; then the Syrian Movement Phase of turn 1.',
  );
  return g;
}
/** 20.36: at the start of each Israeli Reinforcement Phase, the listed units go into the Draw Cup, then the listed number is drawn at random; drawn ghosts are set aside. */
/** Advanced ghosts: a ghost drawn from the cup arrives in either Assembly Area, like a unit. */
function newGhost(g: Game): Unit {
  const tpl = g.units.find((u) => u.ghost)!,
    V = state(g),
    n = (V.ghostsMade = (V.ghostsMade ?? 0) + 1);
  const u: Unit = {
    ...JSON.parse(JSON.stringify(tpl)),
    id: `GH${n}`,
    area: null,
    box: undefined,
    str: 1,
    reserve: null,
    moved: false,
    disorder: 0,
    arrival: g.turn,
    entry: ['A', 'B'],
  };
  g.units.push(u);
  return u;
}
export function alowdaDraw(g: Game) {
  const V = state(g),
    A = V.alowda,
    cup = ALO.israeli.draw_cup;
  if (!isAlOwda(g) || !A?.cup) return;
  for (const id of cup.added[String(g.turn)] ?? []) {
    A.cup.push(id);
    unit(g, id).box = 'draw_cup';
  }
  const n = Math.min(cup.draws[String(g.turn)] ?? 0, A.cup.length),
    got: string[] = [];
  for (let k = 0; k < n; k++) {
    const pick = A.cup.splice(Math.floor(rngf(g) * A.cup.length), 1)[0];
    A.drawn!.push(pick); // a uniform draw that spends no dice
    if (pick.startsWith('ghost')) {
      if (g.opts.advGhosts) {
        got.push(newGhost(g).name);
        continue;
      }
      got.push('a ghost (set aside)');
      continue;
    }
    const u = unit(g, pick);
    u.box = undefined;
    u.arrival = g.turn;
    got.push(u.name);
  }
  if (n) say(g, `Reinforcements Draw Cup: ${got.join(', ')} (20.36)`, 'israeli');
}
/** 20.35: while setting up, Syria lands its two commandos in vacant Israeli-held areas east of the Jordan, not on Mt Hermon or Ma'agan. */
/** The two commandos the card lands at the start, still to place. */
export const alowdaCommandos = (g: Game) =>
  isAlOwda(g) && g.phase === 'deploy' ? g.chits.filter((c) => ALO.syrian.commando_landing.includes(c.id) && c.box === 'available') : [];
export const alowdaRaidAreas = (g: Game) =>
  isAlOwda(g) && g.phase === 'deploy' && alowdaCommandos(g).length > 0
    ? [...areas.keys()].filter(
        (a) => !isAssembly(a) && a !== HERMON && a !== 17 && !WEST_OF_JORDAN.includes(a) && g.control[a] === 'israeli' && vacant(g, a),
      )
    : [];
export function alowdaRaid(g: Game, chitId: string, a: number) {
  need(alowdaRaidAreas(g).includes(a), "a vacant Israeli-held area east of the Jordan (not Mt Hermon or Ma'agan)");
  const c = chit(g, chitId);
  need(ALO.syrian.commando_landing.includes(c.id) && c.box === 'available', 'the 181st or 182nd commandos (Al-Owda Setup Card)');
  c.box = 'map';
  c.area = a;
  g.units = g.units.filter((x) => x.id !== `R-${c.id}`);
  g.units.push(asGarrison(c, 'R', a, 'infantry', c.q ?? 'veteran'));
  state(g).raids.push(a);
  state(g).alowda!.raids++;
  say(g, `Commandos land in ${nameOf(a)} (20.35)`, 'syrian');
}
