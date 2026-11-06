import { CUR } from './volumes';
import type { Quality } from './combat';

export type Side = string;
export type Box = 'future' | 'cup' | 'available' | 'used' | 'eliminated' | 'map' | 'air_support_holding' | 'evacuated_strongpoints' | 'captured_airfields' | 'captured_ports_vp';
export type ChitKind = 'artillery' | 'rocket_artillery' | 'engineer' | 'armor_asset' | 'infantry_asset' | 'task_force' | 'fuel' | 'command_staff' | 'sa_block'
  | 'replacement_inf' | 'replacement_arm' | 'rebuild_or_replace_inf' | 'rebuild_or_replace_arm' | 'event_arriving_regiment' | 'special_action_event' | 'air_mission'
  | 'event_release' | 'event_greif_bridge' | 'event_greif_interdict' | 'event_bodenplatte' | 'event_delayed_response';
export interface Chit { id: string; name: string; kind: ChitKind | string; side: Side; ech: string; q?: Quality; turn: number | string | null; box: Box; division?: string; drawn?: number; held?: number; bid?: boolean;
  area?: number; brigade?: string; subtype?: string; direct?: boolean; mission?: string; counter?: string;
  nation?: string; strategic?: boolean; flank?: string }   /** Sicily: the counter's nationality, a red-flag (strategic) asset, a Flanking Invasion asset ('once' for the 3rd CDO) */

/** German Higher Echelon -> army zone (14.31). Strategic Reserve (de_sr) belongs to no zone. */
export const ZONE: Record<string, number> = { de_5pz: 5, de_6pz: 6, de_7a: 7 };
const KINDS = new Set<string>(['artillery', 'rocket_artillery', 'engineer', 'armor_asset', 'infantry_asset', 'task_force', 'fuel', 'command_staff', 'replacement_inf', 'replacement_arm',
  'rebuild_or_replace_inf', 'rebuild_or_replace_arm', 'event_arriving_regiment', 'special_action_event', 'air_mission', 'event_release', 'event_greif_bridge', 'event_greif_interdict',
  'event_bodenplatte', 'event_delayed_response']);
export const isArty = (c: Chit) => c.kind === 'artillery' || c.kind === 'rocket_artillery' || c.kind === 'naval_support';     // Sicily's naval support fires as artillery (16.21)
export const isBattleAsset = (c: Chit) => ['armor_asset', 'infantry_asset', 'engineer', 'task_force', 'commando'].includes(c.kind);
/** Assets recycle through the cup; events are single-use. Golan's SAMs, commandos and air support are assets too (16.1). */
export const isAsset = (c: Chit) => isArty(c) || isBattleAsset(c) || c.kind === 'fuel' || c.kind === 'command_staff' || c.kind === 'sam' || (c.kind === 'air_mission' && CUR.id !== 'bulge');
export const isEvent = (c: Chit) => !isAsset(c) && c.kind !== 'sa_block';
export const chitClass = (c: Chit) => (c.kind === 'armor_asset' || (c.kind === 'task_force' && /armor/i.test(c.name)) ? 'armor' : 'infantry') as 'armor' | 'infantry';

type Raw = { id: string; kind: string; echelon: string; turn: number | string | null; name: string; quality?: Quality | null; copies?: number; division?: string };
const sideOf = (e: string): Side => (e.startsWith('de_') || e === 'german' ? 'german' : 'allied');

/** Every asset/event/block in the scenario, one entry per physical counter. Assets marked S start in the Available Box (Player Aid E). */
export function buildChits(lastTurn: number): Chit[] {
  const out: Chit[] = [];
  for (const c of CUR.counters as Raw[]) {
    if (!KINDS.has(c.kind) || c.turn == null) continue;
    const turn = c.turn === 'S' ? 'S' : Number(c.turn);
    if (turn !== 'S' && turn > lastTurn) continue;
    for (let i = 0; i < (c.copies ?? 1); i++)
      out.push({ id: `${c.id}.${i}`, name: c.name, kind: c.kind as ChitKind, side: sideOf(c.echelon), ech: c.echelon, q: c.quality ?? undefined, turn, box: turn === 'S' ? 'available' : 'future', division: c.division });
  }
  for (const side of CUR.sides) out.push({ id: `SA-${side}`, name: 'Special Action (reusable)', kind: 'sa_block', side, ech: side, turn: 2, box: 'future' });
  return out;
}
