// The learned judge: the chance that the Germans win from this position, as one seat sees it (features.ts weighed
// by the model fitted in scripts/fit.ts). Small and fast: one weighted sum.
import type { Game, Side } from '../../engine/src';
import { features } from './features';
import model from './judge-bulge-tournament.json';

export function germanWins(view: Game, seat: Side): number {
  const f = features(view, seat);
  return 1 / (1 + Math.exp(-(model.b + model.names.reduce((t, n, j) => t + ((f[n] - model.mean[j]) / model.sd[j]) * model.w[j], 0))));
}
/** The chance that `side` wins. */
export const winChance = (view: Game, seat: Side, side: Side) => (side === 'german' ? germanWins(view, seat) : 1 - germanWins(view, seat));
