// Lessons, played in a browser: every step's target must be on screen. Walks each course step by step: a step whose
// target is a button or card is pressed, a block or area is tapped on the map, the rest is played the way the coach would (advance). A target that never
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
  const where = () => page.evaluate(() => window.__fab.tut()?.where() ?? {});   // no coach left: the course is over
  let last = '', same = 0, steps = 0, missing = []; const gaveUp = new Set();
  for (let i = 0; i < 2000; i++) {
    const w = await where(); const key = `${w.lesson}.${w.step}`;
    if (key === last) {
      if (++same > 20) {                                 // stuck: say where, then go on from the next lesson so one stop does not hide the rest
        missing.push(`lesson ${w.lesson} step ${w.step} "${w.title}"${w.found ? ': stuck' : ' → ' + w.target}`);
        await page.screenshot({ path: new URL(`./shots/stuck-${c}-${w.lesson}.png`, import.meta.url).pathname }).catch(() => {});
        if (gaveUp.has(w.lesson + 1)) break; gaveUp.add(w.lesson + 1);
        await page.evaluate((l) => window.__fab.tut().jump(l), w.lesson + 1); await page.waitForTimeout(1500); same = 0; last = ''; continue;
      }
    } else { same = 0; last = key; steps++; }
    if (w.title == null) break;
    if (!w.found && same > 14) { missing.push(`lesson ${w.lesson} step ${w.step} "${w.title}" → ${w.target} (not found)`); await page.evaluate(() => window.__fab.tut().advance()); await page.waitForTimeout(400); continue; }
    // played as the player would: a tap on the map where the coach points, a press on the button it rings; a step that
    // does not move on that way is played by the coach (advance)
    if (same < 3 && w.tap) await page.mouse.click(w.tap.x, w.tap.y);
    else if (!((same < 8 || same % 2) && !w.tap && await page.evaluate(() => { const e = window.__fab.tut().targetEl(); if (e && e.offsetParent !== null) { e.click(); return true; } return false; }))) await page.evaluate(() => window.__fab.tut().advance());
    // a dice result waits for the player's Continue (no automation): press it, as the player would
    if (same >= 2) await page.evaluate(() => [...document.querySelectorAll('.c-bar button:not([disabled])')].find((x) => /^Continue/.test(x.textContent.trim()))?.click());
    await page.waitForTimeout(350);
    await page.evaluate(() => { const n = document.querySelector('.tut-coach [data-t="next"]'); if (n) n.click(); });
    await page.waitForTimeout(250);
  }
  console.log(`${c}: ${steps} steps walked${missing.length ? '\n' + missing.map((m) => '  MISSING ' + m).join('\n') : ', every target found'}${errs.length ? '\n  errors: ' + errs.join(' | ') : ''}`);
  bad += missing.length + errs.length; await page.close();
}
await browser.close(); process.exit(bad ? 1 : 0);
