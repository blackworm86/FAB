// FAB Vol. II, Sicily: what each phase opens (ports, the At Sea box, Italian morale, the draws), supply by nation (14.9), victory (19.x) and the final result.
import { areas as mapAreas, connection, edgeKey } from '../map';
import { AIRFIELDS, BOX, MESSINA, MUTUAL, isBox, isLandingBox, isPortBox, portBoxes, type Nation } from '../sicily/map';
import { blocks, chit, contested, dropReserve, eliminate, inSupply, other, say, unitsIn, type Game, type Side, type Unit } from '../game';
import { onDeployEnd } from './sicily-setup';
import { inBoxes, syncPortBoxes, toSea } from './sicily-moves';
import { battleAllowed, nameOf, nation, need, regular, SCEN, state } from './sicily';

/* ================= phases ================= */
export function onPhase(g: Game, phase: string, when: 'start' | 'mid' | 'end') {
  const V = state(g);
  if (phase === 'deploy' && when === 'end') onDeployEnd(g);
  if (when === 'start') {
    syncPortBoxes(g);
    V.portWorked = [];
    if (phase === 'admin') V.airCancelled = [];
  }
  if (phase === 'movement' && when === 'start') {
    V.untriedActed = undefined;
    V.beachAssault = {};
    V.evacMp = {};
  }
  if (phase === 'strategic' && when === 'start') V.stratUnit = undefined;
  if (phase === 'movement' && when === 'end') {
    for (const u of inBoxes(g, g.phasing, isLandingBox)) toSea(g, u, 'could not land, 14.24b');
    if (g.phasing === 'allied')
      for (const u of inBoxes(g, g.phasing, isPortBox).filter((x) => !x.reserve)) toSea(g, u, 'could not land, 14.24b'); // the At Sea box is the Allies' (14.24b)
    V.extract = false;
  }
  if (phase === 'btMove' && when === 'end' && g.phasing === 'allied')
    for (const u of inBoxes(g, g.phasing, isPortBox)) {
      const a = BOX.get(u.area!)!.area;
      if (!unitsIn(g, a, 'axis').length && blocks(g, a, 'allied').length < 2) {
        u.area = a;
        dropReserve(g, u);
        say(g, `${u.name} lands in ${nameOf(a)} (14.24c)`);
      } else toSea(g, u, 'the port is full, 14.24c');
    }
  if (phase === 'combat' && when === 'start') {
    V.dropPending = g.phasing === 'allied' && g.units.some((u) => u.box === 'airborne_assault' && u.side === 'allied');
    V.airborneAreas = [];
  }
  if (phase === 'combat' && when === 'end') {
    need(!V.dropPending, 'place the airborne units first (14.27a)');
    V.airborneAreas = [];
    V.beachAssault = {};
  }
  if (phase === 'admin' && when === 'end')
    need(
      !V.moralePick || !Object.values(V.moralePick).some((n) => n > 0),
      'pick the Italian assets eliminated by Fading Italian Morale first (17.21c)',
    );
  if (phase === 'admin' && when === 'end')
    need(
      !Object.keys(V.flank).some((a) => battleAllowed(g, +a) && contested(g, +a) && !g.fought.includes(+a)),
      'the flanking invasion landed on defenders: fight its round of combat first (17.22)',
    );
  if (phase === 'reinforcement' && when === 'start') afterChange(g); // 14.22: a beachhead lost in the other player's turn is gone before the arrivals
  if (phase === 'supply' && when === 'mid') {
    for (const u of g.units.filter((x) => x.untried && x.side === g.phasing && x.area != null && x.unsupplied)) {
      /* only when its own OOS morale check is due */ say(
        g,
        `${u.name} is out of supply: untried units are eliminated instead of checking morale (15.3c)`,
      );
      eliminate(g, u);
    }
    for (const c of g.chits)
      if (c.mission === 'interdiction' && c.box === 'map') {
        c.box = 'used';
        if (c.area != null) delete g.interdicted[c.area];
        c.area = undefined;
        c.mission = undefined;
      } // 16.33: to the Supply Phase of the same player turn
  }
  if (phase === 'supply' && when === 'end' && g.airSupply) {
    chit(g, g.airSupply.id).box = 'used';
    g.airSupply = null;
  } // 16.34: to the Used Box at the end of that Supply Phase
  if (when === 'end') afterChange(g);
}
/** What control changes trigger: lost beachheads (14.22), captured airfields (16.4), Fading Italian Morale (17.21a). */
export function afterChange(g: Game) {
  const V = state(g);
  if (g.turn >= 2)
    for (const b of Object.keys(V.beachheads).map(Number)) {
      const a = BOX.get(b)!.area;
      if (g.control[a] === 'axis' && !contested(g, a)) captureBeachhead(g, b, 'destroyed: its coastal area is Axis-controlled (14.22)');
    }
  for (const a of AIRFIELDS)
    if (g.control[a] === 'allied' && !V.airfieldsTaken.includes(a) && (!g.inPlay || g.inPlay.includes(a))) {
      V.airfieldsTaken.push(a);
      const c = g.chits.find((x) => x.box === 'captured_airfields');
      if (c) {
        c.box = 'cup';
        V.airfieldHoles++;
        say(
          g,
          `The ${nameOf(a)} airfield is captured: a conditional Air Support asset goes into the Allied cup; the next Axis Air Support drawn fills the empty box (16.4)`,
          'allied',
        );
      }
    }
  if (V.sunrise) return;
  for (const a of MUTUAL)
    if (g.control[a] === 'allied' && !V.triggered.includes(`vp${a}`)) {
      V.triggered.push(`vp${a}`);
      moraleTrigger(g, `${nameOf(a)} captured`);
    }
  for (const p of portBoxes)
    if (p.box !== 'P4' && g.control[p.area] === 'allied' && V.portDamage[p.box] === 0 && !V.triggered.includes(p.box)) {
      /* the three Sicilian ports (Example 10), not Messina */ V.triggered.push(p.box);
      moraleTrigger(g, `the port of ${p.name} is Allied and undamaged`);
    }
}
export function captureBeachhead(g: Game, b: number, why: string) {
  const V = state(g);
  delete V.beachheads[b];
  V.captured.push(b);
  delete g.control[b];
  for (const u of unitsIn(g, b)) toSea(g, u, 'the beachhead is lost');
  say(g, `Beachhead ${BOX.get(b)!.box} ${why}: one VP to the Axis (19.2)`, 'axis');
}
function moraleTrigger(g: Game, why: string) {
  const V = state(g),
    c = g.chits.find((x) => x.box === 'captured_ports_vp');
  if (!c) return;
  c.box = 'cup';
  V.moraleCup++;
  say(g, `${why}: a Fading Italian Morale event goes into the Allied cup (17.21a)`, 'allied');
}
/** The Reinforcement Phase draw rule of 17.32 is in the series draw; 16.4: an Axis air asset just drawn fills an empty Captured Airfields box. */
export function afterDraw(g: Game) {
  const V = state(g);
  if (!V.airfieldHoles) return;
  const stamp = g.turn * 10 + (g.phasing === 'allied' ? 1 : 2);
  for (const c of g.chits.filter((x) => x.kind === 'air_mission' && x.side === 'axis' && x.box === 'available' && x.drawn === stamp)) {
    if (!V.airfieldHoles) break;
    c.box = 'captured_airfields';
    V.airfieldHoles--;
    say(g, `${c.name} fills the empty Captured Airfields box (16.4)`, 'axis');
  }
}
/** 16.5: one extra Allied draw per undamaged Sicilian port the Allies control and occupy. */
export const extraDraws = (g: Game, side: Side) =>
  side !== 'allied' || state(g).sunrise
    ? 0
    : portBoxes.filter(
        (p) =>
          g.control[p.area] === 'allied' &&
          unitsIn(g, p.area, 'allied').some(regular) &&
          p.box !== 'P4' &&
          state(g).portDamage[p.box] === 0,
      ).length; // 16.5: Syracuse, Catania, Palermo only

