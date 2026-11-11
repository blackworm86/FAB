// Every player the measuring tool can run, by name, older versions included (the hall of fame).
import { commanderPlayer } from './commander';
import { DEFAULT_STYLE, doctrinePlayer } from './doctrine';
import { randomPlayer, rng, type Player } from './random';

/** A player that makes a random choice instead of its own with probability eps (variety for recorded games). */
const noisy = (base: Player, eps: number, seed: number): Player => { const r = rng(seed), wild = randomPlayer(seed + 1); return (v, s) => (r() < eps ? wild(v, s) : base(v, s)); };

export const PLAYERS: Record<string, (seed: number) => Player> = {
  random: (seed) => randomPlayer(seed),
  doctrine: () => doctrinePlayer(),
  'doctrine-v3': () => doctrinePlayer({ ...DEFAULT_STYLE, v3: true }),      // before the operational rules (12 November 2026)
  ...Object.fromEntries(['reserve', 'breakthrough', 'greif', 'quality', 'assets'].map((r) => [`doctrine-no-${r}`, () => doctrinePlayer({ ...DEFAULT_STYLE, skip: [r] })])),   // each operational rule off, for measuring
  'doctrine-v2': () => doctrinePlayer({ ...DEFAULT_STYLE, abortV1: true }),      // before the abort fix (12 November 2026)
  'doctrine-v1': () => doctrinePlayer({ ...DEFAULT_STYLE, v1: true }),      // before the attack orders (11 November 2026)
  commander: (seed) => commanderPlayer(seed, 2000),
  'commander-6s': (seed) => commanderPlayer(seed, 6000),     // three times the thinking time: does more thinking help? (levels, stage 6)
  'doctrine-10': (seed) => noisy(doctrinePlayer(), 0.1, seed),
  'doctrine-30': (seed) => noisy(doctrinePlayer(), 0.3, seed),
  'doctrine-60': (seed) => noisy(doctrinePlayer(), 0.6, seed),
};
