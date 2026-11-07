/** 4.1 The replay viewer (approved mockup: claude.ai/artifact/2KDzZoJBJevdihtRmYqwtK): a finished game step by step on the flat board,
 *  with the move arrow, the battle ring and its dice, a timeline of turns with the VP balance and the battles, and the move list.
 *  It is an overlay of its own: the table underneath does not change. */
import type { JPub, JUnits, RStep } from './journal';
import { translateDom } from './i18n';

export interface ReplayCtx {
  title: string; result: string; steps: RStep[]; sides: [string, string]; sideName: Record<string, string>; tag: Record<string, string>;
  board: string; size: [number, number]; label: (area: number) => [number, number] | null; areaName: (area: number) => string;
  /** A block's face at a strength (null: unknown block), its side, and its wood colour for the face-down view. */
  face: (id: string, str: number) => { svg: string; side: string; name: string } | null; wood: Record<string, string>;
  phaseName: (ph: string) => string; close: () => void; areaIds: number[];
}
const NS = 'http://www.w3.org/2000/svg';
const el = (tag: string, at: Record<string, string | number> = {}, kids: Node[] = []) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, String(v)); e.append(...kids); return e; };
const h = (tag: string, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const ICON: Record<string, string> = { pt: 'M6 5v14M18 6l-8 6 8 6', p: 'M15 6l-6 6 6 6', n: 'M9 6l6 6-6 6', nt: 'M18 5v14M6 6l8 6-8 6', play: 'M7 5l12 7-12 7z', pause: 'M7 5h4v14H7zM13 5h4v14h-4z' };
const svgIcon = (k: string, fill = false) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[k]}"${fill ? ' class="f"' : ''}/></svg>`;

