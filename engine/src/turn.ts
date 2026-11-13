// The turn: ending a phase and what each phase opens (retreating excess blocks 5.1, river assault markers, draws), the victory table and the final result, who has to act now, and the checks on a move written by the other browser.
import { areas, setPlayArea } from './map';
import { type Side } from './chits';
import { CUR, useGame } from './volumes';
import { coldAreas } from './vol/bulge-setup';
import { autoArrive, drawChits, reinforcementPhase } from './reinforce';
import { endMove } from './moves';
import { settleUp, setupSide } from './battle-setup';
import { eliminate } from './fire';
import { mustFight, retreatPaths } from './battle-end';
import { rollSupply, supplyPhase } from './supply';
import { adminActor } from './admin';
import {
  blocks,
  contested,
  contestedAreas,
  type Game,
  other,
  type Phase,
  say,
  sidesOf,
  stackMax,
  type Unit,
  unitsIn,
  updateControl,
  victory,
} from './game';

/* ================= phase flow ================= */
function retreatExcess(g: Game) {
  for (const side of sidesOf(g))
    for (const a of areas.keys()) {
      const us = blocks(g, a, side).filter((u) => !u.fort && !u.ghost);
      while (us.length > stackMax(g, a)) {
        const u = us.pop()!,
          to = [...retreatPaths(g, a, side, u).keys()][0]; // 6.6 (2016): past full areas to the nearest one with room
        if (to == null) {
          u.str = 0;
          eliminate(g, u);
        } else {
          u.area = to;
          u.disorder = 1;
          CUR.onRetreat?.(g, u, a, to);
          updateControl(g, to);
          say(g, `${u.name} retreats from overstacking to ${areas.get(to)!.name}`);
        }
      }
    }
}
function placeRiverAssaults(g: Game) {
  for (const [a, list] of Object.entries(g.entered)) {
    const area = +a,
      att = blocks(g, area, g.phasing);
    const isAssault = CUR.assault
      ? CUR.assault(g, area, list)
      : att.every((u) => list.some((e) => e.id === u.id && e.river)) && list.some((e) => e.blown);
    if (
      contested(g, area) &&
      !g.contestedAtMoveStart.includes(area) &&
      att.length &&
      isAssault &&
      !g.riverAssault.includes(area) &&
      (CUR.id !== 'bulge' || g.riverAssault.length < 4)
    ) {
      // The Bulge: 4 markers in the counter mix
      g.riverAssault.push(area);
      say(g, `river assault in ${areas.get(area)!.name}`);
    }
  }
  g.entered = {};
  g.riverCross = [];
  g.blowTried = [];
}
export function setDone(g: Game, side: Side, on = true): void {
  if (on && g.phase === 'admin' && side !== g.phasing && g.done?.includes(g.phasing)) return endPhase(g); // 4.2c: the second player's Done ends the Admin Phase
  const d = (g.done ?? []).filter((x) => x !== side);
  if (on) d.push(side);
  g.done = d;
}
export function endPhase(g: Game): void {
  useGame(g.game ?? 'bulge');
  setPlayArea(g.inPlay);
  if (g.phase === 'supply' && g.supplyPending) rollSupply(g);
  endMove(g);
  settleUp(g);
  if (g.over) return;
  if (g.recover.length) throw new Error('choose the assets to recover first (4.1a)');
  if (g.artyPick) throw new Error('the German player must choose the artillery asset lost to attrition first (16.12)');
  if (g.battle) throw new Error('finish the open battle first');
  if (g.pendingBlow) throw new Error('resolve the bridge-blowing attempt first');
  if (mustFight(g).length) throw new Error('newly contested areas must be fought first');
  if (g.phase === 'admin' && !g.done?.includes(g.phasing)) return setDone(g, g.phasing); // 4.2b: the phasing player's end of the Admin Phase hands it to the other player
  g.done = [];
  const ph = g.phase;
  if (ph !== 'supply') CUR.onPhase?.(g, ph, 'end'); // supply's end ran in rollSupply
  if (ph === 'deploy' && CUR.afterDeploy?.(g)) {
    say(g, 'phase start');
    return;
  }
  if (ph === 'deploy') {
    g.phase = 'movement';
    g.phasing = sidesOf(g)[0];
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.contestedAtMoveStart = contestedAreas(g);
    g.stratMoves = 0;
    CUR.onPhase?.(g, 'movement', 'start');
    say(g, 'phase start');
    return;
  }
  g.fieldWorks = g.fieldWorks.filter((a) => {
    const o = g.fwOwner[a];
    return o ? blocks(g, a, o).length > 0 : unitsIn(g, a).some((u) => !u.garrison);
  }); // 5.23: a unit, not a standing asset   // 5.23 gone when no friendly unit is left in the area
  for (const a of Object.keys(g.fwOwner).map(Number)) if (!g.fieldWorks.includes(a)) delete g.fwOwner[a];
  if (ph === 'reinforcement') for (const id of [...g.pendingArrivals]) autoArrive(g, id);
  if (ph === 'admin') g.revealed = null;
  for (const [s, k] of g.markersHeld ?? []) g.markers[s][k]++;
  g.markersHeld = []; // 17.11: a reserve marker lost to a failed Greif check comes back after the phase                                                      // 8.32 revealed only until the end of the Admin Phase
  if (ph === 'movement' || ph === 'btMove') placeRiverAssaults(g);
  if (ph === 'movement' || ph === 'strategic' || ph === 'combat' || ph === 'reaction' || ph === 'btMove' || ph === 'btCombat')
    retreatExcess(g);
  if (ph === 'supply') {
    g.units.forEach((u) => {
      u.exploit = false;
    });
    const [p1, p2] = sidesOf(g),
      N = CUR.sideName;
    if (g.phasing === p1) g.phasing = p2;
    else {
      const v = victory(g),
        sd = g.inPlay ? null : (g.track ?? CUR.track)[g.turn - 1].sd;
      (g.vpHist ??= [])[g.turn - 1] = CUR.vpHist ? CUR.vpHist(g, v) : v.net;
      if (g.opts.scenario === 'cold')
        say(g, `Victory check: the Germans control ${coldAreas(g)} Zone 6 areas (11+ German victory, 10 draw, 9 or less Allied victory)`);
      else
        say(
          g,
          `Victory check: ${N[p1]} ${v[p1]}, ${N[p2]} ${v[p2]}, net ${v.net > 0 ? N[p1] + ' +' + v.net : v.net < 0 ? N[p2] + ' +' + -v.net : '0'}`,
        );
      if (sd && g.turn < g.lastTurn && ((v.net > 0 && v.net >= sd[0]) || (v.net < 0 && -v.net >= sd[1]))) {
        g.over = `Sudden death victory: ${v.net > 0 ? N[p1] : N[p2]} (net ${Math.abs(v.net)})`;
        return;
      }
      if (g.turn >= g.lastTurn) {
        g.over = CUR.finalResult(g, v.net);
        return;
      }
      g.turn++;
      g.phasing = p1;
      g.phase = 'reinforcement';
      reinforcementPhase(g);
      g.units.forEach((u) => {
        u.moved = false;
        u.spent = 0;
      });
      CUR.onPhase?.(g, 'reinforcement', 'start');
      say(g, 'reinforcement phase');
      return;
    }
    g.phase = 'admin';
    CUR.onPhase?.(g, 'admin', 'start');
    drawFor(g);
    return;
  }
  const order: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
  g.phase = order[order.indexOf(ph) + 1];
  if (g.phase === 'admin') {
    CUR.onPhase?.(g, 'admin', 'start');
    drawFor(g);
  }
  if (g.phase === 'movement') {
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.contestedAtMoveStart = contestedAreas(g);
    g.stratMoves = 0;
  }
  if (g.phase === 'strategic')
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
  if (g.phase === 'combat') g.fought = [];
  if (g.phase === 'reaction' || g.phase === 'btMove') {
    g.units.forEach((u) => {
      u.moved = false;
      u.spent = 0;
    });
    g.riverCross = [];
    g.blowTried = [];
    if (g.phase === 'btMove') g.contestedAtMoveStart = contestedAreas(g);
  } // 5.35c: per phase
  if (g.phase === 'btCombat') g.fought = [];
  if (g.phase === 'supply') supplyPhase(g);
  else CUR.onPhase?.(g, g.phase, 'start');
  say(g, 'phase start');
}
function drawFor(g: Game) {
  const [p1, p2] = sidesOf(g),
    i = g.phasing === p1 ? 0 : 1,
    t = (g.track ?? CUR.track)[g.turn - 1];
  const x1 = CUR.extraDraws?.(g, p1) ?? 0,
    x2 = CUR.extraDraws?.(g, p2) ?? 0;
  drawChits(g, p1, t.ge[i] + x1);
  drawChits(g, p2, t.al[i] + x2);
  say(g, `Admin draws: ${CUR.sideName[p1]} ${t.ge[i] + x1}, ${CUR.sideName[p2]} ${t.al[i] + x2}`);
  CUR.afterDraw?.(g);
}
/** The scenario's victory table: [condition, result]; the end of the game picks the matching row. */
export function victoryTable(g: Game): [string, string][] {
  if (g.opts.scenario === 'campaign')
    return [
      ['4+ German VP', 'German Operational Victory'],
      ['1–3 German VP', 'German Marginal Victory'],
      ['0', 'Draw'],
      ['1–3 Allied VP', 'Allied Marginal Victory'],
      ['4+ Allied VP', 'Allied Operational Victory'],
    ];
  if (g.opts.scenario === 'cold')
    return [
      ['11+ Zone 6 areas German', 'German Victory'],
      ['10 areas', 'Draw'],
      ['9 or less areas', 'Allied Victory'],
    ];
  if (g.opts.scenario === 'intro')
    return [
      ['Uncontested Bastogne', 'Decisive Victory'],
      ['More strength in Bastogne (Germans −2 per key area not held; tie: Allies)', 'Marginal Victory'],
    ];
  return [
    ['4+ German VP', 'German Operational Victory'],
    ['2–3 German VP', 'German Marginal Victory'],
    ['0–1 German VP', 'Allied Marginal Victory'],
    ['1+ Allied VP', 'Allied Operational Victory'],
  ];
}
export function finalResult(g: Game, net: number) {
  if (g.opts.scenario === 'campaign')
    return net >= 4
      ? 'German Operational Victory'
      : net >= 1
        ? 'German Marginal Victory'
        : net === 0
          ? 'Draw'
          : net >= -3
            ? 'Allied Marginal Victory'
            : 'Allied Operational Victory';
  return net >= 4
    ? 'German Operational Victory'
    : net >= 2
      ? 'German Marginal Victory'
      : net >= 0
        ? 'Allied Marginal Victory'
        : 'Allied Operational Victory';
}

