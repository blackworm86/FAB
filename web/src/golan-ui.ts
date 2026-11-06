/** Golan '73 on the shared interface: what its own counters can be used on (the same glowing-targets model as The Bulge's chit-play.ts), its cards in a
 *  battle (EW jamming, counterbattery), and the prompts only this volume has: the SAM answer to an Israeli air mission, the 82nd Para's air assault,
 *  a Syrian engineer bridging the ditch instead of firing, the Defender's answer to jamming. */
import * as E from '../../engine/src';
import type { Tgt, TgtCtx } from './chit-play';
import { esc, nm } from './util';

const G = E.golan;
type Game = E.Game;
const works = (g: Game, fn: (t: Game) => void) => { try { fn(structuredClone(g)); return true; } catch { return false; } };
const blank = (): Tgt => ({ units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: '' });
const AREAS = () => [...E.areas.keys()];
const onMap = (a: number) => a < 100;                                                                  // not the Assembly areas

/** What a Golan counter can be used on in the Admin Phase: blocks and areas light up, a tap applies it; two-area functions pick the first area, then a neighbour. */
export function golanTargets(get: () => Game, c: E.Chit | null, ctx: TgtCtx): Tgt | null {
  const g = get(); if (!c || g.phase !== 'admin' || c.box !== 'available') return null;
  const t = blank(), k = c.kind, side = c.side, a = ctx.area, id = c.id;
  const areasOk = (f: (x: Game, ar: number) => void) => AREAS().filter((ar) => works(g, (x) => f(x, ar)));
  const unitsOk = (f: (x: Game, uid: string) => void) => g.units.filter((u) => works(g, (x) => f(x, u.id)));
  const run = (f: (x: Game) => void) => () => f(get());
  /** A two-area function (bridges, the ditch, a minefield): the areas with a legal neighbour glow as picks; with one chosen, its legal neighbours glow as targets. */
  const pair = (f: (x: Game, from: number, to: number) => void, hint: string) => {
    const legal = (from: number) => E.neighbors(from).filter((n) => onMap(n) && works(g, (x) => f(x, from, n)));
    for (const ar of AREAS().filter(onMap)) if (legal(ar).length) t.pick.set(ar, () => { ctx.setArea(ar); });
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
      { id: 'blow', icon: 'xbold', label: 'Blow a bridge (4.31)', apply: () => pair((x, f, n) => G.blowBridges(x, id, f, [n]), 'Tap the area the engineer works from, then the bridge to blow') },
      { id: 'repair', icon: 'engineer', label: 'Repair a bridge (4.32)', apply: () => pair((x, f, n) => G.repairBridge(x, id, f, n), 'Tap the area the engineer works from, then the bridge to repair') },
      { id: 'ditch', icon: 'wave', label: 'Bridge the AT ditch (14.51a)', apply: () => pair((x, f, n) => G.bridgeDitch(x, id, f, n), 'Tap the area the engineer works from, then the ditch boundary to bridge') },
      ...(side === 'syrian' ? [{ id: 'mine', icon: 'warn', label: 'Lift a minefield (14.52)', apply: () => pair((x, f, n) => G.removeMinefield(x, id, f, n), 'Tap the area next to the minefield, then across it') }] : []),
      { id: 'fw', icon: 'gear', label: 'Field works (4.33)', apply: () => single((x, ar) => G.engineerFieldWorks(x, id, ar), 'Tap a glowing area to build field works') },
      { id: 'rb', icon: 'flag', label: 'Roadblock (4.34)', apply: () => single((x, ar) => E.roadblock(x, id, ar, false), 'Tap a glowing area for the roadblock') },
      { id: 'drb', icon: 'engineer', label: 'Defended roadblock (4.35)', apply: () => single((x, ar) => E.roadblock(x, id, ar, true), 'Tap a glowing area: the engineer stands there as a defended roadblock') },
    ]); break;
    case 'air_mission': modes([
      { id: 'interdict', icon: 'warn', label: 'Interdiction (16.31b): +1 MP in and out', apply: () => single((x, ar) => G.airInterdiction(x, id, ar), 'Tap the area to interdict') },
      { id: 'recon', icon: 'info', label: 'Reconnaissance (16.31c): see the enemy blocks', apply: () => single((x, ar) => G.airRecon(x, id, ar), 'Tap an enemy-occupied area') },
    ]); break;
    case 'commando': single((x, ar) => G.placeRaid(x, id, ar), 'Tap a vacant Israeli area next to Syrian units: the commandos land there'); break;
    case 'event_lt_zvika': single((x, ar) => G.playLtZvika(x, id, ar), 'Tap an empty Israeli area: Lt. Zvika holds it'); break;
    case 'event_release': if (works(g, (x) => G.playRelease(x, id))) t.buttons.push({ icon: 'next', label: 'Release the unit', fn: run((x) => G.playRelease(x, id)), title: '17.11: it arrives next Reinforcement Phase at a Syrian entry area' }); t.hint = t.buttons.length ? 'The unit is released from the Strategic Reserve' : 'That unit is already in play'; break;
    case 'event_ssm_strike': t.buttons.push({ icon: 'air_mission', label: 'Fire the SSMs', fn: run((x) => G.playSSM(x, id)), title: '17.12: each Israeli air asset in the Available Box goes back to the cup on 1–2' }); t.hint = 'Strike the Israeli air assets'; break;
    case 'event_king_hassan': t.buttons.push({ icon: 'flag', label: 'Play the event', fn: run((x) => G.playKingHassan(x, id)), title: '17.24: the Moroccan brigade fires only in defence and keeps out of Israeli-controlled areas' }); t.hint = "King Hassan's Troublemakers"; break;
    case 'replacement_arm': case 'replacement_mech': units((x, uid) => G.playReplacement(x, id, uid), 'Tap a glowing block to add a step'); break;
    case 'event_arriving_battalion': {
      const bros = g.units.filter((u) => u.side === 'israeli' && u.brigade && u.brigade === c.brigade);
      units((x, uid) => G.playArrivingBattalion(x, id, { add: uid }), 'Tap a glowing block for +2 steps');
      if (bros.length === 2 && works(g, (x) => G.playArrivingBattalion(x, id, { split: [bros[0].id, bros[1].id] }))) t.buttons.push({ icon: 'plus', label: '+1 step to each', fn: run((x) => G.playArrivingBattalion(x, id, { split: [bros[0].id, bros[1].id] })) });
      for (const u of bros.filter((x) => x.area == null && x.str === 0)) for (const asm of ['A', 'B'] as const) if (works(g, (x) => G.playArrivingBattalion(x, id, { rebuild: u.id, assembly: asm }))) t.chips.push({ label: `${u.name} back in Assembly ${asm}`, img: ctx.face({ ...u, str: u.max }), fn: run((x) => G.playArrivingBattalion(x, id, { rebuild: u.id, assembly: asm })) });
      if (!t.units.size && !t.buttons.length && !t.chips.length) t.hint = `No ${c.brigade} unit can take the steps now`;
      break;
    }
    case 'sa_block': case 'special_action_event': {
      const list: { id: string; icon: string; label: string; apply: () => void }[] = [
        { id: 'rally', icon: 'flag', label: 'Rally (8.25): an area and its neighbours recover', apply: () => single((x, ar) => E.rally(x, side, ar, id), 'Tap a supplied friendly area: disordered blocks there and next to it recover') },
        { id: 'repl', icon: 'infantry_asset', label: 'Quality replacement (8.26): one step', apply: () => units((x, uid) => E.qualityReplacement(x, uid, id), 'Tap a glowing block to add a step') },
      ];
      if (side === 'israeli') list.push({ id: 'merge', icon: 'swap', label: 'Merge two units (14.61a)', apply: () => {
        const from = ctx.mode.startsWith('merge:') ? ctx.mode.slice(6) : '';
        if (!from) { for (const u of g.units.filter((u) => u.side === 'israeli' && u.area != null && g.units.some((v) => works(g, (x) => G.mergeUnits(x, u.id, v.id, id))))) t.units.set(u.id, () => { ctx.setMode('merge:' + u.id); }); t.hint = 'Tap the block that folds into another'; }
        else { for (const v of g.units.filter((v) => works(g, (x) => G.mergeUnits(x, from, v.id, id)))) t.units.set(v.id, run((x) => G.mergeUnits(x, from, v.id, id))); t.hint = `Tap the block that takes ${g.units.find((u) => u.id === from)?.name ?? 'its'} steps`; } } });
      if (side === 'syrian' && works(g, (x) => G.releaseOperationalReserve(x, id))) list.push({ id: 'release', icon: 'next', label: 'Release the next 3rd Tank Division unit (14.61b)', apply: () => { t.buttons.push({ icon: 'next', label: 'Release the next unit', fn: run((x) => G.releaseOperationalReserve(x, id)) }); t.hint = '15th, 81st, 65th, in that order'; } });
      const lost = g.chits.find((x) => x.side === side && x.box === 'eliminated' && x.kind === (side === 'syrian' ? 'sam' : 'air_mission'));
      if (lost) list.push({ id: 'asset', icon: 'air_mission', label: side === 'syrian' ? 'Replace a lost SAM (14.61c)' : 'Replace a lost air asset (14.61d)', apply: () => { t.buttons.push({ icon: 'undo', label: `Bring back ${lost.name}`, fn: run((x) => G.replaceAsset(x, side, lost.id, id)) }); t.hint = 'From the Eliminated Box back into the cup'; } });
      modes(list);
      break;
    }
    case 'command_staff': modes([
      { id: 'repl', icon: 'infantry_asset', label: 'Replacements found (8.31)', apply: () => units((x, uid) => E.staffReplacement(x, id, uid), 'Tap a glowing infantry-class block for a non-elite step') },
      { id: 'intel', icon: 'info', label: 'Intelligence gathering (8.32)', apply: () => units((x, uid) => E.staffIntel(x, id, uid), 'Tap an enemy block to see it') },
      { id: 'reserve', icon: 'sa_block', label: 'Reserves made available (8.33)', apply: () => units((x, uid) => E.staffReserve(x, id, uid), 'Tap a glowing block for a reserve marker') },
    ]); break;
    case 'sam': t.hint = 'SAMs answer Israeli air missions east of the barrier when they are flown (16.12)'; return t;
    default: return null;
  }
  if (k.startsWith('event') || k === 'special_action_event') {                                        // 4.21: any event can instead bring two assets back
    const back = g.chits.filter((x) => x.side === side && x.box === 'eliminated' && works(g, (y) => G.alternateEventUse(y, id, [x.id]))).slice(0, 2);
    if (back.length) t.buttons.push({ icon: 'swap', label: `Instead: bring back ${back.map((x) => x.name).join(' and ')}`, fn: run((x) => G.alternateEventUse(x, id, back.map((y) => y.id))), title: '4.21: the event is spent to return two assets from the Eliminated Box to the cup' });
  }
  return t;
}

