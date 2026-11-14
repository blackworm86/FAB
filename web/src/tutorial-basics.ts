/** The Bulge basics: the short course that replaces the old Bulge course (docs/TUTORIAL-OUTLINE.md, approved 14 November 2026,
 *  revised the same day on the owner's word: open with the goal, follow the order of a turn, explain why in a coach's voice).
 *  "Your first turn": the Play Book's Examples of Play (23.1–23.10) as one story, each lesson the next thing that happens in a turn.
 *  Engine only (no DOM), so the tests play every step. */
import * as E from '../../engine/src';
import {
  type Course,
  type Lesson,
  type Step,
  type G,
  U,
  C,
  area,
  avail,
  sa,
  queue,
  stage,
  begin,
  answer,
  roll,
  fightAt,
  GO,
  bookDice,
  tapUnit,
  moveTo,
  closeStep,
  recap,
  situation,
  next,
  bulgeTable,
  pieces,
  blockAnatomy,
  bulgeBlock,
  bulgeWood,
} from './tutorial-kit';

const CH = 'Your first turn';
const GREIF = E.keyOf(21, 37);
const fuel = (g: G) => {
  for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
};

/* 1 · The goal, the score, the shape of a turn. */
const L_GOAL: Lesson = {
  id: 'goal',
  topic: 'December 1944',
  chapter: CH,
  goal: 'Who you are, what you fight for, how a turn goes',
  minutes: 2.5,
  side: 'german',
  setup: () => {
    E.useGame('bulge');
    const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
    g.phase = 'movement';
    g.log = [];
    return g;
  },
  steps: [
    situation(
      '16 December 1944',
      `You command the German offensive in the Ardennes. Three armies, behind the fog and the snow, against a thin American line.
    <p>Your goal: <b>break through</b> and seize the towns that matter before the Allies bring up their reserves. Every turn is one day; every day you wait, they get stronger.</p>`,
      { look: 23 },
    ),
    next(
      'Grey against green',
      'Your blocks are <b>grey</b>, the Americans <b>green</b>. Each block stands with its face towards its owner: your opponent sees only the colour, never how strong you are, until the battle starts.',
      {
        rule: '2.0 Game pieces',
        figure: (g) =>
          pieces([
            { svg: bulgeBlock(g, '2 Pz'), wood: bulgeWood(g, '2 Pz'), cap: 'Yours: 2nd Panzer Division' },
            { svg: bulgeBlock(g, '106 Inf'), wood: bulgeWood(g, '106 Inf'), cap: 'Theirs: 106th Infantry Division' },
          ]),
      },
    ),
    {
      title: 'The score',
      text: 'Towns with a <b>star</b> are objectives: whoever holds them scores. The track at the top shows who is ahead. <b>Tap it.</b>',
      target: { el: '.vps', label: 'the score track' },
      done: (_g, q) => q('.vsheet'),
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'How you win',
      `Objectives and big enemy units destroyed give points. From turn 4, if your lead reaches the number printed for that turn, you <b>win at once</b>: that is sudden death. Otherwise the score at the end decides.
    <p><b>Close the sheet.</b></p>`,
    ),
    {
      title: 'A day in six steps',
      text: 'The pill at the top says whose turn it is and which step. <b>Tap it</b> to see the whole turn.',
      target: { el: '.phpill', label: 'the turn pill' },
      tap: true,
    },
    next(
      'Your turn, then theirs',
      `Each player turn goes: <b>Prepare</b> (chits arrive, you play some) · <b>Move</b> · <b>Fight</b> wherever both sides stand · <b>Break through</b> with your best units · <b>Supply</b>. You play first, then the Allies play the same steps.
    <p>The next lessons follow one German turn, step by step, just as the Play Book tells it.</p>`,
      { rule: '3.0 Sequence of play' },
    ),
    next(
      'The bottom bar',
      'The line at the bottom always tells you <b>what the game expects now</b>, and the red button ends the step when you are ready. Nothing moves on without your click.',
      { target: GO },
    ),
    recap(['You know your goal: break through, take the starred towns, keep the score in your favour.']),
  ],
};

