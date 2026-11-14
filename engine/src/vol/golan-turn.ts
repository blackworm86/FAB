// FAB Vol. III, Golan '73: supply (9.31, 14.93–14.95), victory (19.x) and the final result, what each phase opens (reinforcements, SAMs, Operation Dugman 5).
import { areas, connection, edgeKey } from '../map';
import { ENTRY, REAR, isAssembly, area as garea } from '../golan/map';
import { type Chit } from '../chits';
import { inSupply, other, rollDie, say, sidesOf, unitsIn, type Game, type Side } from '../game';
import { reservesLeft, setupReserves } from './golan-setup';
import { alowdaCommandos, alowdaDraw, alowdaRaidAreas, NAF, nafakhResult, nafakhStaff, strengthIn, VP_EAST } from './golan-scenarios';
import { isAlOwda, isNafakh, regular, state } from './golan';

/* ================= supply (9.31, 14.93–14.95) and victory (19.x) ================= */
export const sources = (g: Game, side: Side) =>
  new Set(
    isNafakh(g)
      ? NAF.sheet.supply[side]
      : side === 'syrian'
        ? Object.values(ENTRY)
        : [...areas.values()].filter((a) => a.supply).map((a) => a.id),
  ); // 22.46: the sources printed on the Nafakh sheet
export function supplyStep(g: Game, side: Side, a: number, n: number, first: boolean) {
  if (isAssembly(n)) return isNafakh(g) && n === REAR && side === 'syrian'; // the Syrian Rear Area is the Nafakh sheet's Syrian supply source
  const c = connection(a, n)!,
    key = edgeKey(a, n);
  if (c.hermon) return false;
  if (c.river && g.blown.includes(key) && !first) return false; // 9.31a
  if (c.atDitch && !state(g).bridgedDitch.includes(key) && !first) return false; // 14.93
  if (c.escarpment && c.type !== 'road') return false;
  if (side === 'syrian' && state(g).minefields.includes(key)) return false;
  return true;
}
/** 19.1–19.2: Syria scores its objective areas (held, supplied and occupied) and the mutual stars; Israel the mutual stars and each supplied area it holds in Syria; one point per large enemy unit destroyed. */
export function golanVictory(g: Game): Record<Side, number> & { net: number } {
  if (isNafakh(g)) {
    const s = strengthIn(g, 'syrian'),
      i = strengthIn(g, 'israeli');
    return { syrian: s, israeli: i, net: s - i };
  } // 22.47: the score is the strength in Nafakh
  const pts: Record<Side, number> = { syrian: 0, israeli: 0 };
  for (const id of g.elimLarge) {
    const u = g.units.find((x) => x.id === id)!;
    pts[other(u.side)]++;
  }
  for (const a of areas.values()) {
    if (isAssembly(a.id)) continue;
    const ctl = g.control[a.id];
    if (!ctl || !inSupply(g, ctl, a.id)) continue;
    if (ctl === 'syrian' && unitsIn(g, a.id, 'syrian').some(regular)) pts.syrian += a.vp.syrian + (a.vp.mutual ? 1 : 0);
    if (ctl === 'israeli') pts.israeli += (a.vp.mutual ? 1 : 0) + ((isAlOwda(g) ? VP_EAST.has(a.id) : garea(a.id).syria) ? 1 : 0); // 20.38: Al-Owda counts east of its Israeli VP Line, not the Purple Line
  }
  pts.israeli += Math.max(0, (state(g).chem ?? 0) - 1); // chemical warfare after the first use
  return { ...pts, net: pts.syrian - pts.israeli };
}
export const finalResult = (g: Game, net: number) =>
  isNafakh(g)
    ? nafakhResult(g)
    : net === 0
      ? 'Draw (0 net VP)'
      : `${net > 0 ? 'Syrian' : 'Israeli'} ${Math.abs(net) >= 3 ? 'Operational' : 'Marginal'} Victory (${Math.abs(net)} net VP)`;
/** 14.17: west of the Jordan = Gadot, Kfar Hanasi and Almagor. The rule book prints "areas 6, 7, 8"; the map numbers them 6, 9, 10 (docs/NOTES.md). */
export const WEST_OF_JORDAN = [6, 9, 10];
/** 19.5: a supplied Syrian unit west of the Jordan at the end of an Israeli player turn. */
const jordanCrossed = (g: Game) =>
  g.units.some(
    (u) => u.side === 'syrian' && regular(u) && u.area != null && WEST_OF_JORDAN.includes(u.area) && inSupply(g, 'syrian', u.area),
  );

