/** The Bulge course (docs/TUTORIAL.md): four lessons of basics, then the Play Book's Examples of Play 23.1-23.10 as a turn played step by step.
 *  Engine only (no DOM), so the tests play every step. The player is the German side; the coach plays the Allies in the book's words. */
import { infoOf } from './tutorial-list';
import * as E from '../../engine/src';
import entryJson from '../../data/bulge/entry_areas.json';
import { type Course, type Lesson, type Step, type G, U, C, area, avail, sa, queue, stage, begin, answer, roll, fightAt, GO, bookDice, tapUnit, moveTo, closeStep, recap, situation, next, bulgeTable, pieces, blockAnatomy, strengths, bulgeBlock, bulgeWood, bulgeChit, bulgeGarrison } from './tutorial-kit';

export const ENTRY = entryJson as Record<string, { side: string; area: number }>;
const GREIF = E.keyOf(21, 37);
const campaign = () => { E.useGame('bulge'); const g = E.newGame(2007, { scenario: 'campaign', fuel: true }); g.phase = 'movement'; g.log = []; return g; };
const CH1 = 'Before you start', CH2 = 'A turn of play';
const closeModal = (text = '<b>Close the window.</b>') => closeStep('.modal [aria-label="Close"]', '.modal', 'Close it', text);

/* ================= Chapter 1 · Before you start ================= */
const L_WELCOME: Lesson = { id: 'welcome', topic: 'Welcome to the Ardennes', chapter: CH1, goal: 'What the game is about and how you win', minutes: 4, side: 'german', setup: campaign, steps: [
  situation('Welcome to the Ardennes', `It is <b>16 December 1944</b>. Three German armies attack through the Ardennes forest, hoping to reach the river Meuse before the Allies recover.
    <p>One player is <b>German</b>, the other <b>Allied</b>. Each turn is one day. In this course <b>you play the Germans</b> and the coach plays the Allies.</p>
    <p>Drag to look around the map, pinch or scroll to zoom. The coach never moves on without you.</p>`, { look: 23 }),
  { title: 'How you win', text: 'The strip under the top bar is the <b>score</b>. <b>Tap it.</b>', target: { el: '.vps', label: 'score strip' }, done: (_g, q) => q('.vsheet') },
  { title: 'Victory points', text: `Towns with a <b>star</b> are objectives. Each is worth victory points to the side that holds it. Some count for one side only, some for either.
    <p>Each big enemy unit you destroy is worth one point too. The <b>difference</b> between the two totals is the score you see.</p>`, rule: '19.0 Victory', why: 'A side controls an area when its blocks were the last to hold it alone. Objectives count only while the owner can trace supply to them.' },
  closeStep('.vsheet [aria-label="Close"]', '.vsheet', 'Two ways to win', `<b>Sudden death</b>: from turn 4, a lead equal to the number printed under that turn on the track wins at once.
    <p><b>At the end</b>: if nobody has won by then, the final score decides the winner. <b>Close the sheet.</b></p>`),
  { title: 'The two sides', text: `<b>Grey blocks</b> are German, <b>green</b> blocks American. The British, in blue, arrive later in the north.
    <p>A block stands upright with its face towards its owner. Your opponent sees only its colour: what the block is, and how strong, is hidden until you fight.</p>`, rule: '2.0 Game pieces',
    figure: (g) => pieces([{ svg: bulgeBlock(g, '2 Pz'), wood: bulgeWood(g, '2 Pz'), cap: 'German: 2nd Panzer Division' }, { svg: bulgeBlock(g, '106 Inf'), wood: bulgeWood(g, '106 Inf'), cap: 'American: 106th Infantry Division' }]) },
  { title: 'A turn in five steps', text: 'The top bar shows the five steps of a player turn and whose turn it is. <b>Tap the step names.</b>', target: { el: ['.c-crumbs', '.c-stat .tp'], label: 'step names' }, tap: true },
  { title: 'Prepare, Move, Fight, Breakthrough, Supply', text: `<ul><li><b>Prepare</b>: new units and chits arrive, you draw chits and play some.</li><li><b>Move</b>: your blocks move.</li><li><b>Fight</b>: a battle in every area where both sides stand.</li><li><b>Breakthrough</b>: reserves and winners move again, and fight again.</li><li><b>Supply</b>: cut-off blocks check morale.</li></ul>
    <p>The Germans play the five steps first, then the Allies play the same five. After both, the score is checked.</p>`, rule: '3.0 Sequence of play' },
  { title: 'The bottom bar', text: `The line at the bottom tells you <b>what the game expects now</b>. The red button <b>ends the step</b> when you are done. Next to it: <b>Undo</b>, and <b>ⓘ</b> which switches between short prompts and full explanations.
    <p>The chips above it are <b>shortcuts</b>: tap one to jump between the blocks that can act.</p>`, target: GO },
  { title: 'Terrain defence', text: 'The <b>Map</b> button on the map chooses what the map shows. <b>Tap Map, then TDN</b>: the darker an area, the harder it is to attack: its terrain defence number is taken off the attacker\'s dice.', target: { el: ['.laysw button[title="Terrain defence"]', '.mapmenu-btn'], label: 'TDN in the Map list' }, done: (_g, q) => q('.laysw button[aria-pressed="true"][title="Terrain defence"]'), rule: '6.3 Terrain Defense Number', why: 'Each area prints a TDN of 0, 1 or 2 in its number plate. Attacking ground fire into the area subtracts it from the Success Number.' },
  { title: 'Explanations', text: 'The <b>ⓘ</b> button sets how much the game explains. It stays on <b>full</b> during the course; after it, switch it off when the prompts get in the way.', target: { el: '.guidebtn', label: 'ⓘ button' } },
  recap(['The score strip: objectives held, big units destroyed, the difference between the sides.', 'Win at once from turn 4 with the lead printed on the turn track, or lead at the end.', 'Five steps per player turn: Prepare, Move, Fight, Breakthrough, Supply. Germans first, then Allies.', 'The bottom line says what to do; the red button ends the step.']),
] };

