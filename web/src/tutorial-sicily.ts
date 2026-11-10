/** The Sicily lessons (docs/TUTORIAL.md), built on the Exclusive Rules and the Play Book's Examples of Play. Two courses share them:
 *  "learn to play" for a first game, and "what's new" for players who know The Bulge. Engine only (no DOM), so the tests play every step. */
import { infoOf } from './tutorial-list';
import * as E from '../../engine/src';
import { type Course, type Lesson, type G, U, avail, queue, stage, begin, roll, fightAt, GO, bookDiceSeq, tapUnit, moveTo, closeStep, recap, situation, sicilyStart, sicilyTable, pieces, blockAnatomy, sicilyBlock, sicilyWood, sicilyChit } from './tutorial-kit';

const S = E.sicily;
const CH1 = 'Before you start', CH2 = 'The Sicily turn', CHN = 'What changes on Sicily';
const closeModal = (text = '<b>Close the window.</b>') => closeStep('.modal [aria-label="Close"]', '.modal', 'Close it', text);
const card = (id: string, label: string) => ({ el: [`.card2[data-chit="${id}"]`, '.handtab button'], label });
const panelBtn = (text: string, label: string) => ({ el: ['.volpanel button', '.c-dispatch button', 'button'], text, label });
/** Play out the rest of a battle with the book's choices for the defender: retreat (to `to` when it may), then take the losses. */
const finishBattle = (to?: number) => (g: G) => {
  const b = g.battle!;
  for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
    else if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
    else if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
    else if (b.stage === 'retreat') { const r = E.retreatOptions(g, b); if (r.length) E.chooseRetreat(g, b, to != null && r.includes(to) ? to : r[0]); else E.defenderChoice(g, b, false); }
    else if (b.stage === 'exploit') E.declineExploit(g, b);
    else E.roll_step(g, b);
  }
};
const box = (code: string) => S.boxId(code);

/* ================= Before you start ================= */
const L_WELCOME: Lesson = { id: 's-welcome', topic: 'Welcome to Sicily', chapter: CH1, goal: 'Operation Husky, the two sides and how you win', minutes: 4, side: 'allied', setup: () => sicilyStart(), steps: [
  situation('Welcome to Sicily', `It is the night of <b>9 to 10 July 1943</b>. Operation Husky: the US 7th Army and the British 8th Army land on the south-east coast of Sicily, held by the Italian 6th Army and two German divisions.
    <p>One player is the <b>Allies</b>, the other the <b>Axis</b>. A turn is about two days; the Tournament lasts five turns, the Campaign nine. The Allies move first. In this course you sit on whichever side the example is about, mostly the Allies.</p>
    <p>Drag to look around, pinch or scroll to zoom. The coach waits for you.</p>`, { look: 19 }),
  { title: 'How you win', text: 'The strip under the top bar is the <b>score</b>. <b>Tap it.</b>', target: { el: '.vps', label: 'score strip' }, done: (_g, q) => q('.vsheet') },
  { title: 'Victory points', text: `<ul><li>The <b>Axis</b> starts ahead: it holds every objective on the island at the start (white and yellow stars).</li>
    <li>The <b>Allies</b> score the crosses and the yellow stars they hold, occupied and supplied, and every Axis large unit destroyed.</li>
    <li>A <b>beachhead</b> the Axis captures scores for the Axis for the rest of the game.</li></ul>`, rule: '19.0 Victory' },
  closeStep('.vsheet [aria-label="Close"]', '.vsheet', 'When the game ends', 'The turn track prints the <b>sudden death</b> lead from turn 4; otherwise the final score decides. <b>Close the sheet.</b>'),
  { title: 'Four nations', text: '<b>Green</b> blocks are American, <b>blue</b> British and Canadian, <b>grey</b> German, <b>orange</b> Italian. As in every FAB game a block stands with its face to its owner: the enemy sees only its colour.', rule: '2.0 Game pieces',
    figure: (g) => pieces([{ svg: sicilyBlock(g, 'US03'), wood: sicilyWood(g, 'US03'), cap: 'US 1st Infantry' }, { svg: sicilyBlock(g, 'BR07'), wood: sicilyWood(g, 'BR07'), cap: 'British 51st Infantry' }, { svg: sicilyBlock(g, 'GE04'), wood: sicilyWood(g, 'GE04'), cap: 'Hermann Göring' }, { svg: sicilyBlock(g, 'IT01'), wood: sicilyWood(g, 'IT01'), cap: 'Italian Livorno' }]) },
  { title: 'The turn', text: 'The top bar shows the phases of a player turn. <b>Tap the phase names.</b>', target: { el: ['.c-crumbs', '.c-stat .tp'], label: 'phase names' }, tap: true },
  { title: 'Phase by phase', text: `<ul><li><b>Reinforcement</b>: units, assets and events arrive; Allied units at the beachheads and ports, German ones at Messina.</li><li><b>Admin</b>: both sides draw chits and play some.</li><li><b>Movement</b> and <b>Strategic</b>: your blocks move, and land.</li><li><b>Combat</b>: a battle wherever both sides stand.</li><li><b>Reaction</b> and <b>Breakthrough</b>: the enemy reacts, then you press on.</li><li><b>Supply</b>: cut-off blocks check morale.</li></ul>
    <p>The Allies play the turn, then the Axis. On turn 1 the Admin Phase is skipped: the invasion fleet is already off the beaches.</p>`, rule: '3.0 Sequence of play · 22.27' },
  { title: 'The bottom bar', text: 'The line at the bottom says <b>what the game expects now</b>; when nothing is owed, the red button <b>ends the phase</b>. Next to it, <b>Undo</b> and <b>ⓘ</b>. The chips are shortcuts to the blocks that can act.', target: { el: '.c-bar.b', label: 'bottom bar' } },
  recap(['Allies against Axis: four nations, each block faces its owner.', 'The Axis starts ahead; the Allies score the objectives they hold, occupied and supplied.', 'A captured beachhead scores for the Axis.', 'Turn 1 opens with the Allied Movement Phase: the landings.']),
] };