/** Cards that go into a battle's set-up: assets, air support, and the two combat events. Returns the refusal, or null when the card can be played now. */
export function golanBattleUse(g: Game, b: E.Battle, c: E.Chit): string | null {
  if (c.kind === 'event_ew') return b.stage !== 'setup' ? 'events are played before the first roll' : c.side === b.attacker ? (works(g, (x) => G.playJamming(x, x.battle!, c.id)) ? null : 'the Defender has already assigned assets, or an event was played') : (G.battleState(b).ew?.pending ? null : 'countermeasures answer a jamming (17.33)');
  if (c.kind === 'event_counterbattery') return works(g, (x) => G.playCounterbattery(x, x.battle!, c.id)) ? null : 'one event per side, before the first roll (17.34)';
  return E.canAssign(g, b, c.side, c);
}
/** Play a Golan combat event card into the open battle (assets go through the series assign). */
export function golanPlayInBattle(g: Game, b: E.Battle, c: E.Chit) {
  if (c.kind === 'event_ew') { if (c.side === b.attacker) G.playJamming(g, b, c.id); else G.answerJamming(g, b, c.id); return true; }
  if (c.kind === 'event_counterbattery') { G.playCounterbattery(g, b, c.id); return true; }
  return false;
}
export const golanBattleCard = (c: E.Chit) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'air_mission' || c.kind === 'event_ew' || c.kind === 'event_counterbattery';

