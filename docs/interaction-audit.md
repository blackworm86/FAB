# Interaction audit: every decision on the table, and one way to handle them

15 November 2026. Written for the owner. No code was changed.

The owner said: windows, buttons and information jump around the screen; similar things look different and sit in different places; the three ways Sicily removes field works feel different although the logic is the same; picking the block that takes a loss is clumsy and the wrong piece gets tapped.

Part 1 lists every decision a player meets, where it shows and how it is answered. Part 2 marks the pairs that do the same job in different ways. Part 3 proposes one system for all of them, with two worked examples and mockup pictures.

Pictures are in `docs/interaction-audit/`. `-d` is desktop (1380 × 860), `-p` is an iPhone 13. They were taken from the sandbox on 15 November with the current code.

---

## Where things can appear today

There are **nine different places** a decision or its explanation can show up. Their names in the code are in brackets.

| # | Place | Where on the screen | Used for |
|---|---|---|---|
| 1 | **Bottom bar** (`c-bar`) | Bottom, always there | The question line, Undo, Call off, the red main button, Explain. Sometimes two choice buttons. Sometimes chips such as "Can move 19". |
| 2 | **Hand** (`c-hand` with tabs) | Just above the bar | Battle cards and chits, with the tabs Usable / Not usable now / other hand. |
| 3 | **Battle header** (`c-table`) | Top of the map, full width | Area name, expected hits, arty and asset counts. It also holds the Bulge engineer choice and the defender's Special Action buttons. |
| 4 | **Side panels** (`volstack` / `volpanel`) | **Right** side on desktop. On a phone they fold into a floating pill (for example "→ SAM FIRE") over the map | Every Sicily and Golan special decision: naval support, Rangers, SAM, jamming, airborne drop, set-up, dogfight, counterbattery and more. |
| 5 | **Block or chit card** (`c-dispatch`, `chitbar`) | **Left** side on desktop, bottom half on a phone | The selected block (Reserve, Fortify, Skip), the selected chit (rules, modes, targets), the Bulge supply check. |
| 6 | **Map bubble** (`mapbubble`) | Floats next to the battle area, with leader lines | The hit count, "Choose in the bar below ↓", the loss count and its **Suggested** button. |
| 7 | **Battle report** (`c-ledger`) | Right side above the bar on desktop, full width above the bar on a phone | Dice, "1 hit to take", the exploitation **Decline** button, the bridge-blow question, and the engineer choice again during offensive fire. |
| 8 | **Message** (`barmsg` in the bar, `toast` when a sheet is open, effect pop-ups on the map) | Inside the bar, or floating | Short news ("−1 step", refusals). |
| 9 | **Sheet** (`modal`) | Centre, covers the table | Which Special Action, the air mission's use, the Alternate use pick. |

On top of these the map itself is a place to answer: tapping an area or a block.

---

## Part 1. The inventory

For each decision: what the player decides, where it shows, what he taps, how the phone differs, and which file draws it.

### A. Battles (all three games)

| Decision | Where it shows | What the player taps | Phone | Drawn by |
|---|---|---|---|---|
| **Add battle cards (set-up)** | Hand above the bar, with tabs; an ⓘ on each card | A card: it moves next to the area, with a ✕ to take it back. Then **Assets done** (red, bar) | Same, the fan is cropped at the edges and the ⓘ circles overlap the next card | `battle-view.ts` handCards, `cards.ts` |
| **Point unit** | Map | A block in the battle. It gets the thick gold border (approved) | Same, blocks are small | `map-input.ts`, `pieces.ts` |
| **Call off the attack** | Bar (✕ Call off) | ✕ | Same | `render.ts` cancelSq |
| **Defender: Retreat or Reinforce by Special Action** | Battle header, behind a "Special Action…" toggle | Toggle, then **Retreat (SA)** or **Reinforce (SA)**; Reinforce then asks for a block on the map; if more than one SA counter fits, a centre sheet asks which | Same, header grows | `battle-view.ts` saRow, `choices.ts` pickSA / saPickHtml |
| **Air mission in a battle** | Centre sheet | **Extra artillery** or **+2 to one unit**, then a block on the map | Same | `choices.ts` airPickHtml |
| **Attacker hit: Take losses or Abort** | Two buttons in the bar; the map bubble shows the count and "Choose in the bar below ↓"; the report repeats "German 1 hit to take" | A bar button | The bubble covers the top of the area; the report takes a third of the screen | `map-marks.ts` barChoices, decisionBubble; `battle-view.ts` ledger |
| **Defender hit: Take losses or Retreat / Disorder** | As above | A bar button | As above | Same |
| **First loss of a failed attack (point unit or one asset)** | Map bubble "Tap the point unit or an asset"; green rings round the candidates; **nothing in the bar** | A small block or asset on the map | Rings overlap; the asset sits at the area's edge | `map-marks.ts` decisionTargets (stage `attFirst`), `pieces.ts` rings |
| **Place each step loss** | Map bubble "3 losses · Tap a glowing block or asset" with a **Suggested** button inside the bubble; green rings; **nothing in the bar** | A small block on the map, or Suggested in the bubble | Rings touch each other; bubble covers the area | `map-marks.ts` decisionTargets (stage `loss`), `pieces.ts` |
| **Retreat area** | One or two areas: bar buttons "Retreat to X". Three or more: lit areas on the map, question in the bar | A bar button, or an area | Same | `map-marks.ts` barChoices, `map-input.ts` |
| **Exploitation morale check (6.8)** | Battle report with a **Decline** button; the roll is the red bar button | Roll (bar) or Decline (report) | Same | `battle-view.ts` ledger |
| **Blow the bridge? (Bulge)** | Battle report area with two buttons (one brass) | **Let them cross** / **Attempt to blow it** | Same | `render.ts` alert |