const L_BLOCKS: Lesson = { id: 's-blocks', topic: 'Blocks on Sicily', chapter: CH1, goal: 'Divisions, motorized Italians, untried coastal garrisons', minutes: 5, side: 'allied', setup: () => sicilyStart(), steps: [
  situation('Reading a block', `The sticker works as in every FAB game: <b>pips</b> on the top edge are the steps, their <b>colour</b> the quality (red elite, black veteran, white green), the <b>symbol</b> the type.
    <p>Most Allied divisions come as <b>two blocks</b> with the same name.</p>`,
    { figure: (g) => blockAnatomy(sicilyBlock(g, 'US07'), sicilyWood(g, 'US07'), { pips: '4 steps', quality: 'red = elite, black = veteran', type: 'X = infantry', name: '45th Infantry' }) }),
  { title: 'Divisional integrity', text: 'When <b>both blocks of a division</b> fight in the same battle, the division rolls <b>one extra die</b>. Keep divisions together.', rule: '15.2 Divisional integrity',
    figure: (g) => pieces([{ svg: sicilyBlock(g, 'US05'), wood: sicilyWood(g, 'US05'), cap: '3rd Infantry' }, { svg: sicilyBlock(g, 'US06'), wood: sicilyWood(g, 'US06'), cap: '3rd Infantry' }]) },
  { title: 'Untried coastal garrisons', text: `The Italian coast was held by <b>29 coastal garrisons</b> nobody could size up, not even their own commanders. They are shuffled <b>face down</b> and stay face down for <b>both</b> players until their first battle. Most are one green step; four have two; one is a veteran with two.
    <p>When revealed they check morale, and a green untried garrison gets <b>no bonuses</b> to its fire. Survive one battle and it becomes a <b>tried</b> unit like any other.</p>`, rule: '15.3 Italian untried units',
    figure: (g) => pieces([{ svg: sicilyBlock(g, 'IT09'), wood: sicilyWood(g, 'IT09'), cap: 'Coastal garrison: 1 green step' }, { svg: sicilyBlock(g, 'IT37'), wood: sicilyWood(g, 'IT37'), cap: 'The one veteran garrison' }]) },
  { title: 'Only one may stir', text: 'Untried garrisons mostly hold their ground: in each Movement Phase <b>only one</b> of them may move, build field works or go into reserve. And they slow nobody down: entering an area held only by untried units costs no congestion point.', rule: '15.3a · 14.42' },
  { title: 'Motorized Italians', text: 'The two <b>Livorno</b> blocks are motorized: 3 points like infantry, or <b>6</b> if the whole move neither enters nor leaves an enemy-occupied area.', rule: '15.1 Motorized units', look: 40,
    figure: (g) => pieces([{ svg: sicilyBlock(g, 'IT01'), wood: sicilyWood(g, 'IT01'), cap: 'Livorno: motorized' }]) },
  tapUnit('GE01', 'The German reserve', '<b>Tap the 15th Panzergrenadier in Regalbuto.</b> It starts in <b>reserve</b>: it may move in the Reaction Phase of the Allied turn, after seeing the landings.', { rule: '14.25' }),
  recap(['Two blocks of one division in a battle roll an extra die.', 'Untried garrisons stay face down for both sides until their first battle, then check morale.', 'Only one untried garrison may act per Movement Phase.', 'Livorno is motorized: 6 points away from the enemy.']),
] };

