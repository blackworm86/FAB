import * as THREE from 'three';
import { translateDom } from './i18n';
import * as E from '../../engine/src';
import { loadChitArt } from './chits';
import { loadGolanChitArt } from './golan-art';
import { loadSicilyChitArt } from './sicily-art';
import * as SB from './sandbox';
import { vpStrip, vpSheet, endPanel } from './score';
import * as SBU from './sandbox-ui';
import {
  online,
  startOnline,
  setDevSeat,
  lobby,
  publishReveals,
  DEV,
  TABLE,
  HAS_TABLE,
  DEV_FAKE,
  SANDBOX,
  TUTORIAL,
  type DevSeat,
  type Match,
} from './online';
import { ICONS, ico } from './icons';
import { esc, nm } from './util';
import { sheets } from './sheets';
import { ABBR, STAGE_NAME } from './table-text';
import { initChat, chatHtml, bindChat } from './chat';
import { acts, actv, resetActs, reg, regv, ubtn, btn } from './ui-kit';
import { optChooser } from './opt-rules';
import { moveNotice, handedOver, turnOf } from './notices';
import { STEP_NAME, homeUrl, bindAuth } from './home';
import { snap, FX_SAMPLES } from './fx';
import { initTouch } from './touch';
import { throwDice, clearDice } from './dice3d';
import { initTutorial } from './tutorial';
import { linkRules } from './rules-link';
import { LAB_SIDE, labStep } from './lab';
import { $, areaName, first, MAP, MH, MW, P1, P2, PARAMS, S, toWorld, TUT, VOL } from './page';
export * from './page';
import {
  addressOpts,
  g,
  previewArea,
  record,
  replayShown,
  save,
  selArea,
  selChit,
  selUnit,
  setApplyingRemote,
  setAreaPick,
  setG,
  setHoverArea,
  setOppTurn,
  setPreviewArea,
  setReplayShown,
  setSelArea,
  setSelChit,
  setSelUnit,
  setTut,
  showReplay,
  tut,
} from './game-state';
export * from './game-state';
import { boardCv, cam, canvas, PHONE, renderer, scene } from './scene';
export * from './scene';
import { REL, settle, show3d } from './map3d';
export * from './map3d';
import { clearRatio, fitBattleView, markers, pieces, pumpTextures, setClearRatio } from './piece-kit';
export * from './piece-kit';
import { drawPieces } from './pieces';
export * from './pieces';
import {
  camFar,
  labelsGrp,
  labelTilt,
  paintAreas,
  paintBoard,
  setCamFar,
  setLabelTilt,
  setTutView,
  tint,
  viewRot,
  viewSide,
} from './map-paint';
export * from './map-paint';
import { dist, opened, pitch, placeCam, ptrs, setDist, setOpened, setPitch, setYaw, target, yaw } from './camera';
export * from './camera';
import {
  act,
  actorNow,
  allowed,
  fxLayer,
  hist,
  infoOpen,
  lockOf,
  mine,
  noteFx,
  notYou,
  other,
  say,
  selArr,
  setBattleFx,
  setInfoOpen,
  setLabActing,
  setNote,
  setRollFx,
  setSelArr,
  setTgt,
  setTgtMode,
  tgtMode,
  toast,
  toastInfo,
  undo,
} from './flow';
export * from './flow';
import {
  airPickHtml,
  altPickHtml,
  auditWarn,
  endHidden,
  feedHtml,
  followFoe,
  gotRemote,
  heldBad,
  heldBadBar,
  saPickHtml,
  scoreOpen,
  setAuditWarn,
  setEndHidden,
  setGotRemote,
  setHeldBad,
  setScoreOpen,
} from './choices';
export * from './choices';
import {
  center,
  clampDist,
  goal,
  lock,
  optsFor,
  reinforceTargets,
  reinforcing,
  setGoal,
  setInBattle,
  setReinforcing,
  syncBattleCam,
} from './map-input';
export * from './map-input';
import { badgeList, drawRoute, setBadges, syncBadges } from './routes';
export * from './routes';
import {
  decisionBubble,
  decisionTargets,
  pieceScreen,
  placeBadges,
  renderFocus,
  syncAreaTags,
  syncMoveMarks,
  syncTags,
  tagPpu,
} from './map-marks';
export * from './map-marks';
import {
  afterDice,
  anims,
  commitRoll,
  endRoll,
  heldNext,
  hideDice,
  menuTab,
  modal,
  rollStage,
  rollView,
  type RollView,
  runAnims,
  setHeldNext,
  setModal,
  setRestartAsk,
  setRollView,
  showChecks,
} from './rolls';
export * from './rolls';
import { chitImg, chitTargets, drag, lastPointer, setLastPointer, tapCard } from './cards';
export * from './cards';
import { canMove, endArmed, guardEnd, guide, lookAt, primary, prompt, setGuide, topBar } from './prompt';
export * from './prompt';
import { dockChips, undoBtn } from './dock';
export * from './dock';
import { chitPic, piecesSide, piecesTab, setInspectId, unitPic } from './pieces-window';
export * from './pieces-window';
import { dispatch, dragArrival, frameArrival } from './unit-card';
export * from './unit-card';
import { b3, mapDock, unitFace } from './map-dock';
export * from './map-dock';
import { battleTable, handCards, ledger, setRefusal, volPanel } from './battle-view';
export * from './battle-view';
import { homeGoal, matches, modalHtml, onScreen, openingTarget, seatBar, setMatches, showAreas } from './menus';
export * from './menus';
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
function syncView() {
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
let ctlKey = '',
  tgtKey = '';
let playKey: string | null = null;
export let lastFight: number | null = null;
export const setLastFight = <T extends typeof lastFight>(v: T): T => ((lastFight = v), v);
export function refresh() {
  {
    const ph = `${g.turn}${g.phasing}${g.phase}`;
    if (ph !== lastPhase) {
      const was = lastPhase;
      lastPhase = ph;
      fxLayer.clear();
      frameAt = performance.now() + 50;
      openFrame = !was || !camTouched;
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
      fxBattle = ba;
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
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches; // no floating motion for players who asked for less motion
let lastPhase = '';
export let lastInput = performance.now(),
  tick = 0,
  fxBattle: number | null = null,
  frameAt = 0,
  openFrame = false,
  camTouched = false;
export const setCamTouched = <T extends typeof camTouched>(v: T): T => ((camTouched = v), v);
export const setLastInput = <T extends typeof lastInput>(v: T): T => ((lastInput = v), v);
/** ?fps=1: a small corner counter (frames per second, slowest frame) for measuring on a real phone. */
const fpsEl = new URLSearchParams(location.search).has('fps')
  ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fps' })
  : null;
let fpsN = 0,
  fpsT = performance.now(),
  fpsWorst = 0,
  fpsLast = performance.now();
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize'])
  window.addEventListener(
    ev,
    () => {
      lastInput = performance.now();
    },
    { passive: true },
  );
function frame() {
  requestAnimationFrame(frame);
  pumpTextures();
  if (!goal && !anims.length && !rollView && performance.now() - lastInput > 2000 && tick++ % 3) return;
  if (fpsEl) {
    const now = performance.now();
    fpsWorst = Math.max(fpsWorst, now - fpsLast);
    fpsLast = now;
    fpsN++;
    if (now - fpsT > 1000) {
      fpsEl.textContent = `${Math.round((fpsN * 1000) / (now - fpsT))} fps · slowest ${Math.round(fpsWorst)} ms${now - lastInput > 2000 ? ' · idle' : ''}`;
      fpsN = 0;
      fpsT = now;
      fpsWorst = 0;
    }
  }
  // idle: about 20 frames a second is enough for the floating markers, and spares the battery
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) {
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.updateProjectionMatrix();
  }
  if (goal) {
    const k = goal.fast ? 0.28 : 0.1;
    target.lerp(goal.t, k);
    setDist(dist + (goal.dist - dist) * k);
    setPitch(pitch + (goal.pitch - pitch) * k);
    if (target.distanceTo(goal.t) < 0.05 && Math.abs(dist - goal.dist) < 0.1) setGoal(null);
  }
  if (lock && !goal) target.copy(lock.c);
  if (!CALM) {
    const t = performance.now() / 1000;
    for (const k of markers.children) {
      const f = k.userData.float;
      if (f) {
        k.position.y = f.y + ((k.userData.lift as number | undefined) ?? 0) + Math.sin(t * 1.6 + f.ph) * 0.07;
        k.rotation.y = viewRot() + Math.sin(t * 0.9 + f.ph) * 0.22;
      }
    }
  } // a slow 4 s bob and 7 s sway, each marker out of step
  {
    const old = Math.round(clearRatio * 5);
    setClearRatio(fitBattleView());
    if (g.battle && Math.round(clearRatio * 5) !== old) syncBattleCam();
  }
  if (REL) {
    const near = dist < (PHONE ? 40 : 55);
    REL.props.children[0].visible = REL.props.children[1].visible = near;
  } // trees only up close: at overview they are noise over the map   // phones: trees only when zoomed in (thousands of them are the heaviest part)
  {
    const f = Math.cos(yaw) < 0;
    if (f !== camFar) {
      setCamFar(f);
      paintBoard();
    }
  } // the camera has swung past the side: the printed words turn to face it
  {
    const tilt = show3d() ? Math.min(0.75, Math.max(0, 0.8 - pitch) * 1.3) : 0; // a low look across the 3D table: the names stand up toward the player, as the hovering boxes do, so they stay readable
    if (Math.abs(tilt - labelTilt) > 0.005) {
      setLabelTilt(tilt);
      for (const l of labelsGrp.children)
        if (l.userData.lh) {
          l.rotation.x = -Math.PI / 2 + tilt;
          l.position.y = l.userData.y0 + (Math.sin(tilt) * l.userData.lh) / 2;
        }
    }
  }
  if (!opened) {
    setOpened(true);
    if (!g.inPlay && !TUT) {
      target.copy(openingTarget());
      if (innerWidth <= 700) {
        const ps = g.units.filter((u) => u.area != null && MAP.areas.some((x) => x.id === u.area)).map((u) => center(u.area!)),
          span = ps.length ? Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x)) : 40;
        setDist(clampDist(span * 1.25 + 8));
      }
    }
  } // the first frame looks at the front of this game; a phone frames the front's width, not the whole sheet
  placeCam();
  runAnims();
  settle();
  renderer.render(scene, cam);
  renderFocus();
  placeBadges();
  if (frameAt && performance.now() > frameAt) {
    frameAt = 0;
    if (!g.battle && mine(g.phasing) && allowed()) {
      // a new step (or the opening): what it is about comes into view
      const ids =
        g.phase === 'combat' || g.phase === 'btCombat'
          ? E.mustFight(g).slice(0, 1)
          : ['movement', 'btMove'].includes(g.phase)
            ? [...new Set(g.units.filter((u) => u.side === g.phasing && u.area != null && optsFor(u.id).length).map((u) => u.area!))]
            : [];
      if (ids.length && !ids.some(onScreen)) {
        showAreas(ids);
        if (openFrame && goal) {
          target.copy(goal.t);
          setDist(goal.dist);
          setPitch(goal.pitch);
          setGoal(null);
        }
      }
    }
    openFrame = false;
  }
}
/** A new or loaded game replaces the table: nothing of the old one stays on screen (dice, pop-ups, selection, windows, undo). */
function startOver(x: E.Game) {
  if (heldNext) commitRoll();
  setRollView(null);
  hideDice();
  setG(x);
  hist.clear();
  setSelUnit(setSelChit(setSelArr(null)));
  setSelArea(setPreviewArea(setHoverArea(null)));
  setModal(null);
  setScoreOpen(false);
  setReinforcing(false);
  setBattleFx([]);
  setRollFx([]);
  tgtKey = '';
  setInBattle(false);
  setNote('');
  setAreaPick(null);
  setRestartAsk(false);
  fxLayer.clear();
  save();
  refresh();
}
SBU.initSandboxUi({
  get g() {
    return g;
  },
  set g(v) {
    setG(v);
  },
  get selUnit() {
    return selUnit;
  },
  set selUnit(v) {
    setSelUnit(v);
  },
  get selChit() {
    return selChit;
  },
  set selChit(v) {
    setSelChit(v);
  },
  get selArr() {
    return selArr;
  },
  set selArr(v) {
    setSelArr(v);
  },
  get selArea() {
    return selArea;
  },
  set selArea(v) {
    setSelArea(v);
  },
  get previewArea() {
    return previewArea;
  },
  set previewArea(v) {
    setPreviewArea(v);
  },
  get rollView() {
    return rollView;
  },
  set rollView(v) {
    setRollView(v as RollView | null);
  },
  ABBR,
  actorNow,
  areaName,
  b3,
  chitImg,
  unitFace,
  unitPic,
  chitPic,
  hist,
  refresh,
  render,
  save,
  say,
  reg,
  regv,
  ubtn,
  optChooser: (o: Partial<E.Opts>) => optChooser(o, VOL.id),
  scenarios: VOL.scenarios,
  defaultOpts: VOL.defaultOpts,
  optional: VOL.features.optional,
  startOver,
});
initTouch(document.body);
initChat(say, render);
const toScreen = (p: THREE.Vector3) => {
  const r = canvas.getBoundingClientRect(),
    v = p.clone().project(cam);
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
};
setTut(
  TUT
    ? initTutorial(
        {
          game: () => g,
          act,
          load: startOver,
          unitScreen: (id) => pieceScreen(id),
          areaScreen: (a) => {
            const c = center(a);
            return toScreen(new THREE.Vector3(c.x, 0, c.z));
          },
          lookAt: (a) => {
            const p = center(a);
            setGoal({ t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, innerWidth < 700 ? 34 : 30), pitch });
          },
          select: (id) => {
            if (g.pendingArrivals.includes(id)) setSelArr(id);
            else {
              setSelUnit(id);
              setSelArea(g.units.find((u) => u.id === id)?.area ?? null);
            }
            refresh();
          },
          moving: () => ptrs.size > 0,
          pan: (dx, dy) => {
            setGoal(null);
            const k = dist * 0.0018,
              c = Math.cos(yaw),
              sn = Math.sin(yaw);
            target.x -= (dx * c + dy * sn) * k;
            target.z -= (-dx * sn + dy * c) * k;
          },
          fold: () => {
            if (infoOpen) {
              setInfoOpen(false);
              render();
            }
          },
          toast: (t) => say(t),
          busy: () => !!rollView || !!heldNext,
          guide: () => guide,
          setGuide: (v) => {
            setGuide(v);
            render();
          },
          view: (sd) => {
            if (VOL.sides.includes(sd)) {
              setTutView(sd as E.Side);
              refresh();
            }
          },
          home: (to) => {
            try {
              if (to) sessionStorage.setItem('fab-new', `${to.game}:${to.scenario}`);
            } catch {
              /* private mode */
            }
            location.href = homeUrl();
          },
        },
        TUT,
      )
    : null,
);
frame();
Promise.all([loadChitArt(), VOL.id === 'golan73' ? loadGolanChitArt() : null, VOL.id === 'sicily' ? loadSicilyChitArt() : null])
  .catch((e) => console.error(e))
  .finally(() => {
    refresh();
  });