/* ================= referee-lite: checks on a move written by the other browser ================= */
/** Who has to act now: one side, or both (Prepare phases). */
export function actorOf(g: Game): Side | 'both' {
  if (g.pendingBlow) {
    const u = g.units.find((x) => x.id === g.pendingBlow!.unit);
    return u ? other(u.side) : 'both';
  }
  {
    const s = CUR.pendingSide?.(g);
    if (s) return s;
  }
  const b = g.battle;
  if (b)
    return b.stage === 'setup'
      ? setupSide(g, b)
      : b.stage === 'loss' && b.loss
        ? b.loss.side
        : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage)
          ? other(b.attacker)
          : b.attacker;
  if (g.phase === 'admin') return CUR.adminBoth?.(g) ? 'both' : adminActor(g); // 4.2b/c: the phasing player first, then the other
  if (g.phase === 'reinforcement' || g.phase === 'deploy') return 'both'; // the set-up: each side places its own pieces
  return g.phase === 'reaction' ? other(g.phasing) : g.phasing;
}
const PHASE_ORDER: Phase[] = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
const clock = (g: Game) =>
  g.phase === 'deploy' ? g.turn * 1000 - 1 : g.turn * 1000 + (g.phasing === sidesOf(g)[0] ? 0 : 500) + PHASE_ORDER.indexOf(g.phase);
