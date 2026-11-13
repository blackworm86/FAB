// Acting on the map: what the camera should frame, reinforcing a battle, the battle close-up, and a tap on an area or a block.
import * as THREE from 'three';
import * as E from '../../engine/src';
import * as SB from './sandbox';
import * as SBU from './sandbox-ui';
import { SANDBOX } from './online';
import { type Tgt } from './chit-play';
import { areaName, first, MAP, P1, POLE, toWorld, VOL } from './page';
import {
  areaPick,
  g,
  hoverArea,
  previewArea,
  selChit,
  selUnit,
  setAreaPick,
  setHoverArea,
  setPreviewArea,
  setSelArea,
  setSelUnit,
  tut,
} from './game-state';
import { canvas, scene } from './scene';
import { clearRatio, formationReach } from './piece-kit';
import { seen, viewRot } from './map-paint';
import { dist, pick, pitch, setYaw, target } from './camera';
import { act, allowed, arrive, fightable, mine, other, say, selArr, setSelArr, tgt } from './flow';
import { airPick, arrOpts, pickSA, setAirPick } from './choices';
import { primary, refresh, showAreas } from './main';

/* ---------- camera focus ---------- */
type Goal = { t: THREE.Vector3; dist: number; pitch: number; fast?: boolean } | null;
export let goal: Goal = null,
  saved: Goal = null,
  inBattle = false;
export const setInBattle = <T extends typeof inBattle>(v: T): T => ((inBattle = v), v);
export const setGoal = <T extends typeof goal>(v: T): T => ((goal = v), v);
/** Reinforcing a battle by Special Action (the defender): neighbouring blocks that may join light up and a tap moves one in. */
export let reinforcing = false;
export const setReinforcing = <T extends typeof reinforcing>(v: T): T => ((reinforcing = v), v);
export function reinforceTargets(): Tgt | null {
  const b = g.battle;
  if (!reinforcing || !b || b.stage !== 'setup') return null;
  const t: Tgt = {
      units: new Map(),
      areas: new Map(),
      pick: new Map(),
      color: new Map(),
      chips: [],
      buttons: [],
      modes: [],
      any: null,
      hint: 'Tap a glowing neighbouring block to bring it in',
    },
    def = other(b.attacker);
  for (const u of g.units.filter((x) => x.side === def && x.area != null && x.area !== b.area)) {
    try {
      const c = structuredClone(g);
      E.defenderReinforceSA(c, c.battle!, u.id);
      t.units.set(u.id, () => {
        reinforcing = false;
        pickSA(def, u.ech, (sa) => E.defenderReinforceSA(g, g.battle!, u.id, sa));
      });
    } catch {
      /* not a legal reinforcement */
    }
  }
  return t;
}
let frameKey = '';
/** The battle camera: held on the contested area (fitted to it), where the player can still zoom and orbit but not pan away. */
export let lock: { c: THREE.Vector3; d: number } | null = null;
export const clampDist = (d: number) =>
  lock ? Math.min(lock.d * 1.7, Math.max(lock.d * 0.45, d)) : Math.min(innerWidth < 700 ? 64 : 72, Math.max(7, d)); // desktop: no further out than the map filling most of the screen (it shrank into a corner)      // phones: never so far out that the map leaves a black band
