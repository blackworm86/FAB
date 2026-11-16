# Design review, re-score (16 November 2026)

Same method as on 14 November (`docs/design-review-2026-11-14/README.md`): two helpers apart, one looking with a player's eyes (142 fresh pictures of the three games, desktop and phone, plus Nuts!, the admin tools and Italian), one measuring (sizes, small text, contrast, overlaps, keyboard, the design checker). The project-management session opened the pictures behind the main findings (✔).

## Score: 27 / 40 (was 26)

The battle moments are much better; what holds the score down is moving pieces (destinations you cannot see), the phone map, and a few places the new rules have not reached yet.

| # | Check | 14 Nov | 16 Nov | Main weakness now |
|---|---|---|---|---|
| 1 | You always know what is going on | 3 | 2 | "Click a green area" with no green area visible when a block is selected (The Bulge) |
| 2 | It speaks the player's language | 3 | 3 | "AL +11", "TDN", "SN", "Full" still unexplained in place |
| 3 | You can back out | 3 | 3 | Undo, Call off, Deselect, Esc all work |
| 4 | Things work the same everywhere | 2 | 2 | the hit choice still has a floating box while losses use a list; set-up has no "X decides" tag |
| 5 | Mistakes are prevented | 3 | 3 | Done stays grey until a choice; greyed rows say why |
| 6 | You recognise, not remember | 2 | 3 | cards named by kind now; phone top bar still bare icons |
| 7 | Fast for experts | 2 | 3 | chips cycle blocks, suggested order, one press for empty steps |
| 8 | Nothing superfluous | 3 | 2 | the hit count said three times; long text on the phone |
| 9 | Errors are explained | 2 | 3 | reasons in place, not in pop-ups |
| 10 | Help is at hand | 3 | 3 | lessons still two taps deep |

## The 14 November problems

| 14 Nov problem | Now |
|---|---|
| 1 Who must act now | **Solved** ("X decides", side-coloured bar, pass strip) |
| 2 Big choices away from the main button | **Solved** (choices in the bar, suggested order) |
| 3 Instruction asks for impossible things | **Partly** ("Click a green area" with nothing green; "click a card" while the In battle tab is open) |
| 4 Newcomer gets the expert version | **Partly** (full explanations by default, cards named; lessons still under Menu › Help) |
| 5 Phone battle set-up cramped | **Mostly solved** (tabs, labelled Call off); the "i" on cards overlap the next card |
| 6 Places named cannot be found | **Solved on desktop; worse on the phone** (labels pile up at the opening zoom in Golan) |
| 7 Flat results, a press per empty step | **Partly** (one press passes empty steps) |
| 8 Messages cover what they are about | **Still there** (a "Field works removed" message over a block; the phone block card over the selected block) |

## Priority issues now, worst first

1. ✔ **You cannot see where a selected block can go (The Bulge).** The bar says "Click a green area"; nothing is green; only the movable blocks glow lime, and the selected block looks like the others (`bulge-desktop-no-green-destinations.jpg`). Fix: clear destination areas (outline + tint + cost badge); the selected block its own brass mark; lime used for one meaning only. *Seen in software 3D: worth one click by a person in a normal browser.*
2. ✔ **The phone map is crushed.** Golan opens zoomed out with area labels piled on top of each other (`golan-phone-labels-pile-up.jpg`); Sicily and Nuts! leave an empty band; the block card covers the selected block. Fix: open the phone camera on the playing area, thin the labels when zoomed out, a one-row block card with the camera panned above it.
3. ✔ **The hit choice still floats and repeats itself.** A "2 hits · choose in the bar below" box with a leader line over the battle, the report "2 hits to take", and the button "lose 2 steps" (`bulge-desktop-hit-box-floating.jpg`). Fix: remove the box, as already done for losses (`bulge-desktop-loss-list.jpg`), say the count once.
4. **Golan and Sicily special decisions** (SAM, jamming, counterbattery, dogfight, airborne, morale) still carry their own panel blocks in the code; check that every one now sits in the tray above the bar and answers in the bar.
5. ✔ **The score strip reads like code.** "AL +11", "AL 0 : GE 0 −10 = −10" right after the turn pill (`nuts-desktop-score-strip.jpg`). Fix: words first ("Allied lead by 11"), arithmetic in the window it opens.
6. **The asset switch has no timing** ("when does the engineer remove the field works?"): one short line under each half, or in the (i). *The owner asked on 15 November for no explanation text in the switch itself: this is for him to decide.*
7. **Small:**
   - **Italian:** the admin button reads "Amministrativa" (the Admin Phase's word); it should be its own word, e.g. "Strumenti".
   - **Phone step name:** the measurements found "MOVEMENT"/"COMBAT"/"COMBATTIMENTO" still cut with "…" on an iPhone 13. The fix of 15 November should be checked again on a real phone.
   - **Keyboard:** in a battle, 28–55 Tab presses to reach the main button (every card first).
   - **Phone cards:** the "i" on cards are 24–31 px and half covered by the next card.
   - **Labels under the icon buttons** (Undo, Call off, Full) are 10 px.

## Measurements (unchanged or better)

- No sideways scrolling, no unnamed buttons, no fixed bars overlapping, every focus visible, Escape closes every panel.
- Contrast: nothing under 4.5:1 found, also on the see-through panels over the map.
- On the phone, the only tap target under 44 px outside a battle is "What the markers mean".
- The design checker found nothing in the code, and in the page only the card glow and the red button's edge, which are the design.

## What was not checked

- The real home page (the dev server opens a table).
- The battle-over and victory screens.
- Golan's SAM and jamming, and Sicily's airborne, live.
- Online play.
- A person's hands on a real phone.