const L_BLOCKS: Lesson = { id: 'blocks', topic: 'Reading a block', chapter: CH1, goal: 'Steps, quality, unit type, and what a block shows you', minutes: 4, side: 'german', setup: campaign, steps: [
  situation('Reading a block', `Every block carries a sticker. Here is the 2nd Panzer Division.
    <ul><li><b>Steps</b>: the pips along the top edge. A hit takes one step; the block turns a quarter so the next edge is up.</li>
    <li><b>Quality</b>: the colour of the pips. <b>Red</b> elite, <b>black</b> veteran, <b>white</b> green. Quality can change as the block loses steps.</li>
    <li><b>Type</b>: an oval is armour, an X infantry, both together mechanised. Armour hits harder and moves further; infantry crosses rough ground.</li>
    <li>The small number at the top left: where it sets up, or the turn it arrives and its entry letters.</li></ul>`,
    { figure: (g) => blockAnatomy(bulgeBlock(g, '2 Pz'), bulgeWood(g, '2 Pz'), { pips: 'steps: 4 pips on top', quality: 'pip colour = quality', type: 'oval = armour', name: 'the division', code: 'sets up in area 21' }) }),
  { title: 'Losing steps', text: 'The same block as it loses steps. With its last step gone it is <b>eliminated</b>. Destroying a big unit, a division, gives the enemy a victory point.', rule: '2.2 Steps · 19.2',
    figure: (g) => strengths([4, 3, 2, 1].map((s) => bulgeBlock(g, '2 Pz', s)), bulgeWood(g, '2 Pz')) },
  tapUnit('2 Pz', 'Tap a block', '<b>Tap the 2nd Panzer in Marnach.</b> Its panel opens: name, steps and quality, what it can do now. The areas it can move to light up.', { rule: '5.3 Movement' }),
  { title: 'Status markers', text: `Small tags float above blocks that are in trouble:
    <ul><li><b>DIS</b> disordered: it absorbed a hit by falling back. It fights worse, moves only one area and never into an area with enemy blocks, and may not attack or build works. It recovers at the start of its own next turn.</li><li><b>OOS</b> out of supply: it failed to trace a line to its entry areas.</li><li><b>E</b> exploitation, <b>R</b> reserve: it may move again in Breakthrough.</li></ul>`, rule: '2.3 Unit status' },
  { title: 'Garrisons', text: 'Some towns start with a <b>garrison</b>: a flat chit standing in the area. Alone, it defends like a roadblock; with blocks beside it, it adds to their fight.', rule: '15.2 Garrisons', figure: () => pieces([{ svg: bulgeGarrison('St. Vith'), cap: 'The St. Vith garrison' }]) },
  recap(['Pips on the top edge are the steps; a hit turns the block one quarter.', 'Pip colour is quality: red elite, black veteran, white green.', 'Oval armour, X infantry, both mechanised.', 'Your opponent sees only the colour of your blocks until a battle.']),
] };

const L_MAP: Lesson = { id: 'map', topic: 'The map', chapter: CH1, goal: 'Areas, roads and fields, rivers, zones, who holds what', minutes: 4, side: 'german', setup: campaign, steps: [
  situation('Areas, not hexes', `The map is divided into named <b>areas</b>, each with a number. Blocks move from area to area across the boundary between them.
    <p>The cost depends on the <b>connection</b>: a <b>road</b> crossing the boundary costs <b>1</b> movement point, no road (a <b>field</b>) costs <b>2</b>. Infantry has 3 points per Move step, armour 6.</p>`, { look: 4 }),
  { title: 'Rivers and bridges', text: 'A blue boundary is a <b>river</b>. Where a road crosses it there is a <b>bridge</b>: 1 point, but the defender may try to blow it as you cross. Crossing a river without a road takes the whole move.', rule: '5.31 Boundaries · 5.35 Bridges', look: 21 },
  { title: 'Restricted boundaries', text: 'A dashed boundary is <b>restricted</b>, like the Schnee Eifel ridge here. Crossing it takes a block\'s whole move, and armour may not cross it at all.', rule: '5.34 Restricted boundaries', look: 11 },
  { title: 'Zones', text: 'The three German armies each have a <b>zone</b>. <b>Tap Map, then Zones</b>. A German block leaving its own army\'s zone pays <b>2 extra</b> points. Coming back costs nothing extra.', target: { el: ['.laysw button[title="Army zones"]', '.mapmenu-btn'], label: 'Zones in the Map list' }, done: (_g, q) => q('.laysw button[aria-pressed="true"][title="Army zones"]'), rule: '5.33 Army boundaries', why: 'Zone 5 (5th Panzer Army, centre), Zone 6 (6th Panzer Army, north) and Zone 7 (7th Army, south). Only German blocks are affected.' },
  { title: 'Who holds an area', text: `An area is <b>controlled</b> by the side whose blocks last held it alone. When blocks of both sides stand in it, it is <b>contested</b>, and a battle follows in the Fight step.
    <p>The lettered markers at the map edge are <b>entry areas</b>: new blocks arrive there, and supply lines must lead back to them.</p>`, rule: '2.4 Control · 4.1 Entry areas' },
  recap(['Road 1 point, field 2. Infantry has 3 points, armour 6.', 'Bridges can be blown; a river without a road, or a restricted boundary, takes the whole move.', 'German blocks pay 2 extra points to leave their army zone.', 'Contested area: both sides inside, a battle follows.']),
] };

const L_CHITS: Lesson = { id: 'chits', topic: 'Chits: assets and events', chapter: CH1, goal: 'The hand, the cup and the boxes, Special Actions', minutes: 4, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'admin', { '12 VG': 9, '2 Pz': 21, '110/28': 37, '18 VG': 11, '106 Inf': 23, 'CCB/9': 25 }, true);
  const ge = g.chits.filter((c) => c.side === 'german' && c.box !== 'eliminated');
  for (const c of ge) if (c.box === 'available') c.box = 'cup';
  const take = (k: string, n: number) => { for (const c of ge.filter((x) => x.kind === k && x.box !== 'available').slice(0, n)) c.box = 'available'; };
  take('artillery', 2); take('rocket_artillery', 1); take('engineer', 1); avail(g, ['R15.0', 'L17.0']); sa(g, 'german');
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  return g;
}, steps: [
  situation('Your hand', `The cards at the bottom are your <b>chits</b>. There are two kinds.
    <ul><li><b>Assets</b> are support you can commit: artillery, engineers, fuel, a battalion of armour or infantry, a command staff.</li>
    <li><b>Events</b> are one-off happenings: a replacement, a commando team, a reinforcement that arrives late.</li></ul>
    <p>Each chit carries its <b>turn of arrival</b> and the colour of the <b>army</b> it belongs to: an army's chits help only that army's blocks.</p>`,
    { figure: (g) => pieces([{ svg: bulgeChit(g, 'L31.0'), cap: 'Asset: rocket artillery' }, { svg: bulgeChit(g, 'L17.0'), cap: 'Event: replacement' }, { svg: bulgeChit(g, 'SA-german'), cap: 'The Special Action' }]) }),
  { title: 'Where chits live', text: '<b>Tap Pieces</b> to see the boxes.', target: { el: '[data-modal="boxes"]', label: 'Pieces button' }, done: (_g, q) => q('.modal') },
  { title: 'Cup, Available, Used', text: `<ul><li><b>Cup</b>: chits are drawn from it at random. The turn track says how many you draw each Prepare step.</li><li><b>Available</b>: your hand, playable now.</li><li><b>Used</b>: spent this turn. Next turn they go back into the cup.</li><li><b>Eliminated</b>: gone for good.</li></ul>`, rule: '4.1 Reinforcement · 4.2 Admin' },
  closeModal('<b>Close Pieces.</b>'),
  { title: 'The Special Action', text: `From turn 2 each side has a <b>reusable Special Action</b> block, plus a few one-off Special Action events. It is the joker of the game: <b>reinforce</b> a defence from a neighbouring area, let armour <b>advance</b> in Breakthrough, <b>attack again</b> in an area already contested, or <b>reroute</b> a reinforcement.`, rule: '8.0 Special Actions' },
  recap(['Assets are support you commit; events are one-off happenings.', 'Draw from the cup, play from Available, spent chits rest in Used for a turn.', 'A chit helps only the blocks of its own army.', 'The Special Action: reinforce, advance, attack again, reroute.']),
] };

