/** The tutorial's lessons (docs/TUTORIAL.md), built on the Play Book's Examples of Play 23.1-23.10.
 *  Engine only (no DOM), so the tests can play every step: `act` is what the player does, `auto` what the coach does on Next. */
import * as E from '../../engine/src';
import entryJson from '../../data/bulge/entry_areas.json';

type G = E.Game;
/** What the coach points at: a DOM element (the first selector found; `text` = a button containing it), a block (by name), an area, or nothing. */
export type Target = { el: string | string[]; text?: string; label: string } | { unit: string; label?: string } | { area: number; label?: string };
export interface Step {
  title: string; text: string; rule?: string;
  target?: Target;
  /** Done when this holds. `q` asks the screen (a CSS selector is present); missing = the Next button. */
  done?: (g: G, q: (sel: string, text?: string) => boolean) => boolean;
  /** Done as soon as the target is tapped (things that change no game state: selecting a block, opening a picker). */
  tap?: boolean;
  /** Skip the step when this holds on arrival (a choice the game did not ask for). */
  skip?: (g: G) => boolean;
  /** On arrival: queue the book's dice, look at an area. */
  enter?: (g: G) => void;
  look?: number;
  /** What the coach does when the player taps Next (the Allied side, in the book's words). */
  auto?: (g: G) => void;
  /** The player's action in engine terms: replayed by Back and by the tests. */
  act?: (g: G) => void;
  /** The step is the Undo button: replays restore the game from before the previous action. */
  undo?: boolean;
}
export interface Lesson { topic: string; ref: string; setup: () => G; steps: Step[] }

export const ENTRY = entryJson as Record<string, { side: string; area: number }>;
export const U = (g: G, name: string) => { const u = g.units.find((x) => x.name === name); if (!u) throw new Error('no unit ' + name); return u; };
const C = (g: G, id: string) => E.chit(g, id);
const area = (name: string, g: G) => U(g, name).area;

