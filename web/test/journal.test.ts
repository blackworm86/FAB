import { describe, expect, it } from 'vitest';
import { buildSteps, type JPub } from '../src/journal';

const pub = (at: number, msg: string): { at: number; d: string } => ({
  at,
  d: JSON.stringify({ t: 1, ph: 'movement', side: 'german', msg: [msg], vp: [0, 0] } as JPub),
});
const side = (at: number, u: Record<string, [number, number]>) => ({ at, d: JSON.stringify(u) });

describe("4.1 replay: each step shows both sides' blocks as they stood until the next step", () => {
  it("merges the two seats' records, each written when its owner saw the change", () => {
    const steps = buildSteps(
      [pub(100, 'a'), pub(200, 'b'), pub(300, 'c')],
      [
        [side(90, { G1: [5, 3] }), side(205, { G1: [10, 3] })], // the German moved at step 2 (written just after the step)
        [side(95, { A1: [10, 2] }), side(250, { A1: [10, 1] })],
      ],
    ); // the Allied block lost a step in step 2 (written when its owner saw it)
    expect(steps.map((s) => s.pub.msg[0])).toEqual(['a', 'b', 'c']);
    expect(steps[0].units).toEqual({ G1: [5, 3], A1: [10, 2] });
    expect(steps[1].units).toEqual({ G1: [10, 3], A1: [10, 1] });
    expect(steps[2].units).toEqual({ G1: [10, 3], A1: [10, 1] });
  });
  it('orders the steps by time, whatever order the database returns them in', () => {
    expect(buildSteps([pub(300, 'c'), pub(100, 'a')], []).map((s) => s.pub.msg[0])).toEqual(['a', 'c']);
  });
});
