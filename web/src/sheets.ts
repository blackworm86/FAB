/** Developer tool: every drawn symbol and counter as SVG, for the editable sheets (docs/maps/vector/fab-*.svg). */
import * as E from '../../engine/src';
import type { VolView } from './vol';

/** Every drawn symbol and counter as SVG, for the editable sheets (docs/maps/vector/fab-*.svg). */
export function sheets(VOL: VolView) {
  const seenSvg = new Set<string>(),
    out: Record<string, { id: string; label: string; svg: string }[]> = { chits: [], blocks: [], markers: [] };
  const add = (k: string, id: string, label: string, svg: string | null) => {
    if (svg && !seenSvg.has(svg)) {
      seenSvg.add(svg);
      out[k].push({ id, label, svg });
    }
  };
  const cg = E.newGame(5, VOL.id === 'bulge' ? { scenario: 'campaign', fuel: true } : VOL.defaultOpts);
  for (const c of cg.chits) add('chits', c.id, `${c.side} ${c.name}${c.turn != null ? ' t' + c.turn : ''}`, VOL.chitSvg(c));
  for (const u of cg.units) add('blocks', u.id, `${u.name}${u.code ? ' ' + u.code : ''}`, VOL.unitSvg(u, cg));
  for (const m of ['X', 'FW', 'RA', 'RB', 'DIS', 'REC', 'E', 'B', 'P', 'R5', 'R6', 'R7', 'A7', 'A56', 'GI', 'G', 'OOS', 'AIR'])
    add('markers', m, m, VOL.markSvg(m));
  return out;
}
