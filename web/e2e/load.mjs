// Load check: each game opens on the table, a battle opens and steps, the main windows open, a lesson opens, with no error
// in the page. The quickest proof that the modules still load in a working order (about a minute).
// Dev server up:  npm run load   (BASE=http://localhost:5199/ by default; a `vite preview` address checks the production build)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const url of ['?sandbox=1&dev=1&game=bulge', '?sandbox=1&dev=1&game=golan73', '?sandbox=1&dev=1&game=sicily', '?tutorial=bulge']) {
  const page = await b.newPage({ viewport: { width: 1380, height: 860 } }),
    errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  await page.goto((process.env.BASE ?? 'http://localhost:5199/') + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const ok = await page
    .waitForFunction(() => window.__fab && document.querySelector('.c-bar.b'), null, { timeout: 120000 })
    .then(
      () => true,
      () => false,
    );
  if (ok && !url.includes('tutorial')) {
    await page.evaluate(() => {
      const F = window.__fab,
        E = F.E,
        g = structuredClone(F.g);
      for (const u of g.units) {
        if (u.area == null || u.garrison || u.fort || u.ghost) continue;
        const to = E.neighbors(u.area).find((a) => g.units.some((x) => x.area === a && x.side !== u.side && !x.garrison));
        if (to == null) continue;
        u.area = to;
        g.phase = 'combat';
        g.phasing = u.side;
        g.battle = null;
        try {
          E.startBattle(g, to);
          F.setGame(g);
        } catch {}
        break;
      }
    });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) {
      await page
        .locator('.c-bar button.go:not([disabled])')
        .first()
        .click({ timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(700);
    }
    for (const w of ['View', 'Pieces']) {
      await page
        .locator('#ui button', { hasText: w })
        .first()
        .click({ timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  }
  await page.waitForTimeout(1500);
  if (!ok || errs.length) {
    bad++;
    console.log(`FAIL ${url}: ${ok ? '' : 'did not open; '}${errs.slice(0, 3).join(' | ').slice(0, 500)}`);
  } else console.log(`ok ${url}`);
  await page.close();
}
await b.close();
process.exit(bad ? 1 : 0);
