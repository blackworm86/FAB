// "How your assets are used" (owner, 15 Nov: docs/interaction-audit.md, worked example a): every asset that may do something
// instead of its normal job — remove the field works (6.33, 16.21, 16.22), bridge the AT ditch (Golan 14.51b), support the
// point unit (Golan 18.32) — is one row with the same switch in every game, the timing and requirement written under each half.
import * as E from '../../engine/src';
import { g } from './game-state';
import { mine, act, can } from './flow';
import { reg } from './ui-kit';
import { esc } from './util';
import { areaName, VOL } from './page';
import { chitPic } from './pieces-window';

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
  if (!b) return [];
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
/** The rows as the tray shows them: picture, name, one switch. */
export function useRowsHtml(rows = useRows()): string {
  if (!rows.length) return '';
  return `<div class="uses"><div class="useshd"><b>How your assets are used</b><small>${rows.some((r) => r.fw) ? 'one asset may remove the field works; the others fire' : 'tap the half you want'}</small></div>${rows
    .map(
      (r) =>
        `<div class="userow"><span class="usepic">${chitPic(E.chit(g, r.id))}</span><span class="usename"><b>${esc(r.name)}</b><small>${esc(r.kind)}</small></span><div class="useswitch" role="radiogroup" aria-label="${esc(r.name)}">${r.uses
          .map(
            (u) =>
              `<button role="radio" aria-checked="${u.on}" class="${u.on ? 'on' : ''}" ${u.why && !u.on ? 'disabled' : ''} data-ui="${reg(
                () => {
                  if (!u.on) act(() => u.fn(g));
                },
              )}"><b>${u.on ? '✓ ' : ''}${esc(u.label)}</b><small>${esc(u.why && !u.on ? u.why : u.note)}</small></button>`,
          )
          .join('')}</div></div>`,
    )
    .join('')}</div>`;
}
