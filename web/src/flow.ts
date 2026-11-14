// The flow of play: the bar for playing a chit, the steps of the turn, messages, who may act, doing and undoing an action, what a hit did, and arrivals.
import * as E from '../../engine/src';
import { History } from './history';
import * as SBU from './sandbox-ui';
import { online, SANDBOX } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { iconify } from './table-text';
import { reg, ubtn, btn } from './ui-kit';
import { type Tgt } from './chit-play';
import { snap, diffFx, FxLayer, type Fx } from './fx';
import { RULE, ruleHtml } from './rules-text';
import { showRules } from './rules-link';
import { LAB_SIDE, labHuman } from './lab';
import { VOL } from './page';
import { g, save, selArea, selChit, selUnit, setG, setHoverArea, setPreviewArea, setSelArea, setSelChit, setSelUnit } from './game-state';
import { canvas } from './scene';
import {
  altOk,
  altPick,
  canMove,
  chitPic,
  commitRoll,
  guide,
  gx,
  heldBad,
  heldNext,
  kbArea,
  kbEnter,
  kbStep,
  lookAt,
  mapMenu,
  modal,
  nextOf,
  phaseOpen,
  pickSA,
  refresh,
  render,
  scoreOpen,
  setAltPick,
  setKbArea,
  setMapMenu,
  setModal,
  setPhaseOpen,
  setScoreOpen,
  showChecks,
  TAGRE,
} from './main';

/* ---------- ui helpers ---------- */
/* ---------- playing a chit: the blocks or areas it can be used on light up, and a tap applies it ---------- */
export let tgt: Tgt | null = null,
  infoOpen = false,
  infoFor = '',
  tgtMode = '';
export const setInfoOpen = <T extends typeof infoOpen>(v: T): T => ((infoOpen = v), v);
export const setTgtMode = <T extends typeof tgtMode>(v: T): T => ((tgtMode = v), v);
export const setTgt = <T extends typeof tgt>(v: T): T => ((tgt = v), v);
const abtn = (icon: string, label: string, fn: () => void, cls = '', dis = false, title = '') =>
  btn(`${ico(icon)}<span>${esc(label)}</span>`, fn, 'ab ' + cls, dis, title || label);
