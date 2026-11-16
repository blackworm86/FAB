# Online play: how it works, and where it can go wrong

Written by the online play session, 15 November 2026, from reading the code (`web/src/online.ts`, `web/src/store-rtdb.ts`, `engine/src/split.ts`, `engine/src/fields.ts`, `database.rules.json`, and the places in the table that call them). Section 6 lists the faults: first the ones the two-browser test (`web/e2e/online.mjs`, section 7) found and that are fixed, then the ones **read from the code and not yet reproduced**.

Background: `docs/ARCHITECTURE.md` §2–§5 and `docs/DEPLOY.md` §5.

## 1. The idea in five lines

- There is no game server. Each player's browser runs the rules itself and writes the result to the database (Firebase Realtime Database, free plan).
- The database only checks **who** writes (the seated players), never whether a move is legal. Each browser checks the other's changes and warns ("Rules check").
- The game everyone can read (the **shared game**) shows a face-down block as a blank placeholder with a meaningless code.
- What each block really is sits in a **private record** per seat that only the player in that seat can read.
- When the rules show a block to the other side (a battle, a face-up block, Intelligence Gathering), its owner's browser publishes its details as a **reveal**.

## 2. Who writes what, and when

Everything of one game is under `games/<id>`.

| What | Where | Written by | When |
|---|---|---|---|
| The game's card (title, volume, scenario, creator) | `meta` | the creator, once | New game |
| Seats | `seats/german`, `seats/allied` (first and second player of any volume) | a signed-in player, for themself only, into a free seat; or leaving their own; an admin can free one | "Sit" / "Leave" |
| The table's lock | `locked` (the two accounts) | a seated player's browser, once; a hot-seat game when it is made; only an admin clears it | when both seats are taken: from then on a seat goes only to the account named there |
| Names at the seats, the members list, each player's own games list | `seatNames`, `members`, `users/<uid>/games` | the player concerned | right after sitting |
| The shared game | `state`: one small value per field (`f/phase`, `f/battle`…), per block (`units/0012`) and per chit, plus a counter `rev` and the writer `by` | the creator once (New game), then only the two seated players | after every action of a player, at once; only the values that changed are sent |
| The game log | `state/f/log` | both players | with each move, added at the end through a "transaction" so two players' lines are both kept |
| Each seat's private block details, and the secret key that makes its blocks' codes | `priv/german`, `priv/allied` | the creator once (both, at New game), then only that seat | before the shared game, whenever that side's blocks changed |
| Reveals | `reveals/<code>` | the block's owner | when a battle area opens (both point units chosen), a block is face-up, or an Intelligence target; removed by the owner when the block is hidden again (it then gets a new code) |
| Chat | `chat` | the two seated players, as themselves | Send |
| Replay record | `journal/pub` (each step's public part), `journal/german`, `journal/allied` (where that seat's blocks stood) | the player who made the step; each seat its own blocks | with each step; nobody can read it until the game is over |

**One move, step by step** (`save()` in `game-state.ts` → `push()` in `online.ts` → `setState()` in `store-rtdb.ts`):

1. The player taps; the table checks it is their seat's turn to act; the rules run on that browser's copy; dice come from the browser's secure random source.
2. If this side's block details changed, the private record is written first.
3. The browser makes the shared copy (its own face-down blocks blanked) and compares it with **the shared game the move started from**; only the differences are written, with the writer's id.
4. The log lines are added.
5. Old reveals of blocks now hidden again are deleted.
6. Only one save runs at a time. A move made while a save is running waits and goes next (only the latest one is kept, which is enough: it contains the earlier ones).

**Receiving a move**: the database sends the changed shared game to every open browser. Each one puts its own block details and the reveals back in (`compose`), runs the Rules check on it if the other player wrote it, then shows it. If a dice roll is on screen, the board waits for the dice to land.

**Starting a battle**: both choose their point unit; each browser publishes its blocks in that area as reveals; the attacker's browser starts the combat once it can see every block there (`driveSplit` in `render.ts`).

