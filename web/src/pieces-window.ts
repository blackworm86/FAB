// The Pieces window: the boxes of chits and the arrivals, side by side.
import * as E from '../../engine/src';
import { online } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { chitLabel } from './table-text';
import { reg, chip } from './ui-kit';
import { RULE, ruleHtml } from './rules-text';
import { VOL } from './page';
import { g } from './game-state';
import { seen, viewSide } from './map-paint';
import { chitImg, usableNow } from './cards';
import { verb } from './prompt';
import { b3, sideOfUnit, unitFace } from './main';

export let piecesBox: 'available' | 'cup' | 'used' | 'eliminated' = 'available',
  piecesTab: 'boxes' | 'arrivals' = 'boxes',
  piecesSide: E.Side | null = null,
  inspectId: string | null = null;
export const setInspectId = <T extends typeof inspectId>(v: T): T => ((inspectId = v), v);
/** A short reading of what a chit does, in the series' own vocabulary; the printed rule is the authority. */

/** A chit's picture; the reusable Special Action is a wooden block (8.1), drawn like the arriving blocks. */
/** Every piece is drawn the same way everywhere: blocks (and the reusable Special Action) as 3D wooden blocks, chits, garrisons and Task Forces as cardboard counters. */
export const chitPic = (c: E.Chit) =>
  c.kind === 'sa_block' ? b3(chitImg(c), c.side) : `<img class="cb" alt="" draggable="false" src="${chitImg(c)}">`;
export const unitPic = (u: E.Unit) =>
  u.garrison ? `<img class="cb" alt="" draggable="false" src="${unitFace(u)}">` : b3(unitFace(u), sideOfUnit(u));
export const pieceBtn = (c: E.Chit, f: () => void, on = false, dis = false) =>
  `<button class="pc ${c.side} ${on ? 'on' : ''} ${c.box === 'available' && usableNow(c) ? 'live' : ''}" data-ui="${reg(f)}" ${dis ? 'disabled' : ''} title="${esc(c.name)}" aria-label="${esc(chitLabel(c))}">${chitPic(c)}</button>`;
const ruleCard = (c: E.Chit) => {
  const [t] = RULE[VOL.ruleKey(c.kind, c)] ?? [c.kind, ''];
  return `<span class="big">${chitPic(c)}</span><div><h4>${esc(c.name)} <small>${esc(t)}</small></h4>${ruleHtml(VOL.ruleKey(c.kind, c), E.isEvent(c))}</div>`;
};
const seatedView = () => online.active && !online.both() && !!online.mySide();
export function piecesHtml() {
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
