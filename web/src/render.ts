// Drawing the screen: the whole interface from the game's state, wiring its buttons, keeping the view in step, and the refresh after every action.
import { translateDom } from './i18n';
import * as E from '../../engine/src';
import { vpStrip, vpSheet, endPanel } from './score';
import * as SBU from './sandbox-ui';
import { online, setDevSeat, publishReveals, DEV, HAS_TABLE, DEV_FAKE, SANDBOX, TUTORIAL, type DevSeat } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { chatHtml, bindChat } from './chat';
import { acts, actv, resetActs, reg, ubtn, btn } from './ui-kit';
import { homeUrl, bindAuth } from './home';
import { clearDice } from './dice3d';
import { linkRules } from './rules-link';
import { LAB_SIDE, labStep } from './lab';
import { $, areaName, P1, VOL } from './page';
import { g, save, selArea, selChit, selUnit, setG, setPreviewArea, setSelArea, setSelChit, setSelUnit, showReplay } from './game-state';
import { canvas } from './scene';
import { drawPieces } from './pieces';
import { paintAreas, paintBoard, tint, viewRot, viewSide } from './map-paint';
import { dist, pitch, setYaw } from './camera';
import {
  act,
  allowed,
  fxLayer,
  hist,
  mine,
  notYou,
  other,
  say,
  selArr,
  setLabActing,
  setSelArr,
  setTgt,
  setTgtMode,
  tgtMode,
  toast,
  toastInfo,
  undo,
} from './flow';
import {
  airPickHtml,
  altPickHtml,
  auditWarn,
  endHidden,
  feedHtml,
  heldBad,
  heldBadBar,
  saPickHtml,
  scoreOpen,
  setAuditWarn,
  setEndHidden,
  setScoreOpen,
} from './choices';
import { reinforceTargets, reinforcing, setGoal, syncBattleCam } from './map-input';
import { badgeList, drawRoute, setBadges, syncBadges } from './routes';
import { decisionBubble, decisionTargets, syncAreaTags, syncMoveMarks, syncTags } from './map-marks';
import { endRoll, heldNext, menuTab, modal, rollStage, rollView, setModal } from './rolls';
import { chitTargets, drag, lastPointer, setLastPointer, tapCard } from './cards';
import { canMove, endArmed, guardEnd, guide, primary, prompt, setGuide, topBar } from './prompt';
import { dockChips, undoBtn } from './dock';
import { piecesSide, piecesTab, setInspectId, unitPic } from './pieces-window';
import { dispatch, dragArrival, frameArrival } from './unit-card';
import { mapDock } from './map-dock';
import { battleTable, handCards, ledger, setRefusal, volPanel } from './battle-view';
import { homeGoal, modalHtml, openingTarget, seatBar } from './menus';
import { camTouched, frameAt, fxBattle, lastPhase, openFrame, setFrameAt, setFxBattle, setLastPhase, setOpenFrame } from './main';

export const inGame = () => HAS_TABLE || DEV_FAKE || SANDBOX || TUTORIAL || !!LAB_SIDE || online.mode === 'local';
/** Draw the interface; if something in it throws, say so on screen instead of leaving a stale picture. */
/* A tap must land on the button it started on: while a finger or mouse is down on the interface, redraws wait (playtest: Ready/Roll/Done taps were lost). */
let pressing = false,
  renderWaiting = false;
