// "How your assets are used" (owner, 15 Nov: docs/interaction-audit.md, worked example a): every asset that may do something
// instead of its normal job — remove the field works (6.33, 16.21, 16.22), bridge the AT ditch (Golan 14.51b), support the
// point unit (Golan 18.32) — is one row with the same switch in every game, the timing and requirement written under each half.
import * as E from '../../engine/src';
import { g } from './game-state';
import { mine, act, can, allowed } from './flow';
import { reg } from './ui-kit';
import { esc } from './util';
import { areaName, VOL } from './page';
import { chitPic, unitPic } from './pieces-window';

export interface Use {
  label: string;
  note: string;
  on: boolean;
  fn: (x: E.Game) => void;
  why?: string; // greyed, with the reason
}
export interface UseRow {
  id: string;
  name: string;
  kind: string;
  uses: Use[];
  fw?: boolean; // a field-works remover: only one asset removes them
}

const FIRE_GROUND = 'rolls with the ground units';
/** The rows for the side deciding now; empty when no asset of this battle has a second use. */
export function useRows(): UseRow[] {
  const b = g.battle;
  if (!b || b.stage !== 'setup') return []; // chosen in the assets step only (owner's issue #19)
  const att = b.attacker,
    def = E.other(att),
    fwHere = g.fieldWorks.includes(b.area) && (g.fwOwner[b.area] ?? def) === def,
    out: UseRow[] = [],
    assets = (s: E.Side) => b.assets[s].map((id) => E.chit(g, id));
  if (mine(att)) {
    // 6.33: an engineer (The Bulge, Sicily) removes the field works just before its side fires, if it survives
    const eng = assets(att).find((c) => c.kind === 'engineer');
    if (eng && fwHere && VOL.id !== 'golan73' && ['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage))
      out.push({
        id: eng.id,
        name: eng.name,
        kind: 'Engineer',
        fw: true,
        uses: [
          { label: 'Fire', note: FIRE_GROUND, on: !b.engFw, fn: (x) => E.setEngFw(x, x.battle!, false) },
          {
            label: 'Remove field works',
            note: 'just before your units fire, if it survives artillery and defensive fire (6.33)',
            on: !!b.engFw,
            fn: (x) => E.setEngFw(x, x.battle!, true),
          },
        ],
      });
    if (VOL.id === 'sicily' && b.stage === 'setup') {
      const V = E.sicily.state(g),
        key = `${b.area}`;
      for (const c of assets(att).filter((x) => x.kind === 'naval_support'))
        out.push({
          id: c.id,
          name: c.name,
          kind: 'Naval support',
          fw: true,
          uses: [
            {
              label: 'Fire as artillery',
              note: 'rolls in the artillery step',
              on: V.navalShock[key] !== c.id,
              fn: (x) => E.sicily.setNavalShock(x, x.battle!, null),
            },
            {
              label: 'Remove field works',
              note: 'Shock and Awe: the first act of the battle, instead of firing (16.21)',
              on: V.navalShock[key] === c.id,
              fn: (x) => E.sicily.setNavalShock(x, x.battle!, c.id),
              why: fwHere ? undefined : 'no defending field works here',
            },
          ],
        });
      if (fwHere)
        for (const c of assets(att).filter((x) => x.subtype === 'ranger' || x.subtype === 'commando'))
          out.push({
            id: c.id,
            name: c.name,
            kind: c.subtype === 'ranger' ? 'Rangers' : 'Commando',
            fw: true,
            uses: [
              { label: 'Fire', note: FIRE_GROUND, on: V.rangerFw[key] !== c.id, fn: (x) => E.sicily.setRangerFw(x, x.battle!, null) },
              {
                label: 'Remove field works',
                note: 'instead of its roll, if the attack goes on and it survives defensive fire (16.22)',
                on: V.rangerFw[key] === c.id,
                fn: (x) => E.sicily.setRangerFw(x, x.battle!, c.id),
              },
            ],
          });
    }
    if (VOL.id === 'golan73' && b.stage === 'setup' && att === 'syrian') {
      // 14.51b: a Syrian engineer bridges the AT ditch instead of firing
      const B = E.golan.battleState(b),
        eng = assets(att).find((c) => c.kind === 'engineer');
      const ditch = eng
        ? E.neighbors(b.area).filter(
            (n) => n < 100 && E.connection(b.area, n)?.atDitch && can((x) => E.golan.setEngineerBridge(x, x.battle!, n)),
          )
        : [];
      if (eng && ditch.length)
        out.push({
          id: eng.id,
          name: eng.name,
          kind: 'Engineer',
          uses: [
            { label: 'Fire', note: FIRE_GROUND, on: !B.engBridge, fn: (x) => E.golan.setEngineerBridge(x, x.battle!, null) },
            ...ditch.map((n) => ({
              label: `Bridge the ditch towards ${areaName(n)}`,
              note: 'instead of firing, if it survives both fire steps (14.51b)',
              on: B.engBridge === E.edgeKey(b.area, n),
              fn: (x: E.Game) => E.golan.setEngineerBridge(x, x.battle!, n),
            })),
          ],
        });
    }
  }
  if (VOL.id === 'golan73' && mine('israeli')) {
    // optional 18.32: an Israeli artillery asset supports the point unit instead of firing
    const dcsOn = E.golan.battleState(b).dcs ?? [];
    for (const id of E.golan.directSupportOptions(g)) {
      const c = E.chit(g, id);
      out.push({
        id,
        name: c.name,
        kind: 'Artillery',
        uses: [
          {
            label: 'Fire',
            note: 'rolls in the artillery step',
            on: !dcsOn.includes(id),
            fn: (x) => E.golan.setDirectSupport(x, id, false),
          },
          {
            label: 'Support the point unit',
            note: '+1 to its Success Number, instead of firing (18.32)',
            on: dcsOn.includes(id),
            fn: (x) => E.golan.setDirectSupport(x, id, true),
          },
        ],
      });
    }
  }
  // only one asset removes the field works: the others' "remove" half says who does
  const remover = out.find((r) => r.fw && r.uses[1]?.on);
  if (remover) for (const r of out) if (r.fw && r !== remover && !r.uses[1].why) r.uses[1].why = `already removed by ${remover.name}`;
  return out;
}
/** The rows as the tray shows them: one line per asset, picture, name, one switch; the timing and requirement only in the tooltip (owner's issue #19). */
export function useRowsHtml(rows = useRows()): string {
  if (!rows.length) return '';
  return `<div class="uses usec">${rows
    .map(
      (r) =>
        `<div class="userow"><span class="usepic">${chitPic(E.chit(g, r.id))}</span><b class="usename" title="${esc(r.kind)}">${esc(r.name)}</b><div class="useswitch" role="radiogroup" aria-label="${esc(r.name)}">${r.uses
          .map(
            (u) =>
              `<button role="radio" aria-checked="${u.on}" class="${u.on ? 'on' : ''}" ${u.why && !u.on ? 'disabled' : ''} title="${esc(u.why && !u.on ? u.why : u.note)}" data-ui="${reg(
                () => {
                  if (!u.on) act(() => u.fn(g));
                },
              )}">${u.on ? '✓ ' : ''}${esc(u.label)}</button>`,
          )
          .join('')}</div></div>`,
    )
    .join('')}</div>`;
}

/** Step losses (interaction system, worked example b): the pieces that may take the next loss as big numbered rows, the suggested
 *  one first; the others greyed with the reason. Mirrored on the map by brass glows (pieces.ts). The red bar button takes them all. */
export function lossPieces(): { id: string; name: string; sub: string; ok: boolean; pic: string }[] {
  const b = g.battle;
  if (!b || (b.stage !== 'loss' && b.stage !== 'attFirst')) return [];
  const side = b.stage === 'loss' && b.loss ? b.loss.side : b.attacker,
    okIds = b.stage === 'loss' ? E.lossOptions(g, b) : [b.attPoint, ...b.assets[b.attacker].filter((x) => E.isBattleAsset(E.chit(g, x)))],
    all = [
      ...E.unitsIn(g, b.area, side)
        .filter((u) => !u.garrison)
        .map((u) => u.id),
      ...b.assets[side].filter((x) => E.isBattleAsset(E.chit(g, x))),
    ],
    rows = [...okIds, ...all.filter((id) => !okIds.includes(id))];
  return rows.map((id) => {
    const u = g.units.find((x) => x.id === id),
      ok = okIds.includes(id);
    return u
      ? {
          id,
          name: u.name,
          sub: ok
            ? `${id === b.attPoint || id === b.defPoint ? 'point unit · ' : ''}${u.str} step${u.str > 1 ? 's' : ''} → ${u.str - 1 || 'eliminated'}`
            : 'not yet: everyone takes one before anyone takes a second; the point unit takes the first block loss (6.43)',
          ok,
          pic: unitPic(u),
        }
      : { id, name: E.chit(g, id).name, sub: ok ? 'asset · removed if hit' : 'not yet (6.43)', ok, pic: chitPic(E.chit(g, id)) };
  });
}
export function lossTrayHtml(): string {
  const b = g.battle,
    rows = lossPieces();
  if (!b || !rows.length) return '';
  const n = b.stage === 'loss' ? (b.loss?.left ?? 0) : b.pending,
    first = b.stage === 'attFirst',
    pick = (id: string) => () => act(() => (first ? E.chooseFirstLoss(g, g.battle!, id) : E.chooseLoss(g, g.battle!, id)));
  let k = 0;
  return `<div class="uses losses"><div class="useshd"><b>${first ? 'First loss of the failed attack' : `Step loss · ${n} to place`}</b><small>${first ? 'the point unit or one battle asset (6.41a)' : 'everyone takes one before anyone takes a second (6.43)'}</small></div><div class="lossrows">${rows
    .map((r) =>
      r.ok
        ? `<button class="lossrow" data-ui="${reg(pick(r.id))}" data-loss="${r.id}"><span class="usepic">${r.pic}</span><span class="usename"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span><i class="lossn">${++k}</i></button>`
        : `<button class="lossrow" disabled><span class="usepic">${r.pic}</span><span class="usename"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span><i class="lossn">–</i></button>`,
    )
    .join('')}</div></div>`;
}

/** 6.24 (owner's issue #18): the side that must designate its point unit now, on this screen; null otherwise. The Defender
 *  designates during his set-up, the Attacker after it. With one possible unit the engine sets it, so there is no step. */
export function pointSide(): E.Side | null {
  const b = g.battle;
  if (!b || b.stage !== 'setup' || b.defSA || !allowed()) return null;
  const who = E.setupSide(g, b),
    turn = who === b.attacker ? b.ready?.length === 2 && !b.attPointDone : !b.ready?.includes(who);
  return turn && mine(who) && E.pointChoices(g, b, who).length > 1 ? who : null;
}
/** The point-unit step as big rows, one per unit that may be the point; the chosen one ticked. Mirrored on the map by glows. */
export function pointTrayHtml(): string {
  const b = g.battle,
    side = pointSide();
  if (!b || !side) return '';
  const cur = E.pointPending(g, b, side) ? null : side === b.attacker ? b.attPoint : b.defPoint;
  if (cur && side !== b.attacker) return ''; // the Defender's cards come back once he has chosen; a tap on a block still changes it
  return `<div class="uses losses points"><div class="useshd"><b>Choose your point unit</b><small>it fights first and takes the first hit (6.24, 6.43)</small></div><div class="lossrows">${E.pointChoices(
    g,
    b,
    side,
  )
    .map((id) => {
      const u = g.units.find((x) => x.id === id)!,
        on = id === cur;
      return `<button class="lossrow${on ? ' on' : ''}" aria-pressed="${on}" data-ui="${reg(() => act(() => E.setPoint(g, g.battle!, side, id)))}" data-loss="${id}"><span class="usepic">${unitPic(u)}</span><span class="usename"><b>${esc(u.name)}</b><small>${u.str} step${u.str > 1 ? 's' : ''} · ${E.quality(u)}</small></span><i class="lossn">${on ? '✓' : ''}</i></button>`;
    })
    .join('')}</div></div>`;
}
