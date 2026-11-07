/** 4.5 The Play Book's example figures in the rules reader (approved mockup: claude.ai/artifact/3A62bGTYNtx5naguQFC2yf). Each example's
 *  figure is data (data/<game>/figures.json): which areas it frames, its pieces, markers, and one step per lettered paragraph (A, B, C…),
 *  drawn on the game's own printed board with the game's own block faces. Steps are cumulative: a step changes only what it names. */

export interface FigPiece { unit?: string; label?: string; side?: string; cls?: 'armor' | 'infantry' }
export interface FigMarker { kind: 'mines' | 'fw' | 'blown' | 'roadblock' | 'bridge' | 'note' | 'interdict' | 'ditch'; area?: number; edge?: [number, number]; text?: string }
export interface FigMove { path: number[]; labels?: string[]; kind?: 'move' | 'retreat' | 'strat' | 'air' }
export interface FigStep {
  tab: string;                                       // 'Set-up', 'A', 'B'…: the paragraph letter it illustrates
  cap: string;                                       // one or two plain sentences under the figure
  at?: Record<string, number | null>;                // pieces placed or moved (null: off the board)
  str?: Record<string, number>;                      // pieces' strength from this step on
  moves?: FigMove[]; fail?: [number, number][]; ring?: number[]; marks?: FigMarker[]; drop?: string[];   // arrows, failed crossings, battle rings, markers added, markers removed (by kind:area/edge key)
  /** [who rolled, success number (null when the book does not give it), the dice, passed (needed when there is no number)] */
  dice?: [string, number | null, number[], boolean?][]; mp?: string;
}
export interface FigSpec { view: number[]; pieces: Record<string, FigPiece>; markers?: FigMarker[]; steps: FigStep[] }
/** What the figure needs from the game: its board, where areas are, their names, block faces. */
export interface FigKit {
  base: string; lines: string; size: [number, number]; label: (a: number) => [number, number] | null; poly: (a: number) => [number, number][] | null; name: (a: number) => string;
  face: (p: FigPiece, str?: number) => { svg: string; wood: string; side: string } | null; labelFont: string;
}
const B = 36;                                          // block size on the board, in map pixels
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const mkey = (m: FigMarker) => `${m.kind}:${m.edge ? [...m.edge].sort((a, b) => a - b).join('-') : m.area ?? ''}`;

/** The middle of the boundary two areas share (their polygons' common points), or the midpoint of their labels. */
export function edgeMid(k: FigKit, a: number, b: number): [number, number] | null {
  const pa = k.poly(a), pb = k.poly(b), la = k.label(a), lb = k.label(b);
  if (pa && pb) { const near = pa.filter(([x, y]) => pb.some(([u, v]) => Math.hypot(x - u, y - v) < 6)); if (near.length) { const s = near.reduce((t, [x, y]) => [t[0] + x, t[1] + y], [0, 0]); return [s[0] / near.length, s[1] / near.length]; } }
  return la && lb ? [(la[0] + lb[0]) / 2, (la[1] + lb[1]) / 2] : null;
}
/** The state after step i: where each piece stands, its strength, the markers on the board. */
export function stateAt(f: FigSpec, i: number) {
  const at: Record<string, number | null> = {}, str: Record<string, number> = {}, marks = new Map<string, FigMarker>();
  for (const m of f.markers ?? []) marks.set(mkey(m), m);
  for (let k = 0; k <= i; k++) { const s = f.steps[k]; Object.assign(at, s.at ?? {}); Object.assign(str, s.str ?? {}); for (const m of s.marks ?? []) marks.set(mkey(m), m); for (const d of s.drop ?? []) marks.delete(d); }
  return { at, str, marks: [...marks.values()] };
}

