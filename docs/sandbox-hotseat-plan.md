# Sandbox → Hot-seat for players + Admin tools for the owner

Plan for the owner's approval (15 November 2026). Nothing is built yet. Mockups: `docs/mockups/2026-11-15-hotseat-home.png` (home page) and `docs/mockups/2026-11-15-hotseat-admin-tools.jpg` (the admin drawer on the table).

## What we want

Today's sandbox (`web/src/sandbox.ts`, `web/src/sandbox-ui.ts`, about 850 lines) mixes two jobs: testing for the owner and a way to play two players on one screen. It becomes two clean things on the same table:

1. **Hot-seat**, for players: one screen, two players, no cheat tools anywhere.
2. **Admin tools**, for the owner only: the testing tools, behind one button, never on a player's screen and never on an online table.

## 1. Hot-seat (players)

- **Start**: on the home page, next to "New online game", a **"Play on this screen"** button. The player picks the game, the scenario and the optional rules exactly as for an online game.
- **Play**: the normal table. Every time the other side must act, the **"Pass to the &lt;side&gt; player · tap to start"** strip appears (it exists already). That side's cards, hidden blocks and choices appear only after the tap. The online-only parts (seat bar, chat, connection dot, invite) are not shown.
- **Save and resume**: the game is saved after every action. It appears in the home page's **"Your games"** list next to the online games, marked "This screen", with turn and step; a tap resumes it. A finished game keeps its result and its replay.
- **No cheat tools**: no turn jump, no piece placing, no forced dice, no seat switch.

## 2. Admin tools (owner only)

One **admin button** on the table (a small wrench in the top bar), shown only to the owner's admin account. It opens a side drawer (a bottom sheet on the phone) with four tabs:

| Tab | What it does | From today's sandbox |
|---|---|---|
| **Turn** | jump to a turn, side and step; restart the scenario; change scenario | "Jump to", "Reset", scenario menu: kept |
| **Pieces** | search any block or chit; place or move it on the map; take it off; one step more or less; disordered, moved, out of supply, exploiting, face-up, reserve; field works and river assault on an area; a chit's box | the piece library and detail: kept, merged into one list |
| **Dice** | queue the next die results | "Next dice": kept |
| **Notes** | a note on a piece, area, battle or step with a snapshot; download the report | "Notes": kept |

The admin tools work on any local table: a hot-seat game or the owner's own test game. They never appear on an online table, and never for a player who is not the admin.

### What goes

- The floating **wand button** ("Sandbox") over the map and its panels: replaced by the admin button in the top bar.
- The **"Seat"** switch in the top bar (the dev "switch seat" hack): hot-seat handles the hand-over; the admin can still look from either side through the View menu.
- The sandbox's own **hot-seat switch and cover** (`hotCover`): replaced by the normal pass strip.
- **"Clear map"** (every block off the map): rarely useful, and it leaves games the rules cannot continue. It goes, unless the owner still uses it.
- The **address presets** (`?at=`, `?chits=`, `?battle=`, `?case=`, `?setup=`): kept for the test scripts only, not shown to anyone.

## 3. Keeping admin edits rules-safe

An admin edit can leave a position the rules never produce (a unit with no supply source, a battle with no defender, two point units, a chit in two boxes). Plan:

- every admin edit runs the engine's own checks afterwards (the rules check already used online, `auditChange`), and says plainly what is now unusual;
- edits that would break the game outright (a unit off the map but still a point unit, a battle area with no units) are refused with the reason;
- **question for the rules session**: which admin edits can leave a state the engine cannot continue from (turn jump in the middle of a battle, removing the last unit of a battle, moving a unit across the Purple Line, changing a chit's box mid-battle), and should the engine expose one "is this position playable?" check for the admin tools to call?

## 4. How hot-seat differs from online

| | Hot-seat | Online |
|---|---|---|
| Players | two on one screen | one per browser |
| Account | not needed (proposal) | needed to take a seat |
| Hidden information | shown only after the hand-over tap | each browser sees only its side |
| Saved where | in this browser (proposal) | in the database |
| Replay | yes, in this browser | yes |

**Question for the owner (one at a time):**

1. *Should a hot-seat game need an account and be saved in the database, so it can be resumed on another device, or stay account-free and saved only in this browser?* The free plan allows either. In the browser it is simplest and works offline, but it is lost if the browser's data is cleared.

## 5. Work order (after approval)

1. Hot-seat start and resume from the home page; the pass strip and hidden information on hand-over; no tools for players. The home page and its games list belong to the online session: that part is done with it or by it.
2. The admin button and drawer, built from today's sandbox code (Turn, Pieces, Dice, Notes), shown to the admin only.
3. Remove the wand, the seat switch and the sandbox's own cover.
4. Admin edits checked by the engine (after the rules session's answer).
5. Checks: a hot-seat game started, saved, resumed and finished in each game; the admin tools absent for a player and on an online table; desktop and phone; Italian.
