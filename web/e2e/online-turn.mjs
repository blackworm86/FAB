// The turn's steps played online, for the two-browser test (online.mjs): each seat acts on its own screen, in its own turn, through the
// interface: the tray and a tap on the map for a new block, the "Can move" chip and a tap on the map for a move, the bar's buttons for
// everything else (ending a step, the battles that follow, the supply rolls). After every action the two screens must agree (settle).
// What depends on the dice (who is cut off, who wins a battle) is compared between the screens, never against a fixed result.

/** Where the played part ends, in the turn after the first whole one: The Bulge opens in the German Combat Phase, so its first-player
 *  movement is only seen in turn 2; the others stop once the new turn's reinforcements are in. */
const STOP = { bulge: 'combat', sicily: 'admin', golan73: 'admin' };
const HAND = Number(process.env.HAND ?? 1); // battles of the turn played with the screen's buttons; the ones after go by the battle part's shortcut (quicker)
const ORDER = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
const MINUTES = 15; // a turn that takes longer is reported, and the test goes on with its other parts

/** What a screen shows and what its player could press now. */
const see = (p) =>
  p.evaluate(() => {
    const F = window.__fab,
      E = F.E,
      g = F.settled(),
      me = F.online.mySide(),
      b = g.battle,
      shown = (e) => !!e && e.getClientRects().length > 0;
    return {
      me,
      turn: g.turn,
      phase: g.phase,
      phasing: g.phasing,
      actor: E.actorOf(g),
      over: g.over ?? null,
      stage: b?.stage ?? null,
      pointDone: !!b?.attPointDone,
      blow: !!g.pendingBlow,
      step: document.querySelector('.phpill')?.title ?? '', // "Turn 1, German player turn: Combat (step 5 of 8)"
      go: [...document.querySelectorAll('.c-bar.b .bacts button.go:not([disabled])')].map((x) => x.textContent.trim()),
      rows: document.querySelectorAll('button.lossrow:not(.on):not([disabled])').length, // a point unit or a first loss to choose
      panel: [...document.querySelectorAll('.volpanel button:not([disabled]), .c-bar.b .bacts button.go:not([disabled])')]
        .filter(shown)
        .map((x) => x.textContent.trim()),
      arrivals: g.pendingArrivals.filter(
        (id) => g.units.find((u) => u.id === id)?.side === me && shown(document.querySelector(`[data-arr="${CSS.escape(id)}"]`)),
      ),
      movers:
        g.phase === 'movement' &&
        g.units.filter((u) => u.side === me && u.area != null && !u.moved && !u.garrison && E.moveOptions(g, u.id).length).length,
      // Sicily 14.27a: the Allied airborne units drop before any battle, onto a zone the engine names
      drop:
        g.game === 'sicily' && g.phase === 'combat' && !b && g.phasing === me
          ? g.units.filter((u) => u.box === 'airborne_assault' && u.side === me).map((u) => [u.id, E.sicily.airDropTargets(g, u.id)])
          : [],
      retreat: b?.stage === 'retreat' ? E.retreatOptions(g, b) : [],
      cut: g.units
        .filter((u) => u.area != null && u.unsupplied)
        .map((u) => `${u.side}:${u.area}`)
        .sort()
        .join(' '), // the out-of-supply marks, as each screen draws them (also on a hidden block)
      prompt: document.querySelector('.c-prompt')?.textContent.trim().slice(0, 160) ?? '',
    };
  });

