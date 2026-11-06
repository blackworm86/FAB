// Browser smoke test: each playable game, on desktop and on a phone, opens without errors, steps a few phases,
// fights a battle and opens the rules reader. Run with the dev server up:  npm run e2e  (BASE=http://localhost:5199 by default; HOME_URL=<a vite preview address> adds the home page).
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5199/';
const GAMES = ['bulge', 'golan73'];
const SIZES = { desktop: { viewport: { width: 1380, height: 860 } }, phone: { ...devices['iPhone 13'] } };
const RULE = { bulge: '4.33', golan73: '14.02' };
let failed = 0;
const check = (ok, what) => { if (!ok) { failed++; console.log(`  FAIL ${what}`); } else console.log(`  ok   ${what}`); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const game of GAMES) for (const [size, opts] of Object.entries(SIZES)) {
  console.log(`${game} · ${size}`);
  const page = await (await browser.newContext(opts)).newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}?sandbox=1&dev=1&game=${game}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const loaded = await page.waitForFunction(() => window.__fab && document.querySelector('.c-bar.b'), null, { timeout: 180000 }).then(() => true, () => false);
  check(loaded, 'the table opens');
  if (!loaded) { console.log(`  errors: ${errors.join(' | ')}`); await page.close(); continue; }
  await page.click('[title="Hide the sandbox tools"]', { timeout: 3000 }).catch(() => {});
  check(await page.evaluate((id) => window.__fab.g.game === id || (id === 'bulge' && !window.__fab.g.game), game), 'the right game is loaded');

  // a few steps of the turn: press the main button while it is enabled
  for (let i = 0; i < 4; i++) { const go = page.locator('.c-bar button.go:not([disabled])'); if (!(await go.count())) break; await go.click().catch(() => {}); await page.waitForTimeout(400); }
  check(!(await page.locator('text=Display problem').count()), 'phases step without a display problem');

  // a battle: put a unit next to the enemy into the enemy's area and start the battle there
  const fought = await page.evaluate(() => {
    const F = window.__fab, E = F.E, g = structuredClone(F.g);
    for (const u of g.units) {
      if (u.area == null || u.garrison || u.fort || u.ghost) continue;
      const to = E.neighbors(u.area).find((a) => g.units.some((x) => x.area === a && x.side !== u.side && !x.garrison));
      if (to == null) continue;
      u.area = to; g.phase = 'combat'; g.phasing = u.side; g.battle = null;
      try { E.startBattle(g, to); F.setGame(g); return true; } catch { return false; }
    }
    return false;
  });
  check(fought, 'a battle starts');
  await page.waitForTimeout(800);
  check(await page.locator('.c-vs').count() > 0, 'the battle table shows');
  for (let i = 0; i < 6; i++) { const go = page.locator('.c-bar button.go:not([disabled])'); if (!(await go.count())) break; await go.click().catch(() => {}); await page.waitForTimeout(600); }
  check(!(await page.locator('text=Display problem').count()), 'battle steps without a display problem');

  // the rules reader: open, look up a rule, search, close
  await page.keyboard.press('Shift+Slash');
  check(await page.waitForSelector('#rules', { timeout: 20000 }).then(() => true, () => false), 'the rules reader opens');
  await page.fill('#rules input', RULE[game]); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(800);   // the search settles first
  check((await page.locator('#rules h2').first().textContent().catch(() => ''))?.includes(RULE[game]), `rule ${RULE[game]} opens`);
  await page.click('#rules [data-act="close"]').catch(() => {}); await page.waitForTimeout(300);
  check(!(await page.locator('#rules').count()), 'the reader closes');

  check(!errors.length, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}
// the home page of a production build (HOME_URL=http://localhost:5300/, vite preview): it shows the shelf and the learn card without the 3D table
if (process.env.HOME_URL) for (const [size, opts] of Object.entries(SIZES)) {
  console.log(`home · ${size}`);
  const page = await (await browser.newContext(opts)).newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  check(await page.waitForSelector('.homepage .tutcard', { timeout: 60000 }).then(() => true, () => false), 'the home page shows the learn card');
  await page.waitForTimeout(1000);
  check(await page.evaluate(() => !window.__fab && getComputedStyle(document.getElementById('gl')).display === 'none'), 'the 3D table is not loaded');
  await page.locator('.tutcard button', { hasText: 'Open' }).click();
  check(await page.waitForSelector('#rules', { timeout: 20000 }).then(() => true, () => false), 'the rules reader opens from the home page');
  check(!errors.length, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
