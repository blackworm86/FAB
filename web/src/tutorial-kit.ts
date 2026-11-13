/** The tutorial's building blocks, shared by every volume's course: the course / lesson / step model, the position builders
 *  (a clean table of either game with the Play Book's blocks on it), the book's dice, and the figures the coach shows.
 *  Engine only (no DOM): the tests replay every step. */
import * as E from '../../engine/src';
import { labelSvg } from './art';
import { chitSvg, garrisonChit } from './chits';
import { golanBlockSvg, golanChitSvg, type GUnit, type GCounter } from './golan-art';
import golanUnits from '../../data/golan73/units.json';
import golanCounters from '../../data/golan73/counters.json';
import { sicilyBlockSvg, sicilyChitSvg, SICILY_WOOD, type SUnit, type SCounter } from './sicily-art';
import sicilyUnits from '../../data/sicily/units.json';
import sicilyCounters from '../../data/sicily/counters.json';

export type G = E.Game;
/** What the coach points at: a DOM element (the first selector found; `text` = an element containing it), a block (by id or name), an area, or nothing. */
export type Target = { el: string | string[]; text?: string; label: string } | { unit: string; label?: string } | { area: number; label?: string };
export interface Step {
  title: string;
  /** The coach's words: short, the action in bold. May hold <ul>. */
  text: string;
  /** The rule reference, shown as the label of the "why" note. */
  rule?: string;
  /** The rule behind the step in a sentence or two, folded under the reference. */
  why?: string;
  /** An illustration (HTML) shown under the title. */
  figure?: (g: G) => string;
  /** A situation card opens a lesson (no target, a Start button); a recap closes it (bullets); a try step is a small challenge (the hint under "why"). */
  kind?: 'situation' | 'recap' | 'try';
  /** The block a move step moves: selected when the step opens, so a tap on the glowing area never moves another block left selected. */
  mover?: string;
  target?: Target;
  /** Done when this holds. `q` asks the screen (a CSS selector is present, optionally with a text); missing = the Next button. */
  done?: (g: G, q: (sel: string, text?: string) => boolean) => boolean;
  /** Done as soon as the target is tapped (things that change no game state: selecting a block, opening a picker). */
  tap?: boolean;
  /** Skip the step when this holds on arrival (a choice the game did not ask for). */
  skip?: (g: G) => boolean;
  /** On arrival: queue the book's dice, look at an area. */
  enter?: (g: G) => void;
  look?: number;
  /** What the coach does when the player taps Next (the other side's play, in the book's words). */
  auto?: (g: G) => void;
  /** The player's action in engine terms: replayed by Back and by the tests. */
  act?: (g: G) => void;
  /** The step is the Undo button: replays restore the game from before the previous action. */
  undo?: boolean;
}
export interface Lesson {
  id: string; topic: string; chapter: string; ref?: string;
  /** One line for the lesson list. */
  goal: string; minutes: number;
  /** The side the player plays in this lesson. */
  side?: string;
  setup: () => G; steps: Step[];
}
export interface Course {
  id: string; game: string; title: string; sub: string; blurb: string; minutes: number;
  lessons: Lesson[];
  /** The buttons at the end: start a game of the volume. */
  end: { label: string; scenario: string; primary?: boolean }[];
}

