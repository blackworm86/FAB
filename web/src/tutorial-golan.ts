/** The Golan '73 lessons (docs/TUTORIAL.md), built on the Exclusive Rules and the Play Book's Examples 1-15. Two courses share them:
 *  "learn to play" for a first game, and "what's new" for players who know The Bulge. Engine only (no DOM), so the tests play every step. */
import { infoOf } from './tutorial-list';
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
  saChit,
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
  golanTable,
  pieces,
  blockAnatomy,
  strengths,
  golanBlock,
  golanWood,
  golanChit,
  autoFight,
  runTo,
} from './tutorial-kit';

const G = E.golan;
const A = () => G.ASSEMBLY.A;
const CH1 = 'Before you start',
  CH2 = 'The Golan turn',
  CHN = 'What changes on the Golan';
const closeModal = (text = '<b>Close the window.</b>') => closeStep('.modal [aria-label="Close"]', '.modal', 'Close it', text);
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
const stripe = (g: G, id: string) => U(g, id).brigade ?? U(g, id).division ?? '';

/* ================= Basics ================= */
const L_WELCOME: Lesson = {
  id: 'g-welcome',
  topic: 'Welcome to the Golan',
  chapter: CH1,
  goal: 'The battle, the two sides and how you win',
  minutes: 4,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'Welcome to the Golan',
      `It is the afternoon of <b>6 October 1973</b>, Yom Kippur. Three Syrian infantry divisions, backed by two tank divisions, cross the ceasefire line to retake the Golan Heights before the Israeli reserves can arrive.
    <p>One player is <b>Syrian</b>, the other <b>Israeli</b>. A turn is half a day; the historical scenario lasts nine turns. In this course you sit on whichever side the example is about, mostly the Syrians.</p>
    <p>Drag to look around, pinch or scroll to zoom. The coach waits for you.</p>`,
      { look: 39 },
    ),
    {
      title: 'How you win',
      text: 'The strip under the top bar is the <b>score</b>. <b>Tap it.</b>',
      target: { el: '.vps', label: 'score strip' },
      done: (_g, q) => q('.vsheet'),
    },
    {
      title: 'Victory points',
      text: `<ul><li><b>Syrian objectives</b> (green stars with a number) score for Syria when it holds them, supplied and occupied: the Jordan bridges are worth the most.</li>
    <li><b>Mutual objectives</b> (red stars) score one point for whoever holds them. Israel holds all six at the start, so it begins at 6.</li>
    <li>Israel also scores one point for each area it holds on the Syrian side of the line.</li><li>Each big enemy unit destroyed is a point.</li></ul>`,
      rule: '19.1–19.2 Victory points',
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'Three ways to win',
      `<b>Sudden death</b> from turn 4, with the lead printed on the turn track. <b>At the end</b>, the final score. And a <b>Syrian automatic victory</b> if a supplied Syrian unit stands west of the Jordan at the end of any turn. <b>Close the sheet.</b>`,
    ),
    {
      title: 'The two sides',
      text: `<b>Green blocks</b> are Syrian, <b>cyan</b> blocks Israeli. The Syrians move first each turn. As in every FAB game, a block stands upright with its face towards its owner: the enemy sees its colour and nothing else until a battle.`,
      rule: '2.0 Game pieces',
      figure: (g) =>
        pieces([
          { svg: golanBlock(g, 'S26'), wood: golanWood(g, 'S26'), cap: 'Syrian: 91st Tank Brigade' },
          { svg: golanBlock(g, 'I05'), wood: golanWood(g, 'I05'), cap: 'Israeli: 77th Battalion, 7th Brigade' },
        ]),
    },
    {
      title: 'A turn in five steps',
      text: 'The top bar shows the five steps of a player turn. <b>Tap the step names.</b>',
      target: { el: ['.c-crumbs', '.c-stat .tp'], label: 'step names' },
      tap: true,
    },
    {
      title: 'Prepare, Move, Fight, Breakthrough, Supply',
      text: `<ul><li><b>Prepare</b>: new units and chits arrive, you draw chits and play some.</li><li><b>Move</b>: your blocks move.</li><li><b>Fight</b>: a battle in every area where both sides stand.</li><li><b>Breakthrough</b>: reserves and winners move again, and fight again.</li><li><b>Supply</b>: cut-off blocks check morale.</li></ul>
    <p>Syria plays the five steps, then Israel. After both, the score is checked. <b>Turn 2 is the night</b>: Syrian blocks crawl, nobody flies, and everyone shoots worse.</p>`,
      rule: '3.0 Sequence of play · 14.03 Night',
    },
    {
      title: 'The bottom bar',
      text: 'The line at the bottom says <b>what the game expects now</b>: here, seven battles to fight before the step can end. When nothing is owed, a red button <b>ends the step</b>. Next to it, <b>Undo</b> and <b>ⓘ</b> (short or full explanations). The chips are shortcuts to the blocks that can act.',
      target: { el: '.c-bar.b', label: 'bottom bar' },
    },
    {
      title: 'Terrain defence',
      text: 'The <b>Map</b> button on the map chooses its colours. <b>Tap Map, then TDN</b>: the darker an area, the harder it is to attack. The Golan has hills worth 2 and Mt Hermon worth 3.',
      target: { el: ['.laysw button[title="Terrain defence"]', '.mapmenu-btn'], label: 'TDN in the Map list' },
      done: (_g, q) => q('.laysw button[aria-pressed="true"][title="Terrain defence"]'),
      rule: '6.3 Terrain Defense Number',
    },
    recap([
      'Syria scores its numbered objectives while it holds, occupies and supplies them; mutual stars score for either side.',
      'Israel starts at 6 and scores for Syrian-side areas it holds.',
      'Sudden death from turn 4; a supplied Syrian block west of the Jordan wins at once.',
      'Five steps per player turn; turn 2 is the night.',
    ]),
  ],
};

const L_BLOCKS: Lesson = {
  id: 'g-blocks',
  topic: 'Blocks on the Golan',
  chapter: CH1,
  goal: 'Stripes, brigades and divisions, strongpoints and ghosts',
  minutes: 5,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'Reading a block',
      `The sticker works as in every FAB game: <b>pips</b> on the top edge are the steps, their <b>colour</b> the quality (red elite, black veteran, white green), the <b>symbol</b> the type: oval armour, X infantry, both mechanised, a diagonal line recon.
    <p>New here is the <b>coloured stripe</b> across the sticker.</p>`,
      {
        figure: (g) =>
          blockAnatomy(golanBlock(g, 'S26'), golanWood(g, 'S26'), {
            pips: '3 steps',
            quality: 'red = elite',
            type: 'oval = armour',
            name: '91st Tank Brigade',
            code: 'turn 3, entry W',
          }),
      },
    ),
    {
      title: 'Syrian divisions',
      text: `Syrian blocks with the same stripe belong to the same <b>division</b>. Blocks of <b>different divisions in one area fight badly together</b>: one artillery asset only, no battle assets. Blocks without a stripe are independent and mix freely.`,
      rule: '15.1 Syrian divisions',
      figure: (g) =>
        pieces([
          { svg: golanBlock(g, 'S26'), wood: golanWood(g, 'S26'), cap: `91st: 1st Tank Division` },
          { svg: golanBlock(g, 'S18'), wood: golanWood(g, 'S18'), cap: '15th: 3rd Tank Division' },
          { svg: golanBlock(g, 'S21'), wood: golanWood(g, 'S21'), cap: 'Assad Guard: independent' },
        ]),
    },
    {
      title: 'Israeli brigades',
      text: `Eight Israeli brigades come as <b>two identical blocks</b> with the same stripe. When both fight in the same battle they roll <b>one extra die</b>: brigade integrity. Three brigades arrive <b>reduced</b>: the yellow arrow points at their arrival strength; later events bring the missing battalions.`,
      rule: '15.5 Israeli brigades · 15.52 Reduced units',
      figure: (g) =>
        strengths(
          [4, 3, 2].map((s) => golanBlock(g, 'I09', s)),
          golanWood(g, 'I09'),
        ),
    },
    {
      title: 'Strongpoints and ghosts',
      text: `Along the ceasefire line Israel holds a chain of fortified <b>strongpoints</b>: blocks that cannot move or attack, fire <b>one die</b> whatever their stars, and count as field works against the attacker. Among them stand <b>ghosts</b>: empty positions that fool the Syrian player until a battle reveals them.`,
      rule: '15.6 Strongpoints · 15.7 Ghosts',
      figure: (g) =>
        pieces([
          { svg: golanBlock(g, 'I23'), wood: golanWood(g, 'I23'), cap: 'Elite armour strongpoint' },
          { svg: golanBlock(g, 'I27'), wood: golanWood(g, 'I27'), cap: 'Green infantry strongpoint' },
          { svg: golanBlock(g, 'I31'), wood: golanWood(g, 'I31'), cap: 'Ghost' },
        ]),
    },
    tapUnit(
      'I23',
      'Tap a strongpoint',
      '<b>Tap the strongpoint in Bunker 109.</b> Its panel says what it is. Hidden to the Syrian player, every one of these looks like a cyan block.',
    ),
    {
      title: 'Garrisons and the 82nd',
      text: `Five Israeli towns have a <b>garrison</b> chit: alone it defends like a roadblock, with blocks beside it it adds to their fight. Syria's <b>82nd Para</b> waits in a holding box: once in the game it may <b>air-assault</b> an area east of the SAM barrier, or Mt Hermon.`,
      rule: '16.24 Garrisons · 15.3 Paratroops',
      figure: (g) =>
        pieces([
          { svg: golanChit(g, 'IC07'), cap: 'The Nafakh garrison' },
          { svg: golanBlock(g, 'S17'), wood: golanWood(g, 'S17'), cap: '82nd Para' },
        ]),
    },
    recap([
      'Stripes: Syrian divisions must not be mixed in a battle; Israeli brigade pairs add a die.',
      'Strongpoints fire one die, never move, never retreat, and act as field works.',
      'A ghost is nothing: it vanishes when revealed.',
      'The yellow arrow is a reduced arrival strength.',
    ]),
  ],
};