/** The selected chit: a slim bar with its picture, a one-line instruction, an info toggle and the actions as icon buttons. */
export function chitBar(c: E.Chit): string {
  if (!mine(c.side))
    return `<div class="c-dispatch chitbar ${infoOpen ? 'open' : ''}"><div class="cbhead"><span class="cbimg">${chitPic(c)}</span><div class="cbt"><b>${esc(c.name)}</b><small>The other side's piece: you can only look</small></div><button class="ico" data-ui="${reg(
      () => {
        setSelChit(null);
      },
    )}" aria-label="Put away" title="Put away">${ico('close')}</button></div><div class="inspect slimcard">${ruleHtml(VOL.ruleKey(c.kind, c), E.isEvent(c))}</div></div>`;
  const tg = tgt,
    body = chitPanel(c),
    [kind] = RULE[VOL.ruleKey(c.kind, c)] ?? [c.kind];
  const chips =
    tg?.chips
      .map(
        (x) =>
          `<button class="pc ${c.side}" data-do="${reg(x.fn)}" title="${esc(x.label)}">${x.img}<small>${esc(x.label)}</small></button>`,
      )
      .join('') ?? '';
  if (infoFor !== c.id) {
    infoFor = c.id;
    infoOpen = guide === 'full';
  } // each chit opens with its rules folded (short mode) or shown (full mode)
  return `<div class="c-dispatch chitbar ${infoOpen ? 'open' : ''}"><div class="cbhead"><span class="cbimg">${chitPic(c)}</span><div class="cbt"><b>${esc(c.name)}</b><small>${tg?.hint ? gx(esc(tg.hint), esc(kind)) : esc(kind)}</small></div>
    <button class="ico" data-ui="${reg(() => {
      infoOpen = !infoOpen;
    })}" aria-pressed="${infoOpen}" aria-label="What it does" title="What it does">${ico('info')}</button><button class="ico" data-ui="${reg(
      () => {
        setSelChit(null);
      },
    )}" aria-label="Put away" title="Put away">${ico('close')}</button></div>
    ${
      tg && tg.modes.length > 1
        ? `<div class="modes" role="group" aria-label="What to do">${tg.modes
            .map(
              (m) =>
                `<button class="ico ${m.id === tgtMode ? 'on' : ''}" data-ui="${reg(() => {
                  tgtMode = m.id;
                  refresh();
                })}" title="${esc(m.label)}" aria-label="${esc(m.label)}">${ico(m.icon)}<span>${esc(m.label)}</span></button>`,
            )
            .join('')}</div>`
        : ''
    }${infoOpen ? `<div class="inspect slimcard">${ruleHtml(VOL.ruleKey(c.kind, c), E.isEvent(c))}</div>` : ''}${chips ? `<div class="cbchips">${chips}</div>` : ''}${
      tg?.buttons.length || altOk(c)
        ? `<div class="row">${(tg?.buttons ?? []).map((b) => abtn(b.icon, b.label, b.fn, '', false, b.title)).join('')}${
            altOk(c)
              ? ubtn(
                  `${ico('swap')}<span>Alternate use</span>`,
                  () => {
                    setAltPick({ chit: c.id, sel: [] });
                  },
                  'ab',
                  false,
                  '4.21: spend the event to put two eliminated assets of your choice back in the cup',
                )
              : ''
          }</div>`
        : ''
    }${iconify(body)}</div>`;
}
function chitPanel(c: E.Chit): string {
  const a = selArea,
    out: string[] = [];
  if (c.box !== 'available') return '<p class="hint">Only chits in the Available Box can be used.</p>';
  if (g.phase === 'supply' && c.kind === 'air_mission' && VOL.id === 'bulge')
    return '<p class="hint">Air Supply (17.21): pick a cut-off area in the Supply check panel.</p>';
  if (g.phase !== 'admin' && VOL.id === 'sicily' && c.kind === 'air_mission')
    return '<p class="hint">Air support: interdiction in the Admin Phase, ground support in a battle, air supply in the Supply Phase (use the panel), and dogfights against any of these (16.3).</p>';
  if (g.phase !== 'admin' && VOL.id === 'golan73' && ['sam', 'event_ew', 'event_counterbattery', 'air_mission'].includes(c.kind))
    return `<p class="hint">${c.kind === 'sam' ? 'SAMs answer Israeli air missions east of the barrier as they are flown (16.12).' : c.kind === 'air_mission' ? "Close air support in a battle's set-up; interdiction and reconnaissance in the Admin Phase (16.31)." : "Played in a battle's set-up as your one event (17.33, 17.34)."}</p>`;
  if (g.phase !== 'admin')
    return `<p class="hint">${E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission' ? 'This chit is assigned to a battle during the Combat Phase.' : c.kind === 'fuel' ? 'Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.' : c.kind === 'sa_block' || c.kind === 'special_action_event' ? 'Special Actions are spent in battles (reinforce / retreat), Breakthrough phases and the Admin Phase.' : 'Events are played in the Admin Phase.'}</p>`;
  if (VOL.id !== 'bulge') return ''; // the other volumes offer everything through the glowing targets and buttons
  if (c.kind.startsWith('replacement') || c.kind === 'event_arriving_regiment' || c.kind.startsWith('rebuild')) {
    if (!tgt || !(tgt.units.size + tgt.areas.size + tgt.pick.size + tgt.chips.length))
      out.push(
        '<p class="hint">No reduced, supplied unit of the right class and Higher Echelon (never the elite step)' +
          (c.kind.startsWith('rebuild') ? ', and no eliminated one-step unit to bring back' : '') +
          '.</p>',
      );
  } else if (c.kind === 'fuel')
    out.push('<p class="hint gx">Fuel is spent automatically when a German unit moves more than 3 MP or strategic-moves.</p>');
  return `<div class="row">${out.join('')}</div>`;
}

/* ---------- flow ---------- */
const STEPS = ['Prepare', 'Move', 'Fight', 'Breakthrough', 'Supply'],
  STEP_OF: Record<E.Phase, number> = {
    deploy: 1,
    reinforcement: 0,
    admin: 0,
    movement: 1,
    strategic: 1,
    combat: 2,
    reaction: 2,
    btMove: 3,
    btCombat: 3,
    supply: 4,
  };
/** The red button that ends the step. */
/** Sicily 14.27a: airborne units still to drop at the start of the Allied Combat Phase (they come before any battle). */
export const dropsLeft = () =>
  VOL.id === 'sicily' && g.phase === 'combat' && !g.battle && (g.vol as { dropPending?: boolean } | undefined)?.dropPending
    ? g.units.filter((u) => u.box === 'airborne_assault' && u.side === g.phasing).length
    : 0;
