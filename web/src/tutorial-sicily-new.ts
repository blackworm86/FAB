/** Sicily: what's new. The short course for players who know the series from The Bulge (docs/TUTORIAL-OUTLINE.md, "Sicily: what is new"),
 *  in the voice of the Bulge course (tutorial-basics.ts): the goal first, then only what Sicily changes, each lesson on a Play Book example.
 *  Reached at ?tutorial=sicily-whats-new. Engine only (no DOM), so the tests play every step. */
import * as E from '../../engine/src';
import {
  type Course,
  type Lesson,
  type G,
  U,
  avail,
  queue,
  stage,
  begin,
  answer,
  roll,
  fightAt,
  GO,
  bookDiceSeq,
  tapUnit,
  moveTo,
  closeStep,
  recap,
  situation,
  next,
  sicilyStart,
  sicilyTable,
  pieces,
  sicilyBlock,
  sicilyWood,
  sicilyChit,
} from './tutorial-kit';

const S = E.sicily;
const CH = 'What’s new';
const box = (code: string) => S.boxId(code);
/** The assets are in and the Axis, played by the coach, has nothing to add: the main button reads Begin combat. */
const ready = (g: G) => {
  const b = g.battle;
  if (b?.stage !== 'setup') return;
  answer(g);
  if (b.ready!.length < 2) E.setReady(g, b, E.other(b.attacker));
};
const card = (id: string, label: string) => ({ el: [`.card2[data-chit="${id}"]`, '.handtab button'], label });
const panelBtn = (text: string, label: string) => ({ el: ['.volpanel button', '.c-dispatch button', 'button'], text, label });
/** The rest of a battle with the book's choices for the defender: retreat (to `to` when it may), then take the losses. */
const finishBattle = (to?: number) => (g: G) => {
  const b = g.battle!;
  for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
    if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
    else if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
    else if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
    else if (b.stage === 'retreat') {
      const r = E.retreatOptions(g, b);
      if (r.length) E.chooseRetreat(g, b, to != null && r.includes(to) ? to : r[0]);
      else E.defenderChoice(g, b, false);
    } else if (b.stage === 'exploit') E.declineExploit(g, b);
    else E.roll_step(g, b);
  }
};
/** Blocks that came ashore from a landing box this turn onto defenders: a beach assault, dug-in defenders (Example 14). */
const ashore = (g: G, a: number, from: string, ids: string[]) => {
  g.fieldWorks.push(a);
  g.fwOwner[a] = 'axis';
  g.riverAssault.push(a);
  S.state(g).beachAssault[a] = box(from);
  for (const id of ids) U(g, id).moved = true;
};