const L_MAP: Lesson = {
  id: 'g-map',
  topic: 'The map',
  chapter: CH1,
  goal: 'The Purple Line, the escarpment, wadis, rugged ground, sectors, Mt Hermon',
  minutes: 6,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'The Purple Line',
      `The purple line is the 1967 ceasefire line. Along it Israel dug an <b>anti-tank ditch</b>, the brown boundary. Crossing an unbridged ditch takes a block's <b>whole move</b>, only one block per ditch boundary may enter an enemy area per step, and the attack is a <b>crossing assault</b>: the attackers fire at −1 and cannot exploit.
    <p>Syrian engineers can <b>bridge</b> the ditch, in the Prepare step or in a battle. A bridged ditch becomes an ordinary road or field.</p>`,
      { look: 48 },
    ),
    {
      title: 'Minefields',
      text: 'Three <b>minefields</b> are printed on the ditch, and Israel lays three more at the start. A Syrian block starting next to one may cross only with a morale check, paying one extra point; failing, it may not cross any minefield that turn. Israeli blocks ignore them.',
      rule: '14.02 Minefields',
      look: 47,
    },
    {
      title: 'The escarpment',
      text: 'West of the heights the ground drops to the Jordan valley: the <b>escarpment</b>, the thick shaded boundary. It can be crossed <b>only by road</b>, for one extra point, and <b>one block per step</b> per boundary. Supply, too, crosses it only by road.',
      rule: '14.11 Escarpment',
      look: 36,
    },
    {
      title: 'Wadis and rugged ground',
      text: '<b>Wadi</b> boundaries cost one extra point without a road, and only one block per step may cross one into an enemy area. <b>Rugged</b> boundaries, the jagged ones under Mt Hermon, are for infantry only and take the whole move; armour may not cross them except by the one road.',
      rule: '14.13 Wadi · 14.14 Rugged',
      look: 46,
    },
    {
      title: 'Sectors',
      text: 'The two grey boundaries split the front into three <b>sectors</b>, one per Syrian infantry division. For the first four turns Syrian blocks may not cross them; from turn 5 they are ignored. Israeli blocks never mind them.',
      rule: '14.3 Operational boundaries',
      look: 49,
    },
    {
      title: 'The SAM barrier',
      text: 'The dot-dash line is the <b>SAM barrier</b>. East of it Syrian missiles may shoot at any Israeli air mission: the Syrian player answers the mission with a SAM asset and rolls. West of it the Israeli air force flies freely.',
      rule: '14.15 SAM barrier · 16.12',
      look: 51,
    },
    {
      title: 'Mt Hermon and the Jordan',
      text: '<b>Mt Hermon</b> touches only Majdal Shams: infantry only, the whole move in and out, always in supply. On the far side of the map, a supplied Syrian block in Gadot, Kfar Hanasi or Almagor, <b>west of the Jordan</b>, wins the game at the end of the turn.',
      rule: '14.16 Mt Hermon · 14.17 The Jordan',
      look: 83,
    },
    {
      title: 'Entry areas and assembly areas',
      text: 'Syrian reinforcements arrive at the lettered <b>entry areas V to Z</b>, which are also the Syrian supply sources. Israeli reinforcements arrive in the two <b>assembly boxes</b> below the map, A and B, and enter the map by road for one point. Israeli supply comes from the three areas with a supply symbol.',
      rule: '14.2 Entry · 14.9 Supply sources',
      look: 6,
    },
    recap([
      'The ditch: whole move, one block per boundary, crossing assault (−1, no exploitation); engineers bridge it.',
      'Escarpment by road only, +1, one block per step. Wadi +1 without a road. Rugged: infantry only.',
      'Syrian blocks keep to their sector until turn 5.',
      'East of the SAM barrier, Israeli air missions can be shot at.',
      'Israel arrives through the assembly boxes; Syria at entries V–Z.',
    ]),
  ],
};

const L_CHITS: Lesson = {
  id: 'g-chits',
  topic: 'Chits on the Golan',
  chapter: CH1,
  goal: 'The hand, the boxes, air support, SAMs and commandos',
  minutes: 4,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'Your hand',
      `The cards at the bottom are your <b>chits</b>: <b>assets</b> (artillery, engineers, anti-tank and tank battalions, air support, SAMs, commandos) and <b>events</b>. On the Golan every chit helps every block of its side: there are no army colours to match.
    <p>Chits are drawn from the <b>cup</b> into <b>Available</b>; spent ones rest in <b>Used</b> for a turn. The turn track says how many each side draws.</p>`,
      {
        figure: (g) =>
          pieces([
            { svg: golanChit(g, 'SC14a'), cap: 'Air support' },
            { svg: golanChit(g, 'SC17a'), cap: 'SAM' },
            { svg: golanChit(g, 'SC19'), cap: 'Commandos' },
            { svg: golanChit(g, 'IC01'), cap: 'Israeli artillery' },
          ]),
      },
    ),
    {
      title: 'Air support',
      text: `An <b>air support</b> asset flies one of three missions: <b>close support</b> in a battle (as extra artillery, or +2 Israeli / +1 Syrian to one block), <b>interdiction</b> of an area in the Prepare step (+1 point to enter and to leave it), or <b>reconnaissance</b> (see the enemy blocks in an area). No air missions on the night turn.`,
      rule: '16.3 Air support',
    },
    {
      title: 'SAMs and commandos',
      text: `A <b>SAM</b> asset answers an Israeli air mission east of the barrier: roll, and the mission may be cancelled or the aircraft lost. A <b>commando</b> asset can fight as a battle asset, or <b>raid</b> a vacant Israeli area in the Prepare step to block strat-moves and retreats and slow the first Israeli block that enters.`,
      rule: '16.11 Commandos · 16.12 SAM fire',
    },
    {
      title: 'The Pieces window',
      text: "<b>Tap Pieces.</b> Besides the boxes of the series, the Golan has holding boxes: the Syrian Operational and Strategic Reserves, the 82nd's air assault, the Israeli air assets released as SAMs die, and the Task Forces that form when strongpoints are evacuated.",
      target: { el: '[data-modal="boxes"]', label: 'Pieces button' },
      done: (_g, q) => q('.modal'),
    },
    closeModal('<b>Close Pieces.</b>'),
    {
      title: 'The Special Action',
      text: `The reusable <b>Special Action</b> works as in the series: reinforce a defence, advance armour in Breakthrough, attack again, reroute an arrival. On the Golan it also lets Syria <b>release</b> the 3rd Tank Division one brigade at a time from turn 3, and lets Israel <b>merge</b> two battered units of the same type.`,
      rule: '8.0 · 14.61 Special Actions',
    },
    recap([
      'Chits help any block of their side.',
      'Air support: close support, interdiction or reconnaissance; SAMs answer Israeli missions east of the barrier.',
      'Commandos raid vacant Israeli areas.',
      'Extra Special Action uses: release the 3rd Tank Division, merge Israeli units.',
    ]),
  ],
};

const L_SETUP: Lesson = {
  id: 'g-setup',
  topic: 'Setting up Operation Badr',
  chapter: CH1,
  ref: '22.1',
  goal: 'Strongpoints, ghosts and minefields are placed by the Israeli player',
  minutes: 4,
  side: 'israeli',
  setup: () => {
    E.useGame('golan73');
    const g = E.newGame(1973, { scenario: 'badr' });
    g.log = [];
    return g;
  },
  steps: [
    situation(
      'The historical set-up',
      `The Syrian blocks stand where history put them, seven of them already <b>across the ditch</b> in Israeli areas. The Israeli regulars hold their starting areas. What the Israeli player decides is where his <b>eight strongpoints and three ghosts</b> go: one in each of the eleven areas along the Purple Line, face-down, and where his three free <b>minefields</b> lie.
    <p>For this lesson you sit on the <b>Israeli</b> side.</p>`,
      { look: 48 },
    ),
    {
      title: 'Place the strongpoints',
      text: 'Drag each piece from the tray to a lit area, or let the game shuffle them. <b>Tap Shuffle face-down</b>: the Syrian player will not know which is which.',
      rule: '15.7 · Errata',
      target: { el: '.volpanel button', text: 'Shuffle', label: 'Shuffle button' },
      done: (g) => !g.units.some((u) => (u.fort || u.ghost) && u.box === 'deploy'),
      act: (g) => G.autoStrongpoints(g, 'shuffle'),
    },
    {
      title: 'Lay the minefields',
      text: 'Three minefields are printed on the map. <b>Tap Place the rest for me</b> for the other three. By hand you would tap the two areas on either side of a boundary: never on the ditch, the escarpment, a river, Mt Hermon or rugged ground, and only one mined boundary per area.',
      rule: '14.02 Minefields',
      target: { el: '.volpanel button', text: 'random', label: 'random minefields button' },
      done: (g) => !G.state(g).minesLeft,
      act: (g) => G.autoMinefields(g),
    },
    {
      title: 'End the set-up',
      text: '<b>Tap End set-up.</b> The Syrian Movement step has already happened in history: the game opens with the <b>Syrian Combat Phase</b> of turn 1, and every bridgehead must be fought.',
      target: GO,
      done: (g) => g.phase === 'combat',
      act: (g) => E.endPhase(g),
    },
    {
      title: 'Seven bridgeheads',
      text: 'The outlined areas are contested: a Syrian brigade has crossed the ditch into each, under a <b>crossing assault</b> marker. Syria also gets two free extra combat rounds in the Breakthrough step of turn 1, without spending Special Actions.',
      rule: '22.17 Special scenario rules',
      look: 39,
    },
    recap([
      'Israel places 8 strongpoints and 3 ghosts, one per Purple Line area, face-down.',
      'Three printed minefields plus three the Israeli player lays.',
      'The historical game opens with the Syrian Combat Phase: seven crossing assaults.',
    ]),
  ],
};