Pictures: set-up ![](interaction-audit/bulge-battle-setup-d.jpg) ![](interaction-audit/bulge-battle-setup-p.jpg)

Attacker's choice: the count is said three times (bubble, report, button). ![](interaction-audit/bulge-attChoice-d.jpg) ![](interaction-audit/bulge-attChoice-p.jpg)

Defender's choice; on the phone the bubble covers the blocks. ![](interaction-audit/bulge-defChoice-d.jpg) ![](interaction-audit/bulge-defChoice-p.jpg)

The hand-over strip (approved) appears before each of these. ![](interaction-audit/bulge-pass-strip-d.jpg) ![](interaction-audit/bulge-pass-strip-p.jpg)

First loss and step-loss placement: the bar is empty, the Suggested button is in the bubble, the targets are small green rings. On the phone two rings touch. ![](interaction-audit/bulge-attFirst-d.jpg) ![](interaction-audit/bulge-loss-d.jpg) ![](interaction-audit/bulge-attFirst-p.jpg) ![](interaction-audit/bulge-loss-p.jpg)

Retreat with two areas lit on the map. ![](interaction-audit/bulge-retreat-d.jpg) ![](interaction-audit/bulge-retreat-p.jpg)

### B. "Use this asset for something else instead of firing"

| Decision | Game | Where it shows | What the player taps | When it happens | Drawn by |
|---|---|---|---|---|---|
| **Engineer: fire, or remove the field works (6.33)** | Bulge (and Sicily engineers, same code) | **Battle header, top**, with a long paragraph. Shown again in the **battle report** during offensive fire | Two buttons: "Fire with the ground units" / "Remove the field works" (brass border = chosen) | Set-up, up to offensive fire. Works if it survives artillery and defensive fire, just before your units fire | `battle-view.ts` engChoice |
| **Naval support: Shock and Awe or artillery (16.21)** | Sicily | **Right side panel**; on the phone a pill "→ Naval support…" over the map. A "Shock and Awe" chip is also added to the header | Two buttons: "Remove the field works" / "Fire as artillery" (thin border = chosen) | First act of the battle, instead of firing; coastal areas only | `sicily-ui.ts` sicilyPanel "Naval support" |
| **Rangers or Commandos remove the field works (16.22)** | Sicily | **Right side panel**, under the naval one | **One button per asset**, named after it ("3rd CDO"); pressed = it removes them | Instead of rolling, if the attack goes on and it survives defensive fire | `sicily-ui.ts` "Rangers (16.22)" |
| **Engineer bridges the AT ditch (14.51b)** | Golan | Right side panel | One button per direction, "towards X" | Instead of firing, if it survives both fire steps | `golan-ui.ts` golanPanel |
| **Artillery gives direct support (optional 18.32)** | Golan | Right side panel | One button per artillery, its label flips "firing" / "supporting" | Instead of firing | `golan-ui.ts` |

Sicily, one battle, three assets that can remove the same field works: **three different components in two places** (engineer at the top with two buttons, naval on the right with two buttons, the commando on the right with one button named after it). ![](interaction-audit/sicily-fw-removers-d.jpg)

