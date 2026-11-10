// Every player the measuring tool can run, by name, older versions included (the hall of fame).
import { doctrinePlayer } from './doctrine';
import { randomPlayer, type Player } from './random';

export const PLAYERS: Record<string, (seed: number) => Player> = {
  random: (seed) => randomPlayer(seed),
  doctrine: () => doctrinePlayer(),
};
