// Vector art drawn from data (no scans). One SVG per block label / chit; strength turns the label as the block would turn.
import type { Unit } from '../../engine/src';
import { blockFace, hex } from './block-kit';
import scen from '../../data/bulge/scenarios.json';

export const ECH: Record<string, string> = { de_5pz: '#d6d8db', de_6pz: '#8e2d82', de_7a: '#3fa0dc', de_sr: '#f07f1e', us_1a: '#b9dc8c', us_3a: '#4d5b2c', us_sr: '#a6d6f3', br_xxx: '#e0412e', is_northern_command: '#f3f0e2', sy_golan_front: '#f8efc8' };
// Block faces follow the series rule (block-kit.ts); colours sampled from the printed Bulge sticker sheet (docs/game-pieces/Sticker_Sheet.jpg).
/** Sticker paper: German grey (the 6th Panzer Army and three reserve divisions on the darker grey, the paratroopers on blue), US green, British tan. */
const PAPER = { german: '#b5bcd3', germanDark: '#958c97', fj: '#86c3ee', us: '#93a536', british: '#e1b563' };
const DARK_DE = new Set(['10SS', '17SS', '6SS']);
/** Unit-box colour of each command, as printed on the stickers. */
const BOX: Record<string, string> = { de_6pz: '#a0237e', de_5pz: '#dfe1e6', de_7a: '#62bdf6', de_sr: '#f47710', us_1a: '#c5e184', us_3a: '#565c20', us_sr: '#a0daff', br_xxx: '#d4271e' };
/** Block wood (also the 3D blocks: vol.ts wood, main.ts British blue). */
export const BULGE_WOOD = { german: 0x8e9296, allied: 0x5d8a45, british: 0x3f6fb8 };
/** Names printed on a yellow box. */
const YELLOW = new Set(['Peiper', '150 Pz', '82', '101', '517']);
/** The strength a reduced unit starts or arrives with (the yellow arrow on its sticker). */
const ARROW: Record<string, number> = { ...(scen.tournament.reduced as Record<string, number>), ...(scen.tournament.reinforcementsReduced as Record<string, number>) };

/** 512 px SVG of a Bulge block face at its current strength. */
export function labelSvg(u: Unit) {
  const brit = u.name in BRIT, side = brit ? 'british' : u.side === 'german' ? 'german' : 'allied';
  const paper = brit ? PAPER.british : side === 'german' ? (/ FJ$/.test(u.name) ? PAPER.fj : u.ech === 'de_6pz' || DARK_DE.has(u.name) ? PAPER.germanDark : PAPER.german) : PAPER.us;
  const code = u.code ? { t: u.code, bg: /^\d+$/.test(u.code) ? '#fff' : undefined } : null;
  return blockFace({ wood: hex(BULGE_WOOD[side]), paper, box: BOX[u.ech ?? ''] ?? ECH[u.ech ?? ''] ?? '#ccc', symbol: u.symbol ?? 'inf', steps: u.max, q: u.q, name: u.name, nameBg: YELLOW.has(u.name) ? '#f8e23c' : undefined, code, arrowAt: ARROW[u.name], size: { pip: 4.7, gap: 12.2, name: 17, code: 13.5 } }, u.str);
}
const BRIT: Record<string, 1> = { '43 Inf': 1, '53 Inf': 1, Guards: 1, '51 Inf': 1 };