/* ================= Reinforcement and Admin (Examples 1 and 2) ================= */
const L_REINF: Lesson = {
  id: 'g-reinforcement',
  topic: 'Reinforcement and Prepare',
  chapter: CH2,
  ref: 'Ex 1, Ex 2',
  goal: 'The Syrian resource boxes, SAM attrition, interdiction answered by SAMs',
  minutes: 7,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'israeli', 'supply', { S26: 75, S25: 75, I05: 42, I03: 36 });
    for (const c of g.chits.filter((x) => x.side === 'syrian' && x.box === 'available')) c.box = 'cup';
    for (const id of ['SC17a', 'SC17b', 'SC14a', 'SC08']) C(g, id).box = 'used';
    for (const id of ['SC17c', 'SC17d']) C(g, id).box = 'available';
    for (const c of g.chits.filter((x) => x.side === 'israeli' && x.box === 'available')) c.box = 'cup';
    avail(g, ['IC03', 'IC10a', 'IC01']);
    sa(g, 'syrian');
    sa(g, 'israeli');
    g.supplyPending = false;
    g.contestedAtMoveStart = [];
    queue(g, [8, 4]);
    E.endPhase(g);
    g.log = [];
    return g;
  },
  steps: [
    situation(
      'Turn 4 begins',
      `The 1st Tank Division is on its way to the front: the <b>91st Tank</b> and the <b>58th Mech</b> wait in Jasim, entry area W. Turn 4 opens with the <b>Reinforcement</b> step, and the Syrian resource boxes on the map list what to do, in order.
    <p>The game already rolled for the two SAMs in your Used Box, as the box says: an 8 and a 4. A 6 or more means one SAM is lost for good. One went to the Eliminated Box.</p>`,
      { look: 75 },
    ),
    {
      title: 'The reusable Special Action',
      text: 'Your Special Action block is still in <b>Available</b>: unused last turn. The box rewards you: bring <b>one used asset</b> straight back instead of into the cup. <b>Tap the Air Support</b>, then Bring back.',
      rule: '4.1a Reinforcement',
      target: { el: '.c-dispatch .pc', text: 'Air Support', label: 'Air Support asset' },
      done: (g) => !g.recover.includes('syrian'),
      act: (g) => E.recoverAsset(g, 'syrian', 'SC14a'),
    },
    {
      title: 'Bring it back',
      text: '<b>Tap Bring back Air Support.</b>',
      target: { el: '.c-dispatch button', text: 'Bring back', label: 'Bring back button' },
      skip: (g) => !g.recover.includes('syrian'),
      done: (g) => !g.recover.includes('syrian'),
    },
    {
      title: 'Into the cup',
      text: 'The rest of the Used Box went into the cup, with the chits due on turn 4. <b>Tap End reinforcement.</b> The Prepare step follows, and both players draw: turn 4 gives Syria <b>6</b> chits and Israel <b>3</b> in the Syrian player turn, then 2 and 4 in the Israeli one.',
      rule: '4.2 Admin draws',
      target: GO,
      done: (g) => g.phase === 'admin',
      act: (g) => E.endPhase(g),
    },
    {
      title: 'The Israeli answer: interdiction',
      text: 'The Israeli player sees the 1st Tank Division coming. In his part of the Prepare step he flies two <b>interdiction</b> missions, over <b>Jasim</b> and <b>Tel Kudne</b>: Syrian blocks pay +1 point to enter and +1 to leave each. Both areas lie east of the SAM barrier, so you may shoot. <b>Tap Show me.</b>',
      rule: '16.31b Interdiction',
      look: 73,
      auto: (g) => {
        E.setDone(g, 'syrian'); // 4.2b/c: the Syrian player has finished; Israel acts now
        G.airInterdiction(g, 'IC03', 75);
      },
    },
    {
      title: 'Fire a SAM',
      text: 'The panel asks: answer the mission over Jasim with a SAM? <b>Tap Fire a SAM.</b> On turns 4–6 a roll of 1 downs the aircraft, 2–5 cancels the mission, 6 or more does nothing. The book rolls a <b>3</b>.',
      rule: '16.12 SAM Air Defense Fire',
      target: { el: '.volpanel button', text: 'Fire a SAM', label: 'Fire a SAM button' },
      enter: (g) => queue(g, [3]),
      done: (g) => !G.state(g).samTarget,
      act: (g) => {
        G.fireSam(g, 'SC17c');
      },
    },
    {
      title: 'The second mission',
      text: 'The Jasim mission is cancelled: the air asset and your SAM go to the Used Boxes. The Israeli player flies the second mission over <b>Tel Kudne</b>. <b>Tap Show me.</b>',
      auto: (g) => {
        G.airInterdiction(g, 'IC10a', 73);
      },
    },
    {
      title: 'Fire again',
      text: '<b>Tap Fire a SAM.</b> The book rolls a <b>6</b>: no effect. The mission over Tel Kudne stays until the Israeli Supply step.',
      target: { el: '.volpanel button', text: 'Fire a SAM', label: 'Fire a SAM button' },
      enter: (g) => queue(g, [6]),
      done: (g) => !G.state(g).samTarget,
      act: (g) => {
        G.fireSam(g, 'SC17d');
      },
    },
    { title: 'End the step', text: '<b>Tap End admin.</b>', target: GO, done: (g) => g.phase === 'movement', act: (g) => E.endPhase(g) },
    tapUnit(
      'S26',
      'Through the interdiction',
      'Now move. <b>Tap the 91st Tank in Jasim.</b> The areas it can reach show the cost: Swisah 1, Tel Kudne 1 + 2 for the interdiction. Leaving Tel Kudne will cost 2 more.',
      { rule: '16.31b' },
    ),
    moveTo(
      'S26',
      73,
      'Into Tel Kudne',
      "<b>Tap Tel Kudne.</b> Three points of the 91st's six are gone, and leaving costs two more: it will not reach the front this turn.",
    ),
    recap([
      'Reinforcement: the resource boxes list the steps; an unused Special Action brings one used asset back.',
      'Each turn every SAM in the Used Box rolls: 6 or more and one SAM is eliminated.',
      'Interdiction: +1 to enter and +1 to leave; a SAM east of the barrier may cancel it.',
    ]),
  ],
};

/* ================= Movement (Examples 3-6) ================= */
const L_MOVE_IS: Lesson = {
  id: 'g-move-israeli',
  topic: 'Moving up the heights',
  chapter: CH2,
  ref: 'Ex 3',
  goal: 'Bridges, the escarpment, wadis, occupied and enemy areas',
  minutes: 6,
  side: 'israeli',
  setup: () => {
    const g = golanTable(3, 'israeli', 'movement', { I11: 6, I09: 9, I01: 35, I03: 34, S13: 33, I05: 42 });
    g.control[33] = 'syrian';
    return g;
  },
  steps: [
    situation(
      'Up from the Jordan valley',
      `For this lesson you play <b>Israel</b>. Reinforcements have reached the valley: the <b>4th Mech</b> at Gadot, the <b>179th</b> at Kfar Hanasi, with <b>Golani</b> at Yehudia and the <b>53/188th</b> at Kuzabia already on the heights. The Syrians hold Zohar.
    <p>Armour has 6 points, infantry 3. Road 1, field 2, +1 into an occupied area.</p>`,
      { look: 7 },
    ),
    tapUnit('I11', 'The 4th Mech', '<b>Tap the 4th Mech in Gadot.</b> Green areas are reachable; brass ones mean it must stop there.'),
    moveTo(
      'I11',
      37,
      'Across the bridge and up',
      "<b>Tap Sindiana.</b> The road over the B'not Yakov bridge costs 1; up the <b>escarpment</b> into Katzrin, by road, 1 + 1; across the <b>wadi</b> into Sindiana by field, 2 + 1. Six points: the whole move.",
      { rule: '14.11 Escarpment · 14.13 Wadi' },
    ),
    tapUnit(
      'I09',
      'The 179th',
      '<b>Tap the 179th at Kfar Hanasi.</b> Across the river to Had Nes there is no road, so no bridge: that crossing would take the whole move.',
      { rule: '14.41 Bridges only on roads' },
    ),
    moveTo(
      'I09',
      7,
      'Only one block over the escarpment',
      "<b>Tap B'not Yakov Bridge.</b> Gadot by field costs 2, the bridge 1. Katzrin is not offered: the 4th Mech already crossed that escarpment boundary this step, and only <b>one block per step</b> may.",
      { rule: '14.11' },
    ),
    tapUnit(
      'I01',
      'Golani',
      '<b>Tap Golani at Yehudia.</b> Infantry: 3 points. Had Nes is out of reach, no road crosses the escarpment there. Katzrin by field costs 2 and would end the move: Nafakh is occupied, Aleika lies over a wadi.',
    ),
    moveTo(
      'I01',
      38,
      'Along the road',
      '<b>Tap Hushniyah.</b> Kuzabia by road costs 1 + 1 for the 53/188th standing there, Hushniyah 1 more: exactly 3, and the move ends there.',
      { rule: '5.32 Occupied areas' },
    ),
    tapUnit('I03', 'The 53/188th', '<b>Tap the 53/188th in Kuzabia.</b>'),
    moveTo(
      'I03',
      33,
      'Into the enemy',
      '<b>Tap Zohar.</b> 1 for the road, 1 for the occupant: 2 points, and it must stop, because enemy blocks stand there. Two battles await in the Fight step.',
    ),
    recap([
      'Road 1, field 2, +1 into any occupied area.',
      'Escarpment: by road only, +1, one block per boundary per step.',
      'Wadi: +1 without a road.',
      'A block entering an enemy area stops, and a battle follows.',
    ]),
  ],
};

