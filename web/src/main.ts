import * as THREE from 'three';
import { translateDom, LANG, LANGS, setLang } from './i18n';
import * as E from '../../engine/src';
import { loadChitArt, garrisonChit } from './chits';
import { loadGolanChitArt } from './golan-art';
import { loadSicilyChitArt } from './sicily-art';
import type { PanelCtx } from './golan-ui';
import * as SB from './sandbox';
import { vpStrip, vpSheet, endPanel } from './score';
import * as SBU from './sandbox-ui';
import {
  online,
  startOnline,
  sit,
  setDevSeat,
  auth,
  lobby,
  publishReveals,
  DEV,
  TABLE,
  HAS_TABLE,
  DEV_FAKE,
  SANDBOX,
  TUTORIAL,
  seatOf,
  seatName,
  type DevSeat,
  type Match,
} from './online';
import { ICONS, ico } from './icons';
import { PIP } from './block-kit';
import { esc, nm } from './util';
import { sheets } from './sheets';
import { pips, ABBR, chitLabel, STAGE_NAME, faces, modIcon, modWord } from './table-text';
import { initChat, chatBtn, chatHtml, bindChat } from './chat';
import { acts, actv, resetActs, reg, regv, ubtn, btn, chip, srow, swtch } from './ui-kit';
import { setZoom } from './troops';
import { optChooser, optOn } from './opt-rules';
import { moveNotice, handedOver, turnOf, noticesOn, noticesBlocked, noticesSupported, setNotices } from './notices';
import { STEP_NAME, homeUrl, tutUrl, share, dropMatch, rulesHtml, bindAuth } from './home';
import { hasLegend, legendCard } from './map-legend';
import { snap, fxRow, FX_SAMPLES } from './fx';
import { RULE, ruleHtml } from './rules-text';
import { initTouch } from './touch';
import { throwDice, clearDice } from './dice3d';
import { initTutorial } from './tutorial';
import { showRules, linkRules, RULES_GAMES } from './rules-link';
import { coursesOf } from './tutorial-script';
import { LAB_SIDE, lab, labClear, labDownload, labStep, recordKey } from './lab';
import { $, areaName, first, LAB, MAP, MH, MW, P1, P2, PARAMS, S, toWorld, TUT, VOL } from './page';
export * from './page';
import {
  addressOpts,
  areaPick,
  g,
  hoverArea,
  newOpts,
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
import { map3d, REL, setMap3d, settle, show3d } from './map3d';
export * from './map3d';
import {
  clearRatio,
  FIG_VOLS,
  fitBattleView,
  markers,
  pieces,
  pumpTextures,
  setClearRatio,
  setTroopSize,
  setTroopsOn,
  troopSize,
  troopsOn,
} from './piece-kit';
export * from './piece-kit';
import { drawPieces } from './pieces';
export * from './pieces';
import {
  camFar,
  CONTROL_COL,
  faceDown,
  hex6,
  labelMode,
  labelsGrp,
  labelTilt,
  MAPC,
  noSup,
  paintAreas,
  paintBoard,
  saveLayers,
  seen,
  setCamFar,
  setLabelMode,
  setLabelTilt,
  setSupEnemy,
  setTint,
  setTutView,
  supEnemy,
  supOk,
  supplySide,
  TDN_COL,
  tint,
  viewRot,
  viewSide,
  ZONE_COL,
} from './map-paint';
export * from './map-paint';
import { dist, opened, pick, pitch, placeCam, ptrs, setDist, setOpened, setPitch, setYaw, target, yaw } from './camera';
export * from './camera';
import {
  act,
  actorNow,
  allowed,
  arrive,
  battleFx,
  chitBar,
  dragTargets,
  dropsLeft,
  endLabel,
  fightable,
  fxLayer,
  hist,
  infoOpen,
  lockOf,
  mine,
  noteFx,
  notYou,
  other,
  PHASE_OF,
  PHASES,
  placing,
  POOL,
  rollFx,
  say,
  selArr,
  setBattleFx,
  setDragTargets,
  setInfoOpen,
  setLabActing,
  setNote,
  setRollFx,
  setSelArr,
  setTgt,
  setTgtMode,
  setToast,
  setToastInfo,
  tgt,
  tgtMode,
  toast,
  toastInfo,
  undo,
} from './flow';
export * from './flow';
import {
  airPick,
  airPickHtml,
  altPickHtml,
  arrOpts,
  auditWarn,
  endHidden,
  feedHtml,
  followFoe,
  gotRemote,
  heldBad,
  heldBadBar,
  pickSA,
  saPickHtml,
  scoreOpen,
  setAirPick,
  setAuditWarn,
  setEndHidden,
  setFollowFoe,
  setGotRemote,
  setHeldBad,
  setScoreOpen,
} from './choices';
export * from './choices';
import {
  center,
  clampDist,
  click,
  confirmMove,
  fuelLeft,
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
  btArmor,
  canAct,
  decisionBubble,
  decisionTargets,
  fwOk,
  pieceScreen,
  placeBadges,
  renderFocus,
  rsOk,
  skipNow,
  skipped,
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
  handSide,
  heldNext,
  hideDice,
  menuTab,
  modal,
  restartAsk,
  rollStage,
  rollView,
  type RollView,
  runAnims,
  setHandSide,
  setHeldNext,
  setMenuTab,
  setModal,
  setRestartAsk,
  setRollView,
  showChecks,
} from './rolls';
export * from './rolls';

/* ---------- cards and drag and drop ---------- */

const chitUri = new Map<string, string>();
const chitImg = (c: E.Chit) => {
  let u = chitUri.get(c.id);
  if (!u) {
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(VOL.chitSvg(c));
    chitUri.set(c.id, u);
  }
  return u;
};
/** Can this chit be played right now (its phase, its targets)? Cards that can glow; worked out once per game change. */
let liveKey = '',
  liveSet = new Set<string>();
function usableNow(c: E.Chit): boolean {
  const k = `${g.turn}${g.phasing}${g.phase}${g.log.length}${g.battle?.stage}${online.devSeat}`;
  if (k !== liveKey) {
    liveKey = k;
    liveSet = new Set();
    const b = g.battle;
    for (const x of g.chits) {
      if (x.box !== 'available' || !mine(x.side)) continue;
      let ok = false;
      if (b) ok = b.stage === 'setup' && VOL.battleCard(x) && !VOL.battleUse(g, b, x);
      else if (g.phase === 'admin') {
        const t = VOL.targetsFor(() => g, x, {
          area: null,
          mode: '',
          setArea: () => {},
          setMode: () => {},
          face: (u) => unitPic(u),
          areaName,
        });
        ok = !!t && (t.units.size + t.areas.size + t.pick.size + t.chips.length + t.modes.length + t.buttons.length > 0 || !!t.any);
      } else if (x.kind === 'sa_block' || x.kind === 'special_action_event') ok = g.phase === 'btMove' || g.phase === 'btCombat';
      else if (x.kind === 'air_mission') ok = VOL.id === 'bulge' && g.phase === 'supply' && E.airSupplyAreas(g, x.side).length > 0;
      if (ok) liveSet.add(x.id);
    }
  }
  return liveSet.has(c.id);
}
const card = (c: E.Chit, r = 0, why: string | null = null) =>
  `<div tabindex="0" role="button" class="card2 ${c.side} ${c.kind === 'sa_block' ? 'wood' : ''} ${why ? 'bad' : usableNow(c) ? 'live' : ''} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" style="--r:${r}deg" title="${esc(why ?? c.name + ' · ' + c.ech)}" aria-label="${esc(c.name)}">${chitPic(c)}${g.battle ? `<span class="ckind">${E.isArty(c) ? 'Arty' : /air/.test(c.kind) ? 'Air' : 'Asset'}</span>` : ''}</div>`; /* phones have no hover title: the kind is written on the card */
/** How much neighbouring cards overlap so the whole hand fits: each card keeps at least 34 px (46 on phones) visible, and the hand scrolls when even that does not fit. */
const overlapFor = (n: number) => {
  const cw = innerWidth >= 900 ? 72 : 62,
    avail = innerWidth - 40,
    visible = n > 1 ? Math.min(cw, Math.max(innerWidth < 900 ? 46 : 34, (avail - cw) / (n - 1))) : cw;
  return n > 1 ? Math.round(cw - visible) : 0;
};
const handStyle = (n: number) => `style="--ov:${overlapFor(n)}px"`;
const fan = (cs: string[]) =>
  cs.map((h, i) => h.replace('--r:0deg', `--r:${((i - (cs.length - 1) / 2) * Math.min(5, 40 / cs.length)).toFixed(1)}deg`)).join('');
/** Place every asset that may legally join, artillery first, for both sides. */
function autoFill(b: E.Battle) {
  const order = (c: E.Chit) => (E.isArty(c) ? 0 : c.kind === 'engineer' ? 2 : 1);
  for (const c of g.chits
    .filter((x) => x.box === 'available' && (E.isArty(x) || E.isBattleAsset(x)) && mine(x.side))
    .sort((x, y) => order(x) - order(y))) {
    if (!E.canAssign(g, b, c.side, c)) E.assign(g, b, c.id);
  }
}
/** Where an event or asset chit can be played on the map (Admin Phase): the areas to light while it is dragged. */
/** Where a dragged chit may be dropped: exactly the areas it can be used in (its zone, its rules), from the same dry runs as a tap. */
function chitTargets(c: E.Chit): number[] {
  if (g.phase !== 'admin' || c.box !== 'available' || !mine(c.side)) return [];
  const t = VOL.targetsFor(() => g, c, { area: null, mode: '', setArea: () => {}, setMode: () => {}, face: (u) => unitPic(u), areaName });
  if (!t) return [];
  const out = new Set<number>([...t.areas.keys(), ...t.pick.keys()]);
  for (const id of t.units.keys()) {
    const a = g.units.find((x) => x.id === id)?.area;
    if (a != null) out.add(a);
  }
  return [...out];
}
/** The chit was dropped on an area: play it there, or open its panel when there is a choice to make. */
let lastPointer = 'mouse';
/** Touch: a card is tapped, never dragged (so the hand can scroll). In a battle it files itself; an event or asset with map targets lights them and waits for a tap on one. */
let handInfo = false,
  handInspect: string | null = null;
function tapCard(id: string) {
  const c = E.chit(g, id),
    b = g.battle;
  if (b) {
    if (b.stage !== 'setup') return;
    if (handInfo) {
      handInspect = handInspect === id ? null : id;
      return render();
    }
    if (!mine(c.side)) return say("Those are the other player's assets.");
    const why = VOL.battleUse(g, b, c);
    if (why) {
      refusal = `${c.name}: ${why}`;
      return render();
    }
    refusal = '';
    if (!E.isArty(c) && !E.isBattleAsset(c) && c.kind !== 'air_mission')
      return act(() => {
        VOL.playInBattle(g, b, c);
      }); // a combat event of the volume
    if (c.kind === 'air_mission') {
      setAirPick({ id, side: c.side, step: 'choose' });
      return render();
    }
    return act(() => E.assign(g, b, id));
  }
  setSelChit(selChit === id ? null : id);
  refresh();
}
function playChitOn(c: E.Chit, area: number) {
  setSelArea(area);
  const panel = () => {
    setSelChit(c.id);
    refresh();
  };
  if (VOL.id !== 'bulge') {
    const t = VOL.targetsFor(() => g, c, {
      area: null,
      mode: tgtMode,
      setArea: () => {},
      setMode: () => {},
      face: (u) => unitPic(u),
      areaName,
    });
    const f = t?.areas.get(area);
    return f ? act(f) : panel();
  } // a drop does what tapping the glowing area does, with the volume's own rules
  switch (c.kind) {
    case 'event_release':
      return act(() => E.releaseUnit(g, c.id, area as 4 | 6));
    case 'air_mission':
      return act(() => E.playInterdiction(g, c.id, area));
    case 'event_greif_bridge': {
      const t = E.neighbors(area).filter(
        (n) => E.connection(area, n)!.river && !g.blown.includes(area < n ? `${area}-${n}` : `${n}-${area}`),
      );
      return t.length === 1 ? act(() => E.playGreifBridge(g, c.id, area, t[0])) : panel();
    }
    case 'event_greif_interdict': {
      const u = E.blocks(g, area, 'allied');
      return u.length === 1 ? act(() => E.playInterdict(g, c.id, u[0].id)) : panel();
    }
    case 'engineer':
      return panel();
    default:
      if (c.name === 'v.d. Heydte') return act(() => E.heydteDrop(g, c.id, area as 31 | 52));
      return panel();
  }
}
function drag(ev: PointerEvent, el: HTMLElement) {
  const id = el.dataset.chit!,
    c = E.chit(g, id),
    x0 = ev.clientX,
    y0 = ev.clientY;
  let ghost: HTMLElement | null = null,
    over: Element | null = null;
  const at = (e: PointerEvent) =>
    document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((n) => ((n as HTMLElement).dataset?.side && (n as HTMLElement).dataset?.zone) || (n as HTMLElement).dataset?.unit);
  const mv = (e: PointerEvent) => {
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) {
      ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost');
      document.body.appendChild(ghost);
      if (!g.battle) {
        setDragTargets(chitTargets(c));
        if (dragTargets.length) {
          paintAreas();
          setBadges(badgeList());
          syncBadges();
        }
      }
      document.querySelectorAll<HTMLElement>('.slot').forEach((sl) => {
        const arty = E.isArty(c) || c.kind === 'air_mission';
        if (sl.dataset.side === c.side && (sl.dataset.zone === 'arty') === arty) sl.classList.add('legal');
      });
    }
    if (!ghost) return;
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    const z = at(e) ?? null;
    if (z !== over) {
      over?.classList.remove('over');
      over = z;
      over?.classList.add('over');
    }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    ghost?.remove();
    over?.classList.remove('over');
    document.querySelectorAll('.slot.legal').forEach((sl) => sl.classList.remove('legal'));
    const b = g.battle;
    if (!b && dragTargets.length) {
      // an event or asset dropped on the map
      const cands = dragTargets;
      setDragTargets([]);
      if (ghost && document.elementFromPoint(e.clientX, e.clientY) === canvas) {
        const area = pick(e).area;
        if (area != null && cands.includes(area)) return playChitOn(c, area);
        say('That chit cannot be played there');
      }
      refresh();
      return;
    }
    if (b?.stage === 'setup' && handInfo && !ghost) {
      handInspect = handInspect === id ? null : id;
      render();
      return;
    }
    if (!b || b.stage !== 'setup') {
      if (!ghost) {
        setSelChit(selChit === id ? null : id);
        refresh();
      }
      return;
    }
    const s = c.side;
    if (ghost && document.elementFromPoint(e.clientX, e.clientY) === canvas) {
      // dropped on the table: the card joins the battle
      const { unit: du, area } = pick(e);
      if (area !== b.area) return say('Drop it on the battle area.');
      if (!mine(s)) return say("Those are the other player's assets.");
      const why = VOL.battleUse(g, b, c);
      if (why) {
        refusal = `${c.name}: ${why}`;
        return render();
      }
      refusal = '';
      return act(() => {
        if (VOL.playInBattle(g, b, c)) return;
        if (c.kind === 'air_mission') {
          const t = du ? g.units.find((x) => x.id === du) : null;
          if (t && t.side === s && t.area === b.area) E.assign(g, b, id, 'support', du!);
          else E.assign(g, b, id, 'arty');
        } else E.assign(g, b, id);
      });
    }
    const z = ghost ? (at(e) as HTMLElement | undefined) : undefined;
    let zone = z?.dataset.zone,
      unit = z?.dataset.unit;
    if (!ghost && c.kind === 'air_mission') {
      if (!mine(s)) return say("Those are the other player's assets.");
      const why0 = VOL.battleUse(g, b, c);
      if (why0) return say(why0);
      setAirPick({ id, side: s, step: 'choose' });
      return render();
    } // a tap asks which use
    if (!ghost) zone = E.isArty(c) ? 'arty' : 'asset'; // a plain click files the card where it belongs
    if (!zone && !unit) return;
    const why =
      VOL.battleUse(g, b, c) ??
      (z?.dataset.side && z.dataset.side !== s ? 'That slot belongs to the other side' : null) ??
      (zone === 'arty' && c.kind === 'engineer'
        ? 'Engineers go in the Assets slot'
        : zone === 'asset' && E.isArty(c)
          ? 'Artillery goes in the Artillery slot'
          : null);
    if (!mine(s)) return say("Those are the other player's assets.");
    if (why) {
      refusal = `${c.name}: ${why}`;
      return render();
    }
    refusal = '';
    act(() => {
      if (VOL.playInBattle(g, b, c)) return;
      if (c.kind === 'air_mission') {
        if (unit) E.assign(g, b, id, 'support', unit);
        else E.assign(g, b, id, 'arty');
      } else E.assign(g, b, id);
    });
  };
  const cancel = () => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    ghost?.remove();
    setDragTargets([]);
    refresh();
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel, { once: true });
}

