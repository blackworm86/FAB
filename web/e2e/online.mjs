// Two-browser online test: two accounts on the local Firebase emulators (never the real project) create and join a game of each volume,
// the second player sits and moves, they fight battles from both seats, and after every step the two screens must agree and neither
// may hold the other's hidden blocks. Run:  cd web && npm run online   (needs Java and `npm ci` in tools/rules-test; about two minutes).
//   GAMES=bulge  one volume only.  SWAP=1  the creator on the phone.  SHOTS=<folder>  a picture of the invitation.  It starts and stops its own emulators and dev server (ports 9099, 9000, 5198).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..'),
  FIREBASE = join(ROOT, 'tools/rules-test/node_modules/.bin/firebase'),
  PORT = 5198,
  BASE = `http://localhost:${PORT}/`,
  DB = 'http://127.0.0.1:9000',
  NS = 'demo-fab-default-rtdb';
const GAMES = process.env.GAMES?.split(',') ?? ['bulge', 'sicily', 'golan73'];
/** Which seat the creator takes: the joiner is second to sit either way, once in each seat key. */
const CREATOR_SEAT = { bulge: 0, sicily: 1, golan73: 0 };
const BATTLES = 6; // battles fought per game at most: until a hit choice and a retreat were both seen
if (!existsSync(FIREBASE)) {
  console.log('The Firebase emulator is not installed: run `npm ci` in tools/rules-test (needs Java).');
  process.exit(1);
}

let failed = 0;
const check = (ok, what) => {
  if (!ok) failed++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  return ok;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 20000, every = 250) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(every)) {
    const v = await f().catch(() => null);
    if (v) return v;
  }
  return null;
};
const up = (url) =>
  until(
    () =>
      fetch(url).then(
        () => true,
        () => false,
      ),
    120000,
    1000,
  );

/* ---- the emulators and the dev server ---- */
const procs = [];
const start = (cmd, args, opts) => {
  const p = spawn(cmd, args, { stdio: 'ignore', detached: true, ...opts });
  procs.push(p);
};
const stop = () => {
  for (const p of procs)
    try {
      process.kill(-p.pid);
    } catch {
      /* already gone */
    }
};
process.on('exit', stop);
{
  const dir = mkdtempSync(join(tmpdir(), 'fab-emu-'));
  copyFileSync(join(ROOT, 'database.rules.json'), join(dir, 'database.rules.json'));
  writeFileSync(
    join(dir, 'firebase.json'),
    JSON.stringify({
      database: { rules: 'database.rules.json' },
      emulators: { auth: { host: '127.0.0.1', port: 9099 }, database: { host: '127.0.0.1', port: 9000 }, ui: { enabled: false } },
    }),
  );
  start(FIREBASE, ['emulators:start', '--only', 'auth,database', '--project', 'demo-fab'], { cwd: dir });
  start('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: join(ROOT, 'web'),
    env: {
      ...process.env,
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_PROJECT_ID: 'demo-fab',
      VITE_FIREBASE_DATABASE_URL: `${DB}?ns=${NS}`,
      VITE_FIREBASE_EMULATOR: '127.0.0.1',
    },
  });
  if (!(await up(`${DB}/.json?ns=${NS}`)) || !(await up('http://127.0.0.1:9099/')) || !(await up(BASE))) {
    console.log('The emulators or the dev server did not start (are ports 9000, 9099 or 5198 taken? is Java installed?).');
    process.exit(1);
  }
}
/** The database as stored, read past the rules (the emulator's owner token). */
const raw = (path) => fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());

/** A tap on the home page, which redraws itself while games and accounts load: try again if the button was replaced under the pointer. */
const tap = async (loc) => {
  if (!(await until(() => loc.click({ timeout: 4000 }).then(() => true), 60000))) throw new Error(`could not tap ${loc}`);
};

