import counters from '../../data/bulge/counters.json';
import type { Quality } from './combat';

export type Side = 'german' | 'allied';
export type Box = 'future' | 'cup' | 'available' | 'used' | 'eliminated' | 'map';
export type ChitKind = 'artillery' | 'rocket_artillery' | 'engineer' | 'armor_asset' | 'infantry_asset' | 'task_force' | 'fuel' | 'command_staff' | 'sa_block'
  | 'replacement_inf' | 'replacement_arm' | 'rebuild_or_replace_inf' | 'rebuild_or_replace_arm' | 'event_arriving_regiment' | 'special_action_event' | 'air_mission'
  | 'event_release' | 'event_greif_bridge' | 'event_greif_interdict' | 'event_bodenplatte' | 'event_delayed_response';
export interface Chit { id: string; name: string; kind: ChitKind; side: Side; ech: string; q?: Quality; turn: number | 'S'; box: Box; division?: string }

/** German Higher Echelon -> army zone (14.31). Strategic Reserve (de_sr) belongs to no zone. */
export const ZONE: Record<string, number> = { de_5pz: 5, de_6pz: 6, de_7a: 7 };
const KINDS = new Set<string>(['artillery', 'rocket_artillery', 'engineer', 'armor_asset', 'infantry_asset', 'task_force', 'fuel', 'command_staff', 'replacement_inf', 'replacement_arm',
  'rebuild_or_replace_inf', 'rebuild_or_replace_arm', 'event_arriving_regiment', 'special_action_event', 'air_mission', 'event_release', 'event_greif_bridge', 'event_greif_interdict',
  'event_bodenplatte', 'event_delayed_response']);
export const isArty = (c: Chit) => c.kind === 'artillery' || c.kind === 'rocket_artillery';
export const isBattleAsset = (c: Chit) => ['armor_asset', 'infantry_asset', 'engineer', 'task_force'].includes(c.kind);
export const isAsset = (c: Chit) => isArty(c) || isBattleAsset(c) || c.kind === 'fuel' || c.kind === 'command_staff';
export const isEvent = (c: Chit) => !isAsset(c) && c.kind !== 'sa_block';
export const chitClass = (c: Chit) => (c.kind === 'armor_asset' ? 'armor' : 'infantry') as 'armor' | 'infantry';

type Raw = { id: string; kind: string; echelon: string; turn: number | string | null; name: string; quality?: Quality | null; copies?: number; division?: string };
const sideOf = (e: string): Side => (e.startsWith('de_') || e === 'german' ? 'german' : 'allied');

/** Every asset/event/block in the scenario, one entry per physical counter. Assets marked S start in the Available Box (Player Aid E). */
export function buildChits(lastTurn: number): Chit[] {
  const out: Chit[] = [];
  for (const c of counters as unknown as Raw[]) {
    if (!KINDS.has(c.kind) || c.turn == null) continue;
    const turn = c.turn === 'S' ? 'S' : Number(c.turn);
    if (turn !== 'S' && turn > lastTurn) continue;
    for (let i = 0; i < (c.copies ?? 1); i++)
      out.push({ id: `${c.id}.${i}`, name: c.name, kind: c.kind as ChitKind, side: sideOf(c.echelon), ech: c.echelon, q: c.quality ?? undefined, turn, box: turn === 'S' ? 'available' : 'future', division: c.division });
  }
  for (const side of ['german', 'allied'] as Side[]) out.push({ id: `SA-${side}`, name: 'Special Action (reusable)', kind: 'sa_block', side, ech: side, turn: 2, box: 'future' });
  return out;
}