/* 1 · The situation, the goal, the landings (Play Book Ex 9 and Ex 14: Joss off Licata, Dime off Gela). */
const L_LAND: Lesson = {
  id: 'sn-landing',
  topic: 'Landing on Sicily',
  chapter: CH,
  ref: 'Ex 9 · Ex 14',
  goal: 'Your goal, the landing boxes, and why no block waits at sea',
  minutes: 2,
  side: 'allied',
  setup: () => {
    const g = sicilyTable(1, 'allied', 'movement', {
      US05: box('A1'),
      US06: box('A1'),
      US03: 19,
      US04: 19,
      US01: box('A2'),
      IT09: 20,
      IT37: 19,
      GE04: 17,
    });
    ashore(g, 19, 'A2', ['US03', 'US04']);
    g.fieldWorks.push(20);
    g.fwOwner[20] = 'axis';
    return g;
  },
  steps: [
    situation(
      '10 July 1943',
      `Operation Husky: the Americans and the British land on Sicily, held by the Italian 6th Army and two German divisions. You command the <b>Allies</b>.
    <p>Your goal: <b>get ashore, take the ports and drive on to Messina</b>, the Axis door to Italy. The Axis starts holding every objective on the island: each point you score, you take from them.</p>`,
      { look: 19 },
    ),
    next(
      'What is new here',
      `<ul><li>You come <b>from the sea</b>, and later through the ports.</li><li><b>Four nations</b>: American (green) and British (blue) against German (grey) and Italian (orange).</li><li><b>Untried Italian garrisons</b>, hidden even from their owner.</li><li><b>Two Allied armies</b>, each kept to its own zone.</li><li><b>Ports and airfields</b> win you more chits.</li></ul>`,
    ),
    tapUnit(
      'US05',
      'Off the beach',
      'The blue boxes off the coast are <b>landing boxes</b>. Your 3rd Infantry waits in <b>Joss</b>, off Licata. <b>Tap it.</b>',
      {
        rule: '14.2 Landing boxes',
        label: '3rd Infantry block',
        why: 'At set-up you choose a landing plan: the historical one, the British in the east and the Americans on this coast, or the alternate one, with the Americans in the west near Palermo (Example 1). Your beachhead markers go on those boxes.',
      },
    ),
    moveTo(
      'US05',
      20,
      'Ashore',
      'Only <b>Licata</b> lights up: each box has one arrow, the only way ashore, and landing takes the whole move. <b>Tap Licata.</b>',
      {
        rule: '14.26 Landing',
        why: 'Landing on defenders is a <b>beach assault</b>: it is fought like a river assault, so your blocks fire at a disadvantage and theirs hit more easily.',
      },
    ),
    moveTo('US06', 20, 'The second block', 'Land the other 3rd Infantry block at Licata too.', {
      kind: 'try',
      why: 'The block left in Joss is already selected: tap Licata.',
    }),
    tapUnit(
      'US01',
      'No room',
      'The <b>2nd Armored</b> waits in Dime, off Gela. Gela already holds two blocks of the 1st Infantry, the most an area takes. <b>Tap it:</b> nothing lights up.',
      { rule: '14.24 Unit arrival', label: '2nd Armored block' },
    ),
    {
      title: 'Nobody waits at sea',
      text: 'Here is the rule that surprises everyone: a block <b>still in a landing box</b> when your movement ends <b>goes back to sea</b>. <b>Tap End movement</b> and watch the 2nd Armored.',
      rule: '14.24b Remain at sea',
      target: GO,
      done: (g) => g.phase !== 'movement',
      act: (g) => E.endPhase(g),
    },
    next(
      'Gone to sea',
      'The 2nd Armored has left Dime for the <b>At Sea</b> box. Next turn it lands again through a beachhead or a port with room: a whole turn lost. Plan your landings so every block has somewhere to go.',
      { rule: '14.24b', look: 19 },
    ),
    recap(['You can land: one arrow per box, the whole move, and no block left behind in a box.']),
  ],
};