/* 2 · Prepare: drawing and playing chits (Play Book 23.1–23.2, turn 2). */
const L_PREPARE: Lesson = {
  id: 'prepare',
  topic: 'Prepare: your chits',
  chapter: CH,
  ref: '23.2',
  goal: 'Assets and events: draw them, play them',
  minutes: 3,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'admin', { '12 VG': 9, '2 Pz': 21, '110/28': 37, '18 VG': 11, '106 Inf': 23, 'CCB/9': 25 }, true);
    U(g, '12 VG').str = 2;
    const ge = g.chits.filter((c) => c.side === 'german' && c.box !== 'eliminated');
    for (const c of ge) if (c.box === 'available') c.box = 'cup';
    const take = (k: string, n: number) => {
      for (const c of ge.filter((x) => x.kind === k && x.box !== 'available').slice(0, n)) c.box = 'available';
    };
    take('artillery', 3);
    take('rocket_artillery', 1);
    take('engineer', 1);
    take('infantry_asset', 1);
    take('armor_asset', 1);
    avail(g, ['R15.0', 'L17.0']);
    fuel(g);
    const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name));
    if (dr) dr.box = 'available';
    avail(g, ['L63.0', 'L88.0', 'L65.0', 'L62.0']);
    return g;
  },
  steps: [
    situation(
      'Turn 2: Prepare',
      `A new day. Before anything moves, both sides draw <b>chits</b> from their cup: you draw nine.
    <p><b>Assets</b> (artillery, engineers, fuel) are support you commit. <b>Events</b> (commandos, reinforcements) act once. The ones you can play now <b>glow</b> in your hand.</p>`,
    ),
    {
      title: 'Commandos on the bridge',
      text: 'Your 2nd Panzer must cross the river at Marnach, and the Americans will try to blow the bridge. German commandos in American uniforms can seize it first. <b>Tap Greif Team Bridge</b> in your hand.',
      rule: '17.12 Greif Team Bridge',
      why: 'With the team on a bridge, the Allied player needs a 1 to blow it instead of 5 or less.',
      target: { el: ['.card2[data-chit="R15.0"]', '.handtab button'], label: 'Greif Team Bridge card' },
      done: (_g, q) => q('.chitbar', 'Greif'),
    },
    {
      title: 'Which bridge',
      text: '<b>Tap Marnach</b>, your side of the river.',
      target: { area: 21 },
      look: 21,
      tap: true,
      done: (g) => !!g.greif[GREIF],
    },
    {
      title: 'Across the river',
      text: '<b>Tap Lullange</b>, the far side. The team now holds the Marnach–Lullange bridge.',
      target: { area: 37 },
      look: 37,
      done: (g) => !!g.greif[GREIF],
      act: (g) => E.playGreifBridge(g, 'R15.0', 21, 37),
    },
    {
      title: 'Fresh troops',
      text: 'The 12th VG lost a step in yesterday’s fighting. A replacement event gives it back: <b>tap Non-Elite Infantry Replacement</b>. Its colour matches the 6th Panzer Army, like the 12th VG: a chit only helps its own army.',
      target: { el: ['.card2[data-chit="L17.0"]', '.handtab button'], label: 'Replacement card' },
      done: (g, q) => q('.chitbar', 'lite') || U(g, '12 VG').str === 3,
    },
    {
      title: 'Back to strength',
      text: '<b>Tap the 12th VG in Udenbreth.</b>',
      rule: '13.0 Replacements',
      target: { unit: '12 VG' },
      look: 9,
      done: (g) => U(g, '12 VG').str === 3,
      act: (g) => E.playReplacement(g, 'L17.0', U(g, '12 VG').id),
    },
    {
      title: 'The Allies answer',
      text: 'Now the Allies play their chits. Their engineers <b>blow four bridges</b> around St. Vith, Malmedy and Vielsalm: a river without a bridge slows any attack. The rest of your assets stay in your hand for the battles to come.',
      rule: '15.3 Blowing bridges',
      look: 24,
      auto: (g) => {
        const dr = g.chits.find((c) => c.side === 'allied' && /Delayed/.test(c.name) && c.box === 'available');
        if (dr) dr.box = 'eliminated';
        E.setDone(g, 'german');
        E.blowBridges(g, 'L63.0', 25, [23, 33]);
        E.blowBridges(g, 'L88.0', 24, [33, 35]);
      },
    },
    {
      title: 'On to the move',
      text: 'Both sides are ready. <b>Tap End admin</b> to start moving.',
      target: GO,
      done: (g) => g.phase !== 'admin',
      act: (g) => E.endPhase(g),
    },
    recap(['You can play chits: events act once, assets wait in your hand until you commit them to a battle.']),
  ],
};