## 3. Creating and joining

- **New game**: the creator's browser builds the whole game, shuffles the order of the blocks, makes both private records and the shared copy, and writes them. The creator sits in the chosen seat.
- **Invitation**: a link `…?table=<id>` (share button), or the id typed in "Have an invitation?" on the home page.
- **The joiner** opens the link as a guest (watching only), signs in (the site brings them back to the table), and sits. Sitting does, in order: the seat (refused if someone was faster), the name, membership and games list, then **new codes for that side's blocks** (the creator made the first key and could read the codes; the first to sit replaces it and rewrites the shared copy with the new codes in one write).
- Right after sitting, the joiner's browser asks for its private record. The database may refuse for a moment (it does not yet know the seat): the browser asks again every half second, up to 20 times (the fix of commit `edec14c`). Until it arrives the joiner's own blocks look hidden, and a move made meanwhile is kept and sent afterwards.

## 4. What happens when…

**…a player reloads the page.** Nothing is kept from before on a shared table: the browser reads seats, the shared game, its private record and the reveals again and rebuilds. A move still on its way makes the browser ask "leave the page?" first. A dice result is already saved before the dice animation, so a reload during a roll loses only the animation. Lost on reload: the selection, undo steps, and the Rules check's memory (the first game received after a reload is accepted unchecked).

**…the connection drops.** The Firebase library keeps unsent writes and sends them when the connection is back; arriving changes simply stop. The dot at the top turns amber ("no connection to the game right now") and green again on return (green = connected, saved or received; amber = saving or no connection; red = a save failed, and is being tried again). After 10 seconds without an answer the table says "Saving is taking too long" and lets the player go on.

**…both players act at the same moment** (set-up, Prepare, choosing point units). Each write carries only the values that changed, so two players changing *different* blocks, chits or fields do not disturb each other. If both change the *same* value (one block, or one field such as the battle record), the later write wins and the earlier one is silently gone. The log keeps both players' lines.

**…the joiner arrives in the middle of the creator's turn.** The creator can already play their own part before anyone joins. The joiner's sitting rewrites the codes of the joiner's blocks in the shared game; the creator's browser sees the codes change and treats it as "not a move". If the creator writes the same value at that very moment, one of the two writes wins over the other (a small window).

**…a player writes something the rules do not allow** (a modified browser, or a bug). The other browser's Rules check catches three things: the game went back in time, dice were changed or un-rolled, the wrong side wrote. The change is held back; the player chooses "Restore it for both" or "Accept their change". Anything else false (a block moved too far, a strength changed) is **not** caught.

**…the game is deleted.** Open tables are told and go back to the home page.

## 5. Where hidden information could leak

What is safe by design: a seat's private record is readable only by the account in that seat; the shared game holds blanks for face-down blocks and replaces their names in the log; reveals only hold what the rules already show; a re-hidden block gets a new code.

What is not, in order of how much it matters:

1. **The creator's browser knows everything at the start.** It builds the game, including the other side's blocks, before hiding them. An honest browser forgets; a modified one could keep the list. And although the joiner changes the *codes* of their blocks, a block's **position in the stored list never changes** (`units/0012` stays `0012` all game), so a kept list would still name every enemy block. Same weakness for a re-hidden block: new code, same position, so a curious player reading the raw data can tell which blank is the block they saw in the last battle. *To confirm and fix in the audit (step 4)*: shuffle the positions when the joiner sits, at least.
2. **An empty seat can be peeked.** Anyone signed in who has the link can sit in a free seat, read that side's private record, and leave. So before the opponent sits (or after they leave), a second account of the other player could read their blocks. The database cannot tell a peek from a real player.
3. **Ending the game opens the replay record.** The record of where each side's blocks stood becomes readable as soon as the shared game says "over", and a seated player's browser can write "over" itself. It cannot be taken back (the database forbids it), so the game is visibly ended, but the cheat would have seen every enemy block.
4. **A seated player can write anything into the shared game**, including the other side's blocks. Known limit (no server); the Rules check catches only the three cases above.
5. **This device's own storage** keeps the player's full view of the game. Only that player's device.