const L_MOVE_SY: Lesson = {
  id: 'g-move-syrian',
  topic: 'Ditches, minefields and rugged ground',
  chapter: CH2,
  ref: 'Ex 4, 5, 6',
  goal: 'The Syrian side of movement',
  minutes: 6,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'movement', { S10: 51, S05: 49, S04: 48, S11: 48, S14: 64, I07: 47, I05: 46 }, { keep: ['I25'] });
    for (const a of [48, 49, 51, 52]) g.control[a] = 'syrian';
    g.control[46] = 'israeli';
    g.control[47] = 'israeli';
    g.control[50] = 'israeli';
    return g;
  },
  steps: [
    situation(
      'The Syrian side',
      `Back to the <b>Syrian</b> side, in the central sector on turn 3. The 7th Infantry Division has broken in: the <b>121st Mech</b> is in Merom Golan, the <b>85th</b> in Kuneitra, the <b>52nd</b> and the <b>9th Recon</b> in Bunker 109. The <b>46th Tank</b> still waits at Khan Arnabe, east of the ditch. Israeli blocks hold Ein Zivan and Tel Abu Nida.`,
      { look: 49 },
    ),
    tapUnit('S10', 'The 121st Mech', '<b>Tap the 121st Mech in Merom Golan.</b>'),
    moveTo(
      'S10',
      46,
      'Round the rugged ground',
      '<b>Tap Tel Abu Nida.</b> By road to Wasit 1, then by field into Tel Abu Nida 2 + 1 for the Israeli block: 4 points. Straight from Merom Golan it could not go: that boundary is <b>rugged</b>, closed to armour.',
      { rule: '14.14 Rugged' },
    ),
    tapUnit(
      'S05',
      'The 85th Infantry',
      '<b>Tap the 85th in Kuneitra.</b> Infantry may cross the rugged boundary, for its whole move. Note that Ein Zivan is not offered: that boundary is a <b>sector</b> line, closed to Syrian blocks until turn 5.',
      { rule: '14.42 Sectors' },
    ),
    moveTo(
      'S05',
      46,
      'Over the rocks',
      '<b>Tap Tel Abu Nida.</b> The whole move, and the block stops: two Syrian brigades of the 7th Division now face the Israelis there.',
    ),
    tapUnit(
      'S04',
      'The 52nd Infantry',
      '<b>Tap the 52nd in Bunker 109.</b> The road to Ein Zivan crosses a <b>minefield</b>: it shows in brass. Crossing costs one extra point and a morale check.',
      { rule: '14.02 Minefields' },
    ),
    {
      title: 'Through the minefield',
      text: '<b>Tap Ein Zivan.</b> Road 1, occupant 1, mines 1: three points. The book rolls a 7 for the check: it <b>fails</b>. The 52nd stays, may not try another minefield this turn, and has spent only the one extra point of the attempt: it may still move on into an area without mines.',
      rule: '14.02',
      target: { area: 47 },
      look: 47,
      enter: (g) => queue(g, [7]),
      done: (g) => G.state(g).minefieldFailed.includes('S04') || area('S04', g) === 47,
      act: (g) => {
        E.move(g, U(g, 'S04').id, 47);
      },
    },
    tapUnit(
      'S11',
      'The 9th Recon',
      '<b>Tap the 9th Recon.</b> It tries the same minefield. Going round by Tel Hazeika and Mt Yosifon would cost 5 points; the mines cost 3 and a check.',
    ),
    {
      ...moveTo(
        'S11',
        47,
        'A successful check',
        '<b>Tap Ein Zivan.</b> The book rolls a 2: the recon crosses and stands against the 71/7th. The 52nd must wait for next turn.',
      ),
      enter: (g) => queue(g, [2]),
    },
    tapUnit(
      'S14',
      'The 46th Tank, east of the ditch',
      '<b>Tap the 46th at Khan Arnabe.</b> The ditch has not been bridged here: crossing into Booster takes the whole move, whatever the road says.',
    ),
    moveTo(
      'S14',
      50,
      'A crossing assault',
      '<b>Tap Booster.</b> The Israeli strongpoint there makes the area contested, and the 46th gets a <b>crossing assault</b> marker: its fire will be weaker and it cannot exploit. Only one block may cross each ditch boundary into an enemy area per step.',
      { rule: '14.12 AT ditch · 14.01 Assaults' },
    ),
    recap([
      'Rugged ground: infantry only, the whole move; armour goes round by road.',
      'Syrian blocks stay in their sector until turn 5.',
      'A minefield costs +1 and a morale check; a failure costs just that point and bars every minefield that turn.',
      'The unbridged ditch takes the whole move, and the attack is a crossing assault.',
    ]),
  ],
};

const L_STRAT: Lesson = {
  id: 'g-strategic',
  topic: 'Strategic movement',
  chapter: CH2,
  ref: 'Ex 7',
  goal: 'Reserves race by road; the assembly areas',
  minutes: 3,
  side: 'israeli',
  setup: () => {
    const g = golanTable(3, 'israeli', 'movement', { I11: A(), I05: 42, I03: 34, S13: 33 });
    g.control[33] = 'syrian';
    E.setReserve(g, U(g, 'I11').id, true, true);
    g.phase = 'strategic';
    g.stratMoves = 0;
    return g;
  },
  steps: [
    situation(
      'From the assembly area to the front',
      `The <b>4th Mech</b> arrived in the <b>Northern Assembly Area</b> and was marked as reserve in the Move step: a block in an assembly box may carry a reserve marker. Now, in <b>Strategic movement</b>, it may travel by road through friendly, uncontested areas as far as the roads go.`,
      { look: 7 },
    ),
    tapUnit('I11', 'The 4th Mech', '<b>Tap the 4th Mech in the Northern Assembly Area.</b>', {
      rule: '14.72 Reserves in the assembly areas',
    }),
    {
      ...moveTo(
        'I11',
        30,
        'To Tel Faris',
        '<b>Tap Tel Faris.</b> Up the escarpment by road, then along the roads to the southern front. Walking, the 4th Mech would have stopped at Yonatan.',
      ),
      act: (g) => E.stratMove(g, U(g, 'I11').id, 30),
    },
    recap([
      'Strat-moves follow roads only, through friendly uncontested areas, never over an unbridged ditch or a blown bridge.',
      'No limit per turn except the reserve markers you own, and two Israeli / one Syrian on the night turn.',
      'A block in an assembly box may be a reserve.',
    ]),
  ],
};

