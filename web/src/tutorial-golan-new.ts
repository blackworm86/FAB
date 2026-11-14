/** Golan '73: what's new. The short course for a player who knows the series from The Bulge (docs/TUTORIAL-OUTLINE.md, in the voice of
 *  tutorial-basics.ts): who fights whom and what is different, then only the Golan's own rules, each on the Play Book's Example of Play
 *  (setups and dice from tutorial-golan.ts). Reached at ?tutorial=golan73-whats-new until it replaces the old course on the home page.
 *  Engine only (no DOM), so the tests play every step. */
import * as E from '../../engine/src';
import {
  type Course,
  type Lesson,
  type G,
  U,
  C,
  area,
  avail,
  queue,
  stage,
  begin,
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
  golanTable,
  pieces,
  golanBlock,
  golanWood,
  golanChit,
  runTo,
} from './tutorial-kit';

const G = E.golan;
const CH = "What's new";
/** Phones fold the volume's prompts to a handle: the coach points at it first, then at the button inside (no text filter, it would apply to both). */
const FOLDED = '.volfold[aria-expanded="false"]';
/** Operation Badr, set up and ready for the Syrian Combat Phase of turn 1. */
const badrStart = () => {
  E.useGame('golan73');
  const g = E.newGame(1973, { scenario: 'badr' });
  G.autoStrongpoints(g, 'historical');
  G.autoMinefields(g);
  E.endPhase(g);
  g.log = [];
  return g;
};
/** Only these chits in the Available boxes; the rest go to the cups. */
const hand = (g: G, ids: string[]) => {
  for (const c of g.chits.filter((x) => x.box === 'available')) c.box = 'cup';
  avail(g, ids);
};