export function areaWorld(id: number) {
  return MAP.areas.find((a) => a.id === id)!.polygon.map(([x, y]) => toWorld(x, y));
}
export function syncBattleCam() {
  const b = g.battle;
  let key = b ? `${b.area}:${b.stage === 'setup' ? 's' : 'f'}` : '';
  const wide = reinforcing || b?.stage === 'retreat';
  if (b && wide) key += 'r';
  if (b && !wide) key += ':' + Math.round(clearRatio * 5); // refit when the panels around the battle grow or shrink
  if (b && key !== frameKey) {
    if (!inBattle) saved = { t: target.clone(), dist, pitch };
    const pts = areaWorld(b.area),
      xs = pts.map((q) => q.x),
      zs = pts.map((q) => q.z),
      w = Math.max(...xs) - Math.min(...xs),
      h = Math.max(...zs) - Math.min(...zs);
    const c = new THREE.Vector3((Math.max(...xs) + Math.min(...xs)) / 2, 0, (Math.max(...zs) + Math.min(...zs)) / 2),
      r = Math.max(Math.max(w, h) / 2 + 3, formationReach(b) + 2.5);
    let fit = Math.max(16, r * (innerWidth < innerHeight ? 3.0 : 2.6));

    if (!wide) {
      const pl = toWorld(...POLE.get(b.area)!);
      c.set(pl.x, 0, pl.z);
    } // the battle formation is centred on the area's pole
    if (!wide) fit = fit / Math.max(0.55, Math.min(1, clearRatio * 1.25)); // only the band between the panels shows the battle
    lock = wide ? null : { c, d: fit };
    goal = { t: c, dist: wide ? fit * 1.8 : fit, pitch: 1.15, fast: true };
    setYaw(viewRot());
  }
  if (!b) {
    reinforcing = false;
    lock = null;
    if (inBattle && saved) goal = saved;
  }
  frameKey = key;
  inBattle = !!b;
}

/* ---------- map interaction ---------- */
export const optsFor = (id: string): E.Opt[] =>
  g.phase === 'strategic'
    ? E.stratOptions(g, id).map((a) => ({
        area: a,
        cost: 0,
        fuel: VOL.features.fuel && first(g.units.find((x) => x.id === id)!.side),
        mustStop: false,
        path: [],
      }))
    : E.moveOptions(g, id);
