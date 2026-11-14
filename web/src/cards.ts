// The chits in hand as cards: which can be played now, tapping one, playing it on a target, dragging and dropping.
import * as E from '../../engine/src';
import { online } from './online';
import { esc } from './util';
import { areaName, VOL } from './page';
import { g, selChit, setSelArea, setSelChit } from './game-state';
import { canvas } from './scene';
import { paintAreas } from './map-paint';
import { pick } from './camera';
import { act, ARMY_NAME, dragTargets, mine, say, setDragTargets, tgtMode } from './flow';
import { setAirPick } from './choices';
import { badgeList, setBadges, syncBadges } from './routes';
import { chitPic, refresh, refusal, render, setRefusal, unitPic } from './main';

/* ---------- cards and drag and drop ---------- */

const chitUri = new Map<string, string>();
export const chitImg = (c: E.Chit) => {
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
export function usableNow(c: E.Chit): boolean {
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
export const card = (c: E.Chit, r = 0, why: string | null = null) =>
  `<div tabindex="0" role="button" class="card2 ${c.side} ${c.kind === 'sa_block' ? 'wood' : ''} ${why ? 'bad' : usableNow(c) ? 'live' : ''} ${c.id === selChit ? 'sel' : ''}" data-chit="${c.id}" style="--r:${r}deg" title="${esc(why ?? c.name + (ARMY_NAME[c.ech] ? ' · ' + ARMY_NAME[c.ech] : ''))}" aria-label="${esc(c.name)}">${chitPic(c)}${g.battle ? `<span class="ckind">${E.isArty(c) ? 'Arty' : /air/.test(c.kind) ? 'Air' : 'Asset'}</span>` : ''}</div>`; /* phones have no hover title: the kind is written on the card */
/** How much neighbouring cards overlap so the whole hand fits: each card keeps at least 34 px (46 on phones) visible, and the hand scrolls when even that does not fit. */
const overlapFor = (n: number) => {
  const cw = innerWidth >= 900 ? 72 : 62,
    avail = innerWidth - 40,
    visible = n > 1 ? Math.min(cw, Math.max(innerWidth < 900 ? 46 : 34, (avail - cw) / (n - 1))) : cw;
  return n > 1 ? Math.round(cw - visible) : 0;
};
export const handStyle = (n: number) => `style="--ov:${overlapFor(n)}px"`;
export const fan = (cs: string[]) =>
  cs.map((h, i) => h.replace('--r:0deg', `--r:${((i - (cs.length - 1) / 2) * Math.min(5, 40 / cs.length)).toFixed(1)}deg`)).join('');
/** Place every asset that may legally join, artillery first, for both sides. */
export function autoFill(b: E.Battle) {
  const order = (c: E.Chit) => (E.isArty(c) ? 0 : c.kind === 'engineer' ? 2 : 1);
  for (const c of g.chits
    .filter((x) => x.box === 'available' && (E.isArty(x) || E.isBattleAsset(x)) && mine(x.side))
    .sort((x, y) => order(x) - order(y))) {
    if (!E.canAssign(g, b, c.side, c)) E.assign(g, b, c.id);
  }
}
/** Where an event or asset chit can be played on the map (Admin Phase): the areas to light while it is dragged. */
/** Where a dragged chit may be dropped: exactly the areas it can be used in (its zone, its rules), from the same dry runs as a tap. */
export function chitTargets(c: E.Chit): number[] {
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
export let lastPointer = 'mouse';
export const setLastPointer = <T extends typeof lastPointer>(v: T): T => ((lastPointer = v), v);
/** Touch: a card is tapped, never dragged (so the hand can scroll). In a battle it files itself; an event or asset with map targets lights them and waits for a tap on one. */
export let handInfo = false,
  handInspect: string | null = null;
export const setHandInspect = <T extends typeof handInspect>(v: T): T => ((handInspect = v), v);
export const setHandInfo = <T extends typeof handInfo>(v: T): T => ((handInfo = v), v);
export function tapCard(id: string) {
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
      setRefusal(`${c.name}: ${why}`);
      return render();
    }
    setRefusal('');
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
export function drag(ev: PointerEvent, el: HTMLElement) {
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
        setRefusal(`${c.name}: ${why}`);
        return render();
      }
      setRefusal('');
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
      setRefusal(`${c.name}: ${why}`);
      return render();
    }
    setRefusal('');
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