/* ================= phases ================= */
export function onPhase(g: Game, phase: string, when: 'start' | 'mid' | 'end') {
  const V = state(g);
  nafakhStaff(g);
  if (when === 'end' && V.release) throw new Error('Syria first places the units released at the Purple Line (15.2)');
  if (phase === 'reinforcement' && when === 'start') V.minefieldFailed = [];
  if (phase === 'strategic' && when === 'start') V.crossed = []; // each phase counts its own crossings
  if ((phase === 'movement' || phase === 'btMove' || phase === 'reaction') && when === 'start') {
    V.crossed = [];
    V.assaultEntered = {};
    V.withdrew = [];
  }
  if (phase === 'admin' && when === 'start') V.artyInt = [];
  if (phase === 'deploy' && when === 'end' && g.units.some((u) => u.box === 'deploy')) throw new Error('place every unit first');
  if (phase === 'deploy' && when === 'end' && V.minesLeft)
    throw new Error(`place the Israeli minefields first (${V.minesLeft} left, 14.02)`);
  if (phase === 'deploy' && when === 'end')
    for (const sd of sidesOf(g))
      if (setupReserves(g, sd).all && reservesLeft(g, sd))
        throw new Error(`place the ${sd === 'israeli' ? 'Israeli' : 'Syrian'} reserve markers first (${reservesLeft(g, sd)} left)`);
  if (phase === 'deploy' && when === 'end' && alowdaRaidAreas(g).length)
    throw new Error(`land the Syrian commandos first (${alowdaCommandos(g).length} left, 20.35)`);
  if (phase === 'admin' && when === 'end' && V.samTarget)
    throw new Error('Syria must answer the Israeli air mission first: fire a SAM or let it fly (16.12)');
  if (phase === 'admin' && when === 'end') V.intel = undefined;
  if (phase === 'admin' && when === 'start') V.samCancelled = [];
  if (phase === 'supply' && when === 'mid' && g.phasing === 'israeli') {
    // 16.31b: interdiction lasts to the second player's Supply Phase
    g.interdicted = {};
    for (const c of g.chits)
      if (c.mission === 'interdiction' && c.box === 'map') {
        c.box = 'used';
        c.area = undefined;
        c.mission = undefined;
      }
  }
  if (phase === 'supply' && when === 'end' && g.phasing === 'israeli' && !isNafakh(g) && !isAlOwda(g) && jordanCrossed(g))
    g.over = 'Syrian Automatic Victory: a supplied Syrian unit west of the Jordan (19.5)';
}
/** The Reinforcement Phase's Golan extras: the SAM barrier reduction (16.12) and the units released into the Arriving box. */
export function reinforce(g: Game, side: Side) {
  if (side === 'israeli') alowdaDraw(g);
  if (side === 'syrian') {
    const sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'used'),
      rolls = sams.map(() => rollDie(g));
    if (rolls.some((r) => r >= 6)) {
      sams[0].box = 'eliminated';
      samEliminated(g);
      say(g, `SAM reduction rolls ${rolls.join(', ')}: one SAM asset is eliminated (16.12)`, side);
    }
  }
  for (const u of g.units)
    if (u.side === side && u.box === 'arriving') {
      u.box = undefined;
      u.arrival = g.turn;
    }
}
/** 16.23: the first three SAM losses each bring a conditional Israeli air support asset into the cup. */
export function samEliminated(g: Game) {
  const V = state(g);
  if (V.airReleased >= 3) return;
  const c = g.chits.find((x) => x.box === 'air_support_holding');
  if (c) {
    c.box = 'cup';
    V.airReleased++;
  }
}
/** 17.22 Operation Dugman 5: must be played when drawn; one die per Syrian SAM in the Available Box. */
export function resolveDugman(g: Game, c: Chit) {
  c.box = 'eliminated';
  say(g, 'Operation Dugman 5 is played (17.22)', 'israeli');
  if (!g.chits.some((x) => x.kind === 'sam' && x.box === 'available'))
    say(g, 'Dugman 5: no SAM in the Syrian Available Box, no effect', 'israeli');
  for (const sam of g.chits.filter((x) => x.kind === 'sam' && x.box === 'available')) {
    const die = rollDie(g);
    if (die === 1) {
      sam.box = 'eliminated';
      samEliminated(g);
      say(g, `Dugman 5: ${die}, great success: a SAM battery is destroyed`, 'israeli');
    } else if (die <= 3) {
      sam.box = 'cup';
      say(g, `Dugman 5: ${die}, limited success: a SAM goes back into the cup`, 'israeli');
    } else if (die <= 9) say(g, `Dugman 5: ${die}, failure`, 'israeli');
    else {
      const air =
        g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'available') ??
        g.chits.find((x) => x.kind === 'air_mission' && x.side === 'israeli' && x.box === 'cup');
      if (air) air.box = 'eliminated';
      say(g, `Dugman 5: ${die}, a really bad idea: an Israeli air asset is lost`, 'israeli');
    }
  }
}
