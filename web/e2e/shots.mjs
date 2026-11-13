// The look of the table, frozen: each game, on desktop and on a phone, is shown in every phase of the turn, with a
// selected block, in a battle and the main windows, with a picture at every stop. Before a change that must not alter the
// look (moving code between files, a formatting pass):   node e2e/shots.mjs            (pictures into e2e/shots/base)
// after it:                                              COMPARE=1 node e2e/shots.mjs  (into e2e/shots/new, then compared)
// Dev server up, as for the smoke test (BASE, GAMES). Seeded dice, so two runs of the same code give the same pictures.
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5199/';
const GAMES = process.env.GAMES?.split(',') ?? ['bulge', 'golan73', 'sicily'];
const SIZES = { desktop: { viewport: { width: 1380, height: 860 } }, phone: { ...devices['iPhone 13'], deviceScaleFactor: 1 } };   // 1x: these pictures are compared, not looked at
const LIMIT = Number(process.env.LIMIT ?? 0.05);         // % of pixels that may differ
const here = new URL('./shots/', import.meta.url).pathname, dir = here + (process.env.COMPARE ? 'new/' : 'base/');
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const game of process.env.COMPARE === 'only' ? [] : GAMES) for (const [size, opts] of Object.entries(SIZES)) {   // COMPARE=only: compare the pictures already taken
  const page = await (await browser.newContext(opts)).newPage(); let n = 0;
  page.on('pageerror', (e) => console.log(`  page error (${game} ${size}): ${e.message}`));
  await page.addInitScript(() => { localStorage.setItem('fab-lang', 'en'); let a = 7; Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });   // the same chance every run
  // The page's clock is ours (set below, once the table is loaded): each picture is taken after the same six seconds of
  // page time, so glides, fades and messages are always at the same point. The 3D dice are left out (they never land
  // twice the same way; the report panel shows what they rolled).
  const shot = async (what) => {
    if (!n) { await page.clock.runFor(3000); await page.waitForTimeout(2000); }   // the first picture: the opening glide started on real time, it gets the frames to arrive, and the pieces' art the time to load
    for (let i = 0; i < 3; i++) { await page.clock.fastForward(2000); await page.clock.runFor(250); }   // timers jump, a few frames are drawn
    await page.waitForTimeout(n ? 300 : 3000); await page.clock.runFor(50);           // a moment of real time for pictures still loading (longer for the first one), and a frame to draw them
    await page.screenshot({ path: `${dir}${game}-${size}-${String(++n).padStart(2, '0')}-${what}.png`, animations: 'disabled', style: '#dice { visibility: hidden !important }' });
  };
  const fab = (fn, arg) => page.evaluate(fn, arg);
  const click = async (loc) => (await loc.count()) ? loc.first().dispatchEvent('click').then(() => true, () => false) : false;   // not .click(): with the clock stopped it would wait for a frame that never comes
  const press = (text) => click(page.locator('#ui button', { hasText: text }));
  await page.goto(`${BASE}?sandbox=1&dev=1&game=${game}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__fab && document.querySelector('.c-bar.b'), null, { timeout: 180000 });
  await page.click('[title="Hide the sandbox tools"]', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(3000); await page.clock.install(); await page.clock.pauseAt(Date.now() + 1000);   // from here the page's time moves only when shot() moves it
  await fab(() => { const F = window.__fab, g = structuredClone(F.g); g.seed = 7; if (g.phase === 'deploy' && g.game === 'sicily') F.E.sicily.autoDeploy(g); F.setGame(g); });   // the same dice every run
  await shot('start');

  // the windows
  for (const w of ['View', 'Pieces']) if (await press(w)) { await shot(w.toLowerCase()); await page.keyboard.press('Escape'); }
  if (await press(/^Map/)) { await shot('map-list'); await page.keyboard.press('Escape'); }

  // every phase of the turn. The phase is set by hand (as the smoke test does for its battle): the pictures need each
  // phase's screen, not a legal game, and a real turn would need a player for every pending choice.
  if (await press('Place the rest for me')) await shot('placed');
  for (const ph of await fab(() => window.__fab.E.PHASES)) {
    await fab((p) => { const F = window.__fab, g = structuredClone(F.g); g.phase = p; g.battle = null; F.setGame(g); }, ph);
    await shot(ph);
  }

  // a battle, as in the smoke test, pressed through with the main button
  const fought = await fab(() => {
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
  if (fought) for (let i = 0; i < 8; i++) {
    await shot(`battle-${i}`);
    if (!(await click(page.locator('.c-bar button.go:not([disabled])')))) break;
  }
  // a block selected: its card and where it can go. Last, because the camera's glide to the block ends a hair differently
  // each run on the phone and would carry into every later picture.
  await fab(() => { const F = window.__fab, g = structuredClone(F.g); g.phase = 'movement'; g.battle = null; F.setGame(g); });
  if (await click(page.locator('.c-bar button', { hasText: /^Can move/ }))) { await page.clock.runFor(2500); await shot('can-move'); }
  console.log(`${game} · ${size}: ${n} pictures`);
  await page.close();
}

let bad = 0;
if (process.env.COMPARE) {
  if (!existsSync(here + 'base/')) { console.log('no e2e/shots/base: run without COMPARE first'); process.exit(1); }
  const page = await browser.newPage(), b64 = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
  const names = new Set([...readdirSync(here + 'base/'), ...readdirSync(dir)]);
  for (const f of [...names].sort()) {
    if (!existsSync(here + 'base/' + f) || !existsSync(dir + f)) { bad++; console.log(`  DIFFERENT ${f}: only in ${existsSync(dir + f) ? 'new' : 'base'}`); continue; }
    const pct = await page.evaluate(async ([a, b]) => {
      const px = async (src) => { const i = await createImageBitmap(await (await fetch(src)).blob()), c = new OffscreenCanvas(i.width, i.height).getContext('2d'); c.drawImage(i, 0, 0); return c.getImageData(0, 0, i.width, i.height); };
      const A = await px(a), B = await px(b); if (A.width !== B.width || A.height !== B.height) return 100;
      let d = 0; for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 48) d++;
      return (d * 400) / A.data.length;
    }, [b64(here + 'base/' + f), b64(dir + f)]);
    if (pct > (/can-move/.test(f) ? 1 : LIMIT)) { bad++; console.log(`  DIFFERENT ${f}: ${pct.toFixed(2)}% of the picture`); }
  }
  console.log(bad ? `${bad} picture(s) differ` : `all ${names.size} pictures match`);
}
await browser.close();
process.exit(bad ? 1 : 0);
