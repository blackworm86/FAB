/** Admin sandbox: a private test table kept in this browser. Free edits of the game (pieces, chits, turn and phase, dice),
 *  notes pinned to any piece, area or moment of the turn, and a downloadable test report with a snapshot of the game at each note. */
import * as E from '../../engine/src';

export const PHASES: [E.Phase, string][] = [['reinforcement', 'Reinforcement'], ['admin', 'Administrative (chits)'], ['movement', 'Movement'], ['strategic', 'Strategic movement'],
  ['combat', 'Combat'], ['reaction', 'Reaction (enemy reserves)'], ['btMove', 'Breakthrough movement'], ['btCombat', 'Breakthrough combat'], ['supply', 'Supply']];
export const BOXES: E.Chit['box'][] = ['future', 'cup', 'available', 'map', 'used', 'eliminated'];

/** Control of an area and of its neighbours after a block was placed or removed. */
export function recontrol(g: E.Game, a: number | null | undefined) { if (a == null) return; for (const n of [a, ...E.neighbors(a)]) E.updateControlForTest(g, n); }

/** Put the game at the start of a phase: no battle, no pending bridge, the per-phase bookkeeping cleared. */
export function jump(g: E.Game, turn: number, phasing: E.Side, phase: E.Phase) {
  g.battle = null; g.pendingBlow = null; g.turn = turn; g.phasing = phasing; g.phase = phase; g.done = [];
  g.fought = []; g.riverCross = []; g.blowTried = []; g.entered = {}; g.stratMoves = 0;
  g.contestedAtMoveStart = E.contestedAreas(g);
  for (const u of g.units) { u.moved = false; u.spent = undefined; u.adjOnly = false; }
  E.settleUp(g);
  g.log.push(`T${turn} [sandbox] jump to ${phasing} ${phase}`);
}

export function place(g: E.Game, id: string, area: number) {
  const u = g.units.find((x) => x.id === id)!, was = u.area;
  u.area = area; if (u.str <= 0) u.str = u.max; u.from = was ?? undefined; u.moved = false; u.delayed = false;
  recontrol(g, was); recontrol(g, area); E.settleUp(g);
  g.log.push(`T${g.turn} [sandbox] ${u.name} placed in ${E.areas.get(area)!.name}`);
}
export function lift(g: E.Game, id: string) {
  const u = g.units.find((x) => x.id === id)!, was = u.area; u.area = null; recontrol(g, was);
  g.log.push(`T${g.turn} [sandbox] ${u.name} taken off the map`);
}
/** Every block off the map: a bare board to build a test position on. Area control stays as it was (it can be set per area). */
export function clearMap(g: E.Game) { g.battle = null; g.pendingBlow = null; for (const u of g.units) u.area = null; g.fieldWorks = []; g.riverAssault = []; g.log.push(`T${g.turn} [sandbox] map cleared`); }

/* ---------- notes ---------- */
export interface Target { kind: 'unit' | 'chit' | 'area' | 'battle' | 'phase'; id: string; label: string }
export interface Note { id: string; at: string; target: Target; text: string; turn: number; phasing: E.Side; phase: E.Phase; battle: string | null; seat: string; log: string[]; state: string | null }
const NKEY = 'fab-sandbox-notes';
export function loadNotes(): Note[] { try { return JSON.parse(localStorage.getItem(NKEY) ?? '[]'); } catch { return []; } }
/** Store the notes; if the browser runs out of room, the oldest snapshots are dropped (the notes stay). Returns a warning or ''. */
export function saveNotes(ns: Note[]): string {
  for (let i = 0; i <= ns.length; i++) {
    try { localStorage.setItem(NKEY, JSON.stringify(ns)); return i ? `Storage full: dropped the game snapshot of ${i} older note(s).` : ''; } catch { if (ns[i]) ns[i].state = null; }
  }
  return 'Could not store the notes in this browser.';
}
export function makeNote(g: E.Game, target: Target, text: string, seat: string): Note {
  const b = g.battle;
  return { id: Math.random().toString(36).slice(2, 9), at: new Date().toISOString(), target, text, turn: g.turn, phasing: g.phasing, phase: g.phase,
    battle: b ? `${E.areas.get(b.area)!.name} (${b.area}), stage ${b.stage}, attacker ${b.attacker}` : null, seat, log: g.log.slice(-25), state: JSON.stringify(g) };
}

/** The report: readable notes first, then the full game at each note and now, so every bug can be replayed. */
export function report(ns: Note[], g: E.Game, version: string) {
  const out = {
    title: 'FAB sandbox test report', created: new Date().toISOString(), version, notes: ns.length,
    summary: ns.map((n, i) => `${i + 1}. [T${n.turn} ${n.phasing} ${n.phase}${n.battle ? ' | battle ' + n.battle : ''}] ${n.target.kind} ${n.target.label}: ${n.text}`),
    items: ns.map((n) => ({ ...n, state: n.state ? JSON.parse(n.state) : null })),
    current: g,
  };
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `fab-test-report-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