/** What the shared screen hands the volume's prompts. */
export interface PanelCtx { btn: (label: string, f: () => void, cls?: string, dis?: boolean, title?: string) => string; ubtn: (label: string, f: () => void, cls?: string, dis?: boolean, title?: string) => string;
  /** The game as it is now (a remote write may have replaced the one the panel was drawn for). */ get: () => Game; mine: (s: E.Side) => boolean; pickArea: (label: string, areas: number[], run: (a: number) => void) => void; areaName: (a: number) => string; ico: (k: string) => string }
/** The volume's own prompts, above the hand: the SAM answer, the air assault, the engineer's bridging choice, the jamming answer. */
export function golanPanel(g: Game, ctx: PanelCtx): string {
  const V = G.state(g), b = g.battle, out: string[] = [], live = ctx.get;                            // the buttons act on the game as it is when tapped, not as it was drawn
  if (V.samTarget) {
    const air = E.chit(g, V.samTarget), sams = g.chits.filter((c) => c.kind === 'sam' && c.box === 'available'), own = ctx.mine('syrian');
    out.push(`<div class="volpanel sam"><b>${ctx.ico('warn')} SAM fire (16.12)</b><span>Syria may answer the Israeli ${esc(air.name)}${air.area != null && air.area < 100 ? ` over ${esc(ctx.areaName(air.area))}` : ''}.</span><div class="row">${sams.length ? ctx.btn(`Fire a SAM (${sams.length} ready)`, () => { G.fireSam(live(), sams[0].id); }, 'primary', !own) : ''}${ctx.btn('Let it fly', () => G.declineSam(g), '', !own)}</div></div>`);
  }
  if (b && b.stage === 'setup') {
    const B = G.battleState(b), def = E.other(b.attacker);
    if (B.ew?.pending) out.push(`<div class="volpanel"><b>${ctx.ico('warn')} Jamming (17.33)</b><span>${nm(def)}: each defending unit rolls, 5 or less disordered. Play your EW card for +2 to each roll, or roll without it.</span><div class="row">${ctx.btn('Roll without countermeasures', () => G.answerJamming(live(), b), 'primary', !ctx.mine(def))}</div></div>`);
    if (b.attacker === 'syrian' && b.area < 100 && !G.isAssembly(b.area) && b.assets.syrian.some((id) => E.chit(g, id).kind === 'engineer')) {
      const ditch = E.neighbors(b.area).filter((n) => n < 100 && E.connection(b.area, n)?.atDitch && !V.bridgedDitch.includes(E.edgeKey(b.area, n)));
      if (ditch.length) out.push(`<div class="volpanel"><b>${ctx.ico('engineer')} Engineer (14.51b)</b><span>Bridge the AT ditch instead of firing (if it survives both fire steps):</span><div class="row">${ditch.map((n) => ctx.btn(`towards ${esc(ctx.areaName(n))}`, () => G.setEngineerBridge(live(), b, B.engBridge === E.edgeKey(b.area, n) ? null : n), B.engBridge === E.edgeKey(b.area, n) ? 'on' : '', !ctx.mine('syrian'))).join('')}</div></div>`);
    }
    for (const s of E.sidesOf(g)) if (B.event[s]) out.push(`<div class="volpanel"><small>${nm(s)} event: ${esc(E.chit(g, B.event[s]!).name)}</small></div>`);
  }
  const N = V.nafakh;
  if (N && !N.s03Free && g.phasing === 'syrian' && (g.phase === 'admin' || g.phase === 'movement') && ctx.mine('syrian') && g.units.some((u) => u.id === 'S03' && u.area != null)) {
    const sa = E.saAvailable(g, 'syrian').length > 0;
    out.push(`<div class="volpanel"><b>${ctx.ico('lock')} The 33rd holds Tel Fazra (22.46)</b><span>It may not leave its area until a Special Action is spent on it.</span><div class="row">${ctx.btn('Spend a Special Action: free the 33rd', () => G.freeThe33rd(g), '', !sa, sa ? '' : 'No Special Action available')}</div></div>`);
  }
  if (N && !N.golani && g.phasing === 'israeli' && g.phase === 'admin' && (g.turn === 3 || g.turn === 4) && ctx.mine('israeli') && g.units.some((u) => u.box === 'sa_release')) {
    const sa = E.saAvailable(g, 'israeli').length > 0;
    out.push(`<div class="volpanel"><b>${ctx.ico('next')} Golani (22.45)</b><span>A Special Action brings the Golani brigade in beside Oretal.</span><div class="row">${ctx.btn('Spend a Special Action: release Golani', () => G.releaseGolani(g), 'primary', !sa, sa ? '' : 'No Special Action available')}</div></div>`);
  }
  if (g.phase === 'deploy' && ctx.mine('israeli')) {                                                // 15.7 and 14.02: what the Israeli player places before the first phase
    const sp = g.units.filter((u) => (u.fort || u.ghost) && u.box === 'deploy').length, mines = V.minesLeft ?? 0;
    if (sp) out.push(`<div class="volpanel"><b>${ctx.ico('lock')} Strongpoints and ghosts (15.7)</b><span>${sp} to place face-down, one in each area next to the Purple Line: drag them from the tray, or place them all at once.</span><div class="row">${ctx.btn('Shuffle face-down', () => G.autoStrongpoints(live(), 'shuffle'), 'primary', false, 'Random, as most players do (errata)')}${ctx.btn('Historical placement', () => G.autoStrongpoints(live(), 'historical'), '', false, "The errata's rough historical set-up")}</div></div>`);
    if (mines) {
      const keys = G.minefieldOptions(g).map((k) => k.split('-').map(Number)), ends = [...new Set(keys.flat())];
      const second = (a: number) => keys.filter((k) => k.includes(a)).map((k) => (k[0] === a ? k[1] : k[0]));
      out.push(`<div class="volpanel"><b>${ctx.ico('warn')} Minefields (14.02)</b><span>${mines} still to lay, on any boundary but the AT ditch, escarpment, river, Mt Hermon or rugged ones; no area may have two mined boundaries.</span><div class="row">${ctx.ubtn('Lay a minefield', () => ctx.pickArea('Minefield: first area', ends, (a) => ctx.pickArea(`Minefield from ${ctx.areaName(a)}: the area across the boundary`, second(a), (b) => G.placeMinefield(live(), a, b))), 'primary')}${ctx.btn('Lay the rest at random', () => G.autoMinefields(live()))}</div></div>`);
    }
  }
  for (const sd of E.sidesOf(g)) {                                                                   // reserve markers placed at set-up (22.25, 20.34-20.35, 22.44)
    const r = G.setupReserves(g, sd); if (!r.max || !ctx.mine(sd)) continue;
    const left = G.reservesLeft(g, sd), marked = g.units.filter((u) => u.side === sd && u.reserve).length, ok = (u: E.Unit) => u.side === sd && u.area != null && u.area < 100 && !u.garrison && !u.fort && !u.ghost;
    const free = [...new Set(g.units.filter((u) => ok(u) && !u.reserve).map((u) => u.area!))], on = [...new Set(g.units.filter((u) => ok(u) && u.reserve).map((u) => u.area!))];
    const pick = (areas: number[], label: string, want: boolean) => ctx.pickArea(label, areas, (a) => { const x = live(), u = x.units.find((v) => ok(v) && v.area === a && !!v.reserve === want); if (u) G.deployReserve(x, u.id); });
    out.push(`<div class="volpanel"><b>${ctx.ico('next')} Reserve markers</b><span>${r.all ? `${left} of ${r.max} still to place` : `You may mark ${r.max === 1 ? 'one unit' : `up to ${r.max} units`} (${left} left)`} on ${nm(sd)} units already on the map; reserves may move later in the turn.</span><div class="row">${ctx.ubtn('Mark a unit as reserve', () => pick(free, 'Reserve marker', false), r.all ? 'primary' : '', !left || !free.length)}${marked ? ctx.ubtn('Take one back', () => pick(on, 'Take the reserve marker off', true)) : ''}${r.all && left ? ctx.btn('Place the rest at random', () => G.autoReserves(live(), sd)) : ''}</div></div>`);
  }
  if (G.isAlOwda(g) && g.phase === 'deploy') {
    const at = G.alowdaRaidAreas(g), cmd = G.alowdaCommandos(g);
    const land = at.length && cmd.length && ctx.mine('syrian');
    out.push(`<div class="volpanel">${land ? `<b>${ctx.ico('air_mission')} Commando landings (20.35)</b><span>Land the ${esc(cmd.map((c) => c.name).join(' and '))} in vacant Israeli-held areas east of the Jordan (not Mt Hermon or Ma'agan), or skip them.</span><div class="row">${ctx.ubtn('Choose a landing area', () => ctx.pickArea(`Land the ${cmd[0]?.name ?? 'commandos'}`, at, (a) => G.alowdaRaid(live(), cmd[0].id, a)), 'primary')}</div>` : ''}<small>${ctx.ico('warn')} Draft scenario: ${esc(G.ALOWDA_ESTIMATES)}.</small></div>`);
  }
  if (!b && g.phase === 'combat' && ctx.mine('syrian')) {
    const aa = G.airAssaultTargets(g);
    if (aa.length) out.push(`<div class="volpanel"><b>${ctx.ico('air_mission')} 82nd Para (15.3)</b><span>The paratroop battalion may air-assault east of the SAM barrier or onto Mt Hermon, before any battle.</span><div class="row">${ctx.ubtn('Choose the landing area', () => ctx.pickArea('Air assault: tap the landing area', aa, (a) => G.airAssault(live(), a)), 'primary')}</div></div>`);
  }
  {                                                                                                  // optional rules that ask for a decision
    const chem = ctx.mine('syrian') ? G.chemicalOptions(g) : [], flank = ctx.mine('israeli') ? G.flankOptions(g) : [], zv = ctx.mine('israeli') ? G.zvikaOnMap(g) : undefined;
    if (chem.length) out.push(`<div class="volpanel"><b>${ctx.ico('warn')} Chemical warfare (optional)</b><span>Spend the reusable Special Action: one of your artillery fires +2 in this battle.${(G.state(g).chem ?? 0) ? ' Israel gains 1 VP for this use.' : ' The first use is free; each later one gives Israel 1 VP.'}</span><div class="row">${chem.map((id) => ctx.btn(esc(E.chit(g, id).name), () => G.playChemical(live(), id))).join('')}</div></div>`);
    if (flank.length) out.push(`<div class="volpanel"><b>${ctx.ico('next')} Flank assault (optional)</b><span>Spend a Special Action: the flanking unit fires +1, and the point unit takes the hits while it stands.</span><div class="row">${flank.map((id) => ctx.btn(`Flank with ${esc(g.units.find((u) => u.id === id)?.name ?? id)}`, () => G.playFlank(live(), id))).join('')}</div></div>`);
    if (zv) out.push(`<div class="volpanel"><b>${ctx.ico('next')} Lt. Zvika (optional variant)</b><span>Take him off the map, back into the Selection Cup, to play him again when drawn.</span><div class="row">${ctx.btn('Back into the cup', () => G.zvikaToCup(live()))}</div></div>`);
  }
  return out.length ? `<div class="volstack">${out.join('')}</div>` : '';
}
/** Why combat cannot begin yet, or null. */
export const golanBlocksBegin = (g: Game) => (G.state(g).samTarget ? 'Syria must answer the Israeli air mission first (fire a SAM or let it fly)' : g.battle && G.battleState(g.battle).ew?.pending ? 'The Defender must answer the jamming first' : null);

/** Holding boxes of the volume, for the pieces panel. */
export const GOLAN_BOXES: Record<string, string> = { operational_reserve: 'Operational Reserve (3rd Tank Division)', strategic_reserve: 'Strategic Reserve', air_assault: 'Air Assault (82nd Para)', strongpoint_pool: 'Strongpoints not placed', evacuated: 'Evacuated strongpoints', deploy: 'To be placed', arriving: 'Arriving', sa_release: 'Released by a Special Action (turns 3-4)', draw_cup: 'Reinforcements Draw Cup', draw_later: 'Into the Draw Cup on a later turn' };
/** The markers lying on boundaries: minefields and bridged ditch sections (blown bridges are the series' own). */
export const golanEdgeMarks = (g: Game) => { const V = G.state(g); return [...V.minefields.map((key) => ({ key, code: 'MINE' })), ...V.bridgedDitch.map((key) => ({ key, code: 'ATB' }))]; };