/* ================= Chapter 2 · A turn of play (Play Book 23.1-23.10) ================= */
const L_REINF: Lesson = { id: 'reinforcement', topic: 'Reinforcement', chapter: CH2, ref: '23.1', goal: 'New units and chits arrive; the German artillery attrition', minutes: 5, side: 'german', setup: () => {
  E.useGame('bulge');
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  const ge = g.chits.filter((c) => c.side === 'german');
  for (const c of ge) if (c.box === 'available' && (c.kind === 'artillery' || c.kind === 'rocket_artillery' || c.kind === 'engineer')) c.box = 'used';
  for (const id of ['L31.0', 'L33.0']) C(g, id).box = 'available';
  const art = ge.filter((c) => c.kind === 'artillery' && c.box === 'used' && c.id !== 'L46.0'); if (art[0]) art[0].box = 'available';
  const eng = ge.filter((c) => c.kind === 'engineer' && c.box === 'used'); for (const c of eng.slice(1, 3)) c.box = 'available';
  g.turn = 1; g.phasing = 'allied'; g.phase = 'supply'; g.supplyPending = false; g.contestedAtMoveStart = E.contestedAreas(g);
  E.endPhase(g); g.log = []; return g;
}, steps: [
  situation('Turn 2 begins', `The first turn is over. Turn 2 opens with the <b>Reinforcement</b> step, which both players use to manage their resources.
    <p>Used chits go back into the cup, new chits and new blocks arrive, and the German player pays for his artillery's ammunition shortage.</p>`),
  { title: 'The Pieces window', text: '<b>Tap Pieces</b> to see where your chits are at the start of the turn.', target: { el: '[data-modal="boxes"]', label: 'Pieces button' }, done: (_g, q) => q('.modal') },
  { title: 'Start of turn 2', text: 'Three artillery and two engineer assets are still <b>Available</b>; twelve artillery and an engineer sit in <b>Used</b> after turn 1. The Special Action block has not arrived yet.', rule: '23.1 Reinforcement Phase' },
  closeModal('<b>Close Pieces.</b>'),
  { title: 'Artillery attrition', text: 'Every turn the German player must <b>eliminate one regular artillery</b> asset from his Used Box: the guns are short of shells. <b>Pick the 408th.</b>', rule: '16.12 Artillery attrition', why: 'Only regular artillery, never rocket artillery. If the Used Box has none, nothing is lost.', target: { el: '.c-dispatch .pc', text: '408', label: '408th Artillery' }, done: (g) => C(g, 'L46.0').box === 'eliminated', act: (g) => E.chooseArtyLoss(g, 'L46.0') },
  { title: 'Into the cup', text: `The game did the rest for you:
    <ul><li>the other twelve used assets went back into the <b>cup</b>;</li><li>the <b>Special Action</b> block arrived in Available;</li><li>the chits due on turn 2 went into the cup: von der Heydte, two artillery, an infantry asset, and the events Greif Team Interdict, Greif Team Bridge and Non-Elite Infantry Replacement.</li></ul>`, rule: '4.1 Reinforcement' },
  { title: 'The Allied side', text: 'The Allies do the same. They also receive two <b>Task Forces</b>; one goes to Houffalize, behind the German breakthrough at Weiswampach. Their new divisions arrive: the <b>10th Armored</b> in area N and the <b>1st Infantry</b>, reduced to one step, in area A. <b>Tap Show me.</b>', rule: '15.1 Task Forces', look: 36, auto: (g) => {
    const tf = g.chits.find((c) => c.side === 'allied' && c.kind === 'task_force' && c.box === 'available'); if (tf) try { E.placeTaskForce(g, tf.id, 36); } catch { /* the area may not take it */ }
    try { E.placeArrival(g, U(g, '10 Arm').id, ENTRY.N.area); } catch { /* */ } try { E.placeArrival(g, U(g, '1 Inf').id, ENTRY.A.area); } catch { /* */ }
  } },
  { title: 'The arrival tray', text: 'New blocks wait in the <b>tray</b> at the bottom until you place them. The <b>7th Armored</b> is the last one. <b>Tap it.</b>', target: { el: '[data-arr="B47"]', label: '7th Armored' }, tap: true, done: (g) => U(g, '7 Arm').area != null },
  { title: 'Entry area B', text: 'Its entry areas light up: a block arrives only at the letters printed on it. <b>Tap Entry Area B</b> to place it.', rule: '4.1 Arrivals', why: 'Another entry area costs a Special Action (8.27). A block that cannot arrive waits for the next turn.', target: { area: ENTRY.B.area }, look: ENTRY.B.area, done: (g) => U(g, '7 Arm').area != null, act: (g) => E.placeArrival(g, U(g, '7 Arm').id, ENTRY.B.area) },
  recap(['Reinforcement: used chits back into the cup, the turn\'s new chits into the cup, new blocks at their entry areas.', 'The German player eliminates one regular artillery asset every turn.', 'From turn 2 the reusable Special Action is in your hand each turn.']),
] };

