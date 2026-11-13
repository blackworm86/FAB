/** The interface's buttons: each redraw registers what its buttons do, and the click handlers look them up by key.
 *  Shared by the home page (home.ts) and the game table (main.ts). */
import { esc } from './util';
import { ico } from './icons';

export const acts: Record<string, () => void> = {},
  actv: Record<string, (v: string) => void> = {};
let n = 0;
/** Forget the last redraw's buttons (call at the start of each redraw). */
export function resetActs() {
  for (const k in acts) delete acts[k];
  for (const k in actv) delete actv[k];
  n = 0;
}
export const reg = (f: () => void) => {
  const k = 'a' + n++;
  acts[k] = f;
  return k;
};
export const regv = (f: (v: string) => void) => {
  const k = 'v' + n++;
  actv[k] = f;
  return k;
};
/** A button that only changes what you see or who sits where, never the game: it works for anyone, whoever's turn it is. */
export const ubtn = (label: string, f: () => void, cls = '', dis = false, title = '') =>
  `<button class="${cls}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(title)}">${label}</button>`;
/** A button that changes the game (on the table it runs as a move). */
export const btn = (label: string, f: () => void, cls = '', dis = false, title = '') =>
  `<button class="${cls}" data-do="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(title)}">${label}</button>`;
/** One setting: its name (and what it does) on the left, its control on the right. */
export const srow = (title: string, sub: string, control: string) =>
  `<div class="srow"><div class="slab"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${control}</div>`;
/** An on/off switch (a view setting: works whoever's turn it is). */
export const swtch = (on: boolean, f: () => void, label: string) =>
  `<button class="swb ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" title="${esc(label)}" data-ui="${reg(f)}"><i></i></button>`;
export const chip = (label: string, on: boolean, f: () => void, title = '', icon = '') =>
  `<button class="chip ${on ? 'on' : ''} ${label ? '' : 'iconly'}" aria-pressed="${on}" data-ui="${reg(f)}" title="${esc(title || label)}" aria-label="${esc(title || label)}">${icon ? ico(icon) : on ? ico('check') : ''}${label ? `<span>${label}</span>` : ''}</button>`;
