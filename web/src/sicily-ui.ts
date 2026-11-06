/** Sicily on the shared interface: what its counters can be used on (the glowing-targets model of chit-play.ts), and the prompts only this
 *  volume has: the landing plan and the garrisons at set-up, the airborne drops, the Axis evacuation, dogfights, Shock and Awe, the
 *  Rangers' field works, the Fading Italian Morale picks, air supply. */
import * as E from '../../engine/src';
import type { Tgt, TgtCtx } from './chit-play';
import type { PanelCtx } from './golan-ui';
import { esc, nm } from './util';

const S = E.sicily;
type Game = E.Game;
const works = (g: Game, fn: (t: Game) => void) => { try { fn(structuredClone(g)); return true; } catch { return false; } };
const blank = (): Tgt => ({ units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: '' });
const LAND = () => [...E.areas.keys()].filter((a) => !S.isBox(a));
const PORTS = ['P1', 'P2', 'P3'] as const, PORT_NAME: Record<string, string> = { P1: 'Syracuse', P2: 'Catania', P3: 'Palermo' };

/** What a Sicily counter can be used on in the Admin Phase. */
export function sicilyTargets(get: () => Game, c: E.Chit | null, ctx: TgtCtx): Tgt | null {
  const g = get(); if (!c || g.phase !== 'admin' || c.box !== 'available') return null;
  const t = blank(), k = c.kind, side = c.side, a = ctx.area, id = c.id;
  const areasOk = (f: (x: Game, ar: number) => void) => LAND().filter((ar) => works(g, (x) => f(x, ar)));
  const unitsOk = (f: (x: Game, uid: string) => void) => g.units.filter((u) => u.area != null && works(g, (x) => f(x, u.id)));
  const run = (f: (x: Game) => void) => () => f(get());
  const pair = (f: (x: Game, from: number, to: number) => void, hint: string) => {
    const legal = (from: number) => E.neighbors(from).filter((n) => !S.isBox(n) && works(g, (x) => f(x, from, n)));
    for (const ar of LAND()) if (legal(ar).length) t.pick.set(ar, () => { ctx.setArea(ar); });
    if (a != null && legal(a).length) { t.focus = true; t.color.set(a, 0xe7b04a); for (const n of legal(a)) { t.areas.set(n, run((x) => f(x, a, n))); t.color.set(n, 0x5d8b3a); } t.hint = `${ctx.areaName(a)}: tap the green neighbour`; }
    else t.hint = hint;
  };
  const single = (f: (x: Game, ar: number) => void, hint: string) => { for (const ar of areasOk(f)) t.areas.set(ar, run((x) => f(x, ar))); t.hint = t.areas.size ? hint : 'No area qualifies right now'; };
  const units = (f: (x: Game, uid: string) => void, hint: string) => { for (const u of unitsOk(f)) t.units.set(u.id, run((x) => f(x, u.id))); t.hint = t.units.size ? hint : 'No block qualifies right now'; };
  const modes = (list: { id: string; icon: string; label: string; apply: () => void }[]) => {
    for (const m of list) t.modes.push({ id: m.id, icon: m.icon, label: m.label });
    let mode = ctx.mode; if (!list.some((m) => m.id === mode)) { mode = list[0]?.id ?? ''; ctx.setMode(mode); }
    list.find((m) => m.id === mode)?.apply();
  };
  switch (k) {
    case 'engineer': modes([
      { id: 'blow', icon: 'xbold', label: 'Blow a bridge (4.31)', apply: () => pair((x, f, n) => E.blowBridges(x, id, f, [n]), 'Tap the area the engineer works from, then the bridge to blow') },
      { id: 'repair', icon: 'engineer', label: 'Repair a bridge (4.32)', apply: () => pair((x, f, n) => E.repairBridge(x, id, f, n), 'Tap the area the engineer works from, then the bridge to repair') },
      { id: 'fw', icon: 'gear', label: 'Field works (4.33)', apply: () => single((x, ar) => E.fieldWorksFor(x, id, ar), 'Tap a glowing area to build field works') },
      { id: 'port', icon: 'wave', label: side === 'axis' ? 'Damage a port (14.51)' : 'Repair a port (14.51)', apply: () => { for (const p of PORTS) if (works(g, (x) => S.portWork(x, id, p))) t.buttons.push({ icon: 'wave', label: `${side === 'axis' ? 'Damage' : 'Repair'} ${PORT_NAME[p]}`, fn: run((x) => S.portWork(x, id, p)) }); t.hint = t.buttons.length ? 'One damage level per Admin Phase; the port must be yours, supplied and uncontested' : 'No port can be worked on now (yours, supplied, uncontested; the Allies need a unit of the right army there)'; } },
    ]); break;
    case 'air_mission': modes([
      { id: 'interdict', icon: 'warn', label: 'Interdiction (16.33): +1 MP in and out, no strat-move', apply: () => single((x, ar) => S.airInterdiction(x, id, ar), 'Tap the area to interdict') },
      { id: 'dogfight', icon: 'air_mission', label: 'Dogfight (16.31): cancel an enemy interdiction', apply: () => single((x, ar) => S.dogfightInterdiction(x, id, ar), 'Tap the interdicted area') },
    ]); break;
    case 'event_army_release': t.buttons.push({ icon: 'next', label: 'Release the 7th Army', fn: run((x) => S.playArmyRelease(x, id)), title: '17.23: every American division may leave its original zones (never zone B)' }); t.hint = 'US 7th Army Release'; break;
    case 'event_patton_slap': t.buttons.push({ icon: 'flag', label: 'Play the event', fn: run((x) => S.playPatton(x, id)), title: '17.11: from now on a US single-use Special Action costs two events' }); t.hint = 'Patton Soldier Slap'; break;
    case 'event_tactical_extract': t.buttons.push({ icon: 'next', label: 'Play the event', fn: run((x) => S.playTacticalExtract(x, id)), title: '17.12: this Movement Phase German units may leave contested areas towards Messina; they end recovering' }); t.hint = 'Axis Tactical Extract'; break;
    case 'event_fading_morale': t.buttons.push({ icon: 'warn', label: 'Italian morale fades', fn: run((x) => S.playFadingMorale(x, id)), title: '17.21: one level worse; Italian assets are eliminated and the Italian units check morale in every battle' }); t.hint = `Fading Italian Morale (now level ${S.state(g).morale})`; break;
    case 'infantry_asset': if (!c.flank) return null; single((x, ar) => S.playFlanking(x, id, ar), 'Tap an Axis-held coastal area within two areas of your units on the coast: the asset lands there'); break;
    case 'replacement_inf': case 'replacement_arm': units((x, uid) => E.playReplacement(x, id, uid), 'Tap a glowing block to add a non-elite step'); break;
    case 'sa_block': case 'special_action_event': {
      const list: { id: string; icon: string; label: string; apply: () => void }[] = [
        { id: 'rally', icon: 'flag', label: 'Rally (8.25): an area and its neighbours recover', apply: () => single((x, ar) => E.rally(x, side, ar, id), 'Tap a supplied friendly area: disordered blocks there and next to it recover') },
        { id: 'repl', icon: 'infantry_asset', label: 'Quality replacement (8.26): one step', apply: () => units((x, uid) => E.qualityReplacement(x, uid, id), 'Tap a glowing block to add a step') },
      ];
      if (side === 'allied') list.push({ id: 'release', icon: 'next', label: 'Release a division (14.61)', apply: () => units((x, uid) => { const u = x.units.find((v) => v.id === uid)!; S.releaseDivision(x, u.division!, id); }, 'Tap a block of the division to release from its army boundaries') });
      modes(list); break;
    }
    case 'command_staff': modes([
      ...(side === 'axis' ? [{ id: 'recover', icon: 'undo', label: 'An Italian infantry asset back (14.63)', apply: () => { for (const x of g.chits.filter((y) => works(g, (z) => S.axisStaffRecover(z, id, y.id)))) t.chips.push({ label: x.name, img: '', fn: run((z) => S.axisStaffRecover(z, id, x.id)) }); t.hint = t.chips.length ? 'Tap the eliminated Italian infantry asset to bring back to the Available Box' : 'No eliminated Italian infantry asset'; } }]
        : [{ id: 'repl', icon: 'infantry_asset', label: 'Replacements found (8.31)', apply: () => units((x, uid) => E.staffReplacement(x, id, uid), 'Tap a glowing infantry-class block for a non-elite step') }]),
      { id: 'intel', icon: 'info', label: 'Intelligence gathering (8.32)', apply: () => units((x, uid) => E.staffIntel(x, id, uid), 'Tap an enemy block to see it') },
      { id: 'reserve', icon: 'sa_block', label: 'Reserves made available (8.33)', apply: () => units((x, uid) => E.staffReserve(x, id, uid), 'Tap a glowing block for a reserve marker') },
    ]); break;
    default: return null;
  }
  if (k.startsWith('event') || k === 'special_action_event') {                                        // 4.21: any event can instead bring two assets back
    if (works(g, (x) => E.alternateUse(x, id))) t.buttons.push({ icon: 'swap', label: 'Instead: bring two assets back to the cup', fn: run((x) => E.alternateUse(x, id)), title: '4.21: the event is spent to return two assets from the Eliminated Box to the cup' });
  }
  return t;
}
export const sicilyBattleCard = (c: E.Chit) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission';

