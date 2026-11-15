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
- **Invitation**: a link `…?table=<id>` (share button), or the id typed in "Invite link or code" on the home page.
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

## 6. Faults

### Found by the two-browser test and fixed (15 November 2026)

- **A player's own block turned into a blank after a battle, for good.** When a shown block is hidden again it gets a new code, and its owner's private record counts which code is current. That count was never saved to the database (only in the two-tab development table, which is why nobody saw it). From then on the owner's own browser no longer recognised the block: it showed as "Hidden block", and at the next save its real details were overwritten. Very likely the owner's "figures staying blocks" and part of "losses and retreats online". Fixed in `store-rtdb.ts` (the count is saved and read back).
- **A slow start turned a shared table into a local one.** If the database was not reached within 15 seconds (a slow phone, a busy device), the page gave up and showed a table that lives only in that browser, at the invitation's address, with nothing saying so: a strong candidate for "the test table" of issue #2. Now a page opened with a game code keeps waiting and says "Still connecting to the game…". *Still open*: when online play cannot start at all, a page with a game code must show that plainly instead of a playable local table.

- **Moves made at the same moment were lost** (issue #3, "the two screens conflict"; the test lost 2 moves of 8). A move was written as its difference from the *newest* game received, so a move worked out a moment earlier put the other player's fresh change back. A move is now written as its difference from the game it started from, and a waiting move goes out before arrivals are shown. Still true: if both change the *same* value at once, the later write wins.
- **The connection dot** (issue #3) now follows the connection itself: amber "no connection" as soon as the device is cut off, green again when it is back. A save that failed is tried again by itself (up to five times, 3 seconds apart) instead of leaving the dot red until the next move. Moves made offline are sent on return without undoing the other player's.

### Seen in the test, not fixed yet

- Right after sitting, the joiner's first entry in the replay record is refused (the database does not know the seat yet, same cause as the private record in `edec14c`): one replay step of that seat's blocks is missing.
- A block that fought stays readable by the other side while it stands where it was shown, even after the enemy has left the area and the rules turn it face-down again (the honest screen draws it face-down; the data is there). The reveal is withdrawn only when the block moves. Low: it is what a player with a good memory knows.

### Read from the code, not yet reproduced

1. **A code that matches no game.** A typed code opens `?table=<code>` with no check that the game exists; the page then waits on an empty table with nothing saying "no such game". A link without `?table=` uses the built-in name `main`.
2. **A typed code always opens as The Bulge first**, then reloads as the right volume once the game arrives: a visible flash, and one more place to get stuck for Sicily and Golan.
3. **Retries end after 10 seconds** for the joiner's private record (20 × ½ s). On a very slow connection the joiner's blocks could stay hidden until a reload.
4. **Online play that cannot start at all** (database not set up or unreachable for good) on a page with a game code: the page should say so plainly; today it can still show a playable local table.

## 7. Tests that exist today

- `tools/rules-test` (needs Java): the database rules, with the app's own create / sit / move / leave writes.
- `engine/test/split.test.ts`, `audit.test.ts`: hidden blocks and the Rules check, with two seats played in one process (no network).
- **`cd web && npm run online`** (`web/e2e/online.mjs`, needs Java and `npm ci` in `tools/rules-test`; it starts and stops its own emulators and dev server, never the real project): two accounts, one desktop and one phone screen, register on the home page; for each volume one creates a game, the other types the code and sits; the invitation shows the code and a QR code; they fight battles from both seats (set-up, point units, dice, hit choices, losses, retreats); both move at the same moment several times; one loses the connection, both move, it comes back; the second player reloads. After every step it checks that the two screens show the same game, that nothing is unsaved or held back by the Rules check, and that no hidden block of one seat is on the other screen or in the stored game. The turn's steps before combat are skipped with a shortcut (the seat to act jumps to its Combat Phase), so reinforcements, movement and supply online are **not** covered yet.

The players' chits are open information by the rules (assets and events are face-up), so there is no hidden "hand" to protect: only blocks.
