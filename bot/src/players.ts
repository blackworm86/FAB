// Every player the measuring tool can run, by name, older versions included (the hall of fame).
import { doctrinePlayer } from './doctrine';
import { randomPlayer, rng, type Player } from './random';

/** A player that makes a random choice instead of its own with probability eps (variety for recorded games). */
const noisy = (base: Player, eps: number, seed: number): Player => { const r = rng(seed), wild = randomPlayer(seed + 1); return (v, s) => (r() < eps ? wild(v, s) : base(v, s)); };

export const PLAYERS: Record<string, (seed: number) => Player> = {
  random: (seed) => randomPlayer(seed),
  doctrine: () => doctrinePlayer(),
  'doctrine-10': (seed) => noisy(doctrinePlayer(), 0.1, seed),
  'doctrine-30': (seed) => noisy(doctrinePlayer(), 0.3, seed),
  'doctrine-60': (seed) => noisy(doctrinePlayer(), 0.6, seed),
};
