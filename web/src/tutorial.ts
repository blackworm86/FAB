/** The interactive tutorial (?tutorial=1): a coach bubble, a spotlight on the one thing to do, and a lock on everything else.
 *  The lessons themselves are in tutorial-script.ts; main.ts gives this module a small host API and asks `gate` before a map tap. */
import type * as E from '../../engine/src';
import { LESSONS, U, replay, type Step, type Target } from './tutorial-script';

export interface TutHost {
  game(): E.Game; load(g: E.Game): void; act(f: () => void, label: string): void;
  unitScreen(id: string): { x: number; y: number; rad: number } | null; areaScreen(a: number): { x: number; y: number } | null;
  lookAt(a: number): void; select(id: string): void; toast(t: string): void; busy(): boolean;
  guide(): 'full' | 'short'; setGuide(v: 'full' | 'short'): void; home(scenario?: string): void;
}
const KEY = 'fab-tut', GKEY = 'fab-tut-guide';
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } } };
const q = (s: string, text?: string) => Array.from(document.querySelectorAll(s)).some((e) => !text || (e.textContent ?? '').includes(text));
const visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };

export function initTutorial(h: TutHost) {
  let li = Math.max(0, Math.min(LESSONS.length - 1, Number(store.get(KEY) ?? 0) || 0)), si = 0, tapped = false, last = 0;
  if (store.get(GKEY) == null) store.set(GKEY, h.guide()); h.setGuide('full');
  const coach = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-coach', role: 'dialog' }));
  const ring = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-ring' }));
  const dim = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tut-dim' }));
  coach.setAttribute('aria-live', 'polite');
  const step = (): Step | undefined => LESSONS[li]?.steps[si];

  /** The element a DOM target points at: the first selector that finds a visible element (with the text, when given). */
  function targetEl(t: Target | undefined): HTMLElement | null {
    if (!t || !('el' in t)) return null;
    for (const sel of Array.isArray(t.el) ? t.el : [t.el]) {
      const hit = Array.from(document.querySelectorAll<HTMLElement>(`#ui ${sel}`)).find((e) => visible(e) && (!t.text || `${e.textContent} ${e.title} ${e.getAttribute('aria-label') ?? ''}`.includes(t.text)));
      if (hit) return hit;
    }
    return null;
  }
  const label = (t: Target | undefined) => !t ? '' : 'el' in t ? t.label : 'unit' in t ? (t.label ?? `${t.unit} block`) : (t.label ?? 'area');
  const hint = (s: Step) => s.target ? `Tap the glowing ${label(s.target)}` : 'Tap Next to go on';

  function start(l: number, upTo = 0) {
    li = l; si = upTo; store.set(KEY, String(l));
    h.load(upTo ? replay(l, upTo) : LESSONS[l].setup());
    enter();
  }
  function enter(): void {
    const L = LESSONS[li], s = step(); if (!L || !s) return;
    const g = h.game(); tapped = false;
    if (s.skip?.(g)) { si++; return si < L.steps.length ? enter() : next(); }
    s.enter?.(g);
    const t = s.target, prev = L.steps[si - 1]?.target;
    if (t && 'area' in t && prev && 'unit' in prev) { try { h.select(U(g, prev.unit).id); } catch { /* */ } }   // a move: the block stays selected after Back
    const at = s.look ?? (t && 'unit' in t ? U(g, t.unit).area : t && 'area' in t ? t.area : null);
    if (at != null) { const p = t && 'unit' in t ? h.unitScreen(U(g, t.unit).id) : h.areaScreen(at); if (s.look != null || !p || p.x < 20 || p.x > innerWidth - 20 || p.y < 120 || p.y > innerHeight - 140) h.lookAt(at); }
    draw();
  }
  function next(): void {
    const L = LESSONS[li];
    if (si + 1 < L.steps.length) { si++; return enter(); }
    if (li + 1 < LESSONS.length) return start(li + 1);
    finish('');
  }
  function onNext() {
    const s = step(); if (!s || h.busy()) return;
    if (s.auto) h.act(() => s.auto!(h.game()), s.title);
    next();
  }
  function back() {
    if (h.busy()) return;
    let l = li, k = si - 1;
    while (k >= 0 && LESSONS[l].steps[k].skip?.(replay(l, k))) k--;
    if (k < 0) { if (l === 0) return; l--; k = 0; }
    start(l, k);
  }
  function finish(scenario: string) {
    store.set(KEY, scenario === 'exit' ? String(li) : null);
    const g0 = store.get(GKEY); if (g0 === 'short' || g0 === 'full') h.setGuide(g0); store.set(GKEY, null);
    h.home(scenario === 'exit' ? '' : scenario);
  }

  function draw() {
    const L = LESSONS[li], s = step(); if (!L || !s) return;
    const lastStep = si === L.steps.length - 1, end = lastStep && li === LESSONS.length - 1, wait = !!s.target && !s.auto && (!!s.done || !!s.tap);
    const pct = Math.round(((si + 1) / L.steps.length) * 100);
    const buttons = end
      ? `<div class="tut-end"><button data-t="intro" class="tut-go">Start a Nuts! game</button><button data-t="campaign">Start the campaign</button><button data-t="home">Back home</button></div>`
      : `<div class="row"><button data-t="exit">Exit</button>${li || si ? '<button data-t="back">Back</button>' : ''}<span class="grow"></span>${wait ? `<span class="tut-hint">${hint(s)}</span>` : `<button data-t="next" class="tut-go">${s.auto ? 'Show me' : lastStep ? 'Next lesson' : 'Next'} →</button>`}</div>`;
    coach.innerHTML = `<div class="bar"><i style="width:${pct}%"></i></div><div class="k">Lesson ${li} · ${L.topic}${L.ref ? ` (${L.ref})` : ''} <i>${si + 1} / ${L.steps.length}</i></div><h4>${s.title}</h4><p>${s.text}</p>${s.rule ? `<small>${s.rule}</small>` : ''}${buttons}`;
    coach.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => { const t = b.dataset.t!; if (t === 'next') onNext(); else if (t === 'back') back(); else if (t === 'exit') finish('exit'); else finish(t === 'home' ? '' : t); }));
    place();
  }

  /** The spotlight follows its target every frame (the camera moves); the coach sits next to it, never over it. */
  function place() {
    const s = step(); if (!s) return;
    const g = h.game(), t = s.target; let r: { x: number; y: number; w: number; h: number } | null = null;
    if (t && 'unit' in t) { const p = h.unitScreen(U(g, t.unit).id); if (p) r = { x: p.x - p.rad - 8, y: p.y - p.rad - 8, w: 2 * p.rad + 16, h: 2 * p.rad + 16 }; }
    else if (t && 'area' in t) { const p = h.areaScreen(t.area); if (p) r = { x: p.x - 40, y: p.y - 40, w: 80, h: 80 }; }
    else { const e = targetEl(t); if (e) { const b = e.getBoundingClientRect(); r = { x: b.left - 4, y: b.top - 4, w: b.width + 8, h: b.height + 8 }; } }
    const busy = h.busy();
    ring.style.display = r && !busy ? 'block' : 'none'; dim.style.display = !r && !busy && !t ? 'block' : 'none';
    if (r) Object.assign(ring.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: t && !('el' in t) ? '50%' : '10px' });
    const W = innerWidth, H = innerHeight, top = (document.querySelector('#ui .tops')?.getBoundingClientRect().bottom ?? 80) + 8, bot = (document.querySelector('#ui .c-bar.b')?.getBoundingClientRect().top ?? H) - 8;
    coach.style.visibility = busy ? 'hidden' : 'visible';
    const cw = coach.offsetWidth, ch = coach.offsetHeight;
    let x: number, y: number;
    if (W < 700) {                                                                                  // phones: under the top bar, or above the bottom bar when the target is up there
      x = 10; y = top;
      if (r && r.y < y + ch + 6 && r.y + r.h > y) y = Math.max(top, bot - ch);
      if (r && y < r.y + r.h && y + ch > r.y) y = r.y + r.h + 10 + ch < H ? r.y + r.h + 10 : Math.max(8, r.y - ch - 10);
    } else if (!r) { x = (W - cw) / 2; y = top + 8; }
    else {
      const cands: [number, number][] = [[r.x + r.w + 18, r.y + r.h / 2 - ch / 2], [r.x - cw - 18, r.y + r.h / 2 - ch / 2], [r.x + r.w / 2 - cw / 2, r.y + r.h + 18], [r.x + r.w / 2 - cw / 2, r.y - ch - 18]];
      const fit = cands.map(([cx, cy]) => [Math.min(W - cw - 10, Math.max(10, cx)), Math.min(bot - ch, Math.max(top, cy))] as [number, number]).find(([cx, cy]) => cx + cw < r!.x || cx > r!.x + r!.w || cy + ch < r!.y || cy > r!.y + r!.h);
      [x, y] = fit ?? [10, top];
    }
    coach.style.left = `${x}px`; coach.style.top = `${y}px`; coach.style.right = W < 700 ? '10px' : '';
  }

  /* The lock: only the target (and the coach, and the dice report) take input. Pan and zoom stay free. */
  const free = (el: Element) => !!el.closest('.tut-coach') || !el.closest('#ui') || !!el.closest('.c-ledger.tight');
  function guard(ev: Event) {
    const s = step(), el = ev.target as Element | null; if (!s || !el?.closest || free(el)) return;
    const te = targetEl(s.target);
    if (te && te.contains(el) && (s.done || s.tap)) { if (ev.type === 'click' && s.tap) { tapped = true; setTimeout(() => { if (step() === s) next(); }, 60); } return; }
    ev.stopPropagation(); ev.preventDefault();
    if (ev.type === 'click') h.toast(`${hint(s)}.`);
  }
  for (const ty of ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick']) window.addEventListener(ty, guard, { capture: true, passive: false });

  function loop(now: number) {
    requestAnimationFrame(loop);
    const s = step(); if (!s) return;
    place();
    if (now - last < 200 || h.busy() || tapped) return; last = now;
    if (s.done && s.done(h.game(), q)) next();
  }
  start(li);
  requestAnimationFrame(loop);

  return {
    /** A tap on the map: false = blocked; otherwise the block and area to use (a tap on a stack or on a block standing in the area counts). */
    gate(unit: string | undefined, area: number | null): { unit?: string; area?: number } | false {
      const s = step(); if (!s) return {};
      const t = s.target, g = h.game(), on = unit ? g.units.find((u) => u.id === unit)?.area ?? null : null;
      const ok = t && 'unit' in t ? (() => { const u = U(g, t.unit); return unit === u.id || (u.area != null && (area === u.area || on === u.area)) ? { unit: u.id, area: u.area ?? undefined } : null; })()
        : t && 'area' in t && (area === t.area || on === t.area) ? { area: t.area } : null;
      if (!ok) { console.log("tut-gate", unit, area, on, JSON.stringify(t)); h.toast(`${hint(s)}.`); return false; }
      if (s.tap) { tapped = true; setTimeout(() => { if (step() === s) next(); }, 60); }
      return ok;
    },
  };
}