/* 3 · Move (Play Book 23.3: the 26th VG and the 116th Panzer from Prüm). */
const L_MOVE: Lesson = {
  id: 'move',
  topic: 'Move',
  chapter: CH,
  ref: '23.3',
  goal: 'What a block tells you, what a move costs',
  minutes: 3,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'movement', { '26 VG': 4, '116 Pz': 4, '2 Pz': 37, '560 VG': 22 });
    fuel(g);
    return g;
  },
  steps: [
    next(
      'Read a block',
      'The <b>pips</b> on top are its strength: each hit costs one, and with the last one gone the block is destroyed. Their <b>colour</b> is its quality: red elite, black veteran, white green. An oval means armour, a cross infantry.',
      {
        rule: '2.2 Steps and quality',
        figure: (g) =>
          blockAnatomy(bulgeBlock(g, '116 Pz'), bulgeWood(g, '116 Pz'), {
            pips: 'strength',
            quality: 'pip colour = quality',
            type: 'oval = armour',
            name: 'the division',
          }),
      },
    ),
    tapUnit(
      '26 VG',
      'Roads are fast',
      'Every block has movement points: infantry 3, armour 6. A road costs 1, open country 2: that is why the towns at road junctions matter so much. <b>Tap the infantry in Prüm.</b>',
      { rule: '5.3 Movement' },
    ),
    moveTo(
      '26 VG',
      5,
      'Every army has its sector',
      'Losheim belongs to the 6th Panzer Army, not yours. Crossing into another army’s sector costs 2 extra points: your block arrives worn out and must stop there. <b>Tap Losheim.</b>',
      { rule: '5.33 Army boundaries' },
    ),
    {
      title: 'Changed your mind?',
      text: 'Better to keep it in your own sector. <b>Tap Undo.</b> You can take back a move until something is revealed or rolled.',
      target: { el: '[data-undo]', label: 'Undo' },
      undo: true,
      done: (g) => area('26 VG', g) === 4,
    },
    tapUnit('116 Pz', 'The armour', 'Armour is your spearhead: 6 points, and it hits hard. <b>Tap the 116th Panzer.</b>'),
    moveTo(
      '116 Pz',
      23,
      'By road to St. Vith',
      'Three roads, 3 points: it reaches St. Vith, the key road junction. Your armour needs a <b>fuel</b> chit only to go further than 3 points in one move, so watch your fuel. <b>Tap St. Vith.</b>',
      { rule: '16.13 Fuel' },
    ),
    next(
      'Staying put has a use',
      'A block that does not move can <b>Fortify</b> (field works: the first hit on it is absorbed) or go into <b>reserve</b>, ready to move later in the turn. The chips above the bottom bar list who can still do what.',
      { rule: '5.2 Field works and reserves', target: { el: ['.dchip', '.c-bar.b'], label: 'the shortcut chips' } },
    ),
    {
      ...moveTo(
        '560 VG',
        37,
        'Your turn',
        'The 2nd Panzer is alone across the river in Lullange. Send the <b>560th VG</b> to help it: 1 point for the road, 1 more because the area is occupied. <b>Move it there.</b>',
        { kind: 'try', why: 'Tap the block in Weiswampach, then Lullange. Entering any occupied area costs 1 more point (5.32).' },
      ),
      target: { area: 37, label: 'Lullange' },
    },
    recap([
      'You can plan a move: roads 1, open country 2, +1 into an occupied area, +2 into another army’s sector, fuel for armour beyond 3.',
    ]),
  ],
};