/* ---- what runs inside a page ---- */
const table = (p) => p.waitForFunction(() => window.__fab && document.querySelector('.c-bar.b'), null, { timeout: 180000 });
/** This seat's picture of the game, reduced to what both seats must agree on, and its own blocks the other may not see. */
const look = (p) =>
  p.evaluate(() => {
    const F = window.__fab,
      E = F.E,
      g = F.settled(),
      me = F.online.mySide(),
      foe = E.sidesOf(g).find((s) => s !== me),
      b = g.battle;
    return {
      me,
      rev: F.online.rev,
      sync: F.online.sync,
      actor: E.actorOf(g),
      stage: b?.stage ?? null,
      pointDone: !!b?.attPointDone,
      ownHidden: g.units.filter((u) => u.side === me && u.name === 'Hidden block').length,
      foeHidden: g.units.filter((u) => u.side !== me && u.name === 'Hidden block').length,
      /** my blocks the other side may not see now: their real ids must be nowhere on the other screen or in the shared game.
       *  (A block still standing where a battle showed it keeps its reveal until it moves: docs/ONLINE.md §5.) */
      secret: g.units.filter((u) => u.side === me && !E.visibleTo(g, u, foe) && !(u.up != null && u.up === u.area)).map((u) => u.id),
      json: JSON.stringify(g),
      held: !!document.querySelector('.seatbar.audit'),
      same: JSON.stringify({
        t: g.turn,
        ph: g.phase,
        side: g.phasing,
        over: g.over ?? null,
        toAct: E.actorOf(g),
        rolls: g.rolls,
        battle: b && { area: b.area, stage: b.stage, att: b.attacker, dice: b.rolls.map((r) => r.dice), pending: b.pending ?? null },
        units: g.units.map((u) => [u.side, u.area ?? null, u.box ?? null]),
        chits: g.chits.map((c) => [c.id, c.box, c.area ?? null]),
        control: g.control,
      }),
    };
  });
/** Change the game with the rules engine on this seat's own copy, and save it the way a tap does. Returns what the function returns, or the error. */
const play = (p, f, arg) =>
  p.evaluate(
    ([src, a]) => {
      const F = window.__fab,
        g = structuredClone(F.settled());
      try {
        const r = new Function('E', 'g', 'me', 'a', `return (${src})(E, g, me, a)`)(F.E, g, F.online.mySide(), a);
        F.setGame(g);
        return r ?? 'ok';
      } catch (e) {
        return '!' + (e?.message ?? e);
      }
    },
    [f.toString(), arg],
  );
/** One step of a battle, by the seat that has to act. */
const battleStep = (E, g, me) => {
  const b = g.battle,
    st = b.stage;
  if (st === 'setup') {
    if (b.defSA) return E.passSA(g, b), 'no Special Action';
    const att = me === b.attacker,
      pt = () => {
        const u = E.fighters(g, b.area, me, att).find((x) => !x.garrison && !x.ghost && !(att && x.disorder));
        if (u) E.setPoint(g, b, me, u.id);
      };
    if (att && !b.ready?.includes(me)) return E.setReady(g, b, me), 'attacker assets done';
    pt();
    return E.setReady(g, b, me), 'point unit';
  }
  if (st === 'done') return E.closeBattle(g), 'closed';
  if (st === 'attChoice') return E.attackerChoice(g, b, false), 'choice';
  if (st === 'defChoice') return E.defenderChoice(g, b, true), 'choice';
  if (st === 'attFirst') return E.chooseFirstLoss(g, b, b.attPoint), 'choice';
  if (st === 'retreat') return E.chooseRetreat(g, b, E.retreatOptions(g, b)[0]), 'retreat';
  if (st === 'exploit') return E.declineExploit(g, b), 'no exploitation';
  return E.roll_step(g, b), st;
};
/** A battle to fight: one of my blocks steps into a neighbouring area held by the enemy, in my Combat Phase. (A shortcut past the turn's earlier steps.) */
const pickFight = (E, g, me) => {
  for (const alone of [true, false]) // first an area none of my blocks is in; failing that, any enemy-held neighbour
    for (const u of g.units) {
      if (u.side !== me || u.area == null || u.garrison || u.fort || u.ghost || u.disorder) continue;
      const to = E.neighbors(u.area).find(
        (a) =>
          g.units.some((x) => x.area === a && x.side !== me && !x.garrison) &&
          !(alone && g.units.some((x) => x.area === a && x.side === me)),
      );
      if (to == null) continue;
      const keep = JSON.stringify(g);
      try {
        u.area = to;
        g.phase = 'combat';
        g.phasing = me;
        g.battle = null;
        E.startBattle(g, to);
        return `battle in area ${to}`;
      } catch {
        Object.assign(g, JSON.parse(keep)); // this one cannot be fought: try the next block
      }
    }
  throw new Error('no battle to start');
};