const L_MAP: Lesson = { id: 's-map', topic: 'The map', chapter: CH1, goal: 'Landing boxes, ports, army zones, Mount Etna, rivers, Messina', minutes: 6, side: 'allied', setup: () => sicilyStart(), steps: [
  situation('Landing boxes', `Around the coast, the blue boxes with dotted white arrows are the <b>landing boxes</b>: A1–A4 and B1–B6 are the historical landing sites, D1–D13 the western alternatives. Each points at one coastal area.
    <p>The Allied player puts <b>beachhead markers</b> on some of them at the start. Invasion units and reinforcements arrive on beachheads, two per box, and land into the area the arrow points at.</p>`, { look: 19 }),
  { title: 'Ports', text: 'The four big blue boxes are the <b>ports</b>: Syracuse and Catania (British), Palermo (American), Messina (German). An Allied port works only once the port area is held, occupied by the right army and <b>undamaged</b>; the Axis can damage it twice with engineers. Units arriving by port may land and keep moving.', rule: '14.51 Ports', look: 26 },
  { title: 'Army zones', text: 'Grey lines with white dashes split the island into <b>zones</b> A to D. With the historical plan the British stay in zone B and the Americans in A and C; a <b>release</b> (a Special Action, or the 7th Army Release event) opens more. Americans never enter zone B, the British never zone D.', rule: '14.3 · 14.4 Army boundaries', look: 24 },
  { title: 'Mount Etna', text: 'Etna is ringed by <b>restricted terrain</b>, the tufted line. Infantry crosses it only with its whole move; armour never, except by road when its own side controls the volcano.', rule: '14.11 Restricted terrain', look: 27 },
  { title: 'Rivers and bridges', text: 'Every river boundary has a bridge. The defender may try to <b>blow</b> it the first time an enemy crosses (a 5 or less). Crossing a blown bridge takes the whole move, and an attack across one is a <b>river assault</b>.', rule: '5.35 · 14.22 Bridges', look: 15 },
  { title: 'Messina', text: 'Messina is the Axis lifeline: German reinforcements arrive through its port, and Axis supply traces to it. Late in the game Axis units may <b>evacuate</b> from Messina to the mainland.', rule: '14.29 Evacuation · 14.9 Supply', look: 29 },
  recap(['Allied units arrive on beachheads, two per box, and land where the arrow points.', 'Ports work only when held, occupied by the right army and undamaged.', 'Army zones: British B, Americans A and C, until released.', 'Etna: infantry only, whole move; armour by road if its side holds it.', 'Blown bridges and river assaults; Messina feeds the Axis.']),
] };

const L_CHITS: Lesson = { id: 's-chits', topic: 'Chits on Sicily', chapter: CH1, goal: 'Air and naval support, Rangers and Commandos, engineers, events', minutes: 4, side: 'allied', setup: () => sicilyStart(), steps: [
  situation('Your chits', `Chits are <b>assets</b> and <b>events</b>, drawn from the cup into the Available Box in the Admin Phase. An asset helps the blocks of its own army: American assets American blocks, British ones British blocks.`,
    { figure: (g) => pieces([{ svg: sicilyChit(g, 'USC06a'), cap: 'Air support' }, { svg: sicilyChit(g, 'USC07a'), cap: 'Naval support' }, { svg: sicilyChit(g, 'USC01'), cap: 'Rangers' }, { svg: sicilyChit(g, 'BRC01'), cap: 'Commandos' }]) }),
  { title: 'Air support', text: 'An <b>air support</b> asset flies one mission: <b>interdiction</b> of an area in the Admin Phase (+1 point to enter and to leave it), <b>ground support</b> in a battle, or <b>air supply</b> for cut-off blocks. The other side may answer any of them with a <b>dogfight</b>: one of its own air assets cancels the mission.', rule: '16.31–16.34' },
  { title: 'Naval support', text: 'A <b>naval support</b> asset works only in coastal areas. Fired as artillery, or used for <b>shock and awe</b>: it removes the defending field works before anyone fires. A used naval asset is lost at the next Reinforcement Phase unless a Special Action saves it.', rule: '16.21 Naval support' },
  { title: 'Rangers and Commandos', text: 'Elite infantry assets. A <b>Ranger</b> or <b>Commando</b> may remove the field works instead of rolling. The <b>3rd Commando</b> can also make a <b>flanking invasion</b> behind the Axis line in the Admin Phase.', rule: '16.22 · 17.22 Flanking invasion' },
  { title: 'Engineers and events', text: '<b>Engineers</b> blow and repair bridges, build field works, and <b>damage or repair ports</b>. Among the events: the <b>7th Army Release</b>, <b>Fading Italian Morale</b>, the Axis <b>Tactical Extract</b>, and <b>Patton</b> slapping a soldier.', rule: '14.51 · 17.0 Events',
    figure: (g) => pieces([{ svg: sicilyChit(g, 'USC12'), cap: 'Engineers' }, { svg: sicilyChit(g, 'USC23'), cap: '7th Army Release' }, { svg: sicilyChit(g, 'ALC01a'), cap: 'Fading Italian Morale' }]) },
  { title: 'The Pieces window', text: '<b>Tap Pieces.</b> Next to the usual boxes Sicily has the <b>Captured Airfields</b> box (each airfield the Allies take brings another air asset) and the <b>Captured Ports and VP areas</b> box (where the Fading Italian Morale events wait).', target: { el: '[data-modal="boxes"]', label: 'Pieces button' }, done: (_g, q) => q('.modal') },
  closeModal('<b>Close Pieces.</b>'),
  recap(['Assets help their own army only.', 'Air support: interdiction, ground support or air supply; a dogfight cancels a mission.', 'Naval support and Rangers can remove field works.', 'Captured airfields and ports feed the Allied cup.']),
] };

