// 4.5: every Play Book figure names real areas, real boundaries, real units of its game and the example's own lettered steps.
import { describe, expect, it } from 'vitest';
import * as E from '../../engine/src';
import type { FigSpec } from '../src/figures';
import bulgeF from '../../data/bulge/figures.json';
import golanF from '../../data/golan73/figures.json';
import sicilyF from '../../data/sicily/figures.json';
import bulgeR from '../../data/bulge/rules.json';
import golanR from '../../data/golan73/rules.json';
import sicilyR from '../../data/sicily/rules.json';

type R = { books: { sections: { id: string; paras: string[] }[] }[] };
const GAMES: [string, Record<string, FigSpec>, R][] = [
  ['bulge', bulgeF as Record<string, FigSpec>, bulgeR as R],
  ['golan73', golanF as Record<string, FigSpec>, golanR as R],
  ['sicily', sicilyF as Record<string, FigSpec>, sicilyR as R],
];

describe.each(GAMES)('%s example figures', (game, figs, rules) => {
  it('each figure is consistent with the map, the units and its example', () => {
    E.useGame(game);
    E.setPlayArea(null);
    const units = new Set((E.VOLUMES[game].units as { id: string }[]).map((u) => u.id)),
      secs = new Map(rules.books.flatMap((b) => b.sections).map((s) => [s.id, s]));
    const problems: string[] = [];
    for (const [id, f] of Object.entries(figs)) {
      const p = (m: string) => problems.push(`${id}: ${m}`),
        area = (a: number | null | undefined, w: string) => {
          if (a != null && !E.areas.has(a)) p(`${w}: no area ${a}`);
        };
      const sec = secs.get(id);
      if (!sec) {
        p('no such section in the rulebook');
        continue;
      }
      const letters = new Set(
        sec.paras.map((x) => /^\*\*([A-Za-z])\s*(?:[—–-]|\)\s*\*\*|\*\*\s*\))/.exec(x)?.[1]?.toUpperCase()).filter(Boolean),
      );
      f.view.forEach((a) => area(a, 'view'));
      if (f.view.length < 2) p('view needs two areas or more');
      for (const [k, pc] of Object.entries(f.pieces)) {
        if (pc.unit && !units.has(pc.unit)) p(`piece ${k}: no unit ${pc.unit}`);
        if (!pc.unit && !pc.label) p(`piece ${k}: a unit or a label`);
      }
      const edge = (e: [number, number], w: string) => {
        area(e[0], w);
        area(e[1], w);
        if (!E.connection(e[0], e[1])) p(`${w}: ${e[0]} and ${e[1]} do not touch`);
      };
      for (const m of f.markers ?? []) {
        if (m.edge) edge(m.edge, `marker ${m.kind}`);
        area(m.area, `marker ${m.kind}`);
      }
      if (!f.steps.length || f.steps[0].tab !== 'Set-up') p('the first step is the Set-up');
      for (const s of f.steps) {
        if (s.tab !== 'Set-up' && !letters.has(s.tab)) p(`step ${s.tab}: the example has no paragraph ${s.tab}`);
        if (!s.cap?.trim()) p(`step ${s.tab}: no caption`);
        for (const [k, a] of Object.entries(s.at ?? {})) {
          if (!f.pieces[k]) p(`step ${s.tab}: unknown piece ${k}`);
          area(a, `step ${s.tab} ${k}`);
        }
        for (const k of Object.keys(s.str ?? {})) if (!f.pieces[k]) p(`step ${s.tab}: unknown piece ${k}`);
        for (const mv of s.moves ?? []) {
          mv.path.forEach((a) => area(a, `step ${s.tab} move`));
          if (mv.kind !== 'air')
            for (let i = 1; i < mv.path.length; i++)
              if (!E.connection(mv.path[i - 1], mv.path[i])) p(`step ${s.tab}: move ${mv.path[i - 1]}→${mv.path[i]} is not a boundary`);
        }
        for (const e of s.fail ?? []) edge(e, `step ${s.tab} fail`);
        for (const a of s.ring ?? []) area(a, `step ${s.tab} ring`);
        for (const m of s.marks ?? []) {
          if (m.edge) edge(m.edge, `step ${s.tab} marker`);
          area(m.area, `step ${s.tab} marker`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
