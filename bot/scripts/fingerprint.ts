// A fingerprint of The Bulge's rules: twelve complete seeded games, random against random, over all four scenarios with and
// without optional rules. The same rules give the same twelve lines, so a change of behaviour shows as a changed line.
//   npm run fingerprint              compare with bot/fingerprint.txt (exit 1 when a game came out differently)
//   npm run fingerprint -- --update  after a deliberate rule change ("Rule fix: …"): rewrite the file and commit it
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { playMatch } from '../src/match';
import { randomPlayer } from '../src/random';

const MIXES: { scenario: string; opts: Record<string, unknown> }[] = [
  { scenario: 'tournament', opts: {} },
  { scenario: 'campaign', opts: {} },
  { scenario: 'intro', opts: {} },
  { scenario: 'cold', opts: {} },
  {
    scenario: 'tournament',
    opts: {
      bridgeLimit: true,
      bid: 2,
      peiper: true,
      pz150: true,
      airborne: true,
      advArty: true,
      overrun: true,
      fwMaintain: true,
      randomReinf: true,
    },
  },
  { scenario: 'campaign', opts: { fuel: false, overrun: true, randomReinf: true } },
];
const FILE = new URL('../fingerprint.txt', import.meta.url).pathname;
const lines: string[] = [];
for (let seed = 1; seed <= 12; seed++) {
  const m = MIXES[seed % MIXES.length];
  const r = playMatch(seed, { german: randomPlayer(seed * 2), allied: randomPlayer(seed * 2 + 1) }, { scenario: m.scenario, opts: m.opts });
  const { ms: _ms, think: _think, ...fixed } = r; // the timings change from run to run
  lines.push(
    `${seed} ${m.scenario} ${createHash('sha256').update(JSON.stringify(fixed)).digest('hex').slice(0, 16)} ${r.result} · ${r.turns} turns · ${r.actions} actions`,
  );
}
const now = lines.join('\n') + '\n';
if (process.argv.includes('--update')) {
  writeFileSync(FILE, now);
  console.log('bot/fingerprint.txt rewritten');
} else {
  const was = readFileSync(FILE, 'utf8').split('\n');
  const changed = lines.filter((l, i) => l !== was[i]);
  for (const l of changed) console.log(`CHANGED  ${l}`);
  console.log(
    changed.length ? `${changed.length} of 12 games came out differently: the rules behave differently` : 'all 12 seeded games as before',
  );
  process.exit(changed.length ? 1 : 0);
}
