/** Small helpers shared by the screens. */
import type { Side } from '../../engine/src';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const nm = (s: Side) => (s === 'german' ? 'German' : 'Allied');