/* ================= supply (14.9) and victory (19.x) ================= */
let NATION_FILTER: Nation | null = null;
export function sources(g: Game, side: Side): Set<number> {
  const V = state(g);
  if (side === 'axis') return new Set(V.sunrise ? (SCEN(g).supply?.axis_areas ?? []) : [MESSINA]);
  const bh = Object.keys(V.beachheads)
    .map(Number)
    .filter((b) => !NATION_FILTER || V.beachheads[b] === NATION_FILTER);
  const ports = portBoxes
    .filter((p) => (p.box === 'P4' || V.portDamage[p.box] === 0) && (!g.inPlay || g.inPlay.includes(p.area)))
    .map((p) => p.area);
  return new Set([...bh, ...ports]);
}
export function supplyStep(g: Game, _side: Side, a: number, n: number, first: boolean) {
  if (isBox(a) && !first) return false; // a path never runs through a box
  if (isPortBox(n)) return false;
  const c = connection(a, n)!;
  return !(c.river && g.blown.includes(edgeKey(a, n)) && !first); // 9.31a
}
/** 14.92: an Allied unit traces to a beachhead of its own nationality or any friendly undamaged port. */
export function unitSupply(g: Game, u: Unit) {
  if (u.side === 'axis') return inSupply(g, 'axis', u.area!);
  NATION_FILTER = nation(u);
  try {
    return inSupply(g, 'allied', u.area!);
  } finally {
    NATION_FILTER = null;
  }
}
export function sicilyVictory(g: Game): Record<Side, number> & { net: number } {
  const V = state(g),
    S = SCEN(g),
    pts: Record<Side, number> = { allied: 0, axis: 0 };
  if (V.sunrise) {
    for (const [a, v] of Object.entries(S.victory.area_vp ?? {})) {
      const c = g.control[+a];
      if (c) pts[c] += v;
    } // 22.17: control, contested or not
    return { ...pts, net: pts.allied - pts.axis };
  }
  for (const a of mapAreas.values()) {
    if (isBox(a.id)) continue;
    const c = g.control[a.id];
    if (!c || !inSupply(g, c, a.id)) continue;
    if (c === 'allied' && unitsIn(g, a.id, 'allied').some(regular)) pts.allied += a.vp.allied + (a.vp.mutual ? 1 : 0); // 19.1: crosses and yellow stars, occupied
    if (c === 'axis') pts.axis += a.vp.german + (a.vp.mutual ? 1 : 0); // white and yellow stars
  }
  for (const id of g.elimLarge) {
    const u = g.units.find((x) => x.id === id)!;
    pts[other(u.side)]++;
  } // 19.2
  pts.axis += V.captured.length;
  return { ...pts, net: pts.allied - pts.axis };
}
export function finalResult(g: Game, net: number) {
  const S = SCEN(g);
  if (state(g).sunrise)
    return net > 0 ? `Allied Victory (${net} net VP, 22.17)` : net < 0 ? `Axis Victory (${-net} net VP, 22.17)` : 'Draw (22.17)';
  if (S.victory.axis_win_at != null)
    return -net >= S.victory.axis_win_at
      ? `Axis Victory (Axis ahead by ${-net} VP, 22.28)`
      : `Allied Victory (${net >= 0 ? `Allies ahead by ${net}` : `Axis ahead by only ${-net}`} VP, 22.28)`; // 19.3: the VP level
  const n = Math.abs(net);
  if (!n) return 'Draw (22.38)';
  return `${net > 0 ? 'Allied' : 'Axis'} ${n >= (S.victory.levels?.operational ?? 4) ? 'Operational' : 'Marginal'} Victory (${n} net VP, 22.38)`;
}