On the phone the engineer paragraph fills the top, the naval choice is folded into a pill over the map, the Rangers panel is hidden behind it. ![](interaction-audit/sicily-fw-removers-p.jpg)

The Bulge engineer alone. ![](interaction-audit/bulge-engineer-d.jpg) ![](interaction-audit/bulge-engineer-p.jpg)

### C. Answers to the other player

| Decision | Game | Where | Taps | Drawn by |
|---|---|---|---|---|
| **SAM answer to an air mission (16.12)** | Golan | Right side panel; phone: pill "→ SAM FIRE". **The bar meanwhile says "Tap a red area… Next battle"**, which is not the question | **Fire a SAM (5 ready)** / **Let it fly** (both brass) | `golan-ui.ts` golanPanel |
| **Jamming answer (17.33)** | Golan | Right side panel | **Roll without countermeasures** (or play the EW card from the hand) | `golan-ui.ts` |
| **Counterbattery target (17.34)** | Golan | Right side panel | One button per enemy artillery, "✓" in front of the chosen one | `golan-ui.ts` |
| **Dogfight (16.31)** | Sicily | Right side panel | **Dogfight** | `sicily-ui.ts` |
| **Blow the bridge** | Bulge | Report area above the bar | Two buttons | `render.ts` |
| **Defender Special Action** | All | Battle header | Toggle, then buttons | `battle-view.ts` |

SAM, desktop and phone. ![](interaction-audit/golan-sam-d.jpg) ![](interaction-audit/golan-sam-p.jpg)

The jamming answer was not pictured (the sandbox could not reach that step in time); it uses the same right-side panel as SAM.

### D. Placing things by choosing an area

| Decision | Game | How it starts | Then | Drawn by |
|---|---|---|---|---|
| **Airborne drop (14.27a)** | Sicily | Right panel per division, "Choose the drop zone" (also copied as the red bar button) | Lit areas on the map; the bar says "click elsewhere to cancel" and the red button turns grey "Drop the airborne first". No ✕ | `sicily-ui.ts` sicilyPanel, `pickArea` |
| **82nd Para air assault (15.3)** | Golan | Right panel, "Choose the landing area" | Lit areas | `golan-ui.ts` |
| **Commando landings (20.35)** | Golan | Right panel | Lit areas | `golan-ui.ts` |
| **Division release (event chit)** | Sicily, Bulge | Tap the chit: left chit card | Lit entry areas | `chit-play.ts` targetsFor, `cards.ts` |
| **Purple Line release (15.2)** | Golan | Right panel with unit chips | Tap a chip, then a lit area | `golan-ui.ts` |
| **Retreat (three or more areas)** | All | Question in the bar | Lit areas | `map-input.ts` |

Airborne: two panels on the right and the same "Remove 82nd Airborne" in the panel and in the bar. Then the pick, with no cancel button. ![](interaction-audit/sicily-airborne-d.jpg) ![](interaction-audit/sicily-airborne-pick-d.jpg) ![](interaction-audit/sicily-airborne-p.jpg)

### E. Chits in the Admin Phase

| Decision | Where | Taps | Drawn by |
|---|---|---|---|
| **Pick a chit to play** | Hand above the bar, or the bar chip "Playable chits 3" which jumps to the next one | A card | `dock.ts` dockChips |
| **What the chit does, and where** | **Left** chit card: picture, one line, ⓘ, ✕, mode buttons (icons), chips, buttons; targets glow on the map. The Bulge also prints extra rows inside the card; Sicily and Golan only use glowing targets and buttons | A mode, then a glowing area or block, or a button | `flow.ts` chitBar, chitPanel; `chit-play.ts` targetsFor; `sicily-ui.ts` sicilyTargets; `golan-ui.ts` golanTargets |
| **Alternate use (4.21)** | Button in the chit card, then a centre sheet | Two eliminated assets | `choices.ts` altPick |
| **Fading Italian Morale picks (17.21c)** | Right side panel, one plain button per asset | A button | `sicily-ui.ts` |

![](interaction-audit/bulge-admin-d.jpg) ![](interaction-audit/bulge-chitbar-d.jpg) ![](interaction-audit/bulge-admin-p.jpg) ![](interaction-audit/bulge-chitbar-p.jpg)

### F. Blocks: reserve, fortify, breakthrough, supply