/* ---------- views ---------- */
export let phaseOpen = false;
export const setPhaseOpen = <T extends typeof phaseOpen>(v: T): T => ((phaseOpen = v), v);
/** The turn, side and step as one pill with a dot per step (owner, 13 Nov); a tap lists the whole sequence of the player turn. */
function phasePill(who: E.Side, pAt: number, label: string) {
  const setup = g.phase === 'deploy',
    dots = setup
      ? ''
      : `<span class="pdots" aria-hidden="true">${PHASES.map((_, k) => `<i class="${k === pAt ? 'on' : k < pAt ? 'done' : ''}"></i>`).join('')}</span>`;
  const list = phaseOpen
    ? `<div class="phlist" role="list"><small>Turn ${g.turn} · ${nm(who)} player turn</small>${setup ? '<div class="on" role="listitem"><i>·</i>Set-up</div>' : PHASES.map((s2, k) => `<div class="${k === pAt ? 'on' : k < pAt ? 'done' : ''}" role="listitem"><i>${k < pAt ? '✓' : k + 1}</i>${s2}</div>`).join('')}</div>`
    : '';
  return `<div class="phwrap"><button class="phpill" aria-expanded="${phaseOpen}" title="Turn ${g.turn}, ${nm(who)} player turn: ${label}${setup ? '' : ` (step ${pAt + 1} of 8)`}" data-ui="${reg(
    () => {
      phaseOpen = !phaseOpen;
    },
  )}"><span class="tt">T${g.turn} · <b class="${who}">${nm(who).toUpperCase()}</b> · <b class="stp">${label.toUpperCase()}</b></span>${dots}<span class="car" aria-hidden="true">▾</span></button>${list}</div>`;
}
/** The top bar; `vp` is the score strip, which sits inside it (one bar instead of two). */
function topBar(vp = '') {
  const tr = (g.track ?? E.VOLUME.track)[g.turn - 1],
    i = first(g.phasing) ? 0 : 1,
    pAt = PHASE_OF[g.phase],
    phaseLabel = g.phase === 'deploy' ? 'Set-up' : PHASES[pAt];
  const who = g.phase === 'deploy' && !placing(g.phasing) && placing(other(g.phasing)) ? other(g.phasing) : g.phasing; // set-up: the side placing its pieces now (Sicily: the Allied landing plan after the Axis garrisons)
  return `<div class="c-bar t"><button class="ico" data-modal="menu" title="Menu, log and new game" aria-label="Menu, log and new game">${ico('menu')}</button>${phasePill(who, pAt, phaseLabel)}
    ${vp}<div class="c-stat">${online.active && online.mode === 'remote' ? `<span class="syncdot ${/NOT SAVED/.test(online.sync) ? 'bad' : /saving|connecting/.test(online.sync) ? 'wait' : 'ok'}" title="${esc(online.sync)}" aria-label="${esc(online.sync)}"></span>` : ''}${online.active && !(!online.both() && online.mySide() === g.phasing) ? `<span>YOU<b class="${online.mySide() ?? ''}">${online.both() ? 'BOTH' : (online.mySide() ?? 'WATCHING').toUpperCase()}</b></span>` : ''}${online.devSwitch() ? `<button class="ico dev" data-seat title="Developer: switch seat (${nm(P1)}, ${nm(P2)}, both, watching)" aria-label="Switch seat">${ico('swap')}<span class="bl">Seat</span></button>` : ''}${(g.phase === 'admin' || g.phase === 'reinforcement') && (tr.ge[i] || tr.al[i]) ? `<span title="Chits each side draws this turn (${nm(P1)} / ${nm(P2)})">CHITS<b>${tr.ge[i]}/${tr.al[i]}</b></span>` : ''}${chatBtn()}<button class="ico ${tint !== 'off' ? 'on' : ''}" data-tint title="View: 2D or 3D, blocks or figures, reset the camera" aria-label="View">${ico('eye')}<span class="bl">View</span></button><button class="ico" data-modal="boxes" title="Pieces: boxes, arrivals" aria-label="Pieces">${ico('boxes')}<span class="bl">Pieces</span></button></div></div>`;
}
const COARSE = matchMedia('(pointer: coarse)').matches;
/** The verb matches the device: tap on touch screens, click with a mouse. */
const verb = (h: string) => (COARSE ? h : h.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click'));
function prompt() {
  if (heldBad)
    return `<span class="turnchip tc-go">Rules check</span> <b>Decide above:</b> restore the last legal position for both players, or accept the other player's change.`;
  const chip =
    online.active && !online.both() && online.mySide() && !g.over
      ? `<span class="turnchip ${allowed() ? 'tc-go' : 'tc-wait'}" title="You play the ${nm(online.mySide()!)}">${allowed() ? 'your move' : 'waiting'}</span> ` /* the sides are named in the top bar; the chip says only whether you act now */
      : '';
  return chip + verb(promptText());
}
/** Explanations: full for learning, short for experienced players (Menu > Settings, or the guide button in the bottom bar). `gx` = explanation only, `gs` = short form only. */
export let guide: 'full' | 'short' = (() => {
  try {
    return localStorage.getItem('fab-guide') === 'full' ? 'full' : 'short';
  } catch {
    return 'short';
  }
})();
const setGuide = (v: 'full' | 'short') => {
  guide = v;
  try {
    localStorage.setItem('fab-guide', v);
  } catch {
    /* private mode */
  }
  document.body.classList.toggle('guide-short', v === 'short');
};
document.body.classList.toggle('guide-short', guide === 'short');
export const gx = (long: string, short = '') => `${short ? `<span class="gs">${short}</span>` : ''}<span class="gx">${long}</span>`;
/** Before a roll: who fires, how many dice, what they need, at whom. */
function stakes(b: E.Battle) {
  const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker),
    fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground');
  if (!fl.length) return 'Nothing can fire.';
  const dice = fl.reduce((a, f) => a + f.dice, 0),
    sns = [...new Set(fl.map((f) => f.sn))].sort((x, y) => x - y);
  return `<b>${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}:</b> ${dice} ${dice === 1 ? 'die' : 'dice'} · hit on ${sns.length === 1 ? `${sns[0]} or less` : `${sns[0]}–${sns.at(-1)} or less`}${gx(` · at ${E.unitsIn(g, b.area, other(sd)).length} ${nm(other(sd))} block${E.unitsIn(g, b.area, other(sd)).length === 1 ? '' : 's'}`)}`;
}
function promptText() {
  const b = g.battle;
  if (rollView?.pos) return gx('<b>Read the dice:</b> green hits, salmon misses. Then continue.', '<b>Read the dice,</b> then continue.');
  if (areaPick) return `<b>${esc(areaPick.label)}</b>, or tap elsewhere to cancel.`;
  if (reinforcing && b) return '<b>Tap a glowing neighbouring block</b> to bring it in, or tap the map to cancel.';
  if (airPick?.step === 'unit' && b) return '<b>Air Mission +2:</b> tap one of your blocks in the battle.';
  if (online.active && !allowed() && !g.over)
    return online.mySide() == null
      ? '<b>Watching.</b> Take a seat in the menu.'
      : `<b>Waiting for the ${nm(actorNow() as E.Side)} player…</b>`;
  if (g.over)
    return `<b>${esc(g.over)}</b> <button data-ui="${reg(() => {
      setEndHidden(false);
    })}">Result</button>`;
  if (g.pendingBlow) return `<b>${nm(other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side))}</b>: attempt to blow the bridge?`;
  if (b?.stage === 'retreat') return '<b>Choose the retreat area.</b>';
  if (b && b.stage === 'setup' && b.attPointDone) return '<b>Point units designated.</b> Blocks are revealed…';
  if (b)
    return b.stage === 'setup'
      ? setupPrompt(b)
      : b.stage === 'done'
        ? (() => {
            const left = fightable().filter((x) => x !== b.area).length;
            const res = (b.result ?? '').trim();
            return `<b>Battle over.</b> ${res ? esc(/[.!]$/.test(res) ? res : res + '.') : ''} Close it${left ? `: ${left} battle${left > 1 ? 's' : ''} left` : ''}.`;
          })()
        : rollView
          ? '<b>Rolling the dice…</b>'
          : b.stage.endsWith('Choice')
            ? 'Choose how to take the hits.'
            : STAGE_NAME[b.stage]
              ? stakes(b)
              : '';
  const m = E.mustFight(g).length;
  switch (g.phase) {
    case 'deploy': {
      const n = VOL.pendingPlace(g).filter((id) => {
        const u = g.units.find((x) => x.id === id)!;
        return mine(u.side) && u.side === g.phasing;
      }).length;
      return n
        ? `<b>Set-up:</b> drag a block from the tray to a lit area, or use the panel.` /* the count is on the main button */
        : '<b>Set-up:</b> finish the steps in the panel on the map, then end the set-up.';
    }
    case 'reinforcement':
      return '<b>Pick a new block</b>, then a lit entry area.';
    case 'admin':
      return selChit && tgt?.hint
        ? `<b>${esc(tgt.hint)}</b>${tgt.areas.size + tgt.units.size > 0 ? ` · ${tgt.areas.size + tgt.units.size} lit` : ''}`
        : `<b>Tap a card</b>${gx(' to play it, or end the step.')}`;
    case 'movement':
      if (selUnit && g.moving?.id === selUnit)
        return `<b>${E.allowance(g, g.units.find((x) => x.id === selUnit)!) - (g.units.find((x) => x.id === selUnit)!.spent ?? 0)} MP left.</b>${gx(" Tap a green area to go on, or <b>Stop here</b>. Choosing another block ends this one's move.", ' Go on, or Stop here.')}`;
      return selUnit
        ? `Tap a <b>green</b> area${gx(' to move there. <b>Brass</b>: must stop there. Wrong move? <b>Undo</b>.', ' · <b>brass</b> = stop')}`
        : `<b>Tap one of your blocks</b>${gx(' to move it, or <b>Can move</b> to go through them.', ' to move it.')}`;
    case 'strategic':
      return '<b>Tap a reserve block</b>, then a green area.';
    case 'combat':
    case 'btCombat':
      if (g.phase === 'btCombat' && !m && E.contestedAreas(g).some((a) => !g.fought.includes(a) && !E.newlyContested(g).includes(a)))
        return gx(
          '<b>Breakthrough combat.</b> Newly contested areas are free; areas already contested before movement need a Special Action (brass tags).',
          '<b>Breakthrough combat:</b> brass = needs SA',
        );
      if (dropsLeft())
        return `<b>Drop your airborne unit${dropsLeft() > 1 ? 's' : ''} first:</b> choose the drop zone in the panel on the map (14.27a).`;
      return m
        ? '<b>Tap a red area.</b>'
        : fightable().length
          ? '<b>Tap a contested area</b> to fight, or end the step.'
          : 'No battles left.';
    case 'reaction':
      return `<b>${nm(other(g.phasing))} reserves</b> may react: select a reserve block.`;
    case 'btMove':
      return btArmor().length
        ? gx(
            '<b>Breakthrough movement.</b> Reserve and exploiting blocks may move; armor that has not moved can move one area for a Special Action (brass tags).',
            '<b>Breakthrough:</b> brass tags = SA move',
          )
        : `<b>Reserve and exploitation blocks</b> may move.${gx(' Select one.')}`;
    default:
      return g.phase === 'supply' && g.supplyPending
        ? `<b>Supply check</b>${gx(': roll for the units that are cut off.')}`
        : 'Supply checked. End the phase.';
  }
}
/** 6.21-6.23: the battle set-up goes step by step: the Defender's Special Action decision, the Attacker's assets, then the Defender's. */
function setupPrompt(b: E.Battle): string {
  const who = E.setupSide(g, b),
    att = who === b.attacker,
    last = att && b.ready?.length === 2;
  if (online.active && !online.both() && who !== online.mySide())
    return `<b>${nm(who)}</b> ${b.defSA ? 'decides on a Special Action…' : last ? 'designates the point unit…' : 'assigns assets…'}`;
  if (b.defSA)
    return `<b>${nm(who)}: Special Action?</b>${gx(' Reinforce or retreat before the attacker commits his assets (6.21), or go on without.')}`;
  if (last)
    return `<b>${nm(who)}: tap a block to make it your point unit</b>, then Begin combat.${gx(' The defender has designated his (6.24).')}`;
  return att
    ? `<b>${nm(who)} attacks: tap a card to add it.</b>${gx(' The defender answers after you (6.22); you pick your point unit last.')}`
    : `<b>${nm(who)} defends: tap a card to add it</b>${gx(", and a block to make it the point unit. The attacker's assets are on the table (6.23).", ' and pick your point unit.')}`;
}
export function primary(): { label: string; fn: () => void; dis?: boolean } | null {
  const b = g.battle;
  if (rollView?.pos && !rollView.remote) return { label: 'Continue', fn: () => endRoll() }; // the dice have landed: one clear step on, the report stays readable until then
  if (g.over || g.pendingBlow || rollView) return null;
  if (g.phase === 'supply' && g.supplyPending && !b && mine(g.phasing)) {
    const n = E.supplyChecks(g).length;
    return { label: n ? `Roll ${n} supply check${n > 1 ? 's' : ''}` : 'Continue', fn: () => act(() => E.rollSupply(g)) };
  } // the one red button is the next thing to do
  if (b) {
    if (b.stage === 'setup') {
      const who = E.setupSide(g, b),
        local = !online.active || online.both(),
        why = VOL.blocksBegin(g);
      if (
        (!local && who !== online.mySide()) ||
        b.attPointDone ||
        (b.ready?.includes(who) && !(who === b.attacker && b.ready.length === 2))
      )
        return null; // the other side's step
      const go = (f: (x: E.Battle) => void) => () =>
        act(() => {
          if (g.battle) f(g.battle);
        }); // the live battle: a remote write may have replaced the one this button was drawn for
      if (b.defSA) return { label: 'No Special Action', fn: go((x) => E.passSA(g, x)) };
      const first = who === b.attacker && !b.ready?.includes(b.attacker);
      return {
        label: first ? 'Assets done' : who === b.attacker ? 'Begin combat' : 'Done',
        fn: why ? () => say(why) : go((x) => E.setReady(g, x, who)),
        dis: !!why,
      };
    }
    if (b.stage === 'done')
      return {
        label: 'Close battle',
        fn: () => {
          act(() => {
            lastFight = b.area;
            E.closeBattle(g);
            setSelArea(null);
            setSelUnit(null);
          });
          /* the battle's block card goes with it */ const m = E.mustFight(g);
          if (m.length && mine(g.phasing)) {
            const at = center(b.area);
            showAreas([[...m].sort((x, y) => center(x).distanceTo(at) - center(y).distanceTo(at))[0]]);
          }
        },
      };
    if (b.stage.endsWith('Choice') || b.stage === 'retreat' || b.stage === 'attFirst' || b.stage === 'loss') return null;
    return {
      label: innerWidth < 700 && !TUTORIAL ? 'Roll the dice' : `Roll ${STAGE_NAME[b.stage].toLowerCase()}`,
      fn: () => rollStage(g.battle!),
    }; // phones: the header already names the fire; the button stays one line
  }
  const must = E.mustFight(g);
  if (g.phase === 'combat' || g.phase === 'btCombat') {
    // the player picks the battle and starts it; nothing opens by itself
    const sel = selArea != null && fightable().includes(selArea) ? selArea : null;
    const fight = (a: number) => () => {
      setSelArea(a);
      setSelUnit(null);
      setBattleFx([]);
      setRollFx([]);
      if (g.phase === 'btCombat' && !E.newlyContested(g).includes(a) && !(VOL.id === 'golan73' && E.golan.freeRoundLeft(g)))
        pickSA(g.phasing, undefined, (sa) => E.startBattle(g, a, true, sa));
      else E.startBattle(g, a, g.phase === 'btCombat');
    };
    if (sel != null) return { label: `Fight ${areaName(sel)}`, fn: fight(sel) };
    if (must.length && allowed() && mine(g.phasing)) {
      const at = lastFight != null ? center(lastFight) : null,
        next = at ? [...must].sort((x, y) => center(x).distanceTo(at) - center(y).distanceTo(at))[0] : must[0];
      return { label: `Next battle: ${areaName(next)}`, fn: fight(next) };
    } // after a battle the button names the nearest one still to fight
  }
  if (g.phase === 'admin' && VOL.id === 'sicily' && !g.battle && mine(g.phasing)) {
    const fl = E.sicily.flankBattles(g);
    if (fl.length)
      return {
        label: `Fight ${areaName(fl[0])}`,
        fn: () => {
          setSelArea(fl[0]);
          setSelUnit(null);
          setBattleFx([]);
          setRollFx([]);
          E.startBattle(g, fl[0]);
        },
      };
  } // 17.22: the landing round, before the Admin Phase ends
  if (online.active && !online.both() && (g.phase === 'admin' || g.phase === 'reinforcement')) {
    // both sides work in these steps: the other side says it is done, the Phasing Player ends the step
    const me = online.mySide();
    if (!me) return null;
    if (me !== g.phasing) {
      const on = !!g.done?.includes(me);
      return { label: on ? 'Done · tap to undo' : 'Done', fn: () => act(() => E.setDone(g, me, !on)) };
    }
    const wait = !g.done?.includes(other(me));
    if (wait && SANDBOX && SBU.st.sbHot) return { label: `Pass to ${nm(other(me))}`, fn: () => SBU.hotPass(other(me)) };
    return {
      label: wait ? `Waiting for ${nm(other(me))}` : endLabel(),
      fn: () =>
        act(() => {
          E.endPhase(g);
          setSelUnit(null);
          setPreviewArea(null);
          setSelChit(null);
          setSelArea(null);
        }),
      dis: wait || !!g.recover.length || !!g.artyPick,
    };
  }
  return {
    label: endLabel(),
    fn: () =>
      act(() => {
        E.endPhase(g);
        setSelUnit(null);
        setPreviewArea(null);
        setSelChit(null);
        setSelArea(null);
      }),
    dis:
      !!dropsLeft() ||
      !!E.mustFight(g).length ||
      !!g.recover.length ||
      !!g.artyPick ||
      (g.phase === 'supply' && !!g.supplyPending) ||
      (g.phase === 'deploy' && VOL.pendingPlace(g).some((id) => mine(g.units.find((u) => u.id === id)!.side))),
  };
}
/* ---------- the actions dock: shortcuts with counts, labelled undo ---------- */
export const lookAt = (a: number) => {
  const p = center(a);
  setGoal({ t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, 30), pitch });
};
let canMoveKey = '',
  canMoveIds: string[] = [];