/* 1 · The war, the goal, what is new; then the Purple Line: minefields and the ditch (Play Book Ex 6, Ex 5, Ex 4). */
const L_LINE: Lesson = {
  id: 'gn-purple-line',
  topic: 'The Purple Line',
  chapter: CH,
  ref: 'Ex 4, 5, 6',
  goal: 'Who you are, what you fight for; minefields and the anti-tank ditch',
  minutes: 2.5,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'movement', { S04: 48, S11: 48, S14: 64, I07: 47 }, { keep: ['I25'] });
    for (const a of [48, 64]) g.control[a] = 'syrian';
    for (const a of [47, 50]) g.control[a] = 'israeli';
    return g;
  },
  steps: [
    situation(
      '6 October 1973',
      `Yom Kippur. Five Syrian divisions attack the <b>Golan Heights</b>, held by two Israeli armoured brigades and a chain of bunkers, while Israel's reserves mobilise in a hurry.
    <p>You play <b>Syria</b>. Your goal: break through the <b>Purple Line</b>, the 1967 ceasefire line, and drive for the <b>Jordan bridges</b> before the reserves climb the heights. Every half-day you lose, more Israeli tanks arrive.</p>`,
      { look: 48 },
    ),
    next(
      'What is different from The Bulge',
      `<ul><li><b>Half-day turns</b>: nine of them, and turn 2 is the night.</li><li><b>Syria plays first</b> every turn; Israel answers.</li><li><b>Strongpoints</b> and dummy <b>ghosts</b> guard the line.</li><li><b>Minefields</b> and an anti-tank ditch slow you down.</li><li><b>SAMs</b> shield you from the Israeli air force.</li></ul>No fuel rule. Everything else works as you know it.`,
      { rule: '14.0 Terrain · 15.0 Units · 16.0 Assets' },
    ),
    tapUnit(
      'S11',
      'A minefield ahead',
      'Turn 3, the morning of 7 October. Your troops are through the line at Bunker 109, but the road west to Ein Zivan crosses a <b>minefield</b>. <b>Tap the 9th Recon.</b>',
      { rule: '14.02 Minefields' },
    ),
    {
      title: 'Through the mines',
      text: 'Crossing a minefield costs <b>1 extra point and a morale check</b>. Fail it and your block stays where it is. <b>Tap Ein Zivan.</b>',
      mover: 'S11',
      target: { area: 47 },
      look: 47,
      enter: (g) => queue(g, [7]),
      done: (g) => G.state(g).minefieldFailed.includes('S11') || area('S11', g) === 47,
      act: (g) => {
        E.move(g, U(g, 'S11').id, 47);
      },
    },
    next(
      'Stopped',
      'A 7 against a 5: <b>failed</b>. The recon stays in Bunker 109 and may not try any minefield again this turn. It paid only the extra point, so it still has 5 points to go round.',
      {
        rule: '14.02 Minefields',
        why: 'Israel places six minefields before play: three printed on the map, three of its choice. Only Syrian blocks check; only engineers can lift a minefield (14.52).',
      },
    ),
    moveTo(
      'S11',
      47,
      'The long way round',
      'Round by Tel Hazeika and Mt. Yosifon there are no mines: 5 points, the rest of its move. <b>Tap Ein Zivan.</b>',
    ),
    {
      ...moveTo(
        'S04',
        47,
        'Second try',
        'Now the <b>52nd Infantry</b> tries the same field: 1 for the road, 1 because the area is occupied, 1 for the mines. Its whole move. <b>Tap Ein Zivan.</b>',
      ),
      enter: (g) => queue(g, [4]),
    },
    moveTo(
      'S14',
      50,
      'The anti-tank ditch',
      'A 4: through. Along the whole Purple Line runs an <b>anti-tank ditch</b>. Crossing it takes a block’s <b>whole move</b>, and the battle after it is a <b>crossing assault</b>: you fire at −1 and may not exploit. <b>Move the 46th Tank into Booster.</b>',
      {
        rule: '14.12 Anti-tank ditch',
        why: 'Only one block may cross each ditch boundary into an enemy area per Movement step. Engineers can bridge the ditch (14.51): a bridged ditch is crossed like an ordinary road or field.',
      },
    ),
    next(
      'Cliffs and rocks',
      'Two more boundaries hold you back. The <b>escarpment</b> down to the Jordan valley is crossed only by road, for 1 extra point. <b>Rugged</b> ground under Mt Hermon is for infantry only, and costs its whole move. Each lets only <b>one block</b> across per Movement step.',
      { rule: '14.11 Escarpment · 14.14 Rugged', look: 36 },
    ),
    recap([
      'You can cross the Purple Line: mines cost 1 more and a morale check, the ditch costs your whole move and makes the battle a crossing assault.',
    ]),
  ],
};

