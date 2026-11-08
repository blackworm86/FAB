/** The optional rules chooser (Play Book 18 and each volume's own list): one chooser for every place a game is created. */
import * as E from '../../engine/src';
import { esc } from './util';
import { ico } from './icons';
import { reg, ubtn } from './ui-kit';

let optOpen = false;
/** The optional rules of a game (each volume has its own list). */
export const rulesOf = (game: string) => E.VOLUMES[game]?.optional ?? E.OPTIONAL_RULES;
export const optOn = (o: Partial<E.Opts>, game: string) => rulesOf(game).filter((r) => (r.key === 'bid' ? !!o.bid : !!o[r.key]));
export function optChooser(o: Partial<E.Opts>, game: string): string {
  const n = optOn(o, game).length, bid = o.bid ?? 0;
  const rows = rulesOf(game).map((r) => r.key === 'bid'
    ? `<div class="orow"><span class="orn">${r.rule}</span><span class="ort"><b>${r.name}</b><small>${esc(r.text)}</small></span><span class="ostep" role="group" aria-label="Agreed bid">${ubtn('−', () => { o.bid = Math.max(-5, bid - 1) || undefined; }, '', bid <= -5, 'Bid to be the Germans: fewer starting fuel')}<b>${bid > 0 ? '+' : ''}${bid}</b>${ubtn('+', () => { o.bid = Math.min(5, bid + 1) || undefined; }, '', bid >= 5, 'Bid to be the Allies: extra German bid fuel')}</span></div>`
    : `<button class="orow tog ${o[r.key] ? 'on' : ''}" aria-pressed="${!!o[r.key]}" data-ui="${reg(() => { (o as Record<string, unknown>)[r.key] = !o[r.key] || undefined; })}"><span class="orn">${r.rule}</span><span class="ort"><b>${r.name}</b><small>${esc(r.text)}</small></span><span class="sw ${o[r.key] ? 'on' : ''}">${o[r.key] ? 'ON' : 'OFF'}</span></button>`).join('');
  return `<div class="optrules" ${optOpen ? 'data-reveal="optrules"' : ''}><button class="ohead" aria-expanded="${optOpen}" data-ui="${reg(() => { optOpen = !optOpen; })}">${ico(optOpen ? 'minus' : 'plus')}<b>Optional rules</b><span>${n ? `${n} on` : 'none'}</span></button>${optOpen ? `<div class="olist">${rows}</div>` : ''}</div>`;
}