/** My blocks that can still move in this step (cached until the game changes). */
export function canMove(): string[] {
  const k = `${g.turn}${g.phase}${g.phasing}${g.log.length}${hist.length}${online.devSeat}${skipNow().size}`;
  if (k === canMoveKey) return canMoveIds;
  canMoveKey = k;
  canMoveIds = ['movement', 'reaction', 'btMove'].includes(g.phase)
    ? g.units
        .filter((u) => u.area != null && !u.moved && !u.garrison && mine(u.side) && !skipNow().has(u.id) && E.moveOptions(g, u.id).length)
        .map((u) => u.id)
    : [];
  return canMoveIds;
}
/** The next item after the current one, round and round. */
export const nextOf = <T>(list: T[], cur: T | null) => list[(list.indexOf(cur as T) + 1) % list.length];
/** Ending a step while blocks can still move takes a second press: the button first says how many are left (a stray tap or Enter never ends a phase). */
let endArmed = false,
  endArmT = 0;
let goLabel = '',
  goSince = 0;
function guardEnd(p: { label: string; fn: () => void }) {
  if (p.label !== goLabel) {
    goLabel = p.label;
    goSince = performance.now();
  }
  if (performance.now() - goSince < 600) {
    const f = guardEnd0(p);
    return () => {
      if (performance.now() - goSince >= 600) f();
    };
  } // a click meant for "Continue" never lands on the "Close battle" that just took its place
  return guardEnd0(p);
}
function guardEnd0(p: { label: string; fn: () => void }) {
  if (!p.label.startsWith('End') || !canMove().length || endArmed)
    return () => {
      endArmed = false;
      clearTimeout(endArmT);
      p.fn();
    };
  return () => {
    endArmed = true;
    render();
    clearTimeout(endArmT);
    endArmT = window.setTimeout(() => {
      endArmed = false;
      render();
    }, 4000);
  };
}
/* ---------- the map from the keyboard: Tab onto the map, arrows between neighbouring areas, Enter selects or moves, N the next block that can move ---------- */
export let kbArea: number | null = null;
export const setKbArea = <T extends typeof kbArea>(v: T): T => ((kbArea = v), v);
const NEXT = new Map<number, number[]>();
for (const c of MAP.connections) {
  NEXT.set(c.a, [...(NEXT.get(c.a) ?? []), c.b]);
  NEXT.set(c.b, [...(NEXT.get(c.b) ?? []), c.a]);
}
function screenOf(a: number) {
  const p = center(a),
    r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3(p.x, show3d() ? REL!.h(p.x, p.z) : 0, p.z).project(cam);
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
}
export function kbStep(dx: number, dy: number) {
  const from = kbArea ?? previewArea ?? selArea ?? (selUnit ? (g.units.find((u) => u.id === selUnit)?.area ?? null) : null);
  if (from == null) {
    const r = canvas.getBoundingClientRect();
    let best = 1e9;
    for (const a of MAP.areas) {
      const s = screenOf(a.id),
        d = Math.hypot(s.x - r.left - r.width / 2, s.y - r.top - r.height / 2);
      if (d < best) {
        best = d;
        kbArea = a.id;
      }
    }
  } else {
    const o = screenOf(from);
    let best = 0.35,
      pick2: number | null = null;
    for (const n of NEXT.get(from) ?? []) {
      const s = screenOf(n),
        vx = s.x - o.x,
        vy = s.y - o.y,
        l = Math.hypot(vx, vy) || 1,
        dot = (vx * dx + vy * dy) / l;
      if (dot > best) {
        best = dot;
        pick2 = n;
      }
    }
    if (pick2 == null) return;
    kbArea = pick2;
  }
  setHoverArea(selUnit && optsFor(selUnit).some((o) => o.area === kbArea) ? kbArea : null);
  const s = screenOf(kbArea!),
    r = canvas.getBoundingClientRect();
  if (s.x < r.left + 60 || s.x > r.right - 60 || s.y < r.top + 60 || s.y > r.bottom - 60) lookAt(kbArea!);
  say(`${areaName(kbArea!)} [${kbArea}]`, true);
  refresh();
}
export function kbEnter() {
  if (kbArea == null) return;
  const a = MAP.areas.find((x) => x.id === kbArea)!,
    w = toWorld(LAB[a.id]?.px ?? a.label[0], LAB[a.id]?.py ?? a.label[1]),
    r = canvas.getBoundingClientRect(),
    v = new THREE.Vector3(w.x, show3d() ? REL!.h(w.x, w.z) : 0, w.z + 0.6).project(cam);
  click({ clientX: r.left + (v.x * 0.5 + 0.5) * r.width, clientY: r.top + (-v.y * 0.5 + 0.5) * r.height } as PointerEvent);
}
function dockChips(): string {
  if (g.over || !allowed()) return '';
  const out: string[] = [],
    c = (label: string, n: number | null, hot: boolean, fn: (() => void) | null, title = '') =>
      out.push(
        `<button class="dchip ${hot ? 'hot' : ''}" ${fn ? `data-ui="${reg(fn)}"` : 'disabled'} title="${esc(title || label)}">${esc(label)}${n != null ? `<b>${n}</b>` : ''}</button>`,
      );
  if (g.battle) return '';
  if (g.phase === 'admin' || g.phase === 'reinforcement') {
    const own = online.active && !online.both() ? online.mySide() : null,
      hs = handSide ?? own ?? g.phasing,
      live = g.chits.filter((x) => x.box === 'available' && x.side === hs && mine(x.side) && usableNow(x)); // the side whose hand is shown, so the count matches the hand
    if (live.length)
      c(
        'Playable chits',
        live.length,
        true,
        () => {
          setSelChit(
            nextOf(
              live.map((x) => x.id),
              selChit,
            ),
          );
        },
        'Tap to pick the next chit that can be played now',
      );
    if (g.recover.length) c('Recover an asset', null, true, null, 'Choose the asset to bring back (shown above)');
    if (g.artyPick) c('Artillery attrition', 1, true, null, 'Choose the used artillery asset to eliminate (16.12)');
    if (online.active && !online.both()) {
      const o = other(online.mySide() ?? g.phasing);
      c(`${nm(o)}: ${g.done?.includes(o) ? 'done ✓' : 'working…'}`, null, false, null);
    }
  }
  {
    const bt = btArmor();
    if (bt.length)
      c(
        'Breakthrough (SA)',
        bt.length,
        true,
        () => {
          setSelUnit(nextOf(bt, selUnit));
          const u = g.units.find((x) => x.id === selUnit)!;
          setSelArea(u.area);
          setPreviewArea(null);
          lookAt(u.area!);
        },
        '8.21: armor that has not moved may move one area for a Special Action',
      );
  }
  const mv = canMove();
  if (mv.length)
    c(
      'Can move',
      mv.length,
      true,
      () => {
        setSelUnit(nextOf(mv, selUnit));
        const u = g.units.find((x) => x.id === selUnit)!;
        setSelArea(u.area);
        setPreviewArea(null);
        lookAt(u.area!);
      },
      'Tap to select the next block that can still move',
    );
  {
    const mineU = g.units.filter((u) => u.area != null && mine(u.side) && seen(u)),
      fw = mineU.filter(fwOk).map((u) => u.id),
      rs = mineU.filter(rsOk).map((u) => u.id);
    const pick = (ids: string[]) => () => {
      setSelUnit(nextOf(ids, selUnit));
      const u = g.units.find((x) => x.id === selUnit)!;
      setSelArea(u.area);
      setPreviewArea(null);
      lookAt(u.area!);
    };
    if (fw.length) c('Fortify', fw.length, false, pick(fw), 'Blocks that can build field works (gold dot): tap to go through them');
    if (rs.length) c('Reserve', rs.length, false, pick(rs), 'Blocks that can take a reserve marker (blue dot): tap to go through them');
  }
  if (g.phase === 'combat' || g.phase === 'btCombat') {
    const must = E.mustFight(g),
      all = fightable();
    if (must.length)
      c('Must fight', must.length, true, () => {
        setSelArea(nextOf(must, selArea));
        lookAt(selArea!);
      });
    else if (all.length)
      c('Battles', all.length, false, () => {
        setSelArea(nextOf(all, selArea));
        lookAt(selArea!);
      });
  }
  if (g.phase === 'btMove' || g.phase === 'btCombat') {
    const n = E.saAvailable(g, g.phasing).length;
    if (n && mine(g.phasing)) c('Special Actions', n, false, null, 'Special Actions you can spend now');
  }
  if (
    VOL.id === 'bulge' &&
    g.phase === 'supply' &&
    g.supplyPending &&
    mine('allied') &&
    E.boxOf(g, 'allied', 'available').some((x) => x.kind === 'air_mission') &&
    E.airSupplyAreas(g, 'allied').length
  )
    c(
      'Air supply available',
      null,
      true,
      null,
      '17.21: each Air Mission can supply one cut-off area, in either Supply Phase (in the Supply check panel)',
    );
  return out.length ? `<div class="dchips">${out.join('')}</div>` : '';
}
function undoBtn(): string {
  if (!allowed() || g.over) return '';
  const can = hist.length > 0,
    txt = can ? `Undo: ${hist.label || 'last action'}` : '';
  if (!can && hist.lock)
    return `<button class="dundo idle locked" disabled title="${esc(`Undo not possible: ${hist.lock}`)}" aria-label="${esc(`Undo not possible: ${hist.lock}`)}">${ico('undo')}<span></span></button>`; // nothing to undo: a quiet greyed button, the reason in its tooltip, no "Locked" label in the bar
  if (!txt)
    return `<button class="dundo idle" disabled aria-label="Nothing to undo" title="Nothing to undo" tabindex="-1">${ico('undo')}<span></span></button>`; // always in place, so nothing shifts
  return `<button class="dundo" ${can ? `data-undo` : 'disabled'} title="${esc(can ? txt + ' (Ctrl+Z)' : 'Undo is locked once dice are rolled or something hidden is shown')}">${ico(can ? 'undo' : 'lock')}<span>${esc(txt)}</span></button>`;
}
const recoverSel: Record<string, string | null> = {};
let piecesBox: 'available' | 'cup' | 'used' | 'eliminated' = 'available',
  piecesTab: 'boxes' | 'arrivals' = 'boxes',
  piecesSide: E.Side | null = null,
  inspectId: string | null = null;