/** A clean table: the campaign set-up with only the listed blocks on the map (book positions). */
function table(turn: number, phasing: E.Side, phase: E.Phase, place: Record<string, number>, keepRest = false): G {
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  g.turn = turn; g.phasing = phasing; g.phase = phase;
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
const avail = (g: G, ids: string[]) => { for (const id of ids) C(g, id).box = 'available'; };
const sa = (g: G, side: E.Side) => { C(g, `SA-${side}`).box = 'available'; };

/** The book's dice for one fire step, made to give the book's hits under this game's Success Numbers.
 *  `book` lists, per firer (matched by name), the dice the book rolls and the Success Number it states; a die whose verdict differs here is nudged to the nearest value with the book's verdict. */
export function bookDice(g: G, side: E.Side, kind: 'arty' | 'ground', book: { who: string; sn: number; dice: number[] }[]): number[] {
  const b = g.battle!, out: number[] = [];
  for (const f of E.fireList(g, b, side, kind)) {
    const bk = book.find((x) => f.who.includes(x.who));
    for (let i = 0; i < f.dice; i++) {
      const d = bk?.dice[i] ?? 10, hit = d <= (bk?.sn ?? 0);
      out.push(hit === (d <= f.sn) ? d : hit ? Math.max(1, Math.min(d, f.sn)) : Math.min(10, Math.max(d, f.sn + 1)));
    }
  }
  return out;
}
const queue = (g: G, d: number[]) => { g.force = [...d]; };
const stage = (s: E.Battle['stage']) => (g: G) => !!g.battle && g.battle.stage !== s;
const begin = (g: G) => E.beginCombat(g, g.battle!);
const roll = (g: G) => E.roll_step(g, g.battle!);
const fightAt = (a: number) => (g: G) => { E.startBattle(g, a, g.phase === 'btCombat'); };
const GO = { el: '.c-bar.b .go', label: 'button' };
const tapUnit = (name: string, title: string, text: string, rule?: string): Step => ({ title, text, rule, target: { unit: name }, tap: true });
const moveTo = (name: string, a: number, title: string, text: string, rule?: string): Step => ({ title, text, rule, target: { area: a }, look: a, done: (g) => area(name, g) === a, act: (g) => { E.move(g, U(g, name).id, a); } });
const close = (sel: string, gone: string, title: string, text: string): Step => ({ title, text, target: { el: sel, label: 'close button' }, done: (_g, q) => !q(gone) });
const recap = (text: string): Step => ({ title: 'Recap', text });

/* ---------------- Lesson 0 · The table ---------------- */
const L0: Lesson = { topic: 'The table', ref: '', setup: () => { const g = E.newGame(2007, { scenario: 'campaign', fuel: true }); g.phase = 'movement'; g.log = []; return g; }, steps: [
  { title: 'Welcome', text: 'This is <b>The Bulge</b>, December 1944. You play the <b>Germans</b> first: grey blocks, attacking west across the Ardennes. Drag to pan, pinch or scroll to zoom.', look: 23 },
  { title: 'The steps of a turn', text: 'The top bar shows the steps of a player turn and whose turn it is. <b>Tap the step names.</b>', target: { el: '.c-crumbs', label: 'step names' }, tap: true },
  { title: 'Five steps', text: '<b>Prepare</b>: resources and chits. <b>Move</b>: blocks move. <b>Fight</b>: battles in contested areas. <b>Breakthrough</b>: reserves and exploiting units move and fight again. <b>Supply</b>: units cut off check morale. Then the Allies play the same five steps.', rule: '3.0 Sequence of play' },
  { title: 'Victory points', text: 'Under the bar, the VP strip: who holds which objectives. <b>Tap it.</b>', target: { el: '.vps', label: 'VP strip' }, done: (_g, q) => q('.vsheet') },
  close('.vsheet [aria-label="Close"]', '.vsheet', 'The VP sheet', 'Each objective, its owner and the net score; from Turn 4 a big enough lead wins at once. <b>Close it.</b>'),
  { title: 'View', text: 'The View window chooses what the map shows. <b>Tap View.</b>', target: { el: '[data-tint]', label: 'View button' }, done: (_g, q) => q('.modal .chip[title="Terrain defence"]') },
  { title: 'Terrain defence', text: '<b>Turn on Terrain defence</b>: the darker the area, the harder it is to attack (its TDN lowers the attacker\'s fire).', target: { el: '.modal .chip[title="Terrain defence"]', label: 'Terrain defence chip' }, done: (_g, q) => q('.modal .chip.on[title="Terrain defence"]'), rule: '6.3 Terrain Defense Number' },
  close('.modal [aria-label="Close"]', '.modal', 'Close the window', '<b>Close the View window.</b> The colours stay on.'),
  { title: 'Explanations', text: 'The <b>ⓘ</b> button switches between short prompts and full explanations of each option. It stays on <b>full</b> during the tutorial.', target: { el: '.guidebtn', label: 'ⓘ button' } },
  recap('The top bar: the steps and the turn. The VP strip: the score. View: map layers. ⓘ: how much the game explains.'),
] };

/* ---------------- Lesson 1 · Reinforcement (23.1) ---------------- */
const L1: Lesson = { topic: 'Reinforcement', ref: '23.1', setup: () => {
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  const ge = g.chits.filter((c) => c.side === 'german');
  for (const c of ge) if (c.box === 'available' && (c.kind === 'artillery' || c.kind === 'rocket_artillery' || c.kind === 'engineer')) c.box = 'used';
  for (const id of ['L31.0', 'L33.0']) C(g, id).box = 'available';
  const art = ge.filter((c) => c.kind === 'artillery' && c.box === 'used' && c.id !== 'L46.0'); if (art[0]) art[0].box = 'available';
  const eng = ge.filter((c) => c.kind === 'engineer' && c.box === 'used'); for (const c of eng.slice(1, 3)) c.box = 'available';
  g.turn = 1; g.phasing = 'allied'; g.phase = 'supply'; g.supplyPending = false; g.contestedAtMoveStart = E.contestedAreas(g);
  E.endPhase(g); g.log = []; return g;
}, steps: [
  { title: 'Managing resources', text: 'Each turn starts with the <b>Reinforcement</b> step: both players manage their resources. It is the start of Turn 2.', rule: '23.1 Reinforcement Phase' },
  { title: 'The Pieces window', text: '<b>Tap Pieces</b> to see your boxes.', target: { el: '[data-modal="boxes"]', label: 'Pieces button' }, done: (_g, q) => q('.modal') },
  { title: 'Available, Used, Cup', text: '<b>Available</b>: chits you can play now. <b>Used</b>: spent this turn. <b>Cup</b>: drawn at random each Prepare step. The Special Action block has not arrived yet.', rule: '4.1 Reinforcement' },
  close('.modal [aria-label="Close"]', '.modal', 'Close the window', '<b>Close Pieces.</b>'),
  { title: 'Artillery attrition', text: 'Each turn the German player loses one regular artillery asset from the Used Box. <b>Pick the 408th.</b>', rule: '16.12 Artillery attrition', target: { el: '.c-dispatch .pc', text: '408', label: '408th Artillery' }, done: (g) => C(g, 'L46.0').box === 'eliminated', act: (g) => E.chooseArtyLoss(g, 'L46.0') },
  { title: 'Back to the cup', text: 'The rest of the Used Box went back into the cup. The Special Action block arrived in Available, and the Turn 2 chits (v.d. Heydte, two artillery, an infantry asset, Greif Team Interdict and Bridge, an infantry replacement) went into the cup.' },
  { title: 'The Allied side', text: 'The Allies do the same. Watch: a <b>Task Force</b> goes to Houffalize (behind the breakthrough at Weiswampach), the <b>10th Armored</b> arrives in Area N and the <b>1st Infantry</b> (one step) in Area A.', look: 36, auto: (g) => {
    const tf = g.chits.find((c) => c.side === 'allied' && c.kind === 'task_force' && c.box === 'available'); if (tf) try { E.placeTaskForce(g, tf.id, 36); } catch { /* the area may not take it */ }
    try { E.placeArrival(g, U(g, '10 Arm').id, ENTRY.N.area); } catch { /* */ } try { E.placeArrival(g, U(g, '1 Inf').id, ENTRY.A.area); } catch { /* */ }
  } },
  { title: 'The arrival tray', text: 'The <b>7th Armored</b> waits in the tray. <b>Tap it</b> (or drag it onto the map).', target: { el: '[data-arr="B47"]', label: '7th Armored' }, tap: true, done: (g) => U(g, '7 Arm').area != null },
  { title: 'Entry area B', text: '<b>Tap the lit Entry Area B</b> to place it.', target: { area: ENTRY.B.area }, look: ENTRY.B.area, done: (g) => U(g, '7 Arm').area != null, act: (g) => E.placeArrival(g, U(g, '7 Arm').id, ENTRY.B.area) },
  recap('Reinforcement: artillery attrition (German), Used Box back to the cup, the turn\'s chits into the cup, then new blocks enter at their entry areas.'),
] };

/* ---------------- Lesson 2 · Admin: chits (23.2) ---------------- */
const GREIF = E.keyOf(21, 37);
const L2: Lesson = { topic: 'Prepare: chits', ref: '23.2', setup: () => {
  const g = table(2, 'german', 'admin', { '12 VG': 9, '2 Pz': 21, '110/28': 37, '18 VG': 11, '106 Inf': 23, 'CCB/9': 25 }, true);
  U(g, '12 VG').str = 2;
  const ge = g.chits.filter((c) => c.side === 'german' && c.box !== 'eliminated');
  for (const c of ge) if (c.box === 'available') c.box = 'cup';
  const take = (k: E.Chit['kind'], n: number) => { for (const c of ge.filter((x) => x.kind === k && x.box !== 'available').slice(0, n)) c.box = 'available'; };
  take('artillery', 3); take('rocket_artillery', 1); take('engineer', 1); take('infantry_asset', 1); take('armor_asset', 1); avail(g, ['R15.0', 'L17.0']);
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name)); if (dr) dr.box = 'available';
  avail(g, ['L63.0', 'L88.0', 'L65.0', 'L62.0']);
  return g;
}, steps: [
  { title: 'Your hand', text: 'The Prepare step: both players draw chits (the German nine this turn) and may play them. <b>Glowing cards can be played now. Tap Greif Team Bridge.</b>', rule: '23.2 Admin Phase', target: { el: ['.card2[data-chit="R15.0"]', '.handtab button'], label: 'Greif Team Bridge' }, done: (_g, q) => q('.chitbar', 'Greif') },
  { title: 'Greif Team Bridge', text: 'German commandos in American uniform hold a bridge: the Allies then need a <b>1</b> to blow it. <b>Tap Marnach.</b>', rule: '17.12 Greif Team Bridge', target: { area: 21 }, look: 21, tap: true, done: (g) => !!g.greif[GREIF] },
  { title: 'The river border', text: '<b>Tap Lullange</b>, across the river: the team takes the Marnach–Lullange bridge.', target: { area: 37 }, look: 37, done: (g) => !!g.greif[GREIF], act: (g) => E.playGreifBridge(g, 'R15.0', 21, 37) },
  { title: 'Replacements', text: 'The 12th VG lost a step in Udenbreth on Turn 1. <b>Tap Non-Elite Infantry Replacement.</b>', target: { el: ['.card2[data-chit="L17.0"]', '.handtab button'], label: 'Non-Elite Infantry Replacement' }, done: (g, q) => q('.chitbar', 'Non-Elite') || U(g, '12 VG').str === 3 },
  { title: 'The 12th VG', text: '<b>Tap the 12th VG in Udenbreth</b>: it gains a step. The chit\'s colour shows its army (6th Panzer).', rule: '13.0 Replacements', target: { unit: '12 VG' }, look: 9, done: (g) => U(g, '12 VG').str === 3, act: (g) => E.playReplacement(g, 'L17.0', U(g, '12 VG').id) },
  { title: 'The Allied side', text: 'The Allies drew seven: Delayed Response (no effect, discarded) and engineers. The <b>35th</b> in Ligneuville blows the bridges to St. Vith and Malmedy; the <b>168th</b> in Vielsalm those to Malmedy and Baraque de Fraiture. Watch the blown-bridge markers.', rule: '15.3 Blowing bridges', look: 24, auto: (g) => {
    const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name) && c.box === 'available'); if (dr) dr.box = 'eliminated';
    E.blowBridges(g, 'L63.0', 25, [23, 33]); E.blowBridges(g, 'L88.0', 24, [33, 35]);
  } },
  { title: 'Ending the step', text: 'Both players work in Prepare. Online the other side taps <b>Done</b>, then the phasing player <b>ends the step</b>. <b>Tap End prepare.</b>', target: GO, done: (g) => g.phase !== 'admin', act: (g) => E.endPhase(g) },
  recap('Prepare: draw from the cup, then play events and assets. Greif teams hold bridges, replacements restore steps, engineers blow bridges.'),
] };