document.addEventListener(
  'pointerdown',
  (e) => {
    pressing = !!(e.target as HTMLElement).closest?.('#ui button, #ui [role=button], #ui .card2');
  },
  true,
);
const release = () => {
  if (!pressing) return;
  pressing = false;
  if (renderWaiting)
    setTimeout(() => {
      if (renderWaiting && !pressing) render();
    }, 0);
};
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
window.addEventListener('blur', release);
/** Keyboard focus survives a redraw: the same control (by its role and text) gets it back, or the new main button. */
let kbUser = false;
window.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') kbUser = true;
  },
  true,
);
window.addEventListener(
  'pointerdown',
  () => {
    kbUser = false;
  },
  true,
);
function focusKey(el: Element | null) {
  if (!el || !(el as HTMLElement).closest?.('#ui') || !el.matches('button,[role=button],input,select,[tabindex]')) return null;
  return {
    tag: el.tagName,
    cls: Array.from(el.classList)
      .filter((c) => !['on', 'hot'].includes(c))
      .sort()
      .join('.'),
    text: (el.textContent ?? '').trim().slice(0, 40),
    label: el.getAttribute('aria-label') ?? '',
  };
}
export function render() {
  if (pressing) {
    renderWaiting = true;
    return;
  }
  renderWaiting = false;
  document.body.classList.toggle('setup', g.phase === 'deploy');
  syncView();
  const fk = kbUser ? focusKey(document.activeElement) : null;
  try {
    renderInner();
    translateDom($('#ui'));
    linkRules($('#ui'));
  } catch (e) {
    console.error(e);
    $('#ui').innerHTML =
      `<div class="seatbar err"><span>Display problem: ${esc(String((e as Error)?.message ?? e))}</span>${ubtn('Reload', () => location.reload(), 'primary')}${
        SANDBOX
          ? ubtn('Undo last edit', () => {
              const p = hist.undo(g).game;
              if (p) {
                setG(p);
                save();
                refresh();
              }
            }) +
            ubtn('New sandbox game', () => {
              setG(E.newGame());
              hist.clear();
              save();
              refresh();
            })
          : ''
      }</div>`;
    bind($('#ui'));
  }
  if (fk && !document.activeElement?.closest?.('#ui')) {
    const all = Array.from(document.querySelectorAll<HTMLElement>('#ui button, #ui [role=button], #ui input, #ui select, #ui [tabindex]'));
    const back =
      all.find((e) => {
        const k = focusKey(e);
        return k && k.tag === fk.tag && k.cls === fk.cls && (k.text === fk.text || (k.label && k.label === fk.label));
      }) ?? document.querySelector<HTMLElement>('#ui .go:not(:disabled)');
    back?.focus({ preventScroll: true });
    if (back?.closest('.modal') && !revealing) back.scrollIntoView({ block: 'nearest' });
  } // focus restored inside a menu stays in sight (not while a sub-menu glides in)
  const sheet = document.querySelector<HTMLElement>('#ui .modal > .sheet');
  if (sheet) {
    const h = sheet.querySelector('h3');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    if (h) {
      h.id = 'sheet-title';
      sheet.setAttribute('aria-labelledby', h.id);
    }
    if (!sheet.contains(document.activeElement)) {
      sheet.tabIndex = -1;
      sheet.focus({ preventScroll: true });
    }
  }
} // an open menu holds the focus, so keyboard and screen readers start inside it
function renderInner() {
  if (document.activeElement?.closest?.('.authform')) return; // do not wipe what is being typed
  resetActs();
  if (!g.battle || g.battle.stage !== 'setup') setRefusal('');
  canvas.style.display = inGame() ? '' : 'none';
  if (!inGame()) return; // the home page is home.ts; this page only plays a table
  if (SANDBOX && !(online.admin || (DEV && online.ready))) {
    canvas.style.display = 'none';
    $('#ui').innerHTML =
      `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein"><section class="card"><h2>${ico('lock')} Sandbox</h2><p class="hint">${online.ready ? 'The sandbox is for admins. Sign in with an admin account on the home page.' : 'Checking your account…'}</p><div class="row">${ubtn(
        `${ico('back')} Home`,
        () => {
          location.href = homeUrl();
        },
      )}</div></section></div></div>`;
    bind($('#ui'));
    return;
  }
  if (rollView && !g.battle && !rollView.check) endRoll(); // dice left on screen after the battle is over
  const p = primary(),
    b = g.battle;
  const alert = g.pendingBlow
    ? (() => {
        const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!,
          path = g.pendingBlow!.path;
        return `<div class="c-ledger"><h3>${nm(other(u.side))}: bridge?</h3><p class="hint">${esc(u.name)} tries to cross into ${esc(areaName(path[path.length - 1]))}. Attempt to blow the bridge? It works on a roll of 1–5.</p><div class="row end">${btn('Let them cross', () => E.resolveBlow(g, false))}${btn('Attempt to blow it', () => E.resolveBlow(g, true), 'primary')}</div></div>`;
      })()
    : '';
  const dockMain = alert || ledger() || handCards();
  const keepD = document.querySelector<HTMLElement>('#ui .c-dispatch')?.scrollTop ?? 0; // a panel being read keeps its place when the screen updates
  const sheetKey = `${modal}:${menuTab}:${piecesTab}:${piecesSide}`,
    keepS = sheetKey === lastSheet ? (document.querySelector<HTMLElement>(SHEET_SCROLL)?.scrollTop ?? 0) : 0; // a menu keeps its place on every click; another menu or tab starts at the top
  const shown = new Set(Array.from(document.querySelectorAll<HTMLElement>('#ui [data-reveal]')).map((e) => e.dataset.reveal));
  const keepH = document.querySelector<HTMLElement>('#ui .c-hand')?.scrollLeft ?? 0,
    keepA = document.querySelector<HTMLElement>('#ui .arrtray')?.scrollLeft ?? 0;
  $('#ui').innerHTML =
    `<a class="skipmap" href="#" data-ui="${reg(() => {
      (document.getElementById('gl') as HTMLElement).focus();
    })}">Skip to the map</a><div class="tops">${topBar(
      vpStrip(
        g,
        reg(() => {
          setScoreOpen(true);
        }),
      ),
    )}</div>` +
    `<div class="stage">${SANDBOX ? (SBU.st.sbOpen ? SBU.sandboxPanel() : SBU.sandboxFab()) : ''}${seatBar()}${heldBad ? heldBadBar() : ''}${
      auditWarn.length
        ? `<div class="seatbar err audit"><span>${ico('warn')} <b>Rules check:</b> ${auditWarn.map(esc).join(' ')}</span>${ubtn(
            'OK',
            () => {
              setAuditWarn([]);
            },
          )}</div>`
        : ''
    }${volPanel()}${mapDock()}${b ? battleTable() : dispatch()}${decisionBubble()}${feedHtml()}${SBU.hotCoverHtml()}${saPickHtml()}${altPickHtml()}${airPickHtml()}${chatHtml()}${
      scoreOpen
        ? vpSheet(
            g,
            unitPic,
            reg(() => {
              setScoreOpen(false);
            }),
            ico('close'),
          )
        : ''
    }${
      g.over && !endHidden
        ? endPanel(
            g,
            unitPic,
            ubtn(`${ico('layers')} Map`, () => {
              setEndHidden(true);
            }) +
              ubtn(
                `${ico('dice')} Replay`,
                () => {
                  void showReplay();
                },
                '',
                false,
                'Watch the whole game again, step by step',
              ) +
              ubtn(
                `${ico('plus')} New game`,
                () => {
                  if (SANDBOX) {
                    SBU.sbReset({ ...g.opts });
                    setEndHidden(false);
                  } else location.href = homeUrl();
                },
                'primary',
              ) +
              ubtn(`${ico('home')} Home`, () => {
                location.href = homeUrl();
              }),
          )
        : ''
    }${toast ? `<div class="toast${toastInfo ? ' info' : ''}" role="status">${esc(toast)}</div>` : ''}</div><div class="dock">${dockMain}<div class="c-bar b"><div class="c-prompt" aria-live="polite">${prompt()}</div><button class="ico guidebtn ${guide === 'full' ? 'on' : ''}" data-ui="${reg(() => setGuide(guide === 'full' ? 'short' : 'full'))}" title="${guide === 'full' ? 'Hide the explanations (short prompts)' : 'Show the explanations of each option'}" aria-label="Explanations" aria-pressed="${guide === 'full'}">${ico('info')}</button>${undoBtn()}${!p || !allowed() ? '<span class="gowait slot" aria-hidden="true"></span>' : p.dis && /^Waiting/.test(p.label) ? `<span class="gowait">${esc(p.label)}…</span>` : p ? `<button class="go ${g.moving && p.label.startsWith('End') ? 'quiet' : ''}" data-do="${reg(guardEnd(p))}" ${p.dis || !allowed() ? 'disabled' : ''} ${allowed() ? '' : `title="${esc(notYou())}"`}>${endArmed && p.label.startsWith('End') ? `End anyway? ${canMove().length} can move` : p.label}${ico(p.label.startsWith('Ready') ? 'check' : p.label.startsWith('Roll') ? 'dice' : 'next')}</button>` : ''}${dockChips()}</div></div>` +
    modalHtml();
  const ui = $('#ui');
  {
    const d = ui.querySelector<HTMLElement>('.c-dispatch');
    if (d) d.scrollTop = keepD;
  }
  {
    const s = ui.querySelector<HTMLElement>(SHEET_SCROLL);
    if (s) s.scrollTop = keepS;
    lastSheet = s ? sheetKey : '';
    const fresh = Array.from(ui.querySelectorAll<HTMLElement>('[data-reveal]')).find((e) => !shown.has(e.dataset.reveal)); // a sub-menu just opened (Optional rules, a piece's card): bring it into view
    revealing = !!(fresh && s);
    if (fresh && s)
      fresh.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  bind(ui, keepH, keepA);
}
const SHEET_SCROLL = '#ui .modal .mbody, #ui .modal > .sheet:not(.menu)';
let lastSheet = '',
  revealing = false;
function bind(ui: HTMLElement, keepH = 0, keepA = 0) {
  ui.querySelectorAll<HTMLElement>('.dchips').forEach((row) => {
    // a row of chips that runs off the right edge fades there, so it reads as "more to the right"
    const edge = () => row.classList.toggle('more', row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
    edge();
    row.addEventListener('scroll', edge, { passive: true });
  });
  ui.querySelectorAll<HTMLElement>('.volstack').forEach((st) => {
    // a set-up panel taller than its space fades at the bottom with a ▾, so it reads as "more below" (playtest B7)
    const edge = () => st.classList.toggle('more', st.scrollTop + st.clientHeight < st.scrollHeight - 2);
    edge();
    st.addEventListener('scroll', edge, { passive: true });
  });
  {
    const h = ui.querySelector<HTMLElement>('.c-hand'),
      a = ui.querySelector<HTMLElement>('.arrtray');
    if (h) h.scrollLeft = keepH;
    if (a) a.scrollLeft = keepA;
  }
  ui.querySelectorAll<HTMLElement>('[data-ui]').forEach(
    (e) =>
      (e.onclick = () => {
        acts[e.dataset.ui!]?.();
        render();
      }),
  ); // view-only choices: allowed for everyone, never touch the game
  ui.querySelectorAll<HTMLElement>('[data-do]').forEach(
    (e) =>
      (e.onclick = () => {
        if (inGame())
          act(
            acts[e.dataset.do!],
            g.battle ? ((e.querySelector('span')?.firstChild ?? e).textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) : '',
          );
        /* the button's own words, not its subtitle */ else {
          acts[e.dataset.do!]?.();
          render();
        }
      }),
  ); // on the home page nothing is a game move
  ui.querySelectorAll<HTMLElement>('[data-modal]').forEach(
    (e) =>
      (e.onclick = () => {
        setInspectId(null);
        setModal((e.dataset.modal || null) as typeof modal);
        render();
      }),
  ); // a window opens with nothing selected
  ui.querySelectorAll<HTMLElement>('[data-sel]').forEach(
    (e) =>
      (e.onchange = () => {
        const f = actv[e.dataset.sel!];
        if (f) {
          f(e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : (e as HTMLSelectElement).value);
          save();
        }
      }),
  );
  ui.querySelectorAll<HTMLInputElement>('#lb-q').forEach((e) => {
    const run = () => {
      SBU.st.sbFilter = e.value;
      const w = SBU.st.sbFilter.toLowerCase().split(/\s+/).filter(Boolean);
      ui.querySelectorAll<HTMLElement>('.lbgrid .lbt').forEach((t) => {
        t.style.display = w.every((x) => t.dataset.k!.includes(x)) ? '' : 'none';
      });
    };
    e.oninput = run;
    run();
  });
  bindChat(ui);
  ui.querySelectorAll<HTMLTextAreaElement>('#sb-note').forEach(
    (e) =>
      (e.oninput = () => {
        SBU.st.sbDraft = e.value;
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach((e) => (e.onpointerdown = (ev) => dragArrival(ev, e)));
  ui.querySelectorAll<HTMLElement>('[data-arr]').forEach(
    (e) =>
      (e.onclick = () => {
        setSelArr(selArr === e.dataset.arr ? null : e.dataset.arr!);
        refresh();
        frameArrival();
      }),
  );
  bindAuth(ui);
  ui.querySelectorAll<HTMLElement>('[data-seat]').forEach(
    (e) =>
      (e.onclick = () => {
        const order: DevSeat[] = ['both', ...VOL.sides, 'watch'];
        setDevSeat(order[(order.indexOf(online.devSeat) + 1) % order.length]);
        setSelUnit(setSelChit(setSelArr(null)));
        setPreviewArea(null);
        refresh();
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-home]').forEach(
    (e) =>
      (e.onclick = () => {
        setGoal(homeGoal());
        setYaw(viewRot());
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-tint]').forEach(
    (e) =>
      (e.onclick = () => {
        setModal('layers');
        render();
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-undo]').forEach((e) => (e.onclick = () => undo()));
  ui.querySelectorAll<HTMLElement>('[data-u]').forEach(
    (e) =>
      (e.onclick = () => {
        setSelUnit(e.dataset.u!);
        setSelArea(g.units.find((x) => x.id === selUnit)!.area ?? selArea);
        setPreviewArea(null);
        refresh();
      }),
  );
  ui.querySelectorAll<HTMLElement>('.card2, .blk').forEach(
    (e) =>
      (e.onkeydown = (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        const id = e.dataset.chit,
          b2 = g.battle;
        if (e.classList.contains('card2') && id) {
          if (b2?.stage === 'setup') {
            const c = E.chit(g, id),
              why = E.canAssign(g, b2, c.side, c);
            if (why) say(why);
            else act(() => E.assign(g, b2, id, c.kind === 'air_mission' ? 'arty' : undefined));
          } else if (!b2) {
            setSelChit(selChit === id ? null : id);
            refresh();
          }
        } else e.click();
      }),
  );
  ui.querySelectorAll<HTMLElement>('.card2').forEach(
    (e) =>
      (e.onpointerdown = (ev) => {
        setLastPointer(ev.pointerType);
        if (ev.pointerType === 'touch') return;
        if (ev.pointerType === 'mouse') ev.preventDefault();
        if (g.battle || chitTargets(E.chit(g, e.dataset.chit!)).length) drag(ev, e);
      }),
  );
  ui.querySelectorAll<HTMLElement>('.card2').forEach(
    (e) =>
      (e.onclick = () => {
        if (lastPointer === 'touch') return tapCard(e.dataset.chit!);
        if (!g.battle) {
          setSelChit(selChit === e.dataset.chit ? null : e.dataset.chit!);
          refresh();
        }
      }),
  );
  ui.querySelectorAll<HTMLElement>('.blk[data-unit]').forEach(
    (e) =>
      (e.onclick = () => {
        const b2 = g.battle;
        if (!b2 || b2.stage !== 'setup') return;
        const s = e.dataset.side as E.Side,
          u = g.units.find((x) => x.id === e.dataset.unit)!;
        if (!mine(s)) return;
        if (u.garrison || (s === b2.attacker && u.disorder)) return;
        act(() => E.setPoint(g, b2, s, u.id));
      }),
  );
}
let lastView: E.Side | null = null;
/** Standard view: German from the bottom of the map, Allied from the top; the printed items turn with it. */
export function syncView() {
  const v = viewSide();
  if (v === lastView) return;
  const fresh = lastView === null;
  lastView = v;
  setYaw(v !== VOL.bottom ? Math.PI : 0);
  if (!fresh) setGoal(g.inPlay ? homeGoal() : { t: openingTarget(), dist, pitch });
  paintBoard();
}
/** Split tables: publish the blocks the other side may now see, and (attacker's seat) start combat once both point units are designated (6.24) and the blocks are known. */
function driveSplit() {
  const me = online.mySide();
  if (online.mode !== 'remote' || !me || !online.rev) return;
  void publishReveals(g);
  const b = g.battle;
  if (
    b &&
    b.stage === 'setup' &&
    b.attPointDone &&
    g.deferBegin &&
    me === b.attacker &&
    E.unitsIn(g, b.area).every((u) => u.name !== 'Hidden block') &&
    !VOL.blocksBegin(g)
  )
    act(() => E.beginCombat(g, b));
}
export let ctlKey = '',
  tgtKey = '';
export const setTgtKey = <T extends typeof tgtKey>(v: T): T => ((tgtKey = v), v);
let playKey: string | null = null;
export let lastFight: number | null = null;
export const setLastFight = <T extends typeof lastFight>(v: T): T => ((lastFight = v), v);
export function refresh() {
  {
    const ph = `${g.turn}${g.phasing}${g.phase}`;
    if (ph !== lastPhase) {
      const was = lastPhase;
      setLastPhase(ph);
      fxLayer.clear();
      setFrameAt(performance.now() + 50);
      setOpenFrame(!was || !camTouched);
    }
  } // until the player first moves the map (the game may arrive after the page opens), the view jumps there instead of sliding
  {
    const ba = g.battle?.area ?? null;
    if (ba !== fxBattle) {
      if (ba != null) fxLayer.clear();
      else
        setTimeout(() => {
          if (!g.battle) fxLayer.clear();
        }, 2500);
      setFxBattle(ba);
    }
  } // a new battle clears the last one's messages; a closed battle's go after a moment to read them      // a new battle clears the last one's messages
  E.setPlayArea(g.inPlay);
  {
    const k = (g.inPlay ?? []).join();
    if (k !== playKey) {
      const first = playKey === null;
      playKey = k;
      if (!first) paintBoard();
      if (g.inPlay || !first) setGoal(homeGoal());
    }
  }
  SBU.hotseatSync();
  if (LAB_SIDE) {
    const as = (f: () => void) => {
      setLabActing(true);
      try {
        f();
      } finally {
        setLabActing(false);
      }
    };
    setTimeout(
      () =>
        labStep(
          () => g,
          (f) => as(() => act(f)),
          render,
          () =>
            as(() => {
              if (g.battle) rollStage(g.battle);
            }),
          () => !!rollView || !!heldNext,
        ),
      0,
    );
  } // the computer's dice are thrown on the table like a player's
  if (online.mode === 'remote') setTimeout(driveSplit, 0);
  {
    const key = `${online.devSeat}|${online.mySide()}|${g.battle?.attPoint}|${reinforcing}|${g.battle?.stage}|${g.battle?.pending}|${selChit}|${selArea}|${tgtMode}|${g.turn}${g.phase}|${g.log.length}|${g.rolls}`; // the dry runs behind the highlights are costly: redo them only when something they depend on changed
    if (key !== tgtKey) {
      tgtKey = key;
      setTgt(
        reinforcing
          ? reinforceTargets()
          : (decisionTargets() ??
              (selChit && mine(g.chits.find((x) => x.id === selChit)?.side ?? P1)
                ? VOL.targetsFor(() => g, g.chits.find((x) => x.id === selChit) ?? null, {
                    area: selArea,
                    mode: tgtMode,
                    setArea: (a) => {
                      setSelArea(a);
                    },
                    setMode: (m) => {
                      setTgtMode(m);
                    },
                    face: (u) => unitPic(u),
                    areaName,
                  })
                : null)),
      );
    }
  }
  if (tint === 'control') {
    const k = JSON.stringify(g.control) + E.contestedAreas(g).join();
    if (k !== ctlKey) {
      ctlKey = k;
      paintBoard();
    }
  }
  syncView();
  syncBattleCam();
  drawPieces();
  paintAreas();
  drawRoute();
  setBadges(g.battle ? [] : badgeList());
  syncBadges();
  syncMoveMarks();
  syncTags();
  syncAreaTags();
  render();
  if (!rollView) {
    const cv = $('#dice');
    if (cv && cv.style.display !== 'none') {
      clearDice();
      cv.style.display = 'none';
    }
  }
}
