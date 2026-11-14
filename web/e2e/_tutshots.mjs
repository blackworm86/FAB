import { chromium, devices } from 'playwright';
// Phone screenshots of every step of a course. COURSE=<id> OUT=<folder>/ node e2e/_tutshots.mjs
const out = process.env.OUT;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem('fab-lang', 'en');
});
await page.goto('http://localhost:5199/?tutorial=' + process.env.COURSE + '');
await page.waitForFunction(() => window.__fab?.tut?.(), null, { timeout: 90000 });
await page.waitForTimeout(3000);
let last = '',
  n = 0;
for (let i = 0; i < 200; i++) {
  const w = await page.evaluate(() => window.__fab.tut()?.where() ?? {});
  if (w.title == null) break;
  const key = `${w.lesson}.${w.step}`;
  if (key !== last) {
    last = key;
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}${String(++n).padStart(2, '0')}-L${w.lesson}S${w.step}.png` });
  }
  await page.evaluate(() => window.__fab.tut().advance());
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.c-bar button')].find((x) => /^Continue/.test(x.textContent.trim()));
    c?.click();
    document.querySelector('.tut-coach [data-t="next"]')?.click();
  });
  await page.waitForTimeout(500);
}
console.log(n, 'shots', errs.length ? 'errors: ' + errs.join(' | ') : 'no errors');
await b.close();
