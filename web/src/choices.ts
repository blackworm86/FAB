// The action feed above the dock and the small choosers: a held move, the Special Action, the air mission, the alternate use.
import * as E from '../../engine/src';
import { online } from './online';
import { ico } from './icons';
import { esc } from './util';
import { reg, ubtn, btn } from './ui-kit';
import { VOL } from './page';
import { g, save, setApplyingRemote, setG, setSelChit } from './game-state';
import { act, ARMY_NAME, hist, mine, realArr, selArr, tfAreas } from './flow';
import { chitPic, refresh, render, sideByTag, sideTag, TAGRE } from './main';

/* ---------- chat between the two players; watchers read it ---------- */
/* ---------- the action feed: the newest log lines, fading, above the dock ---------- */
export let followFoe = (() => {
  try {
    return localStorage.getItem('fab-follow') !== '0';
  } catch {
    return true;
  }
})();
export const setFollowFoe = <T extends typeof followFoe>(v: T): T => ((followFoe = v), v);
let feed: { t: number; text: string; side: string }[] = [],
  feedLen = -1;
export function feedHtml(): string {
  const n = g.log.length;
  if (feedLen < 0 || n < feedLen) feedLen = n; // a new or rewound game shows nothing old
  for (const l of g.log.slice(feedLen)) {
    if (/\[sandbox\]|: phase start$|Victory check: /.test(l)) continue;
    /* the score is in the top bar; the check stays in the Log */ const text = l
      .replace(/^T\d+ /, '')
      .replace(new RegExp(`^(${TAGRE}) (\\w+): \\2 phase$`), `$1 Turn ${g.turn}: $2`)
      .replace(new RegExp(`^(${TAGRE}) [a-zA-Z]+: `), '$1 ');
    /* the step is in the top bar; the feed keeps only the news */ feed.push({ t: Date.now(), text, side: sideByTag(text.split(/\s/)[0]) });
  }
  feedLen = n;
  const now = Date.now();
  feed = feed.filter((f) => now - f.t < 9000).slice(-3);
  if (g.battle) return ''; // the battle has its own report
  if (feed.length)
    setTimeout(() => {
      if (feed.some((f) => Date.now() - f.t >= 9000)) render();
    }, 9100);
  return feed.length
    ? `<div class="feed ${g.phase === 'admin' || g.phase === 'reinforcement' ? 'top' : ''}" aria-live="polite">${feed.map((f) => `<div class="fl2 ${f.side}" style="animation-delay:${-(now - f.t) / 1000}s">${sideTag(f.text)}</div>`).join('')}</div>`
    : '';
}
export let scoreOpen = false,
  endHidden = false; // VP breakdown sheet; the end panel can be put aside to look at the final map
export const setEndHidden = <T extends typeof endHidden>(v: T): T => ((endHidden = v), v);
export const setScoreOpen = <T extends typeof scoreOpen>(v: T): T => ((scoreOpen = v), v);
/** A change by the other player that failed the rules check: it is held back, and the board keeps the last legal position until this player decides. */
export let heldBad: { game: E.Game; why: string[] } | null = null,
  gotRemote = false;
export const setGotRemote = <T extends typeof gotRemote>(v: T): T => ((gotRemote = v), v);
export const setHeldBad = <T extends typeof heldBad>(v: T): T => ((heldBad = v), v);
export function heldBadBar() {
  const why = heldBad!.why;
  return `<div class="seatbar err audit"><span>${ico('warn')} <b>Rules check:</b> the other player's last change was held back. ${why.map(esc).join(' ')} The board shows the last legal position.</span>${ubtn('Restore it for both', () => restoreLegal(), 'primary', !allowedSeat(), 'Write the last legal position back to the shared game')}${ubtn(
    'Accept their change',
    () => {
      const x = heldBad!.game;
      heldBad = null;
      setApplyingRemote(true);
      setG(x);
      save();
      setApplyingRemote(false);
      refresh();
    },
    '',
    false,
    'Show their change and play on from it',
  )}</div>`;
}
const allowedSeat = () => !online.active || online.mySide() != null;
/** Put the last legal position back for both players, marked as a restore so the other browser does not take it for going back in time. */
function restoreLegal() {
  if (!heldBad) return;
  const why = heldBad.why;
  heldBad = null;
  setG({ ...structuredClone(g), restored: { t: Date.now(), why } });
  hist.clear('position restored');
  save();
  refresh();
}
export let auditWarn: string[] = []; // problems found in moves written by the other browser
export const setAuditWarn = <T extends typeof auditWarn>(v: T): T => ((auditWarn = v), v);
let saPick: { side: E.Side; run: (id: string) => void; cands: E.Chit[] } | null = null;
export function pickSA(side: E.Side, ech: string | undefined, run: (id?: string) => void) {
  const seen = new Set<string>(),
    cands = E.saAvailable(g, side, ech).filter((c) => {
      const k = c.kind + c.ech;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }); // one choice per kind of counter
  if (cands.length <= 1) return run(cands[0]?.id);
  saPick = { side, run, cands };
}
/** An Air Mission played in a battle (17.21): extra artillery, or +2 to one of your units there (then tap it). */
export let airPick: { id: string; side: E.Side; step: 'choose' | 'unit' } | null = null;
export const setAirPick = <T extends typeof airPick>(v: T): T => ((airPick = v), v);
export function airPickHtml() {
  if (!airPick || airPick.step !== 'choose' || !g.battle) return '';
  const p = airPick;
  return `<div class="modal"><div class="sheet slim"><h3>${ico('air_mission')} Air Mission <button class="ico" data-ui="${reg(() => {
    airPick = null;
  })}" aria-label="Cancel">${ico('close')}</button></h3>
    <p class="hint gx">${VOL.id === 'golan73' ? 'Close air support (16.31a): one per side (Israel may add a second, 16.22); it never takes a step loss and goes to the Used Box.' : VOL.id === 'sicily' ? 'Ground support (16.32): one per side, outside the artillery and battle-asset limits; it never takes a step loss and goes to the Used Box.' : "Combat support (17.21): it is this battle's one event, and it can never take a step loss."}</p>
    <div class="row">${btn(
      `${ico('artillery')} Extra artillery`,
      () => {
        airPick = null;
        E.assign(g, g.battle!, p.id, 'arty');
      },
      'primary',
      false,
      'Fires like an artillery asset, outside the artillery limit',
    )}${((n) =>
      ubtn(
        `${ico('plus')} +${n} to one unit`,
        () => {
          airPick = { ...p, step: 'unit' };
        },
        '',
        false,
        `Then tap one of your blocks in this battle: +${n} to its Success Number`,
      ))(VOL.id === 'golan73' && p.side === 'syrian' ? 1 : 2)}</div></div></div>`;
}
/** 4.21: the chooser of the two eliminated assets an event brings back (the same sheet as the Special Action chooser). */
export let altPick: { chit: string; sel: string[] } | null = null;
export const setAltPick = <T extends typeof altPick>(v: T): T => ((altPick = v), v);
export const altOk = (c: E.Chit) =>
  g.phase === 'admin' &&
  c.box === 'available' &&
  mine(c.side) &&
  VOL.altBack(g, c).length > 0 &&
  (() => {
    try {
      const x = structuredClone(g);
      VOL.altUse(
        x,
        c.id,
        VOL.altBack(x, c)
          .slice(0, 2)
          .map((y) => y.id),
      );
      return true;
    } catch {
      return false;
    }
  })();