/** A unit by id or by name (the first block of that name). */
export const U = (g: G, key: string) => { const u = g.units.find((x) => x.id === key) ?? g.units.find((x) => x.name === key); if (!u) throw new Error('no unit ' + key); return u; };
export const C = (g: G, id: string) => E.chit(g, id);
export const area = (key: string, g: G) => U(g, key).area;
export const avail = (g: G, ids: string[]) => { for (const id of ids) C(g, id).box = 'available'; };
/** The side's reusable Special Action block (id SA-<side> in The Bulge, the block's own id in Golan). */
export const saChit = (g: G, side: string) => { const c = g.chits.find((x) => x.kind === 'sa_block' && x.side === side); if (!c) throw new Error('no Special Action block for ' + side); return c; };
export const sa = (g: G, side: string) => { saChit(g, side).box = 'available'; };
export const queue = (g: G, d: number[]) => { g.force = [...d]; };
export const stage = (s: E.Battle['stage']) => (g: G) => !!g.battle && g.battle.stage !== s;
/** 6.21-6.23: the Defender goes on without a Special Action and the Attacker's assets are committed: the Defender's step. */
export const answer = (g: G) => { const b = g.battle!; if (b.defSA) E.passSA(g, b); if (!b.ready?.includes(b.attacker)) E.setReady(g, b, b.attacker); };
export const begin = (g: G) => { answer(g); E.beginCombat(g, g.battle!); };
export const roll = (g: G) => E.roll_step(g, g.battle!);
export const fightAt = (a: number) => (g: G) => { E.startBattle(g, a, g.phase === 'btCombat'); };
export const GO: Target = { el: '.c-bar.b .go', label: 'main button' };
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The book's dice for one fire step, made to give the book's hits under this game's Success Numbers.
 *  `book` lists, per firer (matched by name), the dice the book rolls and the Success Number it states; a die whose verdict differs here is nudged to the nearest value with the book's verdict. */
export function bookDice(g: G, side: string, kind: 'arty' | 'ground', book: { who: string; sn: number; dice: number[] }[]): number[] {
  const b = g.battle!, out: number[] = [];
  for (const f of E.fireList(g, b, side as E.Side, kind)) {
    const bk = book.find((x) => f.who.includes(x.who));
    for (let i = 0; i < f.dice; i++) {
      const d = bk?.dice[i] ?? 10, hit = d <= (bk?.sn ?? 0);
      out.push(hit === (d <= f.sn) ? d : hit ? Math.max(1, Math.min(d, f.sn)) : Math.min(10, Math.max(d, f.sn + 1)));
    }
  }
  return out;
}

/** The book's dice for one fire step, firer by firer in the order the game lists them (for firers that share a name, like the two blocks of a division).
 *  Each entry is the book's Success Number and dice for that firer; a die whose verdict differs here is nudged to the nearest value with the book's verdict. */
export function bookDiceSeq(g: G, side: string, kind: 'arty' | 'ground', book: { sn: number; dice: number[] }[]): number[] {
  const out: number[] = [];
  E.fireList(g, g.battle!, side as E.Side, kind).forEach((f, k) => {
    const bk = book[k];
    for (let i = 0; i < f.dice; i++) { const d = bk?.dice[i] ?? 10, hit = d <= (bk?.sn ?? 0); out.push(hit === (d <= f.sn) ? d : hit ? Math.max(1, Math.min(d, f.sn)) : Math.min(10, Math.max(d, f.sn + 1))); }
  });
  return out;
}

/* ---------- common steps ---------- */
export const tapUnit = (key: string, title: string, text: string, o: { rule?: string; why?: string; label?: string } = {}): Step => ({ title, text, rule: o.rule, why: o.why, target: { unit: key, label: o.label }, tap: true });
export const moveTo = (key: string, a: number, title: string, text: string, o: { rule?: string; why?: string; kind?: Step['kind'] } = {}): Step =>
  ({ title, text, rule: o.rule, why: o.why, kind: o.kind, mover: key, target: { area: a }, look: a, done: (g) => area(key, g) === a, act: (g) => { E.move(g, U(g, key).id, a); } });
export const closeStep = (sel: string, gone: string, title: string, text: string): Step => ({ title, text, target: { el: sel, label: 'close button' }, done: (_g, q) => !q(gone) });
export const recap = (points: string[], text = ''): Step => ({ title: 'What to remember', kind: 'recap', text: `${text}<ul>${points.map((p) => `<li>${p}</li>`).join('')}</ul>` });
export const situation = (title: string, text: string, o: { figure?: (g: G) => string; look?: number } = {}): Step => ({ title, text, kind: 'situation', figure: o.figure, look: o.look });
export const next = (title: string, text: string, o: Partial<Step> = {}): Step => ({ title, text, ...o });