/* 4 · Strategic movement (Play Book 23.4: the 82nd and 101st Airborne, turn 3, the Allied side). */
const L_STRAT: Lesson = {
  id: 'strategic',
  topic: 'The long road',
  chapter: CH,
  ref: '23.4',
  goal: 'Reserves rush to the front by road',
  minutes: 1.5,
  side: 'allied',
  setup: () => {
    const g = bulgeTable(3, 'allied', 'movement', { 82: 96, 101: 87, Lehr: 47, '2 Pz': 49 });
    E.setReserve(g, U(g, '82').id, true, true);
    E.setReserve(g, U(g, '101').id, true, true);
    g.phase = 'strategic';
    g.stratMoves = 0;
    return g;
  },
  steps: [
    situation(
      'Meanwhile, on the other side',
      `For one lesson, sit in your enemy's chair: this is what the Allies will do to you. Your panzers have taken Bastogne and a hole opens in their line.
    <p>The <b>82nd</b> and <b>101st Airborne</b> wait far behind, in reserve. After the Move step comes <b>Strategic movement</b>: a reserve block may travel any distance by road, as long as every area on the way is friendly and free of enemies.</p>`,
      { look: 62 },
    ),
    tapUnit('82', 'Fill the gap', '<b>Tap the 82nd Airborne.</b>', { rule: '5.4 Strategic movement' }),
    {
      ...moveTo('82', 62, 'La Roche', 'Far away, but every road behind the front is free. <b>Tap La Roche.</b>'),
      act: (g) => E.stratMove(g, U(g, '82').id, 62),
    },
    tapUnit('101', 'And the second', '<b>Tap the 101st.</b>'),
    {
      ...moveTo('101', 74, 'Champlon', '<b>Tap Champlon.</b> The gap is closed in a single step.'),
      act: (g) => E.stratMove(g, U(g, '101').id, 74),
    },
    recap([
      'Reserves are your fire brigade: put blocks in reserve before you need them. The Allies may strat-move three a turn, you only one, and it costs you fuel.',
    ]),
  ],
};

/* 5 · Fight: one round of combat (Play Book 23.5: the 18th VG against the 106th Infantry in St. Vith). */
const L_FIGHT: Lesson = {
  id: 'fight',
  topic: 'Fight',
  chapter: CH,
  ref: '23.5',
  goal: 'How a battle goes, what the dice mean',
  minutes: 2.5,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'combat', { '18 VG': 23, '106 Inf': 23, 'Garrison St. Vith': 23, 'CCB/9': 25, '62 VG': 11 });
    g.control[23] = 'allied';
    U(g, '106 Inf').str = 1;
    sa(g, 'allied');
    return g;
  },
  steps: [
    {
      title: 'Battle for St. Vith',
      text: 'Your 18th VG has pushed into St. Vith, where the battered 106th Infantry holds on. Wherever both sides stand in one area, there is a battle. <b>Tap Fight St. Vith.</b>',
      rule: '6.1 Combat',
      target: GO,
      look: 23,
      done: (g) => !!g.battle,
      act: fightAt(23),
    },
    {
      title: 'The enemy brings help',
      text: 'The Allies spend their <b>Special Action</b> to rush the CCB/9th Armored in from next door. Now the blocks turn face up: for the first time you see what you are fighting.',
      rule: '8.23 Reinforce',
      why: 'Each side has a reusable Special Action: here the defender pulls a block in from a neighbouring area. A block that has just arrived may not lead, so the 106th stays in front.',
      auto: (g) => {
        const b = g.battle!;
        E.defenderReinforceSA(g, b, U(g, 'CCB/9').id, 'SA-allied');
        answer(g);
        E.setPoint(g, b, 'allied', U(g, '106 Inf').id);
      },
    },
    {
      title: 'Who leads',
      text: 'Each side has a <b>point unit</b>, marked in gold: the block in front. It takes the first blows, and its type and quality change everyone’s odds. <b>Tap Begin combat.</b>',
      rule: '6.24 Point unit',
      target: GO,
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'The defender shoots first',
      text: 'Each block rolls one die per step. A die at or under its <b>Success Number</b> is a hit. The number starts at 5 and the chips show what moved it: +1 for armour, −1 for green troops against veterans. <b>Tap Roll.</b>',
      rule: '6.27 Defensive fire',
      target: GO,
      enter: (g) =>
        queue(
          g,
          bookDice(g, 'allied', 'ground', [
            { who: 'CCB/9', sn: 6, dice: [5] },
            { who: 'Garrison', sn: 4, dice: [5] },
            { who: '106', sn: 4, dice: [1] },
          ]),
        ),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'A hard choice',
      text: 'Two hits on you before you have even fired. The first always costs a step. For the second you choose: lose another step and fight on, or <b>abort</b>: you keep your strength but pull back disordered. Against these odds, the Play Book aborts. <b>Tap Abort.</b>',
      rule: '6.41 Attacker hits',
      target: { el: ['.c-dispatch button', 'button'], text: 'Abort', label: 'Abort button' },
      done: (g) => !!g.battle?.result || !g.battle,
      act: (g) => E.attackerChoice(g, g.battle!, true),
    },
    {
      title: 'Not today',
      text: 'St. Vith holds this time, but its defenders are worn down, and tomorrow is another day. <b>Tap Close battle.</b>',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap([
      'You can read a battle: the defender fires first, dice at or under the number hit, and an attacker may abort to save his strength.',
    ]),
  ],
};