/* ---------------- Lesson 3 · Movement (23.3) ---------------- */
const L3: Lesson = { topic: 'Movement', ref: '23.3', setup: () => {
  const g = table(2, 'german', 'movement', { '26 VG': 4, '116 Pz': 4, '2 Pz': 21, '110/28': 37, Lehr: 13, '560 VG': 22 });
  U(g, '110/28').disorder = 1;
  C(g, 'R15.0').box = 'map'; g.greif[GREIF] = 'R15.0'; avail(g, ['L65.0']);
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  return g;
}, steps: [
  tapUnit('26 VG', 'Select a block', '<b>Tap the infantry block in Prüm.</b> The areas it can reach turn green; orange means it must stop there.', '5.3 Movement'),
  moveTo('26 VG', 5, 'Army zones', '<b>Tap Losheim.</b> The road costs 1 MP, plus 2 MP for leaving its own army zone (5th Panzer, Zone 5): it must stop there.', '5.33 Army boundaries'),
  { title: 'Undo', text: 'Moves can be taken back until something is revealed or rolled. <b>Tap Undo.</b>', target: { el: '[data-undo]', label: 'Undo' }, undo: true, done: (g) => area('26 VG', g) === 4 },
  tapUnit('26 VG', 'Again', '<b>Tap the infantry again.</b>'),
  moveTo('26 VG', 11, 'The Schnee Eifel', '<b>Tap Bleialf.</b> The Schnee Eifel ridge is a restricted border: crossing it takes the whole allowance. Armour may not cross it at all.', '5.34 Restricted boundaries'),
  tapUnit('116 Pz', 'Armour', '<b>Tap the armour block in Prüm.</b>'),
  moveTo('116 Pz', 23, 'Roads', '<b>Tap St. Vith.</b> By road through Pronsfeld and Lutzkampen: 1 MP each, 3 MP in all. No fuel needed: German armour spends fuel only to go past 3 MP.', '16.13 Fuel'),
  tapUnit('2 Pz', 'A river crossing', 'In Marnach the 2nd Panzer faces the 110/28th across the river; the Greif team holds the bridge. <b>Tap the 2nd Panzer.</b>'),
  { title: 'Into Lullange', text: '<b>Tap Lullange.</b> Entering an enemy area over a bridge lets the defender try to blow it.', target: { area: 37 }, look: 37, done: (g) => !!g.pendingBlow || area('2 Pz', g) === 37, act: (g) => { E.move(g, U(g, '2 Pz').id, 37); } },
  { title: 'The bridge', text: 'The Allied player plays the <b>159th Engineer</b>: with the Greif team on the bridge he needs a 1, the engineer brings it back to 5 or less. The book\'s roll: <b>blown</b>. The 2nd Panzer started next to the river, so it still crosses, spending all its MP, and makes a <b>river assault</b>.', rule: '5.35 Bridges · 17.12', skip: (g) => !g.pendingBlow, auto: (g) => { C(g, 'L65.0').box = 'used'; queue(g, [1]); E.resolveBlow(g, true); } },
  tapUnit('Lehr', 'Reserve', 'Panzer Lehr waits in Dasburg. <b>Tap it.</b>'),
  { title: 'Reserve', text: '<b>Tap Reserve.</b> A reserve block can move later: in Strategic movement, Reaction or Breakthrough.', rule: '14.8 Reserves', target: { el: '.c-dispatch button', text: 'Reserve', label: 'Reserve button' }, done: (g) => !!U(g, 'Lehr').reserve, act: (g) => E.setReserve(g, U(g, 'Lehr').id, true) },
  { title: 'Shortcuts', text: 'The chips by the bottom bar jump between blocks that <b>can move</b>, can <b>fortify</b> or go into <b>reserve</b>.', target: { el: ['.dchip', '.c-bar.b'], label: 'shortcuts' } },
  recap('Roads 1 MP, fields 2 MP; +2 MP out of the army zone; restricted borders take the whole move; German armour needs fuel past 3 MP; a blown bridge means a river assault.'),
] };

