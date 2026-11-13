/** What each chit does, from the Series Rules and the Bulge Play Book (rule numbers in brackets); the printed rule is the authority.
 *  [title, full description]. Lines starting with "• " are shown as a list. */
export const RULE: Record<string, [string, string]> = {
  artillery: ['Artillery asset', `Combat (6.22, 6.25): assign it to a battle during set-up. It fires in the artillery step, before the ground units: one die at the Success Number from the Combat Table. Hits go to the enemy point unit first (6.42).
• Higher Echelon: only for battles with units of the same army (German assets: only in their own army's zone, 16.1).
• German limit (16.12): two artillery in one attack only if one is regular and one is rocket artillery of the same army.
• German attrition (16.12): each Reinforcement Phase the German player eliminates one regular artillery asset of his choice from the Used Box.
• A defended roadblock (4.35) may receive one artillery asset of its own Higher Echelon.
• After the battle it goes to the Used Box.`],
  rocket_artillery: ['Rocket artillery asset', `Combat (6.22, 6.25): fires like artillery in the artillery step, one die at the Success Number from the Combat Table.
• It is not subject to German artillery attrition (16.12).
• It can join a regular artillery asset of the same army in one German attack (16.12).
• After the battle it goes to the Used Box.`],
  engineer: ['Engineer asset', `Admin Phase, one function per engineer (4.3), then it goes to the Used Box:
• Blow up bridges (4.31): from a supplied, friendly, uncontested area, blow up to TWO bridges on that area's river boundaries.
• Repair a bridge (4.32): control both sides (or one side and contest the other); the repairing area must be supplied and uncontested.
• Field works (4.33): in a supplied, friendly, uncontested area with a friendly unit of the engineer's Higher Echelon. Defenders there absorb one hit.
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1+. The first enemy unit entering pays +1 MP and stops. Friendly units may pass through without removing it.
• Defended roadblock (4.35): the engineer chit itself stays in the area as a roadblock that is not removed by entry; it defends like a unit and may try to blow bridges.
Combat (6.32, 6.33): as a battle asset it fires in ground combat, or (attacker) removes the enemy field works instead of firing.
German engineers work in their own army's zone (14.52); an army without its engineer may borrow another for bridging only.`],
  armor_asset: ['Armor battle asset', `Combat (6.32): assign it in battle set-up to a battle of its Higher Echelon. It fires with the ground units (one die, armor class).
• Battle assets may take the first loss instead of the point unit (6.43).
• A hit eliminates it; otherwise it goes to the Used Box after the battle.`],
  infantry_asset: ['Infantry battle asset', `Combat (6.32): assign it in battle set-up to a battle of its Higher Echelon. It fires with the ground units (one die, infantry class).
• Battle assets may take the first loss instead of the point unit (6.43).
• A hit eliminates it; otherwise it goes to the Used Box after the battle.`],
  task_force: ['Task Force (Allied, turns 2-5)', `Reinforcement Phase (16.22): place it in any uncontested, friendly-controlled, supplied area (other friendly forces may be there). It then acts exactly like a garrison (16.21):
• It never moves. Alone it defends like a defended roadblock (4.35); with Allied units it is their battle asset.
• It cannot retreat: if the units beside it retreat, it is destroyed and counts as one hit (6.42c). A hit or a failed out-of-supply morale check also eliminates it. It cannot be returned by the alternate event use (4.21).`],
  fuel: ['Fuel asset (German, 16.13)', `With the fuel rule, a German unit that moves more than 3 movement points, or strat-moves, spends one fuel asset (it goes to the Used Box).
• With no fuel available, German units may move only up to 3 MP and may not strat-move.
• Fuel is spent automatically when you move.`],
  command_staff: ['Command Staff asset', `Admin Phase, any ONE staff function, with no Higher Echelon limit (8.3); then it goes to the Used Box:
• Replacements found (8.31): one non-elite step to any supplied infantry-class unit.
• Intelligence gathering (8.32): reveal one enemy block anywhere until the end of the Admin Phase.
• Reserves made available (8.33): put an available reserve marker on an eligible unit (supplied, in good order, uncontested, in the marker's zone, 14.7).
• German only, Boundary crossing (14.62a): one German unit may leave its army's zone without the +2 MP; the marker goes when it next moves.
• Allied only, Pooled assets (14.62b): mark an area where assets of any American army may support the battle.`],
  sa_block: ['Special Action (reusable block)', `Your personal command influence (8.1): a wooden block, usable for units of any Higher Echelon. After use it goes to the Used Box and comes back to Available automatically each Reinforcement Phase. If you did not use it, you may bring one asset back from the Used Box (4.1a). Uses (8.2):
• Breakthrough movement (8.21): one supplied armor-class unit in good order that has not moved moves one area in the Breakthrough Phase, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reinforce a battle (8.23, defender only): one unit in good order from an adjacent uncontested area joins the battle.
• Retreat before combat (8.24, defender only): all defenders retreat without disorder; the attacker gets an exploitation opportunity.
• Rally (8.25, Admin): all friendly disordered/recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied reduced unit, even an elite step.
• Reroute a reinforcement (8.27, Reinforcement): place an arriving unit in another appropriate entry area.`],
  special_action_event: ['Special Action (single-use event)', `A single-use Special Action (17.33): any one use of the reusable Special Action (8.2), but only for units of the Higher Echelon printed on it. It goes to the Eliminated Box after use and does not count as the one event allowed per battle.
• Breakthrough movement (8.21), Breakthrough combat (8.22), Reinforce a battle (8.23), Retreat before combat (8.24), Rally (8.25), Quality replacements (8.26), Reroute a reinforcement (8.27).`],
  replacement_inf: ['Infantry replacement', `Admin Phase (17.31): one step to a supplied, reduced infantry-class unit of the printed Higher Echelon, even in a contested area. It cannot bring back eliminated units nor create an elite step. The German Strategic Reserve chit may go to any German army.`],
  replacement_arm: ['Armor replacement', `Admin Phase (17.32): one step to a supplied, reduced armor-class unit of the printed Higher Echelon, even in a contested area. It cannot bring back eliminated units nor create an elite step.`],
  rebuild_or_replace_inf: ['Rebuild or Replace (US 1st Army, infantry)', `Admin Phase (17.22): either a replacement step like 17.31, or bring an eliminated one-step non-elite infantry unit back, placed in any friendly-controlled objective area (even contested).`],
  rebuild_or_replace_arm: ['Rebuild or Replace (US 1st Army, armor)', `Admin Phase (17.22): either a replacement step like 17.32, or bring an eliminated one-step non-elite armor unit back, placed in any friendly-controlled objective area (even contested).`],
  event_arriving_regiment: ['Arriving Infantry Regiment', `Admin Phase (17.23): a step of replacements for the printed division (it may restore the 1st Infantry Division's elite step). If that division is eliminated, it comes back with one step in a friendly entry area.`],
  event_release: ['Strategic Reserve Division Released', `Admin Phase (17.13): the printed German division enters the game in Entry Area Y or Z (German player's choice).`],
  event_greif_bridge: ['Greif Team: Bridge', `Admin Phase (17.12): place it on a river boundary. It stays until the bridge is blown or a German unit crosses it.
• Allied attempts to blow this bridge during a German crossing succeed only on a 1 (instead of 1-5).
• An Allied engineer blowing it in the Admin Phase needs a 1-5, and may try only once that phase.`],
  event_greif_interdict: ['Greif Team: Interdict', `Admin Phase (17.11): place it on an American block. The next time that unit tries to move, build field works or take a reserve marker, it is revealed and makes a morale check with +2.
• Fail: it may only stay or move one area, and may not build field works or go in reserve.
• Pass: no effect. Either way the event is then eliminated.
• If the unit's next move is by a friendly Special Action (8.21, 8.23, 8.24), the marker is removed with no effect.`],
  event_bodenplatte: ['Operation Bodenplatte', `Admin Phase (17.14): roll one die for each Air Mission in the Allied Available Box: 1-5 = no effect, 6-9 = delayed (back to the cup), 10 = eliminated (Player Aid D; the Play Book numbers the die the other way round, with a typo).`],
  event_delayed_response: ['Delayed Response', `No effect (17.34): when drawn it goes straight to the Eliminated Box, and it still counts as one of your draws. It cannot be used for the alternate use (4.21).`],
  /* ---- Golan '73 (Vol. III): rule numbers from its exclusive rules ---- */
  commando: ['Commando battalion (16.11)', `Admin Phase: land in a vacant Israeli-controlled area next to a Syrian-occupied one. The first Israeli unit entering rolls: 1–2 the raid succeeds, 3–5 partly (the commandos do not fire back), 6+ the helicopters are shot down.
• It stands like a defended roadblock and must be fought; a Syrian unit entering relieves it (back to the Used Box).
• In a battle it is a Syrian battle asset (infantry class).`],
  sam: ['SAM battery (16.12)', `When an Israeli air mission is flown east of the SAM barrier, Syria may fire one SAM: shot down on a 1; the mission is cancelled on a low roll (the threshold falls as the war goes on).
• Used SAMs roll for reduction each Reinforcement Phase (6+: one is eliminated). The first three losses each release an Israeli air asset (16.23).`],
  'golan:air_mission': ['Air support (16.3)', `Combat: fires as artillery or supports one unit (+1 Syrian, +2 Israeli). Israel may commit two (one of each) only west of the SAM barrier or when no SAM is available (16.22).
• Admin Phase: interdiction over an area (+1 MP to enter and leave until the second player's Supply Phase) or reconnaissance (the enemy blocks there are shown).
• Never on the night turn (14.03). Israeli missions east of the SAM barrier may be answered by a SAM.`],
  'golan:event_release': ['Strategic Reserve released (17.11)', `Admin Phase: the named brigade is released and placed at once in a friendly-controlled Syrian entry area.`],
  event_ssm_strike: ['SSM strike (17.12)', `Admin Phase: each Israeli air asset in the Available Box goes back to the cup on a roll of 1–2.`],
  event_arriving_battalion: ['Arriving battalion (17.21)', `Admin Phase, to its brigade: +2 steps to one supplied unit, +1 to each of two, or an eliminated unit back with 2 steps in an Assembly area (and off the eliminated-units VP track).`],
  event_dugman5: ['Operation Dugman 5 (17.22)', `Played when drawn: one die per SAM in the Available Box. 1: destroyed (an Israeli air asset is released). 2–3: back to the cup. 10: an Israeli air asset is lost.`],
  event_lt_zvika: ['Lt. Zvika Greengold (17.23)', `Admin Phase: an elite armor defended roadblock in an empty Israeli-controlled area. It stays until destroyed and may be reinforced by a Special Action.`],
  event_king_hassan: ["King Hassan's Troublemakers (17.24)", `Admin Phase: for the rest of the game the Moroccan brigade fires only in defence and never enters an Israeli-controlled area.`],
  replacement_mech: ['Mechanized replacement (17.32)', `Admin Phase: one step to a supplied reduced mech or infantry-class unit, even in a contested area; elite steps allowed.`],
  event_ew: ['Electronic warfare (17.33)', `Battle set-up, before the Defender assigns anything: the Attacker jams the defence. Each defending unit rolls: 5 or less, disordered. The Defender may answer with his own EW card (+2 to each roll). If every defender is disordered, no defending assets, air or SAMs.`],
  event_counterbattery: ['Counterbattery (17.34)', `Battle set-up, as the side's one event: after the enemy artillery fires, roll. 1–5: one enemy artillery asset goes that many turns down the track, then straight back to the Available Box.`],
  garrison: ['Garrison (16.24)', `A standing asset in its area: it defends like a defended roadblock, alone or beside Israeli units. It is destroyed by a hit or when the units leave it behind in a retreat.`],
  naval_support: ['Naval support (16.21)', `Combat: an artillery asset that fires only in coastal areas.
• Shock and Awe: instead of firing, one naval asset removes the defending field works, first thing in the battle.
• Reduction of support: each Reinforcement Phase one naval asset in the Used Box is eliminated.`],
  event_asset_delayed: ['Asset Delayed (17.32)', `No effect: when drawn it is eliminated at once, and it counts as one of the draws.`],
  event_fading_morale: ['Fading Italian Morale (17.21)', `Conditional: it enters the Allied cup when a port is captured undamaged or a yellow-star area falls for the first time. Played in the Admin Phase: Italian morale fades one level (1-3).
• The Axis, then the Allies, eliminate Italian assets from the Available Box (one; one each; two each).
• Italian units in every battle are disordered or check morale by the level; a failed check at level 2-3 costs a step, and a 10 (veteran) or 8-10 (green) is a surrender.`],
  event_army_release: ['US 7th Army Release (17.23)', `Admin Phase: all six American divisions are released from their army boundaries (never into zone B).`],
  event_patton_slap: ['Patton Soldier Slap (17.11)', `Admin Phase, for the rest of the game: a US single-use Special Action costs two events (the reusable block and the British are unaffected).`],
  event_tactical_extract: ['Axis Tactical Extract (17.12)', `Admin Phase: in the following Movement Phase German units may move out of a contested area into an adjacent enemy-controlled or contested area (not newly contested, not farther from Messina); they end the move recovering.`],
  'sicily:air_mission': ['Air support (16.3)', `Regardless of supply. Combat (16.32): one per side, as extra artillery or +2 to one unit. Dogfighting (16.31): the other player may cancel it with an air asset of his own; both are used.
• Interdiction (16.33, Admin Phase): +1 MP to enter and leave the area, no strat-move in or out, until your Supply Phase.
• Air supply (16.34, Supply Phase): an unsupplied area gets no morale checks and may recover (still no assets).
• Captured airfields (16.4): each Allied capture adds a conditional air asset to the Allied cup; the next Axis air asset drawn fills the empty box.`],
  'sicily:engineer': ['Engineer asset', `Admin Phase, one function per engineer (4.3), then it goes to the Used Box:
• Blow up bridges (4.31): from a supplied, friendly, uncontested area, up to two bridges on its river boundaries.
• Repair a bridge (4.32); field works (4.33) where a friendly unit of its army stands (Axis engineers: any Axis unit, 14.53).
• Ports (14.51): the Axis damages, the Allies repair, Syracuse, Catania or Palermo one level per Admin Phase (the port friendly, supplied, uncontested; the Allies need a unit of the right army there). Messina cannot be damaged.
Combat (6.32, 6.33): a battle asset that fires in ground combat, or (attacker) removes the enemy field works instead of firing.`],
  'sicily:command_staff': ['Staff asset', `Admin Phase, one staff function (8.3): intelligence gathering, a reserve marker, or replacements found (Allied: a non-elite step to an infantry-class unit; Axis, 14.63: an eliminated Italian infantry asset back to the Available Box).`],
  air_mission: ['Allied Air Mission', `One of three missions (17.21), then it goes to the Eliminated Box. It may be played on unsupplied areas.
• Combat support: the battle's one event; either fires as artillery (outside the artillery limit), or gives +2 to one Allied unit's Success Number. It cannot take a step-loss.
• Interdiction (Admin): mark an area; Germans pay +1 MP to enter AND to leave it and may not strat-move through it, until the Supply Phase.
• Air supply (Supply Phase): one unsupplied area and its units are supplied until the next Supply Phase.`],
  // The Bulge: its own texts (the asset sweep of November 2026); the other volumes keep the shared ones above.
  'bulge:artillery': ['Artillery asset', `Combat (6.22-6.26): assign it in a battle's set-up (Attacker first, then Defender). It fires in the artillery step before ground fire: one die at Success Number 5, −1 if the enemy point unit is armor or infantry in field works (optional 18.6: −1 against the Defender, +1 against infantry not in field works).
• How many: up to 2 attacking, 1 defending (6.31). With units of mixed Higher Echelons: one per involved echelon when attacking, one in all when defending.
• US battles get one more (3 attacking, 2 defending, 16.23), but not British, not with mixed echelons (unless Pooled Assets, 14.62b) and not in a battle with a defended roadblock.
• Only for units of its own army. German assets act only in their own army's zone (16.1); German Strategic Reserve units take the artillery of the zone they stand in (15.1c); US Strategic Reserve units that of either US army (15.2).
• Supply: the Attacker's units must be supplied and trace supply, the Defender's must trace supply (6.22, 6.23, 9.34a).
• German limit (16.12): two artillery in one battle only as one regular plus one rocket asset of the same army.
• German attrition (16.12): each Reinforcement Phase, before the Used Box goes back to the cup, the German player eliminates one regular artillery asset of his choice from the Used Box.
• Hits on the Defender: the first removes field works; one artillery hit may be absorbed by disordering every defending unit (6.42). Artillery never takes a step loss (6.31).
• A defended roadblock may get one artillery asset of its own echelon (4.35); von der Heydte gets none (16.11).
• After the battle it goes to the Used Box (optional 18.7: a defender's artillery may be overrun).`],
  'bulge:rocket_artillery': ['Rocket artillery asset', `Combat: fires exactly like an artillery asset (6.25, 6.26): one die in the artillery step, with the same limits (2 attacking, 1 defending; own army, and German assets only in their own army's zone, 16.1).
• Never lost to German artillery attrition (16.12): it always goes back to the cup.
• Two German artillery assets in one battle must be one regular and one rocket asset of the same army (16.12).
• It never takes a step loss. After the battle it goes to the Used Box.`],
  'bulge:engineer': ['Engineer asset', `Admin Phase (4.2, 4.3): one function per engineer, then it goes to the Used Box. Not for unsupplied areas or units (9.34d).
• Blow up bridges (4.31): from a supplied, friendly-controlled, uncontested area, blow one or two bridges on that area's river boundaries. A bridge held by a Greif Team blows only on 1-5, one try per Admin Phase (17.12).
• Repair a bridge (4.32): from a supplied, friendly, uncontested area, when you control the far side or contest it. Optional 18.1: the Germans repair six bridges at most.
• Field works (4.33): in a supplied, friendly, uncontested area with a friendly unit of the engineer's Higher Echelon (US engineers are Strategic Reserve: any US unit, 15.2). One field works per area.
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1 or more. The first enemy unit to enter pays +1 MP and stops, and the marker goes; friendly units pass freely. Removed in the Supply Phase.
• Defended roadblock (4.35): the engineer chit itself stands in such an area. Every enemy unit entering stops and must fight it; it may try to blow bridges like a unit (5.35d). Only one artillery asset of its own echelon may help it (no events, no Special Action). Surviving, it goes to the Used Box in the Supply Phase; a hit eliminates it.
Combat (6.32, 6.33): a battle asset (one die, the chit's quality). Attacking, it may instead remove the enemy field works, if it survived the artillery and defensive fire; it still counts as a battle asset.
German engineers (14.52): only in their own army's zone; on a river that is also an army boundary either army's engineer may work from its own side; an army that lost its engineer may borrow another for bridging only.`],
  'bulge:armor_asset': ['Armor battle asset', `Combat (6.22, 6.23, 6.32): assign it in battle set-up when all your units there are of its Higher Echelon (none with mixed echelons, unless US Pooled Assets, 14.62b). It fires with the ground units: one die, armor class (+1), with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a). German assets act only in their own army's zone (16.1).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`],
  'bulge:infantry_asset': ['Infantry battle asset', `Combat (6.22, 6.23, 6.32): assign it in battle set-up when all your units there are of its Higher Echelon (none with mixed echelons, unless US Pooled Assets, 14.62b). It fires with the ground units: one die, infantry class, with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a). German assets act only in their own army's zone (16.1); the US Strategic Reserve asset (509 + 551) may support any US army (15.2).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`],
  heydte: ['Von der Heydte paradrop (6th Pz Army, 16.11)', `Admin Phase in which it is first drawn: drop it in Hohes Venn [31] or Stoumont [52], if that area is vacant and Allied-controlled. If not (or if you keep it), it stays in the Available Box as an ordinary 6th Panzer Army infantry battle asset and never gets another drop.
• While it is down, American units may not strat-move through or retreat into its area. The first American unit to enter pays +1 MP and stops, and the German player rolls one die:
• 1, landed intact: the Americans must fight it like a defended roadblock (4.35) in the Combat Phase. It gets no artillery support and never attacks; it fires only when defending (one die, veteran infantry).
• 2-5, partly scattered: the same, but it does not fire back; it only blocks movement and retreats.
• 6-10, completely scattered: it goes to the Eliminated Box and the American unit may carry on with the MP it has left.
• It stays in its area (never to the Used Box) until a hit eliminates it or a German unit relieves it.
• Relief: when a German unit enters its area, it goes to the Used Box and from then on is a regular battle asset. A relieving unit that enters a contested area is revealed.
• Supply: none needed before the 19 December turn (turn 4). From then on, if it cannot trace supply in the German Supply Phase it checks morale (4 or less) and is eliminated on a failure.`],
  'bulge:task_force': ['Task Force (US, turns 2-5)', `Reinforcement Phase (16.22): place it in any uncontested, friendly-controlled area that is in supply now; other friendly forces may be there. One kept in the Available Box may be placed in a later Reinforcement Phase; it is never assigned to a battle from the box. Once placed it acts exactly like a garrison (16.21):
• It never moves. German units entering its area pay +1 MP and stop.
• Alone it is fought like a defended roadblock (4.35): one artillery asset may help it, no other asset or event, no Special Action. With Allied units it is their battle asset (one die, green infantry) and may take a loss before the point unit.
• It cannot retreat. When the defenders retreat it is destroyed first and counts as one hit; the units may retreat only if a hit is left over (16.21, 6.42c).
• One hit, or a failed out-of-supply morale check in the Allied Supply Phase, eliminates it. It never goes to the Used Box and cannot come back by the alternate event use (4.21).`],
  'bulge:garrison': ['Garrison (US, 16.21)', `Placed by the scenario in Wiltz, Bastogne, Spa and St. Vith (Wiltz and Bastogne only in the Introductory Scenario). It never leaves its area until eliminated.
• German units entering its area pay +1 MP and stop.
• Alone it is fought like a defended roadblock (4.35): one artillery asset may help it, no other asset or event, no Special Action.
• With Allied units it is their battle asset (one die, green infantry) and may take a loss before the point unit.
• It cannot retreat. When the defenders retreat it is destroyed first and counts as one hit; the units may retreat only if a hit is left over.
• One hit, or a failed out-of-supply morale check in the Allied Supply Phase, eliminates it. An Air Supply mission over its area keeps it supplied (17.21).
• It never goes to the Used Box and cannot come back by the alternate event use (4.21).`],
  'bulge:fuel': ['Fuel asset (German, 16.13)', `With the fuel rule, a German unit (newly arriving ones too) may move more than 3 MP, or strat-move, only by spending one fuel asset from the Available Box. It goes to the Used Box and recycles through the cup like other assets. This holds in every movement phase: operational, reaction and breakthrough.
• Not needed for a one-area move, however many MP that costs (5.33).
• No fuel left: German units move at most 3 MP and cannot strat-move (and only one German strat-move per turn anyway, 14.81).
• The Germans start with five fuel assets in the Available Box.
• Captured fuel, the first time the Germans take each yellow-star area: roll one die. 1 = a captured fuel asset joins the Available Box (once per game; a later 1 counts as 2-5). 2-5 = one fuel asset moves from the Used Box (or the cup) to the Available Box. 6-10 = nothing.
• Bid fuel (18.2) is spent first and then eliminated: it never recycles and cannot come back by 4.21.
• Fuel is spent automatically when you make such a move.`],
  'bulge:command_staff': ['Command Staff asset', `Admin Phase, either player's (8.3): one staff function with no Higher Echelon limit, then it goes to the Used Box and recycles through the cup. Not for unsupplied units or areas (9.34d).
• Replacements found (8.31): one non-elite step to any supplied, reduced infantry-class unit.
• Intelligence gathering (8.32): reveal one enemy block anywhere, in any supply state, until the end of the Admin Phase.
• Reserves made available (8.33): put an available reserve marker on an eligible unit (supplied, in good order, uncontested, in the marker's zone, 14.7). In the enemy's Admin Phase this gives you a reserve for his Reaction Phase.
• German only, Boundary crossing pre-authorized (14.62a): one German army unit may leave its army's zone without the +2 MP; the marker goes after its next move or in the next German Supply Phase.
• Allied only, Pooled assets (14.62b): choose one area. Until this player-turn's Supply Phase, assets of any US army may support the American units there and mixed US echelons are no limit (the extra US artillery asset applies too).`],
  'bulge:sa_block': ['Special Action (reusable block)', `Your personal command influence (8.1): a wooden block, usable for units of any Higher Echelon, but never on units or areas out of supply (9.34d). After use it goes to the Used Box and comes back to Available in the next Reinforcement Phase. If it was still unused there, you may also bring one asset of your choice from the Used Box straight to Available (4.1a). Uses (8.2):
• Breakthrough movement (8.21): one supplied armor-class unit in good order that has not moved this phase moves one area in the Breakthrough Phase, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reinforce a battle (8.23, defender only, before the Attacker assigns assets): one unit in good order from an adjacent uncontested area joins, within stacking. Never into a battle of a garrison, Task Force or defended roadblock alone. It cannot be the point unit unless the point unit falls.
• Retreat before combat (8.24, defender only): all defending units retreat without disorder; the Attacker gets an exploitation opportunity.
• Rally (8.25, Admin): all your disordered or recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied reduced unit, even an elite step.
• Reroute a reinforcement (8.27, Reinforcement): place an arriving unit in another appropriate entry area.`],
  'bulge:special_action_event': ['Special Action (single-use event)', `A single-use Special Action (17.33): any one use of the reusable Special Action (8.2), but only for units of the Higher Echelon printed on it. It goes to the Eliminated Box after use and does not count as the battle's one event.
• German ones only in their own army's zone (17.1), for that army's units and Strategic Reserve units standing there (15.1c).
• US ones also for US Strategic Reserve units: the 82nd, 101st and 517th (15.2).
• Uses: breakthrough movement (8.21), breakthrough combat (8.22), reinforce a battle (8.23), retreat before combat (8.24), rally (8.25), quality replacements (8.26), reroute a reinforcement (8.27).`],
  'bulge:replacement_inf': ['Infantry replacement', `Admin Phase (17.31): one step to a supplied, reduced infantry-class unit of the printed Higher Echelon, even in a contested area.
• It cannot bring back an eliminated unit, nor be used when the step would make the unit elite.
• German chits: only in their own army's zone, for that army's units and Strategic Reserve units standing there (15.1c, 17.1). The German Strategic Reserve chit may go to a unit of any German army.
• US chits may also go to US Strategic Reserve units (15.2).
• Not for units out of supply or air-supplied (9.34d).`],
  'bulge:replacement_arm': ['Armor replacement', `Admin Phase (17.32): one step to a supplied, reduced armor-class unit of the printed Higher Echelon, even in a contested area.
• It cannot bring back an eliminated unit, nor be used when the step would make the unit elite.
• German chits: only in their own army's zone, for that army's units and Strategic Reserve units standing there (15.1c, 17.1).
• US chits may also go to US Strategic Reserve units (15.2).
• Not for units out of supply or air-supplied (9.34d).`],
  'bulge:rebuild_or_replace_inf': ['Rebuild or Replace (US 1st Army, infantry)', `Admin Phase (17.22), one of:
• Replace: one non-elite step to a supplied, reduced 1st Army (or US Strategic Reserve) infantry-class unit, as an infantry replacement (17.31).
• Rebuild: bring back an eliminated one-step, non-elite 1st Army infantry unit (the 109th, 110th or 112th Regiment of the 28th Division). Place it in any friendly-controlled objective area (an area with a VP symbol), even a contested one.
• Units of more than one step can never be rebuilt.`],
  'bulge:rebuild_or_replace_arm': ['Rebuild or Replace (US 1st Army, armor)', `Admin Phase (17.22), one of:
• Replace: one non-elite step to a supplied, reduced 1st Army (or US Strategic Reserve) armor-class unit, as an armor replacement (17.32).
• Rebuild: bring back an eliminated one-step, non-elite 1st Army armor unit (14th, 102nd or 4th Cavalry; CCA, CCB or CCR of the 9th Armored). Place it in any friendly-controlled objective area (an area with a VP symbol), even a contested one.
• Units of more than one step can never be rebuilt.`],
  'bulge:event_arriving_regiment': ['Arriving Infantry Regiment (US 1st Army, 17.23)', `Admin Phase, for the printed division only (1st or 4th Infantry Division): one step of replacements to it, if it is supplied and reduced, even in a contested area. For the 1st Infantry Division this may be its elite step.
• If that division is in the Eliminated Box, it comes back with one step in an appropriate friendly-controlled 1st Army entry area (A–J, 14.22) and leaves the Eliminated Large Units track (19.2).
• Otherwise it is an infantry replacement (17.31): it cannot go to any other unit.`],
  'bulge:event_release': ['Strategic Reserve Division Released (17.13)', `Admin Phase, in any zone: the printed division (11th Pz, 10th SS Pz, 17th SS PzGr or 6th SS Mountain) enters at once in Entry Area Y or Z, German player's choice. The area needs room (two German units at most) and must not be held by the enemy.
• Released units do not pay +2 MP for crossing army boundaries (15.1b).
• They use the assets and events of the army whose zone they stand in; stacked with another army's unit they may get artillery only (15.1c).`],
  'bulge:event_greif_bridge': ['Greif Team: Bridge (17.12)', `Admin Phase: place it on any river boundary with an intact bridge. It stays until the bridge is blown or a German unit crosses that boundary; then it goes to the Eliminated Box.
• When a German crossing lets the Allies try to blow the bridge (5.35d), they need a 1 instead of 1-5.
• An Allied engineer blowing it in the Admin Phase needs a 1-5 roll instead of blowing it automatically. If that fails, there is no second try on this bridge in the same Admin Phase.`],
  'bulge:event_greif_interdict': ['Greif Team: Interdict (17.11)', `Admin Phase: place it on an American block (not British, not a garrison). It stays with that unit until the unit next tries to move, build field works or take a reserve marker. The American player announces the activity first. Then the unit is revealed and checks morale with +2: a supplied unit in good order passes on 1-5 (green), 1-7 (veteran) or 1-9 (elite).
• Fail: this time it may only stay or move one area; no field works, no reserve. The reserve marker it was given cannot go to another unit this phase.
• Pass: it carries on normally.
• Either way the event then goes to the Eliminated Box.
• If its next move comes from a friendly Special Action (8.21 breakthrough, 8.23 reinforce, 8.24 retreat), the marker is removed with no effect.`],
  'bulge:event_bodenplatte': ['Operation Bodenplatte (17.14)', `Admin Phase: roll one die for each Air Mission now in the Allied Available Box (missions already on the map are safe): 1-5 = no effect, 6-9 = back to the Allied cup, 10 = eliminated (Player Aid D).
• Rule 17.14 prints the same odds the other way round: 1 eliminated, 2-5 back to the cup, 6-10 no effect.`],
  'bulge:event_delayed_response': ['Delayed Response', `No effect (17.34): when drawn it goes straight to the Eliminated Box, and it still counts as one of your draws. It cannot be used for the alternate use (4.21).`],
  'bulge:air_mission': ['Allied Air Mission (17.21)', `One of three missions, then it goes to the Eliminated Box. Unlike other events it may be used on unsupplied areas and units.
• Combat support, attacking or defending: it is the battle's one event, even with mixed Allied Higher Echelons. Choose before your artillery fires: either it fires as an extra artillery asset (outside the artillery limit), or one Allied unit of your choice gets +2 to its Success Number. It never takes a step loss, and it is eliminated even if the attack is aborted. Not for a garrison, Task Force or defended roadblock alone (4.35).
• Interdiction (Admin Phase): mark any area. German units pay +1 MP to enter it and +1 MP to leave it, and may not strat-move through it. Removed in this player-turn's Supply Phase.
• Air supply (any Supply Phase): declare one unsupplied area. It, its Allied units and any garrison there count as supplied until the next Supply Phase: no out-of-supply morale check, and disordered units may recover. They still cannot receive assets or be helped by events, Special Actions, staff or engineers (9.34a, 9.34d).
• While it waits in the Available Box, Operation Bodenplatte may delay or destroy it (17.14).`],
};
/** Any event chit, single-use Special Actions included (8.1), can instead return two assets from the Eliminated Box to the cup (4.21). */
export const ALT_USE = 'Alternate use (4.21): instead of its printed effect, the event may return two of your assets of your choice from the Eliminated Box to the cup (never garrisons or Task Forces, nor The Bulge\'s bid fuel). Delayed Response cannot be used this way.';
const escH = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** The description as HTML: paragraphs, and "• " lines as a list; events also get their alternate use. */
export function ruleHtml(kind: string, event = false): string {
  const d = (RULE[kind] ?? ['', ''])[1] + (event && !kind.endsWith('event_delayed_response') ? '\n' + ALT_USE : ''); let out = '', list = false;
  for (const line of d.split('\n')) {
    if (line.startsWith('• ')) { if (!list) { out += '<ul class="rl">'; list = true; } out += `<li>${escH(line.slice(2))}</li>`; }
    else { if (list) { out += '</ul>'; list = false; } if (line.trim()) out += `<p>${escH(line)}</p>`; }
  }
  return out + (list ? '</ul>' : '');
}