/* 2 · Strongpoints and ghosts (Play Book Ex 9: the 112th Infantry against the Juhader strongpoint, turn 1; a ghost in Kuneitra). */
const L_FORTS: Lesson = {
  id: 'gn-strongpoints',
  topic: 'Strongpoints and ghosts',
  chapter: CH,
  ref: 'Ex 9',
  goal: 'Break a bunker, bridge the ditch, unmask a ghost',
  minutes: 2.5,
  side: 'syrian',
  setup: () => {
    const g = golanTable(1, 'syrian', 'combat', { S02: 28, I30: 28, S04: 49 }, { keep: ['I31'] });
    g.riverAssault = [28, 49];
    U(g, 'S02').from = 79;
    for (const a of [28, 49]) g.control[a] = 'israeli';
    hand(g, ['SC10', 'SC14a']);
    return g;
  },
  steps: [
    situation(
      'Juhader, turn 1',
      `The afternoon of 6 October. Your <b>112th Infantry</b> has crossed the ditch into Juhader. Waiting for it: an Israeli <b>strongpoint</b>, a bunker that never moves and never retreats.
    <p>A strongpoint fires <b>one die</b>, however many stars it has, and it makes you fire worse, like field works. And you crossed the ditch: this is a <b>crossing assault</b>.</p>`,
      {
        look: 28,
        figure: (g) =>
          pieces([
            { svg: golanBlock(g, 'I30'), wood: golanWood(g, 'I30'), cap: 'Strongpoint: the stars are its steps' },
            { svg: golanBlock(g, 'I31'), wood: golanWood(g, 'I31'), cap: 'Ghost: nothing at all' },
          ]),
      },
    ),
    {
      title: 'Into the bunker line',
      text: '<b>Tap Next battle: Juhader.</b>',
      rule: '15.6 Strongpoints',
      target: GO,
      done: (g) => !!g.battle,
      act: fightAt(28),
    },
    {
      title: 'Bring the engineers',
      text: 'In a crossing assault your engineers can fight, or <b>bridge the ditch</b> if they survive the enemy fire. <b>Tap the 5th Engineers.</b>',
      rule: '14.51b Bridging in combat',
      target: { el: ['.card2[data-chit="SC10"]', '.handtab button'], label: '5th Engineers card' },
      done: (g) => !!g.battle?.assets.syrian.includes('SC10'),
      act: (g) => E.assign(g, g.battle!, 'SC10'),
    },
    {
      title: 'Where the bridge goes',
      text: 'Your engineers ask where to bridge. <b>Tap towards Dhake</b>: the boundary with the road, so your tanks can follow by road.',
      target: { el: [FOLDED, '.volpanel .row button:last-child'], label: 'towards Dhake' },
      done: (g) => !!g.battle && G.battleState(g.battle).engBridge === '28-79',
      act: (g) => G.setEngineerBridge(g, g.battle!, 79),
    },
    {
      title: 'Air cover',
      text: 'Your <b>air support</b> flies close support for the 112th: +1 to its fire.',
      rule: '16.31a Close air support',
      auto: (g) => E.assign(g, g.battle!, 'SC14a', 'support', 'S02'),
    },
    { title: 'Face up', text: '<b>Tap Begin combat.</b> No artillery on either side.', target: GO, done: stage('setup'), act: begin },
    {
      title: 'The bunker fires',
      text: 'One die, needing a 5: −1 for the rifle on its label, +1 because you are assaulting. <b>Roll.</b>',
      rule: '15.6 Strongpoints',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'israeli', 'ground', [{ who: 'Strongpoint', sn: 5, dice: [2] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'Who pays',
      text: 'A hit. The first hit always costs a step, and you choose who pays: the point unit or an asset. Keep the engineers alive for the bridge: <b>tap the 112th.</b>',
      rule: '6.41 Attacker hits',
      target: { unit: 'S02', label: '112th Infantry' },
      skip: (g) => g.battle?.stage !== 'attFirst',
      done: (g) => g.battle?.stage !== 'attFirst',
      act: (g) => E.chooseFirstLoss(g, g.battle!, 'S02'),
    },
    {
      title: 'Your fire',
      text: 'Three dice for a 4: +1 air support, −1 crossing assault, −1 against a strongpoint. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'syrian', 'ground', [{ who: '112', sn: 4, dice: [3, 4, 6, 9] }])),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'A gap in the line',
      text: 'Two hits. A strongpoint cannot retreat: with its two stars gone it is <b>destroyed</b>. Your engineers lay their bridge towards Dhake: a road through the line. <b>Tap Close battle.</b>',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    {
      title: 'Another bunker?',
      text: 'Your <b>52nd Infantry</b> crossed into Kuneitra, where another Israeli block waits. <b>Tap Next battle: Kuneitra.</b>',
      target: GO,
      look: 49,
      done: (g) => !!g.battle,
      act: fightAt(49),
    },
    {
      title: 'Face up again',
      text: '<b>Tap Begin combat.</b>',
      target: GO,
      done: (g) => !g.battle || g.battle.stage !== 'setup',
      act: begin,
    },
    {
      title: 'A ghost',
      text: 'Nothing there: a <b>ghost</b>, a dummy block. It vanishes, and Kuneitra is yours without a shot. Israel hides three ghosts among its eight strongpoints, all face-down. <b>Tap Close battle.</b>',
      rule: '15.7 Ghosts',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap([
      'You can break the bunker line: strongpoints fire one die and never retreat, ghosts vanish when attacked, and engineers bridge the ditch behind you.',
    ]),
  ],
};

/* 3 · SAMs and the Israeli air force (Play Book Ex 2: interdiction over Jasim and Tel Kudne, turn 4). */
const L_SAM: Lesson = {
  id: 'gn-sams',
  topic: 'SAMs and air power',
  chapter: CH,
  ref: 'Ex 2',
  goal: 'Israeli air missions, and the missiles that answer them',
  minutes: 2,
  side: 'israeli',
  setup: () => {
    const g = golanTable(4, 'syrian', 'admin', { S26: 75, S25: 75, I05: 42 });
    hand(g, ['IC03', 'IC10a', 'SC17c', 'SC17d']);
    E.setDone(g, 'syrian'); // 4.2b/c: the Syrian player has finished his part of the Prepare step; Israel acts now
    return g;
  },
  steps: [
    situation(
      'Turn 4: the tanks are coming',
      `The afternoon of 7 October. Syria's <b>1st Tank Division</b> is moving up from Jasim to join the breakthrough. For this lesson you start as <b>Israel</b>: your air force is the best in the region, and it can slow those tanks down.
    <p>But east of the dot-dash <b>SAM barrier</b>, Syrian missiles can answer every Israeli air mission.</p>`,
      { look: 75 },
    ),
    {
      title: 'Interdiction',
      text: 'In the Prepare step an air asset can <b>interdict</b> an area: enemy blocks pay 1 extra point to enter it and 1 to leave. <b>Tap your Air Support.</b>',
      rule: '16.31b Interdiction',
      target: { el: ['.card2[data-chit="IC03"]', '.handtab button'], label: 'Air Support card' },
      done: (g, q) => q('.chitbar', 'Air Support') || C(g, 'IC03').box !== 'available',
    },
    {
      title: 'Over Jasim',
      text: '<b>Tap Jasim</b>, where the tanks stand.',
      target: { area: 75 },
      look: 75,
      done: (g) => C(g, 'IC03').box !== 'available',
      act: (g) => G.airInterdiction(g, 'IC03', 75),
    },
    {
      title: 'Switch chairs: fire a SAM',
      text: 'Jasim is east of the barrier, so Syria may answer. As Syria, <b>tap Fire a SAM.</b>',
      rule: '16.12 SAM fire',
      why: 'On turns 4–6 a 1 shoots the aircraft down and 2–5 cancel the mission. On turns 1–3 a SAM cancels on 2–7, on turns 7–9 only on 2–3: the missiles run short. Each turn, if any SAM in the Used box rolls 6 or more, one SAM is lost for good.',
      target: { el: [FOLDED, '.volpanel.sam button.primary'], label: 'Fire a SAM button' },
      enter: (g) => queue(g, [3]),
      done: (g) => !G.state(g).samTarget,
      act: (g) => G.fireSam(g, 'SC17c'),
    },
    {
      title: 'Cancelled',
      text: 'A <b>3</b>: the aircraft turn back, and the air chit and your SAM go to the Used box. Israel sends its second Air Support over <b>Tel Kudne</b>, the next area on the road.',
      look: 73,
      auto: (g) => G.airInterdiction(g, 'IC10a', 73),
    },
    {
      title: 'Fire again',
      text: '<b>Tap Fire a SAM.</b>',
      target: { el: [FOLDED, '.volpanel.sam button.primary'], label: 'Fire a SAM button' },
      enter: (g) => queue(g, [6]),
      done: (g) => !G.state(g).samTarget,
      act: (g) => G.fireSam(g, 'SC17d'),
    },
    next(
      'It gets through',
      'A <b>6</b>: no effect. Tel Kudne stays interdicted until the Israeli Supply step: every Syrian block pays 1 more to enter it and 1 more to leave. Your tanks reach the front late.',
    ),
    next(
      'Israel rules the air',
      'Israel may put <b>two</b> air assets into one battle, one firing as artillery and one giving +2 to a block, but east of the barrier only when Syria has no SAM ready. And while Israel holds <b>Mt Hermon</b>, it may use one artillery asset more in every battle. Keep SAMs in your hand.',
      { rule: '16.21 · 16.22 Israeli advantages' },
    ),
    recap(['You can shield your tanks: keep SAMs ready to answer Israeli air missions east of the barrier.']),
  ],
};

/* 4 · Electronic warfare (Play Book Ex 11: the 43rd Tank jams Golani in Sindiana, turn 3; Ex 12 in one card). */
const L_EW: Lesson = {
  id: 'gn-ew',
  topic: 'Electronic warfare',
  chapter: CH,
  ref: 'Ex 11, 12',
  goal: 'Jam the defence before it can call for help',
  minutes: 2.5,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'combat', { S12: 37, I01: 37, I05: 42 });
    g.control[37] = 'israeli';
    for (const a of [38, 32, 30]) g.control[a] = 'syrian';
    hand(g, ['SC16', 'IC36', 'IC01']);
    return g;
  },
  steps: [
    situation(
      'Sindiana, turn 3',
      `The morning of 7 October. Your <b>43rd Tank</b> attacks <b>Golani</b>, Israel's elite infantry, in Sindiana. Israel has artillery ready to support them.
    <p>Each side may play <b>one event</b> in a battle. Yours is <b>electronic warfare</b>: jam their radios before they can call for help.</p>`,
      { look: 37 },
    ),
    { title: 'The battle', text: '<b>Tap Next battle: Sindiana.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(37) },
    {
      title: 'Jam them',
      text: 'You attack, so you play first, before Israel commits anything. <b>Tap the EW card.</b>',
      rule: '17.33 Electronic warfare',
      why: 'Command disruption: each defending block rolls a die, and on 5 or less it is disordered. If every defender is disordered, the defender may commit no artillery, air support, SAM or battle asset.',
      target: { el: ['.card2[data-chit="SC16"]', '.handtab button'], label: 'EW card' },
      done: (g) => !!g.battle && !!G.battleState(g.battle).ew?.pending,
      act: (g) => G.playJamming(g, g.battle!, 'SC16'),
    },
    {
      title: 'Countermeasures',
      text: 'Israel answers with its own EW card as <b>countermeasures</b>: +2 to the roll. Golani rolls now.',
      enter: (g) => queue(g, [2]),
      auto: (g) => G.answerJamming(g, g.battle!, 'IC36'),
    },
    {
      title: 'Jammed',
      text: 'A 2, +2 = 4: still 5 or less. Golani is <b>disordered</b>, and Israel may commit <b>nothing</b>: its artillery stays silent. <b>Tap Begin combat.</b>',
      target: GO,
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'Golani fires',
      text: 'Disordered, it fires at −1: three dice for a 4. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, [8, 9, 7]),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'Your tanks fire',
      text: 'Three dice for a 5: +1 for armour, −1 for veterans against elite. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, [2, 4, 9]),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'Golani falls back',
      text: 'Two hits. Israel retreats Golani to absorb one, and it loses a step for the other.',
      auto: (g) => {
        const b = g.battle!;
        if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
        if (b.stage === 'retreat') E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]);
      },
    },
    { title: 'Sindiana is yours', text: '<b>Tap Close battle.</b>', target: GO, done: (g) => !g.battle, act: (g) => E.closeBattle(g) },
    next(
      'Counterbattery',
      'The other combat event is <b>Counterbattery</b>: after the enemy artillery fires, roll a die. On 1 to 5 that battery is knocked out, and comes back only that many turns later. Both sides have one.',
      {
        rule: '17.34 Counterbattery',
        figure: (g) =>
          pieces([
            { svg: golanChit(g, 'SC16'), cap: 'Electronic warfare' },
            { svg: golanChit(g, 'SC15'), cap: 'Counterbattery' },
          ]),
      },
    ),
    recap(['You can win a battle before the first shot: jam the defence, and it fights alone.']),
  ],
};

/* 5 · Syria's special forces (Play Book Ex 13: the 185th Commandos raid El-Al; Ex 10: the 82nd Para drops on Mt Hermon; turn 3). */
const L_SPECIAL: Lesson = {
  id: 'gn-special-forces',
  topic: "Syria's special forces",
  chapter: CH,
  ref: 'Ex 10, 13',
  goal: 'Commando raids, the 82nd Para, the reserves behind you',
  minutes: 2,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'admin', { S16: 26, S14: 22, I11: 12, I05: 42 });
    for (const a of [22, 26, 27, 28, 31, 32, 33, 38, 41, 47, 48, 49, 50]) g.control[a] = 'syrian';
    hand(g, ['SC40']);
    return g;
  },
  steps: [
    situation(
      'Behind the line',
      `Turn 3. Syria has troops no other army in the series has: <b>commandos</b> that land by helicopter behind the Israeli line, and the <b>82nd Para</b>, which drops from the sky once a game.
    <p>Your <b>46th Tank</b> stands at Ramat Magshimim, next to El-Al, on the way the Israeli reserves come up into the southern Golan.</p>`,
      { look: 21 },
    ),
    {
      title: 'Commandos',
      text: 'A commando raid lands in the Prepare step, in a <b>vacant Israeli area next to one of your blocks</b>. <b>Tap the 185th Commandos.</b>',
      rule: '16.11a Commando raid',
      target: { el: ['.card2[data-chit="SC40"]', '.handtab button'], label: '185th Commandos card' },
      done: (g, q) => q('.chitbar', 'Cdo') || q('.chitbar', 'Commando') || C(g, 'SC40').box === 'map',
    },
    {
      title: 'El-Al',
      text: '<b>Tap El-Al.</b>',
      target: { area: 21 },
      look: 21,
      done: (g) => C(g, 'SC40').box === 'map',
      act: (g) => G.placeRaid(g, 'SC40', 21),
    },
    next(
      'What the raid does',
      'No Israeli block may strat-move or retreat into El-Al. The first one to enter pays 1 more and makes you roll: <b>1–2</b> the raid holds and fights like a defended roadblock, <b>3–5</b> it holds but does not fire, <b>6 or more</b> the helicopters were shot down.',
      { rule: '16.11a Commando raid' },
    ),
    {
      title: 'On to the Fight step',
      text: 'Nothing else to do here: the coach plays on to your Fight step, where the 82nd Para can strike first.',
      auto: (g) => runTo(g, 3, 'syrian', 'combat'),
    },
    {
      title: 'The 82nd Para',
      text: 'Once a game, as the <b>first action</b> of a Syrian Fight step, the 82nd Para may land in any area east of the SAM barrier, or on <b>Mt Hermon</b>. <b>Tap Choose the landing area.</b>',
      rule: '15.3 Syrian paratroops',
      target: { el: [FOLDED, '.volpanel button.primary'], label: 'landing button' },
      done: (g, q) => area('S17', g) === 83 || q('.c-prompt', 'Air assault'),
    },
    {
      title: 'Mt Hermon',
      text: 'The Israeli observation post on the mountain, held by a garrison. Take it and Israel loses its extra artillery, and the star is yours. <b>Tap Mt Hermon.</b>',
      target: { area: 83 },
      look: 83,
      done: (g) => area('S17', g) === 83,
      act: (g) => G.airAssault(g, 83),
    },
    next(
      'An air assault',
      'The mountain is contested now, and this battle comes <b>before any other</b>. It is an assault: your paratroopers fire at −1 and may not exploit. No drop on the night turn.',
      { rule: '15.3 · 14.01 Assaults' },
    ),
    next(
      'Reserves behind you',
      'Two Syrian reserves wait off the map. The <b>Operational Reserve</b>, the 3rd Tank Division, comes in one brigade per Special Action from turn 3. The <b>Strategic Reserve</b> (Assad Guard, 141st Tank, 90th Mech) comes only with its events, or two units at once if an Israeli block crosses the Purple Line into Syria.',
      { rule: '14.61b · 15.2 Reserves' },
    ),
    recap([
      'You can strike behind the line: commandos block the roads the reserves need, and the 82nd Para drops once, first thing in a Fight step.',
    ]),
  ],
};