/* 2 · The airborne assault (Play Book Ex 13: the British 1st Airborne and its drop zones). */
const L_AIR_DROP: Lesson = {
  id: 'sn-airborne',
  topic: 'From the air',
  chapter: CH,
  ref: 'Ex 13',
  goal: 'Paratroopers drop before any battle and fight first',
  minutes: 2.5,
  side: 'allied',
  setup: () => {
    const g = sicilyTable(1, 'allied', 'combat', {
      BR05: 13,
      BR06: 13,
      BR07: 5,
      BR08: 5,
      BR01: 4,
      BR02: 4,
      BR03: 2,
      BR04: 2,
      BR15: 1,
      US05: 8,
      BR11: 6,
      IT07: 6,
      IT10: 4,
    });
    const para = U(g, 'BR11');
    para.area = null;
    para.box = 'airborne_assault';
    S.state(g).dropPending = true;
    return g;
  },
  steps: [
    situation(
      'Paratroopers',
      `Turn 1, Combat Phase. The British are ashore from Augusta to Pachino. The <b>1st Airborne</b> waits in the <b>Airborne Assault box</b>, and before any battle it must jump.
    <p>It may land only in an area <b>next to at least two areas</b> holding British troops, and never where two Allied blocks already stand.</p>`,
      { look: 5 },
    ),
    {
      title: 'Jump',
      text: 'In the 1st Airborne panel, <b>tap Choose the drop zone</b>.',
      rule: '14.27a Air drop',
      target: { el: ['.volpanel .row button', '.volfold'], label: 'Choose the drop zone button' }, // phones fold the panel to a handle: open it first
      done: (_g, q) => q('.c-prompt', 'elsewhere to cancel'), // the drop-zone pick is on
    },
    {
      title: 'Where it may land',
      text: 'Three areas light up: Palazzolo Acreide, Ragusa and Pachino. The Napoli Division holds <b>Palazzolo Acreide</b>, inland. <b>Tap it.</b>',
      rule: '14.27a',
      why: 'Augusta, Syracuse, Avola and Modica already hold two blocks. Comiso touches two Allied areas, but one of them is American: another army.',
      target: { area: 6 },
      look: 6,
      done: (g) => U(g, 'BR11').area === 6,
      act: (g) => S.airDrop(g, 'BR11', 6),
    },
    {
      title: 'This battle first',
      text: 'A drop onto the enemy is an <b>airborne assault</b>, and it is fought <b>before every other battle</b>. Avola must wait: the game will not begin it until this one is over. <b>Tap the red button.</b>',
      rule: '14.27a Assault',
      target: GO,
      look: 6,
      done: (g) => !!g.battle,
      act: fightAt(6),
    },
    {
      title: 'Begin',
      text: 'The paratroopers lead as point unit and fire as in a river assault. The Axis has nothing to add: <b>Show me</b> the battle begin.',
      rule: '14.27a',
      auto: begin,
    },
    {
      title: 'Napoli fires',
      text: 'The defender shoots first: veteran against green, and +1 against an assault. A 7 or less hits. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDiceSeq(g, 'axis', 'ground', [{ sn: 7, dice: [3, 5, 8] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'No way back',
      text: 'Two hits. In any other battle you could abort now. Not here: an airborne assault <b>never aborts</b>, every hit is taken. <b>Tap Take losses.</b>',
      rule: '14.27a',
      target: panelBtn('Take losses', 'Take losses button'),
      skip: (g) => g.battle?.stage !== 'attChoice',
      done: (g) => g.battle?.stage !== 'attChoice',
      act: (g) => E.attackerChoice(g, g.battle!, false),
    },
    {
      title: 'The paratroopers fire',
      text: 'Two steps left, two dice, and only a 2 or less hits: rough ground, and the assault. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDiceSeq(g, 'allied', 'ground', [{ sn: 2, dice: [1, 7] }])),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'They fall back',
      text: 'One hit is enough: Napoli gives up Palazzolo Acreide and falls back to Vizzini, disordered.',
      auto: finishBattle(11),
    },
    {
      title: 'Now the others',
      text: '<b>Tap Close battle.</b> Only now may you choose among the other battles.',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap(['You can drop paratroopers: next to two areas of their own army, fought first, and never aborted.']),
  ],
};

/* 3 · The untried Italian garrisons (Play Book Ex 14 A, D, F at Licata, and Ex 10). */
const L_ITALIANS: Lesson = {
  id: 'sn-italians',
  topic: 'The Italians',
  chapter: CH,
  ref: 'Ex 14 · Ex 10',
  goal: 'A face-down garrison is revealed, and may break at once',
  minutes: 2,
  side: 'allied',
  setup: () => {
    const g = sicilyTable(1, 'allied', 'combat', { US05: 20, US06: 20, IT09: 20 });
    ashore(g, 20, 'A1', ['US05', 'US06']);
    fightAt(20)(g);
    ready(g);
    return g;
  },
  steps: [
    next(
      'Who holds Licata?',
      'Your 3rd Infantry is ashore at Licata, against one face-down Italian block. Most of the coast was held by <b>untried garrisons</b>: nobody knows what is inside, not even the Axis player.',
      {
        rule: '15.3 Italian untried units',
        why: '29 coastal garrisons are shuffled face down at set-up: the Axis player chooses the areas, not the units. Most are one green step; four have two; one is a veteran.',
        look: 20,
      },
    ),
    {
      title: 'Revealed',
      text: 'When the battle begins the garrison turns face up and checks <b>morale</b> at once: a green one needs a 3 or less. <b>Tap Begin combat.</b>',
      rule: '15.3b',
      target: GO,
      enter: (g) => queue(g, [5]),
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'It breaks',
      text: 'The book rolls a 5: one green step, now <b>disordered</b> before a shot is fired. A green untried garrison never gets a bonus to its fire, not even against your assault. <b>Roll.</b>',
      rule: '15.3b',
      target: GO,
      enter: (g) => queue(g, bookDiceSeq(g, 'axis', 'ground', [{ sn: 2, dice: [9] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'Your fire',
      text: 'Two blocks of one division in the same battle roll an <b>extra die</b>. <b>Roll.</b>',
      rule: '15.2 Divisional integrity',
      why: 'In the Play Book a Ranger asset fires too and adds one more hit.',
      target: GO,
      enter: (g) =>
        queue(
          g,
          bookDiceSeq(g, 'allied', 'ground', [
            { sn: 6, dice: [2, 4, 5, 9] },
            { sn: 6, dice: [1, 6, 8, 9] },
            { sn: 6, dice: [10] },
          ]),
        ),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'The garrison is gone',
      text: 'Five hits, and it needed three: the field works absorb one, a retreat another, and the third destroys it.',
      auto: finishBattle(21),
    },
    {
      title: 'Licata is yours',
      text: '<b>Tap Close battle.</b>',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    next(
      'Fading Italian morale',
      'Each port and each <b>yellow-star</b> area you take puts a <b>Fading Italian Morale</b> event into your cup, three in all. Each one you play costs the Axis Italian assets and makes every Italian unit shakier in battle.',
      {
        rule: '17.21 Fading Italian Morale',
        why: 'Level 1: a garrison is disordered the moment it is revealed, and other Italian units must pass a morale check in battle. At levels 2 and 3 a failed check costs a step, and some units surrender.',
        figure: (g) => pieces([{ svg: sicilyChit(g, 'ALC01a'), cap: 'Fading Italian Morale' }]),
      },
    ),
    recap(['You know the Italians: hidden until the first battle, often broken by it, and weaker with every port you take.']),
  ],
};

/* 4 · Naval support (Play Book Ex 14 B, C, E, G at Gela). */
const L_NAVY: Lesson = {
  id: 'sn-navy',
  topic: 'Naval support',
  chapter: CH,
  ref: 'Ex 14',
  goal: 'The fleet flattens the defences; a beach assault never aborts',
  minutes: 2,
  side: 'allied',
  setup: () => {
    const g = sicilyTable(1, 'allied', 'combat', { US03: 19, US04: 19, IT37: 19 });
    ashore(g, 19, 'A2', ['US03', 'US04']);
    avail(g, ['USC07a']);
    fightAt(19)(g);
    return g;
  },
  steps: [
    {
      title: 'Gela',
      text: 'Your 1st Infantry is ashore at Gela, against a dug-in garrison. Offshore waits the fleet: <b>naval support</b>, artillery that works only in coastal areas. <b>Tap Naval Support</b> in your hand.',
      look: 19,
      rule: '16.21 Naval support',
      target: card('USC07a', 'Naval Support card'),
      done: (g) => !!g.battle?.assets.allied.includes('USC07a'),
      act: (g) => E.assign(g, g.battle!, 'USC07a'),
    },
    {
      title: 'Shock and awe',
      text: 'Instead of firing, it can <b>flatten the field works</b> before anyone shoots. In the Shock and Awe panel, <b>tap Naval Support</b>.',
      rule: '16.21',
      target: { el: ['.volpanel .row button', '.volfold'], label: 'Naval Support button' }, // phones fold the panel to a handle: open it first
      done: (g) => S.state(g).navalShock['19'] === 'USC07a',
      act: (g) => S.setNavalShock(g, g.battle!, 'USC07a'),
    },
    {
      title: 'The Axis answers',
      text: 'Your assets are in. The Axis has nothing to add and puts its garrison forward. <b>Show me.</b>',
      auto: ready,
    },
    {
      title: 'The veteran',
      text: 'When the battle begins, the field works go first. This garrison is the island’s one <b>veteran</b>: it needs a 5 to keep its nerve. <b>Tap Begin combat.</b>',
      target: GO,
      enter: (g) => queue(g, [5]),
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'It holds, and fires',
      text: 'It rolled a 5 and holds. A veteran keeps its bonuses: two dice, and +1 against your assault. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDiceSeq(g, 'axis', 'ground', [{ sn: 6, dice: [1, 5] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'Never abort a landing',
      text: 'Two hits. Abort here and your blocks go back to sea, and the Axis <b>captures the beachhead</b>: a point to them for the rest of the game. <b>Tap Take losses.</b>',
      rule: '14.27b Beach assault',
      target: panelBtn('Take losses', 'Take losses button'),
      skip: (g) => g.battle?.stage !== 'attChoice',
      done: (g) => g.battle?.stage !== 'attChoice',
      act: (g) => E.attackerChoice(g, g.battle!, false),
    },
    {
      title: 'Your fire',
      text: 'With the field works gone your dice hit more easily. <b>Roll.</b>',
      target: GO,
      enter: (g) =>
        queue(
          g,
          bookDiceSeq(g, 'allied', 'ground', [
            { sn: 5, dice: [2, 4, 6] },
            { sn: 5, dice: [5, 8, 9] },
            { sn: 5, dice: [9] },
          ]),
        ),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'Just enough',
      text: 'Three hits: a retreat absorbs one, two lost steps destroy the garrison. With its field works it would have survived.',
      auto: finishBattle(18),
    },
    {
      title: 'Gela is yours',
      text: '<b>Tap Close battle.</b> A naval asset used this way is not lost at once, but the fleet slowly sails away: from now on, one used naval asset leaves the game each turn.',
      rule: '16.21 Reduction of support',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap([
      'You can use the fleet: naval support in coastal battles, field works flattened before the first shot, and no abort on a beach.',
    ]),
  ],
};

/* 5 · Air support and dogfights (Play Book Ex 3: Bolognetta and Salemi, the Axis side). */
const L_AIR: Lesson = {
  id: 'sn-air',
  topic: 'Air support',
  chapter: CH,
  ref: 'Ex 3',
  goal: 'A dogfight cancels an air mission; airfields and ports tip the balance',
  minutes: 1.5,
  side: 'axis',
  setup: () => {
    const g = sicilyTable(2, 'axis', 'admin', { IT05: 57, IT06: 58, GE02: 59, GE03: 59, US03: 19 });
    avail(g, ['USC06a', 'USC06b', 'GEC04']);
    E.setDone(g, 'axis'); // 4.2b/c: the Axis has played its part of the Admin Phase; the Allies act now
    S.airInterdiction(g, 'USC06a', 56);
    S.airInterdiction(g, 'USC06b', 59);
    return g;
  },
  steps: [
    situation(
      'The other side of the sky',
      `For one lesson you are the <b>Axis</b>. Your 15th Panzergrenadier at Salemi must race east to the landings.
    <p>The Allies answered with <b>interdiction</b>: an air asset over Bolognetta and one over Salemi. Each costs +1 point to enter the area and +1 to leave it.</p>`,
      { look: 59 },
    ),
    {
      title: 'Your one plane',
      text: 'Any air mission can be cancelled by a <b>dogfight</b>: one of your own air support assets against it. <b>Tap your Air Support</b> in the Axis hand.',
      rule: '16.31 Dogfighting',
      target: card('GEC04', 'Air Support card'),
      done: (_g, q) => q('.card2.sel[data-chit="GEC04"]'),
    },
    {
      title: 'Dogfight',
      text: '<b>Tap Dogfight</b> among the choices.',
      target: { el: '.modes button[title^="Dogfight"]', label: 'Dogfight' },
      done: (_g, q) => q('.modes button.on[title^="Dogfight"]'),
    },
    {
      title: 'Free the panzers',
      text: 'Bolognetta only slows the Italians; Salemi traps your panzers. <b>Tap Salemi.</b>',
      rule: '16.31',
      why: 'Both planes go to the Used Box. The interdiction over Bolognetta stays until your Supply Phase.',
      target: { area: 59 },
      look: 59,
      done: (g) => !g.interdicted[59],
      act: (g) => S.dogfightInterdiction(g, 'GEC04', 59),
    },
    next(
      'Airfields and ports',
      'The air war follows the ground war. Each Sicilian <b>airfield</b> the Allies capture puts one more Allied air asset in their cup, and grounds the next Axis one drawn. Each port they hold, occupy and keep undamaged gives them <b>one more chit</b> every Admin Phase.',
      { rule: '16.4 Airfields · 16.5 Ports' },
    ),
    recap([
      'You can fight for the sky: a dogfight cancels one enemy air mission, and every airfield or port the Allies take tips the balance.',
    ]),
  ],
};

/* 6 · Army boundaries and releases (Play Book Ex 5). */
const L_ZONES: Lesson = {
  id: 'sn-zones',
  topic: 'Two armies, one island',
  chapter: CH,
  ref: 'Ex 5',
  goal: 'Army zones, a release, supply by nation',
  minutes: 2,
  side: 'allied',
  setup: () => {
    const g = sicilyTable(2, 'allied', 'admin', { BR03: 26, BR04: 26, BR07: 14, US07: 16 });
    for (const b of S.beachheads(g)) g.control[b.area] = 'allied'; // the coast taken on turn 1: no beachhead falls when the phase ends
    avail(g, ['BRC15']);
    return g;
  },
  steps: [
    situation(
      'Two armies',
      `The Allies are two armies: the US <b>7th</b> and the British <b>8th</b>. Each is kept to its own <b>zone</b>, the areas inside the grey lines with white dashes. With the historical plan the British stay in zone B, the Americans in A and C.
    <p>Turn 2, Admin Phase. Your British 5th Infantry holds Catania and wants to swing inland to Regalbuto, in zone A. First it must be <b>released</b>.</p>`,
      { look: 26 },
    ),
    {
      title: 'The Special Action',
      text: 'A release costs your <b>Special Action</b> and frees one division. <b>Tap the Special Action</b> in the Allied hand.',
      rule: '14.61 Release a division',
      target: card('BRC15', 'Special Action card'),
      done: (_g, q) => q('.card2.sel[data-chit="BRC15"]'),
    },
    {
      title: 'Release',
      text: '<b>Tap Release a division</b> among the choices.',
      target: { el: '.modes button[title^="Release"]', label: 'Release a division' },
      done: (_g, q) => q('.modes button.on[title^="Release"]'),
    },
    {
      title: 'The 5th Infantry',
      text: '<b>Tap a 5th Infantry block</b> in Catania.',
      target: { unit: 'BR03', label: '5th Infantry block' },
      done: (g) => S.state(g).released.includes('br_5th_inf'),
      act: (g) => S.releaseDivision(g, 'br_5th_inf', 'BRC15'),
    },
    {
      title: 'To the move',
      text: 'The Axis may answer with its own chits. <b>Tap Done, then End admin.</b>',
      target: GO,
      done: (g) => g.phase === 'movement',
      act: (g) => {
        for (let i = 0; i < 4 && g.phase !== 'movement'; i++) E.endPhase(g);
      },
    },
    moveTo('BR03', 25, 'Inland', 'Released, the 5th may cross into zone A: Regalbuto lights up. <b>Tap Regalbuto.</b>', {
      rule: '14.4 Army boundaries',
    }),
    tapUnit(
      'US07',
      'Never in zone B',
      'Some lines never open. <b>Tap the US 45th Infantry</b> in Ramacca: Catania, next door, stays dark. Americans never enter zone B, the British never zone D.',
      { rule: '14.41', label: '45th Infantry block' },
    ),
    next(
      'Each army its own supply',
      'Each army traces supply to <b>its own</b> beachheads, British to British, American to American; an undamaged port you hold serves both. The Axis traces to <b>Messina</b>, its door to Italy, and may <b>evacuate</b> through it to the mainland, for good.',
      { rule: '14.92 · 14.29' },
    ),
    recap(['You can plan with two armies: each in its own zone until a Special Action releases it, each on its own supply lines.']),
  ],
};

/* 7 · The score and the first game (19.0, Sunrise Bridge 22.1). */
const L_WIN: Lesson = {
  id: 'sn-win',
  topic: 'Winning in Sicily',
  chapter: CH,
  goal: 'The score, and your first game',
  minutes: 1,
  side: 'allied',
  setup: () => sicilyStart(),
  steps: [
    {
      title: 'Who is ahead?',
      text: 'The Axis holds every objective at the start, so it begins ahead. <b>Tap the score track.</b>',
      rule: '19.0 Victory',
      target: { el: '.vps', label: 'score track' },
      done: (_g, q) => q('.vsheet'),
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'How Sicily is won',
      'You score the <b>crosses</b> near Messina and the <b>yellow stars</b> you hold, occupied and supplied, and every big Axis unit destroyed. The Axis scores the stars it holds and <b>every beachhead it captures</b>. <b>Close the sheet.</b>',
    ),
    {
      title: 'Your first game',
      kind: 'recap',
      text: `<ul><li>Land, and leave nobody in a box.</li><li>Paratroopers drop and fight first.</li><li>Bring the fleet; never abort a landing.</li><li>Take ports and airfields; release your divisions in time.</li></ul>
    <p>Start with <b>Sunrise Bridge</b>: four turns, the British alone, racing for Catania.</p>`,
    },
  ],
};

export const SICILY_WHATS_NEW: Course = {
  id: 'sicily-whats-new',
  game: 'sicily',
  title: "Sicily: what's new",
  sub: '7 lessons · about 13 minutes',
  blurb:
    'For players who know the series: only what Sicily changes. Landings from the sea and the air, the Italian garrisons, the fleet and the air force, two Allied armies, and how the island is won.',
  minutes: 13,
  lessons: [L_LAND, L_AIR_DROP, L_ITALIANS, L_NAVY, L_AIR, L_ZONES, L_WIN],
  end: [
    { label: 'Start Sunrise Bridge', scenario: 'sunrise_bridge', primary: true },
    { label: 'Start the Tournament', scenario: 'tournament' },
  ],
};