/* ---------- The Bulge: a clean table ---------- */
/** The campaign set-up with only the listed blocks on the map (book positions); the rest off the map (or kept, with keepRest). */
export function bulgeTable(turn: number, phasing: string, phase: E.Phase, place: Record<string, number>, keepRest = false): G {
  E.useGame('bulge');
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  g.turn = turn; g.phasing = phasing as E.Side; g.phase = phase;
  for (const u of g.units) {
    const a = place[u.name];
    if (a != null) { u.area = a; u.str = u.max; u.arrival = undefined; u.disorder = 0; u.moved = false; u.reserve = null; u.exploit = false; }
    else if (!keepRest && (u.area != null || (u.arrival ?? 99) <= turn)) { u.area = null; u.arrival = undefined; }
  }
  g.fieldWorks = []; g.riverAssault = []; g.blown = []; g.fought = []; g.contestedAtMoveStart = []; g.pendingArrivals = []; g.log = [];
  for (const [n, a] of Object.entries(place)) { const s = U(g, n).side; if (!E.contested(g, a)) g.control[a] = s; }
  for (const c of g.chits) if (c.box === 'map') c.box = 'used';
  return g;
}

/* ---------- Golan '73: a clean table ---------- */
/** Operation Badr (set up as the errata's historical placement) with only the listed blocks (by id) on the map; garrisons stay, strongpoints and
 *  ghosts only when kept. Control follows the Purple Line, then the placed blocks. */
export function golanTable(turn: number, phasing: string, phase: E.Phase, place: Record<string, number>, o: { keep?: string[] } = {}): G {
  E.useGame('golan73');
  const g = E.newGame(1973, { scenario: 'badr' });
  E.golan.autoStrongpoints(g, 'historical'); E.golan.state(g).minesLeft = 0; E.endPhase(g);
  g.turn = turn; g.phasing = phasing as E.Side; g.phase = phase;
  const V = E.golan.state(g); V.freeCombatRound = 0; V.raids = []; V.raidPartial = []; V.crossed = []; V.assaultEntered = {};
  for (const u of g.units) {
    const a = place[u.id];
    if (a != null) { u.area = a; u.box = undefined; u.str = u.max; u.arrival = undefined; u.disorder = 0; u.moved = false; u.reserve = null; u.exploit = false; u.from = undefined; u.unsupplied = false; }
    else if (u.area != null && !u.garrison && !(o.keep?.includes(u.id))) { u.area = null; u.from = undefined; u.arrival = undefined; }
  }
  g.riverAssault = []; g.fought = []; g.contestedAtMoveStart = []; g.pendingArrivals = []; g.log = []; g.fieldWorks = []; g.markers = { syrian: { res: 2 }, israeli: { res: 4 } };
  for (const a of E.areas.keys()) if (!E.golan.isAssembly(a)) { const us = E.unitsIn(g, a); if (us.length && !E.contested(g, a)) g.control[a] = us[0].side; }
  for (const c of g.chits) if (c.box === 'map' && c.kind !== 'garrison') c.box = 'used';
  return g;
}