| Decision | Game | Where | Taps | Drawn by |
|---|---|---|---|---|
| **Reserve / Remove reserve / Fortify / Skip** | Bulge (all games in movement) | **Left** block card. The bar also has chips "Fortify 8" and "Reserve 7" that cycle through blocks | Card buttons, or the chips | `unit-card.ts`, `dock.ts` dockChips |
| **Reserve markers at set-up** | Golan | **Right** side panel, "Mark a unit as reserve", then an area | Button, then area | `golan-ui.ts` |
| **Breakthrough (SA)** | Bulge | Block card button "Activate (SA)", plus a bar chip | Button | `unit-card.ts`, `dock.ts` |
| **Supply check and Air Supply** | Bulge | **Left** card "Supply check" with the list and an air-supply row | Roll (bar), area rows | `unit-card.ts` |
| **Air supply** | Sicily | **Right** side panel, then an area | Button, then area | `sicily-ui.ts` |

![](interaction-audit/bulge-unitcard-d.jpg) ![](interaction-audit/bulge-unitcard-p.jpg)

### G. Set-up panels

| Decision | Game | Where | Taps | Drawn by |
|---|---|---|---|---|
| Strongpoints and ghosts, minefields | Golan | Right side panels and a tray of blocks above the bar; "Shuffle all 11 face-down" is both a brass panel button and the red bar button | Drag from the tray, or a button | `golan-ui.ts` |
| Garrisons, landing plan, invasion units | Sicily | Right side panels and the tray; "Place the rest for me" also in the bar | Drag, or a button | `sicily-ui.ts` |

![](interaction-audit/golan-setup-d.jpg) ![](interaction-audit/golan-setup-p.jpg) ![](interaction-audit/sicily-setup-d.jpg) ![](interaction-audit/sicily-setup-p.jpg)

---

## Part 2. Same job, different handling

| The job | How it is done today | What differs |
|---|---|---|
| **1. Use an asset for something else instead of firing** | Bulge/Sicily engineer: header, two buttons, long paragraph. Sicily naval: right panel, two buttons in the reverse order, plus a header chip. Rangers/Commandos: right panel, one toggle per asset. Golan engineer: right panel, one button per direction. Golan direct support: right panel, the label flips | Five components, two places (top, right), three ways to show "chosen" (brass border, thin border, label text), timing written in four different styles, the phone hides two of them behind pills |
| **2. Choose who takes a hit** | Take losses / Abort / Retreat: bar buttons. First loss and each step loss: small green rings on the map, the count in a bubble, **Suggested** inside the bubble, nothing in the bar | The same kind of question is answered in the bar one moment and on tiny map targets the next; the shortcut button moves from the bar into a floating bubble |
| **3. Answer the other player** | SAM and jamming: right panel. Bridge blow: report area. Defender SA: header, behind a toggle. Dogfight: right panel | Four places; during a SAM answer the bar shows an unrelated question |
| **4. Pick one counter from several** | Special Action and air use: centre sheet. Italian morale: right panel buttons. Counterbattery: right panel buttons with "✓". Alternate use: centre sheet | Two components, two places, three ways of marking the choice |
| **5. Pick an area after a button** | Airborne / air assault / commando landings: right panel button, then the map; the cancel is "click elsewhere". Retreat: bar buttons or map. Division release: chit card, then map | Cancel differs (✕ in the bar, tap elsewhere, ✕ on the chit card) |
| **6. Reserve and fortify** | Bulge: left block card **and** bar chips. Golan set-up reserves: right panel | Left versus right, and two controls for one action in the Bulge |
| **7. Supply and air supply** | Bulge: left card. Sicily: right panel | Left versus right |
| **8. The main step button** | When a panel has a primary button, the bar copies it (Golan "Shuffle all", Sicily "Place the rest for me", "Remove 82nd Airborne") | The same action is shown twice, once brass, once red |
| **9. The number of hits** | Bubble "1 hit", report "German 1 hit to take", button "lose 1 step" | Said three times on one screen |
| **10. Colour of "you can tap this"** | Loss targets use the light green of "reachable area"; the bubble adds dashed brass rings on the same pieces | One colour, two meanings; two marks on one piece |
| **11. "Chosen"** | Brass border (engineer), thin brass border (naval, Rangers), "✓ " in the text (counterbattery), label text (direct support), brass fill (hand tab) | Five ways |
| **12. Explanations** | Engineer: a long paragraph always shown. Naval: a sentence that changes with the choice. Rangers: one fixed sentence. Others: in the Explain mode only | No one rule for when the long text appears |

### The five biggest inconsistencies

