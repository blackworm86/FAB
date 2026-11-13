/** What each chit does, from the Series Rules and the Bulge Play Book (rule numbers in brackets); the printed rule is the authority.
 *  [title, full description]. Lines starting with "• " are shown as a list. */
export const RULE: Record<string, [string, string]> = {
  artillery: [
    'Artillery asset',
    `Combat (6.22, 6.25): assign it to a battle during set-up. It fires in the artillery step, before the ground units: one die at the Success Number from the Combat Table. Hits go to the enemy point unit first (6.42).
• Higher Echelon: only for battles with units of the same army (German assets: only in their own army's zone, 16.1).
• German limit (16.12): two artillery in one attack only if one is regular and one is rocket artillery of the same army.
• German attrition (16.12): each Reinforcement Phase the German player eliminates one regular artillery asset of his choice from the Used Box.
• A defended roadblock (4.35) may receive one artillery asset of its own Higher Echelon.
• After the battle it goes to the Used Box.`,
  ],
  rocket_artillery: [
    'Rocket artillery asset',
    `Combat (6.22, 6.25): fires like artillery in the artillery step, one die at the Success Number from the Combat Table.
• It is not subject to German artillery attrition (16.12).
• It can join a regular artillery asset of the same army in one German attack (16.12).
• After the battle it goes to the Used Box.`,
  ],
  engineer: [
    'Engineer asset',
    `Admin Phase, one function per engineer (4.3), then it goes to the Used Box:
• Blow up bridges (4.31): from a supplied, friendly, uncontested area, blow up to TWO bridges on that area's river boundaries.
• Repair a bridge (4.32): control both sides (or one side and contest the other); the repairing area must be supplied and uncontested.
• Field works (4.33): in a supplied, friendly, uncontested area with a friendly unit of the engineer's Higher Echelon. Defenders there absorb one hit.
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1+. The first enemy unit entering pays +1 MP and stops. Friendly units may pass through without removing it.
• Defended roadblock (4.35): the engineer chit itself stays in the area as a roadblock that is not removed by entry; it defends like a unit and may try to blow bridges.
Combat (6.32, 6.33): as a battle asset it fires in ground combat, or (attacker) removes the enemy field works instead of firing.
German engineers work in their own army's zone (14.52); an army without its engineer may borrow another for bridging only.`,
  ],
  armor_asset: [
    'Armor battle asset',
    `Combat (6.32): assign it in battle set-up to a battle of its Higher Echelon. It fires with the ground units (one die, armor class).
• Battle assets may take the first loss instead of the point unit (6.43).
• A hit eliminates it; otherwise it goes to the Used Box after the battle.`,
  ],
  infantry_asset: [
    'Infantry battle asset',
    `Combat (6.32): assign it in battle set-up to a battle of its Higher Echelon. It fires with the ground units (one die, infantry class).
• Battle assets may take the first loss instead of the point unit (6.43).
• A hit eliminates it; otherwise it goes to the Used Box after the battle.`,
  ],
  command_staff: [
    'Command Staff asset',
    `Admin Phase, any ONE staff function, with no Higher Echelon limit (8.3); then it goes to the Used Box:
• Replacements found (8.31): one non-elite step to any supplied infantry-class unit.
• Intelligence gathering (8.32): reveal one enemy block anywhere until the end of the Admin Phase.
• Reserves made available (8.33): put an available reserve marker on an eligible unit (supplied, in good order, uncontested, in the marker's zone, 14.7).
• German only, Boundary crossing (14.62a): one German unit may leave its army's zone without the +2 MP; the marker goes when it next moves.
• Allied only, Pooled assets (14.62b): mark an area where assets of any American army may support the battle.`,
  ],
  sa_block: [
    'Special Action (reusable block)',
    `Your personal command influence (8.1): a wooden block, usable for units of any Higher Echelon. After use it goes to the Used Box and comes back to Available automatically each Reinforcement Phase. If you did not use it, you may bring one asset back from the Used Box (4.1a). Uses (8.2):
• Breakthrough movement (8.21): one supplied armor-class unit in good order that has not moved moves one area in the Breakthrough Phase, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reinforce a battle (8.23, defender only): one unit in good order from an adjacent uncontested area joins the battle.
• Retreat before combat (8.24, defender only): all defenders retreat without disorder; the attacker gets an exploitation opportunity.
• Rally (8.25, Admin): all friendly disordered/recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied reduced unit, even an elite step.
• Reroute a reinforcement (8.27, Reinforcement): place an arriving unit in another appropriate entry area.`,
  ],
  special_action_event: [
    'Special Action (single-use event)',
    `A single-use Special Action (17.33): any one use of the reusable Special Action (8.2), but only for units of the Higher Echelon printed on it. It goes to the Eliminated Box after use and does not count as the one event allowed per battle.
• Breakthrough movement (8.21), Breakthrough combat (8.22), Reinforce a battle (8.23), Retreat before combat (8.24), Rally (8.25), Quality replacements (8.26), Reroute a reinforcement (8.27).`,
  ],
  replacement_inf: [
    'Infantry replacement',
    `Admin Phase (17.31): one step to a supplied, reduced infantry-class unit of the printed Higher Echelon, even in a contested area. It cannot bring back eliminated units nor create an elite step. The German Strategic Reserve chit may go to any German army.`,
  ],
  replacement_arm: [
    'Armor replacement',
    `Admin Phase (17.32): one step to a supplied, reduced armor-class unit of the printed Higher Echelon, even in a contested area. It cannot bring back eliminated units nor create an elite step.`,
  ],
  // Sicily: its own texts (the asset sweep of November 2026).
  'sicily:artillery': [
    'Artillery asset',
    `Combat (6.22, 6.23, 6.31): assign it in a battle's set-up, the Attacker first, then the Defender. It fires in the artillery step, before ground fire: one die against the enemy point unit (optional 18.2: −1 against the Defender, +1 against an infantry point unit not in field works).
• How many: up to 2 attacking, 1 defending. Naval support counts as artillery here; air support does not.
• US and British units in one battle (6.22, 6.23): attacking, one artillery asset per army; defending, one in all.
• Allied artillery helps only its own army: US assets US units, British assets British units (16.2). Axis artillery helps Italian and German units alike, in any zone (16.1, 16.12).
• Supply: the Attacker's units must be supplied and trace supply, the Defender's must trace supply (6.22, 6.23, 9.34a).
• A defended roadblock alone may receive one artillery asset of its own army and nothing else (4.35).
• Hits on the Defender: the first removes field works; one artillery hit may be absorbed by disordering every defending unit (6.42). Artillery never takes a step loss (6.31).
• After the battle it goes to the Used Box (optional 18.3: a defender's artillery left in a vacated area may be overrun).`,
  ],
  'sicily:naval_support': [
    'Naval support (Allied, 16.21)',
    `The Allies start with four. Combat: it fires exactly like an artillery asset and counts against the artillery limit (2 attacking, 1 defending), but only in a coastal area. It is a strategic (red flag) asset: it may support US or British units.
• Shock and Awe (attacking): instead of firing, one naval asset removes the defending field works as the very first act of the battle. A second naval asset in the same battle still fires as artillery. Choose it in the battle set-up.
• A flanking invasion may receive only air and naval support (17.22).
• Reduction of support: in every Reinforcement Phase, if a naval asset is in the Used Box, one of them is eliminated. This happens after the unused reusable Special Action has had its chance to save one (4.1a, Example 2).
• It never takes a step loss. After the battle it goes to the Used Box.`,
  ],
  'sicily:infantry_asset': [
    'Infantry battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in a battle's set-up. It fires with the ground units: one die, infantry class, with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a).
• Allied: only with units of its own army, US with US and British with British (16.2), and none at all when US and British units fight together (6.22, 6.23).
• Axis: in any zone, for Italian and German units alike (16.1), but at most ONE Italian battle asset in a battle, attacking or defending (16.11).
• The 82nd and 1st Airborne assets are ordinary battle assets: they make no airborne assault (14.27a).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'sicily:armor_asset': [
    'Armor battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in a battle's set-up. It fires with the ground units: one die, armor class, with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a).
• Allied: only with units of its own army (16.2), and none when US and British units fight together (6.22, 6.23).
• Axis: in any zone, for Italian and German units alike (16.1). The Italian mobile groups and armor count towards the limit of ONE Italian battle asset per battle (16.11).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'sicily:ranger': [
    'US Ranger battalion (16.22)',
    `An elite infantry battle asset of the US 7th Army. It fires like any US battle asset: US units only, up to 8 battle assets attacking and 5 defending, none when US and British units fight together.
• Field works (16.22): attacking, you may choose in the battle set-up that it removes the enemy field works automatically instead of rolling its die. This happens in offensive ground fire, before the other attackers' Success Numbers are worked out, and only if the attack was not aborted and the Ranger survived the defensive fire.
• If the field works are already gone by then (they absorbed a hit, or naval Shock and Awe removed them), it rolls its die as usual.
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'sicily:commando': [
    '3rd Commando (British, 16.23, 17.22)',
    `An elite British infantry battle asset with two extra abilities.
• Field works (16.23): like a US Ranger, attacking it may remove the enemy field works automatically instead of rolling its die, if the attack goes on and it survived the defensive fire. If the field works are already gone, it rolls as usual.
• Flanking invasion, once per game (16.23, 17.22): in the Allied Admin Phase, land it in an enemy-controlled, uncontested coastal area within two areas of a British unit that stands in a coastal area. Only one flanking invasion per Admin Phase.
• If Axis units are there, one round of combat is fought at once, in that Admin Phase, as a beach assault (the River Assault penalties). The Allies may commit only air and naval support to it; the Axis has no limits.
• If it survives, or the area was empty, it stays there. It never starts a combat (it only defends), does not control the area, needs no supply, does not block Axis supply, and Axis units may not retreat into its area. Its battles get only air and naval support.
• It is relieved, to the Used Box, the moment an Allied unit enters its area. A hit eliminates it.
• Otherwise it is an ordinary British battle asset (up to 8 attacking, 5 defending; Used Box after the battle).`,
  ],
  'sicily:flank': [
    '30th RCT (–) (US, 17.22)',
    `A veteran US infantry battle asset (two counters, two battalions). Every time it is in your Available Box in an Allied Admin Phase, it may instead be played as a flanking invasion event:
• Land it in an enemy-controlled, uncontested coastal area within two areas of a US unit that stands in a coastal area. Only one flanking invasion per Admin Phase.
• If Axis units are there, one round of combat is fought at once, in that Admin Phase, as a beach assault (the River Assault penalties). The Allies may commit only air and naval support to it; the Axis has no limits.
• If it survives, or the area was empty, it stays there. It never starts a combat (it only defends), does not control the area, needs no supply, does not block Axis supply, and Axis units may not retreat into its area. Its battles get only air and naval support.
• It is relieved, to the Used Box, the moment an Allied unit enters its area; from there it can land again in a later turn. A hit eliminates it.
• As a battle asset it fires like any US infantry battle asset (US units only; up to 8 attacking, 5 defending).`,
  ],
  'sicily:engineer': [
    'Engineer asset',
    `Admin Phase (4.3): one function per engineer, then it goes to the Used Box. Not for unsupplied areas or units, nor for air-supplied ones (9.34d).
• Blow up bridges (4.31): from a supplied, friendly-controlled, uncontested area, blow one or two bridges on that area's river boundaries.
• Repair a bridge (4.32): from a supplied, friendly, uncontested area, when you control the far side or contest it. Where a river is also an army boundary, either Allied army's engineer may bridge from its own side (14.52).
• Field works (4.33): in a supplied, friendly, uncontested area with a unit of the engineer's army. Axis engineers work in any zone and for any Axis unit (14.53).
• Ports (14.51): the Axis damages, the Allies repair, Syracuse, Catania or Palermo by one level, at most one level per port per Admin Phase. The port area must be friendly-controlled, in supply and (in this game) uncontested; the Allies also need a British unit there (Syracuse, Catania) or an American one (Palermo). A port takes at most two levels of damage, and Messina can never be damaged. A damaged port gives no arrivals, no supply and no extra draw (16.5).
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1 or more. The first enemy unit to enter pays +1 MP and stops, and the marker goes. Removed in the Supply Phase.
• Defended roadblock (4.35): the engineer chit itself stands in such an area. Every enemy unit entering stops and must fight it. Only one artillery asset of its own army may help it (no other asset, no Special Action). Surviving, it goes to the Used Box in the Supply Phase; a hit eliminates it.
Combat (6.32, 6.33): a battle asset (one die, the chit's quality) with the usual limits; an Italian engineer is the battle's one Italian battle asset (16.11). Attacking, it may instead remove the enemy field works if it survived the artillery and defensive fire; it still counts as a battle asset.`,
  ],
  'sicily:command_staff': [
    'Staff asset',
    `Admin Phase (8.3): one staff function with no Higher Echelon limit, then it goes to the Used Box and recycles through the cup. Not for unsupplied or air-supplied units and areas (9.34d).
• Replacements found (8.31), Allied staff: one non-elite step to any supplied, reduced infantry-class unit, US or British.
• Axis staff, instead (14.63): it never adds steps to units; it moves one eliminated Italian infantry asset straight back to the Axis Available Box.
• Intelligence gathering (8.32): reveal one enemy block anywhere, in any supply state, until the end of the Admin Phase.
• Reserves made available (8.33): put an available reserve marker of the right army on an eligible unit (14.7). In the enemy's Admin Phase this gives you a reserve for his Reaction Phase.
• Sicily has no other staff functions (14.62). The Axis staff is never one of the Italian assets lost to Fading Italian Morale (17.21c).`,
  ],
  'sicily:air_mission': [
    'Air support (16.3)',
    `Both sides. One mission per asset, whatever the supply of the area; afterwards it goes to the Used Box and recycles like any asset.
• Ground support (16.32, in a battle's set-up): one air asset per side per battle, outside the artillery and battle-asset limits, for unsupplied units too. Choose before your artillery fires: it fires as an extra artillery asset, or it gives +2 to one of your units in the battle. It never takes a step loss, and it goes to the Used Box even if the attack is aborted.
• Dogfighting (16.31): when the enemy flies air support in a battle, an interdiction or an air supply mission, you may cancel that mission with one of your own air assets. In a battle this is your one air commitment there; the Attacker may answer the Defender's air out of turn. Both assets go to the Used Box, and neither side may fly another mission in its place.
• Interdiction (16.33, Admin Phase, either player): place it on any land area. Enemy units pay +1 MP to enter and +1 MP to leave it, and may not strat-move into, out of or through it. It stays until the Supply Phase of the current player turn.
• Air supply (16.34, Supply Phase, either player): place it on one area with your unsupplied units. They keep the unsupplied marker (still no assets, events, Special Actions, staff or engineers, 9.34a, 9.34d), but they make no out-of-supply morale check and their disordered markers adjust (9.35) this Supply Phase.
• Captured airfields (16.4): the first time the Allies take Catania, Niscemi or Marsala, a conditional (C) Allied air asset goes into the Allied cup, and the next Axis air asset drawn fills the empty Captured Airfields box and is lost to the Axis.`,
  ],
  'sicily:sa_block': [
    'Special Action (reusable block)',
    `Your personal command influence (8.1): a wooden block, usable for units of any of your armies (US and British; Italian and German), but never on units or areas out of supply (9.34d). After use it goes to the Used Box and comes back to Available in the next Reinforcement Phase. If it was still unused there, you may also bring one asset of your choice from the Used Box straight to Available (4.1a), for example a naval support asset before the fleet withdraws it (16.21). Uses (8.2, 14.61):
• Breakthrough movement (8.21): one supplied armor-class unit in good order that has not moved this phase moves one area in the Breakthrough Phase, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reinforce a battle (8.23, defender only, before the Attacker assigns assets): one unit in good order from an adjacent uncontested area joins, within stacking and the army zones. Never into a battle of a flanking invasion or defended roadblock alone. It cannot be the point unit unless the point unit falls.
• Retreat before combat (8.24, defender only): all defending units retreat without disorder; the Attacker gets an exploitation opportunity.
• Rally (8.25, Admin): all your disordered or recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied reduced unit, even an elite step.
• Release a division (14.61, Allied, Admin): one division may leave its army boundaries; with a British division, one independent brigade (1st Canadian Armoured, 4th Armoured or 231st) is released too. Americans still never enter zone B, British never zone D.
• Not in Sicily: rerouting a reinforcement (8.27, 14.64). Patton Soldier Slap does not affect the block.`,
  ],
  'sicily:special_action_event': [
    'Special Action (single-use event, 17.31)',
    `Any one use of the reusable Special Action (8.2), but only for units of the army printed on it: US 7th Army or British 8th Army; the Axis events (red flag) work for any Italian or German unit. It goes to the Eliminated Box after use and does not count as a battle's one event.
• Uses: breakthrough movement (8.21), breakthrough combat (8.22), reinforce a battle (8.23), retreat before combat (8.24), rally (8.25), quality replacements (8.26) and, for the Allies, releasing a division of its own army (14.61). Rerouting (8.27) is not used in Sicily (14.64).
• Patton Soldier Slap (17.11): once the Axis has played it, US events work only in pairs. Two US Special Action events are spent together, for a Special Action or for the alternate use. British events and the reusable block are not affected.
• Not for units or areas out of supply (9.34d).`,
  ],
  'sicily:replacement_inf': [
    'Infantry replacement (17.24)',
    `Admin Phase: one non-elite step to a supplied, reduced infantry-class unit of the printed nationality (US or British), even in a contested area.
• Infantry class (13.3): infantry, mountain, airborne, motorized infantry, engineer, artillery, garrison and ranger units.
• It cannot bring back an eliminated unit, nor add a step that would be elite.
• Not for units out of supply or kept going by air supply (9.34d, 16.34).`,
  ],
  'sicily:replacement_arm': [
    'Armor replacement (17.25)',
    `Admin Phase: one non-elite step to a supplied, reduced armor-class unit of the printed nationality, even in a contested area.
• Armor class (13.3): armor, armored cavalry and mechanized infantry.
• It cannot bring back an eliminated unit, nor add a step that would be elite.
• Not for units out of supply or kept going by air supply (9.34d, 16.34).`,
  ],
  'sicily:event_asset_delayed': [
    'Asset Delayed (17.32)',
    `No effect: when drawn it goes straight to the Eliminated Box, and it still counts as one of your draws. It never reaches your hand, so it has no alternate use either.`,
  ],
  'sicily:event_fading_morale': [
    'Fading Italian Morale (Allied, conditional, 17.21)',
    `The three events wait in the Captured Ports and Key VP Areas box. One goes into the Allied cup the first time a Sicilian port (Syracuse, Catania, Palermo) is Allied-controlled and undamaged, and the first time the Allies take each of the five yellow-star areas (Catania can do both). When it is drawn and played in an Admin Phase, Italian morale falls one level (1, 2, 3):
• At once (17.21c): at level 1 the Axis eliminates one Italian asset from its Available Box; at level 2 the Axis, then the Allies, each pick one; at level 3 each picks two. Never the Staff asset.
• Untried Italian units in a battle, when revealed (17.21d): at level 1 they are disordered; at levels 2 and 3 they are disordered and then check morale, and a failure costs a step and may be a surrender.
• Tried Italian units in a battle (17.21e): at level 1 those in good order or recovering check morale and are disordered on a failure; at level 2 all are disordered; at level 3 those already disordered check morale (a failure costs a step and may be a surrender) and the others are disordered.
• Surrender (17.21f): on that failed check, a veteran unit rolling 10, or a green unit rolling 8-10, surrenders and is eliminated. Attacking armor then gets an exploitation opportunity if the area is no longer contested.`,
  ],
  'sicily:event_army_release': [
    'US 7th Army Release (17.23)',
    `Admin Phase: all six US divisions, the 82nd Airborne included, are released from their army boundaries at once, without a Special Action. They may now enter zone A or zone D (whichever their landing plan kept from them), but never zone B.`,
  ],
  'sicily:event_patton_slap': [
    'Patton Soldier Slap (Axis, 17.11)',
    `Admin Phase: from then on, to the end of the game, a US single-use Special Action event works only when two of them are spent together, both for a Special Action and for the alternate use (4.21). The reusable Special Action block and the British events are not affected.`,
  ],
  'sicily:event_tactical_extract': [
    'Axis Tactical Extract (17.12)',
    `Admin Phase: for the ensuing Movement Phase, German (not Italian) units may move one area straight out of a contested area into an adjacent enemy-controlled area or another contested area.
• Neither area may be newly contested, and the area entered may not be farther from Messina (counted in areas) than the one left.
• The units that move this way end recovering: they cannot attack, but will be in good order for the Allied player turn.
• Play it in the Axis Admin Phase: it ends with the next Movement Phase, whoever moves.`,
  ],
  // Golan '73: its own texts (the asset sweep of November 2026).
  'golan:artillery': [
    'Artillery asset',
    `Combat (6.22-6.26): assign it in a battle's set-up, Attacker first, then Defender. It fires in the artillery step, before ground fire: one die at Success Number 5, −1 against the Defender, −1 if the enemy point unit is armour, a strongpoint or infantry in field works, −1 on the night turn (14.03).
• How many: up to 2 attacking, 1 defending (6.31). Israel gets one more (3 and 2) while it controls Mt Hermon with a garrison or unit there; the bonus is lost for good once Syria takes it (16.21).
• Syrian units of different divisions in one area: one artillery asset only (15.12). Optional 18.5 does the same for Israeli divisions.
• A garrison, commando raid, Lt. Zvika or defended roadblock fighting alone may have this one artillery asset and nothing else (4.35).
• None on Mt Hermon: only infantry-class battle assets and air support there (14.16).
• Supply: the Attacker's units must be supplied and trace supply, the Defender's must trace supply (6.22, 6.23, 9.34a).
• It never takes a step loss. After the battle it goes to the Used Box. An enemy Counterbattery event may send it down the Turn Track (17.34).
• Optional 18.31: once per Admin Phase, an interdiction next to your units or a strongpoint (+1 MP in and out for the enemy, no strat-move). Optional 18.32 (Israeli): it supports the point unit (+1) instead of firing, and may then take a loss.`,
  ],
  'golan:rocket_artillery': [
    'Rocket artillery asset',
    `Combat: fires exactly like an artillery asset, in the artillery step, with the same limits (2 attacking, 1 defending; 3 and 2 for Israel while it holds Mt Hermon, 16.21), and +1 to its Success Number (16.4).
• Mixed Syrian divisions: one artillery asset in all (15.12). Not on Mt Hermon (14.16).
• It never takes a step loss. After the battle it goes to the Used Box; an enemy Counterbattery may send it down the Turn Track (17.34).`,
  ],
  'golan:air_mission': [
    'Air support asset (16.3)',
    `An asset that recycles through the cup. Not on the night turn (14.03), never over an Assembly area, and supply does not matter (16.31). After a mission it goes to the Used Box. It cannot come back by the alternate event use (17.4).
• Close air support (Combat Phase, 16.31a): one per side per battle, attacking or defending. Choose before your artillery fires: it fires as an extra artillery asset (outside the artillery limit), or one of your units in the battle gets +2 (Israeli) or +1 (Syrian). It never takes a loss and goes to the Used Box even if the attack is aborted.
• Israel may commit two to one battle, one as artillery and one supporting a unit; east of the SAM barrier only while no SAM is in the Syrian Available Box (16.22).
• With mixed Syrian divisions it still flies, as artillery only (15.12). Allowed on Mt Hermon (14.16). Not for a garrison, raid or Lt. Zvika fighting alone (4.35). Optional 18.4: Syrian close air support only when Syria attacks.
• Interdiction (Admin Phase, 16.31b): place it on any area. Enemy units pay +1 MP to enter it and +1 MP to leave it, and may not strat-move in or out, until the Supply Phase of the second player turn.
• Reconnaissance (Admin Phase, 16.31c): place it on an enemy-occupied area. Every enemy block there is shown to you for the rest of the phase; then it goes to the Used Box.
• SAMs (16.12): an Israeli mission in an area east of the SAM barrier may be fired on at once by an available Syrian SAM. A cancelled mission cannot be replaced by another air asset there.
• Israel brings lost air assets back by a Special Action (14.61d); its three conditional ones join the cup as SAMs are destroyed (16.23). The Syrian SSM Strike (17.12) and Operation Dugman 5 (17.22) can send them back to the cup or destroy one.`,
  ],
  'golan:sam': [
    'SAM air defence (Syrian, 16.12)',
    `Used only as an answer: whenever an Israeli air support asset is placed in an area east of the Syrian SAM barrier (an Admin-Phase mission or in a battle), Syria may fire one available SAM before anything else happens. Roll one die:
• Turns 1-3: 1 shot down (Eliminated Box), 2-7 the mission is cancelled (air asset to the Used Box), 8-10 no effect.
• Turns 4-6: 1 shot down, 2-5 cancelled, 6-10 no effect. Turns 7-9: 1 shot down, 2-3 cancelled, 4-10 no effect. The Battle for Nafakh uses the turns 4-6 column.
• Whatever the result, the SAM then goes to the Used Box. A cancelled mission may not be replaced by another air asset (in that battle, or over that area this Admin Phase).
• While any SAM is in the Available Box, Israel may commit only one air asset to a battle east of the barrier (16.22).
• A defence entirely disordered by Electronic Warfare jamming fires no SAM (17.33).
• Reduction, each Reinforcement Phase: one die per SAM in the Used Box. If any die is 6 or more, one SAM goes to the Eliminated Box. Each of the first three SAMs eliminated releases a conditional Israeli air asset into the cup (16.23). Operation Dugman 5 can also destroy SAMs or send them back to the cup (17.22).
• A lost SAM comes back to the cup by a Syrian Special Action (14.61c), never by the alternate event use (17.4).`,
  ],
  'golan:commando': [
    'Commando battalion (Syrian, 16.11)',
    `Use it in one of two ways.
Raid (Admin Phase): place it in a vacant, Israeli-controlled area next to an area with a Syrian unit (any Terrain Difficulty). Israeli units may not strat-move or retreat into that area. The first Israeli unit to enter pays +1 MP and stops, and Syria rolls one die:
• 1-2, success: the Israelis must fight it like a defended roadblock in the Combat Phase (one die, elite infantry; only one artillery asset may help it, no events, no Special Action).
• 3-5, partial success: the same, but it never fires back; it only blocks movement and retreats.
• 6-10, failure: the helicopters are shot down. It goes to the Eliminated Box and the Israeli unit may move on with the MP it has left.
• A raid never needs supply and stays through the Supply Phase until it is eliminated or relieved. A Syrian unit entering relieves it (to the Used Box); a relieving unit that enters a contested area is revealed.
Battle asset (Combat Phase): an elite, infantry-class battle asset (allowed on Mt Hermon). Used this way, it has no raid until it is drawn again.
It never comes back by the alternate event use (17.4).`,
  ],
  'golan:garrison': [
    'Garrison (Israeli, 16.24)',
    `Five garrisons start in Ramat Magshimim, Tel Faris, Nafakh, Tel Abu Nida and Mt Hermon. They never leave their area.
• Alone it is fought like a defended roadblock (4.35): Syrian units entering stop and must fight it; only one artillery asset may help it, with no other asset, no event and no Special Action.
• With Israeli units it is their battle asset (one die, its printed quality) and may take a loss before the point unit.
• It cannot retreat. The units with it may absorb a hit by retreating, but that destroys the garrison: worth it only to escape encirclement when a single hit was scored.
• It is eliminated by a hit, by staying behind in a retreat, or by failing an out-of-supply morale check. It never goes to the Used Box and cannot come back by the alternate event use (4.21).
• While the Mt Hermon garrison (or any Israeli unit) holds an Israeli Mt Hermon, Israel may use one extra artillery asset (16.21).`,
  ],
  'golan:task_force': [
    'Task Force (Israeli, 15.6)',
    `Conditional: eight wait in the Evacuated Strongpoints box, four armour-supported and four infantry-supported. When a strongpoint is evacuated (a regular Israeli unit leaves or retreats from its contested area), the strongpoint is removed and a Task Force of its type (tank symbol: armour; rifle symbol: infantry) goes into the Israeli cup.
• Once drawn it is an ordinary battle asset: one die, veteran, armour or infantry class. Assign it in a battle's set-up; it may take a loss before the point unit; one hit eliminates it; otherwise it goes to the Used Box.
• An infantry Task Force may be used on Mt Hermon (14.16).
• Errata: an Israeli attack in an area with an Israeli strongpoint may bring the strongpoint in only by removing it for good and committing its Task Force to that battle at once.
• It can come back by the alternate event use (4.21).`,
  ],
  'golan:engineer': [
    'Engineer asset',
    `Admin Phase (4.3, 14.5): one function per engineer, then it goes to the Used Box. Never for unsupplied areas or units (9.34d).
• Blow up bridges (4.31): from a supplied, friendly-controlled, uncontested area, blow one or two bridges on that area's river boundaries. Bridges exist only where a road crosses a river (14.41).
• Repair a bridge (4.32): from a supplied, friendly, uncontested area, when you control the far side or contest it.
• Bridge the AT ditch (14.51a): from a supplied, friendly, uncontested area across an AT ditch boundary, into a friendly area or a contested enemy-controlled one. The AT Ditch Bridged marker turns the ditch into the road or field connection printed there. Eight markers in all.
• Lift a minefield (14.52, Syrian only): next to a supplied, friendly-controlled, uncontested area.
• Field works (4.33): in a supplied, friendly, uncontested area with one of your units; never where a strongpoint stands (15.6).
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1 or more. The first enemy unit to enter pays +1 MP and stops; then the marker goes. Removed in the Supply Phase.
• Defended roadblock (4.35): the engineer itself stands in such an area. Every enemy unit entering stops and must fight it; only one artillery asset may help it, with no events and no Special Action. If it survives, it goes to the Used Box in the Supply Phase.
Combat: a battle asset (one die, infantry class; allowed on Mt Hermon). Attacking, instead of firing it may remove the enemy field works (6.33), or (Syrian, in an area on the Israeli side of the Purple Line) bridge one AT ditch boundary of that area (14.51b). Either job needs it to survive the artillery and defensive fire, and the attack must not be aborted. One engineer, one job.`,
  ],
  'golan:armor_asset': [
    'Armor battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in a battle's set-up. It fires with your ground units: one die, armour class (+1), with the quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending. Your units there must be in supply (9.34a).
• Golan's commands are unified (13.2): any of your units may have it, except Syrian units of different divisions in one area, which get no battle assets at all (15.12; optional 18.5 for Israel).
• Not on Mt Hermon (14.16: only infantry-class battle assets there). Not for a garrison, raid or Lt. Zvika fighting alone (4.35).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'golan:infantry_asset': [
    'Infantry battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in a battle's set-up. It fires with your ground units: one die, infantry class, with the quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending. Your units there must be in supply (9.34a).
• Golan's commands are unified (13.2): any of your units may have it, except Syrian units of different divisions in one area, which get no battle assets at all (15.12; optional 18.5 for Israel).
• Allowed on Mt Hermon (14.16). Not for a garrison, raid or Lt. Zvika fighting alone (4.35).
• Optional 18.6: the Syrian 5th, 7th and 9th AT assets fire +1 against an armour point unit, and Israeli armour attacking a Syrian defence with an AT asset fires −1 (in Al-Owda only the defending +1).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'golan:command_staff': [
    'Staff asset',
    `Admin Phase, either player's (8.3): one staff function, then it goes to the Used Box and recycles through the cup. Not for unsupplied units or areas (9.34d). Golan adds no staff functions of its own (14.62).
• Replacements (8.31): one non-elite step to a supplied, reduced infantry-class unit (never a strongpoint).
• Intelligence (8.32): reveal one enemy block anywhere, in any supply state, until the end of the Admin Phase.
• Reserves (8.33): put an available reserve marker on an eligible unit: supplied, in good order, uncontested (14.7). An Israeli unit in an Assembly area qualifies.
• Battle for Nafakh (22.46): whenever Syria holds Nafakh, the Israeli staff goes into the cup and the Israeli reusable Special Action is lost until the staff is drawn again.`,
  ],
  'golan:sa_block': [
    'Special Action (reusable block)',
    `Your personal command influence (8.1), for any of your units, but never for unsupplied units or areas (9.34d). After use it goes to the Used Box and is back in the Available Box next Reinforcement Phase. If you did not use it, you may also bring one asset of your choice from the Used Box straight to the Available Box (4.1a). Uses:
• Rally (8.25, Admin): all your disordered or recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied, reduced unit, even an elite step (never a strongpoint).
• Merge units (14.61a, Israeli, Admin): fold one unit into another with the same unit symbol, in the same or adjacent uncontested Israeli areas, both in good order. No VP for Syria.
• Release the Operational Reserve (14.61b, Syrian, Admin, from turn 3): the next 3rd Tank Division unit (15th, then 81st, then 65th) enters in a friendly-controlled Entry area of its own.
• Replace a SAM (14.61c, Syrian) or an air support asset (14.61d, Israeli), Admin: from the Eliminated Box into the cup.
• Reinforce a battle (8.23, Defender only, before the Attacker assigns assets): one unit in good order from an adjacent uncontested area joins, within stacking. Never into a battle of a garrison, raid or defended roadblock alone; Lt. Zvika may be reinforced (17.23).
• Retreat before combat (8.24, Defender only): all defending units retreat without disorder; the Attacker gets an exploitation opportunity. Strongpoints and garrisons stay.
• Breakthrough movement (8.21): one supplied armour-class unit in good order that has not moved this phase moves one area, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reroute a reinforcement (8.27, Reinforcement Phase): place an arriving unit in another appropriate entry area.`,
  ],
  'golan:special_action_event': [
    'Special Action (single-use event, 17.35)',
    `Any one use of the reusable Special Action (8.2, 14.61), for any of your units: Golan's commands are unified (13.2). It goes to the Eliminated Box after use and is not the battle's one event. Never for unsupplied units or areas (9.34d).
• Uses: rally (8.25), quality replacements (8.26), merge units (14.61a, Israeli), release the Operational Reserve (14.61b, Syrian, from turn 3), replace a SAM or an air asset (14.61c, 14.61d), reinforce a battle (8.23), retreat before combat (8.24), breakthrough movement (8.21), breakthrough combat (8.22), reroute a reinforcement (8.27).`,
  ],
  'golan:replacement_arm': [
    'Armor replacement (17.31)',
    `Admin Phase: one step to any supplied, reduced armour-class unit of yours (armour, mech or recon), even in a contested area. The step may be elite.
• It cannot bring back an eliminated unit, and it never helps a strongpoint (15.6) or an unsupplied unit (9.34d).`,
  ],
  'golan:replacement_mech': [
    'Mechanized replacement (17.32)',
    `Admin Phase: one step to any supplied, reduced mech unit or infantry-class unit of yours, even in a contested area. The step may be elite.
• It cannot bring back an eliminated unit, and it never helps a strongpoint (15.6) or an unsupplied unit (9.34d).`,
  ],
  'golan:event_release': [
    'Strategic Reserve released (Syrian, 17.11)',
    `Admin Phase: the brigade printed on it (Assad Guard, 141st Tank or 62nd Mech) leaves the Strategic Reserve box and is placed at once in any friendly-controlled Syrian Entry area (V-Z) that has room and no Israeli unit.
• The first Israeli unit to cross the Purple Line releases two of the three at once (15.2). If its brigade is already in play, the event is good only for its alternate use.`,
  ],
  'golan:event_ssm_strike': [
    'SSM Strike (Syrian, 17.12)',
    `Admin Phase: roll one die for each Israeli air support asset now in the Israeli Available Box (air assets on the map are safe). 1-2: it goes back to the Israeli cup. 3-10: no effect.`,
  ],
  'golan:event_arriving_battalion': [
    'Arriving battalion (Israeli, 17.21)',
    `Admin Phase, two steps for the brigade printed on it (179th Armored, 4th Mech or 679th Armored), one of:
• +2 steps to one supplied unit of that brigade;
• +1 step to each of its two units, both supplied and reduced;
• or, if one of its units has been eliminated, that one block comes back with 2 steps in either Assembly area and leaves the Eliminated Large Units track (19.2).
• It cannot go to any other brigade.`,
  ],
  'golan:event_dugman5': [
    'Operation Dugman 5 (Israeli, 17.22)',
    `Played automatically in the Admin Phase in which it is drawn. Israel rolls one die for each SAM in the Syrian Available Box:
• 1, great success: the SAM goes to the Eliminated Box (each of the first three SAM losses releases a conditional Israeli air asset, 16.23).
• 2-3, limited success: the SAM goes back to the Syrian cup.
• 4-9, failure: no effect.
• 10, a really bad idea: an Israeli air support asset goes from the Israeli Available Box to the Eliminated Box (from the cup if none is available).
• With no SAM available it has no effect. As it is played at once, it has no alternate use.`,
  ],
  'golan:event_lt_zvika': [
    'Lt. Zvika Greengold (Israeli, 17.23)',
    `Admin Phase: place it in a supplied, vacant, Israeli-controlled area (any Terrain Difficulty). It acts as a defended roadblock (4.35): Syrian units entering stop and must fight it (one die, elite, armour class). Alone it may have one artillery asset and no event.
• Unlike other defended roadblocks, a Special Action may bring an adjacent unit into its battle (8.23).
• It is not removed in the Supply Phase: it stays until it is eliminated.
• Optional variant (18.9): in the Supply Phase Israel may take it back into the cup, to play it again when drawn.`,
  ],
  'golan:event_king_hassan': [
    "King Hassan's Troublemakers (Israeli, 17.24)",
    `Admin Phase: the marker goes on the Syrian Moroccan brigade for the rest of the game.
• The Moroccans fire only when defending: in a Syrian attack they roll no dice (they can still take losses).
• They may never move into an Israeli-controlled area, contested or not, whatever the kind of move (also by reaction, breakthrough or a Special Action reinforcement).`,
  ],
  'golan:event_ew': [
    'Electronic Warfare (17.33)',
    `Played in a battle as your one event (6.22, 6.23), in one of two ways:
• Command disruption (Attacker only): with the Attacker's assets, before the Defender assigns any. Each defending unit (not garrisons or other standing assets) rolls one die: 5 or less, it is disordered at once. If every defending unit is disordered, the Defender may assign no artillery, air support, battle asset or SAM in this battle.
• Countermeasures (Defender only): the immediate answer to a command disruption, +2 to each of those rolls. It is the Defender's one event.
• The battle cannot start until the Defender has rolled.`,
  ],
  'golan:event_counterbattery': [
    'Counterbattery strike (17.34)',
    `Played in a battle as your one event, before the first roll. The Attacker may also play it after seeing the Defender commit artillery. After the enemy artillery has fired, roll one die:
• 1-5: one enemy artillery asset from this battle goes onto the Turn Track that many turns ahead. On that turn it arrives straight in the Available Box, not counted in that turn's draw.
• 6-10: no effect. If the enemy fires no artillery, the event is spent for nothing.`,
  ],
  'golan:strongpoint': [
    'Strongpoint (Israeli, 15.6)',
    `A one-step unit that never moves and never attacks: it only defends, always with one die; a rifle symbol fires −1, a tank symbol +1.
• It counts as field works against the Attacker (no field works marker may be placed with it), is always in supply but supplies no other unit, never retreats and never receives replacement steps.
• Evacuation: when a regular Israeli unit leaves or retreats from its contested area, the strongpoint goes to the Evacuated Strongpoints box and a Task Force of its type goes into the Israeli cup.
• Errata: an Israeli attack in its area may use it only by removing it for good and committing its Task Force.`,
  ],
  'golan:ghost': [
    'Ghost (Israeli, 15.7)',
    `A dummy block, placed face-down at the start in an area next to the Purple Line, so that each such area holds one ghost or one strongpoint. It cannot move, attack or defend. When the blocks of a battle are revealed it is removed to the Eliminated Box; an area held only by a ghost gives no exploitation.
• Optional advanced ghosts (A 18.10) let ghosts move and serve as reserves.`,
  ],
  // The Bulge: its own texts (the asset sweep of November 2026); the other volumes keep the shared ones above.
  'bulge:artillery': [
    'Artillery asset',
    `Combat (6.22-6.26): assign it in a battle's set-up (Attacker first, then Defender). It fires in the artillery step before ground fire: one die at Success Number 5, −1 if the enemy point unit is armor or infantry in field works (optional 18.6: −1 against the Defender, +1 against infantry not in field works).
• How many: up to 2 attacking, 1 defending (6.31). With units of mixed Higher Echelons: one per involved echelon when attacking, one in all when defending.
• US battles get one more (3 attacking, 2 defending, 16.23), but not British, not with mixed echelons (unless Pooled Assets, 14.62b) and not in a battle with a defended roadblock.
• Only for units of its own army. German assets act only in their own army's zone (16.1); German Strategic Reserve units take the artillery of the zone they stand in (15.1c); US Strategic Reserve units that of either US army (15.2).
• Supply: the Attacker's units must be supplied and trace supply, the Defender's must trace supply (6.22, 6.23, 9.34a).
• German limit (16.12): two artillery in one battle only as one regular plus one rocket asset of the same army.
• German attrition (16.12): each Reinforcement Phase, before the Used Box goes back to the cup, the German player eliminates one regular artillery asset of his choice from the Used Box.
• Hits on the Defender: the first removes field works; one artillery hit may be absorbed by disordering every defending unit (6.42). Artillery never takes a step loss (6.31).
• A defended roadblock may get one artillery asset of its own echelon (4.35); von der Heydte gets none (16.11).
• After the battle it goes to the Used Box (optional 18.7: a defender's artillery may be overrun).`,
  ],
  'bulge:rocket_artillery': [
    'Rocket artillery asset',
    `Combat: fires exactly like an artillery asset (6.25, 6.26): one die in the artillery step, with the same limits (2 attacking, 1 defending; own army, and German assets only in their own army's zone, 16.1).
• Never lost to German artillery attrition (16.12): it always goes back to the cup.
• Two German artillery assets in one battle must be one regular and one rocket asset of the same army (16.12).
• It never takes a step loss. After the battle it goes to the Used Box.`,
  ],
  'bulge:engineer': [
    'Engineer asset',
    `Admin Phase (4.2, 4.3): one function per engineer, then it goes to the Used Box. Not for unsupplied areas or units (9.34d).
• Blow up bridges (4.31): from a supplied, friendly-controlled, uncontested area, blow one or two bridges on that area's river boundaries. A bridge held by a Greif Team blows only on 1-5, one try per Admin Phase (17.12).
• Repair a bridge (4.32): from a supplied, friendly, uncontested area, when you control the far side or contest it. Optional 18.1: the Germans repair six bridges at most.
• Field works (4.33): in a supplied, friendly, uncontested area with a friendly unit of the engineer's Higher Echelon (US engineers are Strategic Reserve: any US unit, 15.2). One field works per area.
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1 or more. The first enemy unit to enter pays +1 MP and stops, and the marker goes; friendly units pass freely. Removed in the Supply Phase.
• Defended roadblock (4.35): the engineer chit itself stands in such an area. Every enemy unit entering stops and must fight it; it may try to blow bridges like a unit (5.35d). Only one artillery asset of its own echelon may help it (no events, no Special Action). Surviving, it goes to the Used Box in the Supply Phase; a hit eliminates it.
Combat (6.32, 6.33): a battle asset (one die, the chit's quality). Attacking, it may instead remove the enemy field works, if it survived the artillery and defensive fire; it still counts as a battle asset.
German engineers (14.52): only in their own army's zone; on a river that is also an army boundary either army's engineer may work from its own side; an army that lost its engineer may borrow another for bridging only.`,
  ],
  'bulge:armor_asset': [
    'Armor battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in battle set-up when all your units there are of its Higher Echelon (none with mixed echelons, unless US Pooled Assets, 14.62b). It fires with the ground units: one die, armor class (+1), with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a). German assets act only in their own army's zone (16.1).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  'bulge:infantry_asset': [
    'Infantry battle asset',
    `Combat (6.22, 6.23, 6.32): assign it in battle set-up when all your units there are of its Higher Echelon (none with mixed echelons, unless US Pooled Assets, 14.62b). It fires with the ground units: one die, infantry class, with the troop quality printed on the chit against the enemy point unit.
• Up to 8 battle assets attacking, 5 defending; your units there must be in supply (9.34a). German assets act only in their own army's zone (16.1); the US Strategic Reserve asset (509 + 551) may support any US army (15.2).
• It may take a loss before the point unit (6.43); one hit eliminates it. Otherwise it goes to the Used Box after the battle.`,
  ],
  heydte: [
    'Von der Heydte paradrop (6th Pz Army, 16.11)',
    `Admin Phase in which it is first drawn: drop it in Hohes Venn [31] or Stoumont [52], if that area is vacant and Allied-controlled. If not (or if you keep it), it stays in the Available Box as an ordinary 6th Panzer Army infantry battle asset and never gets another drop.
• While it is down, American units may not strat-move through or retreat into its area. The first American unit to enter pays +1 MP and stops, and the German player rolls one die:
• 1, landed intact: the Americans must fight it like a defended roadblock (4.35) in the Combat Phase. It gets no artillery support and never attacks; it fires only when defending (one die, veteran infantry).
• 2-5, partly scattered: the same, but it does not fire back; it only blocks movement and retreats.
• 6-10, completely scattered: it goes to the Eliminated Box and the American unit may carry on with the MP it has left.
• It stays in its area (never to the Used Box) until a hit eliminates it or a German unit relieves it.
• Relief: when a German unit enters its area, it goes to the Used Box and from then on is a regular battle asset. A relieving unit that enters a contested area is revealed.
• Supply: none needed before the 19 December turn (turn 4). From then on, if it cannot trace supply in the German Supply Phase it checks morale (4 or less) and is eliminated on a failure.`,
  ],
  'bulge:task_force': [
    'Task Force (US, turns 2-5)',
    `Reinforcement Phase (16.22): place it in any uncontested, friendly-controlled area that is in supply now; other friendly forces may be there. One kept in the Available Box may be placed in a later Reinforcement Phase; it is never assigned to a battle from the box. Once placed it acts exactly like a garrison (16.21):
• It never moves. German units entering its area pay +1 MP and stop.
• Alone it is fought like a defended roadblock (4.35): one artillery asset may help it, no other asset or event, no Special Action. With Allied units it is their battle asset (one die, green infantry) and may take a loss before the point unit.
• It cannot retreat. When the defenders retreat it is destroyed first and counts as one hit; the units may retreat only if a hit is left over (16.21, 6.42c).
• One hit, or a failed out-of-supply morale check in the Allied Supply Phase, eliminates it. It never goes to the Used Box and cannot come back by the alternate event use (4.21).`,
  ],
  'bulge:garrison': [
    'Garrison (US, 16.21)',
    `Placed by the scenario in Wiltz, Bastogne, Spa and St. Vith (Wiltz and Bastogne only in the Introductory Scenario). It never leaves its area until eliminated.
• German units entering its area pay +1 MP and stop.
• Alone it is fought like a defended roadblock (4.35): one artillery asset may help it, no other asset or event, no Special Action.
• With Allied units it is their battle asset (one die, green infantry) and may take a loss before the point unit.
• It cannot retreat. When the defenders retreat it is destroyed first and counts as one hit; the units may retreat only if a hit is left over.
• One hit, or a failed out-of-supply morale check in the Allied Supply Phase, eliminates it. An Air Supply mission over its area keeps it supplied (17.21).
• It never goes to the Used Box and cannot come back by the alternate event use (4.21).`,
  ],
  'bulge:fuel': [
    'Fuel asset (German, 16.13)',
    `With the fuel rule, a German unit (newly arriving ones too) may move more than 3 MP, or strat-move, only by spending one fuel asset from the Available Box. It goes to the Used Box and recycles through the cup like other assets. This holds in every movement phase: operational, reaction and breakthrough.
• Not needed for a one-area move, however many MP that costs (5.33).
• No fuel left: German units move at most 3 MP and cannot strat-move (and only one German strat-move per turn anyway, 14.81).
• The Germans start with five fuel assets in the Available Box.
• Captured fuel, the first time the Germans take each yellow-star area: roll one die. 1 = a captured fuel asset joins the Available Box (once per game; a later 1 counts as 2-5). 2-5 = one fuel asset moves from the Used Box (or the cup) to the Available Box. 6-10 = nothing.
• Bid fuel (18.2) is spent first and then eliminated: it never recycles and cannot come back by 4.21.
• Fuel is spent automatically when you make such a move.`,
  ],
  'bulge:command_staff': [
    'Command Staff asset',
    `Admin Phase, either player's (8.3): one staff function with no Higher Echelon limit, then it goes to the Used Box and recycles through the cup. Not for unsupplied units or areas (9.34d).
• Replacements found (8.31): one non-elite step to any supplied, reduced infantry-class unit.
• Intelligence gathering (8.32): reveal one enemy block anywhere, in any supply state, until the end of the Admin Phase.
• Reserves made available (8.33): put an available reserve marker on an eligible unit (supplied, in good order, uncontested, in the marker's zone, 14.7). In the enemy's Admin Phase this gives you a reserve for his Reaction Phase.
• German only, Boundary crossing pre-authorized (14.62a): one German army unit may leave its army's zone without the +2 MP; the marker goes after its next move or in the next German Supply Phase.
• Allied only, Pooled assets (14.62b): choose one area. Until this player-turn's Supply Phase, assets of any US army may support the American units there and mixed US echelons are no limit (the extra US artillery asset applies too).`,
  ],
  'bulge:sa_block': [
    'Special Action (reusable block)',
    `Your personal command influence (8.1): a wooden block, usable for units of any Higher Echelon, but never on units or areas out of supply (9.34d). After use it goes to the Used Box and comes back to Available in the next Reinforcement Phase. If it was still unused there, you may also bring one asset of your choice from the Used Box straight to Available (4.1a). Uses (8.2):
• Breakthrough movement (8.21): one supplied armor-class unit in good order that has not moved this phase moves one area in the Breakthrough Phase, like an exploitation unit.
• Breakthrough combat (8.22): fight a round in one already contested area in the Breakthrough Combat Phase.
• Reinforce a battle (8.23, defender only, before the Attacker assigns assets): one unit in good order from an adjacent uncontested area joins, within stacking. Never into a battle of a garrison, Task Force or defended roadblock alone. It cannot be the point unit unless the point unit falls.
• Retreat before combat (8.24, defender only): all defending units retreat without disorder; the Attacker gets an exploitation opportunity.
• Rally (8.25, Admin): all your disordered or recovering units in one supplied area and the areas next to it recover fully.
• Quality replacements (8.26, Admin): one step to a supplied reduced unit, even an elite step.
• Reroute a reinforcement (8.27, Reinforcement): place an arriving unit in another appropriate entry area.`,
  ],
  'bulge:special_action_event': [
    'Special Action (single-use event)',
    `A single-use Special Action (17.33): any one use of the reusable Special Action (8.2), but only for units of the Higher Echelon printed on it. It goes to the Eliminated Box after use and does not count as the battle's one event.
• German ones only in their own army's zone (17.1), for that army's units and Strategic Reserve units standing there (15.1c).
• US ones also for US Strategic Reserve units: the 82nd, 101st and 517th (15.2).
• Uses: breakthrough movement (8.21), breakthrough combat (8.22), reinforce a battle (8.23), retreat before combat (8.24), rally (8.25), quality replacements (8.26), reroute a reinforcement (8.27).`,
  ],
  'bulge:replacement_inf': [
    'Infantry replacement',
    `Admin Phase (17.31): one step to a supplied, reduced infantry-class unit of the printed Higher Echelon, even in a contested area.
• It cannot bring back an eliminated unit, nor be used when the step would make the unit elite.
• German chits: only in their own army's zone, for that army's units and Strategic Reserve units standing there (15.1c, 17.1). The German Strategic Reserve chit may go to a unit of any German army.
• US chits may also go to US Strategic Reserve units (15.2).
• Not for units out of supply or air-supplied (9.34d).`,
  ],
  'bulge:replacement_arm': [
    'Armor replacement',
    `Admin Phase (17.32): one step to a supplied, reduced armor-class unit of the printed Higher Echelon, even in a contested area.
• It cannot bring back an eliminated unit, nor be used when the step would make the unit elite.
• German chits: only in their own army's zone, for that army's units and Strategic Reserve units standing there (15.1c, 17.1).
• US chits may also go to US Strategic Reserve units (15.2).
• Not for units out of supply or air-supplied (9.34d).`,
  ],
  'bulge:rebuild_or_replace_inf': [
    'Rebuild or Replace (US 1st Army, infantry)',
    `Admin Phase (17.22), one of:
• Replace: one non-elite step to a supplied, reduced 1st Army (or US Strategic Reserve) infantry-class unit, as an infantry replacement (17.31).
• Rebuild: bring back an eliminated one-step, non-elite 1st Army infantry unit (the 109th, 110th or 112th Regiment of the 28th Division). Place it in any friendly-controlled objective area (an area with a VP symbol), even a contested one.
• Units of more than one step can never be rebuilt.`,
  ],
  'bulge:rebuild_or_replace_arm': [
    'Rebuild or Replace (US 1st Army, armor)',
    `Admin Phase (17.22), one of:
• Replace: one non-elite step to a supplied, reduced 1st Army (or US Strategic Reserve) armor-class unit, as an armor replacement (17.32).
• Rebuild: bring back an eliminated one-step, non-elite 1st Army armor unit (14th, 102nd or 4th Cavalry; CCA, CCB or CCR of the 9th Armored). Place it in any friendly-controlled objective area (an area with a VP symbol), even a contested one.
• Units of more than one step can never be rebuilt.`,
  ],
  'bulge:event_arriving_regiment': [
    'Arriving Infantry Regiment (US 1st Army, 17.23)',
    `Admin Phase, for the printed division only (1st or 4th Infantry Division): one step of replacements to it, if it is supplied and reduced, even in a contested area. For the 1st Infantry Division this may be its elite step.
• If that division is in the Eliminated Box, it comes back with one step in an appropriate friendly-controlled 1st Army entry area (A–J, 14.22) and leaves the Eliminated Large Units track (19.2).
• Otherwise it is an infantry replacement (17.31): it cannot go to any other unit.`,
  ],
  'bulge:event_release': [
    'Strategic Reserve Division Released (17.13)',
    `Admin Phase, in any zone: the printed division (11th Pz, 10th SS Pz, 17th SS PzGr or 6th SS Mountain) enters at once in Entry Area Y or Z, German player's choice. The area needs room (two German units at most) and must not be held by the enemy.
• Released units do not pay +2 MP for crossing army boundaries (15.1b).
• They use the assets and events of the army whose zone they stand in; stacked with another army's unit they may get artillery only (15.1c).`,
  ],
  'bulge:event_greif_bridge': [
    'Greif Team: Bridge (17.12)',
    `Admin Phase: place it on any river boundary with an intact bridge. It stays until the bridge is blown or a German unit crosses that boundary; then it goes to the Eliminated Box.
• When a German crossing lets the Allies try to blow the bridge (5.35d), they need a 1 instead of 1-5.
• An Allied engineer blowing it in the Admin Phase needs a 1-5 roll instead of blowing it automatically. If that fails, there is no second try on this bridge in the same Admin Phase.`,
  ],
  'bulge:event_greif_interdict': [
    'Greif Team: Interdict (17.11)',
    `Admin Phase: place it on an American block (not British, not a garrison). It stays with that unit until the unit next tries to move, build field works or take a reserve marker. The American player announces the activity first. Then the unit is revealed and checks morale with +2: a supplied unit in good order passes on 1-5 (green), 1-7 (veteran) or 1-9 (elite).
• Fail: this time it may only stay or move one area; no field works, no reserve. The reserve marker it was given cannot go to another unit this phase.
• Pass: it carries on normally.
• Either way the event then goes to the Eliminated Box.
• If its next move comes from a friendly Special Action (8.21 breakthrough, 8.23 reinforce, 8.24 retreat), the marker is removed with no effect.`,
  ],
  'bulge:event_bodenplatte': [
    'Operation Bodenplatte (17.14)',
    `Admin Phase: roll one die for each Air Mission now in the Allied Available Box (missions already on the map are safe): 1-5 = no effect, 6-9 = back to the Allied cup, 10 = eliminated (Player Aid D).
• Rule 17.14 prints the same odds the other way round: 1 eliminated, 2-5 back to the cup, 6-10 no effect.`,
  ],
  'bulge:event_delayed_response': [
    'Delayed Response',
    `No effect (17.34): when drawn it goes straight to the Eliminated Box, and it still counts as one of your draws. It cannot be used for the alternate use (4.21).`,
  ],
  'bulge:air_mission': [
    'Allied Air Mission (17.21)',
    `One of three missions, then it goes to the Eliminated Box. Unlike other events it may be used on unsupplied areas and units.
• Combat support, attacking or defending: it is the battle's one event, even with mixed Allied Higher Echelons. Choose before your artillery fires: either it fires as an extra artillery asset (outside the artillery limit), or one Allied unit of your choice gets +2 to its Success Number. It never takes a step loss, and it is eliminated even if the attack is aborted. Not for a garrison, Task Force or defended roadblock alone (4.35).
• Interdiction (Admin Phase): mark any area. German units pay +1 MP to enter it and +1 MP to leave it, and may not strat-move through it. Removed in this player-turn's Supply Phase.
• Air supply (any Supply Phase): declare one unsupplied area. It, its Allied units and any garrison there count as supplied until the next Supply Phase: no out-of-supply morale check, and disordered units may recover. They still cannot receive assets or be helped by events, Special Actions, staff or engineers (9.34a, 9.34d).
• While it waits in the Available Box, Operation Bodenplatte may delay or destroy it (17.14).`,
  ],
};
/** Any event chit, single-use Special Actions included (8.1), can instead return two assets from the Eliminated Box to the cup (4.21). */
export const ALT_USE =
  "Alternate use (4.21): instead of its printed effect, the event may return two of your assets of your choice from the Eliminated Box to the cup (never garrisons or Task Forces, nor The Bulge's bid fuel). Delayed Response cannot be used this way.";
export const ALT_USE_GOLAN =
  'Alternate use (4.21): in an Admin Phase, instead of its printed effect, an event (Special Action and replacement events included) may move two of your assets of your choice from the Eliminated Box to your cup. Never commandos, SAMs, air support or garrisons (17.4, 16.24). Operation Dugman 5 is played the moment it is drawn, so it has no alternate use.';
const escH = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** The description as HTML: paragraphs, and "• " lines as a list; events also get their alternate use. */
export function ruleHtml(kind: string, event = false): string {
  const d =
    (RULE[kind] ?? ['', ''])[1] +
    (event && !/event_(delayed_response|asset_delayed|dugman5)$/.test(kind)
      ? '\n' + (kind.startsWith('golan:') ? ALT_USE_GOLAN : ALT_USE)
      : '');
  let out = '',
    list = false;
  for (const line of d.split('\n')) {
    if (line.startsWith('• ')) {
      if (!list) {
        out += '<ul class="rl">';
        list = true;
      }
      out += `<li>${escH(line.slice(2))}</li>`;
    } else {
      if (list) {
        out += '</ul>';
        list = false;
      }
      if (line.trim()) out += `<p>${escH(line)}</p>`;
    }
  }
  return out + (list ? '</ul>' : '');
}