export async function playTurn({ A, B, game, settle, check, play, battleStep, sleep, until, seen }) {
  let tapsSent = 0;
  const t0 = Date.now(),
    note = (t) => console.log(`  note ${t}`);
  /** A click on a button the page shows. The button's own click, not the mouse: with two software-drawn 3D pages a mouse click waits
   *  2 to 10 seconds for a drawn frame (measured), and a turn is some hundred clicks. */
  const click = (p, loc) =>
    loc
      .filter({ visible: true })
      .first()
      .evaluate((e) => e.getClientRects().length > 0 && !e.disabled && (e.click(), true), null, { timeout: 4000 })
      .catch(() => false);
  /** A tap on an area of the map, once the camera has come to rest and nothing covers the spot. */
  const mapTap = async (p, area) => {
    const at = () =>
      p.page.evaluate((a) => {
        const q = window.__fab.at(a);
        return { x: Math.round(q.x), y: Math.round(q.y), free: document.elementFromPoint(q.x, q.y)?.tagName === 'CANVAS' };
      }, area);
    let q = await at();
    for (let i = 0; i < 8; i++) {
      await sleep(200);
      const r = await at();
      if (r.x === q.x && r.y === q.y) break;
      q = r;
    }
    if (q.free) await p.page.mouse.click(q.x, q.y);
    else {
      /* the spot is off the screen or under a panel (the camera is not panned by this test): the same tap, sent to the map */
      tapsSent++;
      await p.page.evaluate(({ x, y }) => {
        const c = document.querySelector('canvas#gl') ?? document.querySelector('canvas');
        for (const t of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })); // prettier-ignore
      }, q);
    }
    return true;
  };
  const unitAt = (p, id, area) =>
    until(() => p.page.evaluate(([i, a]) => window.__fab.game().units.find((u) => u.id === i)?.area === a, [id, area]), 3000, 150);
  /** A new block: picked in the tray, then a tap on one of its lit entry areas. */
  const arrive = async (p, id) => {
    await click(p, p.page.locator(`[data-arr="${id}"]`));
    const to = await p.page.evaluate((i) => window.__fab.E.arrivalOptions(window.__fab.game(), i).filter((o) => !o.sa).map((o) => o.area), id); // prettier-ignore
    for (const a of to.slice(0, 5)) if ((await mapTap(p, a)) && (await unitAt(p, id, a))) return true;
    await p.page.keyboard.press('Escape'); // put it back in the tray
    return false;
  };
  /** A move: the "Can move" chip goes through my blocks to the one wanted, then a tap on one of its lit areas (an enemy-held one for an attack). */
  const move = async (p, attackFirst, skip, trace) => {
    for (const attack of attackFirst ? [true, false] : [false, true])
      for (let t = 0; t < 6; t++) {
        const m = await p.page.evaluate(
          ([attack, skip]) => {
            const F = window.__fab,
              E = F.E,
              g = F.game(),
              me = F.online.mySide(),
              can = g.units.filter((u) => u.side === me && u.area != null && !u.moved && !u.garrison && E.moveOptions(g, u.id).length); // the chip's own list
            for (const [i, u] of can.entries()) {
              const to = E.moveOptions(g, u.id)
                .map((o) => o.area)
                .filter((a) => g.units.some((x) => x.area === a && x.side !== me) === attack);
              if (to.length && !skip.includes(u.id)) return { i, id: u.id, name: u.name, from: u.area, to };
            }
            return null;
          },
          [attack, skip],
        );
        if (!m) break;
        skip.push(m.id);
        await p.page.keyboard.press('Escape'); // nothing selected: the chip starts from the first block
        for (let i = 0; i < 60; i++) {
          if (!(await click(p, p.page.locator('.dchip', { hasText: 'Can move' })))) break;
          await sleep(100);
          if (await p.page.evaluate((n) => document.querySelector('.c-dispatch h3')?.textContent === n, m.name)) break; // the chip goes through my blocks: until the card names this one (its h3: a warning box can come before the name)
        }
        /* the chip selects it; a tap on the block itself brings it and its lit areas into view (a tap on a stack picks the next block: until the card names this one) */
        let named = false;
        for (let k = 0; k < 4; k++) {
          const q = await p.page.evaluate((id) => window.__fab.unitAt(id), m.id);
          if (q && (await p.page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', [q.x, q.y])))
            await p.page.mouse.click(q.x, q.y);
          await sleep(500);
          if ((named = await p.page.evaluate((n) => document.querySelector('.c-dispatch h3')?.textContent === n, m.name))) break;
        }
        /* the camera may still be gliding while the tap is made and the tap then lands on a neighbour: any move of this block counts, the next area is tried otherwise.
         * A move across a bridge only asks the other side whether it blows it: the block stands where it was until that is answered (the turn's loop does it), and the question counts as the move. */
        const moved = () =>
          until(
            () =>
              p.page.evaluate(
                ([i, f]) => {
                  const g = window.__fab.game();
                  return g.units.find((u) => u.id === i)?.area !== f || g.pendingBlow?.unit === i;
                },
                [m.id, m.from],
              ),
            3000,
            150,
          );
        for (const a of m.to.slice(0, 4))
          if ((await mapTap(p, a)) && (await moved()))
            return {
              attack: await p.page.evaluate((i) => {
                const g = window.__fab.game(),
                  u = g.units.find((x) => x.id === i),
                  to = g.pendingBlow?.unit === i ? g.pendingBlow.path.at(-1) : u.area;
                return g.units.some((x) => x.area === to && x.side !== u.side);
              }, m.id),
            }; // an attack when the area it stands in (or crosses into) holds the enemy // prettier-ignore
        trace.push(`${m.name} ${attack ? 'attack' : 'move'} to ${m.to.slice(0, 4)}${named ? '' : ' (card never named it)'}: ${(await p.page.evaluate(() => document.querySelector('#ui')?.innerText.replace(/\s+/g, ' ').slice(0, 250))) ?? ''}`); // prettier-ignore
      }
    return null;
  };
  /** The bar's button (the first one, when a choice shows several), pressed as a player does: not in the 0.6 s after it changed its words. */
  const press = async (p, label) => {
    await sleep(650);
    return (await click(p, p.page.locator('.c-bar.b .bacts button.go:not([disabled])'))) ? label : null;
  };

  let key = '',
    name = '',
    idle = 0,
    same = 0,
    last = '',
    pressed = 0,
    battles = 0,
    inBattle = false,
    mv = null,
    arr = null;
  const shortcuts = [],
    v0 = await see(A.page),
    turn0 = v0.turn;
  for (let n = 0; n < 900; n++) {
    const [a, b] = [await see(A.page), await see(B.page)],
      seat = (s) => (a.me === s ? A : B),
      view = (p) => (p === A ? a : b),
      k = `${a.turn}|${a.phasing}|${a.phase}`;
    if (k !== key) {
      /* a step of the turn is over (or the part begins): the step named on both screens is the same one */
      if (key) check(a.step === b.step, `${name.replace(/ \(step.*/, '')} is over: both screens show "${a.step}"`);
      if (mv) {
        const [who, done, could] = [mv.who, mv.done, mv.could];
        if (could < 2) note(`${who.name} has ${could} block${could === 1 ? '' : 's'} that can move in this step`);
        check(
          done.length >= Math.min(2, could),
          `${who.name} moves ${done.length} block${done.length === 1 ? '' : 's'} with taps on the map${done.some((x) => x.attack) ? ', one into an area the enemy holds' : ''}; each arrives on the other screen${done.length < Math.min(2, could) ? ` (tried: ${mv.trace.join('; ')})` : ''}`,
        );
        if (done.length && !done.some((x) => x.attack)) note(`${who.name} found no enemy-held area to move into in this step`);
      }
      if (arr)
        for (const [who, x] of arr)
          check(x.placed > 0, `${who.name} places ${x.placed} of its ${x.tried.length} new blocks from the tray onto the map`);
      if (key && !key.startsWith(`${a.turn}|`))
        check(a.turn === b.turn && a.step.startsWith(`Turn ${a.turn},`), `the turn number goes up on both screens (turn ${a.turn})`);
      if (a.phase === 'supply') check(a.cut === b.cut, `supply: both screens mark the same blocks out of supply (${a.cut ? a.cut.split(' ').length : 'none'})`); // prettier-ignore
      [key, name, mv, arr] = [k, a.step, null, null];
    }
    if (a.over || b.over) {
      note(`the game ended during the turn: ${a.over ?? b.over}`);
      break;
    }
    if (a.turn > turn0 && ORDER.indexOf(a.phase) >= ORDER.indexOf(STOP[game])) break;
    if (Date.now() - t0 > MINUTES * 60000) return check(false, `the turn is played within ${MINUTES} minutes (it stopped at "${a.step}")`);

    if (!!a.stage !== inBattle && (inBattle = !!a.stage)) battles++;
    const quickly = inBattle && battles > HAND;
    /* dice read on a screen: their Continue first, whoever acts next */
    const reading = [A, B].find((p) => /^Continue/.test(view(p).go[0] ?? ''));
    let who = reading ?? null,
      did = reading ? await press(reading, 'Continue') : null;
    if (!did && quickly && !(a.stage === 'setup' && a.pointDone)) {
      who = seat(a.actor === 'both' ? a.phasing : a.actor);
      const r = await play(who.page, battleStep);
      if (String(r).startsWith('!')) return check(false, `battle ${battles} of the turn, ${a.stage}: ${who.name} ${r}`);
      did = `shortcut: ${r}`;
    }
    for (const p of did || quickly ? [] : a.actor === 'both' ? [seat(a.phasing), seat(a.phasing) === A ? B : A] : [seat(a.actor)]) {
      const v = view(p),
        go = v.go.find((x) => !/tap to undo|^(Choose|Remove|Spend|Lay |Mark |Shuffle|Historical|Place the)/.test(x)),
        quick = v.phase === 'deploy' && v.panel.find((x) => /^(Shuffle all|Lay the rest for me|Place the rest for me)/.test(x)); // the set-up's own quick buttons (Golan)
      who = p;
      if (v.drop.length) {
        const [id, to] = v.drop.find(([, t]) => !t.length) ?? v.drop[0]; // (the bar carries the panel's decisive button)
        if (!to.length) did = (await click(p, p.page.locator('#ui button:not([disabled])', { hasText: /^Remove .*no drop zone/ }))) && 'no drop zone';
        else if (await click(p, p.page.locator('#ui button:not([disabled])', { hasText: 'Choose the drop zone' })))
          for (const a of to) if (!did && (await mapTap(p, a)) && (await until(() => p.page.evaluate((i) => window.__fab.game().units.find((u) => u.id === i)?.box !== 'airborne_assault', id), 3000, 150))) did = 'drop zone'; // prettier-ignore
        if (!did) await p.page.keyboard.press('Escape');
      } else if (quick) did = (await click(p, p.page.locator('#ui button:not([disabled])', { hasText: quick }))) && quick;
      else if (v.blow) did = (await click(p, p.page.locator('.c-ledger button', { hasText: 'Let them cross' }))) && 'bridge';
      else if (
        v.phase === 'reinforcement' &&
        (arr?.get(p)?.tried.length ?? 0) < Math.min(3, v.arrivals.length + (arr?.get(p)?.tried.length ?? 0) - 1) &&
        v.arrivals.some((id) => !(arr?.get(p)?.tried ?? []).includes(id))
      ) {
        // up to three blocks by hand, never the last one: what is left in the tray is placed by the other seat's End reinforcement (the step's own rule)
        const x = (arr ??= new Map()).get(p) ?? arr.set(p, { tried: [], placed: 0 }).get(p),
          id = v.arrivals.find((i) => !x.tried.includes(i));
        x.tried.push(id);
        if (await arrive(p, id)) x.placed++;
        did = `new block ${id}`;
      } else if (
        v.phase === 'movement' &&
        !v.stage &&
        v.actor === v.me &&
        (mv ??= { who: p, done: [], skip: [], trace: [], could: v.movers }).done.length < 2 &&
        !mv.over
      ) {
        const m = await move(p, !mv.done.some((x) => x.attack), mv.skip, mv.trace);
        if (m) mv.done.push(m);
        else mv.over = true; // no block left that the taps can move
        did = 'move';
      } else if (go) did = await press(p, go);
      else if (v.rows) did = (await click(p, p.page.locator('button.lossrow:not(.on):not([disabled])'))) && 'row';
      else if (v.retreat.length && v.actor === v.me) for (const r of v.retreat) if (!did && (await mapTap(p, r))) did = 'retreat area';
      if (did) break;
    }
    if (!did) {
      /* nothing to press yet: dice still rolling, blocks being shown; after 20 seconds, a battle step goes on by the shortcut the battle part uses */
      await sleep(500);
      if (process.env.VERBOSE && idle % 8 === 0) console.log(`       ${Math.round((Date.now() - t0) / 1000)}s waiting (${a.stage ?? a.phase}, to act ${a.actor}) ${A.name}: "${a.prompt}" [${a.go}] | ${B.name}: "${b.prompt}" [${b.go}]`); // prettier-ignore
      if (++idle < 40) continue;
      const p = seat(a.actor === 'both' ? a.phasing : a.actor),
        r = a.stage ? await play(p.page, battleStep) : '!no battle';
      if (String(r).startsWith('!'))
        return check(false, `the turn goes on at "${a.step}"${a.stage ? `, battle step ${a.stage}` : ''}: nothing to press (${A.name}: "${a.prompt}" [${a.go}] [${a.panel}] | ${B.name}: "${b.prompt}" [${b.go}] [${b.panel}])`); // prettier-ignore
      shortcuts.push(a.stage);
      did = `shortcut ${r}`;
    } else if (a.stage && did !== 'Continue' && !quickly) pressed++;
    idle = 0;
    if (did !== 'Continue' && (a.stage?.endsWith('Choice') || a.stage === 'attFirst')) seen('choice');
    if (did !== 'Continue' && a.stage === 'retreat') seen('retreat');
    const what = `${a.step.replace(/ \(step.*/, '')}${a.stage ? `, battle step ${a.stage}` : ''}: ${who.name} "${did}"`;
    same = what === last ? same + 1 : 0;
    last = what;
    if (same > 12) return check(false, `the turn goes on after ${what} (pressed ${same} times, nothing changed)`);
    if (process.env.VERBOSE) console.log(`       ${Math.round((Date.now() - t0) / 1000)}s ${what}`);
    if (!(await settle(what))) return false;
    if (process.env.VERBOSE) console.log(`       ${Math.round((Date.now() - t0) / 1000)}s settled`);
  }
  if (tapsSent) note(`${tapsSent} map taps were sent to a spot that was off the screen or under a panel, as the same tap`);
  note(
    `battles of the turn: ${pressed} steps played with the screen's own buttons${shortcuts.length ? `, ${shortcuts.length} by the shortcut (${[...new Set(shortcuts)].join(', ')}: nothing to press was found)` : ''}; who wins and who is cut off depend on the dice`,
  );
  return true;
}