/* 6 · Winning a battle: artillery, the defender's hits, exploitation (Play Book 23.6: Weiswampach). */
const L_WIN: Lesson = {
  id: 'win',
  topic: 'Win a battle',
  chapter: CH,
  ref: '23.6',
  goal: 'Artillery, the defender’s hits, the chance to exploit',
  minutes: 3,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'combat', { '116 Pz': 22, '112/28': 22, Lehr: 13 });
    g.control[22] = 'allied';
    for (const a of [3, 12, 13, 21]) g.control[a] = 'german';
    avail(g, ['L31.0', 'L33.0', 'L62.0']);
    return g;
  },
  steps: [
    {
      title: 'Weiswampach',
      text: 'Your 116th Panzer faces a lone American regiment, the 112/28th, with no field works. This one you can win. <b>Tap Fight Weiswampach.</b>',
      target: GO,
      look: 22,
      done: (g) => !!g.battle,
      act: fightAt(22),
    },
    {
      title: 'Call the guns',
      text: 'Before anyone fires, both sides may commit <b>assets</b> from their hand. Your artillery chits glow. <b>Tap the 15th Rocket</b> to commit it.',
      rule: '6.22 Assets',
      why: 'Artillery fires before the blocks. At most two batteries per battle, one regular and one rocket.',
      target: { el: ['.card2[data-chit="L31.0"]', '.handtab button'], label: '15th Rocket card' },
      done: (g) => !!g.battle?.assets.german.includes('L31.0'),
      act: (g) => E.assign(g, g.battle!, 'L31.0'),
    },
    {
      title: 'They answer',
      text: 'The Allies commit the 333rd Artillery in reply. <b>Tap Begin combat.</b>',
      target: GO,
      done: stage('setup'),
      act: (g) => {
        answer(g);
        E.assign(g, g.battle!, 'L62.0');
        begin(g);
      },
    },
    {
      title: 'Your guns fire',
      text: 'Artillery rolls one die per battery, here for a 5. <b>Roll.</b>',
      rule: '6.25 Artillery fire',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'german', 'arty', [{ who: '', sn: 5, dice: [6] }])),
      done: stage('attArty'),
      act: roll,
    },
    {
      title: 'Theirs fire',
      text: 'Only a 4 for them: artillery does little against armour. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'allied', 'arty', [{ who: '', sn: 4, dice: [9] }])),
      done: stage('defArty'),
      act: roll,
    },
    {
      title: 'The defender fires',
      text: 'Veteran infantry against elite armour: they need a 3. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: '112', sn: 3, dice: [4] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'Your panzers fire',
      text: 'Three steps, three dice, a 6 or less to hit: +1 armour, +1 elite against veterans, −1 for the wooded terrain. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 6, dice: [1, 6, 5] }])),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'Three hits',
      text: 'A defender absorbs hits in order: field works first, then a <b>retreat</b> (it falls back disordered), then lost steps. The 112/28th retreats and is destroyed by the rest. Weiswampach is yours.',
      rule: '6.42 Defender hits',
      auto: (g) => {
        const b = g.battle!;
        if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
        if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      },
    },
    {
      title: 'Exploit!',
      text: 'You cleared the area with hits to spare: your armour may <b>exploit</b> the breach. It needs a morale check, a 7 or less for elite troops. <b>Roll.</b>',
      rule: '6.8 Exploitation',
      why: 'Only armour, only when the defenders are all gone with at least one hit to spare, and never after a river assault.',
      target: GO,
      skip: (g) => g.battle?.stage !== 'exploit',
      enter: (g) => queue(g, [6]),
      done: (g) => !g.battle || g.battle.stage === 'done',
      act: roll,
    },
    {
      title: 'Marked E',
      text: 'The 116th now carries an <b>E</b> tag: it will push one area further in the Breakthrough step. <b>Tap Close battle.</b>',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap(['You can win a battle: commit artillery, outgun the defender, and let your armour exploit the breach.']),
  ],
};