/* ---------------- Lesson 4 · Strategic movement (23.4) ---------------- */
const L4: Lesson = { topic: 'Strategic movement', ref: '23.4', setup: () => {
  const g = table(3, 'allied', 'movement', { 82: 96, 101: 87, Lehr: 47, '2 Pz': 49 });
  E.setReserve(g, U(g, '82').id, true); E.setReserve(g, U(g, '101').id, true);
  g.phase = 'strategic'; g.stratMoves = 0; return g;
}, steps: [
  { title: 'Turn 3, Allied side', text: 'An Allied example: the Germans hold Bastogne and a gap opens. The <b>82nd</b> (Givet) and <b>101st</b> (La Chapelle) Airborne arrived and were put in reserve. You move them.', rule: '23.4 Strategic Movement Phase', look: 62 },
  tapUnit('82', 'Strategic movement', 'Reserve units may strat-move any distance through friendly, uncontested areas. <b>Tap the 82nd.</b>', '5.4 Strategic movement'),
  { ...moveTo('82', 62, 'La Roche', '<b>Tap La Roche.</b>'), act: (g) => E.stratMove(g, U(g, '82').id, 62) },
  tapUnit('101', 'The 101st', '<b>Tap the 101st.</b>'),
  { ...moveTo('101', 74, 'Champlon', '<b>Tap Champlon.</b>'), act: (g) => E.stratMove(g, U(g, '101').id, 74) },
  recap('Strategic movement: only reserve units, only through friendly uncontested areas, never over a blown bridge. Limits: 3 Allied moves a turn, 1 German (plus a fuel asset).'),
] };

