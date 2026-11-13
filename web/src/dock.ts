// The map from the keyboard and the actions dock: shortcuts with their counts, the labelled undo.
import * as THREE from 'three';
import * as E from '../../engine/src';
import { online } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { reg } from './ui-kit';
import { areaName, LAB, MAP, toWorld, VOL } from './page';
import { g, previewArea, selArea, selChit, selUnit, setHoverArea, setPreviewArea, setSelArea, setSelChit, setSelUnit } from './game-state';
import { cam, canvas } from './scene';
import { REL, show3d } from './map3d';
import { seen } from './map-paint';
import { allowed, fightable, hist, mine, other, say } from './flow';
import { center, click, optsFor } from './map-input';
import { btArmor, fwOk, rsOk } from './map-marks';
import { handSide } from './rolls';
import { usableNow } from './cards';
import { canMove, lookAt, nextOf } from './prompt';
import { refresh } from './main';

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
export function dockChips(): string {
  if (g.over || !allowed()) return '';
  const out: string[] = [],
    c = (label: string, n: number | null, hot: boolean, fn: (() => void) | null, title = '') =>
      out.push(
        `<button class="dchip ${hot ? 'hot' : ''}" ${fn ? `data-ui="${reg(fn)}"` : 'disabled'} title="${esc(title || label)}">${esc(label)}${n != null ? `<b>${n}</b>` : ''}</button>`,
      );
  if (g.battle) return '';
  if (g.phase === 'admin' || g.phase === 'reinforcement') {
    const own = online.active && !online.both() ? online.mySide() : null,
      hs = handSide ?? own ?? (g.phase === 'admin' ? E.adminActor(g) : g.phasing),
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
export function undoBtn(): string {
  if (!allowed() || g.over) return '';
  const can = hist.length > 0,
    txt = can ? `Undo: ${hist.label || 'last action'}` : '';
  if (!can && hist.lock)
    return `<button class="dundo idle locked" disabled title="${esc(`Undo not possible: ${hist.lock}`)}" aria-label="${esc(`Undo not possible: ${hist.lock}`)}">${ico('undo')}<span></span></button>`; // nothing to undo: a quiet greyed button, the reason in its tooltip, no "Locked" label in the bar
  if (!txt)
    return `<button class="dundo idle" disabled aria-label="Nothing to undo" title="Nothing to undo" tabindex="-1">${ico('undo')}<span></span></button>`; // always in place, so nothing shifts
  return `<button class="dundo" ${can ? `data-undo` : 'disabled'} title="${esc(can ? txt + ' (Ctrl+Z)' : 'Undo is locked once dice are rolled or something hidden is shown')}">${ico(can ? 'undo' : 'lock')}<span>${esc(txt)}</span></button>`;
}
export const recoverSel: Record<string, string | null> = {};