const L_ADMIN: Lesson = { id: 'admin', topic: 'Prepare: drawing and playing chits', chapter: CH2, ref: '23.2', goal: 'Draw from the cup, play events and assets, end the step', minutes: 5, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'admin', { '12 VG': 9, '2 Pz': 21, '110/28': 37, '18 VG': 11, '106 Inf': 23, 'CCB/9': 25 }, true);
  U(g, '12 VG').str = 2;
  const ge = g.chits.filter((c) => c.side === 'german' && c.box !== 'eliminated');
  for (const c of ge) if (c.box === 'available') c.box = 'cup';
  const take = (k: string, n: number) => { for (const c of ge.filter((x) => x.kind === k && x.box !== 'available').slice(0, n)) c.box = 'available'; };
  take('artillery', 3); take('rocket_artillery', 1); take('engineer', 1); take('infantry_asset', 1); take('armor_asset', 1); avail(g, ['R15.0', 'L17.0']);
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name)); if (dr) dr.box = 'available';
  avail(g, ['L63.0', 'L88.0', 'L65.0', 'L62.0']);
  return g;
}, steps: [
  situation('The Prepare step', `Both players <b>draw</b> from their cups: the turn track says how many. On turn 2 the German player draws nine, the Allied player seven.
    <p>You drew seven assets and two events: <b>Greif Team Bridge</b> and <b>Non-Elite Infantry Replacement</b>. Chits you can play now <b>glow</b> in your hand.</p>`),
  { title: 'Greif Team Bridge', text: 'German commandos in American uniform seize a bridge. <b>Tap Greif Team Bridge</b> in your hand.', rule: '17.12 Greif Team Bridge', why: 'With the team on a bridge, the Allied player needs a 1 to blow it instead of 5 or less.', target: { el: ['.card2[data-chit="R15.0"]', '.handtab button'], label: 'Greif Team Bridge card' }, done: (_g, q) => q('.chitbar', 'Greif') },
  { title: 'Which bridge', text: 'The 2nd Panzer in Marnach faces the river to Lullange. <b>Tap Marnach</b>, the area on your side of the bridge.', target: { area: 21 }, look: 21, tap: true, done: (g) => !!g.greif[GREIF] },
  { title: 'Across the river', text: '<b>Tap Lullange.</b> The team now holds the Marnach–Lullange bridge.', target: { area: 37 }, look: 37, done: (g) => !!g.greif[GREIF], act: (g) => E.playGreifBridge(g, 'R15.0', 21, 37) },
  { title: 'Replacements', text: 'The 12th VG lost a step at Udenbreth on turn 1. <b>Tap Non-Elite Infantry Replacement.</b> Its colour says it belongs to the 6th Panzer Army, like the 12th VG.', target: { el: ['.card2[data-chit="L17.0"]', '.handtab button'], label: 'Replacement card' }, done: (g, q) => q('.chitbar', 'Non-Elite') || U(g, '12 VG').str === 3 },
  { title: 'The 12th VG', text: '<b>Tap the 12th VG in Udenbreth</b>: it gets its step back.', rule: '13.0 Replacements', why: 'A replacement event restores one step to a reduced block of its army. It cannot bring back an eliminated block.', target: { unit: '12 VG' }, look: 9, done: (g) => U(g, '12 VG').str === 3, act: (g) => E.playReplacement(g, 'L17.0', U(g, '12 VG').id) },
  { title: 'The Allied side', text: 'The Allied player drew seven: an event with no effect (<b>Delayed Response</b>, discarded) and engineers. The <b>35th Engineers</b> in Ligneuville blow the bridges to St. Vith and Malmedy; the <b>168th</b> in Vielsalm those to Malmedy and Baraque de Fraiture. <b>Tap Show me</b> and watch the blown-bridge markers.', rule: '15.3 Blowing bridges', look: 24, auto: (g) => {
    const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name) && c.box === 'available'); if (dr) dr.box = 'eliminated';
    E.blowBridges(g, 'L63.0', 25, [23, 33]); E.blowBridges(g, 'L88.0', 24, [33, 35]);
  } },
  { title: 'End the step', text: 'Both players act in the Admin phase. Online, the other player taps <b>Done</b> first, then you end the step. <b>Tap End admin.</b>', target: GO, done: (g) => g.phase !== 'admin', act: (g) => E.endPhase(g) },
  recap(['Prepare: draw the turn track\'s number of chits, then play what helps you now.', 'Greif teams make bridges almost impossible to blow; replacements restore a step.', 'Engineers can blow bridges in their own Prepare step.', 'The red button ends a step; online, both players must be done.']),
] };