/* 7 · Reaction and Breakthrough (Play Book 23.7, turn 2). */
const BLOW_OK: Step = {
  title: 'No bridge blown',
  text: 'The Allied engineers are all spent: nobody tries to blow this bridge, and the block crosses.',
  skip: (g) => !g.pendingBlow,
  auto: (g) => {
    E.resolveBlow(g, false);
  },
};
const L_BREAK: Lesson = {
  id: 'breakthrough',
  topic: 'Break through',
  chapter: CH,
  ref: '23.7',
  goal: 'Exploiting and reserve blocks press on',
  minutes: 3,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'movement', { '116 Pz': 22, 'CCR/9': 36, Lehr: 13, '150 Pz': 12, '106 Inf': 24 });
    E.setReserve(g, U(g, 'Lehr').id, true, true);
    U(g, '116 Pz').exploit = true;
    for (const a of [21, 22, 12, 13]) g.control[a] = 'german';
    fuel(g);
    sa(g, 'german');
    for (const u of g.units) u.moved = true;
    for (const n of ['116 Pz', 'Lehr', '150 Pz']) U(g, n).moved = false;
    g.phase = 'reaction';
    g.fought = [];
    return g;
  },
  steps: [
    situation(
      'After the battles',
      `The fighting is over for now, and the American line has a hole in it. This is the moment the whole offensive is about.
    <p>First the enemy may <b>react</b> with his reserves. Then you <b>break through</b>: your exploiting armour and your reserves move again while the enemy is still off balance.</p>`,
      { look: 22 },
    ),
    {
      title: 'The enemy reacts',
      text: 'The Allies may now move their reserve blocks, even into contested areas. Today they have none ready: their new divisions arrived too late to be put in reserve.',
      rule: '7.1 Reaction',
      auto: (g) => {
        while (g.phase === 'reaction') E.endPhase(g);
      },
    },
    tapUnit('116 Pz', 'Through the hole', 'The 116th earned its <b>E</b> tag at Weiswampach. <b>Tap it.</b>', {
      rule: '7.3 Breakthrough movement',
    }),
    {
      title: 'One area forward',
      text: 'An exploiting block moves one area. Houffalize is held by the CCR/9th Armored: another battle. <b>Tap Houffalize.</b>',
      target: { area: 36 },
      look: 36,
      done: (g) => area('116 Pz', g) === 36 || !!g.pendingBlow,
      act: (g) => {
        E.move(g, U(g, '116 Pz').id, 36);
      },
    },
    BLOW_OK,
    tapUnit(
      'Lehr',
      'The reserve goes in',
      'Panzer Lehr waited in reserve for exactly this. A reserve block makes a full move. <b>Tap Panzer Lehr.</b>',
    ),
    {
      title: 'Fuel for the push',
      text: 'Vielsalm costs 5 points. Beyond 3, your armour burns a <b>fuel</b> chit: the route panel shows it spent. <b>Tap Vielsalm.</b>',
      rule: '16.13 Fuel',
      target: { area: 24 },
      look: 24,
      done: (g) => area('Lehr', g) === 24 || !!g.pendingBlow,
      act: (g) => {
        E.move(g, U(g, 'Lehr').id, 24);
      },
    },
    BLOW_OK,
    {
      title: 'Fight where you arrived',
      text: 'Every area your breakthrough contested must be fought now. <b>Tap End breakthrough moves.</b>',
      rule: '7.4 Breakthrough combat',
      target: GO,
      done: (g) => g.phase === 'btCombat',
      act: (g) => E.endPhase(g),
    },
    {
      title: 'Houffalize',
      text: '<b>Tap Fight Houffalize.</b>',
      target: GO,
      look: 36,
      done: (g) => !!g.battle && g.battle.stage !== 'setup',
      act: (g) => {
        fightAt(36)(g);
        begin(g);
      },
    },
    {
      title: 'Begin',
      text: '<b>Tap Begin combat.</b>',
      target: GO,
      skip: (g) => g.battle?.stage !== 'setup',
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'They fire',
      text: 'The CCR/9th needs a 5: your river crossing helps them. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'allied', 'ground', [{ who: 'CCR', sn: 5, dice: [5] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'You fire',
      text: 'One step lost, and the 116th presses on: two dice, a 3 or less. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'german', 'ground', [{ who: '116', sn: 3, dice: [1, 9] }])),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'They fall back',
      text: 'One hit: the CCR/9th gives up Houffalize and retreats to Noville, disordered.',
      auto: (g) => {
        const b = g.battle!;
        if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
        if (b.stage === 'retreat') {
          const o = E.retreatOptions(g, b);
          E.chooseRetreat(g, b, o.includes(48) ? 48 : o[0]);
        }
      },
    },
    {
      title: 'Close',
      text: '<b>Tap Close battle.</b> Panzer Lehr fights at Vielsalm next, the same way.',
      target: GO,
      skip: (g) => !g.battle,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap(['You can break through: exploiting armour and your reserves move again, and must fight wherever they arrive.']),
  ],
};

