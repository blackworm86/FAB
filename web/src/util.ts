/** Small helpers shared by the screens. */
import { VOLUME, type Side } from '../../engine/src';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** A side's name in the current game (German / Allied, Syrian / Israeli). */
export const nm = (s: Side) => VOLUME.sideName[s] ?? (s ? s[0].toUpperCase() + s.slice(1) : '');
