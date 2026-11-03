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
• Roadblock (4.34): in a supplied, friendly, vacant area with Terrain Difficulty 1+. The first enemy unit entering pays +1 MP and stops.
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
• It cannot retreat; it is eliminated by a hit or a failed out-of-supply morale check, and cannot be returned by the alternate event use (4.21).`],
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
  air_mission: ['Allied Air Mission', `One of three missions (17.21), then it goes to the Eliminated Box. It may be played on unsupplied areas.
• Combat support: the battle's one event; either fires as artillery (outside the artillery limit), or gives +2 to one Allied unit's Success Number. It cannot take a step-loss.
• Interdiction (Admin): mark an area; Germans pay +1 MP to enter AND to leave it and may not strat-move through it, until the Supply Phase.
• Air supply (Supply Phase): one unsupplied area and its units are supplied until the next Supply Phase.`],
};
/** Any event chit (not a Special Action) can instead return two assets from the Eliminated Box to the cup (4.21). */
export const ALT_USE = 'Alternate use (4.21): instead of its printed effect, any event may return two of your assets from the Eliminated Box to the cup.';
const escH = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** The description as HTML: paragraphs, and "• " lines as a list; events also get their alternate use. */
export function ruleHtml(kind: string, event = false): string {
  const d = (RULE[kind] ?? ['', ''])[1] + (event && kind !== 'event_delayed_response' ? '\n' + ALT_USE : ''); let out = '', list = false;
  for (const line of d.split('\n')) {
    if (line.startsWith('• ')) { if (!list) { out += '<ul class="rl">'; list = true; } out += `<li>${escH(line.slice(2))}</li>`; }
    else { if (list) { out += '</ul>'; list = false; } if (line.trim()) out += `<p>${escH(line)}</p>`; }
  }
  return out + (list ? '</ul>' : '');
}