/** The figure's markup: the frame with tabs, the board and the caption; `bindFigure` brings it to life. */
export function figureHtml(id: string, f: FigSpec) {
  return `<figure class="exfig" data-fig="${esc(id)}"><div class="fh"><span class="k">Figure · ${esc(id.replace(/^Ex /, 'Example '))}</span><div class="ftabs" role="tablist" aria-label="Steps of the example">${f.steps.map((s, i) => `<button type="button" role="tab" data-fs="${i}" aria-selected="${i === 0}">${esc(s.tab)}</button>`).join('')}</div></div>
    <div class="stage"><svg viewBox="0 0 10 10" aria-hidden="true"></svg></div><figcaption aria-live="polite"><div class="cap"></div><div class="extra"></div></figcaption></figure>`;
}
export function bindFigure(root: HTMLElement, f: FigSpec, k: FigKit) {
  const found = root.querySelector<HTMLElement>('.exfig'); if (!found) return; const fig: HTMLElement = found;
  const svg = fig.querySelector('svg')!, NS = 'http://www.w3.org/2000/svg', [MW, MH] = k.size;
  const el = (tag: string, at: Record<string, string | number> = {}, kids: (Node | string)[] = []) => { const e = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(at)) e.setAttribute(a, String(v)); e.append(...kids); return e; };
  /* the frame: the view areas' labels with room round them, about 5:4 */
  const pts = f.view.map((a) => k.label(a)).filter((p): p is [number, number] => !!p);
  let x0 = Math.min(...pts.map((p) => p[0])) - 110, x1 = Math.max(...pts.map((p) => p[0])) + 110, y0 = Math.min(...pts.map((p) => p[1])) - 90, y1 = Math.max(...pts.map((p) => p[1])) + 100;
  const want = 1.24, w = x1 - x0, h = y1 - y0; if (w / h < want) { const d = (h * want - w) / 2; x0 -= d; x1 += d; } else { const d = (w / want - h) / 2; y0 -= d; y1 += d; }
  x0 = Math.max(0, Math.min(x0, MW - (x1 - x0))); y0 = Math.max(0, Math.min(y0, MH - (y1 - y0))); const VW = Math.min(MW, x1 - x0), VH = Math.min(MH, y1 - y0);
  svg.setAttribute('viewBox', `${x0} ${y0} ${VW} ${VH}`); fig.querySelector<HTMLElement>('.stage')!.style.aspectRatio = `${VW} / ${VH}`;
  const u = VW / 420;                                                                                  // one "point" of line work, so arrows read the same in every frame
  const COL: Record<string, string> = { move: '#e7b04a', retreat: '#ff9c8a', strat: '#9fd4ff', air: '#c9a7ff', fail: '#d1432f' }, mid0 = `${f.view.join('-')}-${Math.random().toString(36).slice(2, 6)}`;
  svg.append(el('defs', {}, Object.entries(COL).map(([n, c]) => el('marker', { id: `ah-${mid0}-${n}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' }, [el('path', { d: 'M0 0L10 5L0 10z', fill: c })]))),
    el('image', { href: k.base, x: 0, y: 0, width: MW, height: MH, preserveAspectRatio: 'none' }), el('image', { href: k.lines, x: 0, y: 0, width: MW, height: MH, preserveAspectRatio: 'none' }));
  /* area numbers and names in the board's own face */
  const near = new Set<number>(); for (const a of f.view) near.add(a);
  for (const s of f.steps) for (const m of s.moves ?? []) m.path.forEach((a) => near.add(a));
  const lab = el('g');
  for (const a of near) { const p = k.label(a); if (!p) continue; const box = /\bbox\b/i.test(k.name(a));      // an off-map box shows its printed code, not an area number
    if (!box) lab.append(el('g', { transform: `translate(${p[0] - 11} ${p[1] - 34})` }, [el('rect', { width: 22, height: 17, rx: 3, fill: '#d9b45a', stroke: '#5b4512', 'stroke-width': 1 }), el('text', { x: 11, y: 13.5, 'text-anchor': 'middle', 'font-family': 'Saira Condensed, sans-serif', 'font-weight': 700, 'font-size': 13, fill: '#1a1608' }, [String(a)])]));
    lab.append(el('text', { x: p[0], y: p[1] - 2, 'text-anchor': 'middle', 'font-family': k.labelFont, 'font-weight': 600, 'font-size': 15, fill: '#2b2418', stroke: '#efe6c8', 'stroke-width': 3.5, 'paint-order': 'stroke' }, [k.name(a)])); }
  const gMk = el('g'), gAr = el('g'), gU = el('g'); svg.append(lab, gMk, gAr, gU);
  const blocks = new Map<string, SVGGElement>();
  const blockOf = (key: string, str?: number) => {
    const p = f.pieces[key], face = p && k.face(p, str); if (!face) return null;
    let g = blocks.get(key); const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(face.svg)}`;
    if (!g) { g = el('g', { class: 'fu' }) as SVGGElement; g.append(el('rect', { x: 1.5, y: 2, width: B, height: B, rx: 2.5, fill: '#000', opacity: 0.35 }), el('rect', { width: B, height: B, rx: 2.5, fill: face.wood }), el('image', { width: B, height: B })); gU.append(g); blocks.set(key, g); }
    (g.lastChild as SVGImageElement).setAttribute('href', src); return g;
  };
  const mid = (a: number, b: number) => edgeMid(k, a, b);
  const markerEl = (m: FigMarker) => {
    const p = m.edge ? mid(m.edge[0], m.edge[1]) : m.area != null ? (([x, y]) => [x, y - 50] as [number, number])(k.label(m.area) ?? [0, 0]) : null; if (!p) return null;      // an area's marker sits above its name, clear of the blocks
    const txt = m.kind === 'mines' ? 'MINES' : m.kind === 'fw' ? 'FIELD WORKS' : m.kind === 'blown' ? 'BLOWN' : m.kind === 'roadblock' ? 'ROADBLOCK' : m.kind === 'bridge' ? 'BRIDGED' : m.kind === 'interdict' ? 'INTERDICTED' : m.kind === 'ditch' ? 'AT DITCH' : (m.text ?? '');
    const wdt = Math.max(36, txt.length * 6.4 + 10), fill = m.kind === 'blown' || m.kind === 'interdict' ? '#d1432f' : m.kind === 'note' ? '#efe6c8' : '#e7b04a';
    return el('g', { transform: `translate(${p[0]} ${p[1]})` }, [el('rect', { x: -wdt / 2, y: -9, width: wdt, height: 18, rx: 2.5, fill, stroke: '#2b210a', 'stroke-width': 1.4 }), el('text', { x: 0, y: 4.5, 'text-anchor': 'middle', 'font-family': 'Saira Condensed, sans-serif', 'font-weight': 700, 'font-size': 11.5, 'letter-spacing': 0.8, fill: m.kind === 'blown' || m.kind === 'interdict' ? '#fff' : '#1a1608' }, [txt])]);
  };
  const arrow = (pts: [number, number][], kind: string) => { const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(''); return el('path', { d, fill: 'none', stroke: COL[kind], 'stroke-width': 4 * u, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': `${9 * u} ${6 * u}`, 'marker-end': `url(#ah-${mid0}-${kind})` }); };
  let cur = 0;
  function show(i: number) {
    cur = i; const s = f.steps[i], st = stateAt(f, i), here = new Map<number, string[]>();
    for (const [key, a] of Object.entries(st.at)) if (a != null && k.label(a)) (here.get(a) ?? here.set(a, []).get(a)!).push(key);
    for (const [key, g] of blocks) if (st.at[key] == null) g.style.opacity = '0';
    for (const [a, keys] of here) { const [x, y] = k.label(a)!; keys.forEach((key, j) => { const g = blockOf(key, st.str[key]); if (!g) return; g.style.opacity = '1'; g.style.transform = `translate(${x - (keys.length * (B + 2)) / 2 + j * (B + 2)}px, ${y + 6}px)`; }); }
    gMk.replaceChildren(...st.marks.map(markerEl).filter((x): x is SVGGElement => !!x));
    const ars: Element[] = [];
    for (const a of s.ring ?? []) { const p = k.label(a); if (p) ars.push(el('circle', { cx: p[0], cy: p[1] + 14, r: 46, fill: '#d1432f22', stroke: '#d1432f', 'stroke-width': 2.4 * u, 'stroke-dasharray': `${7 * u} ${4 * u}` })); }
    for (const [a, b] of s.fail ?? []) { const pa = k.label(a), pb = k.label(b), m = mid(a, b); if (!pa || !pb || !m) continue; ars.push(arrow([[pa[0], pa[1] + 20], [pb[0], pb[1] + 8]], 'fail')); const r = 11; ars.push(el('path', { d: `M${m[0] - r} ${m[1] - r}L${m[0] + r} ${m[1] + r}M${m[0] + r} ${m[1] - r}L${m[0] - r} ${m[1] + r}`, stroke: '#d1432f', 'stroke-width': 5 * u, 'stroke-linecap': 'round' })); }
    for (const mv of s.moves ?? []) {
      const ps = mv.path.map((a) => k.label(a)).filter((p): p is [number, number] => !!p).map(([x, y]) => [x, y + 20] as [number, number]); if (ps.length < 2) continue;
      ars.push(arrow(ps, mv.kind ?? 'move'));
      (mv.labels ?? []).forEach((t, j) => { const a = ps[j], b = ps[j + 1]; if (!a || !b || !t) return; ars.push(el('text', { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 6, 'text-anchor': 'middle', 'font-family': 'Saira Condensed, sans-serif', 'font-weight': 700, 'font-size': 17, fill: COL[mv.kind ?? 'move'], stroke: '#0b0d08', 'stroke-width': 3.5, 'paint-order': 'stroke' }, [t])); });
    }
    gAr.replaceChildren(...ars);
    fig.querySelector('.cap')!.textContent = s.cap;
    const ex = fig.querySelector('.extra')!; ex.replaceChildren();
    for (const [who, sn, ds, ok] of s.dice ?? []) { const r = document.createElement('div'); r.className = 'dr'; r.append(sn == null ? who : `${who} · ${sn} or less`, ...ds.map((d) => { const e = document.createElement('span'); e.className = `die ${(sn == null ? ok : d <= sn) ? 'h' : 'm'}`; e.textContent = String(d); return e; })); ex.append(r); }
    if (s.mp) { const m = document.createElement('div'); m.className = 'mp'; m.textContent = s.mp; ex.append(m); }
    fig.querySelectorAll<HTMLButtonElement>('[data-fs]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.fs! === i)));
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((p) => { if (p.dataset.step === s.tab || (p.dataset.step === 'Overview' && i === 0)) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current'); });
  }
  fig.querySelectorAll<HTMLButtonElement>('[data-fs]').forEach((b) => { b.onclick = () => show(+b.dataset.fs!); });
  fig.querySelector(".ftabs")!.addEventListener('keydown', (e) => { const ke = e as KeyboardEvent; if (ke.key === 'ArrowRight') show(Math.min(f.steps.length - 1, cur + 1)); else if (ke.key === 'ArrowLeft') show(Math.max(0, cur - 1)); });
  root.querySelectorAll<HTMLElement>('[data-step]').forEach((p) => { const i = p.dataset.step === 'Overview' ? 0 : f.steps.findIndex((s) => s.tab === p.dataset.step); if (i < 0) return; p.tabIndex = 0; p.classList.add('stepped'); p.onclick = (e) => { if ((e.target as HTMLElement).closest('a')) return; show(i); }; p.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } }; });
  show(0);
}
