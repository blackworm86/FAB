/** Actions that cross the wire: a call is an engine function name plus its arguments (without the game; the battle travels as a marker).
 *  The server replays them on the one full game state, so no client ever needs the other side's hidden blocks. */
import * as G from './game';
import type { Game, Side } from './game';

export const MUTATORS = ['recoverAsset', 'autoRecover', 'placeTaskForce', 'setReserve', 'move', 'resolveBlow', 'stratMove', 'blowBridges', 'repairBridge', 'fieldWorksFor', 'playReplacement', 'playRebuild', 'alternateUse', 'rally', 'qualityReplacement',
  'staffReplacement', 'staffReserve', 'releaseUnit', 'playGreifBridge', 'playInterdict', 'playBodenplatte', 'heydteDrop', 'buildFieldWorks', 'startBattle', 'assign', 'unassign', 'beginCombat', 'setReady', 'cancelBattle', 'roll_step', 'chooseFirstLoss',
  'attackerChoice', 'defenderChoice', 'chooseRetreat', 'closeBattle', 'defenderRetreatSA', 'defenderReinforceSA', 'activateBreakthrough', 'endPhase', 'roadblock', 'staffBoundary', 'staffPool', 'staffIntel', 'playInterdiction', 'playAirSupply', 'reroute',
  'placeArrival', 'setPoint', 'setEngFw'] as const;
export type Call = { fn: string; args: unknown[] };
export const BATTLE_MARK = { $battle: 1 };

/** Who may act right now: one side, or both while each handles its own pieces (admin, reinforcement, battle set-up). */
export function actorNow(g: Game): Side | 'both' {
  if (g.pendingBlow) return G.other(g.units.find((x) => x.id === g.pendingBlow!.unit)!.side);
  const b = g.battle;
  if (b) return b.stage === 'setup' ? 'both' : ['defArty', 'defFire', 'defChoice', 'retreat'].includes(b.stage) ? G.other(b.attacker) : b.attacker;
  if (g.phase === 'admin' || g.phase === 'reinforcement') return 'both';
  return g.phase === 'reaction' ? G.other(g.phasing) : g.phasing;
}

/** Phases with nothing to do are skipped for the player. */
export function idle(g: Game): boolean {
  const p = g.phasing, o = G.other(p), us = (s: Side) => g.units.filter((u) => u.side === s && u.area != null && !u.garrison);
  switch (g.phase) {
    case 'reinforcement': return !g.tfNew.length && !g.pendingArrivals.length && !g.recover.length;
    case 'strategic': return !us(p).some((u) => u.reserve);
    case 'combat': case 'btCombat': return !G.contestedAreas(g).filter((a) => !g.fought.includes(a)).length;
    case 'reaction': return !us(o).some((u) => u.reserve);
    case 'btMove': return !us(p).some((u) => (u.reserve || u.exploit) && !u.moved) && !(us(p).some((u) => u.cls === 'armor' && !u.moved) && G.saAvailable(g, p).length);
    case 'supply': return true;
    default: return false;
  }
}
export function autoAdvance(g: Game) { for (let i = 0; i < 12 && !g.over && !g.battle && !g.pendingBlow && idle(g); i++) { try { G.endPhase(g); } catch { break; } } }

const ownerOf = (g: Game, id: unknown): Side | null => { if (typeof id !== 'string') return null; return g.chits.find((c) => c.id === id)?.side ?? g.units.find((u) => u.id === id)?.side ?? null; };
/** The seat that sent the call must be allowed to make it: it is that side's turn or step, and the pieces named are its own. */
export function authorize(g: Game, c: Call, caller: Side) {
  if (!(MUTATORS as readonly string[]).includes(c.fn)) throw new Error(`unknown action ${c.fn}`);
  const a0 = c.args[0], mark = (x: unknown) => typeof x === 'object' && x !== null && '$battle' in x;
  const first = mark(a0) ? c.args[1] : a0;
  if (c.fn === 'setReady' || c.fn === 'setPoint') { if (c.args[1] !== caller) throw new Error('not your seat'); return; }
  if (c.fn === 'recoverAsset' && a0 !== caller) throw new Error('not your seat');
  if (c.fn === 'recoverAsset' || c.fn === 'rally') { if (a0 !== caller && c.fn === 'rally') throw new Error('not your seat'); return; }
  if (c.fn === 'assign' || c.fn === 'unassign') { if (ownerOf(g, first) !== caller) throw new Error('that piece is not yours'); return; }
  const act = actorNow(g);
  if (act !== 'both' && act !== caller) throw new Error(`wait for the ${act} player`);
  if (c.fn !== 'resolveBlow' && c.fn !== 'startBattle') { const o = ownerOf(g, first); if (o && o !== caller) throw new Error('that piece is not yours'); }
}

/** Replays calls on `g`. Throws on the first illegal call; the caller keeps the unchanged state in that case. */
export function applyCalls(g: Game, calls: Call[], caller: Side) {
  for (const c of calls) {
    authorize(g, c, caller);
    const args = c.args.map((x) => (typeof x === 'object' && x !== null && '$battle' in x ? g.battle : x));
    if (args.some((x) => x === null && c.fn !== 'startBattle')) throw new Error('no battle open');
    (G as unknown as Record<string, (...a: unknown[]) => unknown>)[c.fn](g, ...args);
  }
  autoAdvance(g);
}

/* ---------- the pure core of the server: no database in here, so it can be tested ---------- */
import { redactFor, unalias, type Viewer } from './redact';
export interface Views { german: string; allied: string; public: string }
/** What each seat (and a spectator) is sent: the redacted game as JSON, log trimmed to the last 120 lines. */
export function viewsOf(full: Game, salt: string): Views {
  const one = (v: Viewer) => { const g = redactFor(full, v, salt); g.log = g.log.slice(-120); return JSON.stringify(g); };
  return { german: one('german'), allied: one('allied'), public: one('spectator') };
}
export function startFull(opts: Partial<G.Opts>, seed = Math.floor(Math.random() * 1e9)): Game { return G.newGame(seed, opts); }
/** Replays a seat's calls on the full state. Returns the new full state and the views, or throws (nothing is changed). */
export function processAction(fullJson: string, salt: string, caller: Side, calls: Call[]): { full: string; views: Views } {
  const g = JSON.parse(fullJson) as Game, real = (unalias(g, salt, calls) as Call[]);
  if (!Array.isArray(real) || real.length === 0 || real.length > 40) throw new Error('bad request');
  applyCalls(g, real, caller);
  return { full: JSON.stringify(g), views: viewsOf(g, salt) };
}