const L_MOVE: Lesson = { id: 'movement', topic: 'Movement', chapter: CH2, ref: '23.3', goal: 'Roads and fields, zones, ridges, fuel, bridges, reserves', minutes: 7, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'movement', { '26 VG': 4, '116 Pz': 4, '2 Pz': 21, '110/28': 37, Lehr: 13, '560 VG': 22 });
  U(g, '110/28').disorder = 1;
  C(g, 'R15.0').box = 'map'; g.greif[GREIF] = 'R15.0'; avail(g, ['L65.0']);
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  return g;
}, steps: [
  situation('The Move step', `Now your blocks move. In Prüm, at the edge of the 5th Panzer Army's zone, stand the <b>26th VG</b> (infantry, 3 points) and the <b>116th Panzer</b> (armour, 6 points). Both want to reach St. Vith.
    <p>Tap a block and the areas it can reach light up: <b>green</b> you can go there, <b>brass</b> you can go there but must stop.</p>`, { look: 4 }),
  tapUnit('26 VG', 'Select the infantry', '<b>Tap the infantry block in Prüm.</b>'),
  moveTo('26 VG', 5, 'Leaving the army zone', '<b>Tap Losheim.</b> The road costs 1 point, but Losheim is in the 6th Panzer Army\'s zone: leaving your own zone costs 2 more. All 3 points spent, the block must stop.', { rule: '5.33 Army boundaries' }),
  { title: 'Undo', text: 'A move can be taken back as long as nothing has been revealed or rolled. <b>Tap Undo.</b>', target: { el: '[data-undo]', label: 'Undo' }, undo: true, done: (g) => area('26 VG', g) === 4 },
  tapUnit('26 VG', 'Try another way', '<b>Tap the infantry again.</b>'),
  moveTo('26 VG', 11, 'The Schnee Eifel', '<b>Tap Bleialf.</b> The ridge between Prüm and Bleialf is a restricted boundary: crossing it takes the whole move. Armour could not cross here at all.', { rule: '5.34 Restricted boundaries' }),
  tapUnit('116 Pz', 'Now the armour', '<b>Tap the armour block in Prüm.</b>'),
  moveTo('116 Pz', 23, 'By road to St. Vith', '<b>Tap St. Vith.</b> Through Pronsfeld and Lutzkampen the roads cost 1 point each: 3 in all. German armour needs a <b>fuel</b> asset only to spend more than 3 points in a move, so this one is free.', { rule: '16.13 Fuel', why: 'A road connection costs 1 MP even if the roads drawn inside the area do not join up. The 2 MP zone penalty would have applied through Losheim.' }),
  tapUnit('2 Pz', 'A river crossing', 'In Marnach the <b>2nd Panzer</b> faces the 110/28th across the river, on the bridge your Greif team holds. <b>Tap the 2nd Panzer.</b>'),
  { title: 'Into Lullange', text: '<b>Tap Lullange.</b> Entering an enemy area over a bridge gives the defender one chance to blow it.', target: { area: 37 }, look: 37, done: (g) => !!g.pendingBlow || area('2 Pz', g) === 37, act: (g) => { E.move(g, U(g, '2 Pz').id, 37); } },
  { title: 'The bridge is blown', text: 'The Allied player needs a 1 because of your Greif team, so he plays the <b>159th Engineers</b>: now 5 or less blows it. In the book he rolls a 1: <b>blown</b>. The 2nd Panzer started next to the river, so it still wades across, spending all its points, and fights a <b>river assault</b>: its fire will be weaker.', rule: '5.35 Bridges · 17.12', skip: (g) => !g.pendingBlow, auto: (g) => { C(g, 'L65.0').box = 'used'; queue(g, [1]); E.resolveBlow(g, true); } },
  tapUnit('Lehr', 'Reserve', 'Panzer Lehr waits in Dasburg. A block that does not move can be put in <b>reserve</b>. <b>Tap it.</b>'),
  { title: 'Mark it as reserve', text: '<b>Tap Reserve.</b> A reserve block may move later in the turn: in Strategic movement, in the enemy\'s turn (Reaction) or in Breakthrough.', rule: '14.8 Reserves', why: 'Each side has a few reserve markers, in the Pieces window. A block in reserve must be supplied, in good order and in an uncontested area.', target: { el: '.c-dispatch button', text: 'Reserve', label: 'Reserve button' }, done: (g) => !!U(g, 'Lehr').reserve, act: (g) => E.setReserve(g, U(g, 'Lehr').id, true) },
  { title: 'Fortify', text: 'A block that stays put may instead build <b>field works</b> (the Fortify button): the first hit on it in a battle removes the works instead of a step. The chips above the bottom bar list the blocks that can move, fortify or go into reserve.', rule: '5.23 Field works', target: { el: ['.dchip', '.c-bar.b'], label: 'shortcuts' } },
  { ...moveTo('560 VG', 37, 'Your turn', 'The <b>560th VG</b> in Weiswampach could join the 2nd Panzer in Lullange: 1 point for the road, 1 more because the area is occupied. <b>Move it there.</b>', { kind: 'try', why: 'Tap the block, then Lullange. Entering an occupied area, friendly or enemy, costs +1 MP (5.32).' }), target: { area: 37, label: 'Lullange' } },
  recap(['Road 1 point, field 2; +1 to enter an occupied area; +2 to leave your army zone.', 'A restricted boundary or a river without a road takes the whole move.', 'German armour needs fuel beyond 3 points.', 'A blown bridge means a river assault: weaker fire for the attacker.', 'Reserve and field works are decided in the Move step.']),
] };

const L_STRAT: Lesson = { id: 'strategic', topic: 'Strategic movement', chapter: CH2, ref: '23.4', goal: 'Reserves race along the roads', minutes: 3, side: 'allied', setup: () => {
  const g = bulgeTable(3, 'allied', 'movement', { 82: 96, 101: 87, Lehr: 47, '2 Pz': 49 });
  E.setReserve(g, U(g, '82').id, true, true); E.setReserve(g, U(g, '101').id, true, true);
  g.phase = 'strategic'; g.stratMoves = 0; return g;
}, steps: [
  situation('Turn 3, the Allied side', `For this lesson you sit on the <b>Allied</b> side. The Germans have taken Bastogne and a gap opens in the line. The <b>82nd</b> and <b>101st Airborne</b> arrived at Givet and La Chapelle and were put in reserve.
    <p>After Move comes <b>Strategic movement</b>: reserve blocks may travel any distance by road through friendly, uncontested areas. It is the fastest way to bring reinforcements to the front.</p>`, { look: 62 }),
  tapUnit('82', 'The 82nd', '<b>Tap the 82nd Airborne.</b>', { rule: '5.4 Strategic movement' }),
  { ...moveTo('82', 62, 'La Roche', '<b>Tap La Roche.</b> Every area on the way is friendly and empty of enemies, so the distance does not matter.'), act: (g) => E.stratMove(g, U(g, '82').id, 62) },
  tapUnit('101', 'The 101st', '<b>Tap the 101st.</b>'),
  { ...moveTo('101', 74, 'Champlon', '<b>Tap Champlon.</b> Both divisions now fill the gap.'), act: (g) => E.stratMove(g, U(g, '101').id, 74) },
  recap(['Only reserve blocks strat-move: by road, through friendly uncontested areas, never over a blown bridge.', 'Limits per turn: 3 Allied moves, 1 German (and the German move costs a fuel asset).', 'The reserve marker is spent by the move.']),
] };