/** The seat that has to act gives the turn to the other, straight to its Combat Phase (a shortcut the Rules check accepts: time goes forward). */
const handOver = (E, g, me) => {
  const [p1, p2] = E.sidesOf(g),
    to = me === p1 ? p2 : p1;
  if (to === p1) g.turn++;
  g.phase = 'combat';
  g.phasing = to;
  g.battle = null;
};

/* ---- the test ---- */
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const stamp = Date.now();
async function player(name, size) {
  const page = await (await browser.newContext({ ...size, reducedMotion: 'reduce' })).newPage(), // quick dice: the software 3D here is slow
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|permission_denied|ERR_INTERNET_DISCONNECTED/i.test(m.text()))
      errors.push(m.text());
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#a-mail', { timeout: 120000 });
  check(!(await page.locator('#a-name').isVisible()), `${name}: the Sign in tab hides the name field`);
  await page.click('.signin [data-tab="reg"]'); // registering is on the Create account tab
  check(await page.locator('#a-name').isVisible(), `${name}: the Create account tab shows the name field`);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `home-out-${name}.png`), fullPage: true });
  await page.fill('#a-name', name);
  await page.fill('#a-mail', `${name.toLowerCase()}${stamp}@fab.test`);
  await page.fill('#a-pass', 'secret1');
  await page.click('[data-auth="reg"]');
  if (!(await until(() => page.locator('[data-auth="out"]').count(), 60000))) {
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `home-stuck-${name}.png`), fullPage: true });
    throw new Error(
      `${name} could not create an account: ${(await page.locator('.homepage').innerText()).slice(0, 300)} | ${errors.join(' | ')}`,
    );
  }
  return { name, page, errors };
}
const DESK = { viewport: { width: 1380, height: 860 } },
  PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const A = await player('Anna', process.env.SWAP ? PHONE : DESK), // one desktop, one phone; SWAP=1: the creator is on the phone
  B = await player('Bruno', process.env.SWAP ? DESK : PHONE);
let hitChoice = 0,
  retreats = 0;

