# The tutorial

An interactive course for each volume, built on the Play Book's Examples of Play and woven into the digital interface.
A coach card tells the player what is happening and what to do; a spotlight marks the one thing to tap; everything else is locked.
Works offline, needs no account, and ends by opening a first real game.

Address: `?tutorial=<course id>` (the home page's *Learn to play* card and the in-game *Learn* buttons link there).

## Courses

Rebuilt on 14 November 2026 (the owner: the old courses took 50 to 95 minutes and were too long and complex). Outline, history and the owner's decisions: `docs/TUTORIAL-OUTLINE.md`.

| Course id | Volume | For whom | Lessons |
| --- | --- | --- | --- |
| `bulge-basics` | The Bulge | a first game of the series: "Your first turn" | 9, about 22 min |
| `golan73-whats-new` | Golan '73 | players who know The Bulge: only what is new | 6, about 13 min |
| `sicily-whats-new` | Sicily | players who know The Bulge: only what is new | 7, about 13 min |

The old ids (`bulge`, `golan73`, `golan73-new`, `sicily`, `sicily-new`) open the new course of the same game.

## Principles

- **Playbook first.** Every "turn of play" lesson is one of the Play Book's examples, with the book's position and the book's dice, so the result on screen is the result on the page (the tests check it). Where our map differs from the book (an adjacency, a garrison), the lesson says so in a line.
- **Interface woven in.** The lesson that teaches a rule also teaches the control that applies it: the hand and the chit bar, the dispatch buttons (Reserve, Fortify, Roll, Take losses…), the arrival tray, the Pieces window, Undo, the score sheet.
- **One idea per card.** Short text, the action in bold, the rule reference folded under a *why* note for players who want the paragraph. No card asks for more than one tap.
- **Three card kinds.** A *situation* card opens each lesson (who you play, the position, the goal, minutes). Steps follow. A *recap* card closes it with the three or four things to keep. A *try* step is a small challenge the player solves alone, with a hint folded away and a *Do it for me* escape.
- **Figures with the real art.** Blocks, chits and markers are drawn by the game's own renderers (`art.ts`, `golan-art.ts`), with callouts for steps, quality and type, so the player learns the pieces they will see on the table.
- **Both sides.** The player plays the side the example is about (the `side` of the lesson); the camera looks from that side's edge. The coach plays the other side with *Show me* steps.
- **Progress.** The lesson list (the *Lessons* button) shows the chapters, what is done, and lets the player jump. Progress is kept per course in `localStorage` (`fab-tut:<course>`), so *Resume* on the home card picks up where they left.
- **Back works.** Every player action is also written in engine terms (`act`), so *Back* replays the lesson up to the previous step instead of guessing at undo.

## Writing a lesson

- **The goal first.** A course opens with who you are, what you fight for and how you win; the Golan and Sicily courses add one card on what differs from The Bulge.
- **The coach's voice.** Speak to "you": what happens, why it matters, what it means for your plan. Two or three lines a card, the action in bold, the rule number in `rule`, the longer reason in `why`.
- **Fast.** A lesson is 1 to 3 minutes; it ends with one line of what the player can now do (`recap`).
- **What's new only.** Golan and Sicily never teach the series again.

## Code

- `web/src/tutorial-kit.ts` — the model (`Course` › `Lesson` › `Step`), the position builders (`bulgeTable`, `golanTable`: a clean table with only the book's blocks on it), the book's dice (`bookDice` nudges the dice queue to the book's verdicts), the figures (`pieces`, `blockAnatomy`, `strengths`), and the coach's helpers (`autoFight`, `runTo`).
- `web/src/tutorial-basics.ts`, `web/src/tutorial-golan-new.ts`, `web/src/tutorial-sicily-new.ts` — the lessons (the kit adds `sicilyStart`, `sicilyTable` and `bookDiceSeq` for firers that share a name).
- `web/src/tutorial-script.ts` — the registry (`COURSES`, `courseFor`, `coursesOf`) and `replay`.
- `web/src/tutorial.ts` — the runner: coach card, spotlight, lock, lesson list, Back, progress. `main.ts` gives it a host API (`TutHost`) and asks `gate` before a map tap.
- `web/test/tutorial.test.ts` — for every course: unique ids, every step reaches its goal, Back's replay never throws and every figure renders; the book's outcomes (Bulge 23.5–23.8, Golan Ex 2, 6, 9, 11, Sicily Ex 3, 5, 14). `web/test/tutorial-targets.test.ts` checks that every element a lesson points at still exists; `node web/e2e/tutorials.mjs` walks every course in a browser; `COURSE=<id> OUT=<folder>/ node web/e2e/_tutshots.mjs` photographs every step on a phone.

### A step

```ts
{ title: 'Commit the artillery', text: '<b>Tap the 405th+55th.</b>', rule: '6.25 Artillery',
  why: 'Artillery fires once, before the blocks, and is spent for the turn.',
  target: { el: ['.card2[data-chit="IC01"]', '.handtab button'], label: '405th+55th card' },
  done: (g) => !!g.battle?.assets.israeli.includes('IC01'), act: (g) => E.assign(g, g.battle!, 'IC01') }
```

`target` is a DOM element (first selector found, optionally with a text), a block, or an area; `done` ends the step from the game state (or from the screen through `q`); `tap` ends it on the tap itself; `auto` is what the coach plays on *Show me*; `act` is the player's action for Back and the tests; `skip` drops a step the game did not ask for; `enter` queues the book's dice; `kind` picks the situation / recap / try card.

### Adding a volume

1. A `tutorial-<volume>-new.ts` with a "what's new" course for series players, and its entry in `COURSE_INFO` (`tutorial-list.ts`).
2. Register it in `COURSES`; the home card and the in-game Learn buttons follow from `coursesOf(game)`.
3. Run the tests: they iterate every course.
