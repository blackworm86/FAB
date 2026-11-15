import { it } from 'vitest';
import * as E from '../src';
import { newGolanGame } from './golan-helpers';

const show = (g: E.Game, tag: string) => {
  const [p, q] = E.sidesOf(g);
  const v = E.victory(g);
  console.log(
    `${tag}: victory ${JSON.stringify(v)} | ${p} areas ${JSON.stringify(E.vpAreas(g, p))} | ${q} areas ${JSON.stringify(E.vpAreas(g, q))} | elim ${g.elimLarge.length} | note ${E.vpNote(g)}`,
  );
};
const finals = (g: E.Game, nets: number[]) => nets.map((n) => `${n}:${E.VOLUME.finalResult(g, n)}`).join(' | ');

it('bulge', () => {
  for (const sc of ['tournament', 'campaign', 'intro', 'cold']) {
    E.useGame('bulge');
    const g = E.newGame(1, { scenario: sc as 'tournament', fuel: true });
    console.log(`\n=== bulge ${sc} lastTurn ${g.lastTurn} phase ${g.phase} track sd ${JSON.stringify((g.track ?? E.VOLUME.track).slice(0, g.lastTurn).map((t) => t.sd))}`);
    show(g, 'start');
    if (sc === 'cold') console.log('coldAreas', E.coldAreas(g));
    console.log('table', JSON.stringify(E.victoryTable(g)));
    console.log('finals', finals(g, [-5, -4, -3, -1, 0, 1, 2, 3, 4, 5]));
    // control changes: Allies take Prum (2 VP), Germans take Bastogne
    if (sc === 'tournament' || sc === 'campaign') {
      g.control[4] = 'allied';
      show(g, 'Allied holds Prum(4) (no unit, supply?)');
      g.control[4] = 'german';
      g.control[47] = 'german';
      show(g, 'German holds Bastogne(47)');
      g.control[58] = 'german';
      show(g, 'German holds Liege(58)');
    }
  }
});

it('golan', () => {
  for (const sc of ['badr', 'badr_alt', 'nafakh', 'alowda']) {
    const g = newGolanGame(1, sc as 'badr');
    console.log(`\n=== golan ${sc} lastTurn ${g.lastTurn} phase ${g.phase} track sd ${JSON.stringify((g.track ?? E.VOLUME.track).slice(0, g.lastTurn).map((t) => t.sd))}`);
    show(g, 'start');
    console.log('engine victoryTable (web skips for golan)', JSON.stringify(E.victoryTable(g)));
    console.log('finals', finals(g, [-4, -3, -2, -1, 0, 1, 2, 3, 4]));
    const syArea = [...E.areas.values()].filter((a) => g.control[a.id] === 'israeli' && E.golan.isAssembly && !E.golan.isAssembly(a.id)).length;
    console.log('israeli-controlled areas', syArea);
    if (sc === 'badr' || sc === 'alowda') {
      // Syria takes Gonen (2 VP) without a unit, then with a unit
      g.control[4] = 'syrian';
      show(g, 'Syria controls Gonen(4), no unit');
      const u = g.units.find((x) => x.side === 'syrian' && x.area != null && !x.garrison)!;
      const was = u.area;
      u.area = 4;
      show(g, `Syria controls Gonen(4), unit ${u.id} there`);
      u.area = was;
      g.control[4] = 'israeli';
      // Israel takes an area in Syria (east of Purple Line)
      const east = [...E.areas.values()].find((a) => (E.golan as any).area?.(a.id)?.syria && g.control[a.id] === 'syrian' && !E.unitsIn(g, a.id).length);
      if (east) {
        g.control[east.id] = 'israeli';
        show(g, `Israel controls ${east.name}(${east.id}) in Syria`);
      }
    }
  }
});
