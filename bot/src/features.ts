// About 50 readable facts about a Bulge position, as one seat sees it (hidden enemy blocks count as average
// blocks). The learned judge (judge.ts) weighs them to guess who wins. Every fact is a plain number with a name.
import * as E from '../../engine/src';
import type { Game, Side, Unit } from '../../engine/src';

const HIDDEN_STEPS = 2.5;
const SIDES: Side[] = ['german', 'allied'];
const PHASES = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];

const stepsOf = (us: Unit[]) => us.reduce((t, u) => t + (E.isPlaceholder(u) ? HIDDEN_STEPS : u.str), 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Map steps from every area to the nearest of `from`. */
function distances(g: Game, from: number[]): Map<number, number> {
  const d = new Map(from.map((a) => [a, 0])),
    q = [...from];
  for (let i = 0; i < q.length; i++)
    for (const n of E.neighbors(q[i]))
      if (!d.has(n) && (!g.inPlay || g.inPlay.includes(n))) {
        d.set(n, d.get(q[i])! + 1);
        q.push(n);
      }
  return d;
}

export function features(g: Game, seat: Side): Record<string, number> {
  E.useGame(g.game ?? 'bulge');
  E.setPlayArea(g.inPlay);
  const f: Record<string, number> = {},
    v = E.victory(g),
    row = (g.track ?? E.TRACK)[g.turn - 1],
    sd = g.inPlay ? null : row?.sd;
  const all = [...E.areas.keys()].filter((a) => !g.inPlay || g.inPlay.includes(a)),
    area = (a: number) => E.areas.get(a)!;
  f.turn = g.turn;
  f.turnsLeft = g.lastTurn - g.turn;
  f.phase = PHASES.indexOf(g.phase) / 8;
  f.germanPhasing = +(g.phasing === 'german');
  f.seatGerman = +(seat === 'german');
  f.vpGerman = v.german ?? 0;
  f.vpAllied = v.allied ?? 0;
  f.vpNet = v.net;
  f.suddenDeathGapGerman = sd ? v.net - sd[0] : -10;
  f.suddenDeathGapAllied = sd ? -v.net - sd[1] : -10; // 0 or more: that side wins now if the turn ended
  for (const s of SIDES) {
    const p = s === 'german' ? 'g_' : 'a_',
      on = g.units.filter((u) => u.side === s && u.area != null && !u.garrison),
      avail = E.boxOf(g, s, 'available');
    const kind = (...k: string[]) => avail.filter((c) => k.includes(c.kind)).length;
    f[p + 'steps'] = stepsOf(on);
    f[p + 'blocks'] = on.length;
    f[p + 'hidden'] = on.filter(E.isPlaceholder).length;
    f[p + 'armorSteps'] = sum(on.filter((u) => !E.isPlaceholder(u) && u.cls === 'armor').map((u) => u.str));
    f[p + 'unsupplied'] = on.filter((u) => u.unsupplied).length;
    f[p + 'disordered'] = on.filter((u) => u.disorder).length;
    f[p + 'reserves'] = on.filter((u) => u.reserve).length;
    f[p + 'exploiting'] = on.filter((u) => u.exploit).length;
    f[p + 'eliminated'] = g.units.filter((u) => u.side === s && u.area == null && u.str === 0).length;
    f[p + 'toArrive'] = g.units.filter((u) => u.side === s && u.area == null && u.str > 0).length;
    f[p + 'artillery'] = kind('artillery', 'rocket_artillery');
    f[p + 'engineers'] = kind('engineer');
    f[p + 'battleAssets'] = kind('armor_asset', 'infantry_asset');
    f[p + 'air'] = kind('air_mission');
    f[p + 'specialActions'] = kind('sa_block', 'special_action_event');
    f[p + 'fuel'] = kind('fuel');
    for (const z of [5, 6, 7]) f[`${p}stepsZone${z}`] = stepsOf(on.filter((u) => area(u.area!).zone === z));
  }
  const held = (s: Side, test: (a: number) => boolean) => all.filter((a) => test(a) && g.control[a] === s).length;
  f.germanGoalsHeld = held('german', (a) => area(a).vp.german > 0);
  f.sharedGoalsGerman = held('german', (a) => area(a).vp.mutual);
  f.sharedGoalsAllied = held('allied', (a) => area(a).vp.mutual);
  f.germanHomeAllied = held('allied', (a) => area(a).vp.allied > 0);
  f.contested = E.contestedAreas(g).length;
  f.contestedGoals = E.contestedAreas(g).filter((a) => worth(area(a))).length;
  const ger = g.units.filter((u) => u.side === 'german' && u.area != null && !u.garrison),
    dist = distances(
      g,
      all.filter((a) => area(a).vp.german > 0 || (area(a).vp.mutual && area(a).zone === 7)),
    );
  const ds = ger.map((u) => dist.get(u.area!) ?? 20).sort((a, b) => a - b);
  f.germanNearestGoal = ds[0] ?? 20;
  f.germanThreeNearestGoal = ds.length ? sum(ds.slice(0, 3)) / Math.min(3, ds.length) : 20;
  const front = (s: Side) =>
    g.units.filter((u) => u.side === s && u.area != null && E.neighbors(u.area).some((n) => E.unitsIn(g, n, E.other(s)).length)).length;
  f.germanBlocksInContact = front('german');
  f.alliedBlocksInContact = front('allied');
  return f;
}
const worth = (a: E.Area) => a.vp.german > 0 || a.vp.allied > 0 || a.vp.mutual;