const L_COMBAT: Lesson = { id: 'combat', topic: 'Combat', chapter: CH2, ref: '23.5', goal: 'The round of combat, the fire report, hits and the abort', minutes: 7, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'combat', { '18 VG': 23, '106 Inf': 23, 'Garrison St. Vith': 23, 'CCB/9': 25, '62 VG': 11 });
  g.control[23] = 'allied'; U(g, '106 Inf').str = 1; sa(g, 'allied'); return g;
}, steps: [
  situation('The Fight step', `The <b>18th VG</b> entered St. Vith, held by the <b>106th Infantry</b> (one step left) and the town garrison. Every contested area must be fought.
    <p>A battle is <b>one round</b> in a fixed order: <b>1</b> both sides commit assets, <b>2</b> artillery fires (attacker, then defender), <b>3</b> the defender's blocks fire, <b>4</b> the attacker's blocks fire, <b>5</b> each side takes its hits, <b>6</b> the winner may try to exploit.</p>`, { look: 23 }),
  { title: 'Choose a battle', text: 'Contested areas are outlined. <b>Tap St. Vith.</b>', rule: '6.1 Combat', target: { area: 23 }, look: 23, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight St. Vith.</b> The battle table opens.', target: GO, done: (g) => !!g.battle, act: fightAt(23) },
  { title: 'The defender reinforces', text: 'Before the fight the Allied player spends his <b>Special Action</b> to pull the <b>CCB/9th Armored</b> in from Ligneuville. A block that has just arrived may not be the point unit, so the <b>106th</b> must take the front.', rule: '8.23 Reinforce before combat', why: 'The point unit is the block that absorbs the enemy ground fire and that the enemy fire is measured against. Its class and quality shape every Success Number.', auto: (g) => { const b = g.battle!; E.defenderReinforceSA(g, b, U(g, 'CCB/9').id, 'SA-allied'); answer(g); E.setPoint(g, b, 'allied', U(g, '106 Inf').id); } },
  { title: 'The battle table', text: 'Each side has its blocks, its <b>point unit</b> marked in gold, and a row for the assets it commits. Nobody commits artillery here. <b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'The fire report', text: `The defender fires first. Each line is one firer: <b>dice × Success Number</b>. A die at or under the number is a <b>hit</b>. The chips say why the number moved: <b>+1</b> armour firing, <b>−1</b> green troops firing on veterans. <b>Tap Roll.</b>`, rule: '6.27 Defensive ground fire', why: 'The base Success Number is 5. A block rolls one die per step. Modifiers: unit class, quality against the point unit\'s quality, terrain, river assault, field works.', target: GO,
    enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: 'CCB/9', sn: 6, dice: [5] }, { who: 'Garrison', sn: 4, dice: [5] }, { who: '106', sn: 4, dice: [1] }])), done: stage('defFire'), act: roll },
  { title: 'Two hits on you', text: `The attacker takes hits in a fixed order. The <b>first</b> hit is always a step loss: the 18th VG turns one step. For the <b>second</b> you may choose: another step, or <b>abort</b> the attack. Aborting absorbs every remaining hit, but all your attackers become disordered. <b>Tap Abort.</b>`, rule: '6.41 Attacker hit priorities', target: { el: ['.c-dispatch button', 'button'], text: 'Abort', label: 'Abort button' }, done: (g) => !!g.battle?.result || !g.battle, act: (g) => E.attackerChoice(g, g.battle!, true) },
  { title: 'Close the battle', text: 'The attack is over before the 18th VG could fire: the Allies hold St. Vith. <b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap(['A battle is one round: assets, artillery, defender fire, attacker fire, hits, exploitation.', 'Dice at or under the Success Number hit. Read the chips to see why the number moved.', 'The attacker\'s first hit is a step loss; afterwards he may abort, disordering his blocks.', 'A Special Action lets the defender reinforce from a neighbouring area.']),
] };

const L_EXPLOIT: Lesson = { id: 'exploitation', topic: 'Artillery and exploitation', chapter: CH2, ref: '23.6', goal: 'Committing assets, the defender\'s hits, the exploitation check', minutes: 7, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'combat', { '116 Pz': 22, '112/28': 22, Lehr: 13 });
  g.control[22] = 'allied'; for (const a of [3, 12, 13, 21]) g.control[a] = 'german'; avail(g, ['L31.0', 'L33.0', 'L62.0']); return g;
}, steps: [
  situation('Weiswampach', `The <b>116th Panzer</b> crossed into Weiswampach, where the <b>112/28th</b> regiment stands alone and without field works. This time both sides commit artillery, and a clean win may let the armour <b>exploit</b>: move on in the Breakthrough step.`, { look: 22 }),
  { title: 'Choose the battle', text: '<b>Tap Weiswampach.</b>', target: { area: 22 }, look: 22, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Weiswampach.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(22) },
  { title: 'Commit artillery', text: 'Your artillery chits glow. <b>Tap the 15th Rocket</b> to commit it.', rule: '6.22 Assets', target: { el: ['.card2[data-chit="L31.0"]', '.handtab button'], label: '15th Rocket card' }, done: (g) => !!g.battle?.assets.german.includes('L31.0'), act: (g) => E.assign(g, g.battle!, 'L31.0') },
  { title: 'A second battery', text: '<b>Tap the 401st.</b> Two artillery assets in one battle must be one regular and one rocket battery. A pair the rules refuse is greyed out, and the card says why.', rule: '16.12 Artillery limits', target: { el: ['.card2[data-chit="L33.0"]', '.handtab button'], label: '401st card' }, done: (g) => !!g.battle?.assets.german.includes('L33.0'), act: (g) => E.assign(g, g.battle!, 'L33.0') },
  { title: 'The Allied artillery', text: 'The Allied player answers with the <b>333rd Artillery</b>. <b>Tap Show me.</b>', auto: (g) => { answer(g); E.assign(g, g.battle!, 'L62.0'); } },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'Your artillery fires', text: 'Artillery rolls one die per asset: "2 tries for a 5". No field works, so no modifier. <b>Roll.</b>', rule: '6.25 Artillery fire', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'arty', [{ who: '15th', sn: 5, dice: [6] }, { who: '401', sn: 5, dice: [10] }, { who: '', sn: 5, dice: [6, 10] }])), done: stage('attArty'), act: roll },
  { title: 'Allied artillery', text: '"1 try for a 4": −1 because your point unit is armour, which artillery finds hard to hurt. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'arty', [{ who: '', sn: 4, dice: [9] }])), done: stage('defArty'), act: roll },
  { title: 'Defensive fire', text: 'The 112/28th fires: veteran against an elite armour point unit, so −1 and −1: "1 try for a 3". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: '112', sn: 3, dice: [4] }])), done: stage('defFire'), act: roll },
  { title: 'The 116th fires', text: 'Three steps, three dice. +1 armour, +1 elite on veteran, −1 for the terrain: "3 tries for a 6". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 6, dice: [1, 6, 5] }])), done: stage('offFire'), act: roll },
  { title: 'Three hits on the defender', text: `The defender's order is different: field works first (none here), then a <b>retreat</b> absorbs one hit (the block falls back, disordered), then step losses. The 112/28th retreats for the first hit; the second eliminates its only step; the third is wasted. <b>Tap Show me.</b>`, rule: '6.42 Defender hit priorities', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]); } },
  { title: 'Exploitation', text: 'The area is clear and the defender took more hits than it could absorb: the 116th may roll for <b>exploitation</b>. A morale check: 5, +2 for elite, "1 try for a 7". <b>Roll.</b>', rule: '6.8 Exploitation', why: 'Only armour-class attackers, only when the defenders are all gone and at least one hit was in excess. Never after a river assault.', target: GO, skip: (g) => g.battle?.stage !== 'exploit', enter: (g) => queue(g, [6]), done: (g) => !g.battle || g.battle.stage === 'done', act: roll },
  { title: 'Marked for exploitation', text: 'The 116th Panzer carries an <b>E</b> tag: it may move one more area in the Breakthrough step. <b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap(['Artillery fires first: one die per asset, two assets only as regular + rocket.', 'The defender absorbs hits with field works, then a retreat, then step losses.', 'Armour that clears an area with hits to spare rolls morale to exploit.']),
] };

