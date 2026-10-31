/** Undo for the game state: a snapshot before each action, dropped for good once a die has been rolled. */
export class History<G extends { rolls: number }> {
  private stack: string[] = [];
  constructor(private limit = 60) {}
  get length() { return this.stack.length; }
  clear() { this.stack = []; }
  /** Run `f` on `g`. On an error the game is restored from the snapshot and the error is returned; after a roll nothing can be undone. */
  run(g: G, f: () => void): { game: G; error?: Error } {
    const snap = JSON.stringify(g), r0 = g.rolls;
    try { f(); } catch (e) { return { game: JSON.parse(snap), error: e as Error }; }
    if (g.rolls !== r0) this.stack = []; else { this.stack.push(snap); if (this.stack.length > this.limit) this.stack.shift(); }
    return { game: g };
  }
  undo(): G | null { const s = this.stack.pop(); return s ? JSON.parse(s) : null; }
}
