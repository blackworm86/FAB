// The commander (stage 5 of docs/COMPUTER-PLAYER-PLAN.md). At the start of each of its Movement Phases it tries a few whole plans (styles of play for the rest of the player turn) on copies of the
// game where the hidden enemy blocks are guessed, plays each copy to the end of the player turn, and keeps the plan
// the learned judge likes best. In between, the chosen plan's doctrine makes the single moves. It explains its choice.
import * as E from '../../engine/src';
import type { Game, Side } from '../../engine/src';
import { actors, apply } from './actions';
import { DEFAULT_STYLE, doctrinePlayer, type Style } from './doctrine';
import { guessFull } from './guess';
import { winChance } from './judge';
import { rng, type Player } from './random';

export const PLANS: { name: string; why: string; style: Style }[] = [
  { name: 'steady', why: 'attack only at good odds, two assets per battle, two units in reserve, hold the objectives', style: DEFAULT_STYLE },
  { name: 'bold', why: 'attack at even odds, keep one reserve', style: { attackOdds: 1, assets: 2, reserves: 1, hold: true } },
  { name: 'all-out', why: 'attack even at poor odds with every asset, no reserve, nothing held back', style: { attackOdds: 0.8, assets: 3, reserves: 0, hold: false } },
  { name: 'careful', why: 'attack only at very good odds', style: { attackOdds: 1.8, assets: 2, reserves: 2, hold: true } },
  { name: 'massed fire', why: 'three assets per battle at good odds', style: { attackOdds: 1.3, assets: 3, reserves: 2, hold: true } },
  { name: 'north', why: 'main effort in the north (Malmedy, Liège, the Meuse at Huy)', style: { ...DEFAULT_STYLE, attackOdds: 1.1, focus: 6 } },
  { name: 'centre', why: 'main effort in the centre (Bastogne, Marche, Namur)', style: { ...DEFAULT_STYLE, attackOdds: 1.1, focus: 5 } },
  { name: 'south', why: 'main effort in the south (Luxembourg City, Arlon)', style: { ...DEFAULT_STYLE, attackOdds: 1.1, focus: 7 } },
];

/** Play a guessed game to the end of the current player turn with the plan for `me`, steady doctrine for the enemy; the judge's verdict for `me`. */
function playOut(g: Game, me: Side, style: Style, maxActions = 600): number {
  const mine = doctrinePlayer(style), theirs = doctrinePlayer(), turn = g.turn, phasing = g.phasing;
  for (let k = 0; k < maxActions && !g.over && g.turn === turn && g.phasing === phasing; k++) {
    const side = actors(g)[0]; if (!side) break;
    const a = (side === me ? mine : theirs)(g, side); if (!a) break;
    try { apply(g, a); } catch { break; }
  }
  if (g.over) return g.over.toLowerCase().includes(me) ? 1 : 0;
  const vp = E.victory(g).net * (me === E.sidesOf(g)[0] ? 1 : -1);
  return winChance(g, me, me) + 0.002 * vp;                       // the points break ties when the judge is sure either way
}

export interface Commander extends Player { reasons: string[] }

/** budgetMs: thinking time for one plan choice; the plans are tried in turns on fresh guesses until it runs out. */
export function commanderPlayer(seed: number, budgetMs = 4000): Commander {
  const r = rng(seed), reasons: string[] = [];
  let planned = '', style = DEFAULT_STYLE;
  const choose = (view: Game, side: Side) => {
    const t0 = performance.now(), score = PLANS.map(() => ({ sum: 0, n: 0 }));
    for (let round = 0; round === 0 || performance.now() - t0 < budgetMs; round++) {
      const guess = guessFull(view, side, r);                                       // the same guess for every plan in a round: a fair comparison
      PLANS.forEach((p, i) => { score[i].sum += playOut(structuredClone(guess), side, p.style); score[i].n++; });
      if (round >= 7) break;
    }
    const avg = score.map((x) => x.sum / x.n), best = avg.indexOf(Math.max(...avg)), p = PLANS[best];
    reasons.push(`Turn ${view.turn} ${view.phase}: plan "${p.name}" (${p.why}): judged ${Math.round(100 * Math.min(1, avg[best]))}% to win, against ${PLANS.map((q, i) => `${q.name} ${Math.round(100 * avg[i])}%`).filter((_, i) => i !== best).join(', ')}; ${score[0].n} guesses of the hidden blocks.`);
    return p.style;
  };
  const player = ((view, side) => {
    const key = `${view.turn} ${view.phasing} ${view.phase}`;
    if (key !== planned && !view.battle && view.phase === 'movement' && view.phasing === side) { planned = key; style = choose(view, side); }
    return doctrinePlayer(style)(view, side);
  }) as Commander;
  player.reasons = reasons;
  return player;
}
