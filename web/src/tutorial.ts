/** The interactive tutorial (?tutorial=<course>): a coach card, a spotlight on the one thing to do, and a lock on everything else.
 *  The courses themselves are in tutorial-script.ts (one per volume, plus "what's new" courses); main.ts gives this module a small
 *  host API and asks `gate` before a map tap. */
import type * as E from '../../engine/src';
import { tr, trHtml, translateDom, enSel } from './i18n';
import { U, replay, type Course, type Step, type Target } from './tutorial-script';
import { linkRules } from './rules-link';

export interface TutHost {
  game(): E.Game;
  load(g: E.Game): void;
  act(f: () => void, label: string): void;
  unitScreen(id: string): { x: number; y: number; rad: number } | null;
  areaScreen(a: number): { x: number; y: number } | null;
  lookAt(a: number): void;
  pan(dx: number, dy: number): void;
  /** the finger is on the map */ moving(): boolean;
  fold(): void;
  select(id: string): void;
  toast(t: string): void;
  busy(): boolean;
  guide(): 'full' | 'short';
  setGuide(v: 'full' | 'short'): void;
  /** Look at the table from this side's edge (the side the lesson's player plays). */
  view(side: string): void;
  /** Leave the tutorial: back to the home page, opening a new game of the course's volume when `to` is given. */
  home(to?: { game: string; scenario: string }): void;
}
const GKEY = 'fab-tut-guide';
let entered = 0;
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
const q = (s: string, text?: string) =>
  Array.from(document.querySelectorAll(enSel(s))).some(
    (e) => !text || (e.textContent ?? '').includes(text) || (e.textContent ?? '').includes(tr(text)),
  ); // the screen may be in Italian (4.6)
