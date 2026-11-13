// The card of the selected block or area with its buttons, and dragging an arriving unit onto the map.
import * as THREE from 'three';
import * as E from '../../engine/src';
import type { PanelCtx } from './golan-ui';
import { ico } from './icons';
import { esc, nm } from './util';
import { pips } from './table-text';
import { reg, ubtn, btn } from './ui-kit';
import { hasLegend } from './map-legend';
import { RULE, ruleHtml } from './rules-text';
import { areaName, first, P1, VOL } from './page';
import { g, hoverArea, previewArea, selChit, selUnit, setAreaPick, setPreviewArea, setSelChit, setSelUnit } from './game-state';
import { canvas } from './scene';
import { noSup, paintAreas, seen } from './map-paint';
import { dist, pick, pitch } from './camera';
import { act, arrive, chitBar, mine, say, selArr, setSelArr } from './flow';
import { arrOpts, pickSA } from './choices';
import { center, confirmMove, fuelLeft, optsFor, setGoal } from './map-input';
import { badgeList, setBadges, syncBadges } from './routes';
import { canAct, skipNow, skipped } from './map-marks';
import { rollView } from './rolls';
import { gx } from './prompt';
import { recoverSel } from './dock';
import { pieceBtn, unitPic } from './pieces-window';
import { legendOpen, legendShownAt, refresh, setLegendOpen, setLegendShownAt } from './main';

/** What the volume's own prompts may use: buttons, who is mine, an area pick on the map. */
export const panelCtx = (): PanelCtx => ({
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
export function dispatch() {
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
            setLegendOpen(true);
            setLegendShownAt(performance.now());
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
export const svgUri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** Fly the camera over the legal entry areas of the selected arriving block. */
export function frameArrival() {
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
export function dragArrival(ev: PointerEvent, el: HTMLElement) {
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
