# The tutorial

An interactive course for each volume, built on the Play Book's Examples of Play and woven into the digital interface.
A coach card tells the player what is happening and what to do; a spotlight marks the one thing to tap; everything else is locked.
Works offline, needs no account, and ends by opening a first real game.

Address: `?tutorial=<course id>` (the home page's *Learn to play* card and the in-game *Learn* buttons link there).

## Courses

| Course id | Volume | For whom | Lessons |
| --- | --- | --- | --- |
| `bulge` | The Bulge | a first game of the series | 13, about 65 min |
| `golan73` | Golan '73 | a first game, on the Golan | 18, about 95 min |
| `golan73-new` | Golan '73 | players who know The Bulge: "what's new?" | 16, about 85 min |
| `sicily` | Sicily | a first game, on Sicily | 12, about 55 min |
| `sicily-new` | Sicily | players who know The Bulge: "what's new?" | 11, about 50 min |

## Principles

- **Playbook first.** Every "turn of play" lesson is one of the Play Book's examples, with the book's position and the book's dice, so the result on screen is the result on the page (the tests check it). Where our map differs from the book (an adjacency, a garrison), the lesson says so in a line.
- **Interface woven in.** The lesson that teaches a rule also teaches the control that applies it: the hand and the chit bar, the dispatch buttons (Reserve, Fortify, Roll, Take losses…), the arrival tray, the Pieces window, Undo, the score sheet.
- **One idea per card.** Short text, the action in bold, the rule reference folded under a *why* note for players who want the paragraph. No card asks for more than one tap.
- **Three card kinds.** A *situation* card opens each lesson (who you play, the position, the goal, minutes). Steps follow. A *recap* card closes it with the three or four things to keep. A *try* step is a small challenge the player solves alone, with a hint folded away and a *Do it for me* escape.
- **Figures with the real art.** Blocks, chits and markers are drawn by the game's own renderers (`art.ts`, `golan-art.ts`), with callouts for steps, quality and type, so the player learns the pieces they will see on the table.
- **Both sides.** The player plays the side the example is about (the `side` of the lesson); the camera looks from that side's edge. The coach plays the other side with *Show me* steps.
- **Progress.** The lesson list (the *Lessons* button) shows the chapters, what is done, and lets the player jump. Progress is kept per course in `localStorage` (`fab-tut:<course>`), so *Resume* on the home card picks up where they left.
- **Back works.** Every player action is also written in engine terms (`act`), so *Back* replays the lesson up to the previous step instead of guessing at undo.

## The Bulge course (`bulge`)

Chapter **Before you start**

| Lesson | Side | Goal |
| --- | --- | --- |
| Welcome to the Ardennes | German | What the game is about and how you win |
| Reading a block | German | Steps, quality, unit type, and what a block shows you |
| The map | German | Areas, roads and fields, rivers, zones, who holds what |
| Chits: assets and events | German | The hand, the cup and the boxes, Special Actions |

Chapter **A turn of play** (Play Book 23.1–23.10)

| Lesson | Ref | Side | Goal |
| --- | --- | --- | --- |
| Reinforcement | 23.1 | German | New units and chits arrive; the German artillery attrition |
| Prepare: drawing and playing chits | 23.2 | German | Draw from the cup, play events and assets, end the step |
| Movement | 23.3 | German | Roads and fields, zones, ridges, fuel, bridges, reserves |
| Strategic movement | 23.4 | Allied | Reserves race along the roads |
| Combat | 23.5 | German | The round of combat, the fire report, hits and the abort |
| Artillery and exploitation | 23.6 | German | Committing assets, the defender's hits, the exploitation check |
| Reaction and Breakthrough | 23.7 | German | The enemy reacts, then three ways to press on |
| Supply | 23.8 | German | Tracing a supply line, and what happens when it breaks |
| The Allied turn and victory | 23.9–23.10 | German | The second player turn, the victory check, your first game |

Ends with: *Start a Nuts! game* (intro scenario), *Start the Tournament*.

## Golan '73 course (`golan73`)

Chapter **Before you start**

| Lesson | Ref | Side | Goal |
| --- | --- | --- | --- |
| Welcome to the Golan | | Syrian | The battle, the two sides and how you win |
| Blocks on the Golan | | Syrian | Stripes, brigades and divisions, strongpoints and ghosts |
| The map | | Syrian | The Purple Line, the escarpment, wadis, rugged ground, sectors, Mt Hermon |
| Chits on the Golan | | Syrian | The hand, the boxes, air support, SAMs and commandos |
| Setting up Operation Badr | 22.1 | Israeli | Strongpoints, ghosts and minefields are placed by the Israeli player |

Chapter **The Golan turn** (Play Book examples 1–15)

| Lesson | Ref | Side | Goal |
| --- | --- | --- | --- |
| Reinforcement and Prepare | Ex 1, 2 | Syrian | The Syrian resource boxes, SAM attrition, interdiction answered by SAMs |
| Moving up the heights | Ex 3 | Israeli | Bridges, the escarpment, wadis, occupied and enemy areas |
| Ditches, minefields and rugged ground | Ex 4, 5, 6 | Syrian | The Syrian side of movement |
| Strategic movement | Ex 7 | Israeli | Reserves race by road; the assembly areas |
| Combat with brigade integrity | Ex 8 | Israeli | A full round: artillery, close air support, hits, the brigade's extra die |
| Crossing assault on a strongpoint | Ex 9 | Syrian | Strongpoints in defence, the assault penalty, bridging the ditch in battle |
| Air assault | Ex 10 | Syrian | The 82nd Para drops behind the line |
| Combat events: jamming and counterbattery | Ex 11, 12 | Syrian | The one event per side in a battle |
| Prepare: engineers, reserves, events | 14.5, 14.61, 17.x | Syrian | Bridge the ditch, release the 3rd Tank Division, Lt. Zvika, arriving battalions |
| Commando raids | Ex 13 | Syrian | A raid behind the line, and what it costs the Israelis |
| Reaction and Breakthrough | Ex 14 | Israeli | The Syrian reaction, then three Israeli ways to press on |
| Supply on the Golan | Ex 15 | Syrian | Ditches, escarpments and minefields in the supply line |
| Victory on the Golan | 19.0 | Syrian | The victory check, sudden death and the Jordan |

Ends with: *Start Operation Badr* (historical set-up), *Badr, free set-up*.

Where the book and our map part: Example 8's 91st Tank falls back to Keshet, not Tel Faris (Hushniyah does not touch Tel Faris on our map); Example 15's position is rebuilt on our adjacencies with the same lesson (a ditch, an escarpment and a minefield in the line).

## Golan '73: what's new (`golan73-new`)

One chapter, **What changes on the Golan**: an opening lesson *Same engine, new ground* (what a Bulge player must unlearn: no fuel, no army zones, no Greif; what is new: the Purple Line, the ditch, strongpoints and ghosts, brigades, SAMs and air, commandos, sudden death) and then the Golan lessons above without *Welcome*, *Chits* and *Strategic movement*, which the series player knows.

## Sicily course (`sicily`)

Chapter **Before you start**

| Lesson | Ref | Side | Goal |
| --- | --- | --- | --- |
| Welcome to Sicily | | Allied | Operation Husky, the two sides and how you win |
| Blocks on Sicily | | Allied | Divisions, motorized Italians, untried coastal garrisons |
| The map | | Allied | Landing boxes, ports, army zones, Mount Etna, rivers, Messina |
| Chits on Sicily | | Allied | Air and naval support, Rangers and Commandos, engineers, events |
| Setting up the invasion | Ex 1 · 22.24 | Allied | Garrisons face down, the landing plan, the invasion units |

Chapter **The Sicily turn** (Play Book Examples of Play)

| Lesson | Ref | Side | Goal |
| --- | --- | --- | --- |
| The landings | Ex 9 | Allied | From the beachheads into the coastal areas |
| Beach assault | Ex 14 | Allied | Licata and Gela: untried garrisons revealed, naval support, Rangers, no turning back |
| Army boundaries | Ex 5 | Allied | Zones, releasing a division with a Special Action |
| Ports | Ex 4 | Allied | Palermo at damage 2, repaired by engineers |
| Interdiction and dogfights | Ex 3 | Axis | Two Allied interdictions, one cancelled by a dogfight |
| Fading Italian morale | Ex 10 | Allied | The event, the lost asset, the levels |
| Supply and victory | Ex 18 · 19.0 | Allied | Tracing to beachheads, ports and Messina; the score |

Ends with: *Start the Tournament*, *Sunrise Bridge (short)*.

Where the book and the game part: Example 14 leaves out the −1 for firing in an assault and the −1 for field works that the series Ground Fire table applies (14.27: the river assault penalties apply to beach assaults), so the coach quotes the numbers on screen and the dice are nudged to the book's hits. The beach lesson uses the Tournament's historical boxes Joss (A1) and Dime (A2) with the book's garrisons placed by hand. Example 5 is played from Catania instead of Mount Etna.

`sicily-new` opens with *Same engine, an island* and keeps the lessons above without *Welcome* and *Chits*.

## Code

- `web/src/tutorial-kit.ts` — the model (`Course` › `Lesson` › `Step`), the position builders (`bulgeTable`, `golanTable`: a clean table with only the book's blocks on it), the book's dice (`bookDice` nudges the dice queue to the book's verdicts), the figures (`pieces`, `blockAnatomy`, `strengths`), and the coach's helpers (`autoFight`, `runTo`).
- `web/src/tutorial-bulge.ts`, `web/src/tutorial-golan.ts`, `web/src/tutorial-sicily.ts` — the lessons (the kit adds `sicilyStart`, `sicilyTable` and `bookDiceSeq` for firers that share a name).
- `web/src/tutorial-script.ts` — the registry (`COURSES`, `courseFor`, `coursesOf`) and `replay`.
- `web/src/tutorial.ts` — the runner: coach card, spotlight, lock, lesson list, Back, progress. `main.ts` gives it a host API (`TutHost`) and asks `gate` before a map tap.
- `web/test/tutorial.test.ts` — for every course: unique ids, every step reaches its goal, Back's replay never throws and every figure renders; the book's outcomes (Bulge 23.5–23.8, Golan Ex 2, 3, 6, 8, 9, 15).

### A step

```ts
{ title: 'Commit the artillery', text: '<b>Tap the 405th+55th.</b>', rule: '6.25 Artillery',
  why: 'Artillery fires once, before the blocks, and is spent for the turn.',
  target: { el: ['.card2[data-chit="IC01"]', '.handtab button'], label: '405th+55th card' },
  done: (g) => !!g.battle?.assets.israeli.includes('IC01'), act: (g) => E.assign(g, g.battle!, 'IC01') }
```

`target` is a DOM element (first selector found, optionally with a text), a block, or an area; `done` ends the step from the game state (or from the screen through `q`); `tap` ends it on the tap itself; `auto` is what the coach plays on *Show me*; `act` is the player's action for Back and the tests; `skip` drops a step the game did not ask for; `enter` queues the book's dice; `kind` picks the situation / recap / try card.

### Adding a volume

1. A `tutorial-<volume>.ts` with a `<VOLUME>_COURSE` (and a `<volume>-new` course for series players, mapping the shared lessons into one chapter).
2. Register it in `COURSES`; the home card and the in-game Learn buttons follow from `coursesOf(game)`.
3. Run the tests: they iterate every course.