/* 6 · Winning on the Golan, and your first game (Operation Badr, 22.1). */
const L_WIN: Lesson = {
  id: 'gn-winning',
  topic: 'Winning on the Golan',
  chapter: CH,
  ref: '22.1',
  goal: 'The score, the Jordan, Mt Hermon, the night; your first game',
  minutes: 1.5,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'Operation Badr',
      `Back to the start: the afternoon of 6 October, your first battles along the Purple Line still to fight.
    <p>Israel holds every star on the map, so it starts <b>6 points ahead</b>. Your job is to take those points from it.</p>`,
      { look: 42 },
    ),
    {
      title: 'The score',
      text: 'The track at the top shows who is ahead. <b>Tap it.</b>',
      rule: '19.0 Victory',
      target: { el: '.vps', label: 'the score track' },
      done: (_g, q) => q('.vsheet'),
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'Three turns',
      `<b>Syrian objectives</b> score only for you, while a Syrian block holds them in supply: the two Jordan bridges are worth 3 each. The other stars score for whoever holds them. From <b>turn 4</b> a lead of <b>7</b> wins Syria the game at once, but a lead of just <b>3</b> wins it for Israel: you have three turns to cut that lead.
    <p><b>Close the sheet.</b></p>`,
    ),
    next(
      'Over the Jordan',
      'One more way to win: a supplied Syrian block <b>west of the Jordan</b> (Gadot, Kfar Hanasi or Almagor) at the end of an Israeli turn wins the game outright, whatever the score.',
      { rule: '19.5 Syrian automatic victory', look: 9 },
    ),
    next(
      'Mt Hermon',
      'Blocks on <b>Mt Hermon</b> are always in supply, whoever holds it. Only infantry can climb it from Majdal Shams, with its whole move.',
      { rule: '14.16 · 14.94 Mt Hermon', look: 83 },
    ),
    next(
      'The night',
      'Turn 2 is the <b>night</b>: Syrian infantry moves one area and armour two (4 points at most), nobody flies, the 82nd Para may not drop, and everyone fires at −1, except your tanks.',
      { rule: '14.03 Night turn' },
    ),
    {
      title: 'Your first game',
      kind: 'recap',
      text: `<ul><li>Mines need a check; the ditch takes a whole move.</li><li>Strongpoints never retreat; ghosts vanish.</li><li>SAMs answer Israeli planes; EW jams a defence.</li><li>Commandos and the 82nd Para strike behind the line.</li><li>Cut Israel's lead before turn 4.</li></ul><p>You are ready for <b>Operation Badr</b>.</p>`,
    },
  ],
};

export const GOLAN_WHATS_NEW: Course = {
  id: 'golan73-whats-new',
  game: 'golan73',
  title: "Golan '73: what's new",
  sub: '6 lessons · about 13 minutes',
  blurb:
    "For players who know The Bulge: who fights whom on the Golan, then only what is new, on the Play Book's own examples: minefields and the ditch, strongpoints and ghosts, SAMs, electronic warfare, commandos, and how Syria wins.",
  minutes: 13,
  lessons: [L_LINE, L_FORTS, L_SAM, L_EW, L_SPECIAL, L_WIN],
  end: [
    { label: 'Start Operation Badr', scenario: 'badr', primary: true },
    { label: 'Badr, free set-up', scenario: 'badr_alt' },
  ],
};
