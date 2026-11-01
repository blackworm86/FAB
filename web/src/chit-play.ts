/** What a selected chit can be used on, so the board itself can offer it: blocks and areas light up and a tap applies it.
 *  Whether a target is legal is found by trying the rule on a copy of the game. Areas that need a further choice (an engineer's area, a Greif bridge) are "pick" targets. */
import * as E from '../../engine/src';

export interface TgtCtx { area: number | null; mode: string; setArea: (a: number) => void; setMode: (m: string) => void; face: (u: E.Unit) => string; areaName: (a: number) => string }
export interface Tgt { units: Map<string, () => void>; areas: Map<number, () => void>; pick: Map<number, () => void>; color: Map<number, number>; chips: { label: string; img: string; fn: () => void }[]; buttons: { icon: string; label: string; fn: () => void; title?: string }[]; modes: { id: string; icon: string; label: string }[]; any: ((a: number) => (() => void) | null) | null; hint: string }
const BRIDGE_KEY = (a: number, t: number) => (a < t ? `${a}-${t}` : `${t}-${a}`);
/** What a chit can be used on, so the board itself can offer it: blocks and areas light up, and a tap applies it. Areas that only need a further choice (an engineer's area, a Greif bridge) are "pick" targets. */
export function targetsFor(G: () => E.Game, c: E.Chit | null, ctx: TgtCtx): Tgt | null {
  const works = (fn: (t: E.Game) => void) => { try { fn(structuredClone(G())); return true; } catch { return false; } };
  if (!c || G().phase !== 'admin' || c.box !== 'available') return null;
  const t: Tgt = { units: new Map(), areas: new Map(), pick: new Map(), color: new Map(), chips: [], buttons: [], modes: [], any: null, hint: '' }, a = ctx.area;
  const k = c.kind;
  if (k.startsWith('replacement') || k === 'event_arriving_regiment' || k.startsWith('rebuild')) {
    for (const u of G().units.filter((x) => E.eligibleForStep(c, x))) {
      if (u.area == null) t.chips.push({ label: u.name, img: ctx.face(u), fn: () => E.playReplacement(G(), c.id, u.id) });
      else t.units.set(u.id, () => E.playReplacement(G(), c.id, u.id));
    }
    t.hint = t.units.size ? 'Tap a glowing block to add a step' : t.chips.length ? 'Tap a unit to bring back' : '';
  } else if (k === 'special_action_event' || k === 'sa_block') {
    for (const u of G().units.filter((x) => x.side === c.side && x.area != null && !x.garrison)) if (works((tg) => E.qualityReplacement(tg, u.id))) t.units.set(u.id, () => E.qualityReplacement(G(), u.id));
    for (const ar of E.areas.keys()) if (G().control[ar] === c.side && works((tg) => E.rally(tg, c.side, ar))) t.areas.set(ar, () => E.rally(G(), c.side, ar));
    t.hint = 'Tap a glowing block (quality replacement) or area (rally)';
  } else if (k === 'engineer') {
    const capable = (ar: number) => E.bridgeTargets(G(), c.side, ar).length || E.repairTargets(G(), c.side, ar).length || E.roadblockAreas(G(), c.side).includes(ar) || works((tg) => E.fieldWorksFor(tg, c.id, ar));
    for (const ar of E.areas.keys()) if (capable(ar)) t.pick.set(ar, () => { ctx.setArea(ar); });
    if (a != null && t.pick.has(a)) {
      const bt = E.bridgeTargets(G(), c.side, a), rt = E.repairTargets(G(), c.side, a);
      for (const n of bt) { t.areas.set(n, () => E.blowBridges(G(), c.id, a, [n])); t.color.set(n, 0xff4d4d); }
      for (const n of rt) { t.areas.set(n, () => E.repairBridge(G(), c.id, a, n)); t.color.set(n, 0x37d67a); }
      if (works((tg) => E.fieldWorksFor(tg, c.id, a))) t.buttons.push({ icon: 'gear', label: 'Field works', fn: () => E.fieldWorksFor(G(), c.id, a), title: 'Build field works here' });
      if (E.roadblockAreas(G(), c.side).includes(a)) t.buttons.push({ icon: 'flag', label: 'Roadblock', fn: () => E.roadblock(G(), c.id, a, false), title: '4.34 Roadblock' }, { icon: 'engineer', label: 'Defended', fn: () => E.roadblock(G(), c.id, a, true), title: '4.35 Defended roadblock (the engineer stays)' });
      t.hint = `${ctx.areaName(a)}: tap a red neighbour to blow its bridge${rt.length ? ', a green one to repair' : ''}`;
    } else t.hint = 'Tap a glowing area where the engineer works';
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
    if (a != null && valid(a).length > 1) for (const n of valid(a)) { t.areas.set(n, () => E.playGreifBridge(G(), c.id, a, n)); t.color.set(n, 0x37d67a); }
    t.hint = a != null && valid(a).length > 1 ? `Tap the neighbour across the river from ${ctx.areaName(a)}` : 'Tap a glowing area: the bridge is placed on its river boundary';
  } else if (k === 'event_greif_interdict') {
    for (const x of G().units.filter((u) => u.side === 'allied' && u.area != null && !u.garrison)) if (works((tg) => E.playInterdict(tg, c.id, x.id))) t.units.set(x.id, () => E.playInterdict(G(), c.id, x.id));
    t.hint = 'Tap a glowing Allied block to interdict it';
  } else if (k === 'air_mission') {
    t.any = (ar) => (works((tg) => E.playInterdiction(tg, c.id, ar)) ? () => E.playInterdiction(G(), c.id, ar) : null); t.hint = 'Tap any area to interdict it (Germans pay +1 MP to enter and leave)';
  } else if (k === 'event_release') {
    for (const ar of [4, 6] as const) t.areas.set(ar, () => E.releaseUnit(G(), c.id, ar)); t.hint = 'Tap the entry area';
  } else if (c.name === 'v.d. Heydte' && E.heydteWindow(G(), c)) {
    for (const ar of [31, 52] as const) t.areas.set(ar, () => E.heydteDrop(G(), c.id, ar)); t.hint = 'Tap a drop zone: Hohes Venn or Stoumont';
  } else return null;
  return t;
}