/* ---------- Sicily: the Tournament set up, or a clean table ---------- */
/** The Tournament with the quick set-up (garrisons shuffled, the given landing plan, the invasion units on their beachheads), at the Allied Movement Phase of turn 1. */
export function sicilyStart(plan: 'historical' | 'alternate' = 'historical', br = 'B1', us = 'D1'): G {
  E.useGame('sicily'); const g = E.newGame(1943, { scenario: 'tournament' }), S = E.sicily;
  S.autoGarrisons(g); S.choosePlan(g, plan, br, plan === 'alternate' ? us : undefined); S.autoLanding(g); E.endPhase(g); g.log = []; return g;
}
/** A clean Sicily table: the Tournament's beachheads, only the listed blocks (by id) on the map or in boxes, all land Axis-held except where Allied blocks stand alone. */
export function sicilyTable(turn: number, phasing: string, phase: E.Phase, place: Record<string, number>, o: { plan?: 'historical' | 'alternate'; br?: string; us?: string } = {}): G {
  const g = sicilyStart(o.plan, o.br, o.us), V = E.sicily.state(g);
  g.turn = turn; g.phasing = phasing as E.Side; g.phase = phase;
  for (const u of g.units) {
    const a = place[u.id];
    if (a != null) { u.area = a; u.box = undefined; u.str = u.max; u.arrival = undefined; u.disorder = 0; u.moved = false; u.reserve = null; u.exploit = false; u.unsupplied = false; }
    else if (u.area != null || u.box) { u.area = null; u.box = undefined; }
  }
  g.fieldWorks = []; g.fwOwner = {}; g.riverAssault = []; g.blown = []; g.fought = []; g.contestedAtMoveStart = []; g.pendingArrivals = []; g.log = []; V.dropPending = false; V.airborneAreas = []; V.beachAssault = {};
  for (const a of E.areas.keys()) if (!E.sicily.isBox(a)) g.control[a] = 'axis';
  for (const a of new Set(Object.values(place))) if (!E.sicily.isBox(a) && E.unitsIn(g, a, 'allied').length && !E.unitsIn(g, a, 'axis').length) g.control[a] = 'allied';
  for (const c of g.chits) if (c.box === 'map') c.box = 'used';
  return g;
}

/* ---------- figures ---------- */
const uri = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** A row of pieces with captions. */
export const pieces = (items: { svg: string; cap: string; wood?: string }[]) =>
  `<div class="tut-fig">${items.map((i) => `<figure class="${i.wood ? 'blk' : 'cht'}" style="${i.wood ? `--wood:${i.wood}` : ''}"><img alt="" src="${uri(i.svg)}"><figcaption>${i.cap}</figcaption></figure>`).join('')}</div>`;