export function openReplay(c: ReplayCtx) {
  const S = c.steps, N = S.length, [MW, MH] = c.size, B = 34;
  let cur = 0, view: string = 'all', playing = false, speed = 1, timer = 0, follow = true;
  const root = h('div', 'rp'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', `Replay: ${c.title}`);
  root.innerHTML = `<header class="rp-bar"><div class="rp-ttl"><b>Replay</b><span></span></div><div class="rp-res"></div>
    <div class="rp-seg" role="group" aria-label="Whose view"></div><button type="button" class="rp-x" aria-label="Close the replay" title="Close">✕</button></header>
    <div class="rp-main"><div class="rp-board"><svg class="rp-svg" aria-hidden="true"></svg><button type="button" class="rp-zoom"></button></div>
    <div class="rp-side"><section class="rp-cap" aria-live="polite"><div class="k"><span class="ph"></span><span class="n"></span></div><div class="rp-msg"></div><div class="rp-dice"></div></section><nav class="rp-list" aria-label="Moves"></nav></div></div>
    <section class="rp-dock"><div class="rp-tl" role="slider" tabindex="0" aria-label="Replay position" aria-valuemin="1"><svg></svg></div>
    <div class="rp-ctl"><div class="rp-where"></div><div class="rp-tp">
      <button type="button" data-k="pt" aria-label="Previous turn" title="Previous turn">${svgIcon('pt')}</button><button type="button" data-k="p" aria-label="Step back" title="Step back">${svgIcon('p')}</button>
      <button type="button" data-k="play" class="play" aria-label="Play" title="Play">${svgIcon('play', true)}</button>
      <button type="button" data-k="n" aria-label="Step forward" title="Step forward">${svgIcon('n')}</button><button type="button" data-k="nt" aria-label="Next turn" title="Next turn">${svgIcon('nt')}</button></div>
    <div class="rp-seg rp-speed" role="group" aria-label="Speed"><button type="button" data-s="1" aria-pressed="true">1×</button><button type="button" data-s="2" aria-pressed="false">2×</button><button type="button" data-s="4" aria-pressed="false">4×</button></div></div></section>`;
  document.body.append(root);
  const q = <T extends Element>(s: string) => root.querySelector(s) as T;
  q('.rp-ttl span').textContent = c.title; q('.rp-res').textContent = c.result;
  const seg = q('.rp-seg');
  for (const [v, label] of [['all', 'Everything'], [c.sides[0], `As ${c.sideName[c.sides[0]]}`], [c.sides[1], `As ${c.sideName[c.sides[1]]}`]]) {
    const b = h('button', '', label) as HTMLButtonElement; b.type = 'button'; b.setAttribute('aria-pressed', String(v === view)); b.onclick = () => { view = v; for (const x of Array.from(seg.querySelectorAll('button'))) x.setAttribute('aria-pressed', String(x === b)); draw(); }; seg.append(b);
  }

  /* the board: the printed map, then the battle ring, the move arrow and the blocks */
  const svg = q<SVGSVGElement>('.rp-svg');
  svg.append(el('defs', {}, [el('marker', { id: 'rp-ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, [el('path', { d: 'M0 0L10 5L0 10z', fill: '#e7b04a' })])]),
    el('image', { href: c.board, x: 0, y: 0, width: MW, height: MH, preserveAspectRatio: 'none' }));
  const gA = el('g'), gFx = el('g'), gAr = el('g'), gU = el('g'); svg.append(gA, gFx, gAr, gU);
  for (const a of c.areaIds) { const p = c.label(a); if (!p) continue;                               // the area numbers and names (the printed board shows them as a separate layer)
    const t = el('text', { x: p[0], y: p[1] - 24, 'text-anchor': 'middle', 'font-family': 'Saira Condensed, Arial Narrow, sans-serif', 'font-weight': 700, 'font-size': 13, fill: '#1d1f17', stroke: '#e9ecdd', 'stroke-width': 3, 'paint-order': 'stroke' }); t.textContent = c.areaName(a);
    const n = el('text', { x: p[0], y: p[1] - 38, 'text-anchor': 'middle', 'font-family': 'Saira Condensed, sans-serif', 'font-weight': 700, 'font-size': 11, fill: '#5b4512', stroke: '#f3e3a8', 'stroke-width': 3, 'paint-order': 'stroke' }); n.textContent = String(a); gA.append(n, t); }
  const blocks = new Map<string, { g: SVGGElement; img: SVGImageElement; back: SVGRectElement; str: number }>();
  const block = (id: string) => {
    let b = blocks.get(id); if (b) return b;
    const f = c.face(id, 1), g = el('g', { class: 'rp-u' }) as SVGGElement, img = el('image', { width: B, height: B }) as SVGImageElement;
    const back = el('rect', { width: B, height: B, rx: 3, fill: c.wood[f?.side ?? ''] ?? '#666', stroke: '#0b0d08', 'stroke-width': 1 }) as SVGRectElement;
    g.append(el('rect', { x: 2, y: 3, width: B, height: B, rx: 3, fill: '#000', opacity: '.35' }), img, back); gU.append(g); b = { g, img, back, str: -1 }; blocks.set(id, b); return b;
  };
  const at = (a: number) => c.label(a);
  let vb = { x: 0, y: 0, w: MW, h: MH }, vbGoal = { ...vb }, anim = 0;
  const applyVb = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const aim = (pt: [number, number] | null) => {
    const r = q<HTMLElement>('.rp-board').getBoundingClientRect(), asp = r.height / Math.max(1, r.width) || MH / MW;
    if (follow && !pt && vb.w < MW) return;                                                            // nothing moved: the camera stays where it was
    if (!follow || !pt) { const w = Math.max(MW, MH / asp); vbGoal = { x: (MW - w) / 2, y: (MH - w * asp) / 2, w, h: w * asp }; }
    else { const w = Math.min(MW, Math.max(520, MW * 0.42)), hh = w * asp; vbGoal = { x: Math.max(0, Math.min(MW - w, pt[0] - w / 2)), y: hh >= MH ? (MH - hh) / 2 : Math.max(0, Math.min(MH - hh, pt[1] - hh / 2)), w, h: hh }; }
    cancelAnimationFrame(anim); const from = { ...vb }, t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
    const step = (t: number) => { const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = k * (2 - k); vb = { x: from.x + (vbGoal.x - from.x) * e, y: from.y + (vbGoal.y - from.y) * e, w: from.w + (vbGoal.w - from.w) * e, h: from.h + (vbGoal.h - from.h) * e }; applyVb(); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  const zoomBtn = q<HTMLButtonElement>('.rp-zoom'); const zoomLabel = () => { zoomBtn.textContent = follow ? 'Whole map' : 'Follow the action'; };
  zoomBtn.onclick = () => { follow = !follow; zoomLabel(); draw(); }; zoomLabel();

  /* what moved between two steps: the arrow and the camera follow it */
  const moved = (a: JUnits, b: JUnits) => { for (const [id, [ar]] of Object.entries(b)) { const p = a[id]; if (p && p[0] !== ar) return [p[0], ar] as [number, number]; } return null; };
  const sideName = (p: JPub) => c.sideName[p.side] ?? p.side;
  /** A log line as a sentence: without the side and step it starts with; a bare phase start named. */
  const say = (p: JPub, m: string) => { const t = m.replace(/^[A-Z]{2} \w+: /, ''); return /^phase start$/i.test(t) ? `${c.phaseName(p.ph)} begins` : t; };
  function draw() {
    const st = S[cur], u = st.units, prev = S[cur - 1]?.units ?? {}, here = new Map<number, string[]>();
    for (const [id, [a]] of Object.entries(u)) if (at(a)) (here.get(a) ?? here.set(a, []).get(a)!).push(id);
    for (const [id, b] of blocks) if (!u[id]) b.g.style.opacity = '0';
    for (const [a, ids] of here) {
      const [x, y] = at(a)!;
      ids.forEach((id, k) => {
        const b = block(id), [, str] = u[id], f = c.face(id, str); if (!f) return;
        if (b.str !== str) { b.img.setAttribute('href', `data:image/svg+xml;utf8,${encodeURIComponent(f.svg)}`); b.str = str; }
        const hidden = view !== 'all' && f.side !== view && st.pub.fx !== a;                   // the other side's blocks stand face-down unless a battle shows them
        b.img.style.display = hidden ? 'none' : ''; b.back.style.display = hidden ? '' : 'none';
        b.g.style.opacity = '1'; b.g.style.transform = `translate(${x - (ids.length * (B + 3)) / 2 + k * (B + 3)}px, ${y - B / 2}px)`;
      });
    }
    gFx.replaceChildren(); gAr.replaceChildren();
    const fx = st.pub.fx != null ? at(st.pub.fx) : null; if (fx) gFx.append(el('circle', { cx: fx[0], cy: fx[1], r: 62, fill: '#d1432f26', stroke: '#d1432f', 'stroke-width': 3, 'stroke-dasharray': '8 5' }));
    const mv = cur ? moved(prev, u) : null, f0 = mv && at(mv[0]), t0 = mv && at(mv[1]);
    if (f0 && t0) gAr.append(el('path', { d: `M${f0[0]} ${f0[1]}Q${(f0[0] + t0[0]) / 2 + (t0[1] - f0[1]) * 0.18} ${(f0[1] + t0[1]) / 2 - (t0[0] - f0[0]) * 0.18} ${t0[0]} ${t0[1]}`, fill: 'none', stroke: '#e7b04a', 'stroke-width': 5, 'stroke-dasharray': '12 7', 'marker-end': 'url(#rp-ah)' }));
    aim(fx ?? t0 ?? null);
    q('.rp-cap .ph').textContent = `Turn ${st.pub.t} · ${sideName(st.pub)} ${c.phaseName(st.pub.ph)}`; q('.rp-cap .n').textContent = `${cur + 1} / ${N}`;
    const msg = q('.rp-msg'); msg.replaceChildren(...(st.pub.msg.length ? st.pub.msg.map((m) => say(st.pub, m)) : ['No change on the board.']).map((m) => h('p', '', m)));
    q('.rp-dice').replaceChildren(...(st.pub.dice ?? []).map(([who, sn, ds]) => { const r = h('div', 'dr'); r.append(h('span', 'who', `${who} · hits on ${sn} or less`), ...ds.map((d) => h('span', `die ${d <= sn ? 'h' : 'm'}`, String(d)))); return r; }));
    q('.rp-where').innerHTML = ''; q('.rp-where').append(h('b', '', `Turn ${st.pub.t}`), ` · ${sideName(st.pub)} ${c.phaseName(st.pub.ph)} · VP ${c.tag[c.sides[0]]} ${st.pub.vp[0]} – ${c.tag[c.sides[1]]} ${st.pub.vp[1]}`);
    for (const b of Array.from(list.querySelectorAll<HTMLButtonElement>('button'))) { const on = +b.dataset.i! === cur; if (on) { b.setAttribute('aria-current', 'step'); const top = b.offsetTop - 34, bot = b.offsetTop + b.offsetHeight; if (top < list.scrollTop) list.scrollTop = top; else if (bot > list.scrollTop + list.clientHeight) list.scrollTop = bot - list.clientHeight; } else b.removeAttribute('aria-current'); }
    const tl = q('.rp-tl'); tl.setAttribute('aria-valuenow', String(cur + 1)); tl.setAttribute('aria-valuemax', String(N)); tl.setAttribute('aria-valuetext', `Turn ${st.pub.t}, ${c.phaseName(st.pub.ph)}`);
    drawTl(); translateDom(root);
  }
  /* the move list, grouped by turn and phase */
  const list = q<HTMLElement>('.rp-list'); let head = '';
  S.forEach((s, i) => {
    const hd = `Turn ${s.pub.t} · ${sideName(s.pub)} ${c.phaseName(s.pub.ph)}`; if (hd !== head) { head = hd; list.append(h('h4', '', hd)); }
    const b = h('button', `${s.pub.side === c.sides[0] ? 'p1' : 'p2'}${s.pub.dice?.length ? ' bt' : ''}`) as HTMLButtonElement; b.type = 'button'; b.dataset.i = String(i);
    b.append(h('span', 'i', String(i + 1)), h('span', 't', `${c.tag[s.pub.side] ?? ''} ${s.pub.msg.length ? say(s.pub, s.pub.msg.at(-1)!) : `${c.phaseName(s.pub.ph)}`}`)); b.onclick = () => go(i); list.append(b);
  });
  /* the timeline: turns, battles in red, the VP balance line, the playhead */
  function drawTl() {
    const tsv = q<SVGSVGElement>('.rp-tl svg'), W = q<HTMLElement>('.rp-tl').clientWidth || 600, H = 54, x = (i: number) => 10 + (N > 1 ? i / (N - 1) : 0.5) * (W - 20);
    const net = S.map((s) => s.pub.vp[0] - s.pub.vp[1]), lo = Math.min(...net, -1), hi = Math.max(...net, 1), y = (v: number) => 6 + (1 - (v - lo) / (hi - lo)) * 22;
    const kids: Node[] = [], turns = [...new Set(S.map((s) => s.pub.t))];
    for (const t of turns) {
      const is = S.map((s, i) => (s.pub.t === t ? i : -1)).filter((i) => i >= 0), half = N > 1 ? (x(1) - x(0)) / 2 : 10, a = is[0] ? x(is[0]) - half : 0, b = is.at(-1)! < N - 1 ? x(is.at(-1)!) + half : W;
      kids.push(el('rect', { x: a, y: 37, width: Math.max(1, b - a - 2), height: 14, fill: t % 2 ? '#2a2e22' : '#232619' }));
      if (b - a > 46) { const tt = el('text', { x: a + 6, y: 48, 'font-size': 11, 'font-weight': 600, fill: '#9a9886', 'font-family': 'Saira Condensed, sans-serif', 'letter-spacing': 1.2 }); tt.textContent = `TURN ${t}`; kids.push(tt); }
    }
    kids.push(el('line', { x1: 10, x2: W - 10, y1: y(0), y2: y(0), stroke: '#3a3e2c', 'stroke-dasharray': '3 3' }), el('path', { d: net.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(''), fill: 'none', stroke: '#e7b04a', 'stroke-width': 1.6, opacity: 0.7 }));
    S.forEach((s, i) => { if (s.pub.dice?.length) kids.push(el('circle', { cx: x(i), cy: 32, r: 3, fill: '#d1432f' })); });
    const lab = el('text', { x: 10, y: 10, 'font-size': 10, fill: '#9a9886', 'font-family': 'JetBrains Mono, monospace' }); lab.textContent = 'VP balance'; kids.push(lab);
    kids.push(el('line', { x1: x(cur), x2: x(cur), y1: 2, y2: 50, stroke: '#e7b04a', 'stroke-width': 2 }), el('circle', { cx: x(cur), cy: y(net[cur]), r: 5, fill: '#e7b04a', stroke: '#0b0d08', 'stroke-width': 2 }));
    tsv.setAttribute('viewBox', `0 0 ${W} ${H}`); tsv.replaceChildren(...kids);
  }
  function go(i: number) { cur = Math.max(0, Math.min(N - 1, i)); draw(); }
  function turnJump(dir: number) { const t = S[cur].pub.t, first = S.findIndex((s) => s.pub.t === t); const i = dir < 0 ? (first < cur ? first : S.findIndex((s) => s.pub.t === t - 1)) : S.findIndex((s) => s.pub.t === t + 1); go(i >= 0 ? i : dir < 0 ? 0 : N - 1); }
  function setPlay(on: boolean) {
    playing = on; clearInterval(timer); const b = q<HTMLButtonElement>('[data-k="play"]'); b.innerHTML = svgIcon(on ? 'pause' : 'play', true); b.setAttribute('aria-label', on ? 'Pause' : 'Play'); b.title = on ? 'Pause' : 'Play';
    if (on) { if (cur >= N - 1) go(0); timer = window.setInterval(() => { if (cur >= N - 1) return setPlay(false); go(cur + 1); }, 1500 / speed); }
  }
  for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('.rp-tp button'))) b.onclick = () => { const k = b.dataset.k; if (k === 'p') go(cur - 1); else if (k === 'n') go(cur + 1); else if (k === 'pt') turnJump(-1); else if (k === 'nt') turnJump(1); else setPlay(!playing); };
  for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('.rp-speed button'))) b.onclick = () => { speed = +b.dataset.s!; for (const x of Array.from(root.querySelectorAll('.rp-speed button'))) x.setAttribute('aria-pressed', String(x === b)); if (playing) setPlay(true); };
  const tl = q<HTMLElement>('.rp-tl'), pick = (e: PointerEvent) => { const r = tl.getBoundingClientRect(); go(Math.round(((e.clientX - r.left - 10) / (r.width - 20)) * (N - 1))); };
  tl.addEventListener('pointerdown', (e) => { tl.setPointerCapture(e.pointerId); pick(e); }); tl.addEventListener('pointermove', (e) => { if (e.buttons) pick(e); });
  const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'Escape') close(); else if (e.key === ' ' && (e.target === document.body || e.target === tl)) { e.preventDefault(); setPlay(!playing); } else return; e.stopPropagation(); };
  const resize = () => { drawTl(); aim(null); draw(); };
  function close() { setPlay(false); removeEventListener('keydown', key, true); removeEventListener('resize', resize); root.remove(); c.close(); }
  q<HTMLButtonElement>('.rp-x').onclick = close;
  addEventListener('keydown', key, true); addEventListener('resize', resize);
  applyVb(); draw(); q<HTMLButtonElement>('[data-k="play"]').focus({ preventScroll: true });
}