1. **Field works removal: five components for one idea.** Engineer at the top, naval and Rangers on the right, Golan's two on the right again, each with its own buttons and way to show the choice.
2. **Choosing who takes a hit moves between the bar and tiny map targets.** Take losses / Abort / Retreat are bar buttons; the next step (which block) has nothing in the bar, small green rings that touch on a phone, and the Suggested button inside a floating bubble.
3. **Decisions live in nine places, left and right.** Block and chit cards on the left, Sicily and Golan panels on the right, the engineer at the top, bubbles near the area, sheets in the centre. On a phone the right panels fold into a floating pill.
4. **The bar does not always ask the real question.** During the SAM answer it says "Tap a red area… Next battle"; during step losses it says nothing; during an area pick there is no ✕.
5. **Things said twice or three times.** Panel buttons copied into the bar, the hit count in bubble, report and button, the Fortify action in the card and in a chip.

---

## Part 3. One interaction system

### The rules (eight)

1. **One question at a time, always in the bar.** The bar's question line says what is being decided, in the deciding side's colour. It is never about something else.
2. **The bar holds every answer and the main button**, in the approved order: Undo □ · Call off ✕ □ · red main button and the second choice · Explain ⓘ □. Two or three choices at most. A "Suggested" shortcut is the red main button.
3. **The details of a decision live in one tray, just above the bar** (where the hand is now). The hand, an asset's uses, the list of pieces that can take a loss, the SAM answer, a set-up list: all in the tray. No side panels, no bubbles, no centre sheets during play. Phone: the same tray, scrolling, never higher than half the screen.
4. **The map is only for picking a place or a piece.** Every pick on the map is also a row in the tray, so nobody has to hit a small block. The map lights only what can be picked, in brass with the row's number.
5. **Nothing floats or moves.** Three fixed places: battle header at the top (facts only, no buttons), tray, bar. Effects (−1 step) may still appear beside a block and fade, as approved, because they are news, not decisions.
6. **One component for "this asset: use it in battle, or use it for X".** A row with the asset's picture and name and two halves: the normal use and the other use, each with its timing and requirement written under it. Used for every asset in every game.
7. **One way to pick who takes a hit: a list of the pieces.** One big row per piece that may take it (picture, name, steps before and after, why), the suggested one marked; pieces that may not take it yet are shown greyed with the reason. Tapping a glowing piece on the map still works.
8. **Say it once, mark it once.** One number in one place. "Chosen" is always brass fill with a ✓. Green stays for "can move there"; brass glow is "you can pick this".

What stays as approved: the battle-hand tabs (the tray uses the same tab strip), the bottom bar v4 order, the gold border of the point unit, the hand-over strip, the effect pop-ups. One change to the approved hand tabs: when a battle has assets with two uses, the tab strip gains one tab, **In battle**, that shows the uses (see example a).

### Worked example (a): the field works removers as one component

**The rule underneath.** In all four cases an attacking asset may do its normal job (fire) or, instead, remove the defender's field works (Golan's engineer bridges the ditch, the same shape). Only the timing and the requirement differ:

| Asset | Other use | When it happens | Requirement |
|---|---|---|---|
| Bulge / Sicily engineer (6.33) | Remove field works | Just before your units fire | It survives artillery and defensive fire |
| Sicily naval support (16.21) | Remove field works (Shock and Awe) | First act of the battle | Coastal area |
| Sicily Ranger / Commando (16.22) | Remove field works | Instead of its roll | The attack goes on and it survives defensive fire |
| Golan engineer (14.51b) | Bridge the AT ditch towards an area | Instead of firing | It survives both fire steps |
| Golan artillery (optional 18.32) | Direct support, +1 to the point unit | Instead of firing | — |

**What the player sees (desktop).** He adds the asset from the hand as today. If the asset has a second use here, the tray switches to the **In battle** tab: one row per asset in this battle that has two uses. Each row: picture, name, and a two-part switch, **Fire** | **Remove field works**, with the timing and requirement in small type under each half. The chosen half is brass with a ✓. When one asset already removes the field works, the other assets' "Remove" half is greyed with "already removed by Naval Support". The battle header shows only facts (area, field works, expected hits). The bar keeps its question and **Assets done**.

![](interaction-audit/proposal-uses-d.jpg)

**Phone.** Same rows, the switch below the name, full width, 48 px tall. The tray scrolls; the map keeps a strip at the top.

![](interaction-audit/proposal-uses-p.jpg)

**What the player taps.** One half of the switch per asset. Tapping an asset beside the area on the map opens its row. Keyboard: Tab to the switch, arrow keys between the halves, Enter.

