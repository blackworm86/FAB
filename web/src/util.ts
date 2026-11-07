/** Small helpers shared by the screens. */
import { VOLUME, type Side } from '../../engine/src';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** A side's name in the current game (German / Allied, Syrian / Israeli). */
export const nm = (s: Side) => VOLUME.sideName[s] ?? (s ? s[0].toUpperCase() + s.slice(1) : '');

/** The board's printed words (box names, notes, arrow labels) sit in groups marked data-flip="cx cy": for the player across the table each turns half round its centre, so both read it the right way up. */
export const flipSvg = (t: string) => t.replace(/data-flip="(-?[\d.]+) (-?[\d.]+)"/g, 'transform="rotate(180 $1 $2)"');
