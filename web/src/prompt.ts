// What the player is asked to do: the turn pill and top bar, the instruction line, the main button, and the helpers of the actions dock.
import * as THREE from 'three';
import * as E from '../../engine/src';
import * as SBU from './sandbox-ui';
import { online, SANDBOX, TUTORIAL } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { STAGE_NAME } from './table-text';
import { chatBtn } from './chat';
import { reg } from './ui-kit';
import { areaName, first, P1, P2, VOL } from './page';
import { areaPick, g, selArea, selChit, selUnit, setPreviewArea, setSelArea, setSelChit, setSelUnit } from './game-state';
import { tint } from './map-paint';
import { dist, pitch } from './camera';
import {
  act,
  actorNow,
  allowed,
  dropsLeft,
  endLabel,
  fightable,
  hist,
  mine,
  other,
  PHASE_OF,
  PHASES,
  placing,
  say,
  setBattleFx,
  setRollFx,
  tgt,
} from './flow';
import { airPick, heldBad, pickSA, setEndHidden } from './choices';
import { center, reinforcing, setGoal } from './map-input';
import { btArmor, skipNow } from './map-marks';
import { endRoll, rollStage, rollView, setHandSide } from './rolls';
import { lastFight, render, setLastFight, showAreas } from './main';

/* ---------- views ---------- */
export let phaseOpen = false;
export const setPhaseOpen = <T extends typeof phaseOpen>(v: T): T => ((phaseOpen = v), v);
/** The turn, side and step as one pill with a dot per step (owner, 13 Nov); a tap lists the whole sequence of the player turn. */
/** Why the side setting up a battle cannot confirm yet, in the engine's own words (a dry run on a copy), or null. */
export function setupBlock(b: E.Battle, who: E.Side): string | null {
  const own = VOL.blocksBegin(g);
  if (own) return own;
  try {
    const c = structuredClone(g);
    E.setReady(c, c.battle!, who);
    return null;
  } catch (e) {
    const m = (e as Error).message;
    return m ? m[0].toUpperCase() + m.slice(1) : null;
  }
}
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
  )}"><span class="tt"><span class="l1">T${g.turn} · <b class="${who}"><span class="lng">${nm(who).toUpperCase()}</span><span class="sht">${VOL.tag[who]}</span></b></span><span class="dot2"> · </span><b class="stp">${label.toUpperCase()}</b></span>${dots}<span class="car" aria-hidden="true">▾</span></button>${list}</div>`;
}
/** The top bar; `vp` is the score strip, which sits inside it (one bar instead of two). */
export function topBar(vp = '') {
  const tr = (g.track ?? E.VOLUME.track)[g.turn - 1],
    i = first(g.phasing) ? 0 : 1,
    pAt = PHASE_OF[g.phase],
    phaseLabel = g.phase === 'deploy' ? 'Set-up' : PHASES[pAt];
  const who = g.phase === 'deploy' && !placing(g.phasing) && placing(other(g.phasing)) ? other(g.phasing) : g.phasing; // set-up: the side placing its pieces now (Sicily: the Allied landing plan after the Axis garrisons)
  return `<div class="c-bar t"><button class="ico" data-modal="menu" title="Menu, log and new game" aria-label="Menu, log and new game">${ico('menu')}</button>${phasePill(who, pAt, phaseLabel)}
    ${vp}<div class="c-stat">${online.active && online.mode === 'remote' ? `<span class="syncdot ${/NOT SAVED/.test(online.sync) ? 'bad' : /saving|connecting/.test(online.sync) ? 'wait' : 'ok'}" title="${esc(online.sync)}" aria-label="${esc(online.sync)}"></span>` : ''}${online.active && !(!online.both() && online.mySide() === g.phasing) ? `<span>YOU<b class="${online.mySide() ?? ''}">${online.both() ? 'BOTH' : (online.mySide() ?? 'WATCHING').toUpperCase()}</b></span>` : ''}${online.devSwitch() ? `<button class="ico dev" data-seat title="Developer: switch seat (${nm(P1)}, ${nm(P2)}, both, watching)" aria-label="Switch seat">${ico('swap')}<span class="bl">Seat</span></button>` : ''}${(g.phase === 'admin' || g.phase === 'reinforcement') && (tr.ge[i] || tr.al[i]) ? `<span title="Chits each side draws this turn (${nm(P1)} / ${nm(P2)})">CHITS<b>${tr.ge[i]}/${tr.al[i]}</b></span>` : ''}${chatBtn()}<button class="ico ${tint !== 'off' ? 'on' : ''}" data-tint title="View: 2D or 3D, blocks or figures, reset the camera" aria-label="View">${ico('eye')}<span class="bl">View</span></button><button class="ico" data-modal="boxes" title="Pieces: boxes, arrivals" aria-label="Pieces">${ico('boxes')}<span class="bl">Pieces</span></button></div></div>`;
}
export const COARSE = matchMedia('(pointer: coarse)').matches;
/** The verb matches the device: tap on touch screens, click with a mouse. */
export const verb = (h: string) => (COARSE ? h : h.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click'));
export function prompt() {
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
export const setGuide = (v: 'full' | 'short') => {
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
      ? ((w) => (w ? `<b>Not yet:</b> ${esc(w)}.` : setupPrompt(b)))(setupBlock(b, E.setupSide(g, b)))
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
        : ((p) =>
            p && !p.dis
              ? `<b>Set-up done:</b> press <b>${esc(p.label)}</b>.`
              : '<b>Set-up:</b> finish the steps in the panel on the map, then end the set-up.')(primary());
    }
    case 'reinforcement':
      return '<b>Pick a new block</b>, then a lit entry area.';
    case 'admin':
      return selChit && tgt?.hint
        ? `<b>${esc(tgt.hint)}</b>${tgt.areas.size + tgt.units.size > 0 ? ` · ${tgt.areas.size + tgt.units.size} lit` : ''}`
        : E.boxOf(g, E.adminActor(g), 'available').length
          ? `<b>${esc(nm(E.adminActor(g)))}: tap a card</b>${gx(g.done?.includes(g.phasing) ? ' to play it if you wish, then end the step.' : ` to play it if you wish, then Done: the ${nm(other(g.phasing))} player acts next (4.2).`)}`
          : `<b>${esc(nm(E.adminActor(g)))}: no cards to play.</b>${gx(g.done?.includes(g.phasing) ? ' End the step.' : ` Press Done: the ${nm(other(g.phasing))} player acts next (4.2).`)}`;
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
        ? `<b>Tap a red area</b>${gx(' to fight there, or press <b>Next battle</b>.', ' or Next battle.')}`
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
        why = setupBlock(b, who);
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
            setLastFight(b.area);
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
    if (dropsLeft() && mine(g.phasing))
      return { label: 'Drop the airborne first', fn: () => say('Choose the drop zone in the panel on the map first (14.27a)'), dis: true }; // Sicily 14.27a: no battle before the drop
    if (sel != null) return { label: `Fight ${areaName(sel)}`, fn: fight(sel) };
    if (must.length && allowed() && mine(g.phasing)) {
      const at = lastFight != null ? center(lastFight) : null,
        air = g.game === 'sicily' ? E.sicily.state(g).airborneAreas.filter((a) => must.includes(a)) : [],
        next = air[0] ?? (at ? [...must].sort((x, y) => center(x).distanceTo(at) - center(y).distanceTo(at))[0] : must[0]); // Sicily 14.27a: the airborne assault is fought first
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
  if (g.phase === 'admin' && !g.done?.includes(g.phasing)) {
    // 4.2b/c: the phasing player acts first and hands over; then the other player acts and ends the phase
    const me = online.active && !online.both() ? online.mySide() : g.phasing;
    if (!me) return null;
    if (me !== g.phasing) return { label: `Waiting for ${nm(g.phasing)}`, fn: () => {}, dis: true };
    return {
      label: `Done · ${nm(other(g.phasing))} acts`,
      fn: () =>
        act(() => {
          E.setDone(g, g.phasing);
          setHandSide(null);
          setSelChit(null);
          setSelArea(null);
        }),
      dis: !!g.recover.length || !!g.artyPick,
    };
  }
  if (g.phase === 'admin' && online.active && !online.both() && online.mySide() === g.phasing)
    return { label: `Waiting for ${nm(other(g.phasing))}`, fn: () => {}, dis: true };
  if (online.active && !online.both() && g.phase === 'reinforcement') {
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
export let endArmed = false;
/* it stays armed until pressed again or until any other click (owner, 13 Nov: nothing happens by itself) */
document.addEventListener(
  'click',
  (e) => {
    if (endArmed && !(e.target as Element).closest?.('.c-bar.b .go')) {
      endArmed = false;
      setTimeout(render);
    }
  },
  true,
);
let goLabel = '',
  goSince = 0;
export function guardEnd(p: { label: string; fn: () => void }) {
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
      p.fn();
    };
  return () => {
    endArmed = true;
    render();
  };
}
