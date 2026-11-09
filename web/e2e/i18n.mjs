// Italian check: opens each game in Italian, plays into a battle and lists the interface text still in English
// (the game's own collector, ?i18n=collect). Unit, place and person names are expected to stay as they are.
// Run with the dev server up:  node e2e/i18n.mjs   (BASE=http://localhost:5199/ by default)
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5199/';
const browser = await chromium.launch(), left = new Set();
for (const game of ['bulge', 'golan73', 'sicily']) {
  const page = await (await browser.newContext({ viewport: { width: 1380, height: 860 } })).newPage();
  await page.addInitScript(() => { localStorage.setItem('fab-lang', 'it'); localStorage.setItem('fab-map3d', '0'); localStorage.setItem('fab-autoroll', '0'); });
  await page.goto(`${BASE}?dev=1&new=1&game=${game}&i18n=collect`); await page.waitForTimeout(5000);
  for (let i = 0; i < 12; i++) {                              // press the main button, or open the first battle when one is waiting
    await page.evaluate(() => { const g = window.__fab.game(), E = window.__fab.E; const m = E?.mustFight?.(g) ?? []; const go = document.querySelector('button.go:not([disabled])'); if (go) go.click(); else if (m.length) { const q = window.__fab.at(m[0]); document.elementFromPoint(q.x, q.y)?.dispatchEvent(new PointerEvent('pointerup', { clientX: q.x, clientY: q.y, bubbles: true })); } });
    await page.waitForTimeout(2500);
  }
  for (const s of await page.evaluate(() => window.__i18nMissing())) if (/[a-z]{3}/.test(s) && !/^\d|\d(st|nd|rd|th)\b/.test(s)) left.add(s);
  await page.close();
}
await browser.close();
console.log(left.size ? `Still in English (${left.size}); names of units, places and people can stay:\n` + [...left].map((s) => `  ${s}`).join('\n') : 'Nothing left in English.');