export const endLabel = () =>
  dropsLeft()
    ? 'Drop the airborne first'
    : g.phase === 'reinforcement'
      ? 'End reinforcement'
      : g.phase === 'deploy'
        ? ((left) => {
            const n = left.filter((u) => u.side === g.phasing).length;
            return n ? `Place ${n} more first` : left.length ? 'Finish the panel first' : 'End set-up';
          })(
            VOL.pendingPlace(g)
              .map((id) => g.units.find((x) => x.id === id)!)
              .filter((u) => mine(u.side)),
          )
        : ((
            {
              admin: 'End admin',
              movement: 'End movement',
              strategic: 'End strategic',
              combat: 'End combat',
              reaction: 'End reaction',
              btMove: 'End breakthrough moves',
              btCombat: 'End breakthrough battles',
              supply: 'End supply',
            } as Record<string, string>
          )[g.phase] ?? `End ${STEPS[STEP_OF[g.phase]].toLowerCase()}`); // the same name as the phase tab
export const other = E.other;
/** The printed sequence of play (the step bar): Breakthrough covers its movement and its combat. */
export const PHASES = ['Reinforcement', 'Admin', 'Movement', 'Strategic', 'Combat', 'Reaction', 'Breakthrough', 'Supply'],
  PHASE_OF: Record<E.Phase, number> = {
    deploy: 2,
    reinforcement: 0,
    admin: 1,
    movement: 2,
    strategic: 3,
    combat: 4,
    reaction: 5,
    btMove: 6,
    btCombat: 6,
    supply: 7,
  };
/** Areas a battle can start in now. Breakthrough Combat (8.22): areas contested before movement only with a Special Action available. */
export const fightable = () => {
  const nw = g.phase === 'btCombat' ? new Set(E.newlyContested(g)) : null,
    sa = nw && (E.saAvailable(g, g.phasing).length > 0 || (VOL.id === 'golan73' && E.golan.freeRoundLeft(g))),
    first = E.firstBattle(g);
  return E.contestedAreas(g).filter(
    (a) =>
      !g.fought.includes(a) &&
      (!nw || nw.has(a) || sa) &&
      (first == null || a === first) &&
      E.fighters(g, a, g.phasing, true).some((u) => !u.garrison),
  );
}; // an attacker in good order (strongpoints and assets never attack)
/* Owner, 13 Nov: no phase is ever skipped for the player; every step of the turn waits for its own End button. */
export let toast = '',
  toastT = 0,
  toastInfo = false;
export const setToastInfo = <T extends typeof toastInfo>(v: T): T => ((toastInfo = v), v);
export const setToast = <T extends typeof toast>(v: T): T => ((toast = v), v);
let sayDraw = 0;
export const say = (t: string, info = false) => {
  toast = t;
  toastInfo = info;
  clearTimeout(toastT);
  toastT = window.setTimeout(() => {
    toast = '';
    render();
  }, 3200);
  if (!sayDraw)
    sayDraw = window.setTimeout(() => {
      sayDraw = 0;
      render();
    }, 0);
}; // a refusal shows at once, even when the caller does not redraw
export let dragTargets: number[] = [];
export const setDragTargets = <T extends typeof dragTargets>(v: T): T => ((dragTargets = v), v);
export const hist = new History<E.Game>();
export let note = '',
  selArr: string | null = null;
export const setNote = <T extends typeof note>(v: T): T => ((note = v), v);
export const setSelArr = <T extends typeof selArr>(v: T): T => ((selArr = v), v);
/** Who may act right now: one side, or both while each handles its own assets (admin, reinforcement, battle set-up). */
export const actorNow = () => E.actorOf(g);
/** In the set-up: does `s` still have pieces or set-up choices to place (Golan: minefields, reserves, the Al-Owda raid; Sicily: the Allied landing plan)? */
export const placing = (s: E.Side) =>
  g.units.some((u) => u.box === 'deploy' && u.side === s) ||
  (g.game === 'golan73' &&
    ((s === 'israeli' && !!E.golan.state(g).minesLeft) ||
      (E.golan.setupReserves(g, s).all && E.golan.reservesLeft(g, s) > 0) ||
      (s === 'syrian' && E.golan.alowdaRaidAreas(g).length > 0))) ||
  (g.game === 'sicily' && s === 'allied' && !E.sicily.state(g).plan);
export let labActing = false; // the experimental computer's own action (lab.ts)
export const setLabActing = <T extends typeof labActing>(v: T): T => ((labActing = v), v);
/** Your own roll is on the table (rolls.ts tells): against the computer you may always clear it, even when the next step is the computer's. */
let ownRollShown = () => false;
export const setOwnRollShown = (f: () => boolean) => (ownRollShown = f);
export const allowed = () =>
  labActing ||
  (LAB_SIDE
    ? !heldBad && (actorNow() === 'both' || actorNow() === labHuman() || ownRollShown())
    : !heldBad &&
      (!online.active || online.both() || (online.mySide() != null && (actorNow() === 'both' || actorNow() === online.mySide())))); // a held-back change waits for a decision first
