// The computer's view of the game: exactly what a human in that seat sees online (engine/src/split.ts).
// The real game stays with the table (the referee); the computer only ever gets a Seat's view, and the table
// translates the hidden enemy blocks' opaque ids back to real ids when it carries out the computer's choice.
import * as E from '../../engine/src';
import type { Game, Side } from '../../engine/src';

export class Seat {
  private enemyEpoch: Record<string, number> = {};
  private enemyShown = new Set<string>();
  /** View id -> real id, for the enemy's hidden blocks (the table's side of the protocol, never handed to the computer). */
  private toReal = new Map<string, string>();

  constructor(
    public side: Side,
    private salts: Record<Side, string>,
    private dice: () => number,
  ) {}

  /** The game as this seat sees it: hidden enemy blocks blank under opaque ids, the dice unknowable. */
  view(full: Game): Game {
    const me = this.side,
      enemy = E.other(me),
      [p1, p2] = E.sidesOf(full);
    const enemySeat = new E.SplitSeat(enemy);
    enemySeat.priv = { salt: this.salts[enemy], epoch: this.enemyEpoch, secrets: E.secretsOf(full, enemy) };
    this.rehide(full, new Set(Object.values(enemySeat.wanted(full)).map((r) => r.id)));
    const enemyKey = enemySeat.priv,
      myKey = { salt: this.salts[me] },
      key = (s: Side) => (s === me ? myKey : enemyKey);
    const recent = { ...full, log: full.log.slice(-120) }; // toPublic keeps the last 120 lines anyway: same view, much less text
    const pub = JSON.parse(E.toPublic(JSON.parse(E.toPublic(recent, p1, key(p1), new Map())) as Game, p2, key(p2), new Map())) as Game;
    const { game } = E.compose(pub, { ...myKey, secrets: E.secretsOf(full, me) }, enemySeat.wanted(full));
    this.toReal = new Map(full.units.filter((u) => u.side === enemy).map((u) => [E.aliasOf(enemyKey, u.id), u.id]));
    game.seed = Math.floor(this.dice() * 1e9);
    delete game.force; // the real seed would tell the future dice
    return game;
  }

  /** Real id of a block named in the view (own blocks and seen enemy blocks already carry their real id). */
  real(id: string): string {
    return this.toReal.get(id) ?? id;
  }

  /** split.ts 'epoch': an enemy block that was shown and is hidden again gets a new opaque id, so this seat cannot follow it. */
  private rehide(full: Game, revealed: Set<string>) {
    for (const u of full.units)
      if (u.side !== this.side) {
        const seen = revealed.has(u.id) || E.visibleTo(full, u, 'spectator');
        if (!seen && this.enemyShown.has(u.id)) {
          this.enemyEpoch[u.id] = (this.enemyEpoch[u.id] ?? 0) + 1;
          this.enemyShown.delete(u.id);
        }
        if (seen) this.enemyShown.add(u.id);
      }
  }
}