/* ---------------- Lesson 5 · Combat (23.5) ---------------- */
const L5: Lesson = { topic: 'Combat', ref: '23.5', setup: () => {
  const g = table(2, 'german', 'combat', { '18 VG': 23, '106 Inf': 23, 'Garrison St. Vith': 23, 'CCB/9': 25, '62 VG': 11 });
  g.control[23] = 'allied'; U(g, '106 Inf').str = 1; sa(g, 'allied'); return g;
}, steps: [
  { title: 'Choose a battle', text: 'The 18th VG has entered St. Vith, held by the 106th Infantry and the town garrison. <b>Tap St. Vith.</b>', rule: '23.5 Combat Phase', target: { area: 23 }, look: 23, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight St. Vith.</b> One round of combat follows, step by step.', target: GO, done: (g) => !!g.battle, act: fightAt(23) },
  { title: 'Allied Special Action', text: 'The Allied player spends his reusable <b>Special Action</b> to <b>Reinforce</b>: the CCB/9th Armored comes in from Ligneuville. As it has just arrived, the <b>106th</b> must be the Allied point unit.', rule: '8.23 Reinforce', auto: (g) => { const b = g.battle!; E.defenderReinforceSA(g, b, U(g, 'CCB/9').id, 'SA-allied'); E.setPoint(g, b, 'allied', U(g, '106 Inf').id); } },
  { title: 'The battle table', text: 'Both sides, the <b>point units</b> (gold mark) and the assets row. No one assigns artillery. <b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'Read the fire report', text: 'Each line is one firer: dice × number, then its <b>Success Number</b>. A die at or under the SN is a hit. The chips are the reasons: <b>+1</b> armour, <b>−1</b> green firing on veteran. <b>Tap Roll.</b>', rule: '6.27 Defensive ground fire · Combat Table', target: GO,
    enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: 'CCB/9', sn: 6, dice: [5] }, { who: 'Garrison', sn: 4, dice: [5] }, { who: '106', sn: 4, dice: [1] }])), done: stage('defFire'), act: roll },
  { title: 'Two hits', text: 'The first hit on the attacker is a <b>step loss</b>: the 18th VG turns one step. For the second, <b>abort the attack</b>: it absorbs every remaining hit, and the attackers become disordered.', rule: '6.41 Hit priorities', target: { el: ['.c-dispatch button', 'button'], text: 'Abort', label: 'Abort button' }, done: (g) => !!g.battle?.result || !g.battle, act: (g) => E.attackerChoice(g, g.battle!, true) },
  { title: 'Close the battle', text: 'The Allies held. <b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap('Defensive fire comes first. The attacker\'s first hit is a step loss; then he may abort (all units disordered) instead of losing more.'),
] };