/** In a shared-screen game every side is yours; online only your own seat's pieces. */
export const mine = (s: E.Side) => (LAB_SIDE ? s === labHuman() : !online.active || online.both() || online.mySide() === s);
export const notYou = () =>
  online.mySide() == null ? 'You are watching. Take a seat in the menu to play.' : `Wait for the ${nm(actorNow() as E.Side)} player.`;
/* ---------- what a hit did: step losses, eliminations, retreats, field works ---------- */
export let battleFx: Fx[] = [],
  rollFx: Fx[] = [];
export const setBattleFx = <T extends typeof battleFx>(v: T): T => ((battleFx = v), v);
export const setRollFx = <T extends typeof rollFx>(v: T): T => ((rollFx = v), v);
/** Record and show what changed between two states. */
export const fxLayer = new FxLayer(),
  showFx = (l: Fx[]) => fxLayer.show(l);
export let pendingFx: Fx[] = [],
  rollNoted = false;
export const setPendingFx = <T extends typeof pendingFx>(v: T): T => ((pendingFx = v), v);
export const setRollNoted = <T extends typeof rollNoted>(v: T): T => ((rollNoted = v), v);
export function noteFx(a: ReturnType<typeof snap>, x: E.Game, fresh?: boolean) {
  const d = diffFx(a, x);
  if (!d.length) return;
  battleFx.push(...d.filter((f) => !battleFx.some((o) => o.head === f.head && o.text === f.text && o.unit === f.unit))); // the battle summary names each effect once
  if (fresh) {
    rollFx = d;
    pendingFx = d;
  } else showFx(d);
} // after a roll the effects wait for the dice to settle
export function act(f: () => void, after = '') {
  if (!allowed()) return say(notYou());
  if (online.mode === 'remote' && !online.rev) return say('The game is still loading…');
  if (heldNext) commitRoll();
  const before = g.battle ? snap(g) : null,
    ck0 = g.checks?.length ?? 0;
  const r = hist.run(
    g,
    () => {
      f();
    },
    (a, b) =>
      after || (b.log.slice(a.log.length).at(-1) ?? '').replace(new RegExp(`^T\\d+ (\\[\\w+\\] )?((${TAGRE}) \\w+: )?`), '').slice(0, 60),
    lockOf,
  );
  setG(r.game);
  if (r.error)
    say(
      /pending|already/.test(r.error.message)
        ? `That choice is no longer open (the game is at ${g.battle?.stage ?? 'no battle'}). Refreshed.`
        : r.error.message,
    );
  else {
    note = after;
    if (before && !rollNoted) noteFx(before, g);
  } // a roll already noted its own effects, to show them once the dice have settled
  rollNoted = false;
  save();
  refresh();
  if (!r.error) showChecks((g.checks ?? []).slice(ck0));
}
/** What an action showed that cannot be taken back (undo locks there). */
export function lockOf(a: E.Game, b: E.Game): string {
  const up = (x: E.Game) => x.units.filter((u) => u.up != null).length,
    cup = (x: E.Game) => x.chits.filter((c) => c.box === 'cup').length;
  if (b.revealed && b.revealed !== a.revealed) return 'a block was revealed';
  if (up(b) > up(a)) return 'blocks revealed';
  if (cup(b) < cup(a)) return 'chits drawn';
  if (b.blown.length > a.blown.length) return 'bridge blown';
  if (a.battle && !b.battle) return 'battle closed';
  if (b.turn !== a.turn || b.phase !== a.phase || b.phasing !== a.phasing) return 'new phase';
  return '';
}
export function undo() {
  if (!allowed()) return say(notYou());
  if (heldNext) return say('Wait for the dice to land');
  const lbl = hist.label,
    r = hist.undo(g);
  if (!r.game) return say(r.why ?? 'Nothing to undo');
  const p = r.game;
  p.log.push(`T${p.turn} ${nm(online.mySide() ?? p.phasing)} undid ${lbl ? '“' + lbl + '”' : 'an action'}`);
  setG(p);
  setSelUnit(setSelChit((selArr = setPreviewArea(setHoverArea(null)))));
  note = '';
  save();
  refresh();
}
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null,
    typing = !!t?.matches?.('input,select,textarea');
  if (e.key === 'Tab') {
    const sheet = document.querySelector<HTMLElement>('#ui .modal > .sheet'); // Tab cycles inside an open menu instead of wandering onto the map behind it
    if (sheet) {
      const f = Array.from(sheet.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, a[href], [tabindex="0"]')).filter(
          (x) => x.offsetParent,
        ),
        a = document.activeElement;
      if (f.length && (e.shiftKey ? a === f[0] || a === sheet : a === f[f.length - 1] || !sheet.contains(a))) {
        e.preventDefault();
        (e.shiftKey ? f[f.length - 1] : f[0]).focus();
      }
    }
  }
  if (e.key === 'Escape') {
    const b = g.battle;
    if (phaseOpen || mapMenu) {
      setPhaseOpen(false);
      setMapMenu(false);
      render();
    } else if (modal || scoreOpen) {
      setModal(null);
      setScoreOpen(false);
      render();
    } else if (SANDBOX && SBU.st.sbOpen && !(e.target as HTMLElement | null)?.closest?.('input,textarea,select')) {
      SBU.closeSb();
      render();
    } else if (b?.stage === 'setup' && !b.locked && mine(b.attacker) && allowed() && !b.assets[b.attacker].length && !b.ready?.length)
      act(() => E.cancelBattle(g)); /* Esc backs out of a battle just opened (nothing placed yet), like its Cancel button */
    else if (selUnit || selArr || selChit || selArea != null) {
      setSelUnit((selArr = setSelChit(null)));
      setSelArea(null);
      setPreviewArea(null);
      refresh();
    }
    return;
  }
  if (t === canvas && !modal) {
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dir[e.key]) {
      e.preventDefault();
      kbStep(...dir[e.key]);
      return;
    }
    if (e.key === 'Enter' && kbArea != null) {
      e.preventDefault();
      kbEnter();
      return;
    }
  }
  if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    void showRules();
    return;
  }
  if ((e.key === 'n' || e.key === 'N') && !typing && !modal && !e.ctrlKey && !e.metaKey) {
    const mv = canMove();
    if (mv.length) {
      setSelUnit(nextOf(mv, selUnit));
      const u = g.units.find((x) => x.id === selUnit)!;
      setSelArea(setKbArea(u.area));
      setPreviewArea(null);
      lookAt(u.area!);
      refresh();
    }
    return;
  }
  if (e.key === 'Enter' && !typing && !t?.matches?.('button,[role=button]') && !modal) {
    const go = document.querySelector<HTMLButtonElement>('#ui .go:not(:disabled)');
    if (go) {
      e.preventDefault();
      go.click();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !(e.target as HTMLElement)?.matches?.('input,select')) {
    e.preventDefault();
    undo();
  }
});
export const tfAreas = () =>
  [...E.areas.keys()].filter((a) => g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a));