/* ================= Combat (Examples 8-12) ================= */
const L_COMBAT: Lesson = {
  id: 'g-combat',
  topic: 'Combat with brigade integrity',
  chapter: CH2,
  ref: 'Ex 8',
  goal: "A full round: artillery, close air support, hits, the brigade's extra die",
  minutes: 8,
  side: 'israeli',
  setup: () => {
    const g = golanTable(3, 'israeli', 'combat', { I11: 38, I12: 38, S26: 38, I05: 42 });
    for (const a of [38, 32, 30]) g.control[a] = 'syrian';
    G.state(g).bridgedDitch = ['30-73'];
    g.fieldWorks = [38];
    g.fwOwner[38] = 'syrian';
    U(g, 'I11').str = 3;
    U(g, 'I12').str = 3; // as in the book: the brigade has 3 steps a block on this turn
    avail(g, ['IC11a', 'IC01', 'SC08', 'SC14a']);
    return g;
  },
  steps: [
    situation(
      'Hushniyah',
      `Both blocks of the <b>4th Mech Brigade</b> attack the elite <b>91st Tank</b> in Hushniyah, which dug field works. You have an armour <b>Task Force</b> and the <b>405th+55th artillery</b> in hand; the Syrian player has the <b>89th artillery</b> and an <b>air support</b> asset.
    <p>The round goes as in the series: assets, artillery, the defender's fire, the attacker's fire, hits, exploitation.</p>`,
      { look: 38 },
    ),
    { title: 'Choose the battle', text: '<b>Tap Hushniyah.</b>', target: { area: 38 }, look: 38, tap: true, done: (g) => !!g.battle },
    { title: 'Fight', text: '<b>Tap Fight Hushniyah.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(38) },
    {
      title: 'Commit the Task Force',
      text: '<b>Tap the Task Force</b> in your hand. A battle asset fights beside your blocks and can take the first hit for them. An attacker may commit up to eight.',
      rule: '6.22 Assets',
      target: { el: ['.card2[data-chit="IC11a"]', '.handtab button'], label: 'Task Force card' },
      done: (g) => !!g.battle?.assets.israeli.includes('IC11a'),
      act: (g) => E.assign(g, g.battle!, 'IC11a'),
    },
    {
      title: 'Commit the artillery',
      text: '<b>Tap the 405th+55th.</b>',
      target: { el: ['.card2[data-chit="IC01"]', '.handtab button'], label: '405th+55th card' },
      done: (g) => !!g.battle?.assets.israeli.includes('IC01'),
      act: (g) => E.assign(g, g.battle!, 'IC01'),
    },
    {
      title: 'The Syrian answer',
      text: 'The Syrian player commits the <b>89th artillery</b> and his <b>air support</b> as close support for the 91st: +1 to its fire. <b>Tap Show me.</b>',
      rule: '16.31a Close air support',
      auto: (g) => {
        answer(g);
        E.assign(g, g.battle!, 'SC08');
        E.assign(g, g.battle!, 'SC14a', 'support', 'S26');
      },
    },
    { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
    {
      title: 'Your artillery',
      text: '"1 try for a 3": −1 because the Syrian point unit is armour, −1 because artillery fires at a defender. The book rolls a <b>2</b>: a hit, and the first thing it removes is the <b>field works</b>. <b>Roll.</b>',
      rule: '6.25 Artillery · 6.42',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'israeli', 'arty', [{ who: '405', sn: 3, dice: [2] }])),
      done: stage('attArty'),
      act: roll,
    },
    {
      title: 'Syrian artillery',
      text: '"1 try for a 4": −1 for your armour point unit. The book rolls a 7: miss. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'syrian', 'arty', [{ who: '89', sn: 4, dice: [7] }])),
      done: stage('defArty'),
      act: roll,
    },
    {
      title: 'The 91st fires',
      text: 'Three dice: +1 armour, +1 air support, +1 elite on veteran, −1 against an armour point unit: "3 tries for a 7". The book rolls 2, 3, 8: <b>two hits</b>. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'syrian', 'ground', [{ who: '91', sn: 7, dice: [2, 3, 8] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'The first hit',
      text: "The attacker's first hit is a step loss, and with a battle asset in the fight you choose who takes it: the point unit, or an asset (tap it on the table). The book gives it to the <b>Task Force</b>, which is gone. <b>Tap Show me.</b>",
      rule: '6.41a',
      skip: (g) => g.battle?.stage !== 'attFirst',
      auto: (g) => {
        if (g.battle?.stage === 'attFirst') E.chooseFirstLoss(g, g.battle, 'IC11a');
      },
    },
    {
      title: 'The second hit',
      text: 'Another step, or abort? The brigade presses on. <b>Tap Take losses</b>: the point unit loses a step.',
      target: { el: ['.c-dispatch button', 'button'], text: 'Take losses', label: 'Take losses button' },
      skip: (g) => g.battle?.stage !== 'attChoice',
      done: (g) => g.battle?.stage !== 'attChoice',
      act: (g) => E.attackerChoice(g, g.battle!, false),
    },
    {
      title: 'Brigade integrity',
      text: 'Now the 4th Mech fires. Each block: +1 armour, −1 veteran on elite, −1 against armour, terrain 0: "a 4". Both blocks of the brigade are in the fight, so the brigade rolls <b>one extra die</b> at the lower of their numbers. The book: 4, 5, 9 and 1, 6, 8: <b>two hits</b>. <b>Roll.</b>',
      rule: '15.51 Brigade integrity',
      target: GO,
      enter: (g) =>
        queue(
          g,
          bookDice(g, 'israeli', 'ground', [
            { who: 'integrity', sn: 4, dice: [10] },
            { who: '4th', sn: 4, dice: [4, 5, 9, 1, 6, 8] },
          ]),
        ),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'The 91st falls back',
      text: 'The defender absorbs the first hit by <b>retreating</b>, disordered, one area back along the road to Keshet (on our map Hushniyah does not touch Tel Faris); the second is a step loss. No hit was in excess, so no exploitation. Until it recovers, a disordered block moves one area at a time and never into an area with enemy blocks (9.33). <b>Tap Show me.</b>',
      rule: '6.42',
      auto: (g) => {
        const b = g.battle!;
        if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
        if (b.stage === 'retreat') {
          const o = E.retreatOptions(g, b);
          E.chooseRetreat(g, b, o.includes(32) ? 32 : o[0]);
        }
        if (b.stage === 'exploit') E.declineExploit(g, b);
      },
    },
    {
      title: 'Close the battle',
      text: '<b>Tap Close battle.</b> Hushniyah is yours, and the air support asset goes to the Syrian Used Box.',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap([
      'Artillery against a defender: −1; against an armour point unit: −1.',
      'Close air support: +1 (Syria) or +2 (Israel) to one block, or an extra artillery die.',
      'With a battle asset in the fight, you choose who takes the first attacker hit.',
      'Two blocks of one Israeli brigade roll an extra die.',
    ]),
  ],
};

const L_ASSAULT: Lesson = {
  id: 'g-assault',
  topic: 'Crossing assault on a strongpoint',
  chapter: CH2,
  ref: 'Ex 9',
  goal: 'Strongpoints in defence, the assault penalty, bridging the ditch in battle',
  minutes: 7,
  side: 'syrian',
  setup: () => {
    const g = golanTable(1, 'syrian', 'combat', { S02: 28, I30: 28, I23: 27, S01: 27 });
    g.riverAssault = [28, 27];
    U(g, 'S02').from = 79;
    U(g, 'S01').from = 79;
    g.control[28] = 'israeli';
    g.control[27] = 'israeli';
    avail(g, ['SC10', 'SC14a', 'SC08']);
    return g;
  },
  steps: [
    situation(
      'Juhader',
      `Turn 1. The <b>112th Infantry</b> has crossed the ditch into Juhader, held by a veteran infantry <b>strongpoint</b>. A <b>crossing assault</b>: every attacker fires at −1 and none may exploit. You hold the <b>5th Engineers</b> and an <b>air support</b> asset.
    <p>A strongpoint fires <b>one die</b> whatever its stars (−1 with a rifle symbol, +1 with a tank), counts as field works against you, cannot retreat, and is eliminated when its stars run out.</p>`,
      { look: 28 },
    ),
    { title: 'Choose the battle', text: '<b>Tap Juhader.</b>', target: { area: 28 }, look: 28, tap: true, done: (g) => !!g.battle },
    { title: 'Fight', text: '<b>Tap Fight Juhader.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(28) },
    {
      title: 'The engineers',
      text: '<b>Tap the 5th Engineers</b> to commit them. An engineer in a crossing assault has a choice: fire as a battle asset, or <b>bridge the ditch</b> if it survives the enemy fire.',
      rule: '14.51b Bridging in combat',
      target: { el: ['.card2[data-chit="SC10"]', '.handtab button'], label: '5th Engineers card' },
      done: (g) => !!g.battle?.assets.syrian.includes('SC10'),
      act: (g) => E.assign(g, g.battle!, 'SC10'),
    },
    {
      title: 'Bridge instead of firing',
      text: 'The panel offers the two ditch boundaries of Juhader. <b>Tap towards Dhake</b>, the one with the road: once bridged it becomes a plain road connection, even though the attack came the other way.',
      target: { el: '.volpanel button', text: 'Dhake', label: 'towards Dhake' },
      done: (g) => !!g.battle && G.battleState(g.battle).engBridge === '28-79',
      act: (g) => G.setEngineerBridge(g, g.battle!, 79),
    },
    {
      title: 'Air support',
      text: 'The air asset flies close support for the 112th: +1 to its fire. <b>Tap Show me.</b>',
      auto: (g) => E.assign(g, g.battle!, 'SC14a', 'support', 'S02'),
    },
    { title: 'Begin', text: '<b>Tap Begin combat.</b> No artillery on either side.', target: GO, done: stage('setup'), act: begin },
    {
      title: 'The strongpoint fires',
      text: 'One die: 5, −1 rifle symbol, +1 against an assaulting unit: "1 try for a 5". The book misses. <b>Roll.</b>',
      rule: '15.6 Strongpoints',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'israeli', 'ground', [{ who: 'Strongpoint', sn: 5, dice: [7] }])),
      done: stage('defFire'),
      act: roll,
    },
    {
      title: 'The 112th fires',
      text: 'Four dice: +1 air support, −1 crossing assault, +1 against an infantry-supported strongpoint: "4 tries for a 5". The book rolls 1, 4, 6, 9: <b>two hits</b>. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, bookDice(g, 'syrian', 'ground', [{ who: '112', sn: 5, dice: [1, 4, 6, 9] }])),
      done: stage('offFire'),
      act: roll,
    },
    {
      title: 'The strongpoint is lost',
      text: 'A strongpoint cannot retreat. Two stars, two hits: it is <b>eliminated</b>, and a gap opens in the line. The surviving engineers lay their bridge over the ditch. <b>Tap Show me.</b>',
      auto: (g) => {
        const b = g.battle!;
        for (let i = 0; i < 6 && b.stage !== 'done'; i++) {
          if (b.stage === 'defChoice') E.defenderChoice(g, b, false);
          else if (b.stage === 'exploit') E.declineExploit(g, b);
          else break;
        }
      },
    },
    {
      title: 'Close',
      text: '<b>Tap Close battle.</b> Look at the ditch between Juhader and Dhake: an <b>AT Ditch Bridged</b> marker lies on it.',
      target: GO,
      skip: (g) => !g.battle,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap([
      'Crossing assault: every attacker −1, no exploitation.',
      'A strongpoint fires one die, is field works for your Success Number, cannot retreat, and dies when its stars are gone.',
      "An engineer that survives the defender's fire may bridge a ditch boundary instead of firing.",
    ]),
  ],
};

const L_AIR: Lesson = {
  id: 'g-airassault',
  topic: 'Air assault',
  chapter: CH2,
  ref: 'Ex 10',
  goal: 'The 82nd Para drops behind the line',
  minutes: 3,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'combat', { S06: 56, I06: 51 });
    g.control[56] = 'syrian';
    return g;
  },
  steps: [
    situation(
      'The 82nd Para',
      `The paratroop battalion waits in its holding box. Once in the game, as the <b>first action of a Syrian Fight step</b>, it may land in any area east of the SAM barrier, or on <b>Mt Hermon</b>, even an Israeli-held one. If the area is then contested, the battle is fought at once, as an <b>air assault</b>. Not on the night turn.`,
      { look: 83 },
    ),
    {
      title: 'Choose the landing area',
      text: 'The panel offers the drop. <b>Tap Choose the landing area.</b>',
      rule: '15.3 Syrian paratroops',
      target: { el: '.volpanel button', text: 'landing', label: 'landing button' },
      tap: true,
    },
    {
      title: 'Mt Hermon',
      text: '<b>Tap Mt Hermon.</b> The Israeli garrison holds it: the area is contested and the battle must be fought now, under an assault marker. Only infantry-class battle assets and air support may join a fight on the mountain.',
      target: { area: 83 },
      look: 83,
      done: (g) => area('S17', g) === 83,
      act: (g) => G.airAssault(g, 83),
    },
    {
      title: 'Fight',
      text: '<b>Tap Fight Mt Hermon.</b> The coach rolls the dice: the garrison fires one die, the paratroopers two. If the garrison falls, the mountain and its supply advantage for the Israeli artillery are yours.',
      rule: '16.21',
      target: GO,
      done: (g) => !g.battle && g.fought.includes(83),
      act: (g) => autoFight(g, 83),
    },
    recap([
      'The 82nd Para drops once, first thing in a Syrian Fight step, east of the SAM barrier or on Mt Hermon.',
      'It is an assault: −1 to fire, no exploitation; without a supply line only one air asset may help it.',
      'Mt Hermon: infantry-class battle assets and air only; the Israeli artillery bonus ends when it falls.',
    ]),
  ],
};