export function altPickHtml() {
  const p = altPick,
    c = p && g.chits.find((x) => x.id === p.chit);
  if (!p || !c || c.box !== 'available') return '';
  const cands = VOL.altBack(g, c),
    need = Math.min(2, cands.length),
    close = () => {
      altPick = null;
    };
  const tog = (id: string) => () => {
    p.sel = p.sel.includes(id) ? p.sel.filter((x) => x !== id) : [...p.sel, id].slice(-need);
  };
  return `<div class="modal"><div class="sheet sapick"><h3>Alternate use: ${esc(c.name)} <button class="ico" data-ui="${reg(close)}" aria-label="Cancel">${ico('close')}</button></h3>
    <p class="hint">Pick ${need === 2 ? 'two' : 'the'} eliminated asset${need === 2 ? 's' : ''} to put back in the cup (4.21). The event is spent.</p>
    <div class="pcgrid">${cands.map((x) => `<div class="sapc"><button class="pc ${x.side} ${p.sel.includes(x.id) ? 'on' : ''}" aria-pressed="${p.sel.includes(x.id)}" data-ui="${reg(tog(x.id))}" title="${esc(x.name)}">${chitPic(x)}</button><small>${esc(x.name)}</small></div>`).join('')}</div>
    <div class="row">${btn(
      `Bring back ${need}`,
      () => {
        const ids = p.sel;
        altPick = null;
        setSelChit(null);
        VOL.altUse(g, c.id, ids);
      },
      'primary',
      p.sel.length !== need,
    )}${ubtn('Cancel', close)}</div></div></div>`;
}
export function saPickHtml() {
  if (!saPick) return '';
  const p = saPick;
  return `<div class="modal"><div class="sheet sapick"><h3>Which Special Action? <button class="ico" data-ui="${reg(() => {
    saPick = null;
  })}" aria-label="Cancel">${ico('close')}</button></h3>
    <p class="hint gx">A single-use event only helps its own Higher Echelon and is eliminated; the reusable block goes to the Used Box and comes back next turn.</p>
    <div class="pcgrid">${p.cands
      .map(
        (c) =>
          `<div class="sapc"><button class="pc ${c.side}" data-ui="${reg(() => {
            saPick = null;
            act(() => p.run(c.id));
          })}" title="${esc(c.name)}">${chitPic(c)}</button><small>${esc(c.kind === 'sa_block' ? 'Reusable block' : `Event${ARMY_NAME[c.ech] ? ' · ' + ARMY_NAME[c.ech] : ''}`)}</small></div>`,
      )
      .join('')}</div></div></div>`;
}
export function arrOpts(): { area: number; sa: boolean }[] {
  if (!selArr || (g.phase !== 'reinforcement' && g.phase !== 'deploy')) return [];
  {
    const au = g.units.find((x) => x.id === selArr);
    if (au && !mine(au.side)) return [];
    const ac = g.chits.find((x) => x.id === selArr);
    if (ac && !mine(ac.side)) return [];
  }
  if (g.phase === 'deploy') {
    const id = realArr(selArr);
    return id ? VOL.placeOptions(g, id).map((area) => ({ area, sa: false })) : [];
  }
  return g.pendingArrivals.includes(selArr)
    ? E.arrivalOptions(g, selArr)
    : g.tfNew.includes(selArr)
      ? tfAreas().map((area) => ({ area, sa: false }))
      : [];
}
