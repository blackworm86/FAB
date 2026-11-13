// Every check in one go, with one table at the end:   npm run verify            (about four minutes)
//   npm run verify -- --browser   also the load check in a real browser (starts and stops its own dev server)
//   npm run verify -- --quick     without the engine's tests and the fingerprint (for a change outside engine/ and bot/)
// Needs `npm ci` done once at the root and in engine/, web/ and bot/. Database rules tests are apart (they need Java).
import { spawnSync, spawn } from 'node:child_process';

const flags = new Set(process.argv.slice(2)),
  quick = flags.has('--quick');
const steps = [
  ['formatting', '.', 'npm run format:check'],
  ['file sizes', '.', 'npm run check:size'],
  ['engine types', 'engine', 'npm run typecheck'],
  !quick && ['engine tests', 'engine', 'npm test'],
  ['table types', 'web', 'npm run typecheck'],
  ['table tests', 'web', 'npm test'],
  ['table build', 'web', 'npm run build'],
  ['computer opponent types', 'bot', 'npm run typecheck'],
  !quick && ['computer opponent tests', 'bot', 'npm test'],
  !quick && ['rules fingerprint (The Bulge, 12 seeded games)', 'bot', 'npm run fingerprint'],
].filter(Boolean);
const rows = [];
const run = (name, cwd, cmd) => {
  const t = Date.now(),
    r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' }),
    ok = r.status === 0;
  rows.push([ok ? 'ok  ' : 'FAIL', name, `${Math.round((Date.now() - t) / 1000)} s`]);
  if (!ok) console.log(`\n--- ${name} failed (${cmd} in ${cwd}) ---\n${(r.stdout + r.stderr).split('\n').slice(-25).join('\n')}`);
  return ok;
};
for (const s of steps) run(...s);
if (flags.has('--browser')) {
  const server = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: 'web', stdio: 'ignore', detached: true });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    up = await fetch('http://localhost:5199/').then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await new Promise((r) => setTimeout(r, 1000));
  }
  if (up) run('load check in a browser', 'web', 'npm run load');
  else rows.push(['FAIL', 'load check in a browser', 'the dev server did not start (is port 5199 taken?)']);
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
}
console.log('\n' + rows.map((r) => r.join('  ')).join('\n'));
const bad = rows.filter((r) => r[0] === 'FAIL').length;
console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