const L_EVENTS: Lesson = {
  id: 'g-events',
  topic: 'Combat events: jamming and counterbattery',
  chapter: CH2,
  ref: 'Ex 11, 12',
  goal: 'The one event per side in a battle',
  minutes: 6,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'combat', { S12: 37, I01: 37, S09: 58, I05: 58, I07: 42 });
    g.control[37] = 'israeli';
    for (const a of [58, 56, 55, 54, 57, 60, 61, 62, 38, 32, 30]) g.control[a] = 'syrian';
    G.state(g).bridgedDitch = ['30-73', '57-61'];
    avail(g, ['SC02', 'SC16', 'IC36', 'IC30', 'IC11a', 'SC08']);
    return g;
  },
  steps: [
    situation(
      'Sindiana and Masada',
      `Each side may play <b>one event</b> in a battle, before the first roll. Two Golan events are worth knowing.
    <p>First you play <b>Syria</b>: the <b>43rd Tank</b> attacks <b>Golani</b> in Sindiana, and you hold the <b>7th AT</b> battalion and an <b>EW</b> (electronic warfare) event. Then you switch sides for a battle in Masada.</p>`,
      { look: 37 },
    ),
    { title: 'Sindiana', text: '<b>Tap Sindiana</b>, then Fight.', target: { area: 37 }, look: 37, tap: true, done: (g) => !!g.battle },
    { title: 'Fight', text: '<b>Tap Fight Sindiana.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(37) },
    {
      title: 'The 7th AT',
      text: '<b>Tap the 7th AT</b> to commit it as a battle asset.',
      target: { el: ['.card2[data-chit="SC02"]', '.handtab button'], label: '7th AT card' },
      done: (g) => !!g.battle?.assets.syrian.includes('SC02'),
      act: (g) => E.assign(g, g.battle!, 'SC02'),
    },
    {
      title: 'Jamming',
      text: '<b>Tap the EW event.</b> Played by the attacker it <b>jams</b> the defence: each defending block rolls a die, and on 5 or less it is disordered. If every defender is disordered, the defender may commit nothing: no artillery, air, SAM or battle assets.',
      rule: '17.33 Electronic Warfare',
      target: { el: ['.card2[data-chit="SC16"]', '.handtab button'], label: 'EW card' },
      done: (g) => !!g.battle && !!G.battleState(g.battle).ew?.pending,
      act: (g) => G.playJamming(g, g.battle!, 'SC16'),
    },
    {
      title: 'Countermeasures',
      text: 'The Israeli player answers with his own <b>EW</b> event: +2 to each roll. The book rolls a 2, +2 = 4: Golani is <b>disordered</b> all the same, and Israel may commit nothing. <b>Tap Show me.</b>',
      enter: (g) => queue(g, [2]),
      auto: (g) => G.answerJamming(g, g.battle!, 'IC36'),
    },
    {
      title: 'Fight it out',
      text: '<b>Tap Begin combat</b>, then roll through the round: the coach plays the dice as they fall.',
      target: GO,
      done: (g) => !!g.battle && g.battle.stage !== 'setup',
      act: begin,
    },
    {
      title: 'To the end',
      text: '<b>Tap Roll</b> until the round is done, then close the battle.',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => {
        const b = g.battle!;
        for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
          if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
          else if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
          else if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
          else if (b.stage === 'retreat') {
            const o = E.retreatOptions(g, b);
            if (o.length) E.chooseRetreat(g, b, o[0]);
            else E.defenderChoice(g, b, false);
          } else if (b.stage === 'exploit') E.declineExploit(g, b);
          else E.roll_step(g, b);
        }
        E.closeBattle(g);
      },
    },
    {
      title: 'Masada: switch sides',
      text: 'Now you play <b>Israel</b>, attacking the <b>78th Tank</b> in Masada with the 77/7th and a <b>Task Force</b>. You hold a <b>Counterbattery</b> event. <b>Tap Masada</b>, then Fight.',
      look: 58,
      target: { area: 58 },
      tap: true,
      skip: (g) => !!g.battle,
      done: (g) => !!g.battle,
      enter: (g) => {
        g.phasing = 'israeli';
      },
    },
    { title: 'Fight', text: '<b>Tap Fight Masada.</b>', target: GO, done: (g) => !!g.battle, act: fightAt(58) },
    {
      title: 'The Task Force',
      text: '<b>Tap the Task Force.</b>',
      target: { el: ['.card2[data-chit="IC11a"]', '.handtab button'], label: 'Task Force card' },
      done: (g) => !!g.battle?.assets.israeli.includes('IC11a'),
      act: (g) => E.assign(g, g.battle!, 'IC11a'),
    },
    {
      title: 'Counterbattery',
      text: '<b>Tap Counterbattery.</b> Once the enemy artillery has fired you roll a die: on 1–5 that artillery asset is knocked out for as many turns as the die shows.',
      rule: '17.34 Counterbattery',
      target: { el: ['.card2[data-chit="IC30"]', '.handtab button'], label: 'Counterbattery card' },
      done: (g) => !!g.battle && !!G.battleState(g.battle).counterbattery.israeli,
      act: (g) => G.playCounterbattery(g, g.battle!, 'IC30'),
    },
    {
      title: 'The Syrian artillery',
      text: 'Your assets and your event are committed. The Syrian player answers with the <b>89th</b>. <b>Tap Show me.</b>',
      auto: (g) => {
        answer(g);
        E.assign(g, g.battle!, 'SC08');
      },
    },
    { title: 'Begin', text: '<b>Tap Begin combat.</b>', target: GO, done: stage('setup'), act: begin },
    {
      title: 'The 89th fires, then your strike',
      text: '"1 try for a 3": −1 against armour, −1 at a defender. The book rolls a 9: miss. Then your counterbattery rolls a <b>3</b>: the 89th is sent three turns down the track. <b>Roll.</b>',
      target: GO,
      enter: (g) => queue(g, [9, 3]),
      done: (g) => !!g.battle && g.battle.stage !== 'defArty' && g.battle.stage !== 'attArty',
      act: (g) => {
        const b = g.battle!;
        for (let i = 0; i < 3 && (b.stage === 'attArty' || b.stage === 'defArty'); i++) E.roll_step(g, b);
      },
    },
    {
      title: 'Close',
      text: 'Finish the round as it falls and <b>close the battle</b>.',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => {
        const b = g.battle!;
        for (let i = 0; i < 40 && b.stage !== 'done'; i++) {
          if (b.stage === 'attFirst') E.chooseFirstLoss(g, b, b.attPoint);
          else if (b.stage === 'attChoice') E.attackerChoice(g, b, false);
          else if (b.stage === 'defChoice') E.defenderChoice(g, b, true);
          else if (b.stage === 'retreat') {
            const o = E.retreatOptions(g, b);
            if (o.length) E.chooseRetreat(g, b, o[0]);
            else E.defenderChoice(g, b, false);
          } else if (b.stage === 'exploit') E.declineExploit(g, b);
          else E.roll_step(g, b);
        }
        E.closeBattle(g);
      },
    },
    recap([
      'One event per side per battle, before the first roll.',
      "EW jamming: each defender rolls, 5 or less disordered; all disordered means no defending assets. The defender's own EW adds +2.",
      'Counterbattery: after the enemy artillery fires, 1–5 knocks it out for that many turns.',
    ]),
  ],
};

/* ================= Prepare on the Golan (Example 13 and the events) ================= */
const L_ADMIN: Lesson = {
  id: 'g-admin',
  topic: 'Prepare: engineers, reserves, events',
  chapter: CH2,
  ref: '14.5, 14.61, 17.x',
  goal: 'Bridge the ditch, release the 3rd Tank Division, Lt. Zvika, arriving battalions',
  minutes: 6,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'admin', { S14: 50, S13: 33, I05: 42, I09: A(), I10: 47 });
    g.control[33] = 'syrian';
    U(g, 'I09').str = 2;
    U(g, 'I10').str = 2;
    for (const c of g.chits.filter((x) => x.box === 'available')) c.box = 'cup';
    avail(g, ['SC10', 'SC08', 'IC04', 'IC18', 'IC01']);
    sa(g, 'syrian');
    sa(g, 'israeli');
    return g;
  },
  steps: [
    situation(
      'Turn 3, Prepare',
      `Both players act in the Prepare step. You start as <b>Syria</b>: the <b>46th Tank</b> contests Booster, where an Israeli strongpoint still holds, and you hold the <b>5th Engineers</b> and your <b>Special Action</b>. Then the Israeli player takes his turn with <b>Lt. Zvika</b> and an <b>arriving battalion</b>.`,
      { look: 50 },
    ),
    {
      title: 'Bridge the ditch',
      text: '<b>Tap the 5th Engineers.</b> In Prepare an engineer may bridge a ditch boundary from a supplied, uncontested friendly area, into an area you control or contest.',
      rule: '14.51a Bridging the AT ditch',
      target: { el: ['.card2[data-chit="SC10"]', '.handtab button'], label: '5th Engineers card' },
      done: (_g, q) => q('.chitbar', 'Engineer') || q('.chitbar', '5th'),
    },
    {
      title: 'From Khan Arnabe',
      text: '<b>Tap Bridge the AT ditch</b> in the chit panel, then <b>Khan Arnabe</b>, the area the engineers work from.',
      target: { el: '.chitbar button', text: 'ditch', label: 'Bridge the AT ditch' },
      tap: true,
      skip: (g) => G.state(g).bridgedDitch.includes('50-64'),
    },
    {
      title: 'Khan Arnabe',
      text: '<b>Tap Khan Arnabe.</b>',
      target: { area: 64 },
      look: 64,
      tap: true,
      skip: (g) => G.state(g).bridgedDitch.includes('50-64'),
    },
    {
      title: 'To Booster',
      text: '<b>Tap Booster.</b> An <b>AT Ditch Bridged</b> marker lies on the boundary: the road is open, for movement and for supply.',
      target: { area: 50 },
      look: 50,
      done: (g) => G.state(g).bridgedDitch.includes('50-64'),
      act: (g) => G.bridgeDitch(g, 'SC10', 64, 50),
    },
    {
      title: 'Release the 3rd Tank Division',
      text: 'From turn 3 a <b>Special Action</b> spent in Prepare releases the next brigade of the 3rd Tank Division from the Operational Reserve: first the 15th Mech. It is placed at once in a friendly entry area. <b>Tap the Special Action</b>, then Release.',
      rule: '14.61b',
      target: { el: ['.card2.wood.syrian', '.handtab button'], label: 'Special Action block' },
      done: (g, q) => q('.chitbar', 'Release') || (U(g, 'S18').area != null && U(g, 'S18').box !== 'operational_reserve'),
    },
    {
      title: 'Release',
      text: '<b>Tap Release the next 3rd Tank Division unit.</b>',
      target: { el: '.chitbar button', text: 'Release', label: 'Release button' },
      done: (g) => U(g, 'S18').area != null && U(g, 'S18').box !== 'operational_reserve',
      act: (g) => G.releaseOperationalReserve(g, saChit(g, 'syrian').id),
    },
    {
      title: 'The Israeli side: Lt. Zvika',
      enter: (g) => {
        if (!g.done?.includes('syrian')) E.setDone(g, 'syrian'); // 4.2b/c: Syria is done; now Israel acts
      },
      text: 'Syria has tapped <b>Done</b>; now <b>Israel</b> acts. The <b>Lt. Zvika</b> event is a lone tank commander: an elite armour roadblock placed in an empty Israeli area, which stays until destroyed and may be reinforced by Special Action. <b>Tap Lt. Zvika.</b>',
      rule: '17.23 Lt. Zvicka Greengold',
      target: { el: ['.card2[data-chit="IC04"]', '.handtab button'], label: 'Lt. Zvika card' },
      done: (g, q) => q('.chitbar', 'Zvika') || C(g, 'IC04').box === 'map',
    },
    {
      title: 'Merom Golan',
      text: '<b>Tap Merom Golan</b>: Zvika takes position on the road from Booster.',
      target: { area: 51 },
      look: 51,
      done: (g) => C(g, 'IC04').box === 'map',
      act: (g) => G.playLtZvika(g, 'IC04', 51),
    },
    {
      title: 'Arriving battalions',
      text: 'The <b>179th Armored</b> arrived with two steps per block; this event brings its missing battalions: two steps to one block, one to each, or an eliminated block back. <b>Tap the Battalion event.</b>',
      rule: '17.21 Arriving battalions',
      target: { el: ['.card2[data-chit="IC18"]', '.handtab button'], label: 'Battalion card' },
      done: (g, q) => q('.chitbar', 'Battalion') || U(g, 'I10').str === 3,
    },
    {
      title: 'One step each',
      text: '<b>Tap +1 step to each.</b>',
      target: { el: '.chitbar button', text: '+1 step to each', label: '+1 step to each' },
      done: (g) => U(g, 'I10').str === 3,
      act: (g) => G.playArrivingBattalion(g, 'IC18', { split: ['I09', 'I10'] }),
    },
    recap([
      'Engineers bridge the ditch in Prepare from a supplied friendly area; Syrian engineers may also lift a minefield.',
      'A Syrian Special Action releases the 3rd Tank Division one brigade at a time, from turn 3.',
      'Lt. Zvika is a roadblock that fights like an elite tank; arriving battalions rebuild the reduced brigades.',
    ]),
  ],
};