Not leaks: guests can read the shared game, the seats, reveals and chat (all public by the rules of the game); the push relay never sees game data.

### The audit of 15 November 2026 (a reviewer helper; most points reproduced on the emulator)

Between two honest friends the risk is low. Before games with strangers the first two mattered most; both are fixed.

| # | What a cheat could do | State |
|---|---|---|
| 1 | Put a tag into game data (a block's type, an id) that ran as script on the other player's screen | **Fixed**: every text read from the database loses `<`, `>`, quotes (`web/src/store-clean.ts`); tested. More unescaped places in the page may exist: the cleaning is the guard |
| 2 | Write "over = false" (both screens play on) and read the other side's blocks in the replay record | **Fixed in `database.rules.json`** (the record opens only on a real result text); tested. **The owner must publish the rules.** Writing a real result still opens it, but both screens then show the game as over |
| 3 | Mark your face-down blocks "face-up" in the shared game, so that your own browser publishes them | **Narrowed**: a block is published only where the rules show it (its area contested, or a battle open there), and hidden again as soon as they do not. A cheat who also fakes a battle or an enemy block in the area can still do it: that needs a server |
| 4 | Switch the Rules check off: a write without the writer's id, or one marked "restore" | **Fixed** (16 November). Rules: every change of blocks, chits, fields and the counter must carry the writer's own id (**to publish**). Browser: an arrival counts as its own only when it is exactly what it last wrote (`online.ts`, `online.lastBy`); a restore is taken only back to a position this browser held since the other player's last accepted change (`heldBefore`), otherwise it is checked like any change. Left: the log is still added without the writer (it is never checked anyway), and a field can still be *deleted* without it (the browser then checks time and dice, not "wrong side"); a restore can still undo the receiver's own last moves, with a visible notice |
| 5 | Sit in an empty seat, read (or overwrite) that side's blocks, leave; a block keeps its place in the stored list all game | **Partly** (16 November; rules **to publish**). Once both seats are taken a seated browser writes `games/<id>/locked` (the two accounts, once; a hot-seat game when it is made): from then on a seat can be taken only by the account named there, so a player can leave and come back and nobody else can sit. Only an admin clears it (freeing a seat does). The first player to sit also shuffles the places of its hidden blocks in the stored list (`rotateSalt`). Left: before the second player sits the seat is open as before; only blocks hidden at that moment change places: a block that was open to all then (off the map: all of Sicily's first player before the landing) or is shown and hidden again keeps its place, for anyone who reads the stored game; the creator's browser still knew every block at the start |
| 6 | Delete or rewrite the other player's reveals; a false reveal of your block rewrites it on your screen | **Partly** (16 November). The browser ignores a reveal that names one of its own blocks (`compose`). Left: either seat can still delete or rewrite the other's reveals (the block then shows as hidden, or with false details); storing them per seat changes the address both browsers use, so an old cached site and a new one could not play a battle together: do it with a version switch |
| 7 | Break the other screen: an unknown volume name reloads it for ever; bad text stops the listener | **Fixed** (16 November). The page reloads as another volume only for its first game and a volume it knows; otherwise the change is held back. A stored value that is no game data is reported once and the last good game stays on screen; a bad reveal is left out. Left: well-formed data of the wrong shape (a block that is a number) is not checked |
| 8 | Any registered stranger fills the free database (large entries, no limits) until the site stops for all | **Narrowed** (16 November; rules **to publish**). The game card, a games-list entry, the game's values and a private record hold only the fields the app writes, each with a size limit; a game id must be one the app makes (ten letters and digits); membership only for the owner or a seated player. Left: the rules cannot count, so an account can still create many games, each of full size: only a server could stop that |
| 9 | Guests read chat and account ids; a chat name can say "(admin)" | Chat: **fixed**, the two players and admins only (owner's decision; rules published by him on 15 November). Open, low: seats and members' account ids are readable by any visitor; a chat name is free text |
| 10 | The push relay has no per-account limit | **Narrowed** (16 November; the relay must be deployed again). Nothing is stored when a device is already kept, when there is nothing to remove, or when the player to notify has no device. Left: no daily limit per account (it would need a stored counter) |

Not fixable without a server: a seated player writing a false but plausible game (a wrong strength, a faked battle record).

## 6. Faults

### Found by the two-browser test and fixed (15 November 2026)

- **A player's own block turned into a blank after a battle, for good.** When a shown block is hidden again it gets a new code, and its owner's private record counts which code is current. That count was never saved to the database (only in the two-tab development table, which is why nobody saw it). From then on the owner's own browser no longer recognised the block: it showed as "Hidden block", and at the next save its real details were overwritten. Very likely the owner's "figures staying blocks" and part of "losses and retreats online". Fixed in `store-rtdb.ts` (the count is saved and read back).
- **A slow start turned a shared table into a local one.** If the database was not reached within 15 seconds (a slow phone, a busy device), the page gave up and showed a table that lives only in that browser, at the invitation's address, with nothing saying so: a strong candidate for "the test table" of issue #2. Now a page opened with a game code keeps waiting and says "Still connecting to the game…". *Still open*: when online play cannot start at all, a page with a game code must show that plainly instead of a playable local table.

- **Moves made at the same moment were lost** (issue #3, "the two screens conflict"; the test lost 2 moves of 8). A move was written as its difference from the *newest* game received, so a move worked out a moment earlier put the other player's fresh change back. A move is now written as its difference from the game it started from, and a waiting move goes out before arrivals are shown. Still true: if both change the *same* value at once, the later write wins.
- **The connection dot** (issue #3) now follows the connection itself: amber "no connection" as soon as the device is cut off, green again when it is back. A save that failed is tried again by itself (up to five times, 3 seconds apart) instead of leaving the dot red until the next move. Moves made offline are sent on return without undoing the other player's.

- **A block placed by the other seat's End reinforcement was written with its real name.** When a player ends the reinforcement step with some of the other side's new blocks still in the tray, the engine places them on the map; the browser that pressed the button knew their names (they were open while in the tray) and wrote them as they were, so the other player's block stood on the shared map by name until its owner next moved. The owner's browser now writes such a block face-down at once when the game arrives (`SplitSeat.exposed`, `online.ts`; unit test in `engine/test/split.test.ts`). Found by the turn part of the two-browser test (16 November); without the fix the test fails on it.

### Seen in the test, not fixed yet

- Right after sitting, the joiner's first entry in the replay record is refused (the database does not know the seat yet, same cause as the private record in `edec14c`): one replay step of that seat's blocks is missing.
- A block that fought stays readable by the other side while it stands where it was shown, even after the enemy has left the area and the rules turn it face-down again (the honest screen draws it face-down; the data is there). The reveal is withdrawn only when the block moves. Low: it is what a player with a good memory knows.

- **A page error on the second player's screen in Golan, now and then** (seen in 2 of 4 full runs of the new test, not in the others): `POLE.get(...) is not iterable`, from `center` (`map-input.ts`) called by the pop-up layer (`FxLayer.place`, `fx.ts`): a pop-up (loss, retreat, control) names an area the map has no spot for. It is the table's, not online play's (the interface session): the test lists it as "no errors on Bruno's page" when it happens. **Fixed (interface session, 16 Nov):** a step-loss pop-up for a unit with no area was given area 0 (Golan has none), and any area the map has no spot for now gets no pop-up; test in `web/test/fx.test.ts`. If it still shows in a run, the cause is another path.

### Read from the code, not yet reproduced

1. **A code that matches no game.** A typed code opens `?table=<code>` with no check that the game exists; the page then waits on an empty table with nothing saying "no such game". A link without `?table=` uses the built-in name `main`.
2. **A typed code always opens as The Bulge first**, then reloads as the right volume once the game arrives: a visible flash, and one more place to get stuck for Sicily and Golan.
3. **Retries end after 10 seconds** for the joiner's private record (20 × ½ s). On a very slow connection the joiner's blocks could stay hidden until a reload.
4. **Online play that cannot start at all** (database not set up or unreachable for good) on a page with a game code: the page should say so plainly; today it can still show a playable local table.

## 7. Tests that exist today

- `tools/rules-test` (needs Java): the database rules, with the app's own create / sit / move / leave writes.
- `engine/test/split.test.ts`, `audit.test.ts`: hidden blocks and the Rules check, with two seats played in one process (no network).
- **`cd web && npm run online`** (`web/e2e/online.mjs`, needs Java and `npm ci` in `tools/rules-test`; it starts and stops its own emulators and dev server, never the real project): two accounts, one desktop and one phone screen, register on the home page; for each volume one creates a game, the other types the code and sits; the invitation shows the code and a QR code; they fight battles from both seats (set-up, point units, dice, hit choices, losses, retreats); both move at the same moment several times; one loses the connection, both move, it comes back; the second player reloads. After every step it checks that the two screens show the same game, that nothing is unsaved or held back by the Rules check, and that no hidden block of one seat is on the other screen or in the stored game. Before the battles above, it plays **whole turns through the screens** (`web/e2e/online-turn.mjs`, each seat acting on its own page in its own turn): The Bulge from the German Combat Phase of turn 1 (where its scenario opens) through the Allied turn and on to the German reinforcements and movement of turn 2; Sicily and Golan '73 from the set-up (the quick buttons) through both sides' whole turn 1 to the reinforcements of turn 2. Done with the interface's own buttons and taps: new blocks picked in the tray and put on a lit entry area (three by hand, the rest left to the end of the step, which places them), "Can move" and a tap on the map for two moves per side, one into an enemy-held area when a legal one exists (not in every step), the airborne drop of Sicily, and every "End ..." and "Roll ..." button, supply and "Continue" included. After every action the two screens must agree, nothing may be held back by the Rules check, no hidden block may be on the other screen or in the stored game, the step named at the top agrees on both screens at the end of each step, the turn number goes up on both, and both screens mark the same blocks out of supply. The first battles of a turn (`HAND=1` by default, `HAND=n` to change) are fought with the screen's own buttons; the rest of that turn's battles go by the battle part's shortcut (quicker). Taps are made with the mouse; a spot off the screen or under a panel gets the same tap sent to the map (the test does not pan the camera; the unit card is found by its heading). `TURN=only` skips the checks after the turn (while working on it), `VERBOSE=1` prints every action. **Dice, hit choices and retreats** (checked, but never against a fixed result, as dice differ each run): when a hit has to be chosen, the player has a row or button to choose with, and the two screens show the same dice record and the same hits (a screen that watches the other's roll draws them late, so they are compared when both have drawn them; the run prints how many were compared and how many not); a retreat played on a screen must land in one of the areas the screen offered. Battles of the turn are fought by hand until one hit choice has been played with the screen's own buttons, and a run of all three volumes fails if none was. Retreats are counted and printed, not required. **Still a note, not a check:** who wins a battle and who is cut off (dice); the steps of turns after the one played; the Breakthrough steps are only ended, not played. **Moves:** a move is steady now: a block that crosses a bridge only asks the other side whether it blows it, and the test counts that question as the move (the other seat answers in the turn loop). **Known, not fixed:** now and then (about 1 run in 4 on The Bulge) the Rules check holds back a change in a battle ("the German player changed the game while it was the Allied player's turn to act"), and once in a phone run the creator's screen stayed 30 seconds behind a battle that had begun; the test prints what the held change would change, to find the cause.

The players' chits are open information by the rules (assets and events are face-up), so there is no hidden "hand" to protect: only blocks.
