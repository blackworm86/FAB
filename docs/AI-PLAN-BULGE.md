# Computer opponent, rethought: The Bulge first

Written 10 November 2026, at the owner's request: rethink the computer opponent from scratch, starting from what is known about computer opponents for wargames and board games, and from what is known about playing FAB: The Bulge.

## 1. Why the current computer player has hit a wall

The current player (`engine/src/ai.ts`) is a hand-written rule player (Easy/Normal) with a Hard layer that tries its options on copies of the game. Two weeks of measurement (`docs/HANDOVER.md` §4) show:

- **Every action of the Bulge rules is in its hands**, legal by construction, honest about hidden blocks. The Allied player is strong.
- **The German attacker loses to a good defence** (about 5 VP behind against Hard Allies, 2 wins in 16), although it has about twice the Allied strength on the map on turns 2–4.
- **Twenty experiments on weights, plans, a playbook, more thinking time and a sharper plain player changed nothing measurable.**

The cause is one thing: **the computer cannot judge a whole offensive.** Its judge is a position score written by hand (VP, steps, threats, sudden-death margins, ...), and the Hard player feeds it a few play-outs by the plain player. The scores of two offensives differ by 20–50 points from luck alone, the hand-written weights do not say which positions actually win the game, and play-outs by a weak player do not show what a good offensive leads to. A better plan cannot win if the judge cannot tell plans apart.

## 2. What the field says