const L_RAID: Lesson = {
  id: 'g-raid',
  topic: 'Commando raids',
  chapter: CH2,
  ref: 'Ex 13',
  goal: 'A raid behind the line, and what it costs the Israelis',
  minutes: 5,
  side: 'syrian',
  setup: () => {
    const g = golanTable(3, 'syrian', 'admin', { S16: 26, S14: 22, I11: 12, I15: G.ASSEMBLY.B, I05: 42 });
    for (const a of [22, 26, 27, 28, 31, 32, 33, 38, 41, 47, 48, 49, 50]) g.control[a] = 'syrian';
    G.state(g).bridgedDitch = ['50-64'];
    for (const c of g.chits.filter((x) => x.box === 'available')) c.box = 'cup';
    avail(g, ['SC40', 'SC35']);
    G.placeRaid(g, 'SC35', 24);
    g.log = [];
    return g;
  },
  steps: [
    situation(
      'Helicopters in the night',
      `Last turn the <b>184th Commandos</b> landed at Ma'ale Gamla, on the escarpment road the Israeli reserves must climb. Now, in Prepare, you hold the <b>185th</b>. A raid may land in a <b>vacant Israeli area next to a Syrian block</b>: the <b>46th Tank</b> stands at Ramat Magshimim, next to El-Al.`,
      { look: 21 },
    ),
    {
      title: 'The 185th Commandos',
      text: '<b>Tap the 185th Commandos.</b>',
      rule: '16.11a Commando raid',
      target: { el: ['.card2[data-chit="SC40"]', '.handtab button'], label: '185th Commandos card' },
      done: (g, q) => q('.chitbar', 'Cdo') || q('.chitbar', 'Commando') || C(g, 'SC40').box === 'map',
    },
    {
      title: 'El-Al',
      text: '<b>Tap El-Al.</b> The commandos sit there: Israeli blocks may not strat-move or retreat into the area, and the first to enter pays +1 and triggers the raid roll.',
      target: { area: 21 },
      look: 21,
      done: (g) => C(g, 'SC40').box === 'map',
      act: (g) => G.placeRaid(g, 'SC40', 21),
    },
    {
      title: 'The Israeli turn',
      text: "The coach plays the rest of the Syrian turn. In the Israeli Move step the <b>4th Mech</b> at Ad Dardarah climbs towards Ma'ale Gamla. <b>Tap Show me.</b>",
      auto: (g) => runTo(g, 3, 'israeli', 'movement'),
    },
    tapUnit(
      'I11',
      'Into the raid',
      "<b>Tap the 4th Mech.</b> Ma'ale Gamla costs 1 for the road, +1 for the escarpment, +1 for the commandos: 3.",
      { rule: '16.11a' },
    ),
    {
      title: 'The raid roll',
      text: "<b>Tap Ma'ale Gamla.</b> The Syrian player rolls: 1–2 the raid succeeds and the commandos fight as a defended roadblock; 3–5 partly, they block but do not fire; 6 or more the helicopters were shot down. The book rolls a <b>2</b>.",
      target: { area: 24 },
      look: 24,
      enter: (g) => queue(g, [2]),
      done: (g) => area('I11', g) === 24,
      act: (g) => {
        E.move(g, U(g, 'I11').id, 24);
      },
    },
    tapUnit(
      'I15',
      'The 9th Mech',
      'The <b>9th Mech</b> arrived in the Southern Assembly Area. <b>Tap it</b>: a block in an assembly box may be marked as reserve.',
    ),
    {
      title: 'Reserve',
      text: '<b>Tap Reserve.</b>',
      target: { el: '.c-dispatch button', text: 'Reserve', label: 'Reserve button' },
      done: (g) => !!U(g, 'I15').reserve,
      act: (g) => E.setReserve(g, U(g, 'I15').id, true),
    },
    {
      title: 'End the move',
      text: '<b>Tap End movement.</b> In Strategic movement the 9th Mech may climb the southern road, but not into El-Al while the raid holds it.',
      target: GO,
      done: (g) => g.phase === 'strategic',
      act: (g) => E.endPhase(g),
    },
    tapUnit('I15', 'The 9th Mech', '<b>Tap the 9th Mech again.</b> El-Al is not offered.'),
    {
      ...moveTo(
        'I15',
        19,
        'Givat Yoav',
        '<b>Tap Givat Yoav.</b> The raid is fought in the Fight step, like a roadblock defended by a battalion.',
      ),
      act: (g) => E.stratMove(g, U(g, 'I15').id, 19),
    },
    recap([
      'A commando raid lands in Prepare on a vacant Israeli area next to a Syrian block.',
      'No strat-move or retreat into it; the first Israeli block in pays +1 and triggers the roll.',
      '1–2 a defended roadblock to fight; 3–5 it blocks only; 6+ the commandos are lost.',
    ]),
  ],
};

/* ================= Reaction and Breakthrough (Example 14) ================= */
const L_BREAK: Lesson = {
  id: 'g-breakthrough',
  topic: 'Reaction and Breakthrough',
  chapter: CH2,
  ref: 'Ex 14',
  goal: 'The Syrian reaction, then three Israeli ways to press on',
  minutes: 6,
  side: 'israeli',
  setup: () => {
    const g = golanTable(5, 'israeli', 'combat', { S26: 30, S12: 31, I05: 31, I19: 26, I17: 33, S13: 32, I21: 27, S09: 28, I07: 42 });
    for (const a of [30, 32, 28]) g.control[a] = 'syrian';
    for (const a of [31, 33, 26, 27]) g.control[a] = 'israeli';
    U(g, 'S26').reserve = 'res';
    g.markers.syrian.res--;
    U(g, 'I19').reserve = 'res';
    g.markers.israeli.res--;
    U(g, 'I17').exploit = true;
    sa(g, 'israeli');
    for (const u of g.units) u.moved = true;
    for (const id of ['S26', 'I19', 'I17', 'I21']) U(g, id).moved = false;
    g.contestedAtMoveStart = [31];
    g.fought = [31];
    g.phase = 'reaction';
    return g;
  },
  steps: [
    situation(
      'After the Israeli battles',
      `Turn 5. The Israeli Fight step is over: Einot Peham is still contested, the <b>205th</b> cleared Zohar and carries an exploitation tag, the <b>317th Para</b> waits in reserve at Yonatan, the <b>670th</b> stands at Tel Saki, and your Special Action is in hand.
    <p>First the Syrian player <b>reacts</b>, then you break through.</p>`,
      { look: 31 },
    ),
    {
      title: 'The Syrian reaction',
      text: 'A reacting reserve block may make a full move, even <b>into a contested area</b>, but may not create a new one. The <b>91st Tank</b>, in reserve at Tel Faris, reinforces Einot Peham. <b>Tap Show me.</b>',
      rule: '7.1 Reaction',
      auto: (g) => {
        E.move(g, U(g, 'S26').id, 31);
        while (g.phase === 'reaction') E.endPhase(g);
      },
    },
    tapUnit('I19', 'A reserve block', 'Breakthrough. First, a reserve block makes a full move: <b>tap the 317th Para at Yonatan.</b>', {
      rule: '7.3 Breakthrough movement',
    }),
    moveTo(
      'I19',
      31,
      'Into Einot Peham',
      '<b>Tap Einot Peham.</b> By field, 2 + 1 for the occupants: the paratroopers join the fight there.',
    ),
    tapUnit('I17', 'An exploiting block', 'Second, the <b>205th</b> with its exploitation tag moves one area: <b>tap it.</b>'),
    moveTo('I17', 32, 'Keshet', '<b>Tap Keshet.</b> The 51st Tank is there: a newly contested area, which must be fought.'),
    tapUnit('I21', 'A Special Action', 'Third, a Special Action advances an armour block one area: <b>tap the 670th Mech at Tel Saki.</b>'),
    {
      title: 'Activate',
      text: '<b>Tap Activate (SA).</b>',
      rule: '8.21',
      target: { el: '.c-dispatch button', text: 'Activate', label: 'Activate (SA)' },
      done: (g) => !!U(g, 'I21').exploit || area('I21', g) === 28 || saChit(g, 'israeli').box !== 'available',
      act: (g) => E.activateBreakthrough(g, U(g, 'I21').id, saChit(g, 'israeli').id),
    },
    moveTo('I21', 28, 'Juhader', '<b>Tap Juhader.</b> The 78th Tank there is now contested too.'),
    {
      title: 'Breakthrough combat',
      text: '<b>Tap End breakthrough moves.</b> Keshet and Juhader must be fought; Einot Peham, contested before, could be fought again only with another Special Action. The coach plays the two battles.',
      rule: '7.4',
      target: GO,
      done: (g) => g.phase !== 'btMove',
      act: (g) => {
        E.endPhase(g);
      },
    },
    {
      title: 'The battles',
      text: '<b>Tap Show me</b>: the coach rolls Keshet and Juhader as the dice fall.',
      auto: (g) => {
        for (const a of E.mustFight(g)) autoFight(g, a);
      },
    },
    recap([
      "Reaction: the other side's reserves move, even into contested areas, never creating a new one.",
      'Breakthrough: reserves a full move, exploiting armour one area, a Special Action one area for an armour block.',
      'New contests are fought at once; old ones need a Special Action.',
    ]),
  ],
};

