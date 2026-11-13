// Dice on the table: the roll being shown, its stages, what a roll changes on the board, and check rolls.
import * as THREE from 'three';
import * as E from '../../engine/src';
import { push } from './online';
import { nm } from './util';
import { STAGE_NAME } from './table-text';
import { snap } from './fx';
import { throwDice, clearDice, type DiceGroup } from './dice3d';
import { $, first, KEY } from './page';
import { g, save, setG } from './game-state';
import { scene } from './scene';
import { markers, pieces } from './piece-kit';
import { viewRot } from './map-paint';
import { dist, pitch } from './camera';
import {
  allowed,
  labActing,
  setOwnRollShown,
  noteFx,
  notYou,
  other,
  pendingFx,
  say,
  setPendingFx,
  setRollFx,
  setRollNoted,
  showFx,
} from './flow';
import { center, setGoal } from './map-input';
import { refresh, render } from './main';

/* ---------- battle state shared with the view ---------- */
export interface RollView {
  remote?: boolean;
  morale?: boolean;
  check?: boolean;
  title: string;
  groups: (DiceGroup & { parts: [string, number][]; hits: number })[];
  pos: { x: number; y: number; group: number; v: number }[] | null;
}
export let menuTab = 'Settings',
  restartAsk = false;
export const setRestartAsk = <T extends typeof restartAsk>(v: T): T => ((restartAsk = v), v);
export const setMenuTab = <T extends typeof menuTab>(v: T): T => ((menuTab = v), v);
setOwnRollShown(() => !!rollView && !rollView.remote); // against the computer your roll's Continue button never waits for your turn
export let rollView: RollView | null = null,
  modal: 'menu' | 'boxes' | 'rules' | 'layers' | null = null,
  handSide: E.Side | null = null;
