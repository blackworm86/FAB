// Shared test helpers for the Golan engine: fight a battle with simple choices, play a whole game.
import { startBattle, beginCombat, rollStep, chooseFirstLoss, attackerChoice, defenderChoice, chooseRetreat, retreatOptions, declineExploit, closeBattle,
  endPhase, mustFight, arrivalOptions, placeArrival, type GGame } from '../src/golan';

/** Fight one battle to its end with simple choices: take losses, no defender options, first retreat area, no exploitation. */
export function fight(g: GGame, a: number, opts: { abort?: boolean; retreat?: boolean } = {}) {
  const b = startBattle(g, a); beginCombat(g, b);
  for (let i = 0; i < 50 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') chooseFirstLoss(g, b, b.attPoint!);
    else if (b.stage === 'attChoice') attackerChoice(g, b, !!opts.abort);
    else if (b.stage === 'defChoice') defenderChoice(g, b, !!opts.retreat);
    else if (b.stage === 'retreat') chooseRetreat(g, b, retreatOptions(g, b)[0]);
    else if (b.stage === 'exploit') declineExploit(g, b);
    else rollStep(g, b);
  }
  const res = b.result; closeBattle(g); return res;
}
export function playOut(g: GGame, maxSteps = 3000) {
  for (let i = 0; i < maxSteps && !g.result; i++) {
    if (g.phase === 'reinforcement') for (const u of g.units.filter((x) => x.box === 'arriving')) { const o = arrivalOptions(g, u.id); if (o.length) placeArrival(g, u.id, o[0]); }
    for (const a of mustFight(g)) fight(g, a);
    endPhase(g);
  }
}

