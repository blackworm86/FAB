// Shared test helpers for Golan '73 on the series engine: the game, simple queries, a battle fought with simple choices, a whole game played out.
import {
  newGame,
  useGame,
  endPhase,
  mustFight,
  startBattle,
  beginCombat,
  roll_step as rollStep,
  chooseFirstLoss,
  attackerChoice,
  defenderChoice,
  chooseRetreat,
  retreatOptions,
  declineExploit,
  closeBattle,
  arrivalOptions,
  placeArrival,
  autoRecover,
  unitsIn,
  move as seriesMove,
  resolveBlow,
  golan,
  type Game,
  type Side,
} from '../src';

/** A Golan game; Operation Badr comes set up (strongpoints and ghosts as the errata's historical placement, no free minefields) and starts at its first phase, unless setup is false. */
export const newGolanGame = (seed = 1, scenario: 'badr' | 'badr_alt' = 'badr', setup = true): Game => {
  useGame('golan73');
  const g = newGame(seed, { scenario });
  if (setup && scenario === 'badr') {
    golan.autoStrongpoints(g, 'historical');
    golan.state(g).minesLeft = 0;
    endPhase(g);
  }
  return g;
};
export const unit = (g: Game, id: string) => {
  const u = g.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
};
export const chit = (g: Game, id: string) => {
  const c = g.chits.find((x) => x.id === id);
  if (!c) throw new Error(`no counter ${id}`);
  return c;
};
/** Blocks in an area (regular units, strongpoints and ghosts; not the standing assets). */
export const onMap = (g: Game, a: number) => unitsIn(g, a).filter((u) => !u.garrison);
export const count = (g: Game, a: number) => ({
  israeli: onMap(g, a).filter((u) => u.side === 'israeli').length,
  syrian: onMap(g, a).filter((u) => u.side === 'syrian').length,
});
/** A move; the opponent never tries to blow a bridge in these tests. */
export const move = (g: Game, id: string, to: number) => {
  const r = seriesMove(g, id, to);
  if (r === 'blow') resolveBlow(g, false);
  return r;
};
export const give = (g: Game, id: string) => {
  chit(g, id).box = 'available';
  return id;
};
export const fresh = (g: Game) => {
  g.phase = 'admin';
  golan.state(g).samTarget = undefined;
};
export const placeAll = (g: Game) => {
  for (const id of [...g.pendingArrivals]) {
    const o = arrivalOptions(g, id);
    if (o.length) placeArrival(g, id, o[0].area);
  }
};

/** Fight one battle to its end with simple choices: take losses, no defender options, first retreat area, no exploitation. */
export function fight(g: Game, a: number, opts: { abort?: boolean; retreat?: boolean } = {}) {
  const b = startBattle(g, a);
  beginCombat(g, b);
  for (let i = 0; i < 50 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint);
    else if (b.stage === 'attChoice') attackerChoice(g, b, !!opts.abort);
    else if (b.stage === 'defChoice') defenderChoice(g, b, !!opts.retreat);
    else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]);
    else if (b.stage === 'exploit') declineExploit(g, b);
    else rollStep(g, b);
  }
  const res = b.result;
  closeBattle(g);
  return res;
}
export function playOut(g: Game, maxSteps = 3000) {
  for (let i = 0; i < maxSteps && !g.over; i++) {
    if (g.recover.length) autoRecover(g);
    if (g.phase === 'reinforcement') placeAll(g);
    for (const a of mustFight(g)) fight(g, a);
    endPhase(g);
  }
}
export const runTo = (g: Game, turn: number, side: Side, phase: string) => {
  for (let i = 0; i < 400 && !(g.turn === turn && g.phasing === side && g.phase === phase); i++) {
    if (g.recover.length) autoRecover(g);
    if (g.phase === 'reinforcement') placeAll(g);
    for (const a of mustFight(g)) fight(g, a);
    endPhase(g);
  }
  if (!(g.turn === turn && g.phasing === side && g.phase === phase)) throw new Error(`stopped at T${g.turn} ${g.phasing} ${g.phase}`);
};