/** A short reading of what a chit does, in the series' own vocabulary; the printed rule is the authority. */

/** A chit's picture; the reusable Special Action is a wooden block (8.1), drawn like the arriving blocks. */
/** Every piece is drawn the same way everywhere: blocks (and the reusable Special Action) as 3D wooden blocks, chits, garrisons and Task Forces as cardboard counters. */
export const chitPic = (c: E.Chit) =>
  c.kind === 'sa_block' ? b3(chitImg(c), c.side) : `<img class="cb" alt="" draggable="false" src="${chitImg(c)}">`;
const unitPic = (u: E.Unit) =>
  u.garrison ? `<img class="cb" alt="" draggable="false" src="${unitFace(u)}">` : b3(unitFace(u), sideOfUnit(u));
const pieceBtn = (c: E.Chit, f: () => void, on = false, dis = false) =>
  `<button class="pc ${c.side} ${on ? 'on' : ''} ${c.box === 'available' && usableNow(c) ? 'live' : ''}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(c.name)}" aria-label="${esc(chitLabel(c))}">${chitPic(c)}</button>`;
const ruleCard = (c: E.Chit) => {
  const [t] = RULE[VOL.ruleKey(c.kind, c)] ?? [c.kind, ''];
  return `<span class="big">${chitPic(c)}</span><div><h4>${esc(c.name)} <small>${esc(t)}</small></h4>${ruleHtml(VOL.ruleKey(c.kind, c), E.isEvent(c))}</div>`;
};
const seatedView = () => online.active && !online.both() && !!online.mySide();
function piecesHtml() {
  const sd = piecesSide ?? viewSide(),
    seg = (h: string, cls = '') => `<span class="seg ${cls}">${h}</span>`;
  const tabs = seg(
    chip(
      'Boxes',
      piecesTab === 'boxes',
      () => {
        piecesTab = 'boxes';
        inspectId = null;
      },
      'Pieces in the boxes',
    ) +
      chip(
        'Arrivals',
        piecesTab === 'arrivals',
        () => {
          piecesTab = 'arrivals';
          inspectId = null;
        },
        'Arrivals by turn',
      ),
    'ptabs',
  );
  const sideSw = seg(
    [...VOL.sides]
      .sort((x, y) => +(y === viewSide()) - +(x === viewSide()))
      .map((x) =>
        chip(
          VOL.tag[x],
          sd === x,
          () => {
            piecesSide = x;
            inspectId = null;
          },
          seatedView() ? (x === viewSide() ? 'My pieces' : "Opponent's pieces") : nm(x) + ' pieces',
        ),
      )
      .join(''),
  );
  /** Identical chits (same name) share one tile with a count. */
  const grid = (cs: E.Chit[]) => {
    const groups = new Map<string, E.Chit[]>();
    for (const c of cs) groups.set(c.name, [...(groups.get(c.name) ?? []), c]);
    return `<div class="pcgrid">${[...groups.values()]
      .map((gr) => {
        const c = gr.find((x) => x.id === inspectId) ?? gr[0];
        return `<span class="pcst">${pieceBtn(
          c,
          () => {
            inspectId = inspectId === c.id ? null : c.id;
          },
          inspectId === c.id,
        )}${gr.length > 1 ? `<b class="cnt">×${gr.length}</b>` : ''}</span>`;
      })
      .join('')}</div>`;
  };
  let body = '';
  if (piecesTab === 'boxes') {
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    const dead = g.units.filter(
      (u) => u.side === sd && u.area == null && u.str <= 0 && !u.garrison && (u.arrival == null || u.arrival <= g.turn) && seen(u),
    );
    const boxes = [
      ['available', 'Available'],
      ['cup', 'Cup'],
      ['used', 'Used'],
      ['eliminated', 'Eliminated'],
    ] as const;
    const strip = `<div class="pstrip" role="group" aria-label="Boxes">${boxes
      .map(([bx, label]) => {
        const n = E.boxOf(g, sd, bx).length + (bx === 'eliminated' ? dead.length : 0);
        return `<button class="${piecesBox === bx ? 'on' : ''}" aria-pressed="${piecesBox === bx}" data-ui="${reg(() => {
          piecesBox = bx;
          inspectId = null;
        })}"><b>${n}</b><small>${label}</small></button>`;
      })
      .join('')}</div>`;
    const cs = E.boxOf(g, sd, piecesBox),
      label = boxes.find(([b]) => b === piecesBox)![1];
    const shown =
      piecesBox === 'cup'
        ? `<p class="hint">${cs.length} chits, drawn at random: their faces stay hidden.</p>`
        : `${cs.length ? `<h4>${label} <small>${verb('tap a chit to read it')}</small></h4>${grid(cs)}` : `<p class="hint">No chits here.</p>`}${piecesBox === 'eliminated' && dead.length ? `<h4>Eliminated blocks <small>${dead.length}${dead.some((u) => g.elimLarge.includes(u.id)) ? ` · ${dead.filter((u) => g.elimLarge.includes(u.id)).length} large (+1 VP each to the other side)` : ''}</small></h4><div class="oobrow">${dead.map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic({ ...u, str: u.max })}<small>${esc(u.name)}</small></div>`).join('')}</div>` : ''}`;
    body = `${strip}${pick ? `<div class="inspect" data-reveal="${pick.id}">${ruleCard(pick)}</div>` : ''}${shown}${(() => {
      const held = g.units.filter((u) => u.side === sd && u.area == null && u.str > 0 && u.box && seen(u)),
        boxes = [...new Set(held.map((u) => u.box!))]; // the volume's holding boxes (Golan: reserves, the air assault battalion, evacuated strongpoints)
      return boxes
        .map(
          (bx) =>
            `<h4>${esc(VOL.boxes[bx] ?? bx)} <small>${held.filter((u) => u.box === bx).length}</small></h4><div class="oobrow">${held
              .filter((u) => u.box === bx)
              .map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic(u)}<small>${esc(u.name)}</small></div>`)
              .join('')}</div>`,
        )
        .join('');
    })()}`;
  } else {
    const rows: string[] = [];
    for (let t = 1; t <= g.lastTurn; t++) {
      const us = g.units.filter((u) => u.side === sd && u.arrival === t),
        cs = g.chits.filter((c) => c.side === sd && c.turn === t);
      if (!us.length && !cs.length) continue;
      rows.push(
        `<div class="oob ${t === g.turn ? 'now' : t < g.turn ? 'past' : ''}"><h4>Turn ${t}${t === g.turn ? ' · now' : ''}</h4><div class="oobrow">${us.map((u) => `<div class="oobu" title="${esc(u.name)}">${unitPic(u)}<small>${esc(u.name)}</small><small class="en">${u.entry ? 'Entry ' + u.entry.join('/') : ''}</small></div>`).join('')}${cs
          .map((c) =>
            pieceBtn(
              c,
              () => {
                inspectId = inspectId === c.id ? null : c.id;
              },
              inspectId === c.id,
            ),
          )
          .join('')}</div></div>`,
      );
    }
    const pick = inspectId ? g.chits.find((c) => c.id === inspectId && c.side === sd) : null;
    body = `${g.opts.randomReinf ? '<p class="warnbox"><span><b>Random reinforcements (18.9):</b> units are drawn from those due this turn and next, so the actual turn may differ.</span></p>' : ''}${pick ? `<div class="inspect" data-reveal="${pick.id}">${ruleCard(pick)}</div>` : ''}${rows.join('') || '<p class="hint">No more arrivals.</p>'}`;
  }
  return `<div class="modal"><div class="sheet wide pieces"><h3><span class="grow">${seatedView() ? (sd === viewSide() ? 'My pieces' : "Opponent's pieces") : 'Pieces'}</span>${tabs}${sideSw}<button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>${body}</div></div>`;
}
/** What the volume's own prompts may use: buttons, who is mine, an area pick on the map. */
const panelCtx = (): PanelCtx => ({
  get: () => g,
  btn,
  ubtn,
  mine,
  face: (u) => unitPic(u),
  areaName,
  ico,
  pickArea: (label, areas, run) => {
    setAreaPick({ label, areas: new Set(areas), run });
    setSelUnit(setSelChit(setSelArr(null)));
    refresh();
  },
});
function dispatch() {
  if (g.battle || g.over) return '';
  const row = (k: string, v: string, c = '') => `<div class="r"><span>${k}</span><b class="${c}">${v}</b></div>`;
  const c = selChit ? g.chits.find((x) => x.id === selChit) : null;
  if (c && g.phase === 'admin') return chitBar(c);
  if (g.phase === 'supply' && g.supplyPending && !rollView) {
    // 9.4: who is cut off and what they need, then the roll
    const list = E.supplyChecks(g),
      own = mine(g.phasing),
      air = E.boxOf(g, 'allied', 'available').filter((x) => x.kind === 'air_mission'),
      as = mine('allied') && air.length ? E.airSupplyAreas(g, 'allied') : []; // 17.21: any Supply Phase, one mission per area
    const airRow = as.length
      ? `<div class="airsup"><b>${ico('air_mission')} Air supply (17.21)</b><span class="hint gx">Spend an Air Mission to supply one cut-off area (garrisons too) until the next Supply Phase:</span><div class="row">${as.map((ar) => btn(esc(areaName(ar)), () => E.playAirSupply(g, air[0].id, ar))).join('')}</div></div>`
      : '';
    const rows = list
      .map(
        ({ unit: x, sn, rounds }) =>
          `<button class="supl" data-ui="${reg(() => {
            if (x.area != null) {
              const c2 = center(x.area);
              setGoal({ t: new THREE.Vector3(c2.x, 0, c2.z), dist: Math.min(dist, 30), pitch, fast: true });
            }
          })}" title="Show on the map">${unitPic(x)}<span><b>${esc(x.name)}</b><small>${esc(areaName(x.area!))} · ${E.quality(x)}${x.disorder ? ' · disordered' : ''}${rounds > 1 ? ' · two checks (14.93)' : ''}</small></span><b class="sn">needs ${sn} or less</b></button>`,
      )
      .join('');
    return `<div class="c-dispatch supply"><h3 class="${g.phasing}">Supply check</h3><p class="hint gx">${list.length ? `9.4: each cut-off ${nm(g.phasing)} unit rolls morale. Fail: disordered; already disordered: a step loss (green 8+, veteran 10: surrenders).` : `Every ${nm(g.phasing)} unit is in supply.`}</p>${airRow}
      <div class="row">${own ? `<span class="hint">${list.length ? 'Roll with the red button below.' : 'Nobody is cut off.'}</span>` : `<span class="hint">Waiting for the ${nm(g.phasing)} player to roll.</span>`}</div><div class="suplist">${rows}</div></div>`;
  }
  if (g.phase === 'reinforcement' && g.artyPick) {
    // 16.12: the German player picks the artillery lost to attrition
    const cs = E.boxOf(g, 'german', 'used').filter((c) => c.kind === 'artillery'),
      own = mine('german');
    return `<div class="c-dispatch recover"><h3>German artillery attrition</h3><p class="hint">16.12: ${own ? 'choose' : 'the German player chooses'} one regular artillery asset (not rocket artillery) in the Used Box. It is eliminated; the rest of the Used Box goes back to the cup.</p>
      <div class="pcgrid">${cs.map((c) => pieceBtn(c, () => act(() => E.chooseArtyLoss(g, c.id)), false, !own)).join('')}</div></div>`;
  }
  if (g.phase === 'reinforcement' && g.recover.length)
    return `<div class="c-dispatch recover"><h3>Unused Special Action</h3><p class="hint gx">Each side may bring one asset back from the Used Box (4.1a).</p>${g.recover
      .map((sd) => {
        const cs = E.boxOf(g, sd, 'used').filter((c) => E.isAsset(c)),
          pick = recoverSel[sd] ? cs.find((c) => c.id === recoverSel[sd]) : null,
          own = mine(sd);
        return `<h4 class="${sd}">${nm(sd)}</h4><div class="pcgrid">${
          cs
            .map((c) =>
              pieceBtn(
                c,
                () => {
                  recoverSel[sd] = recoverSel[sd] === c.id ? null : c.id;
                },
                recoverSel[sd] === c.id,
                !own,
              ),
            )
            .join('') || '<small>Nothing in the Used Box</small>'
        }</div>
      <div class="row">${btn(
        pick ? `Bring back ${esc(pick.name)}` : 'Choose an asset',
        () => {
          E.recoverAsset(g, sd, pick!.id);
          recoverSel[sd] = null;
        },
        'primary',
        !pick || !own,
      )}${btn('None', () => E.recoverAsset(g, sd, null), '', !own)}</div>
      ${pick ? `<details class="rdet"><summary><b>${esc(pick.name)}</b> · ${esc((RULE[VOL.ruleKey(pick.kind, pick)] ?? [pick.kind])[0])} <span>What it does</span></summary>${ruleHtml(VOL.ruleKey(pick.kind, pick), E.isEvent(pick))}</details>` : ''}`;
      })
      .join('')}</div>`;
  const u = selUnit ? g.units.find((x) => x.id === selUnit) : null;
  if (u) {
    const to = previewArea ?? hoverArea,
      o = to != null ? optsFor(u.id).find((x) => x.area === to) : null,
      n = fuelLeft(),
      strat = g.phase === 'strategic';
    const tags = [
      u.disorder === 1 ? 'disordered (DIS)' : u.disorder === 2 ? 'recovering (REC)' : '',
      u.rec ? `${u.rec} recovery marker${u.rec > 1 ? 's' : ''} (−${u.rec} to fire)` : '',
      u.unsupplied ? 'out of supply (OOS)' : '',
      u.reserve ? 'reserve' : '',
      u.exploit ? 'exploiting (E)' : '',
      u.interdict ? 'interdicted (GI)' : '',
    ].filter(Boolean);
    let route = '';
    const sp = u.area != null && !u.garrison ? E.supplyPath(g, u.side, u.area) : null,
      supLine =
        u.area == null || u.garrison
          ? ''
          : sp
            ? `<p class="hint sup ok">${ico('fuel')} In supply: ${sp.length > 1 ? `traces through ${sp.length - 1} area${sp.length > 2 ? 's' : ''} to ${esc(areaName(sp.at(-1)!))} (dotted line)` : 'it stands on a supply source'}.</p>`
            : `<p class="hint sup bad">${ico('warn')} Out of supply. ${esc(E.supplyWhy(g, u.side, u.area))}</p>`;
    if (o)
      route = `<div class="route"><p class="tline"><b>→ ${esc(areaName(o.area))}</b> · ${strat ? 'strategic' : `${o.cost} MP`}${VOL.features.fuel && first(u.side) && g.opts.fuel && o.fuel ? ' · <span class="bad">fuel −1</span>' : ''}${o.mustStop ? ' · <span class="bad">stops: battle</span>' : ''}</p><h4>→ ${esc(areaName(o.area))}</h4>${strat ? row('Strategic move', 'any distance') : row('Movement', `${o.cost} MP`)}${noSup.has(o.area) ? row('Supply', '<span class="bad">out of supply there</span>') : ''}${VOL.features.fuel && first(u.side) && g.opts.fuel ? row('Fuel', o.fuel ? `−1 &nbsp;(${n} → ${n - 1})` : 'not needed', o.fuel ? 'bad' : '') : ''}${o.mustStop ? row('Stops here', 'enemy present, battle follows', 'bad') : ''}${btn(
        'Move here',
        () => {
          setPreviewArea(o.area);
          confirmMove();
        },
        'primary',
      )}</div>`;
    else if (optsFor(u.id).length)
      route = `<p class="hint gx">${optsFor(u.id).length} destination(s). Hover or click a highlighted area.</p>`;
    const can = ['movement', 'reaction', 'btMove'].includes(g.phase) && !u.garrison && !u.moved && g.moving?.id !== u.id;
    const mv = g.moving?.id === u.id ? E.allowance(g, u) : 0,
      left = mv ? Math.max(0, mv - (u.spent ?? 0)) : 0;
    const moving = mv
      ? `<div class="mprow" aria-label="${left} of ${mv} movement points left">${Array.from({ length: mv }, (_, i) => `<i class="${i < mv - left ? 'sp' : ''}"></i>`).join('')}<b>${left} of ${mv} MP left</b></div>`
      : '';
    const fw =
      can &&
      u.area != null &&
      !u.unsupplied &&
      !u.disorder &&
      !E.contested(g, u.area) &&
      !g.fieldWorks.includes(u.area) &&
      ((g.phase === 'movement' && u.side === g.phasing) ||
        (g.phase === 'reaction' && u.side !== g.phasing && !!u.reserve) ||
        (g.phase === 'btMove' && u.side === g.phasing && (!!u.reserve || u.exploit)));
    const noFuel =
      VOL.features.fuel &&
      first(u.side) &&
      g.opts.fuel &&
      ['movement', 'strategic', 'btMove', 'reaction'].includes(g.phase) &&
      mine(u.side) &&
      !u.garrison &&
      !E.boxOf(g, P1, 'available').some((x) => x.kind === 'fuel');
    const warns =
      (noFuel
        ? `<div class="warnbox">${ico('fuel')}<span><b>No fuel left</b>${gx('. German blocks may move at most 3 MP this turn and cannot use strategic movement (16.13).', ': 3 MP max, no strategic move.')}</span></div>`
        : '') +
      (u.interdict && mine(u.side) && ['movement', 'reaction', 'btMove', 'admin'].includes(g.phase)
        ? `<div class="warnbox bad">${ico('warn')}<span><b>Greif Interdict</b>${gx(' on this block. Moving it, building field works or taking a reserve marker triggers a morale check (+2). Fail: it may only stay or move one area (17.11).', ': moving triggers a morale check (+2).')}</span></div>`
        : '');
    return `<div class="c-dispatch ${o ? 'previewing' : ''}">${warns}<h3 class="${u.side}">${esc(u.name)}</h3><div class="pipsrow">${pips(u)} <small>${u.garrison ? 'asset' : u.cls} · ${mv ? 'moving · ' : ''}${tags.join(' · ') || 'in order'}${
      hasLegend(VOL.id)
        ? ` <button class="linkbtn" data-ui="${reg(() => {
            legendOpen = true;
            legendShownAt = performance.now();
          })}" title="What the markers on the pieces mean">Markers?</button>`
        : ''
    }</small></div>${((k) => (k && RULE[k] ? `<details class="rdet"><summary><b>${esc(RULE[k][0])}</b> <span>What it does</span></summary>${ruleHtml(k)}</details>` : ''))(mine(u.side) || seen(u) ? VOL.unitRule(u) : null)}${moving}${seen(u) ? supLine : ''}${route}
      <div class="row">${
        mv && mine(u.side)
          ? btn(
              'Stop here',
              () => {
                E.endMove(g);
                setSelUnit(null);
              },
              'primary',
              false,
              "This block's move ends here",
            )
          : ''
      }${
        !mv && mine(u.side) && ['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase) && (skipNow().has(u.id) || canAct(u))
          ? ubtn(
              skipNow().has(u.id) ? 'Skipped · undo' : 'Skip',
              () => {
                if (skipped.has(u.id)) skipped.delete(u.id);
                else {
                  skipped.add(u.id);
                  setSelUnit(null);
                }
                refresh();
              },
              '',
              false,
              'Nothing to do for this unit in this step: no halo, left out of Can move',
            )
          : ''
      }${g.phase === 'movement' && u.side === g.phasing ? (u.reserve ? btn('Remove reserve', () => E.setReserve(g, u.id, false)) : btn('Reserve', () => E.setReserve(g, u.id, true), '', !E.canReserve(g, u))) : ''}${fw ? btn('Fortify', () => VOL.fieldWorks(g, u.id)) : ''}${g.phase === 'btMove' && u.side === g.phasing && u.cls === 'armor' && !u.exploit && !u.reserve && !u.moved ? btn('Activate (SA)', () => pickSA(u.side, u.ech, (sa) => E.activateBreakthrough(g, u.id, sa)), '', !E.saAvailable(g, u.side, u.ech).length) : ''}${E.peiperCan(g, u) ? btn(`${u.peiperFull ? ico('check') : ''}KG Peiper: full move (18.3)`, () => E.setPeiperFull(g, u.id, !u.peiperFull), u.peiperFull ? 'primary' : '', false, "Once per game, up to turn 3: this exploitation move uses Peiper's full movement allowance instead of one area") : ''}</div></div>`;
  }
  return '';
}
const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** Fly the camera over the legal entry areas of the selected arriving block. */
function frameArrival() {
  const all = arrOpts(),
    o = all.some((x) => !x.sa) ? all.filter((x) => !x.sa) : all;
  if (selArr && o.length) {
    const pts = o.map((x) => center(x.area)),
      cx = pts.reduce((a, p) => a + p.x, 0) / pts.length,
      cz = pts.reduce((a, p) => a + p.z, 0) / pts.length,
      r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    setGoal({ t: new THREE.Vector3(cx, 0, cz), dist: Math.min(innerWidth < 700 ? 52 : 70, Math.max(24, r * 2.3 + 10)), pitch: 1.15 });
  }
}
/** Drag an arriving block from the tray onto an entry area of the map. A click without moving still just selects it. */
function dragArrival(ev: PointerEvent, el: HTMLElement) {
  if (ev.button !== 0) return;
  const id = el.dataset.arr!,
    x0 = ev.clientX,
    y0 = ev.clientY;
  let ghost: HTMLElement | null = null;
  const mv = (e: PointerEvent) => {
    if (!ghost && ev.pointerType !== 'mouse' && Math.abs(e.clientX - x0) > 8 && Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0)) {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      return;
    } // a sideways swipe scrolls the tray, it is not a drag
    if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) {
      ghost = el.querySelector('.b3')!.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost');
      document.body.appendChild(ghost);
      if (selArr !== id) {
        setSelArr(id);
        paintAreas();
        setBadges(badgeList());
        syncBadges();
        frameArrival();
      }
    } // no re-render here: replacing the dragged element would cut a touch drag short
    if (ghost) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
    }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (!ghost) return;
    ghost.remove();
    e.preventDefault();
    const clean = () => {
      if (selArr === id) {
        setSelArr(null);
        refresh();
      }
    };
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (top !== canvas && top?.closest('.dock, .c-bar, .c-dispatch, .modal, .legend')) {
      say('Drop it on a highlighted entry area of the map');
      return clean();
    }
    const area = pick(e).area;
    if (area == null || !arrOpts().some((o) => o.area === area)) {
      say('That is not a legal entry area for this block');
      return clean();
    }
    setSelArr(null);
    act(() => arrive(id, area));
  };
  const cancel = () => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    ghost?.remove();
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel, { once: true });
}
/** A block drawn as a real 3D object (front label, right and top faces), for the tray and the battle view. */
const unitFace = (u: E.Unit) => svgUri(VOL.unitSvg(u, g));
const b3 = (face: string, side: E.Side | 'british', chit = false) =>
  `<span class="b3 ${side} ${chit ? 'flat' : ''}" aria-hidden="true"><i class="f"><img alt="" draggable="false" src="${face}"></i><i class="r"></i><i class="t"></i></span>`;
const sideOfUnit = (u: E.Unit) => VOL.cssSide(u);
/** The printed map's legend, redrawn (map-legend.ts): a chip at the map's top-left corner opens it. */
let legendOpen = false,
  legendShownAt = 0;
function mapLegend() {
  if (!hasLegend(VOL.id)) return '';
  const close = `<button class="ico" aria-label="Close the legend" data-ui="${reg(() => {
    legendOpen = false;
  })}">${ico('close')}</button>`;
  if (g.battle) return ''; // the battle bar takes the top of the map
  return legendOpen
    ? legendCard(VOL.id, close, pieceKey())
    : `<button class="mlchip" aria-expanded="false" aria-label="Map legend" data-ui="${reg(() => {
        legendOpen = true;
        legendShownAt = performance.now();
      })}">${ico('info')}<span>Legend</span></button>`;
}
/** The legend's "Markers on the pieces", drawn with the same art and colours the map uses (VOL.markSvg, tag(), PIP), so the key cannot drift from the board. */
function pieceKey(): [string, string][] {
  const img = (code: string, bg: string) => {
    const svg = VOL.markSvg(code);
    return svg
      ? `<img alt="" width="22" height="22" src="${svgUri(svg)}">`
      : `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" fill="${bg}" stroke="#fff" stroke-width="1.4"/><text x="11" y="15" text-anchor="middle" font-size="${code.length > 2 ? 7 : 9}" font-weight="700" fill="#fff" font-family="Arial Narrow, Arial, sans-serif">${code}</text></svg>`;
  };
  const dot = (q: string, x: number) => {
    const [f, s2] = PIP[q];
    return `<circle cx="${x}" cy="11" r="4" fill="${f}" stroke="${s2 === f ? '#141414' : s2}" stroke-width="1.2"/>`;
  };
  const sides = VOL.sides,
    res = [...new Set(sides.map((sd) => VOL.reserveTag({ side: sd, reserve: null } as unknown as E.Unit)))];
  const rows: [string, string][] = [
    [
      `<svg viewBox="0 0 34 22" width="34" height="22" aria-hidden="true">${dot('elite', 6)}${dot('veteran', 17)}${dot('green', 28)}</svg>`,
      'Pips: one per step the unit still has; the colour is the quality of that step: red elite, black veteran, white green',
    ],
    [
      '<svg viewBox="0 0 26 22" width="26" height="22" aria-hidden="true"><circle cx="13" cy="11" r="8" fill="none" stroke="#c8e86a" stroke-width="2.6"/><circle cx="13" cy="11" r="10.4" fill="none" stroke="#c8e86a66" stroke-width="1.6"/></svg>',
      'Lime halo: can still move, build field works or go into reserve this step (Skip in its card sets it aside)',
    ],
    [
      '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="#e7b04a"/><circle cx="11" cy="11" r="4.3" fill="none" stroke="#1a1608" stroke-width="2.2"/><path d="M11 3.5v3M11 15.5v3M3.5 11h3M15.5 11h3" stroke="#1a1608" stroke-width="2.2" stroke-linecap="round"/></svg>',
      'Gold target: the point unit of the battle',
    ],
    [img('DIS', '#8a1f1f'), 'Disordered'],
    [img('REC', '#a8741a'), 'Recovering from disorder'],
    [img('OOS', '#b8312f'), 'Out of supply'],
    [res.map((r) => img(r, '#2d6cb0')).join(''), `Reserve marker${res.length > 1 ? 's' : ''}`],
    [img('E', '#d9741c'), 'Exploitation (may move in Breakthrough)'],
    [img('RA', '#2a7fb8'), 'River assault'],
    ...(VOL.id === 'bulge'
      ? ([
          [img('GI', '#8a2f9c'), 'Greif team interdiction'],
          [img('B', '#8a6a1c'), 'Boundary crossing (left its army zone)'],
        ] as [string, string][])
      : []),
  ];
  return rows;
}
/** The map's own corner: the printed-map legend, the colour layer switch (one tap, no window) and the active layer's key right under it. */
/** A quarter turn of the board, eased (phones have no right-drag to turn it). */
function rotateQuarter() {
  const y0 = yaw;
  setGoal(null);
  anims.push({
    t0: performance.now(),
    dur: 450,
    fn: (k) => {
      setYaw(y0 + (Math.PI / 2) * (1 - (1 - k) * (1 - k)));
      lastInput = performance.now();
    },
  });
}
/** One button for the area tags: on → see-through → off, kept on this device. */
const LABEL_NAME = { on: 'On', tr: 'See-through', off: 'Off' };
function labelsBtn() {
  // inside the Map list: the three settings side by side
  const set = (m: typeof labelMode) => {
    setLabelMode(m);
    try {
      localStorage.setItem('fab-labels', m);
    } catch {
      /* private mode */
    }
    syncAreaTags();
  };
  return `<div class="laysw labsw" role="group" aria-label="Area labels"><b>Labels</b>${(['on', 'tr', 'off'] as const).map((m) => `<button aria-pressed="${labelMode === m}" title="Area labels: ${LABEL_NAME[m]}" data-ui="${reg(() => set(m))}">${ico('tag')}<span class="l">${LABEL_NAME[m]}</span><span class="s">${{ on: 'On', tr: 'Dim', off: 'Off' }[m]}</span></button>`).join('')}</div>`;
}
export let mapMenu = false; // phones: the layers, legend and rotate fold into one Map button
export const setMapMenu = <T extends typeof mapMenu>(v: T): T => ((mapMenu = v), v);
function mapDock() {
  if (g.battle) return ''; // the battle bar takes the top of the map
  if (legendOpen && SANDBOX && SBU.st.sbOpen && innerWidth < 700) {
    if (legendShownAt < SBU.st.sbOpenedAt) legendOpen = false;
    else SBU.closeSb();
  } // phones: the legend and the sandbox sheet never stack; the newer one wins
  if (legendOpen && hasLegend(VOL.id)) return mapLegend();
  type Opt = [typeof tint, string, string, string, string]; // layer, label, short label (phone), icon, what it shows
  const opts: Opt[] = [
    ['off', 'None', 'None', 'close', 'No colour on the map'],
    ['tdn', 'TDN', 'TDN', 'tree', 'Terrain defence'],
    ...(VOL.features.zones ? [['zones', 'Zones', 'Zones', 'layers', 'Army zones'] as Opt] : []),
    ['control', 'Control', 'Ctrl', 'flag', 'Who holds each area'],
    ['supply', 'Supply', 'Supply', 'fuel', 'Supply: which areas trace supply'],
  ];
  const sw = opts
    .map(
      ([v, label, short, icon, title]) =>
        `<button aria-pressed="${tint === v}" title="${title}" aria-label="${title}" data-ui="${reg(() => {
          setTint(v);
          mapMenu = false;
          relayer();
          if (v === 'supply') frameSide(supplySide());
        })}">${ico(icon)}<span class="l">${label}</span><span class="s">${short}</span></button>`,
    )
    .join('');
  const sel = selUnit || selArr || selChit || selArea != null;
  const tools = `<div class="maptools"><button aria-label="Rotate the map a quarter turn" title="Rotate the map" data-ui="${reg(rotateQuarter)}">${ico('rotate')}</button>${
    sel
      ? `<button aria-label="Deselect" title="Deselect" data-ui="${reg(() => {
          setSelUnit(setSelArr(setSelChit(null)));
          setSelArea(null);
          setPreviewArea(null);
          setHoverArea(null);
          refresh();
        })}">${ico('deselect')}<span>Deselect</span></button>`
      : ''
  }</div>`;
  const cur = opts.find(([v]) => v === tint)?.[1] ?? 'None';
  return `<div class="mapdock ${mapMenu ? 'menuopen' : ''}"><div class="dockrow"><button class="mapmenu-btn" aria-expanded="${mapMenu}" aria-label="Map layers, legend and rotate: ${cur}" data-ui="${reg(
    () => {
      mapMenu = !mapMenu;
    },
  )}">${ico('layers')}<span>Map: <b>${cur}</b><i class="msep">·</i>Labels <b>${LABEL_NAME[labelMode]}</b></span><span aria-hidden="true">▾</span></button>${mapLegend()}<div class="laysw" role="group" aria-label="Map colour layer"><b>Layer</b>${sw}</div>${labelsBtn()}</div>${legend()}${tools}</div>`;
}
/** The volume's prompts (set-up, drops, evacuation…). On a phone they fold down to a handle so the map can have the screen; they open again on a tap. */
let volFolded = innerWidth <= 700,
  volFoldKey = '';