/* ================= Supply and victory (Example 15) ================= */
const L_SUPPLY: Lesson = {
  id: 'g-supply',
  topic: 'Supply on the Golan',
  chapter: CH2,
  ref: 'Ex 15',
  goal: 'Ditches, escarpments and minefields in the supply line',
  minutes: 5,
  side: 'syrian',
  setup: () => {
    const g = golanTable(
      5,
      'syrian',
      'btCombat',
      { S08: 49, S06: 56, I06: 57, S14: 57, S07: 58, S05: 52, I05: 50, I07: 55 },
      { keep: ['I25'] },
    );
    for (const a of [49, 52, 54, 56, 57, 58, 60, 61, 62, 2]) g.control[a] = 'syrian';
    for (const a of [50, 51, 53, 55, 59, 46, 45, 1, 3]) g.control[a] = 'israeli';
    G.state(g).bridgedDitch = ['57-61'];
    g.contestedAtMoveStart = [57];
    g.fought = [57];
    E.endPhase(g);
    g.log = [];
    return g;
  },
  steps: [
    situation(
      'The Supply step',
      `Syrian supply lines lead back to the entry areas V to Z through Syrian-held areas. On the Golan the line also obeys the ground: it may cross an unbridged ditch only from the area next to it, an escarpment only by road, and never a minefield.`,
      { look: 49 },
    ),
    {
      title: 'Supply',
      text: '<b>Tap Map, then Supply</b>.',
      target: { el: ['.laysw button[title^="Supply"]', '.mapmenu-btn'], label: 'Supply in the Map list' },
      done: (_g, q) => q('.laysw button[aria-pressed="true"][title^="Supply"]'),
    },
    tapUnit(
      'S08',
      'Kuneitra',
      '<b>Tap the 7th Recon in Kuneitra.</b> It traces straight back across the ditch, which it stands next to, towards entry area Y.',
      { rule: '14.93 Tracing a supply path' },
    ),
    tapUnit(
      'S06',
      'El Rom',
      '<b>Tap the 68th Infantry in El Rom.</b> Its line runs through Tel Hermonit, Syrian-held though an Israeli block contests it, and over the <b>bridged</b> ditch to Jubata: bridged ditches are open for supply.',
    ),
    tapUnit(
      'S07',
      'Masada',
      '<b>Tap the Moroccans in Masada.</b> Towards Zaura the escarpment blocks the line; only a road may cross it. The line goes by El Rom instead.',
    ),
    tapUnit(
      'S05',
      'Wasit',
      '<b>Tap the 85th Infantry in Wasit.</b> Merom Golan, Sikeik, Qela and Oretal are Israeli-held, Tel Abu Nida holds a garrison: no way out, <b>cut off</b>.',
      {
        why: 'A line may run out of a contested area you do not control, but never into an enemy-controlled area, nor next to an uncontested enemy block (9.31). A minefield or an enemy strongpoint on the way blocks it too.',
      },
    ),
    {
      title: 'Supply checks',
      text: 'Each cut-off block rolls a morale check now. <b>Tap Roll supply checks.</b>',
      rule: '9.4 Supply checks',
      target: { el: ['.c-bar.b .go', '.c-bar.b button'], text: 'Roll', label: 'Roll button' },
      skip: (g) => !g.supplyPending,
      enter: (g) => queue(g, [9, 9, 9, 9]),
      done: (g) => !g.supplyPending,
      act: (g) => E.rollSupply(g),
    },
    recap([
      'Syrian supply comes from entry areas V–Z, Israeli supply from the three supply symbols; Mt Hermon and the assembly boxes are always supplied.',
      'A line crosses an unbridged ditch only from the adjacent area; bridged ditches are open.',
      'An escarpment only by road; a minefield never; an enemy strongpoint blocks like any enemy block.',
    ]),
  ],
};

const L_VICTORY: Lesson = {
  id: 'g-victory',
  topic: 'Victory on the Golan',
  chapter: CH2,
  ref: '19.0',
  goal: 'The victory check, sudden death and the Jordan',
  minutes: 3,
  side: 'syrian',
  setup: () => {
    const g = golanTable(4, 'syrian', 'movement', { S26: 21, S13: 22, S12: 42, I05: 36, I07: 46, I11: 30 }, { keep: ['I23', 'I24'] });
    for (const a of [21, 22, 42, 20, 23, 25, 26, 27, 28, 29, 31, 32, 33, 38, 39, 40, 41]) g.control[a] = 'syrian';
    return g;
  },
  steps: [
    situation(
      'The Victory Check',
      `After both player turns the score is checked. In this turn 4 position Syria holds <b>El-Al</b> (one point, if supplied and occupied) and <b>Nafakh</b> (a mutual star). Israel keeps the other mutual stars. <b>Open the score sheet.</b>`,
      { look: 42 },
    ),
    {
      title: 'The sheet',
      text: '<b>Tap the score strip.</b>',
      target: { el: '.vps', label: 'score strip' },
      done: (_g, q) => q('.vsheet'),
    },
    {
      title: 'Sudden death',
      text: 'From turn 4 the lead printed under the turn wins at once. Objectives count only while supplied; Syrian numbered objectives also need a Syrian block in them. Each eliminated large unit adds a point. And a supplied Syrian block west of the Jordan ends the game whatever the score.',
      rule: '19.3 Sudden Death · 19.5',
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'Close the sheet',
      '<b>Close the sheet.</b> You have seen every phase of the Golan turn.',
    ),
    {
      title: 'Ready to play',
      kind: 'recap',
      text: `<ul><li>Reinforce, Prepare, Move, Fight, Breakthrough, Supply: each side in turn, then the Victory Check.</li><li>Syria attacks early and must keep its blocks supplied across the ditch; Israel trades ground for time until the reserves arrive.</li><li>Watch the sudden-death line from turn 4, and the Jordan.</li></ul><p>Pick a game: <b>Operation Badr</b> is the historical nine turns; the free set-up lets both players place their units. The in-game ⓘ button keeps the full explanations.</p>`,
    },
  ],
};

/* ================= What's new: the introduction for Bulge players ================= */
const L_NEW: Lesson = {
  id: 'g-new',
  topic: 'Same engine, new ground',
  chapter: CHN,
  goal: 'What a Bulge player must unlearn and learn',
  minutes: 4,
  side: 'syrian',
  setup: badrStart,
  steps: [
    situation(
      'Same engine, new ground',
      `You know the series: blocks, chits, the five steps, the round of combat, supply. Golan '73 keeps all of it. What changes:
    <ul><li><b>Sides</b>: Syria attacks first, Israel defends and counter-attacks. Nine turns of half a day; turn 2 is the <b>night</b>.</li>
    <li><b>Ground</b>: the anti-tank ditch and its minefields, the escarpment, wadis, rugged ground, sectors, the SAM barrier, Mt Hermon.</li>
    <li><b>Units</b>: Syrian divisions by stripe, Israeli brigade pairs, strongpoints and ghosts, the 82nd Para, reserves in holding boxes.</li>
    <li><b>Assets</b>: no fuel, no army zones. Air support with three missions, SAMs, commandos, EW and counterbattery events.</li>
    <li><b>Set-up</b>: the Israeli player places the strongpoints and three minefields before play.</li>
    <li><b>Victory</b>: Syrian objectives need a block in them; a supplied Syrian block west of the Jordan wins outright.</li></ul>`,
      { look: 48 },
    ),
    {
      title: 'The score',
      text: 'Israel starts at <b>6</b>: it holds every mutual star. <b>Tap the score strip</b> to see the Syrian objectives, worth most at the Jordan bridges.',
      target: { el: '.vps', label: 'score strip' },
      done: (_g, q) => q('.vsheet'),
    },
    closeStep(
      '.vsheet [aria-label="Close"]',
      '.vsheet',
      'No fuel, no zones',
      'There is no fuel rule: armour has its six points every turn. There are no army zones either; chits help any block of their side. <b>Close the sheet.</b>',
    ),
    {
      title: 'The night turn',
      text: 'On <b>turn 2</b> Syrian infantry moves one area and armour two (4 points), nobody flies, the 82nd may not drop, strat-moves are limited to two Israeli and one Syrian, and everyone fires at −1 except Syrian armour.',
      rule: '14.03 Night turn',
    },
    recap([
      'Syria first, nine half-day turns, turn 2 is the night.',
      'New boundaries: ditch, escarpment, wadi, rugged, sectors, the SAM barrier.',
      'No fuel, no army zones. Air, SAMs, commandos, EW, counterbattery.',
      'Israel sets up its strongpoints and minefields.',
    ]),
  ],
};

export const GOLAN_COURSE: Course = {
  ...infoOf('golan73'),
  lessons: [
    L_WELCOME,
    L_BLOCKS,
    L_MAP,
    L_CHITS,
    L_SETUP,
    L_REINF,
    L_MOVE_IS,
    L_MOVE_SY,
    L_STRAT,
    L_COMBAT,
    L_ASSAULT,
    L_AIR,
    L_EVENTS,
    L_ADMIN,
    L_RAID,
    L_BREAK,
    L_SUPPLY,
    L_VICTORY,
  ],
  end: [
    { label: 'Start Operation Badr', scenario: 'badr', primary: true },
    { label: 'Badr, free set-up', scenario: 'badr_alt' },
  ],
};
export const GOLAN_NEW_COURSE: Course = {
  ...infoOf('golan73-new'),
  lessons: [
    L_NEW,
    L_BLOCKS,
    L_MAP,
    L_SETUP,
    L_REINF,
    L_MOVE_IS,
    L_MOVE_SY,
    L_COMBAT,
    L_ASSAULT,
    L_AIR,
    L_EVENTS,
    L_ADMIN,
    L_RAID,
    L_BREAK,
    L_SUPPLY,
    L_VICTORY,
  ].map((l) => ({ ...l, chapter: CHN })),
  end: [
    { label: 'Start Operation Badr', scenario: 'badr', primary: true },
    { label: 'Badr, free set-up', scenario: 'badr_alt' },
  ],
};
export const stripeOf = stripe;