/* 8 · Supply (Play Book 23.8: KG Peiper at Werbomont, turn 3). */
const L_SUPPLY: Lesson = {
  id: 'supply',
  topic: 'Supply',
  chapter: CH,
  ref: '23.8',
  goal: 'Don’t outrun your supply line',
  minutes: 2,
  side: 'german',
  setup: () => {
    const g = bulgeTable(3, 'german', 'btCombat', {
      Peiper: 51,
      '18 VG': 34,
      'CCB/9': 34,
      '1SS(-)': 33,
      '3 FJ': 25,
      '62 VG': 24,
      '1 Inf': 52,
    }); // the Play Book has the 1st Infantry in Aywaille; under the 2016 series rules (9.31) it must hold Stoumont to cut Peiper off
    for (const a of [5, 6, 10, 23, 24, 25, 33, 51]) g.control[a] = 'german';
    for (const a of [34, 50, 35, 52, 53]) g.control[a] = 'allied';
    g.blown = [E.keyOf(34, 24), E.keyOf(34, 33), E.keyOf(25, 23)];
    const eng = C(g, 'L88.0');
    eng.box = 'map';
    g.units.push({
      id: 'DR-L88.0',
      name: '168th (defended roadblock)',
      side: 'allied',
      cls: 'infantry',
      q: ['green'],
      max: 1,
      str: 1,
      area: 50,
      garrison: true,
      disorder: 0,
      unsupplied: false,
      moved: true,
      reserve: null,
      exploit: false,
      ech: eng.ech,
      chitId: 'L88.0',
    });
    g.contestedAtMoveStart = E.contestedAreas(g);
    g.fought = [...g.contestedAtMoveStart];
    E.endPhase(g);
    g.log = [];
    return g;
  },
  steps: [
    situation(
      'Too far, too fast',
      `Turn 3. <b>KG Peiper</b> raced all the way to Werbomont, trusting the 18th VG to clear the road behind him. The 18th failed.
    <p>At the end of your turn every block needs a <b>supply line</b>: a chain of areas you control, back to your side of the map. No enemy-held area on the way, no blown bridge.</p>`,
      { look: 51 },
    ),
    {
      title: 'See your supply',
      text: '<b>Tap Map, then Supply.</b> Your supplied areas take your colour; areas cut off are striped.',
      target: { el: ['.laysw button[title^="Supply"]', '.mapmenu-btn'], label: 'Supply in the Map list' },
      done: (_g, q) => q('.laysw button[aria-pressed="true"][title^="Supply"]'),
    },
    tapUnit('1SS(-)', 'Safe', '<b>Tap the 1st SS in Malmedy.</b> Its panel shows its line, back through Ligneuville to your entry area.', {
      rule: '9.31 Supply paths',
    }),
    tapUnit(
      'Peiper',
      'Cut off',
      'Now <b>tap KG Peiper.</b> Every road out of Werbomont is in enemy hands: it is <b>cut off</b>, with nothing coming up the road behind it.',
    ),
    {
      title: 'The price',
      text: 'A cut-off block rolls a <b>morale check</b>; fail it and it loses a step. Until supply comes back it moves only one area at a time and gets no assets. <b>Tap Roll supply checks.</b>',
      rule: '9.4 Supply checks',
      target: { el: ['.c-bar.b .go', '.c-bar.b button'], text: 'Roll', label: 'Roll button' },
      enter: (g) => queue(g, [9, 9, 9]),
      done: (g) => !g.supplyPending,
      act: (g) => E.rollSupply(g),
    },
    recap(['You know the limit of every attack: push deep, but keep the road behind you open, or your spearhead starves.']),
  ],
};

