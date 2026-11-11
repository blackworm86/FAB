// The experimental computer player (?lab=german or ?lab=allied, docs/COMPUTER-PLAYER-PLAN.md) thinks here, off the
// page's thread. It gets only its seat's view of the game and answers with one action and its latest explanation.
import { commanderPlayer } from '../../bot/src/commander';
import type { Game, Side } from '../../engine/src';

const player = commanderPlayer(Date.now() % 1e9, 3000);
self.onmessage = (e: MessageEvent<{ id: number; view: Game; side: Side }>) => {
  const { id, view, side } = e.data, n = player.reasons.length;
  const action = player(view, side);
  self.postMessage({ id, action, reason: player.reasons.length > n ? player.reasons.slice(n).join(' Then: ') : null });      // a plan and a battle choice can come in one step
};
