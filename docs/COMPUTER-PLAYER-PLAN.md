# The computer player, from scratch

Approved by the owner on 10 November 2026. The first computer opponent was removed completely (stage 1); a new one is built here, step by step, starting with The Bulge, for either side. Each finished stage gets a report to the owner. Questions to the owner only when a decision is really theirs.

## Where it lives

- **Its own experimental area**: a folder `bot/` with its own tests, using the game engine only through the public functions the table uses.
- **In the site only behind an experimental switch** (an address the owner knows, not linked from the home page). The normal site, online multiplayer and the sandbox do not change; the experiment can be removed in one step.

## Architecture (the same for both sides)

1. **It sees only what a player sees**: exactly the view of the game a human player in that seat gets, the filtered copy the online game sends to each seat (`engine/src/split.ts`). Honesty about hidden blocks is built in.
2. **Every choice comes from the rules**: one complete list of everything legal at each moment (moves, battles, assets, Special Actions, retreats, reactions, admin plays, every phase), generated from the engine, not written phase by phase. First test: a random player plays thousands of games to the end without ever getting stuck.
3. **A measuring tool before any intelligence**: a tournament runner with paired seeds and enough games (64–200 per comparison, split over the processor's cores), every result with its margin of error, from both seats, against older versions too; thinking time measured against a phone-sized budget.
4. **Simple reference players**: a random player and a short, readable "doctrine" player (attack where the odds are good, hold objectives, keep a reserve). Yardsticks and data makers, not the final player.
5. **A judge learned from games**: thousands of varied games between the reference players, about 50 readable facts per position (points and the sudden-death margin, strength by area, supply, assets in hand, ...) and who won; a model fitted to that, checked on games it has never seen; a small data file, fast on a phone.
6. **A commander that plans in layers**: each turn targets and threats from the judge and a map of each side's strength; each block a task (attack, follow up, hold, screen, reserve); several whole-turn plans, each played out a few times on copies of the game over sampled versions of the enemy's hidden blocks, the best kept by the judge; single decisions (a battle choice, a bridge, a Special Action) one step ahead with the judge.
7. **Improve in rounds**: the new player plays new games, the judge is refitted on them, each round checked against the older versions.
8. **Levels from the same player**: Easy, Normal and Hard differ in thinking time and in how often they deliberately pick a weaker option, set by measurement: each level must beat the one below from both seats.

## Working rules

- Small, readable files; no giant file, no dense one-line code.
- No change kept without a measurement that clears the margin of error.
- Every decision explainable in plain words ("I attack Bastogne because ..."), shown in the experimental mode.
- A thinking-time limit from day one.
- The table and the computer talk through a request with a timeout: the table can never stall.

## Stages for The Bulge

| Stage | What | Done when |
|---|---|---|
| 1 | Remove the old computer opponent completely | done 10 November 2026: site and code without any trace, everything else working |
| 2 | Experimental area, the computer's view, the full list of choices, random player | done 10 November 2026: 1,000 random games over all four scenarios and option mixes, all finished, none stuck (`bot/`, `npm run random -- 1000`, 19 minutes on 4 cores) |
| 3 | Measuring tool and reference players | done 10 November 2026: 200 paired seeds (600 Tournament games), doctrine beats random from both seats: as German 68% wins against 1% (+0.67 ± 0.07), +8.8 ± 0.7 VP; as Allied 100% against 99%, +5.4 ± 0.5 VP; 2.5 ms per decision (`npm run arena`) |
| 4 | Recorded games and the learned judge | the judge predicts the winner of unseen games clearly better than chance |
| 5 | Commander, then rounds of improvement | it beats the doctrine player clearly from both seats; the owner playtests it |
| 6 | Levels and phone speed | three measurably different levels, a few seconds per decision on the phone |

After The Bulge, the same tools carry over to Golan '73 and Sicily, each with its own data.

## Background

What the field recommends for wargames (AI and Wargaming, Goodman, Risi and Lucas 2020, arXiv 2009.08922): with a fast copyable game engine, statistical forward planning (Monte Carlo tree search, rolling-horizon evolution) combined with a learned evaluation; hierarchical decomposition (goals, groups, units) for many units; sampling the hidden information (Information-Set MCTS); testing against a hall of fame of earlier versions. The first computer opponent (removed) showed why a hand-written position score is not enough: it could not tell a good whole-turn offensive from a bad one.