/** A block face with callouts: steps, quality, type, name, code. */
export function blockAnatomy(svg: string, wood: string, notes: { pips: string; quality: string; type: string; name: string; code?: string }) {
  const L = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#e7b04a" stroke-width="1.2" fill="none"/>`;
  const T = (x: number, y: number, t: string, anchor = 'start') => `<text x="${x}" y="${y}" font-size="10" fill="#e8e4d4" text-anchor="${anchor}" font-family="Roboto Condensed, Arial Narrow, sans-serif">${esc(t)}</text>`;
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 150" width="340" height="150">
    <rect x="113" y="12" width="114" height="114" rx="6" fill="${wood}"/><image href="${uri(svg)}" x="120" y="19" width="100" height="100"/>
    ${L(170, 22, 170, 8)}${T(170, 7, notes.pips, 'middle')}
    ${L(214, 30, 240, 30)}${T(244, 33, notes.quality)}
    ${L(170, 68, 240, 90)}${T(244, 93, notes.type)}
    ${L(208, 100, 240, 128)}${T(244, 131, notes.name)}
    ${notes.code ? `${L(128, 42, 100, 42)}${T(96, 45, notes.code, 'end')}` : ''}
  </svg>`;
  return `<div class="tut-fig one">${svgOut}</div>`;
}
/** The same block at every strength, turned as it loses steps. */
export const strengths = (faces: string[], wood: string) => pieces(faces.map((svg, i) => ({ svg, wood, cap: i === 0 ? `${faces.length} steps (full)` : i === faces.length - 1 ? '1 step' : `${faces.length - i} steps` })));

const BULGE_WOOD = { german: '#8e9296', allied: '#5d8a45' };
/** A Bulge block at strength str (default full). */
export const bulgeBlock = (g: G, key: string, str?: number) => { const u = U(g, key); return labelSvg({ ...u, str: str ?? u.max }); };
export const bulgeWood = (g: G, key: string) => BULGE_WOOD[U(g, key).side as 'german' | 'allied'] ?? '#888';
export const bulgeChit = (g: G, id: string) => chitSvg(C(g, id));
export const bulgeGarrison = (name: string) => garrisonChit(name, 'S', true);

const GU = new Map((golanUnits as unknown as GUnit[]).map((u) => [u.id, u])), GC = new Map((golanCounters as unknown as (GCounter & { ids?: string[] })[]).map((c) => [c.id, c]));
const GOLAN_WOOD = { israeli: '#2ea1d5', syrian: '#2a7f42' };
export const golanBlock = (g: G, id: string, str?: number) => { const u = U(g, id), raw = GU.get(u.id)!; return golanBlockSvg({ ...raw, name: u.name, steps: u.max, quality_by_step: u.q }, str ?? u.max); };
export const golanWood = (g: G, id: string) => GOLAN_WOOD[U(g, id).side as 'israeli' | 'syrian'];
export const golanChit = (g: G, id: string) => { const c = C(g, id), raw = GC.get(c.counter ?? c.id); return golanChitSvg({ id: c.counter ?? c.id, kind: c.kind, side: c.side as 'israeli' | 'syrian', name: c.name, turn: c.turn, quality: c.q ?? raw?.quality, area: c.area ?? raw?.area, subtype: raw?.subtype, symbol: raw?.symbol, brigade: c.brigade, echelon: raw?.echelon }); };

/* ---------- the coach plays out a battle, or the phases up to a point ---------- */
/** One round of combat with plain choices (the point unit takes the first loss, no abort, the defender retreats, no exploitation). */
export function autoFight(g: G, a: number, o: { abort?: boolean; retreat?: boolean } = {}) {
  const b = E.startBattle(g, a, g.phase === 'btCombat'); E.beginCombat(g, b);
  for (let i = 0; i < 60 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
    else if (b.stage === 'attChoice') E.attackerChoice(g, b, !!o.abort);
    else if (b.stage === 'defChoice') E.defenderChoice(g, b, o.retreat ?? true);
    else if (b.stage === 'retreat') { const r = E.retreatOptions(g, b); if (r.length) E.chooseRetreat(g, b, r[0]); else E.defenderChoice(g, b, false); }
    else if (b.stage === 'exploit') E.declineExploit(g, b);
    else E.roll_step(g, b);
  }
  E.closeBattle(g);
}
/** End phases until the given turn, side and phase, fighting what must be fought and rolling the supply checks on the way. */
export function runTo(g: G, turn: number, side: string, phase: E.Phase) {
  for (let i = 0; i < 200 && !(g.turn === turn && g.phasing === side && g.phase === phase) && !g.over; i++) {
    if (g.recover.length) E.autoRecover(g);
    if (g.supplyPending) { E.rollSupply(g); continue; }
    for (const id of [...g.pendingArrivals]) { const o = E.arrivalOptions(g, id); if (o.length) E.placeArrival(g, id, o[0].area); }
    for (const a of E.mustFight(g)) autoFight(g, a);
    E.endPhase(g);
  }
}

const SU = new Map((sicilyUnits as unknown as SUnit[]).map((u) => [u.id, u])), SC = new Map((sicilyCounters as unknown as SCounter[]).map((c) => [c.id, c]));
const hexWood = (n: number) => '#' + n.toString(16).padStart(6, '0');
/** A Sicily block at strength str (default full), as its owner sees it. */
export const sicilyBlock = (g: G, id: string, str?: number) => { const u = U(g, id), raw = SU.get(u.id)!; return sicilyBlockSvg({ ...raw, name: u.name, steps: u.max, quality_by_step: u.q }, str ?? u.max); };
export const sicilyWood = (g: G, id: string) => { const u = U(g, id); return hexWood(SICILY_WOOD[(u.nation ?? (u.side === 'axis' ? 'german' : 'us')) as keyof typeof SICILY_WOOD]); };
export const sicilyChit = (g: G, id: string) => { const c = C(g, id), raw = SC.get(c.counter ?? c.id); return sicilyChitSvg({ ...(raw ?? { id: c.id, kind: c.kind, side: c.side as 'allied' | 'axis', name: c.name }), id: c.id, kind: c.kind, side: c.side as 'allied' | 'axis', name: c.name, turn: c.turn }); };