const L_SETUP: Lesson = { id: 's-setup', topic: 'Setting up the invasion', chapter: CH1, ref: 'Ex 1', goal: 'Garrisons face down, the landing plan, the invasion units', minutes: 4, side: 'allied', setup: () => { E.useGame('sicily'); const g = E.newGame(1943, { scenario: 'tournament' }); g.log = []; return g; }, steps: [
  situation('Before the landing', `The Axis sets up first. Its regular divisions stand in their historical areas; what the Axis player decides is where the <b>29 coastal garrisons</b> go. They are shuffled face down, so he picks the areas but never knows which garrison lands where.
    <p>Then the Allied player, seeing only orange blocks, picks a <b>landing plan</b>.</p>`, { look: 19 }),
  { title: 'The garrisons', text: 'The tray holds one face-down stack: drag it to a lit area and a garrison is drawn at random, one per area, never with two tried units. <b>Tap Place the rest for me.</b>', rule: '22.24', target: panelBtn('random', 'Place the rest for me'), done: (g) => !g.units.some((u) => u.untried && u.box === 'deploy'), act: (g) => S.autoGarrisons(g) },
  { title: 'The landing plan', text: `<b>Historical</b>: the British on five boxes in zone B, the Americans on A1–A4. <b>Alternate</b>: the British across zones A and B, the Americans on four boxes in the west, zone D, near Palermo.
    <p>Keep Historical and B1. <b>Tap Place the beachheads.</b></p>`, rule: '22.25 · 22.26', target: panelBtn('Place the beachheads', 'Place the beachheads'), done: (g) => !!S.state(g).plan, act: (g) => S.choosePlan(g, 'historical', 'B1') },
  { title: 'Field works on the coast', text: 'Every coastal area pointed at by a beachhead and held by an Axis block now has <b>field works</b>. The invasion units go on the beachheads, two per box; the two airborne divisions wait in the Airborne Assault box. <b>Tap Place the rest for me.</b>', rule: '22.24 · 14.24', target: panelBtn('Place the rest for me', 'Place the rest for me'), done: (g) => !g.units.some((u) => !u.untried && u.box === 'deploy'), act: (g) => S.autoLanding(g) },
  { title: 'End the set-up', text: '<b>Tap End set-up.</b> The game opens with the <b>Allied Movement Phase</b> of turn 1.', target: GO, done: (g) => g.phase === 'movement', act: (g) => E.endPhase(g) },
  recap(['The Axis places its garrisons face down: it chooses the areas, not the units.', 'Field works go where an Axis block holds an invasion-capable area.', 'The Allies choose the historical or the alternate plan after seeing the orange blocks.']),
] };

/* ================= The Sicily turn ================= */
/** Joss (A1) and Dime (A2) as in Example 14: the 3rd Infantry off Licata, the 1st Infantry off Gela, a garrison in each, dug in. */
const husky = (phase: E.Phase, landed: boolean) => () => {
  const at = (a: number, b: string) => (landed ? a : box(b));
  const g = sicilyTable(1, 'allied', phase, { US05: at(20, 'A1'), US06: at(20, 'A1'), US03: at(19, 'A2'), US04: at(19, 'A2'), IT09: 20, IT37: 19, GE04: 17 });
  g.fieldWorks = [19, 20]; g.fwOwner = { 19: 'axis', 20: 'axis' };
  if (landed) { g.riverAssault = [19, 20]; S.state(g).beachAssault = { 20: box('A1'), 19: box('A2') }; for (const id of ['US03', 'US04', 'US05', 'US06']) U(g, id).moved = true; g.control[19] = 'axis'; g.control[20] = 'axis'; }
  avail(g, ['USC01', 'USC07a']); return g;
};
const L_LANDING: Lesson = { id: 's-landing', topic: 'The landings', chapter: CH2, ref: 'Ex 9', goal: 'From the beachheads into the coastal areas, against the garrisons', minutes: 4, side: 'allied', setup: husky('movement', false), steps: [
  situation('D-Day', `Turn 1, Movement Phase. The <b>3rd Infantry</b> waits in <b>Joss (A1)</b> off Licata, the <b>1st Infantry</b> in <b>Dime (A2)</b> off Gela. A face-down garrison holds each town, dug in.
    <p>Landing takes a unit's <b>whole move</b> and needs no road: the arrow is the only way out of the box.</p>`, { look: 19 }),
  tapUnit('US05', 'The 3rd Infantry', '<b>Tap a 3rd Infantry block in Joss.</b> Only Licata lights up: the area its arrow points at.', { rule: '14.26 Landing' }),
  moveTo('US05', 20, 'Land at Licata', '<b>Tap Licata.</b> Landing against defenders makes a <b>beach assault</b>.', { rule: '14.27b Beach assault' }),
  tapUnit('US06', 'The second block', 'Keep the division together for its extra die. <b>Tap the other 3rd Infantry block.</b>'),
  moveTo('US06', 20, 'Licata again', '<b>Tap Licata.</b>'),
  tapUnit('US03', 'Gela', 'Now the 1st Infantry. <b>Tap a block in Dime.</b>'),
  moveTo('US03', 19, 'Land at Gela', '<b>Tap Gela.</b>'),
  { ...moveTo('US04', 19, 'Your turn', 'Land the last block of the 1st Infantry at Gela.'), kind: 'try', why: 'Tap the block left in Dime, then Gela.' },
  { title: 'End the move', text: 'A unit left in a landing box at the end of the phase goes back <b>to sea</b> and lands next turn. Everyone is ashore: <b>tap End movement.</b>', rule: '14.26', target: GO, done: (g) => g.phase !== 'movement', act: (g) => E.endPhase(g) },
  { title: 'To the battles', text: 'Nothing to strat-move. <b>Tap End move.</b> In the Combat Phase both beaches must be fought.', target: GO, skip: (g) => g.phase !== 'strategic', done: (g) => g.phase === 'combat', act: (g) => E.endPhase(g) },
  recap(['From a beachhead a unit lands only where the arrow points, for its whole move.', 'Landing against defenders is a beach assault (a river assault marker).', 'Units left in a box go back to sea.']),
] };