let lobbyUid = '';
const onNet = (): void => {
  if (online.mode !== 'remote' || !online.hasAccounts) return;
  if (lobbyUid !== online.uid) {
    lobbyUid = online.uid;
    lobby.watch((m) => {
      setMatches(m);
      render();
    });
  }
  const next = (() => {
    try {
      return sessionStorage.getItem('fab-next');
    } catch {
      return null;
    }
  })();
  if (next && !HAS_TABLE && online.account && !online.account.guest) {
    try {
      sessionStorage.removeItem('fab-next');
    } catch {
      /* private mode */
    }
    location.href = `${homeUrl()}?table=${next}`;
  } // back to the invite that sent you to sign in
};
document.addEventListener('fab-redraw', () => render());
void startOnline(
  (rg) => {
    setApplyingRemote(true);
    if (heldNext) commitRoll();
    const prevG = g,
      firstRemote = !gotRemote; // a roll still on screen is finished locally, never pushed back over what arrived
    if ((rg.game ?? 'bulge') !== VOL.id) {
      const u = new URL(location.href);
      u.searchParams.set('game', rg.game ?? 'bulge');
      location.replace(u.href);
      return;
    } // a shared table of another game: this page is built for one game, so it reloads as that one
    {
      const by = online.lastBy,
        w: E.Side | null = online.seats.german === by ? P1 : online.seats.allied === by ? P2 : null; // referee-lite: check what the other browser wrote
      if (by && by !== online.uid && E.isRestore(prevG, rg)) {
        setHeldBad(null);
        setAuditWarn(
          [
            ...auditWarn,
            `The other player's rules check put the game back to the last legal position: ${rg.restored!.why.join(' ')}`,
          ].slice(-6),
        );
      } else if (by && by !== online.uid && gotRemote) {
        const p = E.auditChange(prevG, rg, w);
        if (p.length) {
          console.warn('rules check', p);
          setHeldBad({ game: rg, why: p });
          setApplyingRemote(false);
          render();
          return;
        }
      }
      setGotRemote(true);
      setHeldBad(null);
      record(false, rg);
      if (PARAMS.get('replay') && rg.over && !replayShown) {
        setReplayShown(true);
        setTimeout(() => {
          void showReplay();
        }, 400);
      } // opened from the home page list
      {
        const me = online.mySide();
        if (me) setOppTurn(turnOf(rg, other(me))); // 4.3: the other player's move made it ours
        if (me && by && by !== online.uid && !firstRemote && handedOver(prevG, rg, me))
          void moveNotice(
            `Your move · ${VOL.name}`,
            `Turn ${rg.turn} · ${STEP_NAME[rg.phase] ?? rg.phase}${rg.battle ? ' · a battle waits for you' : ''}`,
            `fab-${TABLE}`,
          );
      }
    }
    const ckLast = JSON.stringify(g.checks?.at(-1) ?? null);
    const was = g.battle,
      n0 = was?.rolls.length ?? 0,
      st0 = was?.stage,
      pre = was ? snap(g) : null;
    setApplyingRemote(true);
    setG(rg);
    const nb = g.battle;
    if (nb && !was) {
      setBattleFx([]);
      setRollFx([]);
    }
    const rolled = !!(was && nb && nb.area === was.area && nb.rolls.length > n0);
    if (pre) {
      try {
        noteFx(pre, g, rolled);
      } catch (e) {
        console.error(e);
      }
    } // a failure while describing the changes must never stop the screen from updating
    if (was && nb && nb.area === was.area && nb.rolls.length > n0 && st0 && STAGE_NAME[st0]) {
      // the other player rolled: show their dice here too
      const side = st0 === 'attArty' || st0 === 'offFire' || st0 === 'exploit' ? nb.attacker : other(nb.attacker);
      setRollView({
        remote: true,
        morale: st0 === 'exploit',
        title: `${nm(side)} ${STAGE_NAME[st0]}`,
        pos: null,
        groups: nb.rolls.slice(n0).map((r) => ({
          label: r.who,
          col: r.kind === 'arty' ? 's' : first(side) ? 'k' : 'w',
          sn: r.sn,
          dice: r.dice,
          hits: r.hits,
          parts: [],
        })),
      });
      if (rollView!.groups.length) {
        setHeldNext(g);
        setG(prevG);
      } // the board keeps the old state until the dice land
      if (rollView!.groups.length) {
        const cv = $('#dice') as HTMLCanvasElement;
        cv.style.display = 'block';
        throwDice(cv, rollView!.groups, (p) => {
          if (rollView) {
            const rv = rollView;
            rv.pos = p;
            render();
            afterDice(rv);
          }
        });
      } else setRollView(null); // the other player's dice clear themselves
    }
    {
      const same = prevG.turn === g.turn && prevG.phase === g.phase && prevG.phasing === g.phasing && !!prevG.battle === !!g.battle;
      const keep = (prev: E.Game, id: string | null, f: (x: E.Game) => unknown) =>
        same && id && JSON.stringify(f(prev)) === JSON.stringify(f(g)) ? id : null; // the other player's write keeps what you picked, unless it changed that very piece
      setSelUnit(keep(prevG, selUnit, (x) => x.units.find((u) => u.id === selUnit)));
      setSelChit(keep(prevG, selChit, (x) => x.chits.find((c) => c.id === selChit)));
      setSelArr(keep(prevG, selArr, (x) => [x.pendingArrivals.includes(selArr!), x.units.find((u) => u.id === selArr)?.area]));
      if (!same) setSelArea(null);
      if (!selUnit) setPreviewArea(null);
      setHoverArea(null);
    }
    hist.remote(prevG, g, lockOf);
    if (rolled) hist.clear('dice rolled');
    if (followFoe && online.lastBy && online.lastBy !== online.uid && !g.battle) {
      const mv = g.units.find((u) => {
        const o = prevG.units.find((x) => x.id === u.id);
        return o && u.area != null && o.area !== u.area;
      });
      if (mv) lookAt(mv.area!);
    }
    try {
      save();
    } finally {
      setApplyingRemote(false);
    }
    refresh();
    {
      const cs = g.checks ?? [],
        k = cs.findIndex((c) => JSON.stringify(c) === ckLast);
      const fresh = ckLast === 'null' ? [] : k >= 0 ? cs.slice(k + 1) : [];
      if (fresh.length) showChecks(fresh);
    }
  },
  () => {
    onNet();
    syncView();
    render();
  },
  say,
  () => {
    try {
      sessionStorage.setItem('fab-notice', 'That game was deleted by its creator.');
    } catch {
      /* private mode */
    }
    location.href = homeUrl();
  },
); // the table is gone: nobody stays inside it
if (SANDBOX && SB.PRESET_KEYS.some((k) => PARAMS.has(k))) {
  // a rules-checklist link: a fresh table set up on the rule's situation, once (the address is cleaned so a reload keeps the edits)
  setG(SB.preset(E.newGame(undefined, addressOpts()), PARAMS));
  hist.clear();
  save();
  const q = new URLSearchParams(location.search);
  for (const k of [...SB.PRESET_KEYS, 'scenario', 'rules', 'fuel']) q.delete(k);
  history.replaceState(null, '', `${location.pathname}?${q}`);
  refresh();
  if (PARAMS.get('case')) say(`Testing ${PARAMS.get('case')}`);
}
if (import.meta.env.DEV || DEV_FAKE || SANDBOX || TUTORIAL)
  Object.assign(window, {
    __fab: {
      seat: (sd: E.Side) => {
        setTutView(sd);
        refresh();
      },
      viewMap: (mx: number, my: number, d: number, pt: number, yw: number) => {
        const p = toWorld(mx, my);
        setGoal({ t: new THREE.Vector3(p.x, show3d() ? REL!.h(p.x, p.z) : 0, p.z), dist: d, pitch: pt, fast: true });
        setYaw(yw);
      },
      tut: () => tut,
      tagPpu: () => tagPpu,
      unitAt: (id: string) => {
        const m = pieces.children.find((o) => o.userData.unit === id || o.userData.chit === id);
        if (!m) return null;
        const r = canvas.getBoundingClientRect(),
          v = m.getWorldPosition(new THREE.Vector3()).project(cam);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      },
      game: () => g,
      setGame: (x: E.Game) => {
        setG(x);
        hist.clear();
        save();
        refresh();
      },
      at: (a: number) => {
        const p = center(a),
          r = canvas.getBoundingClientRect(),
          v = new THREE.Vector3(p.x, 0, p.z).project(cam);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      },
      project: (x: number, y: number, z: number) => {
        const r = canvas.getBoundingClientRect(),
          v = new THREE.Vector3(x, y, z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
      },
      online,
      setMatches: (m: Match[]) => {
        setMatches(m);
      },
      iconList: () => Object.keys(ICONS).map((k) => ({ k, html: ico(k) })),
      fxDemo: () =>
        FX_SAMPLES.map(
          (f) =>
            `<div class="fx ${f.cls}" style="position:static;animation:none;margin:8px;width:max-content">${ico(f.icon)}<b>${esc(f.head)}</b><small>${esc(f.text)}</small></div>`,
        ).join(''),
      sheets: () => sheets(VOL),
      setModal: (m: typeof modal) => {
        setModal(m);
        render();
      },
      info: () => renderer.info.memory,
      rel: () => ({
        tris: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        trees: (REL?.props.children[0] as THREE.InstancedMesh | undefined)?.count,
      }),
      board: () => boardCv.toDataURL('image/png'),
      view: (x: number, z: number, d: number, pt: number, yw: number) => {
        setGoal({ t: new THREE.Vector3(x, 0, z), dist: d, pitch: pt, fast: true });
        setYaw(yw);
      },
      layout: () => ({
        MW,
        MH,
        S,
        pieces: pieces.children.map((o) => ({ unit: o.userData.unit as string, x: o.position.x, z: o.position.z })),
      }),
      E,
      get g() {
        return g;
      },
      set g(v: E.Game) {
        setG(v);
      },
      refresh,
      act,
      sel: (u: string, a?: number) => {
        setSelUnit(u);
        setSelArea(g.units.find((x) => x.id === u)!.area);
        setPreviewArea(a ?? null);
        refresh();
      },
    },
  });