export const setRollView = <T extends typeof rollView>(v: T): T => ((rollView = v), v);
export const setHandSide = <T extends typeof handSide>(v: T): T => ((handSide = v), v);
export const setModal = <T extends typeof modal>(v: T): T => ((modal = v), v);
export function rollStage(b: E.Battle) {
  if (!allowed()) return say(notYou());
  const side = b.stage === 'attArty' || b.stage === 'offFire' || b.stage === 'exploit' ? b.attacker : other(b.attacker),
    kind = b.stage.endsWith('Arty') ? 'arty' : 'ground',
    fl = b.stage === 'exploit' ? [] : E.fireList(g, b, side, kind),
    n0 = b.rolls.length,
    stage = b.stage;
  const next = structuredClone(g),
    before = snap(g);
  E.roll_step(next, next.battle!);
  setRollFx([]);
  noteFx(before, next, true);
  setRollNoted(true);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage off */
  }
  void push(next); // the result is stored at once; the board shows it when the dice land
  const fresh = next.battle!.rolls.slice(n0);
  heldNext = next;
  rollView = {
    remote: labActing,
    morale: stage === 'exploit',
    title: `${nm(side)} ${STAGE_NAME[stage]}`,
    pos: null,
    groups: fresh.map((r) => ({
      label: r.who,
      col: r.kind === 'arty' ? 's' : first(side) ? 'k' : 'w',
      sn: r.sn,
      dice: r.dice,
      hits: r.hits,
      parts: fl.find((f) => f.who === r.who)?.parts ?? [],
    })),
  };
  if (!rollView.groups.length) {
    rollView = null;
    commitRoll();
    return;
  }
  refresh();
  const cv = $('#dice') as HTMLCanvasElement;
  cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => {
    if (rollView) {
      const rv = rollView;
      rv.pos = p;
      render();
      afterDice(rv);
    }
  }); // the result clears by itself; a tap on it skips the wait
}
/** A roll is shown on the board as it was; when the dice land the result is applied: blocks that lose a step turn, what is removed fades. */
export let heldNext: E.Game | null = null;
export const setHeldNext = <T extends typeof heldNext>(v: T): T => ((heldNext = v), v);
export const anims: { t0: number; dur: number; fn: (k: number) => void; end?: () => void }[] = [];
export const fades = new THREE.Group();
scene.add(fades);
export function commitRoll() {
  const next = heldNext;
  if (!next) return;
  heldNext = null;
  const prev = g,
    gone = new Set<string>();
  for (const u of prev.units) {
    const n = next.units.find((x) => x.id === u.id);
    if (u.area != null && n && n.area == null) gone.add('u:' + u.id);
  }
  for (const c of prev.chits) {
    const n = next.chits.find((x) => x.id === c.id);
    if (c.box === 'map' && n && n.box !== 'map') gone.add('c:' + c.id);
  }
  for (const a of prev.fieldWorks) if (!next.fieldWorks.includes(a)) gone.add('m:FW:' + a);
  const keyOf = (o: THREE.Object3D) =>
    o.userData.unit ? 'u:' + o.userData.unit : o.userData.chit ? 'c:' + o.userData.chit : o.userData.mark ? 'm:' + o.userData.mark : '';
  for (const o of [...pieces.children, ...markers.children])
    if (gone.has(keyOf(o))) {
      // a copy of what goes away, faded out over the new board
      const cl = o.clone(true);
      cl.traverse((x) => {
        const m = x as THREE.Mesh;
        if (!m.material) return;
        m.material = ([] as THREE.Material[]).concat(m.material).map((mt) => {
          const c = mt.clone();
          c.transparent = true;
          return c;
        }) as never;
      });
      fades.add(cl);
      const mats: THREE.Material[] = [];
      cl.traverse((x) => {
        const m = x as THREE.Mesh;
        if (m.material) mats.push(...([] as THREE.Material[]).concat(m.material));
      });
      anims.push({
        t0: performance.now(),
        dur: 900,
        fn: (k) => {
          mats.forEach((mt) => {
            mt.opacity = 1 - k;
          });
          cl.position.y += 0.004;
        },
        end: () => {
          fades.remove(cl);
          mats.forEach((mt) => mt.dispose());
        },
      });
    }
  const turned = next.units
    .filter((u) => {
      const o = prev.units.find((x) => x.id === u.id);
      return o && u.area != null && u.str < o.str;
    })
    .map((u) => u.id);
  setG(next);
  save();
  refresh();
  for (const id of turned)
    anims.push({
      t0: performance.now(),
      dur: 700,
      fn: (k) => {
        const m = pieces.children.find((o) => o.userData.unit === id);
        if (m && !m.userData.troop) m.rotation.y = viewRot() + ((1 - (1 - (1 - k) ** 3)) * Math.PI) / 2;
      },
    }); // the block turns to its new strength
}
export function runAnims() {
  const now = performance.now();
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i],
      k = Math.min(1, (now - a.t0) / a.dur);
    a.fn(k);
    if (k >= 1) {
      a.end?.();
      anims.splice(i, 1);
    }
  }
}
/** Morale checks outside a battle (supply, Greif interdict): the camera goes to the unit and the dice are thrown on screen with PASS or FAIL. */
export function showChecks(cs: E.Check[]) {
  if (!cs.length || rollView) return;
  const a = cs.find((c) => c.area != null)?.area;
  if (a != null) {
    const p = center(a);
    setGoal({ t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, 30), pitch });
  }
  rollView = {
    check: true,
    morale: true,
    title: cs[0].why.replace(/ \(.*\)$/, ''),
    pos: null,
    groups: cs.map((c) => ({ label: c.who, col: 'w', sn: c.sn, dice: [c.die], hits: c.ok ? 1 : 0, parts: [] })),
  };
  refresh();
  const cv = $('#dice') as HTMLCanvasElement;
  cv.style.display = 'block';
  throwDice(cv, rollView.groups, (p) => {
    if (rollView) {
      const rv = rollView;
      rv.pos = p;
      render();
      setTimeout(() => {
        if (rollView === rv) {
          hideDice();
          render();
        }
      }, 1300);
    }
  }); /* a check roll waits for Continue too */
}
/** After the dice settle: a moment to read them, then they leave and the results play on the board (turning blocks, fading pieces, pop-ups). */
export function afterDice(rv: RollView) {
  setTimeout(() => {
    if (rollView !== rv) return;
    hideDice();
    commitRoll();
    showFx(pendingFx);
    setPendingFx([]);
    render();
    if (rv.remote)
      setTimeout(() => {
        if (rollView === rv) endRoll();
      }, 3200); /* owner, 13 Nov: your own rolls wait for Continue */ // results move on by themselves (a hit choice or retreat then waits on the table); with auto off, your roll waits for Continue
  }, 1100);
}
export function hideDice() {
  clearDice();
  const cv = $('#dice') as HTMLElement | null;
  if (cv) cv.style.display = 'none';
}
export function endRoll() {
  commitRoll();
  rollView = null;
  clearDice();
  ($('#dice') as HTMLElement).style.display = 'none';
  refresh();
}