/* ---------------- Lesson 6 · Combat with exploitation (23.6) ---------------- */
const L6: Lesson = { topic: 'Exploitation', ref: '23.6', setup: () => {
  const g = table(2, 'german', 'combat', { '116 Pz': 22, '112/28': 22, Lehr: 13 });
  g.control[22] = 'allied'; for (const a of [3, 12, 13, 21]) g.control[a] = 'german'; avail(g, ['L31.0', 'L33.0', 'L62.0']); return g;
}, steps: [
  { title: 'Weiswampach', text: 'The 116th Panzer crossed into Weiswampach against the 112/28th. <b>Tap Weiswampach</b>, then Fight.', rule: '23.6 Combat with exploitation', target: { area: 22 }, look: 22, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Weiswampach.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(22) },
  { title: 'Artillery', text: '<b>Tap the 15th Rocket</b> to assign it to the battle.', rule: '16.12 Artillery limits', target: { el: ['.card2[data-chit="L31.0"]', '.handtab button'], label: '15th Rocket' }, done: (g) => !!g.battle?.assets.german.includes('L31.0'), act: (g) => E.assign(g, g.battle!, 'L31.0') },
  { title: 'A second battery', text: '<b>Tap the 401st.</b> Two artillery assets need one regular and one rocket; other pairs are refused and the panel says why.', target: { el: ['.card2[data-chit="L33.0"]', '.handtab button'], label: '401st' }, done: (g) => !!g.battle?.assets.german.includes('L33.0'), act: (g) => E.assign(g, g.battle!, 'L33.0') },
  { title: 'Allied artillery', text: 'The Allied player answers with the <b>333rd Artillery</b>.', auto: (g) => E.assign(g, g.battle!, 'L62.0') },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'German artillery', text: '"2 tries for a 5": no field works, so no modifier. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'arty', [{ who: '15th', sn: 5, dice: [6] }, { who: '401', sn: 5, dice: [10] }, { who: '', sn: 5, dice: [6, 10] }])), done: stage('attArty'), act: roll },
  { title: 'Allied artillery', text: '"1 try for a 4": −1 because the target\'s point unit is armour. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'arty', [{ who: '', sn: 4, dice: [9] }])), done: stage('defArty'), act: roll },
  { title: 'Defensive fire', text: 'The 112/28th fires first: veteran on an elite armour point unit. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: '112', sn: 3, dice: [4] }])), done: stage('defFire'), act: roll },
  { title: 'The 116th fires', text: '"3 tries for a 6": +1 armour, +1 elite on veteran, −1 terrain. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 6, dice: [1, 6, 5] }])), done: stage('offFire'), act: roll },
  { title: 'Three hits', text: 'The defender chooses in the hit-choice bubble: the first hit is absorbed by <b>retreating</b> (disordered); the second <b>eliminates</b> the one-step regiment; the third is an excess hit. The Allied player retreats.', rule: '6.42 Defender hit priorities', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]); } },
  { title: 'Exploitation', text: 'The area is clear: the 116th checks morale for <b>exploitation</b>. Elite: 5 + 2 = "1 try for a 7". <b>Roll.</b>', rule: '6.8 Exploitation', target: GO, skip: (g) => g.battle?.stage !== 'exploit', enter: (g) => queue(g, [6]), done: (g) => !g.battle || g.battle.stage === 'done', act: roll },
  { title: 'Close the battle', text: 'The 116th Panzer is marked for exploitation: it may move in the Breakthrough step. <b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap('Artillery, then defensive fire, then the attacker. The defender retreats or loses steps; a cleared area lets armour roll for exploitation.'),
] };

/* ---------------- Lesson 7 · Reaction and breakthrough (23.7) ---------------- */
const BLOW_OK: Step = { title: 'No bridge blown', text: 'The Allied engineers are spent: the bridge stands and the block crosses.', skip: (g) => !g.pendingBlow, auto: (g) => { E.resolveBlow(g, false); } };
const L7: Lesson = { topic: 'Breakthrough', ref: '23.7', setup: () => {
  const g = table(2, 'german', 'movement', { '116 Pz': 22, 'CCR/9': 36, Lehr: 13, '150 Pz': 12, '106 Inf': 24 });
  E.setReserve(g, U(g, 'Lehr').id, true); U(g, '116 Pz').exploit = true;
  for (const a of [21, 22, 12, 13]) g.control[a] = 'german';
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  sa(g, 'german'); for (const u of g.units) u.moved = true; for (const n of ['116 Pz', 'Lehr', '150 Pz']) U(g, n).moved = false;
  g.phase = 'reaction'; g.fought = []; return g;
}, steps: [
  { title: 'Reaction', text: 'After the battles the Allies may <b>react</b> with reserve blocks. Their new arrivals cannot be in reserve before their own turn, so they cannot react now.', rule: '23.7 Reaction', auto: (g) => { while (g.phase === 'reaction') E.endPhase(g); } },
  tapUnit('116 Pz', 'Exploitation move', 'Three ways to move in Breakthrough. First, exploitation: <b>tap the 116th Panzer</b> in Weiswampach.', '7.3 Breakthrough movement'),
  { title: 'Houffalize', text: '<b>Tap Houffalize.</b> An exploiting block moves one area: CCR/9th is there, so a battle follows.', target: { area: 36 }, look: 36, done: (g) => area('116 Pz', g) === 36 || !!g.pendingBlow, act: (g) => { E.move(g, U(g, '116 Pz').id, 36); } },
  BLOW_OK,
  tapUnit('Lehr', 'Reserve move', 'Second, reserve: <b>tap Panzer Lehr</b> in Dasburg.'),
  { title: 'Vielsalm, with fuel', text: '<b>Tap Vielsalm.</b> Marnach 2 MP, Weiswampach 1 MP: past 3 MP German armour needs <b>fuel</b>; the route panel shows the fuel spent. Entering the 106th\'s area costs +1 MP.', rule: '16.13 Fuel', target: { area: 24 }, look: 24, done: (g) => area('Lehr', g) === 24 || !!g.pendingBlow, act: (g) => { E.move(g, U(g, 'Lehr').id, 24); } },
  BLOW_OK,
  tapUnit('150 Pz', 'Special Action', 'Third, a <b>Special Action</b>: <b>tap the 150th Panzer Brigade</b> in Lutzkampen.'),
  { title: 'Activate (SA)', text: '<b>Tap Activate (SA).</b> The tags on blocks show which can use one.', target: { el: '.c-dispatch button', text: 'Activate', label: 'Activate (SA)' }, done: (g) => !!U(g, '150 Pz').exploit || area('150 Pz', g) === 22 || g.chits.find((c) => c.id === 'SA-german')?.box !== 'available', act: (g) => E.activateBreakthrough(g, U(g, '150 Pz').id, 'SA-german') },
  { title: 'Weiswampach', text: '<b>Tap Weiswampach</b>: one area forward.', target: { area: 22 }, look: 22, done: (g) => area('150 Pz', g) === 22, act: (g) => { E.move(g, U(g, '150 Pz').id, 22); } },
  { title: 'Breakthrough combat', text: '<b>Tap End breakthrough.</b> Newly contested areas fight for free; one already contested would need a Special Action.', target: GO, done: (g) => g.phase === 'btCombat', act: (g) => E.endPhase(g) },
  { title: 'Houffalize', text: '<b>Tap Houffalize</b>, then Fight.', target: { area: 36 }, look: 36, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Houffalize</b>, then Begin combat.', target: GO, done: (g) => !!g.battle && g.battle.stage !== 'setup', act: (g) => { fightAt(36)(g); begin(g); } },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, skip: (g) => g.battle?.stage !== 'setup', done: stage('setup'), act: begin },
  { title: 'CCR/9th fires', text: '"1 try for a 5": +1 armour, −1 veteran on elite, −1 armour point unit, +1 river assault. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: 'CCR', sn: 5, dice: [5] }])), done: stage('defFire'), act: roll },
  { title: 'The 116th fires', text: 'The first hit was a step loss; the 116th goes on. Now it has two steps: "2 tries for a 3". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 3, dice: [1, 9] }])), done: stage('offFire'), act: roll },
  { title: 'Retreat', text: 'One hit: the CCR/9th absorbs it by retreating into Noville, disordered.', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') { const o = E.retreatOptions(g, b); E.chooseRetreat(g, b, o.includes(48) ? 48 : o[0]); } } },
  { title: 'Close', text: '<b>Tap Close battle.</b>', target: GO, skip: (g) => !g.battle, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  { title: 'Vielsalm', text: '<b>Tap Vielsalm</b>, then Fight.', target: { area: 24 }, look: 24, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Vielsalm.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(24) },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'The 106th fires', text: '"3 tries for a 2": green on elite, armour point unit. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: '106', sn: 2, dice: [6, 4, 10] }])), done: stage('defFire'), act: roll },
  { title: 'Panzer Lehr fires', text: '"4 tries for a 7": +1 armour, +2 elite on green, −1 terrain. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: 'Lehr', sn: 7, dice: [1, 9, 5, 8] }])), done: stage('offFire'), act: roll },
  { title: 'Two hits', text: 'The 106th retreats into Baraque de Fraiture (one hit) and loses a step (the second).', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') { const o = E.retreatOptions(g, b); E.chooseRetreat(g, b, o.includes(35) ? 35 : o[0]); } } },
  { title: 'Close', text: '<b>Tap Close battle.</b> No new exploitation can happen in Breakthrough combat.', target: GO, skip: (g) => !g.battle, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap('Breakthrough: exploiting blocks move one area, reserve blocks a full move (fuel past 3 MP), and a Special Action activates armour. New contacts fight at once.'),
] };

/* ---------------- Lesson 8 · Supply (23.8) ---------------- */
const L8: Lesson = { topic: 'Supply', ref: '23.8', setup: () => {
  const g = table(3, 'german', 'btCombat', { Peiper: 51, '18 VG': 34, 'CCB/9': 34, '1SS(-)': 33, '3 FJ': 25, '62 VG': 24, '1 Inf': 53 });
  for (const a of [5, 6, 10, 23, 24, 25, 33, 51, 52]) g.control[a] = 'german';
  for (const a of [34, 50, 35, 53]) g.control[a] = 'allied';
  g.blown = [E.keyOf(34, 24), E.keyOf(34, 33), E.keyOf(25, 23)];
  const eng = C(g, 'L88.0'); eng.box = 'map';
  g.units.push({ id: 'DR-L88.0', name: '168th (defended roadblock)', side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: 50, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: eng.ech, chitId: 'L88.0' });
  g.contestedAtMoveStart = E.contestedAreas(g); g.fought = [...g.contestedAtMoveStart];
  E.endPhase(g); g.log = []; return g;
}, steps: [
  { title: 'Supply', text: 'Turn 3: KG Peiper raced to Werbomont, counting on the 18th VG to clear Trois Ponts. It failed.', rule: '23.8 Supply Phase', look: 51 },
  { title: 'Supply colours', text: '<b>Tap View.</b>', target: { el: '[data-tint]', label: 'View button' }, done: (_g, q) => q('.modal .chip[title^="Supply"]') },
  { title: 'Supply', text: '<b>Turn on Supply</b>: your supplied areas tint, cut-off ones show red.', target: { el: '.modal .chip[title^="Supply"]', label: 'Supply chip' }, done: (_g, q) => q('.modal .chip.on[title^="Supply"]') },
  close('.modal [aria-label="Close"]', '.modal', 'Close', '<b>Close the window.</b>'),
  tapUnit('1SS(-)', 'Malmedy', '<b>Tap the 1st SS in Malmedy.</b> Its panel shows the supply line: through Ligneuville back to Entry Area Z, no blown bridge, no enemy next to it.', '9.31 Supply paths'),
  tapUnit('62 VG', 'Vielsalm', '<b>Tap the 62nd VG.</b> It traces through St. Vith and Bucholz.'),
  tapUnit('Peiper', 'Werbomont', '<b>Tap KG Peiper.</b> Stoumont is next to the 1st Infantry (9.31c), Manhay holds the 168th Engineers\' roadblock, Trois Ponts is enemy-controlled: <b>cut off</b>, with the reason in its panel.'),
  { title: 'Supply checks', text: 'Each cut-off unit rolls morale now. <b>Tap Roll supply checks.</b>', rule: '9.4 Supply checks', target: { el: '.c-dispatch button', text: 'Roll', label: 'Roll button' }, enter: (g) => queue(g, [9, 9, 9]), done: (g) => !g.supplyPending, act: (g) => E.rollSupply(g) },
  recap('Supply: trace to an entry area through friendly areas, not over blown bridges, never into or next to uncontested enemy blocks. Cut-off blocks check morale in their own Supply step.'),
] };

/* ---------------- Lesson 9 · Second player turn and victory (23.9-23.10) ---------------- */
const L9: Lesson = { topic: 'Victory', ref: '23.9–23.10', setup: () => {
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  g.turn = 4; g.phase = 'movement'; g.log = [];
  for (const a of [27, 8, 47, 55, 75, 77]) g.control[a] = 'allied';
  for (const a of [33, 51]) g.control[a] = 'german';
  return g;
}, steps: [
  { title: 'The second player turn', text: 'After the German Supply step the <b>Allies</b> play the same sequence, drawing fewer chits. Online, the top bar says whose move it is; you see <b>Waiting…</b> while the other player acts, and you can chat.', rule: '23.9 Second Player Turn' },
  { title: 'Victory check', text: 'After both player turns comes the Victory Check. <b>Open the VP sheet.</b>', rule: '23.10 Victory Check Phase', target: { el: '.vps', label: 'VP strip' }, done: (_g, q) => q('.vsheet') },
  { title: 'Sudden death', text: 'From Turn 4, a lead equal to the turn\'s <b>Sudden Death</b> number wins at once. In the book\'s effective-defence example the Allies lead by 4 against a target of 5: one more objective would end it. Eliminated large units add to the score.' },
  { title: 'You know the whole turn', text: 'Prepare, Move, Fight, Breakthrough, Supply, for each side, then the Victory Check. Start a game: <b>Nuts!</b> is short (3 turns around Bastogne).' },
] };

/** Play the first `upTo` steps of a lesson in engine terms (Back, and the tests). */
export function replay(i: number, upTo: number): G {
  const L = LESSONS[i], g0 = L.setup(); let g = g0; const before: string[] = [];
  for (const s of L.steps.slice(0, upTo)) {
    if (s.skip?.(g)) continue;
    if (s.undo) { const p = before.pop(); if (p) g = JSON.parse(p); continue; }
    s.enter?.(g); if (s.auto || s.act) before.push(JSON.stringify(g)); s.auto?.(g); s.act?.(g);
  }
  return g;
}
export const LESSONS: Lesson[] = [L0, L1, L2, L3, L4, L5, L6, L7, L8, L9];