const BLOW_OK: Step = { title: 'No bridge blown', text: 'The Allied engineers are all spent: nobody tries to blow this bridge, and the block crosses.', skip: (g) => !g.pendingBlow, auto: (g) => { E.resolveBlow(g, false); } };
const L_BREAK: Lesson = { id: 'breakthrough', topic: 'Reaction and Breakthrough', chapter: CH2, ref: '23.7', goal: 'The enemy reacts, then three ways to press on', minutes: 8, side: 'german', setup: () => {
  const g = bulgeTable(2, 'german', 'movement', { '116 Pz': 22, 'CCR/9': 36, Lehr: 13, '150 Pz': 12, '106 Inf': 24 });
  E.setReserve(g, U(g, 'Lehr').id, true, true); U(g, '116 Pz').exploit = true;
  for (const a of [21, 22, 12, 13]) g.control[a] = 'german';
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
  sa(g, 'german'); for (const u of g.units) u.moved = true; for (const n of ['116 Pz', 'Lehr', '150 Pz']) U(g, n).moved = false;
  g.phase = 'reaction'; g.fought = []; return g;
}, steps: [
  situation('After the battles', `The Fight step is over: the 116th Panzer holds Weiswampach with an <b>E</b> tag, Panzer Lehr waits in reserve at Dasburg, the 150th Panzer Brigade at Lutzkampen. Your Special Action is in hand.
    <p>First the enemy gets a chance to <b>react</b>, then you <b>break through</b>.</p>`, { look: 22 }),
  { title: 'Reaction', text: 'In <b>Reaction</b> the other player may move his <b>reserve</b> blocks, even into contested areas. The Allied divisions that arrived this turn could not be put in reserve yet, so the Allies have nothing to react with. <b>Tap Show me.</b>', rule: '7.1 Reaction', auto: (g) => { while (g.phase === 'reaction') E.endPhase(g); } },
  tapUnit('116 Pz', 'Three ways to move', 'In <b>Breakthrough</b> only three kinds of block move. First, an <b>exploiting</b> block: <b>tap the 116th Panzer.</b>', { rule: '7.3 Breakthrough movement' }),
  { title: 'One area forward', text: '<b>Tap Houffalize.</b> An exploiting block moves exactly one area. The CCR/9th is there, so a battle follows.', target: { area: 36 }, look: 36, done: (g) => area('116 Pz', g) === 36 || !!g.pendingBlow, act: (g) => { E.move(g, U(g, '116 Pz').id, 36); } },
  BLOW_OK,
  tapUnit('Lehr', 'Reserve', 'Second, a <b>reserve</b> block makes a full move: <b>tap Panzer Lehr.</b>'),
  { title: 'With fuel to Vielsalm', text: '<b>Tap Vielsalm.</b> Marnach 2, Weiswampach 1, Vielsalm 1 plus 1 for the 106th standing there: 5 points. Beyond 3 German armour needs <b>fuel</b>; the route panel shows the asset spent.', rule: '16.13 Fuel', target: { area: 24 }, look: 24, done: (g) => area('Lehr', g) === 24 || !!g.pendingBlow, act: (g) => { E.move(g, U(g, 'Lehr').id, 24); } },
  BLOW_OK,
  tapUnit('150 Pz', 'Special Action', 'Third, a <b>Special Action</b> lets an armour block that did neither advance one area: <b>tap the 150th Panzer Brigade.</b>'),
  { title: 'Activate', text: '<b>Tap Activate (SA).</b> The Special Action is spent.', rule: '8.21 Breakthrough activation', target: { el: '.c-dispatch button', text: 'Activate', label: 'Activate (SA)' }, done: (g) => !!U(g, '150 Pz').exploit || area('150 Pz', g) === 22 || g.chits.find((c) => c.id === 'SA-german')?.box !== 'available', act: (g) => E.activateBreakthrough(g, U(g, '150 Pz').id, 'SA-german') },
  { title: 'Into Weiswampach', text: '<b>Tap Weiswampach</b>: one area forward.', target: { area: 22 }, look: 22, done: (g) => area('150 Pz', g) === 22, act: (g) => { E.move(g, U(g, '150 Pz').id, 22); } },
  { title: 'Breakthrough combat', text: '<b>Tap End breakthrough moves.</b> Areas contested by these moves must be fought now. An area that was already contested can be fought again only with a Special Action.', rule: '7.4 Breakthrough combat', target: GO, done: (g) => g.phase === 'btCombat', act: (g) => E.endPhase(g) },
  { title: 'Houffalize', text: '<b>Tap Houffalize</b>, then Fight.', target: { area: 36 }, look: 36, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Houffalize</b>.', target: GO, done: (g) => !!g.battle && g.battle.stage !== 'setup', act: (g) => { fightAt(36)(g); begin(g); } },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, skip: (g) => g.battle?.stage !== 'setup', done: stage('setup'), act: begin },
  { title: 'The CCR/9th fires', text: '"1 try for a 5": +1 armour, −1 veteran on elite, −1 against an armour point unit, +1 because the 116th crossed the river. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: 'CCR', sn: 5, dice: [5] }])), done: stage('defFire'), act: roll },
  { title: 'The 116th fires back', text: 'One hit: a step loss, and the 116th goes on. Two steps left, so two dice; −1 river assault, −1 terrain, −1 armour target: "2 tries for a 3". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 3, dice: [1, 9] }])), done: stage('offFire'), act: roll },
  { title: 'The defender retreats', text: 'One hit: the CCR/9th absorbs it by retreating to Noville, disordered. <b>Tap Show me.</b>', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') { const o = E.retreatOptions(g, b); E.chooseRetreat(g, b, o.includes(48) ? 48 : o[0]); } } },
  { title: 'Close', text: '<b>Tap Close battle.</b>', target: GO, skip: (g) => !g.battle, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  { title: 'Vielsalm', text: 'Now the second battle. <b>Tap Vielsalm</b>, then Fight.', target: { area: 24 }, look: 24, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Vielsalm.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(24) },
  { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
  { title: 'The 106th fires', text: 'Green troops against an elite armour point unit: "3 tries for a 2". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: '106', sn: 2, dice: [6, 4, 10] }])), done: stage('defFire'), act: roll },
  { title: 'Panzer Lehr fires', text: 'Four steps, four dice: +1 armour, +2 elite on green, −1 terrain: "4 tries for a 7". <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: 'Lehr', sn: 7, dice: [1, 9, 5, 8] }])), done: stage('offFire'), act: roll },
  { title: 'Two hits', text: 'The 106th retreats to Baraque de Fraiture for the first hit and loses a step for the second. No exploitation is possible in Breakthrough combat. <b>Tap Show me.</b>', auto: (g) => { const b = g.battle!; if (b.stage === 'defChoice') E.defenderChoice(g, b, true); if (b.stage === 'retreat') { const o = E.retreatOptions(g, b); E.chooseRetreat(g, b, o.includes(35) ? 35 : o[0]); } } },
  { title: 'Close', text: '<b>Tap Close battle.</b>', target: GO, skip: (g) => !g.battle, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap(['Reaction: the other player moves his reserve blocks.', 'Breakthrough: exploiting blocks one area, reserve blocks a full move, a Special Action activates armour for one area.', 'Newly contested areas must be fought at once; no exploitation comes out of these battles.']),
] };

const L_SUPPLY: Lesson = { id: 'supply', topic: 'Supply', chapter: CH2, ref: '23.8', goal: 'Tracing a supply line, and what happens when it breaks', minutes: 5, side: 'german', setup: () => {
  const g = bulgeTable(3, 'german', 'btCombat', { Peiper: 51, '18 VG': 34, 'CCB/9': 34, '1SS(-)': 33, '3 FJ': 25, '62 VG': 24, '1 Inf': 52 });                                    // the Play Book has the 1st Infantry in Aywaille; under the 2016 series rules (9.31) it must hold Stoumont to cut Peiper off
  for (const a of [5, 6, 10, 23, 24, 25, 33, 51]) g.control[a] = 'german';
  for (const a of [34, 50, 35, 52, 53]) g.control[a] = 'allied';
  g.blown = [E.keyOf(34, 24), E.keyOf(34, 33), E.keyOf(25, 23)];
  const eng = C(g, 'L88.0'); eng.box = 'map';
  g.units.push({ id: 'DR-L88.0', name: '168th (defended roadblock)', side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: 50, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: eng.ech, chitId: 'L88.0' });
  g.contestedAtMoveStart = E.contestedAreas(g); g.fought = [...g.contestedAtMoveStart];
  E.endPhase(g); g.log = []; return g;
}, steps: [
  situation('The Supply step', `Turn 3. <b>KG Peiper</b> raced to Werbomont, counting on the 18th VG to clear Trois Ponts behind him. The 18th failed.
    <p>In the Supply step each of your blocks must trace a <b>line</b> back to one of your entry areas: through areas you control (contested ones too), never into an area the enemy controls, and not over a blown bridge.</p>`, { look: 51 }),
  { title: 'Supply', text: '<b>Tap Map, then Supply</b>. Your supplied areas take your colour; cut-off ones are striped.', target: { el: ['.laysw button[title^="Supply"]', '.mapmenu-btn'], label: 'Supply in the Map list' }, done: (_g, q) => q('.laysw button[aria-pressed="true"][title^="Supply"]') },
  tapUnit('1SS(-)', 'Malmedy', '<b>Tap the 1st SS in Malmedy.</b> Its panel shows the line: through Ligneuville back to Entry Area Z, no blown bridge, no enemy-held area on the way.', { rule: '9.31 Supply paths' }),
  tapUnit('62 VG', 'Vielsalm', '<b>Tap the 62nd VG.</b> It traces through St. Vith and Bucholz.'),
  tapUnit('Peiper', 'Werbomont', '<b>Tap KG Peiper.</b> The 1st Infantry has retaken Stoumont, Manhay holds the 168th Engineers\' roadblock, Trois Ponts is enemy-controlled: every way out of Werbomont is held by the enemy. <b>Cut off</b>. The panel says why.', { why: 'A line may run out of a contested area you do not control (9.31b) and through contested areas you do control (9.31c), but never into or through an area the enemy controls.' }),
  { title: 'Supply checks', text: 'Each cut-off block rolls a <b>morale check</b> now; failing it, it loses a step. Until it is supplied again it moves one area at a time and gets no assets. <b>Tap Roll supply checks.</b>', rule: '9.4 Supply checks', target: { el: ['.c-bar.b .go', '.c-bar.b button'], text: 'Roll', label: 'Roll button' }, enter: (g) => queue(g, [9, 9, 9]), done: (g) => !g.supplyPending, act: (g) => E.rollSupply(g) },
  recap(['A supply line runs to an entry area through areas you control, contested or not, never through enemy-held ones or over blown bridges.', 'Cut-off blocks check morale in their own Supply step and lose a step when they fail.', 'Turn the Supply view on before you move far ahead.']),
] };

const L_VICTORY: Lesson = { id: 'victory', topic: 'The Allied turn and victory', chapter: CH2, ref: '23.9–23.10', goal: 'The second player turn, the victory check, your first game', minutes: 3, side: 'german', setup: () => {
  E.useGame('bulge');
  const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
  g.turn = 4; g.phase = 'movement'; g.log = [];
  for (const a of [27, 8, 47, 55, 75, 77]) g.control[a] = 'allied';
  for (const a of [33, 51]) g.control[a] = 'german';
  return g;
}, steps: [
  situation('The Allied turn', `After your Supply step the <b>Allies</b> play the same five steps. A few things differ: they draw fewer chits on the second player turn, they lose no artillery, they may strat-move three blocks.
    <p>Online, the top bar says whose move it is. While the other player acts you see <b>Waiting…</b>, and you can chat.</p>`, { look: 47 }),
  { title: 'The victory check', text: 'After both player turns comes the <b>Victory Check</b>. <b>Open the score sheet.</b>', rule: '19.0 Victory', target: { el: '.vps', label: 'score strip' }, done: (_g, q) => q('.vsheet') },
  { title: 'Sudden death', text: 'In this turn 4 position the Allies hold six objectives and the Germans two: a lead of 4. The sudden-death number for turn 4 is <b>5</b>: one more objective, or one big German unit destroyed, would end the game. An objective counts only while its owner can trace supply to it.', rule: '19.3 Sudden Death' },
  closeStep('.vsheet [aria-label="Close"]', '.vsheet', 'Close the sheet', '<b>Close the sheet.</b> That is the whole turn.'),
  { title: 'You know the whole turn', kind: 'recap', text: `<ul><li>Reinforce, Prepare, Move, Fight, Breakthrough, Supply, for each side, then the Victory Check.</li><li>Roads and fuel carry the attack; rivers, ridges and zones slow it.</li><li>Commit assets before the dice, watch the abort, trace supply before the check.</li></ul><p>Pick a game: <b>Nuts!</b> is a three-turn fight around Bastogne; the Tournament scenario is five full turns. The in-game ⓘ button keeps the full explanations.</p>` },
] };

export const BULGE_COURSE: Course = {
  ...infoOf('bulge'),
  lessons: [L_WELCOME, L_BLOCKS, L_MAP, L_CHITS, L_REINF, L_ADMIN, L_MOVE, L_STRAT, L_COMBAT, L_EXPLOIT, L_BREAK, L_SUPPLY, L_VICTORY],
  end: [{ label: 'Start a Nuts! game', scenario: 'intro', primary: true }, { label: 'Start the Tournament', scenario: 'tournament' }],
};
export const next_ = next;