const visible = (e: Element) => {
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const SIDE_NAME: Record<string, string> = {
  german: 'the Germans',
  allied: 'the Allies',
  israeli: 'Israel',
  syrian: 'Syria',
  axis: 'the Axis',
};

export function initTutorial(h: TutHost, course: Course) {
  const KEY = `fab-tut:${course.id}`,
    DKEY = `${KEY}:done`,
    LESSONS = course.lessons;
  let li = Math.max(0, Math.min(LESSONS.length - 1, Number(store.get(KEY) ?? 0) || 0)),
    si = 0,
    tapped = false,
    last = 0,
    menu = false;
  const done = new Set((store.get(DKEY) ?? '').split(',').filter(Boolean));
  if (store.get(GKEY) == null) store.set(GKEY, h.guide());
  h.setGuide('full');
  const coach = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-coach', role: 'dialog' }));
  const ring = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-ring' }));
  const dim = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-dim' }));
  coach.setAttribute('aria-live', 'polite');
  coach.setAttribute('aria-label', `Tutorial: ${course.title}`);
  const step = (): Step | undefined => LESSONS[li]?.steps[si];

  /** The element a DOM target points at: the first selector that finds a visible element (with the text, when given). */
  function targetEl(t: Target | undefined): HTMLElement | null {
    if (!t || !('el' in t)) return null;
    for (const sel of Array.isArray(t.el) ? t.el : [t.el]) {
      const hit = Array.from(document.querySelectorAll<HTMLElement>(enSel(`#ui ${sel}`))).find(
        (e) =>
          visible(e) &&
          (!t.text ||
            ((x) => x.includes(t.text!) || x.includes(tr(t.text!)))(`${e.textContent} ${e.title} ${e.getAttribute('aria-label') ?? ''}`)),
      );
      if (hit) return hit;
    }
    return null;
  }
  const label = (t: Target | undefined) =>
    !t ? '' : 'el' in t ? t.label : 'unit' in t ? (t.label ?? `${t.unit} block`) : (t.label ?? 'area');
  const tapWord = matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click',
    hint = (s: Step) => (s.target ? `${tapWord} the glowing ${label(s.target)}` : `${tapWord} Next to go on`);

  function start(l: number, upTo = 0) {
    const fresh = l !== li || upTo === 0;
    li = l;
    si = upTo;
    menu = false;
    store.set(KEY, String(l));
    h.load(upTo ? replay(course, l, upTo) : LESSONS[l].setup());
    if (fresh && LESSONS[l].side) h.view(LESSONS[l].side!);
    enter();
  }
  function enter(): void {
    const L = LESSONS[li],
      s = step();
    if (!L || !s) return;
    const g = h.game();
    tapped = false;
    entered = performance.now();
    if (s.skip?.(g)) {
      si++;
      return si < L.steps.length ? enter() : next();
    }
    s.enter?.(g);
    const t = s.target,
      prev = L.steps[si - 1]?.target;
    if (t && !('el' in t)) h.fold(); // the chit panel folds its rules so the map shows
    if (t && 'area' in t && (s.mover || (prev && 'unit' in prev))) {
      try {
        h.select(U(g, s.mover ?? (prev as { unit: string }).unit).id);
      } catch {
        /* */
      }
    } // a move: the block stays selected after Back
    const at = s.look ?? (t && 'unit' in t ? U(g, t.unit).area : t && 'area' in t ? t.area : null);
    if (at != null) {
      const p = t && 'unit' in t ? h.unitScreen(U(g, t.unit).id) : h.areaScreen(at);
      if (s.look != null || !p || p.x < 20 || p.x > innerWidth - 20 || p.y < 120 || p.y > innerHeight - 140) h.lookAt(at);
    }
    draw();
  }
  function next(): void {
    const L = LESSONS[li];
    if (si + 1 < L.steps.length) {
      si++;
      return enter();
    }
    done.add(L.id);
    store.set(DKEY, Array.from(done).join(','));
    if (li + 1 < LESSONS.length) return start(li + 1);
    finish();
  }
  function onNext() {
    const s = step();
    if (!s || h.busy()) return;
    if (s.auto) h.act(() => s.auto!(h.game()), s.title);
    next();
  }
  /** "Do it for me" on a try step: the coach plays the player's action. */
  function skipTry() {
    const s = step();
    if (!s || h.busy()) return;
    if (s.act) h.act(() => s.act!(h.game()), s.title);
    next();
  }
  function back() {
    if (h.busy()) return;
    let l = li,
      k = si - 1;
    while (k >= 0 && LESSONS[l].steps[k].skip?.(replay(course, l, k))) k--;
    if (k < 0) {
      if (l === 0) return;
      l--;
      k = 0;
    }
    start(l, k);
  }
  function finish(to?: { game: string; scenario: string }, exit = false) {
    store.set(KEY, exit ? String(li) : null);
    const g0 = store.get(GKEY);
    if (g0 === 'short' || g0 === 'full') h.setGuide(g0);
    store.set(GKEY, null);
    h.home(to);
  }

  /* ---------- the card ---------- */
  const btn = (t: string, text: string, cls = '', title = '') =>
    `<button data-t="${t}" class="${cls}" ${title ? `title="${esc(title)}"` : ''}>${text}</button>`;
  function menuHtml() {
    const chapters = Array.from(new Set(LESSONS.map((l) => l.chapter)));
    const rows = chapters
      .map(
        (ch) =>
          `<h5>${esc(ch)}</h5><ol>${LESSONS.map((l, i) => (l.chapter !== ch ? '' : `<li class="${i === li ? 'now' : done.has(l.id) ? 'done' : ''}"><button data-l="${i}"><span class="n">${done.has(l.id) ? '✓' : i + 1}</span><b>${esc(l.topic)}</b><small>${esc(l.goal)} · ${l.minutes} min</small></button></li>`)).join('')}</ol>`,
      )
      .join('');
    const total = LESSONS.reduce((a, l) => a + l.minutes, 0);
    return `<div class="k"><span>${esc(course.title)}</span><i>${done.size} / ${LESSONS.length} done · ${total} min</i></div><div class="tut-body tut-menu">${rows}</div><div class="row">${btn('exit', 'Exit')}<span class="grow"></span>${btn('resume', 'Back to the lesson →', 'tut-go')}</div>`;
  }
  function stepHtml(L: (typeof LESSONS)[number], s: Step) {
    const g = h.game(),
      lastStep = si === L.steps.length - 1,
      end = lastStep && li === LESSONS.length - 1,
      wait = !!s.target && !s.auto && (!!s.done || !!s.tap);
    const kind = s.kind ?? 'step',
      figure = (() => {
        try {
          return s.figure?.(g) ?? '';
        } catch (e) {
          console.error(e);
          return '';
        }
      })();
    const meta =
      kind === 'situation'
        ? `<div class="tut-meta">${L.side ? `<span>You play <b>${esc(SIDE_NAME[L.side] ?? L.side)}</b></span>` : ''}<span>${L.minutes} min</span>${L.ref ? `<span>Play Book ${esc(L.ref)}</span>` : ''}</div>`
        : '';
    const why = s.why
      ? `<details class="tut-why"><summary>${kind === 'try' ? 'Hint' : esc(s.rule ?? 'Why?')}</summary><p>${trHtml(s.why)}</p></details>`
      : s.rule
        ? `<small class="tut-rule">${esc(s.rule)}</small>`
        : '';
    const goLabel =
      kind === 'situation'
        ? 'Start →'
        : s.auto
          ? 'Show me →'
          : lastStep
            ? li + 1 < LESSONS.length
              ? 'Next lesson →'
              : 'Finish →'
            : 'Next →';
    const buttons = end
      ? `<div class="tut-end">${course.end.map((e, i) => btn(`end:${i}`, esc(e.label), e.primary ? 'tut-go' : '')).join('')}${btn('home', 'Back home')}</div>`
      : `<div class="row">${btn('menu', 'Lessons', '', 'All the lessons')}${li || si ? btn('back', 'Back') : ''}<span class="grow"></span>${wait ? `<span class="tut-hint">${hint(s)}</span>${kind === 'try' && s.act ? btn('skip', 'Do it for me') : ''}` : btn('next', goLabel, 'tut-go')}</div>`;
    const stepsLeft = L.steps.length - si - 1;
    return `<div class="bar" title="${stepsLeft} steps to go"><i style="width:${Math.round(((si + 1) / L.steps.length) * 100)}%"></i></div>
      <div class="k"><span>${esc(L.chapter)} · Lesson ${li + 1} of ${LESSONS.length}</span>${L.topic.toLowerCase() === s.title.toLowerCase() ? '' : `<i>${esc(L.topic)}</i>`}</div>
      <div class="tut-body ${kind}"><h4>${trHtml(s.title)}</h4>${meta}${figure}<div class="tut-text">${trHtml(s.text)}</div>${why}</div>${buttons}`;
  }
  function draw() {
    const L = LESSONS[li],
      s = step();
    if (!L || !s) return;
    coach.className = `tut-coach ${menu ? 'is-menu' : `is-${s.kind ?? 'step'}`}${!menu && s.target ? ' has-target' : ''}`;
    coach.innerHTML = menu ? menuHtml() : stepHtml(L, s);
    translateDom(coach);
    linkRules(coach);
    coach.querySelectorAll('.tut-rule, .tut-why summary').forEach((e) => linkRules(e, true)); // rule numbers open the rules reference
    coach.querySelectorAll<HTMLElement>('[data-t]').forEach(
      (b) =>
        (b.onclick = () => {
          const t = b.dataset.t!;
          if (t === 'next') onNext();
          else if (t === 'skip') skipTry();
          else if (t === 'back') back();
          else if (t === 'exit') finish(undefined, true);
          else if (t === 'menu') {
            menu = true;
            draw();
          } else if (t === 'resume') {
            menu = false;
            draw();
          } else if (t === 'home') finish();
          else if (t.startsWith('end:')) {
            const e = course.end[Number(t.slice(4))];
            finish({ game: course.game, scenario: e.scenario });
          }
        }),
    );
    coach.querySelectorAll<HTMLElement>('[data-l]').forEach(
      (b) =>
        (b.onclick = () => {
          if (!h.busy()) start(Number(b.dataset.l));
        }),
    );
    place();
  }

  /** The spotlight follows its target every frame (the camera moves); the coach sits next to it, never over it. */
  function place() {
    const s = step();
    if (!s) return;
    const g = h.game(),
      t = menu ? undefined : s.target;
    let r: { x: number; y: number; w: number; h: number } | null = null;
    if (t && 'unit' in t) {
      const p = h.unitScreen(U(g, t.unit).id);
      if (p) r = { x: p.x - p.rad - 8, y: p.y - p.rad - 8, w: 2 * p.rad + 16, h: 2 * p.rad + 16 };
    } else if (t && 'area' in t) {
      const p = h.areaScreen(t.area);
      if (p) r = { x: p.x - 40, y: p.y - 40, w: 80, h: 80 };
    } else {
      const e = targetEl(t);
      if (e) {
        let b = e.getBoundingClientRect();
        const hidden = () => {
          const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return !top || !(top === e || e.contains(top) || top.closest('.tut-coach, .tut-spot'));
        }; // off screen, or clipped inside a scrolled panel
        if (b.right > innerWidth || b.left < 0 || b.bottom > innerHeight || hidden()) {
          e.scrollIntoView({ block: 'nearest', inline: 'center' });
          b = e.getBoundingClientRect();
        }
        r = { x: b.left - 4, y: b.top - 4, w: b.width + 8, h: b.height + 8 };
      }
    }
    const busy = h.busy();
    ring.style.display = r && !busy ? 'block' : 'none';
    dim.style.display = !r && !busy && !t ? 'block' : 'none';
    if (r)
      Object.assign(ring.style, {
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.w}px`,
        height: `${r.h}px`,
        borderRadius: t && !('el' in t) ? '50%' : '10px',
      });
    const W = innerWidth,
      H = innerHeight,
      top =
        Math.max(
          document.querySelector('#ui .tops')?.getBoundingClientRect().bottom ?? 80,
          document.querySelector('#ui .mapdock .dockrow')?.getBoundingClientRect().bottom ?? 0,
        ) + 8,
      /* below the bars and the map's layer bar */ bot = (document.querySelector('#ui .c-bar.b')?.getBoundingClientRect().top ?? H) - 8;
    coach.style.visibility = busy ? 'hidden' : 'visible';
    coach.style.maxHeight = `${Math.max(200, bot - top)}px`;
    const cw = coach.offsetWidth,
      ch = coach.offsetHeight;
    let x: number, y: number;
    if (W < 700) {
      // phones: under the top bar, or above the bottom bar when the target is up there
      x = 10;
      y = top;
      if (t && !('el' in t))
        y = Math.max(top, bot - ch); // a block or area: the coach sits low, the map slides into the clear band above it (keep())
      else if (r && r.y < y + ch + 6 && r.y + r.h > y) y = Math.max(top, bot - ch); // a button up there: the coach goes down
    } else if (!r && document.querySelector('#ui .modal')) {
      x = W - cw - 10;
      y = bot - ch;
    } // a sheet is open: the coach keeps to the corner so the sheet can be read
    else if (!r) {
      x = (W - cw) / 2;
      y = top + 8;
    } else {
      const cands: [number, number][] = [
        [r.x + r.w + 18, r.y + r.h / 2 - ch / 2],
        [r.x - cw - 18, r.y + r.h / 2 - ch / 2],
        [r.x + r.w / 2 - cw / 2, r.y + r.h + 18],
        [r.x + r.w / 2 - cw / 2, r.y - ch - 18],
        [W - cw - 10, top],
        [10, top],
        [(W - cw) / 2, top],
      ];
      const avoid = [
        { left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h },
        ...Array.from(document.querySelectorAll('#ui .c-ledger'))
          .filter(visible)
          .map((e) => e.getBoundingClientRect()),
      ]; // the target and the fire report stay readable
      const clear = ([cx, cy]: [number, number]) =>
        avoid.every((b) => cx + cw < b.left || cx > b.right || cy + ch < b.top || cy > b.bottom);
      const all = cands.map(
        ([cx, cy]) => [Math.min(W - cw - 10, Math.max(10, cx)), Math.min(bot - ch, Math.max(top, cy))] as [number, number],
      );
      const fit = all.find(clear) ?? all.find(([cx, cy]) => cx + cw < r!.x || cx > r!.x + r!.w || cy + ch < r!.y || cy > r!.y + r!.h);
      [x, y] = fit ?? [10, top];
    }
    coach.style.left = `${x}px`;
    coach.style.top = `${y}px`;
    coach.style.right = W < 700 ? '10px' : '';
  }

  /* The lock: only the target (and the coach, and the dice report) take input. Pan and zoom stay free. */
  const free = (el: Element) =>
    !!el.closest('.tut-coach') ||
    !el.closest('#ui') ||
    !!el.closest('.c-ledger.tight') ||
    !!el.closest('a.rlink') ||
    (h.busy() && !!el.closest('.go')); /* a dice result waits for the player's Continue */
  function guard(ev: Event) {
    const s = step(),
      el = ev.target as Element | null;
    if (!s || !el?.closest || free(el)) return;
    const te = menu ? null : targetEl(s.target);
    if (te && te.contains(el) && (s.done || s.tap)) {
      if (ev.type === 'click' && s.tap) {
        tapped = true;
        setTimeout(() => {
          if (step() === s) next();
        }, 60);
      }
      return;
    }
    ev.stopPropagation();
    ev.preventDefault();
    if (ev.type === 'click') h.toast(menu ? 'Close the lesson list first.' : `${hint(s)}.`);
  }
  for (const ty of ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'])
    window.addEventListener(ty, guard, { capture: true, passive: false });

  /** A block or area hidden behind the coach or a panel slides into the clear band of the screen. */
  function keep(s: Step) {
    const t = s.target,
      g = h.game();
    if (!t || 'el' in t || menu || h.busy() || h.moving() || performance.now() - entered < 1300) return; // after the camera's glide to it
    const p = 'unit' in t ? h.unitScreen(U(g, t.unit).id) : h.areaScreen(t.area);
    if (!p) return;
    const W = innerWidth,
      H = innerHeight,
      top = document.querySelector('#ui .tops')?.getBoundingClientRect().bottom ?? 0;
    const obs = [
      coach,
      ...Array.from(
        document.querySelectorAll<HTMLElement>('#ui .c-dispatch, #ui .c-hand, #ui .c-ledger, #ui .c-bar.b, #ui .arrtray, #ui .modal'),
      ),
    ]
      .filter(visible)
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.left < p.x + 30 && b.right > p.x - 30)
      .sort((a, b) => a.top - b.top);
    let y0 = top,
      best = { a: 0, b: 0 };
    for (const b of [...obs, { top: H, bottom: H } as DOMRect]) {
      if (b.top - y0 > best.b - best.a) best = { a: y0, b: b.top };
      y0 = Math.max(y0, b.bottom);
    }
    if (best.b - best.a < 70) return;
    const m = Math.min(45, (best.b - best.a) / 3),
      dy = p.y < best.a + m || p.y > best.b - m ? (best.a + best.b) / 2 - p.y : 0;
    const hit = document.elementFromPoint(p.x, p.y),
      covered = !!hit && hit.tagName !== 'CANVAS'; // under a panel or a legend: towards the middle
    const dx = p.x < 30 || p.x > W - 30 || (covered && !dy) ? W / 2 - p.x : 0;
    if (Math.abs(dx) + Math.abs(dy) > 2) h.pan(dx * 0.25, dy * 0.25);
  }
  function loop(now: number) {
    requestAnimationFrame(loop);
    const s = step();
    if (!s) return;
    keep(s);
    place();
    if (menu || now - last < 200 || h.busy() || tapped) return;
    last = now;
    if (s.done && s.done(h.game(), q)) next();
  }
  start(li);
  requestAnimationFrame(loop);

  return {
    /** Dev and checks: jump to a step of a lesson; what the coach points at now, and whether it is on screen. */
    jump(l: number, upTo = 0) {
      if (l >= 0 && l < LESSONS.length && upTo >= 0 && upTo < LESSONS[l].steps.length) start(l, upTo);
    },
    /** Dev and checks: play the current step the way the player would in engine terms (the coach's part, or the player's act) and go on. */
    advance() {
      const s = step();
      if (!s || h.busy()) return;
      if (s.auto) return onNext();
      if (s.act) {
        h.act(() => s.act!(h.game()), s.title);
        if (!s.done) next();
        return;
      }
      next(); /* a map tap the next step plays */
    },
    targetEl() {
      return targetEl(step()?.target);
    },
    where() {
      const s = step();
      const t = s?.target;
      return {
        lesson: li,
        step: si,
        title: s?.title,
        target: t ? label(t) : null,
        found: !t || !('el' in t) || !!targetEl(t),
        tap: !t || 'el' in t ? null : 'unit' in t ? h.unitScreen(U(h.game(), t.unit).id) : h.areaScreen(t.area),
        skipped: !!s?.skip?.(h.game()),
      };
    },
    /** A tap on the map: false = blocked; otherwise the block and area to use (a tap on a stack or on a block standing in the area counts). */
    gate(unit: string | undefined, area: number | null): { unit?: string; area?: number } | false {
      const s = step();
      if (!s) return {};
      if (menu) {
        h.toast('Close the lesson list first.');
        return false;
      }
      const t = s.target,
        g = h.game(),
        on = unit ? (g.units.find((u) => u.id === unit)?.area ?? null) : null;
      const ok =
        t && 'unit' in t
          ? (() => {
              const u = U(g, t.unit);
              return unit === u.id || (u.area != null && (area === u.area || on === u.area))
                ? { unit: u.id, area: u.area ?? undefined }
                : null;
            })()
          : t && 'area' in t && (area === t.area || on === t.area)
            ? { area: t.area }
            : null;
      if (!ok) {
        h.toast(`${hint(s)}.`);
        return false;
      }
      if (s.tap) {
        tapped = true;
        setTimeout(() => {
          if (step() === s) next();
        }, 60);
      }
      return ok;
    },
  };
}
