/** 4.1 The replay journal: what a finished game is replayed from. After every change the game records the shared part of the step
 *  (turn, phase, the log lines and dice since the last step, the VP) and, separately, where each side's blocks stand. Online, each seat
 *  writes only its own blocks (it knows nothing else) and the database lets nobody read the journal before the game is over; a local
 *  table keeps everything in this browser. The replay puts the pieces back together step by step. */
import * as E from '../../engine/src';

export type JUnits = Record<string, [number, number]>;                 // block id: [area, strength]
export type JDice = [string, number, number[]];                         // who fired, success number, the dice
export interface JPub { t: number; ph: string; side: string; msg: string[]; vp: [number, number]; fx?: number | null; dice?: JDice[]; over?: string }
export interface JEntry { at: number; d: string }
export interface RStep { pub: JPub; units: JUnits }

/** Where `side`'s blocks stand (every side when null): blocks on the map with their strength. */
export const unitsOf = (g: E.Game, side: E.Side | null): JUnits =>
  Object.fromEntries(g.units.filter((u) => u.area != null && u.str > 0 && (side == null || u.side === side)).map((u) => [u.id, [u.area!, u.str]]));

/** Follows the game and says what is new since the last step it saw: the log lines and the dice of the battle on the table. */
export class Recorder {
  private log = 0; private battle = ''; private rolls = 0; units = '';
  constructor(private sides: [E.Side, E.Side]) {}
  /** The shared part of a step, and the counters moved on. */
  pub(g: E.Game): JPub {
    const msg = g.log.slice(Math.min(this.log, g.log.length)).slice(-5).map((l) => l.replace(/^T\d+ (\[\w+\] )?/, '').slice(0, 220));
    const b = g.battle, key = b ? `${b.area}` : '', from = key === this.battle ? this.rolls : 0;
    const dice: JDice[] = b ? b.rolls.slice(from).map((r) => [r.who, r.sn, r.dice] as JDice) : [];
    let vp: [number, number] = [0, 0]; try { const v = E.victory(g) as unknown as Record<string, number>; vp = [v[this.sides[0]] ?? 0, v[this.sides[1]] ?? 0]; } catch { /* no score yet */ }
    this.seen(g);
    return { t: g.turn, ph: g.phase, side: g.phasing, msg, vp, fx: b?.area ?? null, ...(dice.length ? { dice } : {}), ...(g.over ? { over: g.over } : {}) };
  }
  /** The other player's change: nothing to write, but what it showed is no longer new. */
  seen(g: E.Game) { this.log = g.log.length; this.battle = g.battle ? `${g.battle.area}` : ''; this.rolls = g.battle?.rolls.length ?? 0; }
}

/** A local table's journal, kept in this browser. */
export const localJournal = {
  read(key: string): { at: number; pub: JPub; units: JUnits }[] { try { return JSON.parse(localStorage.getItem(`fab-journal:${key}`) ?? '[]'); } catch { return []; } },
  add(key: string, pub: JPub, units: JUnits) {
    const j = this.read(key); if (pub.t === 1 && j.length && j.at(-1)!.pub.t > 1) j.length = 0;        // a new game on the same table starts a new journal
    j.push({ at: Date.now(), pub, units }); try { localStorage.setItem(`fab-journal:${key}`, JSON.stringify(j.slice(-1500))); } catch { /* full: the replay keeps what it has */ }
  },
};

/** The steps of a replay: each shared step with every side's blocks as they stood until the next step (the mover writes the step, then
 *  its blocks; the other seat writes its blocks when it sees the step), so a step's blocks are the last written before the next step. */
export function buildSteps(pub: JEntry[], sides: JEntry[][]): RStep[] {
  const P = [...pub].sort((a, b) => a.at - b.at), S = sides.map((s) => [...s].sort((a, b) => a.at - b.at));
  return P.map((p, i) => {
    const until = P[i + 1]?.at ?? Infinity, units: JUnits = {};
    for (const s of S) { let last: JEntry | undefined; for (const e of s) { if (e.at < until) last = e; else break; } last ??= s[0]; if (last) Object.assign(units, JSON.parse(last.d) as JUnits); }
    return { pub: JSON.parse(p.d) as JPub, units };
  });
}