**What changes from today.** The engineer paragraph leaves the header; the two Sicily panels and the Golan panels leave the right side; the "Shock and Awe" chip leaves the header (the switch already says it); the phone pill disappears; the same switch is used in all three games. The choice can still be changed until the step the rule names (the row stays open during the fire steps, as the engineer's does today in the report).

**Options and cost.**

| Option | What it is | Cost | Note |
|---|---|---|---|
| **A (recommended)** | The **In battle** tab in the tray, one switch per asset, as above | Medium: one new shared component; the five present ones are removed; `battle-view.ts`, `sicily-ui.ts`, `golan-ui.ts`, one CSS file | Fixes all five at once |
| B | Ask once, at the moment the asset is added (a two-button question in the bar), no tab | Smaller | Harder to change your mind later; the Rangers rule lets you decide late |
| C | Keep the right-side panel but use the same switch for all five | Smallest | Still left versus right and the phone pill |

### Worked example (b): placing step losses

**What the rule needs.** The owner of the losses places them one at a time: everyone takes one before anyone takes a second, the first block loss falls on the point unit (6.43), and after a failed attack the first loss is the point unit or one asset (6.41a). The engine already knows which pieces may take the next one and which order is suggested.

**What the player sees (desktop).** The bar asks: "Who takes the loss? Tap a row or a glowing piece, or take the suggested order." The red main button is **Suggested order**. The tray shows "Step loss 1 of 3" and one large row per piece: picture, name, "3 steps → 2" or "asset · removed if hit", a numbered brass badge. The suggested piece is first and outlined in brass. Pieces that may not take this loss yet are greyed with the reason ("not yet: the point unit takes the first block loss"). On the map the same pieces glow brass with the same numbers. No bubble.

![](interaction-audit/proposal-loss-d.jpg)

**Phone.** The rows are full width and at least 64 px tall: no more aiming at a block 30 px wide. The map strip above still shows the glows.

![](interaction-audit/proposal-loss-p.jpg)

**What the player taps.** A row (or the glowing piece, or **Suggested order** for all the rest). After each tap the list updates ("Step loss 2 of 3"), the block on the map turns to its new step, and Undo takes back the last one. Keyboard: arrows move along the rows, Enter takes the loss.

**What changes from today.** The bubble and its leader lines go; Suggested moves from the bubble to the red bar button; the green rings become brass glows with numbers (green stays "can move there"); the same list is used for the first loss of a failed attack (stage `attFirst`), for each step loss (stage `loss`), and for the defender's losses.

**Options and cost.**

| Option | What it is | Cost | Note |
|---|---|---|---|
| **A (recommended)** | The list in the tray, mirrored by numbered brass glows | Medium: a new tray view in `battle-view.ts`; `map-marks.ts` decisionBubble and the ring colour in `pieces.ts` change | Solves wrong taps on the phone for good |
| B | Keep tapping on the map but make targets bigger: spread the blocks apart and enlarge the rings | Small | Still small on a phone with four or more pieces |
| C | A centre sheet with the list | Small | Covers the map, so the player cannot see what he is hitting; against rule 3 |

### What the UI programmer must touch (for A + A)

- `web/src/battle-view.ts`: a tray view for **In battle** (asset uses) and for **step losses**; remove `engChoice` from the header and the report.
- `web/src/sicily-ui.ts`, `web/src/golan-ui.ts`: drop the naval, Rangers, engineer-bridge and direct-support panels; give each asset its two uses with timing and requirement (from the same engine calls: `setNavalShock`, `setRangerFw`, `setEngFw`, `setEngineerBridge`, `setDirectSupport`).
- `web/src/map-marks.ts`: `decisionBubble` goes for `loss` and `attFirst`; Suggested becomes the bar's main button (`barChoices` or `primary`).
- `web/src/pieces.ts` / `map-paint.ts`: target glow in brass with the row number, not `MAPC.ring` (the reach green).
- One CSS file at the end of the battle screens' CSS (cascade rule).
- The rest of the system (SAM, jamming, airborne and the other right-side panels into the tray and bar) is a second step, after the owner approves these two.

### The one question for the owner

Do you approve the **tray above the bar** as the single place for every decision's details (with the **In battle** tab added to the approved hand tabs), starting with the field works removers and the step losses as in the four mockup pictures?

Recommended answer: yes, A for both, then the other right-side panels in a second round.

---

Mockup source (not in the game): a standalone page kept in the session scratch folder; the four `proposal-*.jpg` pictures are taken from it.
