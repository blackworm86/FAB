/** The Bulge basics: the short course that replaces the old Bulge course (docs/TUTORIAL-OUTLINE.md, approved 14 November 2026).
 *  Lessons of 1 to 3 minutes, at most 8 steps, the Play Book's positions and dice. Built a few lessons at a time: the owner tries
 *  them on his phone before the rest is written. Reached at ?tutorial=bulge-basics until it replaces the old course on the home page.
 *  Engine only (no DOM), so the tests play every step. */
import * as E from '../../engine/src';
import {
  type Course,
  type Lesson,
  U,
  area,
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
  recap,
  next,
  bulgeTable,
  blockAnatomy,
  bulgeBlock,
  bulgeWood,
} from './tutorial-kit';

const CH = 'The basics';

/* 1 · Do first: one block, one move. */
const L_FIRST: Lesson = {
  id: 'first-move',
  topic: 'Your first move',
  chapter: CH,
  ref: '23.3',
  goal: 'Tap a block, tap where it goes',
  minutes: 1,
  side: 'german',
  setup: () => bulgeTable(2, 'german', 'movement', { '26 VG': 4, '116 Pz': 4 }),
  steps: [
    tapUnit('26 VG', 'Your first move', 'You command the German army. <b>Tap the block in Prüm.</b>'),
    moveTo('26 VG', 3, 'Where it can go', 'The areas it can reach light up. <b>Tap Pronsfeld.</b>'),
    recap(['You can move a block: tap it, then tap a lit area.']),
  ],
};

/* 2 · The block's sticker and the price of a move (Play Book 23.3: the 26th VG and the 116th Panzer from Prüm). */
const L_COSTS: Lesson = {
  id: 'move-costs',
  topic: 'What a move costs',
  chapter: CH,
  ref: '23.3',
  goal: 'Steps and quality, roads and fields, zones, Undo, fuel',
  minutes: 3,
  side: 'german',
  setup: () => {
    const g = bulgeTable(2, 'german', 'movement', { '26 VG': 4, '116 Pz': 4, '2 Pz': 37, '560 VG': 22 });
    for (const c of g.chits.filter((x) => x.side === 'german' && x.kind === 'fuel')) c.box = 'available';
    return g;
  },
  steps: [
    next(
      'Read a block',
      'The <b>pips</b> on top are its steps: a hit takes one. Their <b>colour</b> is its quality. An oval is armour, an X infantry.',
      {
        rule: '2.2 Steps',
        why: 'Red pips elite, black veteran, white green. A block with its last step gone is eliminated. The enemy sees only the colour of your blocks until a battle.',
        figure: (g) =>
          blockAnatomy(bulgeBlock(g, '116 Pz'), bulgeWood(g, '116 Pz'), {
            pips: 'steps',
            quality: 'pip colour = quality',
            type: 'oval = armour',
            name: 'the division',
          }),
      },
    ),
    tapUnit('26 VG', 'Moves cost points', 'A road costs 1 point, a field 2. The infantry has 3. <b>Tap it.</b>', { rule: '5.3 Movement' }),
    moveTo(
      '26 VG',
      5,
      'Another army’s zone',
      '<b>Tap Losheim.</b> It is in the 6th Panzer Army’s zone: leaving yours costs 2 more, so the block stops there.',
      { rule: '5.33 Army boundaries' },
    ),
    {
      title: 'Undo',
      text: 'Changed your mind? <b>Tap Undo.</b> A move can be taken back until something is revealed or rolled.',
      target: { el: '[data-undo]', label: 'Undo' },
      undo: true,
      done: (g) => area('26 VG', g) === 4,
    },
    tapUnit('116 Pz', 'The armour', 'Armour has 6 points. <b>Tap the 116th Panzer.</b>'),
    moveTo(
      '116 Pz',
      23,
      'By road to St. Vith',
      '<b>Tap St. Vith.</b> Three roads, 3 points. German armour needs a <b>fuel</b> chit only to go further than 3.',
      { rule: '16.13 Fuel' },
    ),
    {
      ...moveTo(
        '560 VG',
        37,
        'Your turn',
        'Join the 2nd Panzer in Lullange: 1 for the road, +1 because the area is occupied. <b>Move the 560th VG there.</b>',
        { kind: 'try', why: 'Tap the block in Weiswampach, then Lullange. Entering any occupied area costs 1 more point (5.32).' },
      ),
      target: { area: 37, label: 'Lullange' },
    },
    recap(['You can read a block and plan a move: road 1, field 2, +1 occupied, +2 to leave your army’s zone.']),
  ],
};