for (const game of GAMES) {
  console.log(`\n${game}`);
  /* Anna creates the game on the home page */
  await A.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await tap(A.page.locator(`button[aria-label^="${{ bulge: 'The Bulge', sicily: 'Sicily', golan73: 'Golan' }[game]}"]:visible`).first()); // the box on a desktop, its spine on a phone
  await tap(A.page.locator('[title="Start a new game"], [aria-label="Start a new game"]').first());
  await tap(A.page.locator('.tiles .tile').nth(CREATOR_SEAT[game]));
  await tap(A.page.locator('button', { hasText: 'Create game' }));
  await A.page.waitForURL(/[?&]table=/, { timeout: 60000 });
  const id = new URL(A.page.url()).searchParams.get('table');
  check(!!id && (await table(A.page).then(() => true, () => false)), `the creator's table opens (code ${id})`); // prettier-ignore
  check(await until(async () => (await look(A.page)).rev > 0), 'the creator receives the shared game');
  /* the invitation: the code written large and the link as a QR code (owner's issue #2) */
  await A.page.locator('.seatbar button.primary').first().click({ timeout: 30000 });
  check(
    (await until(() => A.page.locator('.invite-sheet .invqr svg').count(), 15000)) &&
      (await A.page.locator('.invite-sheet .invcode').textContent()) === id,
    'the invitation shows the game code and a QR code',
  );
  if (process.env.SHOTS) await A.page.screenshot({ path: join(process.env.SHOTS, `invite-${game}.png`) });
  await A.page.locator('.invite-sheet [data-k="x"]').click();

  /* Bruno types the code on the home page and takes the free seat */
  await B.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await B.page.waitForSelector('.codebar #join'); // the invitation line under the title
  await B.page.fill('.codebar #join', id);
  await B.page.locator('.codebar button').click();
  check(await table(B.page).then(() => true, () => false), 'the code opens the table for the second player'); // prettier-ignore
  check(
    await until(() => B.page.evaluate((v) => window.__fab.game().game === v || (v === 'bulge' && !window.__fab.game().game), game)),
    'it is the same volume, not another table',
  );
  await B.page.locator('.seatbar button.primary').first().click({ timeout: 30000 });
  check(await until(async () => (await look(B.page)).me), 'the second player is seated');

  /* own blocks visible without a reload (the fault fixed in commit edec14c: the second seat's blocks stayed hidden) */
  const a0 = await look(A.page);
  check(await until(async () => (await look(B.page)).ownHidden === 0, 15000), 'the second player sees all of its own blocks (no reload)');
  check(a0.ownHidden === 0, 'the creator sees all of its own blocks');

  const settle = async (what) => {
    // both screens show the same game, nothing is being saved or held back, and no hidden block of one seat is on the other screen or in the stored game
    let a, b, leaks;
    const t0 = Date.now(),
      found = (ids, text) => ids.filter((x) => text.includes(JSON.stringify(x)));
    const done = await until(async () => {
      [a, b] = [await look(A.page), await look(B.page)];
      const st = await raw(`games/${id}/state`),
        stored = [st.f, st.units, st.chits].flatMap((o) => Object.values(o ?? {})).join('\n'); // each value is itself a piece of JSON text
      leaks = [
        [`on ${B.name}'s screen`, found(a.secret, b.json)],
        [`on ${A.name}'s screen`, found(b.secret, a.json)],
        ['in the stored game', found([...a.secret, ...b.secret], stored)],
      ].filter((x) => x[1].length);
      return a.same === b.same && !/saving/.test(a.sync + b.sync) && !leaks.length && !a.held && !b.held;
    }, 30000);
    if (done) return true;
    if (a.same !== b.same) {
      check(false, `${what}: the two screens agree`);
      const x = JSON.parse(a.same),
        y = JSON.parse(b.same);
      for (const k of Object.keys(x))
        if (JSON.stringify(x[k]) !== JSON.stringify(y[k]))
          console.log(`       ${k}: ${A.name} ${JSON.stringify(x[k]).slice(0, 160)} | ${B.name} ${JSON.stringify(y[k]).slice(0, 160)}`);
    }
    if (/saving|NOT SAVED/.test(a.sync + b.sync)) check(false, `${what}: saved (${A.name} "${a.sync}", ${B.name} "${b.sync}")`);
    if (a.held || b.held) check(false, `${what}: no change held back by the Rules check`);
    for (const [where, ids] of leaks) check(false, `${what}: hidden blocks stay hidden (${ids.slice(0, 4).join(', ')} ${where})`);
    return false;
  };
  check(await settle('after sitting'), 'after sitting: the screens agree and hidden blocks stay hidden');

  /* the chat: the second player, just seated, writes; the creator reads it (only the two players may) */
  await B.page.locator('.chatbtn').first().click({ timeout: 15000 });
  await B.page.fill('#chat-in', `hello ${game}`);
  await B.page.press('#chat-in', 'Enter');
  check(
    await until(() => A.page.evaluate((t) => window.__fab.online.chat.some((m) => m.text === t), `hello ${game}`), 20000),
    "the second player's chat line reaches the creator",
  );
  await B.page.locator('.chatbtn').first().click();

  /* Sicily starts with a set-up step: the quick set-up, each seat its own blocks (the Axis garrisons first, then the landing) */
  if (game === 'sicily') {
    const setUp = (E, g, me) => {
      if (g.phase !== 'deploy') return 'no set-up';
      if (me === E.sidesOf(g)[1]) return E.sicily.autoGarrisons(g), 'garrisons';
      E.sicily.autoDeploy(g);
      E.endPhase(g);
    };
    for (const p of CREATOR_SEAT.sicily ? [A, B] : [B, A]) {
      const r = await play(p.page, setUp);
      check(!String(r).startsWith('!'), `${p.name} sets up${String(r).startsWith('!') ? ': ' + r : ''}`);
      await settle('after the set-up');
    }
  }
  check((await look(A.page)).foeHidden > 0 && (await look(B.page)).foeHidden > 0, "each player sees the other's blocks face down");

  /* battles: the second player attacks first (its first move was lost before edec14c), then they alternate */
  let ok = true,
    fought = 0;
  for (let n = 0; n < BATTLES && ok && (n < 2 || !hitChoice || !retreats); n++) {
    const att = n % 2 ? A : B,
      def = att === A ? B : A,
      v = await look(att.page);
    if (v.actor !== v.me && v.actor !== 'both') {
      await play(def.page, handOver);
      await settle('the turn is handed over');
    }
    const r = await play(att.page, pickFight);
    if (String(r).startsWith('!')) {
      if (fought < 2) ok = check(false, `${att.name} starts a battle: ${r}`);
      break; // nothing left to attack: enough once both seats have fought
    }
    ok = await settle(`battle ${n + 1} begins`);
    if (n === 0) check(ok, "the second player's first move arrives on the creator's screen");
    for (let k = 0; k < 120 && ok; k++) {
      const [a, b] = [await look(A.page), await look(B.page)];
      if (!a.stage && !b.stage) break; // the battle is closed
      if (a.stage === 'setup' && a.pointDone) {
        // both point units are chosen: each browser publishes its blocks there and the attacker's starts the combat by itself
        ok = !!(await until(async () => (await look(A.page)).stage !== 'setup' && (await look(B.page)).stage !== 'setup', 20000));
        if (!ok) check(false, `battle ${n + 1}: the combat starts once both point units are chosen`);
        continue;
      }
      const who = a.actor === a.me ? A : b.actor === b.me ? B : null;
      if (!who) {
        ok = check(
          false,
          `battle ${n + 1}: somebody has to act (stage ${a.stage}; to act, on ${A.name}'s screen: ${a.actor}, on ${B.name}'s: ${b.actor})`,
        );
        for (const v of [a, b]) console.log('      ', v.me, v.sync, JSON.stringify(JSON.parse(v.json).battle).slice(0, 400));
        break;
      }
      const st = a.stage,
        did = await play(who.page, battleStep);
      if (String(did).startsWith('!')) {
        ok = check(false, `battle ${n + 1}, ${st}: ${who.name} ${did}`);
        break;
      }
      if (did === 'choice') hitChoice++;
      if (did === 'retreat') retreats++;
      ok = await settle(`battle ${n + 1}, ${st}`);
    }
    if (ok) fought++;
  }
  check(ok && fought >= 2, `${fought} battles fought to the end from both seats, the screens agreeing after every step`);

  /* both players move at the same moment, several times in a row (a step both sides work in): every move of both must stay.  BURSTS=20: this check alone, that many times */
  for (let round = 0; round < (Number(process.env.BURSTS) || 1); round++) {
    for (const p of [A, B]) await p.page.evaluate(() => (window.__fabTrace = []));
    const v = await look(A.page),
      mover = v.actor === v.me || v.actor === 'both' ? A : B;
    if (round === 0)
      await play(mover.page, (E, g) => {
        g.turn++;
        g.phase = 'reinforcement'; // both sides act here
        g.phasing = E.sidesOf(g)[0];
        g.battle = null;
      });
    await settle('a step for both sides');
    /** Four of my blocks step to a neighbouring area with no enemy, one save each, a moment apart: later ones leave while an earlier save is still on its way. */
    const burst = (p) =>
      p.evaluate(async () => {
        const F = window.__fab,
          E = F.E,
          me = F.online.mySide(),
          want = {};
        for (let k = 0; k < 4; k++) {
          const g = structuredClone(F.settled()),
            u = g.units.find(
              (x) =>
                x.side === me && x.area != null && !x.garrison && !x.fort && !(x.id in want) &&
                E.neighbors(x.area).some((a) => !g.units.some((y) => y.area === a && y.side !== me)),
            ); // prettier-ignore
          if (!u) break;
          u.area = E.neighbors(u.area).find((a) => !g.units.some((y) => y.area === a && y.side !== me));
          want[u.id] = u.area;
          F.setGame(g);
          await new Promise((r) => setTimeout(r, 120));
        }
        return want;
      });
    const [wa, wb] = await Promise.all([burst(A.page), burst(B.page)]);
    const agreed = await settle('both moved at once');
    const kept = (p, want) =>
      p.evaluate(
        (w) => Object.entries(w).filter(([id, a]) => window.__fab.settled().units.find((u) => u.id === id)?.area !== a).length,
        want,
      );
    for (const [p, w] of [
      [A, wa],
      [B, wb],
    ]) {
      const d = await p.page.evaluate(
        (w) =>
          Object.entries(w)
            .map(([id, a], i) => [i + 1, id, a, window.__fab.settled().units.find((u) => u.id === id)?.area])
            .filter((x) => x[2] !== x[3]),
        w,
      );
      for (const [i, id, a, now] of d)
        console.log(`       ${p.name}'s move ${i} of ${Object.keys(w).length} lost: ${id} should be in area ${a}, is in ${now}`);
    }
    const lost = (await kept(A.page, wa)) + (await kept(B.page, wb)),
      traces = lost ? await Promise.all([A, B].map((p) => p.page.evaluate(() => window.__fabTrace))) : [];
    traces
      .flatMap((t, i) => t.map(([at, m]) => [at, `${[A, B][i].name}: ${m}`]))
      .sort((x, y) => x[0] - y[0])
      .forEach(([at, m]) => console.log(`         ${at % 100000} ${m}`));
    const n = Object.keys(wa).length + Object.keys(wb).length;
    check(
      agreed && n >= 4 && !lost,
      `both players move at the same moment: all ${n} moves stay on both screens${lost ? ` (${lost} lost)` : ''}`,
    );
  }

  /* the second player loses the connection, moves, and comes back while the creator moved too: nothing is lost, and the dot tells the truth */
  {
    const dot = (p) => p.evaluate(() => document.querySelector('.syncdot')?.className.replace('syncdot', '').trim() ?? 'none'),
      step = (p) =>
        play(p.page, (E, g, me) => {
          const u = g.units.find(
            (x) => x.side === me && x.area != null && !x.garrison && !x.fort && E.neighbors(x.area).some((a) => !g.units.some((y) => y.area === a && y.side !== me)),
          ); // prettier-ignore
          u.area = E.neighbors(u.area).find((a) => !g.units.some((y) => y.area === a && y.side !== me));
          return [u.id, u.area];
        }),
      at = (p, [id, a]) => p.page.evaluate(([i, x]) => window.__fab.settled().units.find((u) => u.id === i)?.area === x, [id, a]);
    check((await dot(A.page)) === 'ok' && (await dot(B.page)) === 'ok', 'both connection dots are green');
    await B.page.context().setOffline(true);
    check(await until(async () => (await dot(B.page)) !== 'ok', 90000), 'without a connection the dot is no longer green');
    const mb = await step(B),
      ma = await step(A);
    await sleep(1500);
    await B.page.context().setOffline(false);
    const agreed = await settle('after the connection came back');
    check(
      agreed && (await at(A, ma)) && (await at(B, mb)),
      'moves made while one player was offline are all there when the connection is back',
    );
    check(await until(async () => (await dot(A.page)) === 'ok' && (await dot(B.page)) === 'ok', 30000), 'both dots are green again');
  }

  /* game data cannot carry HTML to the other screen (audit): a tag written into the shared game arrives without its brackets */
  {
    const v = await look(B.page),
      w = v.actor === v.me || v.actor === 'both' ? B : A,
      o = w === A ? B : A;
    await play(w.page, (E, g) => void g.log.push('<img src=x onerror="window.__pwned=1">'));
    check(
      (await until(() => o.page.evaluate(() => /img src=x/.test(JSON.stringify(window.__fab.settled().log))), 20000)) &&
        (await o.page.evaluate(() => !/<img/.test(JSON.stringify(window.__fab.settled())) && !window.__pwned)),
      'a tag written into the shared game reaches the other screen as plain text',
    );
  }

  /* a reload: the page builds the same game again from the database */
  const before = (await look(B.page)).same;
  await B.page.reload({ waitUntil: 'domcontentloaded' });
  await table(B.page);
  check(
    await until(async () => (await look(B.page)).same === before && (await look(B.page)).ownHidden === 0),
    'after a reload the second player has the same game and its own blocks',
  );
  check(await settle('after the reload'), 'after the reload: the screens agree and hidden blocks stay hidden');
}
if (GAMES.length === 3) {
  check(hitChoice > 0, `a hit choice was played (${hitChoice})`);
  check(retreats > 0, `a retreat was played (${retreats})`);
}
/* hot-seat: two players on one screen, saved online under one account (owner's decision, 15 November 2026) */
{
  console.log('\nhot-seat');
  await A.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await tap(A.page.locator('button[aria-label^="The Bulge"]:visible').first());
  await tap(A.page.locator('[title="Start a new game"], [aria-label="Start a new game"]').first());
  await tap(A.page.locator('.tiles .tile.hotseat'));
  await tap(A.page.locator('button', { hasText: 'Create game' }));
  await A.page.waitForURL(/[?&]table=/, { timeout: 60000 });
  const id = new URL(A.page.url()).searchParams.get('table');
  await table(A.page);
  check(
    await until(() => A.page.evaluate(() => window.__fab.online.rev > 0 && window.__fab.online.hotseat && window.__fab.online.both())),
    'a game on this screen opens, and its one account plays both sides',
  );
  /** Whoever has to act hands the turn to the other side. */
  const pass = (E, g) => {
    const [p1, p2] = E.sidesOf(g),
      a = E.actorOf(g),
      to = (a === 'both' ? p1 : a) === p1 ? p2 : p1;
    if (to === p1) g.turn++;
    g.phase = 'combat';
    g.phasing = to;
    g.battle = null;
    return to;
  };
  const first = await play(A.page, pass),
    second = await play(A.page, pass);
  check(
    first !== second && !String(first).startsWith('!') && !String(second).startsWith('!'),
    'both sides take their turn from the one screen',
  );
  check(await until(async () => /^saved/.test((await look(A.page)).sync), 20000), 'it is saved online');
  const before = (await look(A.page)).same;
  await A.page.reload({ waitUntil: 'domcontentloaded' });
  await table(A.page);
  check(
    await until(async () => (await look(A.page)).same === before, 30000),
    'reopened, it is the same game (as on another device of the same account)',
  );
  await A.page.goto(BASE, { waitUntil: 'domcontentloaded' });
  check(await until(() => A.page.locator('.matchrow', { hasText: 'This screen' }).count(), 30000), 'the games list marks it "This screen"');
  check((await raw(`games/${id}/priv`)) === null, 'no private block records are kept for it');
}

/* signing out on the home page works at once, without a reload (owner's issue #1) */
await A.page.goto(BASE, { waitUntil: 'domcontentloaded' });
await tap(A.page.locator('[data-auth="out"]').first());
check(await until(() => A.page.locator('#a-mail').count(), 20000), 'Sign out shows the sign-in form at once, without a reload');
for (const p of [A, B])
  check(!p.errors.length, `no errors on ${p.name}'s page${p.errors.length ? ': ' + p.errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
stop();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