export const fuelLeft = () => E.boxOf(g, P1, 'available').filter((c) => c.kind === 'fuel').length;
export const center = (a: number) => toWorld(...POLE.get(a)!);
export function confirmMove() {
  const id = selUnit!,
    to = previewArea!,
    u = g.units.find((x) => x.id === id)!,
    from = u.area!;
  setSelUnit(null);
  setPreviewArea(null);
  setSelArea(to);
  act(
    () => {
      if (g.phase === 'strategic') E.stratMove(g, id, to);
      else E.move(g, id, to, true);
    },
    `${u.name}: ${areaName(from)} → ${areaName(to)}`,
  );
  if (g.moving?.id === id) {
    setSelUnit(id);
    refresh();
  } // one area at a time: it stays picked while it has points left
}
export function click(e: PointerEvent) {
  let { unit, area } = pick(e);
  if (tut) {
    const t = tut.gate(unit, area);
    if (t === false) return;
    if (t.unit) unit = t.unit;
    if (t.area != null) area = t.area;
  }
  if (SANDBOX && SBU.st.sbPlace) {
    const id = SBU.st.sbPlace;
    if (area == null) return;
    SBU.st.sbPlace = null;
    return SBU.sbx(() => SB.place(g, id, area));
  }
  if (areaPick) {
    const ap = areaPick;
    setAreaPick(null);
    if (area != null && ap.areas.has(area)) return act(() => ap.run(area));
    say(`${ap.label}: cancelled.`);
    return refresh();
  }
  if (reinforcing && g.battle) {
    const fn = unit ? tgt?.units.get(unit) : undefined;
    if (fn) return act(fn);
    reinforcing = false;
    if (unit)
      say(
        'That block cannot reinforce this battle (8.23: good order, an adjacent uncontested area, and a Special Action for its Higher Echelon).',
      );
    return refresh();
  }
  {
    const c0 = selChit ? g.chits.find((x) => x.id === selChit) : null,
      tg = c0 && g.phase === 'admin' ? tgt : null;
    if (tg) {
      const fnU = unit ? tg.units.get(unit) : undefined,
        fnA = area != null ? (tg.areas.get(area) ?? tg.any?.(area) ?? undefined) : undefined;
      if (fnU || fnA) {
        return act((fnU ?? fnA)!);
      }
      const pk = area != null ? tg.pick.get(area) : undefined;
      if (pk) {
        pk();
        return refresh();
      }
      if (area != null && (tg.areas.size || tg.units.size || tg.any)) {
        say(tg.hint || 'That is not a target for this chit: tap a glowing area or block.');
        return;
      } // a tap that does nothing says why
    }
  }
  const rb = g.battle;
  if (rb?.stage === 'retreat' && area != null && E.retreatOptions(g, rb).includes(area)) return act(() => E.chooseRetreat(g, rb, area));
  if (g.battle && !g.pendingBlow) {
    // a battle is on the table: tapping a block makes it that side's point unit
    const b = g.battle,
      u = unit ? g.units.find((x) => x.id === unit) : null,
      { chit: tapped } = pick(e);
    {
      const fn = tgt?.units.get(tapped ?? unit ?? '');
      if (fn && (b.stage === 'attFirst' || b.stage === 'loss')) return act(fn);
    }
    if (b.stage === 'setup' && airPick?.step === 'unit') {
      const p = airPick;
      if (u && u.side === p.side && u.area === b.area && (!u.garrison || u.id.startsWith('F-'))) {
        // Sicily Example 15C: the flanking asset may get the +2
        setAirPick(null);
        return act(() => E.assign(g, b, p.id, 'support', u.id));
      }
      setAirPick(null);
      say('Tap one of your own blocks in this battle for the +2. Cancelled.');
      return refresh();
    }
    if (b.stage === 'setup' && tapped) {
      const c = E.chit(g, tapped);
      if (mine(c.side)) act(() => E.unassign(g, b, tapped));
      else say("Those are the other player's assets.");
      return;
    }
    if (b.stage === 'setup' && u && seen(u) && mine(u.side) && !u.garrison && !(u.side === b.attacker && u.disorder))
      act(() => E.setPoint(g, b, u.side, u.id));
    return;
  }
  if (g.pendingBlow) return;
  if (selArr && area != null && arrOpts().some((o) => o.area === area)) {
    const id = selArr;
    setSelArr(null);
    return act(() => arrive(id, area));
  }
  if (selUnit && area != null && optsFor(selUnit).some((o) => o.area === area)) {
    setPreviewArea(area);
    return confirmMove();
  } // two taps: block, then where it goes (Undo takes it back)
  if (selUnit && area != null && !unit && ['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase)) {
    const u = g.units.find((x) => x.id === selUnit);
    if (u && u.area !== area && mine(u.side)) {
      say(
        `${areaName(area)}: ${u.name} cannot go there${u.moved ? ' (it has already moved)' : !optsFor(u.id).length ? ' (it has no move left)' : ' this move. The lit areas are where it can go'}.`,
        true,
      );
      return;
    }
  } // a tap that does nothing says why
  if ((g.phase === 'combat' || g.phase === 'btCombat') && area != null && fightable().includes(area)) {
    setSelArea(area);
    setSelUnit(null);
    setPreviewArea(null);
    const p = allowed() ? primary() : null;
    if (p && !p.dis && p.label.startsWith('Fight ')) return act(p.fn);
    return refresh();
  } // one tap on a battle area opens the battle
  const uu = unit ? g.units.find((x) => x.id === unit) : null;
  if (uu && g.moving && g.moving.id !== uu.id && mine(uu.side)) act(() => E.endMove(g)); // another block: the one moving before is done for good
  if (uu && seen(uu) && (mine(uu.side) || !['movement', 'strategic', 'reaction', 'btMove'].includes(g.phase))) {
    setSelUnit(unit!);
    setSelArea(uu.area);
    if (uu.area != null) showAreas([uu.area, ...optsFor(uu.id).map((o) => o.area)]);
  } /* the block and its destinations in view */ else {
    setSelArea(area);
    setSelUnit(null);
  }
  setPreviewArea(null);
  setHoverArea(null);
  refresh();
}
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || !selUnit || g.battle) return;
  const a = pick(e).area,
    h = a != null && optsFor(selUnit).some((o) => o.area === a) ? a : null;
  if (h !== hoverArea) {
    setHoverArea(h);
    if (previewArea == null) refresh();
  }
});

export const route = new THREE.Group();
scene.add(route);
