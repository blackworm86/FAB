# Design review: ease of use, clarity, usability (14 November 2026)

Asked for by the owner. A review only: nothing in the game was changed. Two helpers worked apart so neither coloured the other: one looked at the table with a player's eyes (126 fresh pictures of all three games, every phase, desktop 1380x860 and iPhone 13, plus the menus, the rules window and the first lesson; about 80 opened), one took measurements in the live page (sizes, small text, contrast, overlaps, keyboard). The project manager opened the pictures behind the main findings (marked ✔) and combined both with the two playtest reports.

## The result in one paragraph

**The table is solid and has its own character; what is weak is the moments where the player must decide.** Score 26 out of 40 on the ten standard usability checks ("acceptable, close to good"; most real products score 20 to 32). Nothing blocks play. The same four causes sit behind most of what the two playtests found: the screen does not say clearly **who must act now**, the **big choices are not where the main button is**, the **instruction line is not built from what is possible at that moment**, and **a newcomer is given the expert's version**. Fix those four and most of the small playtest items go away with them.

## Scores

| # | Check | 0–4 | Main weakness |
|---|---|---|---|
| 1 | You always know what is going on | 3 | The turn pill names whose turn it is, not who must act now |
| 2 | It speaks the player's language | 3 | One thing has four names (hand, card, chit, asset); SN, TDN, Point unexplained in place |
| 3 | You can back out | 3 | Good labelled Undo; it locks after dice |
| 4 | Things work the same everywhere | 2 | The control that moves play forward changes place and colour by moment |
| 5 | Mistakes are prevented | 3 | Some greyed buttons give no reason; cancel-battle X sits beside "Show all" on the phone |
| 6 | You recognise, not remember | 2 | Chits are symbols captioned "9th", "402nd"; phone top bar is icons only |
| 7 | Fast for experts | 2 | One press per empty step and per roll; no keys for cards or chips |
| 8 | Nothing superfluous | 3 | Desktop top bar about 10 items; battle strip about 11 small chips |
| 9 | Errors are explained | 2 | Reasons come as short pop-ups that cover things; some refusals say nothing |
| 10 | Help is at hand | 3 | Rules window and lessons are good, but two taps deep |
| | **Total** | **26 / 40** | |

## What works (keep it)

1. **Every number comes with its reason.** The dice list shows the unit, its Success Number, each die in colour and the chips that made the number ("+5 base, −1 armor, +1 quality, −1 terrain"); the hit box says "2 rolled − 1 absorbed by field works".
2. **The red button says what it will do**, and never guesses: "Next battle: Udenbreth", "Place 11 more first", "End anyway? 19 can move", "Undo: Assets done".
3. **Learning is built in**: story-led lessons with their minutes, and a searchable rules window that slides over the table.
4. **Measured:** on the phone every control on the table is at least 44 px except one link; no control lacks a name for screen readers; Escape closes every panel (60 of 60 tries); no sideways scrolling of the page; text contrast on the table is fine.

## The problems, worst first

### 1. Who must act now is not shown (major) ✔
The pill at the top keeps the name of the side whose turn it is while the *other* side must act: the second half of Admin, Reaction, the defender's battle step, taking hits. Picture `golan73-desktop-20-battle-7.jpg`: the pill says "T1 · ISRAELI · REACTION", the line says "Syrian reserves may react". The only cue is the first word of a small line. On one shared screen this is the moment the device changes hands; online it is "is it me?".
**Proposal:** keep the pill for the turn, and add one signal that never moves for the acting side (the bottom bar's edge in that side's colour, with "SYRIAN DECIDES"), plus a one-line "Pass to the Allied player" strip each time the actor changes, until the first tap.
*Explains playtest items C3, C7, 14 and half of C2.*

### 2. The big choices are not where the main button is (major) ✔
At "Take losses / Retreat" the red button disappears, the bar says only "Choose how to take the hits", and the two choices are small olive buttons at the top of the screen (`bulge-phone-20-battle-7.jpg`). On a phone that is the far end from the thumb, and the thumb's zone is empty. The same happens in Golan's set-up (the button that matters is in a side panel) and in the block card.
**Proposal:** whenever the red button has nothing to do, the bar carries the choices as two equal buttons ("Take losses: −1 step", "Retreat: 1 hit fewer"); the box on the map stays as the explanation.
*Explains B3, A5.*

### 3. The instruction line says things that are not possible (major) ✔
"Allied defends: click a card to add it" with no card on screen; "Click a green area" for a block that cannot move (`bulge-desktop-21-can-move.jpg`: Peiper is a reserve unit, nothing is green). The line is written by hand for each phase, separately from the lists that feed the chips and the button; only The Bulge's Admin checks whether the hand is empty.
**Proposal:** one rule in every phase: the line is built from the same counts as the chips. No cards: "No cards to add: press Done". No destinations: "This block cannot move: (reason)".
*Explains C2, C3 on Golan, items 5, 9 (partly), 10, 16.*