function volPanel() {
  const html = VOL.panel(g, panelCtx());
  if (!html) return '';
  const k = `${g.turn}${g.phasing}${g.phase}`;
  if (k !== volFoldKey) {
    volFoldKey = k;
    volFolded = innerWidth <= 700;
  } // phones: each step starts folded, the map first; a tap on the handle opens the prompts
  if (!html.includes('class="volstack"') || innerWidth > 700) return html;
  const n = (html.match(/class="volpanel"/g) ?? []).length,
    title = /<b>(?:<svg[\s\S]*?<\/svg>)?\s*([^<(]+)/.exec(html)?.[1]?.trim() ?? 'Instructions';
  const fold = `<button class="volfold" aria-expanded="${!volFolded}" data-ui="${reg(() => {
    volFolded = !volFolded;
  })}">${ico(volFolded ? 'next' : 'close')}<span>${volFolded ? esc(title) + (n > 1 ? ` +${n - 1}` : '') : 'Hide'}</span></button>`;
  return volFolded ? `<div class="volstack folded">${fold}</div>` : html.replace('<div class="volstack">', `<div class="volstack">${fold}`);
}
function tray() {
  const ids = g.phase === 'deploy' ? VOL.pendingPlace(g) : g.pendingArrivals,
    us = ids
      .map((id) => g.units.find((x) => x.id === id)!)
      .filter((u) => mine(u.side))
      .filter((u, _, all) => g.phase !== 'deploy' || u.side === g.phasing || !all.some((x) => x.side === g.phasing)),
    tf = g.phase === 'deploy' ? [] : g.tfNew.map((id) => E.chit(g, id)).filter((c) => mine(c.side));
  if (!us.length && !tf.length) return '';
  const pool = g.phase === 'deploy' ? us.filter((u) => u.untried) : [],
    open = us.filter((u) => !pool.includes(u));
  const back = svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${hex6(VOL.wood[pool[0]?.nation ?? pool[0]?.side ?? ''] ?? 0x9a8a6a)}"/></svg>`,
  ); // the plain wood of a block lying face down
  const stack = pool.length
    ? `<button class="arr ${selArr === POOL ? 'sel' : ''}" data-arr="${POOL}" title="Coastal garrisons, face down: the one placed is drawn at random">${b3(back, sideOfUnit(pool[0]))}<small>Coastal garrison ×${pool.length}</small></button>`
    : '';
  return `<div class="arrtray" role="group" aria-label="${g.phase === 'deploy' ? 'Blocks to place' : 'Arriving reinforcements'}">${stack}${open.map((u) => `<button class="arr ${u.id === selArr ? 'sel' : ''}" data-arr="${u.id}" title="${esc(u.name)}">${b3(unitFace(u), sideOfUnit(u), !!u.garrison)}<small>${esc(u.name)}</small></button>`).join('')}${tf.map((c) => `<button class="arr ${c.id === selArr ? 'sel' : ''}" data-arr="${c.id}" title="Task Force">${b3(svgUri(garrisonChit('Task Force', `${c.turn}-*`, false)), 'allied', true)}<small>Task Force</small></button>`).join('')}</div>`;
}
/** One slim line above the hand: what the chosen card does and whether it can join, without covering the map. */
function cardTip() {
  const c = handInspect ? g.chits.find((x) => x.id === handInspect) : null,
    b = g.battle;
  if (!c || !b) return '<div class="cardtip"><span>Tap a card to read its rule.</span></div>';
  const [t, d] = RULE[VOL.ruleKey(c.kind, c)] ?? [c.kind, ''],
    why = VOL.battleUse(g, b, c);
  return `<div class="cardtip">${chitPic(c)}<div><b>${esc(c.name)} <small>${esc(t)}</small></b><span>${esc(d.split('\n')[0])}</span>${why ? `<em>Cannot join: ${esc(why)}</em>` : '<em class="ok">Can join this battle</em>'}</div></div>`;
}
let handAll = false;
function handCards() {
  const b = g.battle;
  if (!b && (g.phase === 'reinforcement' || g.phase === 'deploy')) return tray();
  if (b) {
    if (b.stage !== 'setup') return '';
    const cs = ([b.attacker, other(b.attacker)] as E.Side[])
      .filter((sd) => mine(sd) && !b.ready?.includes(sd))
      .sort() /* a side that confirmed its set-up no longer sees its cards */
      .flatMap((s) => E.boxOf(g, s, 'available').filter((c) => VOL.battleCard(c)));
    const ok = cs.filter((c) => !VOL.battleUse(g, b, c));
    const bad = cs.filter((c) => VOL.battleUse(g, b, c)),
      canCancel = mine(b.attacker); /* the attacker may call the battle off until combat begins (unless a Special Action locked it) */
    if (!cs.length && !canCancel) return ''; // the defender with no card: no empty tray
    return `<div class="handtab">${
      canCancel
        ? btn(
            `${ico('close')}<span class="bl">Cancel</span>`,
            () => {
              E.cancelBattle(g);
            },
            'ico danger',
            !!b.locked,
            b.locked ? 'A Special Action was spent, so the battle must be fought' : 'Withdraw the attack and return every assigned asset',
          )
        : ''
    }${
      ok.length && bad.length
        ? `<button data-ui="${reg(() => {
            handAll = !handAll;
          })}" aria-pressed="${handAll}">${handAll ? `Playable only (${ok.length})` : `Show all`}</button>`
        : ''
    }<button class="ico ${handInfo ? 'on' : ''}" data-ui="${reg(() => {
      handInfo = !handInfo;
      if (!handInfo) handInspect = null;
    })}" aria-pressed="${handInfo}" title="Rules: tap a card to read what it does instead of adding it" aria-label="Rules">${ico('book')}<span class="bl">Rules</span></button>${ok.length ? btn(`${ico('wand')}<span class="bl">Auto-fill</span>`, () => autoFill(g.battle!), 'ico', false, 'Auto-fill: place every asset that can legally join, artillery first') : ''}</div>${handInfo ? cardTip() : ''}<div class="c-hand" ${handStyle(handAll || !ok.length ? ok.length + bad.length : ok.length)}>${fan([...ok.map((c) => card(c)), ...(handAll || !ok.length ? bad.map((c) => card(c, 0, VOL.battleUse(g, b, c))) : [])])}</div>`;
  }
  if (g.phase !== 'admin') return '';
  const own = online.active && !online.both() ? online.mySide() : null,
    s = handSide ?? own ?? (g.battle && !mine(g.phasing) ? other(g.phasing) : g.phasing),
    cs = [...E.boxOf(g, s, 'available')].sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
  const live = cs.filter((c) => usableNow(c)),
    rest = cs.filter((c) => !usableNow(c)),
    shown = handAll || !live.length ? [...live, ...rest] : live; // the cards you can play now first; the rest on request
  const more =
    live.length && rest.length
      ? `<button data-ui="${reg(() => {
          handAll = !handAll;
        })}" aria-pressed="${handAll}">${handAll ? `Playable only (${live.length})` : `Show all`}</button>`
      : '';
  return `<div class="handtab"><button data-ui="${reg(() => {
    setHandSide(other(s));
  })}" class="${s}">${nm(s)} hand · ${cs.length} ${ico('swap')}</button>${more}</div><div class="c-hand" ${handStyle(shown.length)}>${fan(shown.map((c) => card(c)))}</div>`;
}
function stats(b: E.Battle, s: E.Side) {
  const ls = (['arty', 'ground'] as const).flatMap((k) => E.fireList(g, b, s, k)),
    pmf = E.hitPmf(ls.map((f) => ({ dice: f.dice, sn: f.sn })));
  return { mean: E.meanHits(pmf), p: (n: number) => Math.round(E.probAtLeast(pmf, n) * 100) };
}
function battleTable() {
  const b = g.battle;
  if (!b) return '';
  const L = E.areas.get(b.area)!,
    att = b.attacker,
    setup = b.stage === 'setup';
  const side = (s: E.Side) => {
    const us = E.unitsIn(g, b.area, s),
      lim = VOL.limits(g, b, s),
      ids = b.assets[s].map((id) => E.chit(g, id)),
      airs = E.airOf(b, s);
    const arty = ids.filter((c) => E.isArty(c)).length + airs.filter((a) => a.mode === 'arty').length,
      rest = ids.length - ids.filter((c) => E.isArty(c)).length;
    return `<div class="bside ${s} ${mine(s) ? 'mine' : 'theirs'}"><h4 title="${nm(s)} ${s === att ? 'attacking' : 'defending'}"><span class="tag">${VOL.tag[s]}</span><small class="role">${s === att ? 'attacks' : 'defends'}</small>${online.active && !online.both() ? `<small>${mine(s) ? 'you' : 'foe'}</small>` : ''}</h4>
      ${arty || setup ? `<span class="chp" title="Artillery assigned">${ico('artillery')}${arty}/${lim.arty}<small>arty</small></span>` : ''}${rest || setup ? `<span class="chp" title="Battle assets and events">${ico('armor_asset')}${rest}<small>assets</small></span>` : ''}
      </div>`;
  };
  const saRow = (() => {
    const s = other(att),
      us = E.unitsIn(g, b.area, s);
    if (!setup || !b.defSA) return '';
    return `<div class="bsarow ${saOpen || reinforcing ? 'open' : ''}"><small class="gx">${nm(s)} Special Action</small>${ubtn(
      `${ico('plus')}<span>Special Action…</span>`,
      () => {
        saOpen = !saOpen;
      },
      `satog ${saOpen ? 'on' : ''}`,
      !mine(s),
      'Retreat before combat or bring in a neighbouring block (uses a Special Action)',
    )}<span class="sabtns">${btn(`${ico('back')}<span class="bsa">Retreat (SA)</span>`, () => pickSA(s, us[0]?.ech, (sa) => E.defenderRetreatSA(g, g.battle!, sa)), 'ico', !mine(s) || !us.some((u) => !u.garrison), 'Retreat before combat (8.24): uses a Special Action; your units leave without disorder, garrisons stay; the attacker gets an exploitation chance')}${ubtn(
      `${ico('plus')}<span class="bsa">Reinforce (SA)</span>`,
      () => {
        setReinforcing(!reinforcing);
        refresh();
      },
      `ico ${reinforcing ? 'on' : ''}`,
      !mine(s),
      'Bring in a neighbouring block (uses a Special Action)',
    )}</span></div>`;
  })();
  const covered = E.unitsIn(g, b.area).some((u) => !seen(u)),
    al = stats(b, P2),
    ge = stats(b, P1),
    tot = al.mean + ge.mean || 1;
  return `<div class="c-table slim ${rollView ? 'rolling' : ''}">${side(P2)}<div class="bmid"><div class="c-title">${g.fought.length + fightable().length > 1 ? `<small class="cnt" title="Battle ${g.fought.includes(b.area) ? g.fought.indexOf(b.area) + 1 : g.fought.length + 1} of ${g.fought.length + fightable().length}">Battle ${g.fought.includes(b.area) ? g.fought.indexOf(b.area) + 1 : Math.min(g.fought.length + 1, g.fought.length + fightable().length)}/${g.fought.length + fightable().length}</small>` : ''}${b.bt ? '<small class="cnt" title="Breakthrough combat">BT</small>' : ''}<b>${esc(L.name)}</b><span class="chp" title="Terrain defence number ${L.tdn}: attackers −${L.tdn} to hit">${ico('tree')}${L.tdn}</span>${g.fieldWorks.includes(b.area) ? `<span class="chp" title="Field works">${ico('gear')}</span>` : ''}${b.riverAssault ? `<span class="chp" title="River assault">${ico('wave')}</span>` : ''}</div>
    <div class="c-vs">${b.stage === 'done' ? '' : covered ? '<div class="big">?<span>:</span>?</div>' : `<small class="vlbl">expected hits</small><div class="big" title="Expected hits per combat round: ${nm(P2)} : ${nm(P1)}"><small class="xs al">${VOL.tag[P2]}</small>${al.mean.toFixed(1)}<span>:</span>${ge.mean.toFixed(1)}<small class="xs ge">${VOL.tag[P1]}</small></div>${gx('<small class="xcap">expected hits per round</small>')}<div class="gauge" title="${esc(`Filled: ${nm(P2)} share of the expected hits · empty: ${nm(P1)}`)}"><i style="width:${(al.mean / tot) * 100}%"></i></div>`}</div></div>${side(P1)}${saRow}${setup ? engChoice(b) : ''}${setup && refusal ? `<div class="refuse">${ico('xbold')}<span><b>Not allowed:</b> ${esc(refusal)}</span></div>` : ''}</div>`;
}
/** 6.33: an attacking engineer in a battle with enemy field works either fires or removes them; two plain buttons, chosen at set-up (or before offensive fire). */
function engChoice(b: E.Battle): string {
  if (
    !b.assets[b.attacker].some((id) => E.chit(g, id).kind === 'engineer') ||
    !g.fieldWorks.includes(b.area) ||
    (g.fwOwner[b.area] ?? other(b.attacker)) === b.attacker ||
    !['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage)
  )
    return '';
  const own = mine(b.attacker),
    pickB = (on: boolean, label: string) =>
      `<button class="${b.engFw === on ? 'on' : ''}" ${own ? `data-do="${reg(() => E.setEngFw(g, g.battle!, on))}"` : 'disabled'} aria-pressed="${b.engFw === on}">${label}</button>`;
  return `<div class="engch"><b>Engineer (6.33)</b>${gx(' · the defenders sit in field works. If the engineer survives artillery and defensive fire, it can remove them just before your units fire (no −1 then), instead of firing itself. Choose before offensive fire:', ' vs FW:')}<div class="row">${pickB(false, gx('Fire with the ground units', 'Fire'))}${pickB(true, gx('Remove the field works', 'Remove FW'))}</div></div>`;
}
let refusal = '',
  saOpen = false; // the last refused battle chit, shown in the set-up panel
/** Every roll of this battle so far, newest first: who rolled, against what, and the faces; it stays with the battle until it ends. */
function rollRecord(b: E.Battle, open = false) {
  if (!b.rolls.length) return '';
  const rows = [...b.rolls]
    .reverse()
    .map(
      (r) =>
        `<div class="rr"><span class="who">${esc(r.who)}</span><span class="sn">SN ${r.sn}</span>${faces(r.dice, r.sn)}<b class="${r.hits ? 'hit' : 'miss'}">${r.hits}${r.kind === 'morale' ? (r.hits ? ' pass' : ' fail') : ` hit${r.hits === 1 ? '' : 's'}`}</b></div>`,
    )
    .join('');
  return `<details class="rrec" ${open ? 'open' : ''}><summary>${ico('dice')} Dice so far <small>${b.rolls.length} roll${b.rolls.length === 1 ? '' : 's'}</small></summary>${rows}</details>`;
}
function ledger() {
  const b = g.battle;
  if ((!b || g.pendingBlow) && !rollView?.check) return '';
  if (rollView) {
    const rv = rollView,
      hits = rv.groups.reduce((a, x) => a + x.hits, 0);
    return `<div class="c-ledger tight" data-ui="${reg(() => {
      if (rollView?.pos) endRoll();
    })}" title="Tap to continue"><div class="lh"><h3>${esc(rv.title)}</h3><b class="tot ${hits ? 'hit' : 'miss'}">${rv.pos ? (rv.morale ? `${hits} of ${rv.groups.length} pass` : `${hits} hit${hits === 1 ? '' : 's'}`) : '…'}</b></div>${rv.remote && !rv.pos ? `<p class="hint">${ico('dice')} The other player is rolling…</p>` : ''}${rv.pos ? rollFx.map(fxRow).join('') : ''}${rv.groups.map((x) => `<div class="ln2"><span class="who">${esc(x.label)}</span><span class="sn">SN ${x.sn}</span>${rv.pos ? faces(x.dice, x.sn) : `<span class="cnt">${x.dice.length}${ico('dice')}</span>`}<b class="${x.hits ? 'hit' : 'miss'}">${x.hits}</b>${x.parts.length ? `<span class="chips2">${modChips(x.parts)}</span>` : ''}</div>`).join('')}
      </div>`;
  }
  if (!b || g.pendingBlow) return '';
  if (b.stage === 'exploit') {
    // 6.8: the attacker rolls a morale check for each armor-class unit, or declines
    const us = (b.exploitIds ?? []).map((id) => g.units.find((x) => x.id === id)!).filter((u) => u.area === b.area),
      mineStep = !online.active || online.both() || online.mySide() === b.attacker;
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${b.attacker}">Exploitation!</h3></div><p class="resline">${esc(b.result ?? '')}</p><p class="hint gx">6.8: each attacking armor-class unit makes a morale check. A pass marks it for exploitation: it may move again in the Breakthrough Phase.</p>
      ${us.map((u) => `<div class="fl"><span class="who">${esc(!faceDown(u) ? u.name : 'Hidden block')}</span><span class="cnt">1${ico('dice')}</span><b class="sn">needs ${E.exploitSn(g, u)} or less</b></div>`).join('')}
      ${mineStep ? `<div class="row">${btn('Decline (stay hidden)', () => E.declineExploit(g, b), '', false, '6.8: you may decline the opportunity and keep the blocks hidden')}</div>` : `<p class="hint">Waiting for the ${nm(b.attacker)} player to roll.</p>`}</div>`;
  }
  if (b.stage === 'done')
    return `<div class="c-ledger tight aar"><div class="lh"><h3>Battle over · ${esc(areaName(b.area))}</h3></div><p class="resline">${esc(b.result ?? '')}</p>${battleFx.length ? `<div class="aarfx">${battleFx.map(fxRow).join('')}</div>` : '<p class="hint">No losses on either side.</p>'}${rollRecord(b, true)}</div>`;
  if (b.stage.endsWith('Choice')) {
    const sd = b.stage === 'attChoice' ? b.attacker : other(b.attacker); // the bubble on the table holds the choice; the report keeps the dice that caused it
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${b.pending} hit${b.pending === 1 ? '' : 's'} to take</h3></div>${rollRecord(b, true)}</div>`;
  }
  if (b.stage === 'retreat' && b.retreat) return ''; // the lit areas on the table are the choice
  if (STAGE_NAME[b.stage]) {
    // fire step: who rolls, what, against which number and why
    const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker),
      fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground'),
      mineStep = !online.active || online.both() || online.mySide() === sd;
    const lines =
      fl
        .map(
          (f) =>
            `<div class="fl"><span class="who">${esc(f.who)}</span><span class="cnt" title="${f.dice} dice to roll">${f.dice}${ico('dice')}</span><b class="sn">SN ${f.sn}</b><span class="chips2">${modChips(f.parts)}</span></div>`,
        )
        .join('') || '<p class="hint">Nothing can fire.</p>';
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}</h3></div>${b.stage === 'offFire' && engChoice(b) ? engChoice(b) : ''}${lines}${mineStep ? '' : `<p class="hint">Waiting for the ${nm(sd)} player to roll…</p>`}${rollRecord(b)}</div>`;
  }
  return '';
}
function legend() {
  if (tint === 'off') return '';
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const items =
    tint === 'supply'
      ? [
          [VOL.controlCol[supplySide()] ?? 0xffffff, 'In supply', 'linked to a source'],
          [MAPC.cut, `Cut off (${cutOffCount(supplySide())})`, 'hatched: no path to a source'],
          [0xe7b04a, 'Supply source', 'labelled on the map'],
        ]
      : tint === 'control'
        ? [
            [CONTROL_COL[P2], nm(P2), 'control'],
            [CONTROL_COL[P1], nm(P1), 'control'],
            [CONTROL_COL.contested, 'Contested', 'both sides present'],
          ]
        : tint === 'tdn'
          ? TDN_COL.map((c, i) => [c, `TDN ${i}`, i ? `attackers −${i} to hit` : 'no modifier'])
          : [
              [ZONE_COL[5], 'Zone 5', '5th Panzer Army'],
              [ZONE_COL[6], 'Zone 6', '6th Panzer Army'],
              [ZONE_COL[7], 'Zone 7', '7th Army'],
            ];
  const whose =
    tint === 'supply'
      ? `<div class="chips">${chip('Yours', !supEnemy, () => {
          setSupEnemy(false);
          relayer();
        })}${chip('Enemy', supEnemy, () => {
          setSupEnemy(true);
          relayer();
        })}</div>`
      : '';
  return `<div class="legend" aria-label="Overlay legend"><b>${tint === 'tdn' ? 'Terrain defence' : tint === 'control' ? 'Area control' : tint === 'supply' ? `Supply · ${nm(supplySide())}` : 'Army zones'}</b>${whose}${items.map(([c, a, b]) => `<span><i style="background:${hex(c as number)}"></i>${a} <small>${b}</small></span>`).join('')}</div>`;
}
/* ---------- home: sign in, your games, a new game, join ---------- */
let matches: Match[] = []; // your games (the lobby): the table's title in the menu
/** The optional rules a game uses, as short tags ('18.1 Bridge repair limits', 'bid +2'). */
function rulesInUse(o: Partial<E.Opts>, extra = true): string {
  const on = optOn(o, VOL.id);
  if (!on.length) return '<span class="hint">Optional rules: none</span>';
  return `<span class="rulesuse">${on.map((r) => `<span title="${esc(r.text)}">${r.rule} ${esc(r.key === 'bid' ? `Bid ${o.bid! > 0 ? '+' : ''}${o.bid}` : r.name)}</span>`).join('')}${extra && o.bridgeLimit && inGame() ? `<span>German bridge repairs left: ${g.bridgesLeft ?? 6}</span>` : ''}</span>`;
}
/** A slim bar over the table when you are not seated, or while you wait for an opponent. */
function seatBar() {
  if (LAB_SIDE)
    return `<div class="seatbar" title="${esc(lab.reason)}"><span>${ico('info')} Computer: ${nm(LAB_SIDE)}${lab.thinking ? ' · thinking…' : ''}${lab.reason ? ` · <small>${esc(lab.reason.split(' (')[0].split(': judged')[0])}</small>` : ''}</span></div>`; // the full reason on hover: a phone keeps the map
  if (online.mode !== 'remote' || !online.hasAccounts) return '';
  if (online.error)
    return `<div class="seatbar err"><span>${esc(online.error)}</span>${ubtn('OK', () => {
      online.error = '';
    })}</div>`;
  const a = online.account,
    me = online.mySide(),
    s = online.seats,
    title = matches.find((m) => m.id === TABLE)?.title ?? 'a game of FAB';
  if (!a || a.guest)
    return `<div class="seatbar"><span>You are watching.</span>${ubtn(
      'Sign in to play',
      () => {
        try {
          sessionStorage.setItem('fab-next', TABLE);
        } catch {
          /* private mode */
        }
        location.href = homeUrl();
      },
      'primary',
    )}</div>`;
  if (!me) {
    const free = VOL.sides.filter((x) => !seatOf(s, x));
    return `<div class="seatbar"><span>${free.length ? 'Take a seat:' : 'Both seats are taken. You are watching.'}</span>${free
      .map((x) =>
        ubtn(
          `Play ${nm(x)}`,
          () => {
            void sit(x);
          },
          'primary',
        ),
      )
      .join('')}</div>`;
  }
  if (!s.german || !s.allied)
    return `<div class="seatbar"><span>Waiting for your opponent.</span>${ubtn(
      `${ico('share')} Invite`,
      () => {
        void share(TABLE, title, say);
      },
      'primary',
    )}</div>`;
  return '';
}
const modChips = (parts: [string, number][]) =>
  parts
    .map(
      ([w, v]) =>
        `<span class="m2 ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" role="button" tabindex="0" data-ui="${reg(() => say(`${v > 0 ? '+' : '−'}${Math.abs(v)}: ${w}`, true))}" title="${esc(w)}" aria-label="${esc(`${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)}, ${w}`)}">${ico(modIcon(w))}${v > 0 ? '+' : v < 0 ? '−' : ''}${v ? Math.abs(v) : ''}${modWord(w) ? ` <small>${modWord(w)}</small>` : ''}</span>`,
    )
    .join('');
/** A toggle chip. With `icon` the icon replaces the tick; with an empty label it is icon-only and `title` names it. */
const relayer = () => {
  saveLayers();
  paintBoard();
  paintAreas();
  setBadges(g.battle ? [] : badgeList());
  syncBadges();
}; // the source labels come and go with the Supply layer
/** The camera takes in all the areas a side holds (the supply colour then always shows something). */
/** Where a full-map game opens: the middle of the blocks on the map (the front), so no game opens on its empty margin. */
function openingTarget() {
  const ps = g.units.filter((u) => u.area != null && MAP.areas.some((a) => a.id === u.area)).map((u) => center(u.area!));
  if (!ps.length) {
    const p = toWorld(MW / 2, MH / 2);
    return new THREE.Vector3(p.x, 0, p.z);
  }
  const xs = ps.map((p) => p.x),
    zs = ps.map((p) => p.z);
  return new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
}
/** The opening view: the whole map, or a scenario's own sheet (its play area) framed from above. */
function homeGoal() {
  const ids = g.inPlay ? MAP.areas.filter((a) => g.inPlay!.includes(a.id)).flatMap((a) => a.polygon.map(([x, y]) => toWorld(x, y))) : []; // every corner of the sheet
  if (!ids.length) return { t: openingTarget(), dist: innerWidth < 700 ? 52 : 36, pitch: 1.0 };
  const x0 = Math.min(...ids.map((p) => p.x)),
    x1 = Math.max(...ids.map((p) => p.x)),
    z0 = Math.min(...ids.map((p) => p.z)),
    z1 = Math.max(...ids.map((p) => p.z));
  return {
    t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2),
    dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * (innerWidth < 700 ? 1.7 : 1.12) + 3),
    pitch: 1.0,
  };
}
function frameSide(sd: E.Side) {
  const ids = MAP.areas.filter((a) => g.control[a.id] === sd && (!g.inPlay || g.inPlay.includes(a.id))).map((a) => center(a.id));
  if (!ids.length) return;
  const x0 = Math.min(...ids.map((p) => p.x)),
    x1 = Math.max(...ids.map((p) => p.x)),
    z0 = Math.min(...ids.map((p) => p.z)),
    z1 = Math.max(...ids.map((p) => p.z));
  setGoal({ t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * 0.95 + 8), pitch });
}
/** True when the area's centre is inside the visible part of the screen (clear of the bars at top and bottom). */
/** The part of the canvas no panel covers, in normalised screen units (-1..1): the sandbox panel on the right, the block card or battle report at the bottom right. */
function freeView() {
  const r = canvas.getBoundingClientRect();
  let x1 = 0.85,
    y0 = -0.6;
  for (const q of ['.sbx', '.c-dispatch', '.c-ledger']) {
    const e = document.querySelector<HTMLElement>(`#ui ${q}`);
    if (!e || !e.offsetParent) continue;
    const b = e.getBoundingClientRect();
    if (b.width > r.width * 0.6) {
      y0 = Math.max(y0, 1 - ((b.top - r.top) / r.height) * 2 + 0.05);
      continue;
    }
    x1 = Math.min(x1, ((b.left - r.left) / r.width) * 2 - 1 - 0.05);
  }
  return { x0: -0.85, x1: Math.max(-0.3, x1), y0: Math.min(0.3, y0), y1: 0.75 };
}
const onScreen = (a: number) => {
  const v = center(a).clone().project(cam),
    f = freeView();
  return v.x > f.x0 && v.x < f.x1 && v.y > f.y0 && v.y < f.y1 && v.z < 1;
};
/** Bring areas into view when any of them is off screen: the camera frames them all, no closer than now. */
export function showAreas(ids: number[]) {
  if (!ids.length || ids.every(onScreen)) return;
  const ps = ids.map(center),
    x0 = Math.min(...ps.map((p) => p.x)),
    x1 = Math.max(...ps.map((p) => p.x)),
    z0 = Math.min(...ps.map((p) => p.z)),
    z1 = Math.max(...ps.map((p) => p.z));
  const f = freeView(),
    d = clampDist(Math.max(dist, Math.max(x1 - x0, (z1 - z0) * 1.3) * 1.1 + 10)),
    t = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const shift = -((f.x0 + f.x1) / 2) * d * 0.45 * (innerWidth / innerHeight) * 0.5; // a panel on the right: aim to the right so the areas land in the free part (approximate, camera faces the map)
  setGoal({ t: t.add(new THREE.Vector3(Math.cos(yaw) * shift, 0, -Math.sin(yaw) * shift)), dist: d, pitch });
}
const cutOffCount = (sd: E.Side) => MAP.areas.filter((a) => g.control[a.id] === sd && !supOk(sd, a.id)).length;
const resetBtn = () =>
  ubtn(`${ico('home')}<span>Reset view</span>`, () => {
    setGoal(homeGoal());
    setYaw(viewRot());
  });