const L_BEACH: Lesson = { id: 's-beach', topic: 'Beach assault', chapter: CH2, ref: 'Ex 14', goal: 'Untried garrisons revealed, naval support, Rangers, no turning back', minutes: 9, side: 'allied', setup: husky('combat', true), steps: [
  situation('Licata and Gela', `Both beach assaults from the last lesson, fought as in the Play Book. You hold the <b>1st Ranger</b> and a <b>naval support</b> asset. In a beach assault your blocks fire at −1 and the defender at +1 against them.
    <p>And there is no turning back: an aborted beach assault <b>retreats to sea</b> and the Axis <b>captures the beachhead</b>, worth points to the Axis for the rest of the game.</p>`, { look: 20 }),
  { title: 'Choose Licata', text: '<b>Tap Licata.</b>', target: { area: 20 }, look: 20, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Licata.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(20) },
  { title: 'Commit the Rangers', text: '<b>Tap the 1st Ranger</b> in your hand. An elite asset that fires beside the 3rd Infantry.', rule: '16.22 Rangers', target: card('USC01', '1st Ranger card'), done: (g) => !!g.battle?.assets.allied.includes('USC01'), act: (g) => E.assign(g, g.battle!, 'USC01') },
  { title: 'Begin', text: '<b>Tap Begin combat.</b> The blocks are revealed, and the face-down garrison with them. An untried garrison checks <b>morale</b> at once: a green one needs a 3 or less. The book rolls a <b>5</b>.', rule: '15.3b', target: GO, enter: (g) => queue(g, [5]), done: stage('setup'), act: begin },
  { title: 'A green garrison, disordered', text: 'One green step, now <b>disordered</b>. It fires with no bonus at all, not even the +1 against a beach assault, and −1 for the disorder: "1 try for a 3". The book rolls a 9: a miss. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDiceSeq(g, 'axis', 'ground', [{ sn: 2, dice: [9] }])), done: stage('defFire'), act: roll },
  { title: 'Your fire', text: 'Two 3rd Infantry blocks, four dice each, the division\'s <b>extra die</b>, and the Ranger. The panel shows each number: +1 veteran on green, −1 for the field works, −1 for the beach assault. The book scores <b>six hits</b>. <b>Roll.</b>', rule: '15.2 · 6.5 Ground fire', target: GO, enter: (g) => queue(g, bookDiceSeq(g, 'allied', 'ground', [{ sn: 6, dice: [2, 4, 5, 9] }, { sn: 6, dice: [1, 6, 8, 9] }, { sn: 7, dice: [5] }, { sn: 6, dice: [10] }])), done: stage('offFire'), act: roll },
  { title: 'The garrison is gone', text: 'The field works absorb the first hit, a retreat to Butera the second, the third eliminates it. No exploitation from an assault. <b>Tap Show me.</b>', auto: finishBattle(21) },
  { title: 'Close the battle', text: '<b>Tap Close battle.</b> Licata is yours.', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  { title: 'Choose Gela', text: '<b>Tap Gela.</b>', target: { area: 19 }, look: 19, tap: true, done: (g) => !!g.battle },
  { title: 'Fight', text: '<b>Tap Fight Gela.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(19) },
  { title: 'Naval support', text: '<b>Tap the Naval Support</b> in your hand.', rule: '16.21', target: card('USC07a', 'Naval Support card'), done: (g) => !!g.battle?.assets.allied.includes('USC07a'), act: (g) => E.assign(g, g.battle!, 'USC07a') },
  { title: 'Shock and awe', text: 'Instead of firing, it can flatten the defences. <b>Tap Naval Support</b> in the Shock and Awe panel: the field works go before anyone fires.', target: panelBtn('Naval Support', 'Shock and Awe button'), done: (g) => S.state(g).navalShock['19'] === 'USC07a', act: (g) => S.setNavalShock(g, g.battle!, 'USC07a') },
  { title: 'Begin', text: '<b>Tap Begin combat.</b> This garrison is the <b>veteran</b> one, two steps: it needs a 5. The book rolls a <b>5</b>: it holds.', target: GO, enter: (g) => queue(g, [5]), done: stage('setup'), act: begin },
  { title: 'The veteran fires', text: 'A tried-quality veteran keeps its bonuses: +1 against a beach assault, two dice, "2 tries for a 6". The book rolls 1 and 5: <b>two hits</b>. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDiceSeq(g, 'axis', 'ground', [{ sn: 6, dice: [1, 5] }])), done: stage('defFire'), act: roll },
  { title: 'No way back', text: 'The first hit is a step loss. For the second you could abort: in a beach assault that means back to sea and a lost beachhead. <b>Tap Take losses.</b>', rule: '6.41 · 14.27b', target: panelBtn('Take losses', 'Take losses button'), skip: (g) => g.battle?.stage !== 'attChoice', done: (g) => g.battle?.stage !== 'attChoice', act: (g) => E.attackerChoice(g, g.battle!, false) },
  { title: 'The 1st Infantry fires', text: 'The naval bombardment has removed the field works. Three dice a block now, plus the division\'s extra die. The book scores <b>three hits</b>. <b>Roll.</b>', target: GO, enter: (g) => queue(g, bookDiceSeq(g, 'allied', 'ground', [{ sn: 5, dice: [2, 4, 6] }, { sn: 5, dice: [5, 8, 9] }, { sn: 5, dice: [9] }])), done: stage('offFire'), act: roll },
  { title: 'Barely enough', text: 'A retreat into Niscemi absorbs one hit, two step losses eliminate the veteran garrison. Without the naval support its field works would have saved it. <b>Tap Show me.</b>', auto: finishBattle(18) },
  { title: 'Close the battle', text: '<b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
  recap(['A face-down garrison is revealed in its first battle and checks morale: green 3, veteran 5.', 'A green untried garrison fires with no bonus at all.', 'Naval support or Rangers remove field works; naval support does it before anyone fires.', 'Never abort a beach assault: the units go to sea and the Axis takes the beachhead.']),
] };

const L_ZONES: Lesson = { id: 's-zones', topic: 'Army boundaries', chapter: CH2, ref: 'Ex 5', goal: 'Zones, releasing a division with a Special Action', minutes: 4, side: 'allied', setup: () => {
  const g = sicilyTable(2, 'allied', 'admin', { BR03: 26, BR04: 26, BR07: 14 }); avail(g, ['BRC15']); return g;
}, steps: [
  situation('Catania', `Turn 2, Admin Phase. The British <b>5th Infantry</b> holds Catania, in zone B. With the historical plan the 8th Army may not leave zone B until its divisions are <b>released</b>; Regalbuto, inland, is zone A.
    <p>A British division is released only by a <b>Special Action</b>, one division at a time (with one of the independent brigades if you like).</p>`, { look: 26 }),
  { title: 'The Special Action', text: '<b>Tap the Special Action</b> in your hand.', target: card('BRC15', 'Special Action card'), done: (_g, q) => q('.card2.sel[data-chit="BRC15"]') },
  { title: 'Release', text: '<b>Tap Release a division</b> among the choices above the hand.', target: { el: '.modes button[title^="Release"]', label: 'Release a division' }, done: (_g, q) => q('.modes button.on[title^="Release"]') },
  { title: 'The 5th Infantry', text: '<b>Tap a 5th Infantry block</b> in Catania.', rule: '14.61 Release', target: { unit: 'BR03' }, done: (g) => S.state(g).released.includes('br_5th_inf'), act: (g) => S.releaseDivision(g, 'br_5th_inf', 'BRC15') },
  { title: 'To the move', text: 'Released, the 5th may operate in zones A, B and C; never D. <b>Tap End prepare.</b>', target: GO, done: (g) => g.phase === 'movement', act: (g) => { for (let i = 0; i < 4 && g.phase !== 'movement'; i++) E.endPhase(g); } },
  tapUnit('BR03', 'Inland', '<b>Tap a 5th Infantry block.</b> Regalbuto, in zone A, now lights up; before the release it stayed dark.'),
  moveTo('BR03', 25, 'Regalbuto', '<b>Tap Regalbuto.</b>'),
  recap(['Historical plan: British in zone B, Americans in A and C, until released.', 'A Special Action releases one division; the 7th Army Release event frees every American division.', 'Americans never enter zone B, the British never zone D.']),
] };

const L_PORT: Lesson = { id: 's-port', topic: 'Ports', chapter: CH2, ref: 'Ex 4', goal: 'A damaged port, and the engineers who repair it', minutes: 3, side: 'allied', setup: () => {
  const g = sicilyTable(3, 'allied', 'admin', { US03: 57 }, { plan: 'alternate', br: 'A3', us: 'D2' }); U(g, 'US03').str = 1; S.state(g).portDamage.P3 = 2; avail(g, ['USC19']); return g;
}, steps: [
  situation('Palermo', `This time the Allies chose the <b>alternate plan</b>: the Americans landed in the west, on D2–D5. A battered <b>1st Infantry</b> block now holds <b>Palermo</b>. The port box is still unusable: the Axis left it at <b>damage 2</b>.
    <p>A port works for the Allies only when its area is held, supplied, occupied by the right army, and <b>undamaged</b>.</p>`, { look: 57 }),
  { title: 'The engineers', text: '<b>Tap the 540th Engineers</b> in your hand.', target: card('USC19', '540th Engineers card'), done: (_g, q) => q('.card2.sel[data-chit="USC19"]') },
  { title: 'Repair', text: '<b>Tap Repair a port</b> among the choices.', target: { el: '.modes button[title^="Repair a port"]', label: 'Repair a port' }, done: (_g, q) => q('.modes button.on[title^="Repair a port"]') },
  { title: 'Palermo', text: '<b>Tap Repair Palermo.</b> One level per port per Admin Phase: damage 2 becomes damage 1.', rule: '14.51', target: panelBtn('Repair Palermo', 'Repair Palermo button'), done: (g) => S.state(g).portDamage.P3 === 1, act: (g) => S.portWork(g, 'USC19', 'P3') },
  { title: 'Still closed', text: 'One more engineer in a later Admin Phase opens it. The Axis may damage it again only if it retakes Palermo and supplies it. Until then American reinforcements still come over the beachhead.', rule: '14.51' },
  recap(['Ports: held, supplied, occupied by the right army, undamaged.', 'Engineers repair one level per port per Admin Phase; the Axis damages up to two.', 'Units arriving by port may land and keep moving.']),
] };

const L_AIR: Lesson = { id: 's-air', topic: 'Interdiction and dogfights', chapter: CH2, ref: 'Ex 3', goal: 'The Allies slow the Axis; one German plane answers', minutes: 4, side: 'axis', setup: () => {
  const g = sicilyTable(2, 'axis', 'admin', { IT05: 57, IT06: 58, GE02: 59, GE03: 59, US03: 19 }); avail(g, ['USC06a', 'USC06b', 'GEC04']); return g;
}, steps: [
  situation('The west moves east', `Turn 2. Your units in the west want to march east to the landings: the <b>Aosta</b> blocks at Palermo and Alcamo, two <b>15th Panzergrenadier</b> blocks at Salemi.
    <p>The Allied player answers in the Admin Phase with <b>interdiction</b> over Bolognetta and Salemi: +1 point to enter and +1 to leave each. <b>Tap Show me.</b></p>`, { look: 57 }),
  { title: 'Two interdictions', text: 'Two Allied air support assets now sit over <b>Bolognetta</b> and <b>Salemi</b>. <b>Tap Show me</b> to see them placed.', rule: '16.33 Interdiction', auto: (g) => { S.airInterdiction(g, 'USC06a', 56); S.airInterdiction(g, 'USC06b', 59); } },
  { title: 'Your one plane', text: 'You have one <b>air support</b> asset. <b>Tap it</b> in your hand.', target: card('GEC04', 'Air Support card'), done: (_g, q) => q('.card2.sel[data-chit="GEC04"]') },
  { title: 'Dogfight', text: '<b>Tap Dogfight</b> among the choices.', target: { el: '.modes button[title^="Dogfight"]', label: 'Dogfight' }, done: (_g, q) => q('.modes button.on[title^="Dogfight"]') },
  { title: 'Free the panzers', text: '<b>Tap Salemi.</b> Your plane cancels that mission; Bolognetta stays interdicted until your Supply Phase.', rule: '16.31 Dogfight', target: { area: 59 }, look: 59, done: (g) => !g.interdicted[59], act: (g) => S.dogfightInterdiction(g, 'GEC04', 59) },
  { title: 'To the move', text: '<b>Tap End prepare.</b>', target: GO, done: (g) => g.phase === 'movement', act: (g) => { for (let i = 0; i < 4 && g.phase !== 'movement'; i++) E.endPhase(g); } },
  tapUnit('IT05', 'Aosta at Palermo', '<b>Tap the Aosta block in Palermo.</b> Into Bolognetta costs 2 with the interdiction, and leaving it 2 more: three points do not get it through.', { rule: '16.33' }),
  tapUnit('GE02', 'The panzers', '<b>Tap a 15th Panzergrenadier block in Salemi.</b> Thanks to the dogfight it leaves freely: south to Castelvetrano and along the coast road east.'),
  recap(['Interdiction: +1 to enter and +1 to leave the area, no strat-move through it.', 'A dogfight cancels one enemy air mission, in any phase it is flown.', 'An interdiction stays until the other side\'s Supply Phase.']),
] };

const L_MORALE: Lesson = { id: 's-morale', topic: 'Fading Italian morale', chapter: CH2, ref: 'Ex 10', goal: 'Captured ports and objectives wear the Italians down', minutes: 3, side: 'allied', setup: () => {
  const g = sicilyTable(3, 'allied', 'admin', { BR05: 5, BR06: 4 }); avail(g, ['ALC01a']); return g;
}, steps: [
  situation('Syracuse has fallen', `Each port and each mutual objective the Allies take puts a <b>Fading Italian Morale</b> event into their cup. You hold one now.
    <p>Each one played makes the Italians worse, three levels in all.</p>`, { look: 5 }),
  { title: 'The event', text: '<b>Tap Fading Italian Morale</b> in your hand.', target: card('ALC01a', 'Fading Italian Morale card'), done: (_g, q) => q('.card2.sel[data-chit="ALC01a"]') },
  { title: 'Play it', text: '<b>Tap Italian morale fades.</b>', rule: '17.21', target: panelBtn('morale fades', 'Italian morale fades'), done: (g) => S.state(g).morale === 1, act: (g) => S.playFadingMorale(g, 'ALC01a') },
  { title: 'An Italian asset lost', text: 'At level 1 the Axis loses one Italian asset from its Available Box, its own choice; at higher levels the Allies pick some too. The Axis gives up the 177th Bersaglieri. <b>Tap Show me.</b>', auto: (g) => S.pickMoraleLoss(g, 'axis', 'ITC05') },
  { title: 'In every battle', text: `<ul><li><b>Level 1</b>: untried garrisons are disordered when revealed; tried Italian units check morale in battle.</li><li><b>Level 2</b>: every Italian unit in a battle is disordered.</li><li><b>Level 3</b>: and the disordered ones check morale, losing a step, or surrendering, if they fail.</li></ul>`, rule: '17.21d–f' },
  recap(['Captured ports and mutual objectives feed Fading Italian Morale events to the Allies.', 'Each level costs the Axis Italian assets and weakens Italian units in battle.', 'At level 3 failing Italians may surrender.']),
] };

const L_SUPPLY: Lesson = { id: 's-supply', topic: 'Supply and victory', chapter: CH2, ref: 'Ex 18 · 19.0', goal: 'Tracing to beachheads, ports and Messina; the score', minutes: 3, side: 'allied', setup: () => {
  const g = sicilyTable(2, 'allied', 'movement', { US05: 20, US01: 40, US03: 19, BR05: 5, GE04: 17, IT01: 45 });
  for (const a of [20, 21, 40, 19]) g.control[a] = 'allied'; return g;
}, steps: [
  situation('Lines to the sea', `Allied blocks trace supply to a <b>beachhead</b> or a working <b>port</b> of their own army: Americans to American ones, British to British ones. Axis blocks trace to <b>Messina</b>. A line runs through friendly-held areas, never into enemy-held ones.
    <p>Here the US blocks at Licata, Gela and Canicattì trace back to Joss and Dime; the British at Syracuse to their beachheads.</p>`, { look: 20 }),
  tapUnit('US01', 'Canicattì', '<b>Tap the 2nd Armored in Canicattì.</b> Its panel says whether it is supplied: through Licata to Joss.', { rule: '14.9 · 9.31' }),
  { title: 'Cut off', text: 'A block that cannot trace is marked unsupplied in its own Supply Phase and checks morale; a failed check disorders it. An <b>air supply</b> mission spares a cut-off area the check. Out-of-supply objectives score nothing.', rule: '9.4 · 16.34' },
  { title: 'The score', text: '<b>Tap the score strip.</b>', target: { el: '.vps', label: 'score strip' }, done: (_g, q) => q('.vsheet') },
  closeStep('.vsheet [aria-label="Close"]', '.vsheet', 'Ready', 'The Allies must take objectives, keep them supplied and keep their beachheads. The Axis must bleed the landings and hold Messina. <b>Close the sheet.</b>'),
  { title: 'Ready to play', kind: 'recap', text: '<ul><li>Land, take the ports, keep the beachheads.</li><li>Watch the army zones and release your divisions in time.</li><li>Hunt Italian morale down with captured ports and objectives.</li></ul><p>Pick a game: <b>Sunrise Bridge</b> is short and British only; the <b>Tournament</b> is the invasion in five turns.</p>' },
] };

/* ================= What's new: the introduction for Bulge players ================= */
const L_NEW: Lesson = { id: 's-new', topic: 'Same engine, an island', chapter: CHN, goal: 'What a Bulge player must unlearn and learn', minutes: 4, side: 'allied', setup: () => sicilyStart(), steps: [
  situation('Same engine, an island', `You know the series: blocks, chits, the phases, the round of combat, supply. Sicily keeps all of it. What changes:
    <ul><li><b>Sides</b>: the Allies attack from the sea, US and British; the Axis is Italian and German.</li>
    <li><b>Landings</b>: beachheads, landing boxes, beach assaults; ports to open and to damage.</li>
    <li><b>Units</b>: divisions of two blocks with an extra die together; 29 untried Italian garrisons face down for both players.</li>
    <li><b>Zones</b>: army boundaries A to D, opened by releases.</li>
    <li><b>Assets</b>: naval support, Rangers and Commandos, dogfights; Fading Italian Morale.</li>
    <li><b>No fuel</b>, no Greif teams.</li></ul>`, { look: 19 }),
  { title: 'The score', text: 'The Axis starts ahead: it holds every objective. <b>Tap the score strip.</b>', target: { el: '.vps', label: 'score strip' }, done: (_g, q) => q('.vsheet') },
  closeStep('.vsheet [aria-label="Close"]', '.vsheet', 'Captured beachheads', 'Every beachhead the Axis captures counts for the Axis. <b>Close the sheet.</b>'),
  recap(['Landings and beach assaults; ports to open and damage.', 'Two-block divisions with an extra die; untried garrisons face down for both.', 'Army zones and releases.', 'Naval support, Rangers, dogfights, Fading Italian Morale.']),
] };

const END = [{ label: 'Start the Tournament', scenario: 'tournament', primary: true }, { label: 'Sunrise Bridge (short)', scenario: 'sunrise_bridge' }];
export const SICILY_COURSE: Course = {
  ...infoOf('sicily'),
  lessons: [L_WELCOME, L_BLOCKS, L_MAP, L_CHITS, L_SETUP, L_LANDING, L_BEACH, L_ZONES, L_PORT, L_AIR, L_MORALE, L_SUPPLY],
  end: END,
};
export const SICILY_NEW_COURSE: Course = {
  ...infoOf('sicily-new'),
  lessons: [L_NEW, L_BLOCKS, L_MAP, L_SETUP, L_LANDING, L_BEACH, L_ZONES, L_PORT, L_AIR, L_MORALE, L_SUPPLY].map((l) => ({ ...l, chapter: CHN })),
  end: END,
};
