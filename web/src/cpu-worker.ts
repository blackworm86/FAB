/** 4.4 The computer opponent's thinking, off the screen's thread: the table sends the game and gets back the action as data (engine/src/ai.ts `Op`). */
import * as E from '../../engine/src';
import type { Level } from '../../engine/src/ai';

export interface CpuAsk { id: number; json: string; side: string; level: Level }
export interface CpuReply { id: number; op: E.ai.Op | null; label?: string; unit?: string; area?: number; chit?: string; roll?: boolean; error?: string }

self.onmessage = (e: MessageEvent<CpuAsk>) => {
  const { id, json, side, level } = e.data;
  try {
    const g = JSON.parse(json) as E.Game;
    const a = E.ai.next(g, side, level);
    const r: CpuReply = a ? { id, op: a.op, label: a.label, unit: a.unit, area: a.area, chit: a.chit, roll: a.roll } : { id, op: null };
    (self as unknown as Worker).postMessage(r);
  } catch (err) { (self as unknown as Worker).postMessage({ id, op: null, error: String((err as Error)?.message ?? err) } as CpuReply); }
};
