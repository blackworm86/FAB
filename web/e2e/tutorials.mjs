// Lessons, played in a browser: every step's target must be on screen. Walks each course step by step: a step whose
// target is a button or card is pressed, other steps are played the way the coach would (advance). A target that never
// shows up (an element renamed or moved) is reported with its course, lesson and step.
// Run with the dev server up:  node e2e/tutorials.mjs   (BASE=http://localhost:5199/; COURSES=bulge,golan73,sicily)
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5199/';
const COURSES = (process.env.COURSES ?? 'bulge,golan73,golan73-new,sicily').split(',');
const browser = await chromium.launch(); let bad = 0;
for (const c of COURSES) {
  const page = await (await browser.newContext({ viewport: { width: 1380, height: 860 } })).newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('fab-lang', 'en'); localStorage.setItem('fab-map3d', '0'); });
  await page.goto(`${BASE}?tutorial=${c}`); await page.waitForFunction(() => window.__fab?.tut?.(), null, { timeout: 60000 }); await page.waitForTimeout(2500);
  const where = () => page.evaluate(() => window.__fab.tut().where());
  let last = '', same = 0, steps = 0, missing = [];
  for (let i = 0; i < 2000; i++) {
    const w = await where(); const key = `${w.lesson}.${w.step}`;
    if (key === last) { if (++same > 12) { if (!w.found) missing.push(`lesson ${w.lesson} step ${w.step} "${w.title}" → ${w.target}`); else missing.push(`lesson ${w.lesson} step ${w.step} "${w.title}": stuck`); break; } } else { same = 0; last = key; steps++; }
    if (w.title == null) break;
    if (!w.found && same > 6) { missing.push(`lesson ${w.lesson} step ${w.step} "${w.title}" → ${w.target} (not found)`); await page.evaluate(() => window.__fab.tut().advance()); await page.waitForTimeout(400); continue; }
    // a press that does nothing (a map area, a card that opens a panel) falls back to the coach playing the step
    const clicked = same < 3 && await page.evaluate(() => { const e = window.__fab.tut().targetEl(); if (e && e.offsetParent !== null) { e.click(); return true; } return false; });
    if (!clicked) await page.evaluate(() => window.__fab.tut().advance());
    await page.waitForTimeout(350);
    await page.evaluate(() => { const n = document.querySelector('.tut-coach [data-t="next"]'); if (n) n.click(); });
    await page.waitForTimeout(250);
  }
  console.log(`${c}: ${steps} steps walked${missing.length ? '\n' + missing.map((m) => '  MISSING ' + m).join('\n') : ', every target found'}${errs.length ? '\n  errors: ' + errs.join(' | ') : ''}`);
  bad += missing.length + errs.length; await page.close();
}
await browser.close(); process.exit(bad ? 1 : 0);