/* 3 · One round of combat, as the Play Book plays it (23.5: the 18th VG against the 106th Infantry in St. Vith). */
const L_BATTLE: Lesson = {
  id: 'first-battle',
  topic: 'Your first battle',
  chapter: CH,
  ref: '23.5',
  goal: 'Start a battle, read the dice, take the hits',
  minutes: 3,
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
      title: 'Your first battle',
      text: 'Your 18th VG has entered St. Vith. Enemy in the same area means a battle. <b>Tap Fight St. Vith.</b>',
      rule: '6.1 Combat',
      target: GO,
      look: 23,
      done: (g) => !!g.battle,
      act: fightAt(23),
    },
    {
      title: 'The enemy reinforces',
      text: 'The Allies spend a <b>Special Action</b> to bring in the CCB/9th Armored. The face-down blocks turn up: now you see what you fight.',
      rule: '8.23 Reinforce',
      why: 'Each side has a reusable Special Action. Here the defender pulls a block in from a neighbouring area. The new block may not be the point unit, so the 106th stays in front.',
      auto: (g) => {
        const b = g.battle!;
        E.defenderReinforceSA(g, b, U(g, 'CCB/9').id, 'SA-allied');
        answer(g);
        E.setPoint(g, b, 'allied', U(g, '106 Inf').id);
      },
    },
    {
      title: 'Begin',
      text: 'The gold marker is each side’s <b>point unit</b>, the block in front. <b>Tap Begin combat.</b>',
      rule: '6.24 Point unit',
      target: GO,
      done: stage('setup'),
      act: begin,
    },
    {
      title: 'The defender fires',
      text: 'Each die at or under the <b>Success Number</b> is a hit. <b>Tap Roll.</b>',
      rule: '6.27 Defensive fire',
      why: 'The base number is 5. Armour firing +1, green troops firing at veterans −1; the chips on each line say why the number moved. A block rolls one die per step.',
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
      title: 'Two hits on you',
      text: 'Your first hit is always a step. For the second: lose another, or <b>abort</b> the attack and pull back disordered. <b>Tap Abort.</b>',
      rule: '6.41 Attacker hits',
      why: 'Aborting absorbs every remaining hit, but all the attacking blocks become disordered. The Play Book aborts here: the 18th VG cannot win this round.',
      target: { el: ['.c-dispatch button', 'button'], text: 'Abort', label: 'Abort button' },
      done: (g) => !!g.battle?.result || !g.battle,
      act: (g) => E.attackerChoice(g, g.battle!, true),
    },
    {
      title: 'Close the battle',
      text: 'St. Vith holds this time. <b>Tap Close battle.</b>',
      target: GO,
      done: (g) => !g.battle,
      act: (g) => E.closeBattle(g),
    },
    recap(['You can fight a battle: the defender fires first, dice at or under the number hit, and the attacker may abort.']),
  ],
};

export const BASICS_COURSE: Course = {
  id: 'bulge-basics',
  game: 'bulge',
  title: 'The Bulge: the basics',
  sub: 'first lessons · a few minutes each',
  blurb: 'The short course, a few minutes a lesson: move, read the dice, fight. (In progress: the first three lessons.)',
  minutes: 7,
  lessons: [L_FIRST, L_COSTS, L_BATTLE],
  end: [
    { label: 'Start a Nuts! game', scenario: 'intro', primary: true },
    { label: 'Start the Tournament', scenario: 'tournament' },
  ],
};