**AI and Wargaming** (Goodman, Risi and Lucas, 2020, [arXiv 2009.08922](https://arxiv.org/abs/2009.08922)), the main review of AI for wargames, written for the UK defence research agency:

- With **a fast game engine that can be copied** (we have one: the rules engine), "statistical forward planning algorithms such as Monte Carlo Tree Search and Rolling Horizon Evolution ... provide intelligent behaviour out of the box", and "can be combined with learning methods ... to provide even more intelligent play".
- **Too many units to plan move by move**: factorise into unit decisions, or plan **hierarchically**: "a higher-level strategic policy makes decisions about broad goals and transmits these goals to the lower-level units"; action abstraction with "high-level script-based action definitions".
- **Long games with sparse rewards** (the result only shows at the end): **learn the evaluation function** from many simulated games and use it in short-horizon planning. "Expert Iteration learns an interim reward signal that can be used in short-term planning towards a long-term goal that is beyond the planning horizon" (as AlphaZero does); "it is possible to learn an evaluation function ... that is then used to optimally plan up to H steps ahead".
- **Hidden information** (face-down blocks): sample possible hidden states and average over them (determinisation; Information-Set MCTS, [Cowling, Powley and Whitehouse 2012](https://eprints.whiterose.ac.uk/75048/)); keep a belief over the hidden blocks and update it as the game goes on.
- **Adversarial play**: test against a "Hall of Fame" of earlier versions, not only the latest, so a gain is not just a counter to one opponent.

Commercial operational wargames point the same way: the Hearts of Iron IV AI picks **targets near the front** (supply hubs, cities) and **plans a path from the front line to each target**, choosing a new target when an offensive stalls ([Paradox developer diary](https://admin-forum.paradoxplaza.com/forum/developer-diary/developer-diary-small-features.1710063/page-9)); strategy-game AI uses **influence maps** to find the front and its weak points ([University of Michigan course notes](https://web.eecs.umich.edu/~sugih/courses/eecs494/fall06/lectures/lecture19-strategy.pdf)).

**FAB: The Bulge itself** (GMT Play Book 20.0, 24.2; the player forums on BoardGameGeek, ConsimWorld and Reddit could not be read from here: they refuse automated access):

- The tournament scenario: the Germans start 11 VP behind; the Allies win at once if 5 ahead after turn 3 or 4 ahead after turn 4. The German must take the four Allied-held border areas (+1 each) and shared objectives (Bastogne, Malmedy, Werbomont, Marche: +2 each) fast, and must not lose German areas to raids.
- The designer: the historical Germans followed fixed routes per division ("Rollbahns") and so made a salient, a bulge; a game that spreads out to avoid traffic jams ends as a straight line.
- Our own games: the computer's Germans fight too few battles with twice the strength, and pull blocks home to guard against raids.

## 3. The new design

Three layers, each doing what it is good at, and a judge that is **learned from games, not written by hand**.

### 3.1 The judge: a learned value of a position

- **What**: a function that reads a position (from the side to move's point of view, with hidden enemy blocks as they are known) and returns the chance of winning (and the expected final VP margin).
- **How it is made**: thousands of whole games are played on a desktop computer by the existing players with deliberate variety (Easy, Normal, Hard, random offensives, both sides), recording about 50 numbers for every position (VP margin and the next sudden-death margin, turn, steps by side and by quality, steps on and next to each objective, supply, field works, reserves, assets and Special Actions in hand, ...) and who won in the end. A model is fitted to those (first a plain logistic regression; a small neural network only if it predicts clearly better). It is checked on games it has not seen.
- **Where it runs**: the fitted numbers go into the game as a small data file; reading a position costs microseconds, on a phone too.
- **Then improve it in rounds** (Expert Iteration, simplified): the Hard player uses the new judge, plays new games, the judge is refitted on them, and so on, while the arena checks each round against the earlier versions.

This replaces the hand-written score and the long play-outs that made the Hard player's choices noisy.

### 3.2 The commander: a plan per turn

- **Targets**: from an influence map of the board (where each side's strength is, the front, the weak points) and the objectives that the scenario and the learned judge value, the commander picks a few targets for the turn (take Bastogne, hold Malmedy, screen the rear against raids).
- **Tasks**: each block in good order gets a task: attack target X, follow up into X, hold Y, screen Z, reserve. Candidate task plans are generated (several weightings of attack and defence, the routes of the historical axes as one of them), and each is judged by the learned judge after the turn's battles are fought out a few times.
- **Hidden blocks**: instead of one average stand-in for every face-down enemy block, the judge averages over a few sampled versions of the hidden blocks, drawn from what the player can know (the counter mix, what has been seen, what has been eliminated).

### 3.3 The executor: moves and battles

What exists today stays: every action legal through the engine's own option lists, battles fought out on copies (assets, point unit, losses, retreat, Special Actions), the walk of each move one area at a time, the thinking limit per action.

### 3.4 The levels

- **Easy**: the plain player with deliberate mistakes (already there).
- **Normal**: the plain player (already there).
- **Hard**: the commander with the learned judge, within a few seconds per decision on a phone.
- The levels are told apart by measurement, not by hope: each level must beat the level below from both seats in every Bulge scenario.

## 4. How we will know it works

- **The measuring tool**: the arena, on paired seeds, at least 64 games per comparison (split over the processor's cores), with the uncertainty printed beside each number, so a gain of 1 VP is not mistaken for luck again. Opponents: the current Hard player and the earlier versions (Hall of Fame), not only the newest.
- **Targets for The Bulge (tournament scenario)**: new Hard Germans against today's Hard Allies win at least 40% of games (today: about 12%); new Hard Allies do not get weaker; Hard beats Normal and Normal beats Easy from both seats.
- **The owner's games**: after each stage, a short playtest checklist (does the German drive on its axes, does it fight for Bastogne and Malmedy, does it keep a rear guard, is the thinking time acceptable on the phone).

## 5. Stages

| Stage | What | Done when | Rough effort |
|---|---|---|---|
| 0 | Measuring tool: paired seeds, 64+ games split over cores, uncertainty printed, Hall of Fame of saved versions | today's Hard measured with its uncertainty | 1 session |
| 1 | Game recorder and data: 10,000+ varied Bulge games played on the desktop, each position's features and the result saved | data on disk, checked by hand on a few games | 1–2 sessions (plus hours of computer time) |
| 2 | Learned judge v1 (logistic regression), checked on unseen games; plugged into Hard in place of the hand-written score | predicts the winner of unseen positions clearly better than the old score; arena run | 1–2 sessions |
| 3 | Commander: targets from influence map and judge, task plans, sampled hidden blocks | arena: German wins rise clearly; owner playtest | 2–3 sessions |
| 4 | Rounds of self-improvement (new games with the new player, refit, arena against the Hall of Fame) | targets in §4 met or the gain stops | 2+ sessions |
| 5 | Levels and phone: timings on the phone, Easy/Normal/Hard separated by measurement, owner playtest | levels separated, Hard within a few seconds per decision | 1 session |

After The Bulge, the same tools (recorder, judge, commander) carry over to Golan '73 and Sicily: each needs its own data and judge, not new code.

## 6. Risks

- **The judge learns the habits of the players that made the data**, not good play: hence the deliberate variety in the games, the rounds of improvement, and the Hall of Fame.
- **Computer time**: thousands of games take hours on this cloud machine; the data and the fitting run on the desktop or here in the background, never on the phone.
- **Phone speed**: the learned judge is cheap; the commander's battle play-outs keep the existing thinking limit.
- **Hidden information honesty**: the sampled hidden blocks come only from what the side may know (the rule already enforced by `mask()` in `ai.ts`).
