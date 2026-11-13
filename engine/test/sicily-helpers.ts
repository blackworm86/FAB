// Shared test helpers for Sicily on the series engine: a set-up game, simple queries, a battle fought with simple choices, a game played out.
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
  sicily,
  type Game,
  type Side,
} from '../src';

/** A Sicily game: the quick set-up (garrisons at random, the historical landing plan from B1 / D1) and the Allied Movement Phase of turn 1, unless setup is false. */
export const newSicilyGame = (seed = 1, scenario = 'tournament', setup = true, opts: Record<string, unknown> = {}): Game => {
  useGame('sicily');
  const g = newGame(seed, { scenario, ...opts });
  if (setup) {
    sicily.autoDeploy(g);
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
export const onMap = (g: Game, a: number) => unitsIn(g, a).filter((u) => !u.garrison);
export const move = (g: Game, id: string, to: number) => {
  const r = seriesMove(g, id, to);
  if (r === 'blow') resolveBlow(g, false);
  return r;
};
export const give = (g: Game, id: string) => {
  chit(g, id).box = 'available';
  return id;
};
export const placeAll = (g: Game) => {
  for (const id of [...g.pendingArrivals]) {
    const o = arrivalOptions(g, id);
    if (o.length) placeArrival(g, id, o[0].area);
  }
};

/** Fight one battle to its end with simple choices: take losses, no defender options, first retreat option, no exploitation. */
export function fight(g: Game, a: number, opts: { abort?: boolean; retreat?: boolean } = {}) {
  const b = startBattle(g, a);
  beginCombat(g, b);
  for (let i = 0; i < 60 && b.stage !== 'done'; i++) {
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
/** One step of a simple game: arrivals, drops, battles, the phase end. */
export function step(g: Game) {
  if (g.recover.length) autoRecover(g);
  if (g.phase === 'reinforcement') placeAll(g);
  if (g.phase === 'combat' && g.phasing === 'allied') sicily.autoAirDrop(g);
  if (g.phase === 'admin') sicily.autoMoraleLoss(g);
  for (const a of mustFight(g)) fight(g, a);
  endPhase(g);
}
export function playOut(g: Game, maxSteps = 3000) {
  for (let i = 0; i < maxSteps && !g.over; i++) step(g);
}
export const runTo = (g: Game, turn: number, side: Side, phase: string) => {
  for (let i = 0; i < 400 && !(g.turn === turn && g.phasing === side && g.phase === phase); i++) step(g);
  if (!(g.turn === turn && g.phasing === side && g.phase === phase)) throw new Error(`stopped at T${g.turn} ${g.phasing} ${g.phase}`);
};
