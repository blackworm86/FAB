# Tutorial script (draft for review)

An interactive tutorial built on the Play Book's Examples of Play (23.1–23.10). The examples are separate scenes ("the narrative is not continuous"), so the tutorial is a short chain of **lessons**, each loading its own position from the book, with the book's dice. A coach bubble says what to do and why; the target (button, block, area, card) glows; everything else is locked until the player does it. Each lesson ends with a one-line recap. The player can leave at any step and resume later.

Notation: **[tap X]** = the player must do it; *(auto)* = the coach does it while explaining; **UI:** = an interface lesson woven in.

## Lesson 0 · The table (1 min)
1. Welcome. "This is The Bulge, December 1944. You play the Germans first." *(camera flies over the front)*
2. **UI:** the top bar: steps of the turn (Prepare › Move › Fight › Breakthrough › Supply), turn and side. **[tap the step names]** to see what each does.
3. **UI:** the VP strip under it. **[tap it]** → VP sheet opens; close it.
4. **UI:** View: map layers (TDN, VP, names). **[tap View]**, turn on Terrain defence, close.
5. **UI:** the ⓘ button: short or full explanations. Keep full for the tutorial.

## Lesson 1 · Reinforcement (23.1)
Position: start of Turn 2, German Available/Used boxes as in Figure 1.
1. "Each turn starts by managing your resources." **UI:** the Pieces window. **[tap Pieces]** → Boxes: Available, Used, Cup.
2. Artillery attrition (16.12): **[pick the 408th]** to eliminate.
3. *(auto)* the Used Box goes back to the cup; the Special Action block and Turn 2 chits arrive. Recap.
4. Allied side, shown *(auto)*: Task Force placed in Houffalize [36]; 10th Arm, 7th Arm, 1st Inf (1 step) arrive. **UI:** the arrival tray: **[drag the 7th Arm]** onto lit entry area B.

## Lesson 2 · Admin: chits (23.2)
Position: Turn 2, German draws 9 (book result).
1. **UI:** the hand. "Glowing cards can be played now." **[tap Greif Team Bridge]** → chit bar opens; ⓘ shows the rule.
2. **[tap the Marnach–Lullange border]** to place it.
3. **[tap Non-Elite Infantry Replacement]** → **[tap 12 VG]** in Udenbreth: it gains a step.
4. Allied side *(auto)*: Delayed Response; engineers 35th and 168th blow four bridges around Ligneuville and Vielsalm. Blown-bridge markers appear.
5. **UI:** End prepare / Done between the two players.

## Lesson 3 · Movement (23.3, Figures 4–6)
Position: Prüm [4] with one infantry and one armour block, 2nd Pz in Marnach.
1. **UI:** select a block **[tap the infantry in Prüm]**: green areas = reachable, orange = must stop there; the route shows the cost.
2. **[tap Losheim]**: road 1 MP + 2 MP leaving its army zone → must stop. Recap: army zones.
3. **UI:** Undo **[tap Undo]**: "moves can be taken back until something is revealed or rolled".
4. **[move it into Bleialf]**: the Schnee Eifel ridge takes the whole allowance; armour may not cross at all.
5. Armour: **[move it via Pronsfeld, Lutzkampen to St. Vith]**: 3 MP, no fuel needed. Recap: roads, fuel over 3 MP.
6. River crossing: **[move 2nd Pz into Lullange]**: the Allied player tries to blow the Greif bridge (needs a 1, an engineer helps) *(book dice: blown)* → river assault, all MP spent.
7. **UI:** reserve: **[tap Pz Lehr]** → **[Reserve]**. **UI:** the Can move / Fortify / Reserve shortcuts.

## Lesson 4 · Strategic movement (23.4, Figure 7)
Position: Allied Turn 3, 82nd at Givet [96] with a 5/6 reserve marker, 101st at La Chapelle [87] with a Zone 7 marker.
1. "Reserve units can strat-move through friendly, uncontested areas." **[tap 82nd]** → **[tap La Roche]**.
2. **[tap 101st]** → **[tap Champlon]**. Recap: limits (3 Allied, 1 German + fuel).

## Lesson 5 · Combat (23.5, Figures 8–9)
Position: St. Vith [23]: 18 VG attacking 106 Inf + garrison; CCB/9 in Ligneuville.
1. **UI:** fight: **[tap St. Vith]** → **[Fight St. Vith]**. The battle table: both sides, odds.
2. Allied Special Action *(auto, explained)*: Reinforce (SA) brings CCB/9 in.
3. **UI:** point units (gold mark), assets row, Ready. **[tap Begin combat]**.
4. Defensive fire *(book dice 5, 5, 1)*: **UI:** the fire report, reading SN and modifiers (+1 armour, −1 green vs veteran). **[tap Roll]**.
5. Two hits: first is a step loss; **[choose Abort]** for the second → attackers disordered. Recap: hit priorities, abort.

## Lesson 6 · Combat with exploitation (23.6, Figures 10–12)
Position: Weiswampach [22]: 116 Pz vs 112/28, artillery available.
1. **UI:** assigning assets: **[tap 15th Rocket]**, **[tap 401st]** (one regular + one rocket, 16.12). Refused combos explain why.
2. Artillery *(book dice)*, then ground fire: 116 Pz rolls 1, 6, 5 → three hits.
3. Defender: retreat absorbs one, the second eliminates, one excess. **UI:** the hit-choice bubble.
4. Exploitation morale check *(rolls 6, needs 7)* → 116 Pz marked for exploitation. Recap.

## Lesson 7 · Reaction and breakthrough (23.7, Figure 13)
Position: as in Figure 13.
1. Reaction: "the Allies have no eligible reserves this turn". **UI:** the Reaction step.
2. Breakthrough movement, three ways:
   - **[move 116 Pz]** (exploitation) one area to Houffalize.
   - **[move Pz Lehr]** (reserve) Marnach → Weiswampach, **[spend fuel]**, on to Vielsalm.
   - **UI:** the Breakthrough (SA) shortcut and SA tags: **[activate 150 Pz]** into Weiswampach.
3. Breakthrough combat in Houffalize and Vielsalm *(book dice)*, newly contested = free; already contested would need a Special Action (tags show it).

## Lesson 8 · Supply (23.8, Figure 14)
Position: Figure 14 (Peiper in Werbomont, 18 VG in Trois Ponts, …).
1. **UI:** View › Colour › Supply: your supplied areas tint blue, cut-off red. **[turn it on]**.
2. **[tap 1SS]**, **[tap 62 VG]**, **[tap Peiper]**: the supply line or "cut off" with the reason (9.31a–d).
3. The Supply check panel: **[Roll supply checks]**: Peiper rolls morale. Recap.

## Lesson 9 · Second player turn and victory (23.9–23.10)
1. "Now the Allies play the same sequence." **UI:** online: whose turn it is, Waiting…, chat.
2. Victory check: the VP sheet with the Turn 4 example (net Allied 4 vs sudden death 5). **[open the VP sheet]**.
3. Finish: "You know the whole turn." Buttons: **Start a Nuts! game** (3 turns, Bastogne) · **Start the campaign** · **Back home**.

## Free play (optional)
After lesson 9: "Now you try": the rest of a Turn 2 from the Campaign position with hints kept on (the coach suggests but does not lock).

## Open questions for review
1. Lesson order and length (≈ 35 steps, 15–20 min). Cut or merge anything?
2. Should the player always be German first, or choose a side?
3. Book dice: always forced (same story as the book), or a "real dice" option?
4. Any Play Book point missing that you want taught (e.g. field works building, roadblocks, Greif Interdict, air missions)?