/** Without a server nobody stops a modified browser from writing a false game; each browser checks what the other one wrote and warns.
 *  `writer` is the side whose account wrote the change (null: an admin or unknown). Returns plain-language problems, empty when all is well. */
export function auditChange(prev: Game, next: Game, writer: Side | null): string[] {
  const out: string[] = [];
  if (isRestore(prev, next)) return []; // a restore is reported on its own (restoreNote)
  if (next.turn === 1 && next.log.length < prev.log.length && clock(next) < clock(prev)) return ['The game was restarted.'];
  if (clock(next) < clock(prev)) out.push(`The game went back from turn ${prev.turn} ${prev.phase} to turn ${next.turn} ${next.phase}.`);
  if (next.rolls < prev.rolls) out.push('The dice counter went backwards: rolls were undone.');
  const a = prev.battle,
    b = next.battle;
  if (a && b && a.area === b.area && JSON.stringify(b.rolls.slice(0, a.rolls.length)) !== JSON.stringify(a.rolls))
    out.push('Dice already rolled in this battle were changed.');
  const actor = actorOf(prev);
  const hid = (u?: Unit) => !!u && u.name === 'Hidden block',
    bare = (g: Game, o: Game) =>
      JSON.stringify({
        ...g,
        log: [],
        revealed: null,
        units: g.units.map((u, i) => (hid(u) || hid(o.units[i]) ? { side: u.side, area: u.area } : u)),
      }); // a hidden block re-coded or hidden again is not a move
  if (writer && actor !== 'both' && actor !== writer && bare(next, prev) !== bare(prev, next))
    out.push(
      `The ${CUR.sideName[writer] ?? writer} player changed the game while it was the ${CUR.sideName[actor] ?? actor} player's turn to act.`,
    );
  return out;
}

/** True when `next` is a restore: the other player's rules check put the game back to the last legal position. */
export const isRestore = (prev: Game, next: Game) => !!next.restored && next.restored.t !== prev.restored?.t;