### 4. A newcomer gets the expert's version (major)
Explanations start on "short" ("Click a green area · brass = stop"); the switch is an "i" with no label; the lessons are under Menu › Help; chits in the hand are symbols with regiment numbers; "EXPECTED HITS AL 0.7 : 1.6 GE" has no words. The first screen a new player can meet is "MUST FIGHT 8" beside a red button.
**Proposal:** full explanations by default until a lesson is finished or the player switches; label the switch "Explain: full / short"; caption chits by kind ("Artillery · 9th"); on a first table with no lesson done, one card: "New to FAB? Your first turn, 22 min / Just play".

### 5. Battle set-up on the phone is cramped and partly cut (annoying) ✔
`sicily-phone-13-battle-0.jpg`: the hand runs off both edges and under the bar, the ARTY / AIR / ASSET tags sit over the card names, four tools are bare icons (the X that cancels the battle is 4 px from "Show all"), and "battle 1 of 8" is missing. On Golan's desktop a hand of 20 cards is cut at the right edge and cannot be scrolled (measured).
**Proposal:** one sideways-scrolling row of whole cards with the kind above each card, labelled tools, the cancel X apart from the others, an "n of m" marker.
*Explains C10, item 18.*

### 6. Places named in instructions cannot be found on the map (annoying) ✔
Golan and Sicily open with no area names and block faces too small to read (`golan73-desktop-20-battle-7.jpg`), while the button says "Next battle: Licata". The map button reads "MAP: NONE · LABELS ON".
**Proposal:** always label objective areas and any area named in the current instruction, at every zoom; rename the button "Map layers".
*Explains item 13.*

### 7. Results are flat and empty steps cost a press each (annoying)
"Battle over" looks like any other roll and states the result up to three times. Supply, Strategic, Reaction and Breakthrough often show "nothing to do" and still need one press each; every roll needs a "continue".
**Proposal:** one headline in the winner's colour ("Syrians hold Tel Saki") with the list under it. For empty steps, keep the press (your rule: nothing happens by itself) but let one button name the run: "Nothing to do in Strategic, Reaction, Breakthrough: go to Supply". **This one is your decision.**

### 8. Messages cover the thing they are about (annoying)
Pop-ups over panel buttons, the coach card over the panel it explains, the drop-zone panel over the drop zone. One missing rule: *a message never covers the control it is about*. Reasons belong in the bar, not in floating pop-ups.
*Explains B7, C1, items 15, 17, 21.*

## Smaller things

- Small text on the phone: 10–11 px for "What the markers mean" (also the only tap target under 44 px: 14 px high), the block card's subtitle, "expected hits", the first line of the pill. On the home page: 9–10 px captions on the covers.
- The left tag of the points gauge is olive in every game ("IS" though Israel is blue, "AX" though the Axis is orange).
- The score "ALLIED +11" in olive right after "T1 · GERMAN" reads like whose turn it is.
- View panel: "2D" selected but the text describes the relief (playtest item 14, still there).
- Golan's Pieces window: "To be placed" captions overlap.
- The red button moves about 40 px between one-row and two-row bars.
- Keyboard: 19 to 28 Tab presses to reach the main button in a battle (after every card); "?" works but is not listed among the shortcuts; in the helper's run Escape did not close the Map legend.
- "CTRL" for Control on the phone; "Labels: see-through".
- The disabled "Place 11 more first" button is slightly under the contrast guideline (4.2 against 4.5).

## For three kinds of player

- **A newcomer:** meets "MUST FIGHT 8", chits called "9th", POINT tags before any choice, a red "Done · Allied acts" although playing a card was optional, and lessons two taps away.
- **One hand on a phone, interrupted:** the hit choice is at the top; the block card covers the selected block; on coming back, "what just happened" exists only in Menu › Log.
- **An experienced FAB player:** a press after every roll (three or four per battle, eight battles), Auto-fill pressed in each battle, one press per empty step, 42 blocks cycled one by one, no keys for cards.

## What was not checked

- The real home page was measured from an older build, not looked at as a design; the victory screen, a retreat, the dice animation, online play, Italian, tablets and landscape were not reviewed.
- "Reachable areas are hard to see" was raised by the helper but its pictures used a block that cannot move; it needs two minutes of a person clicking a block on Golan and Sicily (pale maps) before anyone acts on it.
- The automatic checker found nothing in the source and only decorative items in the page (the red button's edge, the glow on playable cards): both are the design, not faults.

## Proposed order of work (interface session; a mockup first for 1, 2, 4 and 5)

1. Problems 1 and 2 together: "who acts" and "choices in the bar" are one redesign of the bottom bar.
2. Problem 3: the instruction line built from what is possible (no new look, low risk).
3. Problem 8: reasons into the bar, nothing covers its own control.
4. Problem 4: the newcomer's start.
5. Problems 5 and 6, then 7 after your decision, then the smaller things.