let planPick: { plan: E.sicily.Plan; br: string; us: string } = { plan: 'historical', br: 'B1', us: 'D1' };
/** The volume's own prompts, above the hand. */
export function sicilyPanel(g: Game, ctx: PanelCtx): string {
  const V = S.state(g), b = g.battle, out: string[] = [], live = ctx.get;
  if (g.phase === 'deploy') {
    const garr = g.units.filter((u) => u.untried && u.box === 'deploy').length;
    if (ctx.mine('axis') && garr) out.push(`<div class="volpanel"><b>${ctx.ico('lock')} Italian garrisons (22.24)</b><span>${garr} untried garrisons to place face down, one per area, never with two tried units: drag them from the tray, or place them all at random.</span><div class="row">${ctx.btn('Place the rest at random', () => S.autoGarrisons(live()), 'primary')}</div></div>`);
    if (ctx.mine('allied') && !V.plan && !S.isSunrise(g)) {
      if (garr) out.push(`<div class="volpanel"><b>${ctx.ico('next')} Landing plan</b><span>The Axis places its garrisons first; then you choose the landing plan after seeing its set-up (22.24).</span></div>`);
      else {
        const o = S.planOptions(g, planPick.plan), chips = (list: string[], cur: string, set: (v: string) => void) => list.map((v) => ctx.ubtn(v, () => set(v), v === cur ? 'on' : '')).join('');
        const pick = (p: E.sicily.Plan) => { planPick = { ...planPick, plan: p, br: S.planOptions(g, p).british[0], us: S.planOptions(g, p).us[0] ?? '' }; };
        out.push(`<div class="volpanel"><b>${ctx.ico('next')} Landing plan (22.25, 22.26)</b><span>${planPick.plan === 'historical' ? 'Historical: the British in five consecutive zone B boxes (zone B; released: A, B, C), the Americans at A1-A4 (zones A and C; released: D).' : 'Alternate: the British in five consecutive boxes across zones A and B (zones A, B; released: C), the Americans in four consecutive zone D boxes (zones C, D; released: A).'}</span>
          <div class="row">${ctx.ubtn('Historical', () => pick('historical'), planPick.plan === 'historical' ? 'on' : '')}${ctx.ubtn('Alternate', () => pick('alternate'), planPick.plan === 'alternate' ? 'on' : '')}</div>
          <span>First British box:</span><div class="row">${chips(o.british, planPick.br, (v) => { planPick = { ...planPick, br: v }; })}</div>
          ${o.us.length ? `<span>First American box:</span><div class="row">${chips(o.us, planPick.us, (v) => { planPick = { ...planPick, us: v }; })}</div>` : ''}
          <div class="row">${ctx.btn('Place the beachheads', () => S.choosePlan(live(), planPick.plan, planPick.br, planPick.us || undefined), 'primary')}</div></div>`);
      }
    }
    const inv = g.units.filter((u) => !u.untried && u.box === 'deploy').length;
    if (ctx.mine('allied') && V.plan && inv) out.push(`<div class="volpanel"><b>${ctx.ico('next')} Invasion units (14.24)</b><span>${inv} to place, two per beachhead of their own nationality: drag them from the tray, or place them all at once. The airborne divisions wait in the Airborne Assault box.</span><div class="row">${ctx.btn('Place them all', () => S.autoLanding(live()), 'primary')}</div></div>`);
  }
  if (!b && g.phase === 'combat' && g.phasing === 'allied' && V.dropPending && ctx.mine('allied')) {
    for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) {
      const t = S.airDropTargets(g, u.id);
      out.push(`<div class="volpanel"><b>${ctx.ico('air_mission')} ${esc(u.name)}: airborne assault (14.27a)</b><span>${t.length ? 'Drop into an area next to at least two areas holding its own army, before any battle. Against defenders it is a River Assault that cannot be aborted.' : 'No drop zone is open: the unit is lost.'}</span><div class="row">${t.length ? ctx.ubtn('Choose the drop zone', () => ctx.pickArea(`${u.name}: tap the drop zone`, t, (a) => S.airDrop(live(), u.id, a)), 'primary') : ctx.btn('The unit is lost', () => S.airDrop(live(), u.id, null), 'primary')}</div></div>`);
    }
  }
  if ((g.phase === 'movement' || g.phase === 'strategic') && g.phasing === 'axis' && ctx.mine('axis')) {
    const ev = g.units.filter((u) => S.canEvacuate(g, u));
    if (ev.length) out.push(`<div class="volpanel"><b>${ctx.ico('next')} Evacuation (14.29)</b><span>A unit in Messina may leave for the mainland for one MP, for good.</span><div class="row">${ev.map((u) => ctx.btn(`Evacuate ${esc(u.name)}`, () => S.evacuate(live(), u.id))).join('')}</div></div>`);
  }
  if (g.phase === 'admin' && V.moralePick) for (const sd of ['axis', 'allied'] as const) {
    if (!V.moralePick[sd] || !ctx.mine(sd) || (sd === 'allied' && V.moralePick.axis)) continue;
    const pool = g.chits.filter((x) => x.side === 'axis' && x.nation === 'italian' && x.box === 'available' && x.kind !== 'command_staff' && (E.isArty(x) || E.isBattleAsset(x)));
    out.push(`<div class="volpanel"><b>${ctx.ico('warn')} Fading Italian Morale (17.21c)</b><span>${nm(sd)}: pick ${V.moralePick[sd]} Italian asset${V.moralePick[sd] > 1 ? 's' : ''} in the Axis Available Box to eliminate.</span><div class="row">${pool.map((x) => ctx.btn(esc(x.name), () => S.pickMoraleLoss(live(), sd, x.id))).join('')}</div></div>`);
  }
  if (b && b.stage === 'setup') {
    for (const sd of E.sidesOf(g)) {
      if (!ctx.mine(sd)) continue;
      const enemyAir = E.airOf(b, E.other(sd)), mine = g.chits.find((x) => x.kind === 'air_mission' && x.side === sd && x.box === 'available');
      if (enemyAir.length && mine && !S.battleState(b).noAir[sd]) out.push(`<div class="volpanel"><b>${ctx.ico('air_mission')} Dogfight (16.31)</b><span>${nm(sd)}: cancel the enemy air support over this battle with your own ${esc(mine.name)}; both are used, and neither side flies more here.</span><div class="row">${ctx.btn('Dogfight', () => S.dogfight(live(), live().battle!, mine.id), 'primary')}</div></div>`);
    }
    if (ctx.mine(b.attacker) && g.fieldWorks.includes(b.area)) {
      const key = `${b.area}`, nav = b.assets[b.attacker].map((id) => E.chit(g, id)).filter((x) => x.kind === 'naval_support'), rng = b.assets[b.attacker].map((id) => E.chit(g, id)).filter((x) => x.subtype === 'ranger' || x.subtype === 'commando');
      if (nav.length) out.push(`<div class="volpanel"><b>${ctx.ico('wave')} Shock and Awe (16.21)</b><span>One naval support asset removes the defending field works instead of firing.</span><div class="row">${nav.map((x) => ctx.btn(esc(x.name), () => S.setNavalShock(live(), live().battle!, V.navalShock[key] === x.id ? null : x.id), V.navalShock[key] === x.id ? 'on' : '')).join('')}</div></div>`);
      if (rng.length) out.push(`<div class="volpanel"><b>${ctx.ico('infantry_asset')} Rangers (16.22)</b><span>A Ranger or Commando asset removes the field works instead of rolling, if the attack goes on and it survives the defensive fire.</span><div class="row">${rng.map((x) => ctx.btn(esc(x.name), () => S.setRangerFw(live(), live().battle!, V.rangerFw[key] === x.id ? null : x.id), V.rangerFw[key] === x.id ? 'on' : '')).join('')}</div></div>`);
    }
    if (S.battleState(b).flank) out.push(`<div class="volpanel"><small>A flanking invasion: the Allies may commit only air and naval support (17.22).</small></div>`);
  }
  if (g.phase === 'supply' && ctx.mine(g.phasing)) {
    const air = g.chits.find((x) => x.kind === 'air_mission' && x.side === g.phasing && x.box === 'available');
    const need = [...new Set(g.units.filter((u) => u.side === g.phasing && u.area != null && u.unsupplied && !S.isBox(u.area)).map((u) => u.area!))];
    if (air && need.length && !g.airSupply) out.push(`<div class="volpanel"><b>${ctx.ico('air_mission')} Air supply (16.34)</b><span>One unsupplied area gets no morale checks this Supply Phase and its units may recover.</span><div class="row">${ctx.ubtn('Choose the area', () => ctx.pickArea('Air supply: tap the area', need, (a) => S.airSupply(live(), air.id, a)), 'primary')}</div></div>`);
  }
  if (g.phase === 'supply' && g.airSupply && ctx.mine(E.other(g.airSupply.side))) {
    const air = g.chits.find((x) => x.kind === 'air_mission' && x.side !== g.airSupply!.side && x.box === 'available');
    if (air) out.push(`<div class="volpanel"><b>${ctx.ico('air_mission')} Dogfight (16.31)</b><span>Cancel the enemy Air Supply mission over ${esc(ctx.areaName(g.airSupply.area))} with ${esc(air.name)}.</span><div class="row">${ctx.btn('Dogfight', () => S.dogfightAirSupply(live(), air.id))}</div></div>`);
  }
  return out.length ? `<div class="volstack">${out.join('')}</div>` : '';
}
/** Why combat cannot begin yet, or null. */
export const sicilyBlocksBegin = (g: Game) => (S.state(g).dropPending ? 'The airborne units must drop first (14.27a)' : null);
/** Holding boxes of the volume, for the pieces panel. */
export const SICILY_BOXES: Record<string, string> = { deploy: 'To be placed', airborne_assault: 'Airborne Assault box', at_sea: 'At Sea', evacuated: 'Evacuated to the mainland' };