function layersHtml() {
  const map = VOL.art.relief
    ? srow(
        'Map',
        VOL.art.reliefName,
        `<span class="seg">${chip('2D', !map3d, () => setMap3d(false), 'The printed board, flat')}${chip('3D', map3d, () => setMap3d(true), VOL.art.reliefName)}</span>`,
      )
    : '';
  const setTroops = (on: boolean) => {
    setTroopsOn(on);
    try {
      localStorage.setItem('fab-troops', on ? '1' : '0');
    } catch {
      /* private mode */
    }
    refresh();
  };
  const units =
    FIG_VOLS.includes(VOL.id) && !TUTORIAL
      ? srow(
          'Units',
          'on either map',
          `<span class="seg">${chip('Blocks', !troopsOn, () => setTroops(false), 'The wooden blocks')}${chip('Figures', troopsOn, () => setTroops(true), 'Soldiers and tanks, one per unit')}</span>`,
        )
      : '';
  const setSize = (z: number) => {
    setTroopSize(z);
    setZoom(z);
    try {
      localStorage.setItem('fab-troop-size', String(z));
    } catch {
      /* private mode */
    }
    refresh();
  };
  const size =
    FIG_VOLS.includes(VOL.id) && !TUTORIAL && troopsOn
      ? srow(
          'Figure size',
          '',
          `<span class="seg">${(
            [
              [1, 'Small'],
              [1.5, 'Medium'],
              [2, 'Large'],
              [2.5, 'Huge'],
            ] as const
          )
            .map(([z, w]) => chip(w, troopSize === z, () => setSize(z), `Figures ${z}×`))
            .join('')}</span>`,
        )
      : '';
  return `<div class="modal"><div class="sheet menu view"><h3><span class="grow">${ico('eye')} View</span><button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
    <div class="mbody"><h4>Board</h4><div class="sgrid"><div>${map || srow('Camera', '', resetBtn())}${units}${size}</div><div>${map ? srow('Camera', '', resetBtn()) : ''}</div></div></div></div></div>`;
}
/** The game log, newest first, grouped by turn; each line tinted by the side it concerns. */
/** A log line with its side prefix (GE / AL) as a coloured tag: side shown by colour and name. */
export const TAGRE = VOL.sides.map((s) => VOL.tag[s]).join('|'),
  sideByTag = (t: string) => VOL.sides.find((s) => VOL.tag[s] === t || VOL.sideName[s] === t) ?? '';
