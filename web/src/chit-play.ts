/** What a selected chit can be used on, so the board itself can offer it: blocks and areas light up and a tap applies it.
 *  Whether a target is legal is found by trying the rule on a copy of the game. Areas that need a further choice (an engineer's area, a Greif bridge) are "pick" targets. */
import * as E from '../../engine/src';

export interface TgtCtx { area: number | null; mode: string; setArea: (a: number) => void; setMode: (m: string) => void; face: (u: E.Unit) => string; areaName: (a: number) => string }
export interface Tgt { units: Map<string, () => void>; areas: Map<number, () => void>; pick: Map<number, () => void>; color: Map<number, number>; chips: { label: string; img: string; fn: () => void }[]; buttons: { icon: string; label: string; fn: () => void; title?: string }[]; modes: { id: string; icon: string; label: string }[]; focus?: boolean; any: ((a: number) => (() => void) | null) | null; hint: string }
const BRIDGE_KEY = (a: number, t: number) => (a < t ? `${a}-${t}` : `${t}-${a}`);
/** What a chit can be used on, so the board itself can offer it: blocks and areas light up, and a tap applies it. Areas that only need a further choice (an engineer's area, a Greif bridge) are "pick" targets. */
export function targetsFor(G: () => E.Game, c: E.Chit | null, ctx: TgtCtx): Tgt | null {
  const works = (fn: (t: E.Game) => void) => { try { fn(structuredClone(G())); return true; } catch { return false; } };
  if (!c || G().phase !== 'admin' || c.box !== 'available') return null;
  const t: Tgt = { units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: '' }, a = ctx.area;
  const k = c.kind;
  if (k.startsWith('replacement') || k === 'event_arriving_regiment' || k.startsWith('rebuild')) {
    for (const u of G().units.filter((x) => E.eligibleForStep(c, x, G()))) {
      if (u.area == null) for (const ar of E.regimentAreas(G(), u.id)) { t.areas.set(ar, () => E.playReplacement(G(), c.id, u.id, ar)); t.color.set(ar, 0x5d8b3a); }   // 17.23: the player picks the entry area
      else t.units.set(u.id, () => E.playReplacement(G(), c.id, u.id));
    }
    if (k.startsWith('rebuild')) {                                                                // 17.22: or return an eliminated one-step unit to a friendly VP area
      const g0 = G(), dead = g0.units.filter((x) => x.area == null && x.str === 0 && x.max === 1 && x.side === c.side && !x.garrison && x.q[0] !== 'elite');
      const ok = (x: E.Unit, ar: number) => g0.control[ar] === c.side && works((tg) => E.playRebuild(tg, c.id, x.id, ar));
      for (const ar of E.areas.keys()) { if (g0.control[ar] !== c.side) continue; const who = dead.filter((x) => ok(x, ar)); if (who.length === 1) t.areas.set(ar, () => E.playRebuild(G(), c.id, who[0].id, ar)); else if (who.length) t.pick.set(ar, () => ctx.setArea(ar)); }
      if (a != null && t.pick.has(a)) { t.focus = true; t.color.set(a, 0xe7b04a); for (const x of dead.filter((y) => ok(y, a))) t.chips.push({ label: `${x.name} to ${ctx.areaName(a)}`, img: ctx.face(x), fn: () => E.playRebuild(G(), c.id, x.id, a) }); }
    }
    t.hint = t.chips.length ? 'Tap a unit to bring it back' : t.units.size && (t.areas.size || t.pick.size) ? 'Tap a glowing block to add a step, or a glowing area to bring a unit back' : t.units.size ? 'Tap a glowing block to add a step' : t.areas.size || t.pick.size ? 'Tap a glowing area to bring the unit back there' : '';
  } else if (k === 'special_action_event' || k === 'sa_block') {
    const g0 = G(), fits = (u: E.Unit, ar = u.area!) => E.saAvailable(g0, c.side, u.ech, ar).some((x) => x.id === c.id);   // this very counter: a single-use event only helps its own Higher Echelon (8.1), German ones in their army's zone (17.1)
    for (const u of g0.units.filter((x) => x.side === c.side && x.area != null && !x.garrison && !x.unsupplied && x.str < x.max && fits(x))) if (works((tg) => E.qualityReplacement(tg, u.id, c.id))) t.units.set(u.id, () => E.qualityReplacement(G(), u.id, c.id));
    const rallies = (ar: number) => [ar, ...E.neighbors(ar)].some((a2) => E.blocks(g0, a2, c.side).some((u) => u.disorder && !u.unsupplied)) && works((tg) => { const n = tg.units.filter((u) => u.disorder).length; E.rally(tg, c.side, ar, c.id); if (tg.units.filter((u) => u.disorder).length === n) throw new Error('nobody rallies'); });
    for (const ar of E.areas.keys()) if (g0.control[ar] === c.side && E.inSupply(g0, c.side, ar) && rallies(ar)) t.areas.set(ar, () => E.rally(G(), c.side, ar, c.id));   // 8.25: any supplied area, contested or not
    t.hint = 'Tap a glowing block (quality replacement) or area (rally)';
  } else if (k === 'engineer') {
    const zone = (ar: number) => E.assetZoneOk(G(), c, ar), rbs = E.roadblockAreas(G(), c.side);
    const capable = (ar: number) => zone(ar) && (E.bridgeTargets(G(), c.side, ar).length > 0 || E.repairTargets(G(), c.side, ar).length > 0 || rbs.includes(ar) || works((tg) => E.fieldWorksFor(tg, c.id, ar)));
    for (const ar of E.areas.keys()) if (capable(ar)) t.pick.set(ar, () => { ctx.setArea(ar); ctx.setMode(''); });
    if (a != null && t.pick.has(a)) {
      const bt = E.bridgeTargets(G(), c.side, a), rt = E.repairTargets(G(), c.side, a);
      t.focus = true; t.color.set(a, 0xe7b04a);                                                     // the chosen area and its bridges only; other areas stay tappable but unlit
      const sel = ctx.mode.startsWith('b:') ? ctx.mode.slice(2).split(',').filter(Boolean).map(Number).filter((n) => bt.includes(n)) : [];
      for (const n of bt) { t.pick.set(n, () => { const s = sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n].slice(-2); ctx.setMode('b:' + s.join(',')); }); t.color.set(n, sel.includes(n) ? 0xff2a2a : 0xff9a8a); }
      for (const n of rt) { t.areas.set(n, () => E.repairBridge(G(), c.id, a, n)); t.color.set(n, 0x5d8b3a); }
      if (sel.length) t.buttons.push({ icon: 'xbold', label: `Blow ${sel.length} bridge${sel.length > 1 ? 's' : ''}`, fn: () => E.blowBridges(G(), c.id, a, sel), title: '4.31: up to two bridges from the same area' });
      if (works((tg) => E.fieldWorksFor(tg, c.id, a))) t.buttons.push({ icon: 'gear', label: 'Field works', fn: () => E.fieldWorksFor(G(), c.id, a), title: '4.33 Build field works here' });
      if (rbs.includes(a)) t.buttons.push({ icon: 'flag', label: 'Roadblock', fn: () => E.roadblock(G(), c.id, a, false), title: '4.34 Roadblock' }, { icon: 'engineer', label: 'Defended roadblock', fn: () => E.roadblock(G(), c.id, a, true), title: '4.35 The engineer chit itself stays in the area as a defended roadblock' });
      t.hint = `${ctx.areaName(a)}: ${bt.length ? `tap ${bt.length > 1 ? 'one or two' : 'the'} red neighbour${bt.length > 1 ? 's' : ''} to mark the bridge${bt.length > 1 ? 's' : ''} to blow` : ''}${rt.length ? `${bt.length ? ', ' : ''}a green one to repair` : ''}${!bt.length && !rt.length ? 'choose what to build' : ''}`;
    } else t.hint = 'Tap a glowing area where the engineer works (its own army zone)';
  } else if (k === 'command_staff') {
    const own = G().units.filter((x) => x.side === c.side && x.area != null && !x.garrison), foe = G().units.filter((x) => x.side !== c.side && x.area != null && !x.garrison);
    const sets: Record<string, { icon: string; label: string; units?: [string, () => void][]; areas?: [number, () => void][] }> = {};
    if (c.side === 'german') sets.boundary = { icon: 'next', label: 'Boundary crossing (14.62a)', units: own.filter((x) => works((tg) => E.staffBoundary(tg, c.id, x.id))).map((x) => [x.id, () => E.staffBoundary(G(), c.id, x.id)]) };
    else sets.pool = { icon: 'task_force', label: 'Pooled assets (14.62b)', areas: [...E.areas.keys()].filter((ar) => works((tg) => E.staffPool(tg, c.id, ar))).map((ar) => [ar, () => E.staffPool(G(), c.id, ar)]) };
    sets.intel = { icon: 'info', label: 'Intelligence gathering (8.32)', units: foe.filter((x) => works((tg) => E.staffIntel(tg, c.id, x.id))).map((x) => [x.id, () => E.staffIntel(G(), c.id, x.id)]) };
    sets.repl = { icon: 'infantry_asset', label: 'Replacements found', units: own.filter((x) => x.cls === 'infantry' && x.str < x.max && works((tg) => E.staffReplacement(tg, c.id, x.id))).map((x) => [x.id, () => E.staffReplacement(G(), c.id, x.id)]) };
    sets.reserve = { icon: 'sa_block', label: 'Reserves made available (8.33)', units: own.filter((x) => E.canReserve(G(), x)).map((x) => [x.id, () => E.staffReserve(G(), c.id, x.id)]) };
    for (const [id, v] of Object.entries(sets)) if (v.units?.length || v.areas?.length) t.modes.push({ id, icon: v.icon, label: v.label });
    let mode = ctx.mode; if (!t.modes.some((m) => m.id === mode)) { mode = t.modes[0]?.id ?? ''; ctx.setMode(mode); }
    const cur = sets[mode]; cur?.units?.forEach(([id, fn]) => t.units.set(id, fn)); cur?.areas?.forEach(([ar, fn]) => t.areas.set(ar, fn));
    t.hint = cur ? cur.label : 'Nothing to do with this staff chit now';
  } else if (k === 'event_greif_bridge') {
    const valid = (ar: number) => E.neighbors(ar).filter((n) => E.connection(ar, n)!.river && !G().blown.includes(BRIDGE_KEY(ar, n)) && !G().greif[BRIDGE_KEY(ar, n)]);
    for (const ar of E.areas.keys()) { const v = valid(ar); if (v.length === 1) t.areas.set(ar, () => E.playGreifBridge(G(), c.id, ar, v[0])); else if (v.length > 1) t.pick.set(ar, () => { ctx.setArea(ar); }); }
    if (a != null && valid(a).length > 1) for (const n of valid(a)) { t.areas.set(n, () => E.playGreifBridge(G(), c.id, a, n)); t.color.set(n, 0x5d8b3a); }
    t.hint = a != null && valid(a).length > 1 ? `Tap the neighbour across the river from ${ctx.areaName(a)}` : 'Tap a glowing area: the bridge is placed on its river boundary';
  } else if (k === 'event_greif_interdict') {
    for (const x of G().units.filter((u) => u.side === 'allied' && u.area != null && !u.garrison)) if (works((tg) => E.playInterdict(tg, c.id, x.id))) t.units.set(x.id, () => E.playInterdict(G(), c.id, x.id));
    t.hint = 'Tap a glowing Allied block to interdict it';
  } else if (k === 'air_mission') {
    t.any = (ar) => (works((tg) => E.playInterdiction(tg, c.id, ar)) ? () => E.playInterdiction(G(), c.id, ar) : null); t.hint = 'Tap any area to interdict it (Germans pay +1 MP to enter and leave)';
  } else if (k === 'event_release') {
    for (const ar of [4, 6] as const) if (works((tg) => E.releaseUnit(tg, c.id, ar))) t.areas.set(ar, () => E.releaseUnit(G(), c.id, ar));      // only entry areas that can take it
    t.hint = t.areas.size ? 'Tap the entry area' : 'Entry areas Y and Z are full: the division cannot enter now';
  } else if (k === 'event_bodenplatte') {
    t.buttons.push({ icon: 'air_mission', label: `Strike Allied air missions (${E.boxOf(G(), 'allied', 'available').filter((x) => x.kind === 'air_mission').length} available)`, fn: () => E.playBodenplatte(G(), c.id), title: '17.14: one die per Air Mission in the Allied Available Box' });
  } else if (c.name === 'v.d. Heydte' && E.heydteWindow(G(), c)) {
    for (const ar of [31, 52] as const) if (works((tg) => E.heydteDrop(tg, c.id, ar))) t.areas.set(ar, () => E.heydteDrop(G(), c.id, ar));
    t.hint = t.areas.size ? 'Tap a drop zone: Hohes Venn or Stoumont' : 'No drop zone is vacant and Allied-held: it stays as a battle asset (16.11)';
  } else return null;
  return t;
}