/* 9 · The end of the day and the victory check (Play Book 23.9–23.10, turn 4). */
const L_END: Lesson = {
  id: 'end-of-day',
  topic: 'The end of the day',
  chapter: CH,
  ref: '23.10',
  goal: 'The Allied turn, the victory check, your first game',
  minutes: 1.5,
  side: 'german',
  setup: () => {
    E.useGame('bulge');
    const g = E.newGame(2007, { scenario: 'campaign', fuel: true });
    g.turn = 4;
    g.phase = 'movement';
    g.log = [];
    for (const a of [27, 8, 47, 55, 75, 77]) g.control[a] = 'allied';
    for (const a of [33, 51]) g.control[a] = 'german';
    return g;
  },
  steps: [
    situation(
      'Their turn',
      `After your Supply step the <b>Allies</b> play the same steps against you. Online, the top bar says whose move it is, and you can chat while you wait.
    <p>When both have played, the day ends with the <b>victory check</b>.</p>`,
      { look: 47 },
    ),
    {
      title: 'Who is winning?',
      text: 'Here it is turn 4, and things have gone badly for you. <b>Tap the score track.</b>',
      rule: '19.0 Victory',
      target: { el: '.vps', label: 'the score track' },
      done: (_g, q) => q('.vsheet'),
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'One step from defeat',
      'The Allies hold six objectives, you two: they lead by 4. The sudden-death number for turn 4 is <b>5</b>: one more town, or one of your divisions destroyed, and they win at once. <b>Close the sheet.</b>',
    ),
    {
      title: 'Your first game',
      kind: 'recap',
      text: `<ul><li>Prepare: play your chits.</li><li>Move: roads are fast, sectors and rivers slow you down, armour needs fuel.</li><li>Fight: guns first, then the defender, then you; win cleanly and exploit.</li><li>Break through, then keep your supply line open.</li><li>Watch the score: sudden death can end it any day.</li></ul>
    <p>You are ready. <b>Nuts!</b>, the Introductory Scenario, is a short battle around Bastogne: the best first game.</p>`,
    },
  ],
};

export const BASICS_COURSE: Course = {
  id: 'bulge-basics',
  game: 'bulge',
  title: 'The Bulge: your first turn',
  sub: '9 lessons · about 22 minutes',
  blurb:
    "Who you are, what you fight for, then one German turn step by step, on the Play Book's own examples: chits, moving, battles, breakthrough, supply, the score.",
  minutes: 22,
  lessons: [L_GOAL, L_PREPARE, L_MOVE, L_STRAT, L_FIGHT, L_WIN, L_BREAK, L_SUPPLY, L_END],
  end: [
    { label: 'Start a Nuts! game', scenario: 'intro', primary: true },
    { label: 'Start the Tournament', scenario: 'tournament' },
  ],
};