/** Place an arriving block; an area outside its listed ones costs a Special Action, and the player picks which one (8.27). In a set-up step the block is deployed. */
/** Set-up: untried garrisons wait face down in one stack (15.3, 22.24); placing one draws a garrison at random, so the Axis player picks the area, never the unit. */
export const POOL = 'untried-pool';
const poolIds = () => (g.phase === 'deploy' ? VOL.pendingPlace(g).filter((id) => g.units.find((u) => u.id === id)?.untried) : []);
export const realArr = (id: string | null) => (id === POOL ? (poolIds()[0] ?? null) : id);
export function arrive(id: string, area: number) {
  if (id === POOL) {
    const ids = poolIds();
    id = ids[Math.floor(Math.random() * ids.length)];
    if (!id) return;
  }
  if (g.phase === 'deploy') return VOL.place(g, id, area);
  if (!g.pendingArrivals.includes(id)) return E.placeTaskForce(g, id, area);
  const u = g.units.find((x) => x.id === id)!,
    o = E.arrivalOptions(g, id).find((x) => x.area === area);
  if (o?.sa) pickSA(u.side, u.ech, (sa) => E.placeArrival(g, id, area, sa));
  else E.placeArrival(g, id, area);
}
/** When more than one Special Action could pay for an action, the player chooses which (a single-use event keeps the reusable block for later, 8.1).
 *  Runs inside an action: with one choice it pays at once, otherwise it opens the chooser and the chosen counter pays in a new action. */
export const ARMY_NAME: Record<string, string> = {
  de_5pz: '5th Panzer Army',
  de_6pz: '6th Panzer Army',
  de_7a: '7th Army',
  de_sr: 'Strategic Reserve',
  us_1a: 'US 1st Army',
  us_3a: 'US 3rd Army',
  us_sr: 'US reserve',
  br_xxx: 'British',
};
