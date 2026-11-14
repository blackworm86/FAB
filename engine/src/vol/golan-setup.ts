// FAB Vol. III, Golan '73: the set-up. Operation Badr (22.1) and the alternate set-up (22.2, 22.24, 22.25), the Israeli player's strongpoints, ghosts and minefields (15.6, 15.7, 14.02), the Syrian reserves.
import { areas, connection, edgeKey, neighbors, setPlayArea } from '../map';
import { ASSEMBLY, HERMON, connections, isAssembly, area as garea } from '../golan/map';
import { type Chit } from '../chits';
import { blocks, say, secureRandom, sidesOf, unitsIn, updateControl, type Game, type Opts, type Side, type Unit } from '../game';
import {
  ALO,
  alowdaSetup,
  asGarrison,
  COUNTERS,
  type GolanState,
  isAlOwda,
  isNafakh,
  nafakhSetup,
  nameOf,
  need,
  NOT_CHITS,
  PURPLE,
  regular,
  SETUPS,
  state,
  SUGGESTED,
  unit,
  UNITS,
} from './golan';

/* ================= set-up (22.1 Operation Badr, 22.2 the alternate set-up) ================= */
/** A new game: the scenario's own set-up, keeping the optional rules the players chose. */
export function newGolanGame(seed: number, opts: Partial<Opts>): Game {
  const g = buildGolanGame(seed, opts);
  g.opts = { ...opts, scenario: g.opts.scenario, fuel: false };
  return g;
}
function buildGolanGame(seed: number, opts: Partial<{ scenario: string }>): Game {
  setPlayArea(null); // whatever the last game played on
  if (opts.scenario === 'nafakh') {
    const g = nafakhSetup(newGolanGame(seed, { scenario: 'badr' }));
    setPlayArea(g.inPlay);
    return g;
  }
  if (opts.scenario === 'alowda') {
    const g = alowdaSetup(newGolanGame(seed, { scenario: 'badr' }));
    setPlayArea(g.inPlay);
    return g;
  }
  const scenario = opts.scenario === 'badr_alt' ? 'badr_alt' : 'badr',
    S = SETUPS.badr; // badr_alt shares everything but the free placement (22.24/22.25)
  const where = new Map(S.units.map((p) => [p.id, p]));
  const units: Unit[] = UNITS.filter((u) => u.kind !== 'special_action_block').map((u) => {
    const p = where.get(u.id),
      max = u.steps ?? 1,
      kind = u.kind === 'strongpoint' || u.kind === 'ghost' ? u.kind : undefined,
      area = p?.area ?? null;
    const box =
      area != null
        ? undefined
        : ['operational_reserve', 'strategic_reserve', 'air_assault'].includes(p?.box ?? '')
          ? p!.box
          : kind
            ? 'deploy'
            : undefined; // 15.6/15.7: the Israeli player places every strongpoint and ghost at the start
    return {
      id: u.id,
      name: u.name,
      side: u.side,
      cls: (u.cls ?? 'infantry') as 'armor' | 'infantry',
      q: (u.quality_by_step ?? []).map((x) => x ?? 'veteran'),
      max,
      str: S.reduced?.[u.id] ?? u.initial_steps ?? max,
      area,
      box,
      disorder: 0,
      unsupplied: false,
      moved: false,
      reserve: null,
      exploit: false,
      arrival: u.arrival_turn,
      entry: u.entry,
      symbol: u.symbol,
      division: u.division ?? undefined,
      brigade: u.brigade ?? undefined,
      kind,
      fort: kind === 'strongpoint' ? (u.symbol === 'armor' ? 'armor' : 'infantry') : undefined,
      ghost: kind === 'ghost' || undefined,
      code:
        area != null
          ? String(area)
          : u.arrival_turn
            ? `${u.arrival_turn}-${(u.entry ?? []).join('')}`
            : box === 'operational_reserve'
              ? 'OR'
              : box === 'strategic_reserve'
                ? 'SR'
                : box === 'air_assault'
                  ? 'AA'
                  : '',
    };
  });
  const avail = new Set([...(S.available?.syrian ?? []), ...(S.available?.israeli ?? [])]),
    hold = S.holding_boxes ?? {};
  const inHold = (id: string) =>
    hold.air_support_holding?.includes(id)
      ? 'air_support_holding'
      : hold.evacuated_strongpoints?.includes(id)
        ? 'evacuated_strongpoints'
        : null;
  const garrison = new Map((S.garrisons ?? []).map((x) => [x.id, x.area]));
  const chits: Chit[] = [];
  for (const c of COUNTERS) {
    if (NOT_CHITS.has(c.kind) || c.side === 'none') continue;
    for (const id of c.ids?.length ? c.ids : [c.id]) {
      const box = garrison.has(c.id) ? 'map' : (inHold(id) ?? (c.turn === 'S' || avail.has(id) ? 'available' : 'future'));
      const ch: Chit = {
        id,
        counter: c.id,
        name: c.name,
        kind: c.kind,
        side: c.side,
        ech: '',
        q: c.quality ?? undefined,
        turn: c.turn,
        box,
        area: garrison.get(c.id),
        brigade: c.brigade,
      };
      chits.push(ch);
      if (garrison.has(c.id)) units.push(asGarrison(ch, 'G', garrison.get(c.id)!));
    }
  }
  for (const u of UNITS.filter((x) => x.kind === 'special_action_block'))
    chits.push({
      id: u.id,
      counter: u.id,
      name: u.name,
      kind: 'sa_block',
      side: u.side,
      ech: '',
      turn: u.arrival_turn ?? 2,
      box: 'future',
    }); // 8.1, from turn 2
  const control: Record<number, Side> = { [ASSEMBLY.A]: 'israeli', [ASSEMBLY.B]: 'israeli' };
  for (const a of areas.keys()) if (!isAssembly(a)) control[a] = garea(a).syria ? 'syrian' : 'israeli'; // 22.13: everything west of the Purple Line is Israeli
  const vol: GolanState = {
    minefields: (S.minefields?.fixed ?? []).map(([a, b]) => edgeKey(a, b)),
    bridgedDitch: [],
    raids: [],
    raidPartial: [],
    crossed: [],
    minefieldFailed: [],
    assaultEntered: {},
    kingHassan: false,
    freeCombatRound: scenario === 'badr' ? 2 : 0,
    purpleLineCrossed: false,
    airReleased: 0,
    hermonLost: false,
    minesLeft: S.minefields?.player_placed ?? 3,
    startAt: scenario === 'badr' ? 'combat' : 'movement',
  };
  const g: Game = {
    game: 'golan73',
    sides: ['syrian', 'israeli'],
    turn: 1,
    lastTurn: S.turns,
    phasing: 'syrian',
    phase: 'combat',
    units,
    chits,
    control,
    fieldWorks: [],
    fwOwner: {},
    riverAssault: scenario === 'badr' ? [...(S.riverAssault ?? [])] : [],
    blown: [],
    contestedAtMoveStart: [],
    fought: [],
    markers: { syrian: { res: 2 }, israeli: { res: 4 } },
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
    opts: { scenario, fuel: false },
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
  for (const a of g.riverAssault)
    for (const u of unitsIn(g, a, 'syrian')) u.from = neighbors(a).find((n) => connection(a, n)!.atDitch && g.control[n] === 'syrian'); // the bridgeheads came across the ditch
  if (scenario === 'badr')
    for (const id of S.reserve?.syrian ?? []) {
      g.units.find((u) => u.id === id)!.reserve = 'res';
      g.markers.syrian.res--;
    }
  if (scenario === 'badr_alt')
    // 22.24/22.25: the players place their regular units too
    for (const u of g.units)
      if (u.area != null && regular(u) && u.id !== 'S17') {
        u.box = 'deploy';
        u.area = null;
        u.from = undefined;
      }
  g.phase = 'deploy';
  g.phasing = 'israeli'; // 22.14/22.24: the Israeli player places strongpoints, ghosts and three minefields first
  say(
    g,
    scenario === 'badr'
      ? 'Operation Badr: the Syrian assault has crossed the Purple Line. Israel places its strongpoints and ghosts face-down, one per Purple Line area, and three minefields; then the Syrian Combat Phase of turn 1.'
      : 'Operation Badr, alternate set-up: Israel places its strongpoints, ghosts, minefields and regular units, Syria its sixteen units and two reserve markers; then the Syrian Movement Phase of turn 1.',
  );
  return g;
}

/* ---------- the alternate set-up (22.24, 22.25) and the Israeli player's strongpoint placement (15.7) ---------- */
export function deployOptions(g: Game, unitId: string): number[] {
  const u = unit(g, unitId);
  if (g.phase !== 'deploy' || u.box !== 'deploy') return [];
  const ids = [...areas.keys()].filter((a) => !isAssembly(a));
  if (u.fort || u.ghost) return PURPLE.filter((a) => g.inPlay?.includes(a) !== false && !unitsIn(g, a).some((x) => x.fort || x.ghost)); // 15.7: one strongpoint or ghost in each area next to the Purple Line
  if (u.side === 'israeli')
    return ids.filter((a) => a !== HERMON && !garea(a).syria && !PURPLE.includes(a) && blocks(g, a, 'israeli').filter(regular).length < 2); // 22.24 and the set-up card: not next to the Purple Line
  if (isAlOwda(g)) return ids.filter((a) => garea(a).altSetup && !unitsIn(g, a, 'syrian').length); // 20.35: any tank-symbol area, one unit each
  return ids.filter((a) => garea(a).altSetup === u.division && !unitsIn(g, a, 'syrian').length); // one unit per tank symbol of its division colour
}
export function deploy(g: Game, unitId: string, a: number) {
  need(deployOptions(g, unitId).includes(a), 'not a set-up area for this unit');
  const u = unit(g, unitId);
  u.box = undefined;
  u.area = a;
  updateControl(g, a);
}
/** A seeded shuffle that spends no dice (the set-up must not change the game's rolls). */
const shuffled = <T>(g: Game, xs: T[], salt: number) => {
  const sr = secureRandom();
  let h = ((sr == null ? g.seed : Math.floor(sr * 2 ** 32)) ^ salt) >>> 0;
  /* online: not from the shared seed, which the other player can read */ const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** 15.7 quick placement of the strongpoints and ghosts still to place: the errata's rough historical set-up, or shuffled face-down ("most players prefer"). */
export function autoStrongpoints(g: Game, how: 'historical' | 'shuffle') {
  need(g.phase === 'deploy', 'only while setting up');
  if (how === 'historical')
    for (const { id, area } of SUGGESTED)
      if (g.units.some((u) => u.id === id && u.box === 'deploy') && deployOptions(g, id).includes(area)) deploy(g, id, area);
  const rest = shuffled(
    g,
    g.units.filter((u) => (u.fort || u.ghost) && u.box === 'deploy'),
    7,
  );
  for (const u of rest) {
    const o = deployOptions(g, u.id);
    if (o.length) deploy(g, u.id, shuffled(g, o, u.id.charCodeAt(2))[0]);
  }
}
/** 14.02: boundaries where the Israeli player may still place one of his three minefields. */
export function minefieldOptions(g: Game): string[] {
  const V = state(g);
  if (g.phase !== 'deploy' || !V.minesLeft) return [];
  const mined = new Set(V.minefields.flatMap((k) => k.split('-').map(Number)));
  return connections()
    .filter(
      (c) =>
        !isAssembly(c.a) &&
        !isAssembly(c.b) &&
        c.kind !== 'hermon' &&
        !c.atDitch &&
        !c.escarpment &&
        !c.river &&
        !c.rugged &&
        !c.sheet &&
        c.a !== HERMON &&
        c.b !== HERMON &&
        !mined.has(c.a) &&
        !mined.has(c.b) &&
        (!g.inPlay || (g.inPlay.includes(c.a) && g.inPlay.includes(c.b))),
    )
    .map((c) => edgeKey(c.a, c.b));
}
export function placeMinefield(g: Game, a: number, b: number) {
  const key = edgeKey(a, b);
  need(
    minefieldOptions(g).includes(key),
    'not a boundary for a minefield (14.02: not on the AT ditch, escarpment, river, Mt Hermon or rugged; one mined boundary per area)',
  );
  const V = state(g);
  V.minefields.push(key);
  V.minesLeft!--;
  say(g, `Minefield laid between ${nameOf(a)} and ${nameOf(b)} (14.02)`, 'israeli');
}
/** Random minefields, on boundaries between Israeli-held areas within two areas of the Purple Line (where they can stop an attack). */
export function autoMinefields(g: Game) {
  const front = new Set(PURPLE.flatMap((a) => [a, ...neighbors(a)])),
    useful = (k: string) =>
      k
        .split('-')
        .map(Number)
        .every((a) => g.control[a] === 'israeli' && !garea(a).syria && front.has(a));
  for (let k = 0; k < 5 && state(g).minesLeft; k++) {
    const all = minefieldOptions(g),
      o = shuffled(g, all.some(useful) ? all.filter(useful) : all, 31 + k);
    if (!o.length) break;
    const [a, b] = o[0].split('-').map(Number);
    placeMinefield(g, a, b);
  }
}
/** 22.25: in the alternate set-up Syria may put its two reserve markers on units it has placed (toggle). */
/** Reserve markers placed during the set-up: how many a side may put on its units, and whether all of them must be placed (22.25, 20.34-20.35, 22.44). */
export function setupReserves(g: Game, side: Side): { max: number; all: boolean } {
  if (g.phase !== 'deploy') return { max: 0, all: false };
  if (g.opts.scenario === 'badr_alt') return side === 'syrian' ? { max: 2, all: false } : { max: 0, all: false };
  if (isAlOwda(g)) return { max: side === 'israeli' ? ALO.israeli.reserve_markers : ALO.syrian.reserve_markers, all: true };
  if (isNafakh(g)) return side === 'israeli' ? { max: 1, all: false } : { max: 0, all: false };
  return { max: 0, all: false };
}
/** The reserve markers still to place at set-up (0 when the scenario gives none, or all are placed). */
export const reservesLeft = (g: Game, side: Side) => {
  const r = setupReserves(g, side);
  return Math.max(0, Math.min(g.markers[side]?.res ?? 0, r.max - g.units.filter((u) => u.side === side && u.reserve).length));
};
/** The set-up reserve markers that must be placed, put on placed units at random (the quick set-up). */
export function autoReserves(g: Game, only?: Side) {
  for (const sd of sidesOf(g).filter((x) => !only || x === only)) {
    const pool = shuffled(
      g,
      g.units.filter((u) => u.side === sd && regular(u) && u.area != null && !isAssembly(u.area) && !u.reserve),
      43,
    );
    while (reservesLeft(g, sd) && pool.length) deployReserve(g, pool.shift()!.id);
  }
}
export function deployReserve(g: Game, unitId: string) {
  const u = unit(g, unitId),
    r = setupReserves(g, u.side);
  need(r.max > 0 && regular(u) && u.area != null && !isAssembly(u.area), 'one of your placed units, during the set-up');
  if (u.reserve) {
    u.reserve = null;
    g.markers[u.side].res++;
    return;
  }
  need(reservesLeft(g, u.side) > 0, 'every reserve marker of the set-up is placed');
  u.reserve = 'res';
  g.markers[u.side].res--;
}
/** End of the set-up: the historical scenario opens with the Syrian Combat Phase (the Operational Movement Phase has taken place, 22.17). */
export function afterDeploy(g: Game) {
  if (state(g).startAt !== 'combat') return false;
  g.phase = 'combat';
  g.phasing = 'syrian';
  g.units.forEach((u) => {
    u.moved = false;
    u.spent = 0;
  });
  return true;
}
