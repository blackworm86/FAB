// A source file may not grow past LIMIT lines (the big files were split in November 2026 and should not come back).
// The few files already over it have their own ceiling (their size then): they may not grow, and should shrink when touched.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 1000;
const CEILING = {
  'engine/test/sweep-fuzz.test.ts': 1350,
  'web/src/css/battle-strip.css': 1050,
};
const ROOTS = [
  'engine/src',
  'engine/test',
  'web/src',
  'web/test',
  'web/e2e',
  'web/scripts',
  'bot/src',
  'bot/test',
  'bot/scripts',
  'scripts',
];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let bad = 0;
for (const f of ROOTS.flatMap(walk).filter((f) => /\.(ts|mjs|css)$/.test(f))) {
  const n = readFileSync(f, 'utf8').split('\n').length,
    max = CEILING[f] ?? LIMIT;
  if (n > max) {
    bad++;
    console.log(`${f}: ${n} lines, the limit is ${max}. Split it (web/scripts/move-code.mjs moves code between modules).`);
  }
}
console.log(bad ? `${bad} file(s) too long` : 'all files within the size limit');
process.exit(bad ? 1 : 0);