/** Engine log wording for the eye: side ids as names (german → German), and a real plural for hit(s). */
const tidyLog = (x: string) =>
  x
    .replace(new RegExp(`: (${VOL.sides.join('|')}) `, 'g'), (_, sd: string) => `: ${nm(sd)} `)
    .replace(/(\d+) hit\(s\)/g, (_, n: string) => `${n} hit${n === '1' ? '' : 's'}`);
export const sideTag = (x0: string) => {
  const x = tidyLog(x0);
  const m = new RegExp(`^(${TAGRE})\\b ?`).exec(x);
  return m
    ? `<b class="stag ${sideByTag(m[1])}">${m[1]}</b> <span class="lt">${esc(x.slice(m[0].length))}</span>`
    : `<span class="lt">${esc(x)}</span>`;
};
/** The game log, newest first: a heading per turn, a smaller one per step, each line with its side tag (the step is in the heading, not on the line). */
function logHtml() {
  const groups: { turn: string; steps: { step: string; lines: string[] }[] }[] = [];
  for (const l of g.log) {
    const m = /^T(\d+) /.exec(l),
      t = m ? m[1] : '0',
      rest = m ? l.slice(m[0].length) : l,
      s = new RegExp(`^(${TAGRE}) (\\w+): `).exec(rest),
      step = s && STEP_NAME[s[2]] ? s[2] : '',
      text = step ? `${s![1]} ${rest.slice(s![0].length)}` : rest;
    if (groups.at(-1)?.turn !== t) groups.push({ turn: t, steps: [] });
    const gr = groups.at(-1)!;
    if (gr.steps.at(-1)?.step !== step) gr.steps.push({ step, lines: [] });
    if (!new RegExp(`^(${TAGRE}) (phase start|[a-zA-Z]+ phase)$`).test(text))
      gr.steps.at(-1)!.lines.push(text); /* the heading already says which step began */
  }
  const side = (x: string) => sideByTag(x.split(/\s/)[0]);
  const quiet = g.log.length <= 2 ? '<p class="hint">The log fills in as the turn goes on.</p>' : ''; // turn 1 starts with one line
  return (
    quiet +
    `<div class="log">${
      groups
        .reverse()
        .map(
          (gr) =>
            `<h5>${gr.turn === '0' ? 'Set-up' : `Turn ${gr.turn}`}</h5>${[...gr.steps]
              .reverse()
              .map(
                (st) =>
                  `${st.step ? `<h6>${STEP_NAME[st.step]}</h6>` : ''}${[...st.lines]
                    .reverse()
                    .map((x) => `<div class="ll ${side(x)}">${sideTag(x)}</div>`)
                    .join('')}`,
              )
              .join('')}`,
        )
        .join('') || '<p class="hint">Nothing yet.</p>'
    }</div>`
  );
}
function modalHtml() {
  if (modal === 'layers') return layersHtml();
  if (modal === 'rules')
    return rulesHtml('menu', (t, ok) => {
      setToast(t);
      setToastInfo(ok);
      render();
      setTimeout(() => {
        setToast('');
        render();
      }, 2500);
    });
  if (modal === 'boxes') return piecesHtml();
  if (modal === 'menu') {
    const tabs = ['Settings', 'Log', 'Help', 'Table', ...(online.admin ? ['Admin'] : [])];
    if (!tabs.includes(menuTab)) setMenuTab('Settings');
    if (menuTab !== 'Table') setRestartAsk(false); // the restart question never waits on another tab
    const body =
      menuTab === 'Log'
        ? logHtml()
        : menuTab === 'Help'
          ? `${
              coursesOf(VOL.id).length || RULES_GAMES.includes(VOL.id)
                ? `<h4>Learn</h4><div class="row">${
                    RULES_GAMES.includes(VOL.id)
                      ? ubtn(
                          `${ico('info')} Rules reference`,
                          () => {
                            void showRules();
                          },
                          '',
                          false,
                          'The full rulebooks, searchable (shortcut: ?)',
                        )
                      : ''
                  }${coursesOf(VOL.id)
                    .map((c) =>
                      ubtn(`${ico('info')} ${esc(c.title)}`, () => {
                        location.href = tutUrl(c.id);
                      }),
                    )
                    .join('')}</div>`
                : ''
            }${COARSE ? '' : `<h4>Keyboard</h4><dl class="keys"><dt>Tab</dt><dd>to the map (or “Skip to the map” first)</dd><dt>← ↑ → ↓</dt><dd>move between neighbouring areas</dd><dt>Enter</dt><dd>select or move there; on a button, press it</dd><dt>N</dt><dd>next block that can move</dd><dt>Esc</dt><dd>clear the selection, close a window</dd><dt>Ctrl+Z</dt><dd>undo</dd></dl>`}`
          : menuTab === 'Settings'
            ? `<div class="sgrid"><div><h4>Play</h4>${srow(
                'Full explanations',
                'every option and rule',
                swtch(guide === 'full', () => setGuide(guide === 'full' ? 'short' : 'full'), 'Full explanations'),
              )}${
                noticesSupported()
                  ? srow(
                      'My-move notices',
                      noticesBlocked() ? 'blocked in this browser: allow notices for this site' : 'when the game is out of sight',
                      swtch(
                        noticesOn(),
                        () => {
                          void setNotices(!noticesOn(), auth.token).then((m) => {
                            say(m);
                            render();
                          });
                        },
                        'My-move notices',
                      ),
                    )
                  : ''
              }</div>
        <div><h4>Screen</h4>${srow(
          'Follow the other side',
          'the camera goes to their moves',
          swtch(
            followFoe,
            () => {
              setFollowFoe(!followFoe);
              try {
                localStorage.setItem('fab-follow', followFoe ? '1' : '0');
              } catch {
                /* private mode */
              }
            },
            'Follow the other side',
          ),
        )}${srow('Language', '', `<span class="seg notr">${LANGS.map(([l]) => chip(l.toUpperCase(), LANG === l, () => setLang(l), l === 'it' ? 'Interfaccia in italiano (i regolamenti restano in inglese)' : 'Interface in English')).join('')}</span>`)}${srow('Rules in use', rulesInUse(g.opts), '')}</div></div>`
            : menuTab === 'Admin'
              ? `<div class="row">${ubtn(`${ico('wand')} Sandbox`, () => {
                  location.href = `${homeUrl()}?sandbox=1`;
                })}${ubtn('Update rules', () => {
                  setModal('rules');
                })}${VOL.sides
                  .map((sd) =>
                    ubtn(`Free ${nm(sd)} seat`, () => {
                      void auth.freeSeat(sd);
                    }),
                  )
                  .join(
                    '',
                  )}</div><h4>Computer opponent (experimental, The Bulge)</h4><p class="hint">A local game against the computer, saved in this browser apart from your other games.</p>${(
                  ['german', 'allied'] as const
                )
                  .map((cpu) => {
                    const you = cpu === 'german' ? 'Allies' : 'Germans',
                      go = () => {
                        location.href = `${homeUrl()}?game=bulge&lab=${cpu}`;
                      },
                      saved = (() => {
                        try {
                          return !!localStorage.getItem(`fab-lab-${cpu}`);
                        } catch {
                          return false;
                        }
                      })();
                    return `<div class="row"><span class="grow">You play the ${you}</span>${saved ? ubtn('Continue', go, LAB_SIDE === cpu ? 'primary' : '') : ''}${ubtn(
                      'New game',
                      () => {
                        try {
                          localStorage.removeItem(`fab-lab-${cpu}`);
                          localStorage.removeItem(recordKey(cpu));
                        } catch {
                          /* storage off */
                        }
                        if (LAB_SIDE === cpu) location.reload();
                        else go();
                      },
                      saved ? '' : 'primary',
                    )}</div>`;
                  })
                  .join(
                    '',
                  )}${LAB_SIDE ? `<div class="row">${ubtn(`${ico('share')} Download game record`, () => labDownload(g), '', false, 'A file with this whole game and every move the computer made with its reason: send it to have the game checked')}</div>` : ''}`
              : online.mode === 'remote'
                ? (() => {
                    const a = online.account,
                      signed = !!a && !a.guest,
                      me = online.mySide(),
                      title = matches.find((m) => m.id === TABLE)?.title ?? TABLE,
                      m = matches.find((x) => x.id === TABLE),
                      own = !!m && (m.owner === online.uid || online.admin);
                    const row = (sd: E.Side) => {
                      const seat = seatOf(online.seats, sd),
                        who = seat ? (seat === online.uid ? 'you' : esc(seatName(online.seats, sd) || 'taken')) : 'free';
                      return `<div class="seatrow"><b class="${sd}">${nm(sd)}</b><span>${who}</span>${
                        seat === online.uid
                          ? ubtn('Leave seat', () => {
                              void sit(null);
                            })
                          : !seat && signed && !me
                            ? ubtn(
                                'Take seat',
                                () => {
                                  void sit(sd);
                                },
                                'primary',
                              )
                            : ''
                      }</div>`;
                    };
                    return `<h4>Players</h4>${VOL.sides.map(row).join('')}<p class="inuse">${rulesInUse(g.opts)}</p>${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
          <div class="row">${ubtn(`${ico('share')} Invite a player`, () => {
            void share(TABLE, title, say);
          })}</div>
          <p class="hint">Connection: ${esc(online.sync)}</p>
          <p class="hint">${signed ? `Signed in as <b>${esc(a!.name || a!.email)}</b>` : 'You are watching as a guest.'}</p>
          ${
            own && TABLE !== 'main'
              ? `<div class="row">${ubtn(
                  `${ico('close')} Delete this game`,
                  () => {
                    void dropMatch(m ?? { id: TABLE, title: TABLE, owner: '' });
                  },
                  'danger',
                )}</div>`
              : ''
          }`;
                  })()
                : `<h4>Players</h4><p class="hint">Developer table. The Seat button in the top bar switches between ${nm(P1)}, ${nm(P2)}, both and watching; turn rules are enforced for the seat you hold.</p>`;
    const newGame = `${
      online.active && !online.admin && !online.both()
        ? '<p class="hint">Restarting a shared game is limited to its admin.</p>'
        : `<h4>Restart this game</h4><div class="row"><select data-sel="${regv((x) => {
            newOpts.scenario = x as E.Opts['scenario'];
          })}">${VOL.scenarios
            .filter((sc) => SANDBOX || !sc.testing)
            .map(
              (sc) => `<option value="${sc.id}" ${newOpts.scenario === sc.id ? 'selected' : ''}>${esc(sc.name)} (${esc(sc.sub)})</option>`,
            )
            .join('')}</select>
        </div>${
          VOL.features.fuel
            ? `${srow(
                'German fuel rule',
                '',
                swtch(
                  !!newOpts.fuel,
                  () => {
                    newOpts.fuel = !newOpts.fuel;
                  },
                  'German fuel rule',
                ),
              )}`
            : ''
        }${VOL.features.optional ? optChooser(newOpts, VOL.id) : ''}${
          restartAsk
            ? `<div class="askrow" data-reveal="restart"><p>Restart and lose the current game?</p><div class="row">${ubtn(
                'Restart now',
                () => {
                  setRestartAsk(false);
                  setG(E.newGame(undefined, newOpts));
                  setSelArea(setSelUnit(setSelChit(null)));
                  setModal(null);
                  setInBattle(false);
                  hist.clear();
                  setNote('');
                  setSelArr(null);
                  save();
                  if (LAB_SIDE) {
                    labClear();
                    location.reload();
                  } else refresh();
                },
                'danger',
              )}${ubtn('Keep playing', () => {
                setRestartAsk(false);
              })}</div></div>`
            : `<div class="row">${ubtn(
                'Restart',
                () => {
                  setRestartAsk(true);
                },
                'danger',
              )}</div>`
        }`
    }`;
    const all = menuTab === 'Table' ? `${body}${newGame}` : body;
    return `<div class="modal"><div class="sheet menu"><h3><span class="grow">Game</span>${ubtn(
      `${ico('back')}<span>Leave game</span>`,
      () => {
        location.href = homeUrl();
      },
      'leave',
      false,
      'Back to the home page (the game is saved)',
    )}<button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
      <div class="tabs">${tabs
        .map(
          (t) =>
            `<button class="${t === menuTab ? 'on' : ''}" data-ui="${reg(() => {
              setMenuTab(t);
            })}" title="${t}" aria-label="${t}">${ico(({ Table: 'users', Log: 'list', Settings: 'sliders', Admin: 'lock' } as Record<string, string>)[t] ?? 'info')}<span>${t}</span></button>`,
        )
        .join('')}</div><div class="mbody">${all}</div></div></div>`;
  }
  return '';
}
const inGame = () => HAS_TABLE || DEV_FAKE || SANDBOX || TUTORIAL || !!LAB_SIDE || online.mode === 'local';
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
  if (!g.battle || g.battle.stage !== 'setup') refusal = '';
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
        inspectId = null;
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
        lastPointer = ev.pointerType;
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
let lastFight: number | null = null;
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
      matches = m;
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
      if (rollView.groups.length) {
        setHeldNext(g);
        setG(prevG);
      } // the board keeps the old state until the dice land
      if (rollView.groups.length) {
        const cv = $('#dice') as HTMLCanvasElement;
        cv.style.display = 'block';
        throwDice(cv, rollView.groups, (p) => {
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
        matches = m;
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
