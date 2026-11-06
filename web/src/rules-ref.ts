/** The rules reference: each game's rulebooks (data/<game>/rules.json, built by tools/rules/build.py), searchable, with the
 *  printed index, links between rules and the game's own art for the pieces a rule is about. Loaded only when opened (see rules-link.ts);
 *  it lives outside #ui, so the game's redraws never touch it and nothing in it reaches the map. */
type Section = { id: string; title: string; source: string; paras: string[]; ref?: string };
type Book = { id: string; title: string; sub: string; sections: Section[] };
type IndexEntry = { term: string; subs: { label: string; refs: string[] }[]; see: string[] };
export type RulesData = { game: string; books: Book[]; index: IndexEntry[]; indexSource?: string };
/** A piece the rule is about, drawn by the game: SVG markup, the block's wood colour when it is a block, its name. */
export type Art = { svg: string; wood?: string; name: string };
export interface RulesOptions { game: string; title: string; at?: string; q?: string; art: (key: string) => Art | null; onClose?: () => void }

const LOAD: Record<string, () => Promise<{ default: unknown }>> = {
  bulge: () => import('../../data/bulge/rules.json'),
  golan73: () => import('../../data/golan73/rules.json'),
};
const PIECES: Record<string, () => Promise<{ default: unknown }>> = {
  bulge: () => import('../../tools/rules/icons-bulge.json'),
  golan73: () => import('../../tools/rules/icons-golan73.json'),
};
export const hasRules = (game: string) => game in LOAD;

type X = Section & { book: number; i: number };
/** The symbols printed on the player aids, drawn: the hit-priority marks and the troop-quality dots of the block labels. */
const SYM: Record<string, string> = {
  ok: '<svg class="sym" viewBox="0 0 16 16" role="img" aria-label="check mark"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#5d8b3a" stroke-width="1.6"/><path d="M4 8.5l3 3 5-7" fill="none" stroke="#8fd16a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg class="sym" viewBox="0 0 16 16" role="img" aria-label="cross"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#b8312f" stroke-width="1.6"/><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="#ff7a68" stroke-width="2.2" stroke-linecap="round"/></svg>',
  elite: '<svg class="sym dot" viewBox="0 0 12 12" role="img" aria-label="Elite"><circle cx="6" cy="6" r="4.6" fill="#d1432f" stroke="#fff" stroke-width="1"/></svg>',
  veteran: '<svg class="sym dot" viewBox="0 0 12 12" role="img" aria-label="Veteran"><circle cx="6" cy="6" r="4.6" fill="#111" stroke="#ddd" stroke-width="1"/></svg>',
  green: '<svg class="sym dot" viewBox="0 0 12 12" role="img" aria-label="Green"><circle cx="6" cy="6" r="4.4" fill="#fff" stroke="#888" stroke-width="1.2"/></svg>',
};
const sym = (h: string) => h.replace(/&lt;br\s*\/?&gt;/g, '<br>').replace(/\[(ok|x|elite|veteran|green)\]/g, (_, k: string) => SYM[k]);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const label = (id: string) => (id.startsWith('Ex ') ? 'Ex ' + id.slice(3) : /^[A-Z]\.0$/.test(id) ? 'Card ' + id[0] : id.replace(/^[NA](?=\d)/, ''));
const plain = (id: string) => id.replace(/^[NA](?=\d)/, '');
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
};
type View = { kind: 'list' | 'sec' | 'search'; id?: string; q?: string; tab: string; top?: number };

let current: { close: () => void; go: (id: string) => void; search: (q: string) => void; game: string } | null = null;
/** Open the reader (or bring the open one to a rule or a search). */
let opening: Promise<void> | null = null;
export async function openRules(o: RulesOptions) {
  if (opening) { await opening; }                                                                   // a second tap while the text loads: use the reader the first one opens
  if (current && current.game === o.game) { if (o.at) current.go(o.at); else if (o.q) current.search(o.q); return; }
  current?.close();
  opening = (async () => {
    const [data, pieces] = await Promise.all([LOAD[o.game]().then((m) => m.default as RulesData), PIECES[o.game]().then((m) => m.default as Record<string, string[]>).catch(() => ({}))]);
    current = mount(data, pieces, o);
  })();
  try { await opening; } finally { opening = null; }
}
export const closeRules = () => current?.close();
export const rulesOpen = () => !!current;

function mount(D: RulesData, PIECE: Record<string, string[]>, o: RulesOptions) {
  const all: X[] = [], byId = new Map<string, X>();
  D.books.forEach((b, bi) => b.sections.forEach((s, i) => { const x = { ...s, book: bi, i }; all.push(x); byId.set(s.id, x); }));
  /** A reference as printed ('6.41b', '14.02') to the rule that has it. */
  const resolve = (r: string): string | null => {
    for (const k of [r, r.replace(/[a-z]$/, ''), 'N' + r, 'A' + r]) if (byId.has(k)) return k;
    const p = r.replace(/[a-z]$/, '').split('.'); for (let n = p[1]?.length ?? 0; n > 0; n--) { const k = `${p[0]}.${p[1].slice(0, n - 1) || '0'}`; if (byId.has(k)) return k; }
    return null;
  };
  const parentOf = (s: X): X | null => {
    const sec = D.books[s.book].sections;
    for (let k = s.i - 1; k >= 0; k--) {
      const p = plain(sec[k].id), me = plain(s.id);
      if (s.id.startsWith('Ex ')) { if (sec[k].id === '23.0') return byId.get(sec[k].id)!; continue; }
      if (sec[k].id.startsWith('Ex ')) continue;
      if (/\.0$/.test(p) ? me.split('.')[0] === p.split('.')[0] && me !== p : me.startsWith(p) && me.length > p.length) return byId.get(sec[k].id)!;
    }
    return null;
  };
  const citedBy = new Map<string, Set<string>>();
  for (const s of all) for (const m of s.paras.join(' ').matchAll(/\b(\d{1,2}\.\d{1,3})[a-z]?\b/g)) { const r = resolve(m[1]); if (r && r !== s.id) (citedBy.get(r) ?? citedBy.set(r, new Set()).get(r)!).add(s.id); }

  /* ---------- the rulebook's light markup to HTML ---------- */
  const inline = (t: string) => sym(esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(>])_(.+?)_(?=[\s).,;:!<—–-]|$)/g, '$1<i>$2</i>')
    .replace(/\b(\d{1,2}\.\d{1,3}[a-z]?)\b/g, (m) => { const r = resolve(m); return r ? `<a href="#" data-go="${r}">${m}</a>` : m; }));      // the drawn symbols go in last: their path data holds numbers like 8.5
  function body(paras: string[]) {
    let out = '', list: string[] = [], rows: string[] = [];
    const flush = () => {
      if (list.length) out += '<ul>' + list.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>'; list = [];
      if (rows.length) { const r = rows.filter((x) => !/^\|\s*:?-/.test(x)).map((x) => x.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); out += '<div class="tw"><table>' + r.map((cs, i) => '<tr>' + cs.map((c) => (i ? `<td${c.length < 16 && /^(?:[+–−-]\s?\d|[+–−-]?\s?TDN|Subtract|See TQ|\d+\s?\/\s?\d+$|\+\d\/\+\d)/.test(c) ? ' class="mod"' : ''}>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join('') + '</tr>').join('') + '</table></div>'; }
      rows = [];
    };
    for (const p of paras) {
      if (p.startsWith('• ')) { if (rows.length) flush(); list.push(p.slice(2)); continue; }
      if (p.startsWith('|')) { if (list.length) flush(); rows.push(p); continue; }
      flush(); out += p.startsWith('### ') ? `<h3>${inline(p.slice(4))}</h3>` : /^\d+\.\s/.test(p) ? `<p class="step">${inline(p)}</p>` : `<p>${inline(p)}</p>`;
    }
    flush(); return out;
  }
  const arts = new Map<string, Art | null>();
  const art = (k: string) => { if (!arts.has(k)) { let a: Art | null = null; try { a = o.art(k); } catch { a = null; } arts.set(k, a); } return arts.get(k)!; };
  const pic = (k: string) => { const a = art(k); return a ? `<img alt="" class="${a.wood ? 'blk' : ''}" style="${a.wood ? `background:${a.wood}` : ''}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}">` : ''; };
  const piecesOf = (id: string) => (PIECE[id] ?? []).filter((k) => art(k));

  /* ---------- the views ---------- */
  const row = (s: Section, sub = '') => `<button class="row" data-go="${s.id}"><span class="n">${label(s.id)}</span><span class="t">${esc(s.title)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="pcs">${piecesOf(s.id).slice(0, 2).map(pic).join('')}</span></button>`;
  function listHtml(bi: number) {
    const b = D.books[bi]; let out = `<div class="bookhead">${esc(b.sub)}</div>`, open = false;
    for (const s of b.sections) {
      const top = /\.0$/.test(plain(s.id)), r = row(s, s.source !== b.sub && s.source !== b.title ? s.source : '');
      if (top) { if (open) out += '</div></div>'; out += `<div class="grp">${r}<div class="sub">`; open = true; } else out += open ? r : `<div class="grp sub">${r}</div>`;
    }
    return out + (open ? '</div></div>' : '');
  }
  function secHtml(s: X) {
    const b = D.books[s.book], par = parentOf(s), kids = b.sections.filter((x) => x.id !== s.id && parentOf(byId.get(x.id)!)?.id === s.id);
    const prev = b.sections[s.i - 1], next = b.sections[s.i + 1], ps = piecesOf(s.id), cites = [...(citedBy.get(s.id) ?? [])].slice(0, 16);
    return `<article class="sec"><div class="crumb"><button data-tab="${b.id}">${esc(b.title)}</button>${par ? `<span aria-hidden="true">›</span><button data-go="${par.id}">${label(par.id)} ${esc(par.title)}</button>` : ''}</div>
      <h2><span class="num">${label(s.id)}</span><span>${esc(s.title)}</span></h2><div class="src">${esc(s.source)}</div>
      ${ps.length ? `<div class="art">${ps.map((k) => `<figure>${pic(k)}<figcaption>${esc(art(k)!.name)}</figcaption></figure>`).join('')}</div>` : ''}
      <div class="txt">${body(s.paras)}</div>
      ${kids.length ? `<div class="childs">${kids.map((x) => row(x)).join('')}</div>` : ''}
      ${cites.length ? `<div class="cites"><b>Cited in</b>${cites.map((id) => `<a href="#" data-go="${id}">${label(id)}</a>`).join('')}</div>` : ''}
      <div class="pn">${prev ? `<button class="ib" data-go="${prev.id}">‹ ${label(prev.id)} ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button class="ib" data-go="${next.id}">${label(next.id)} ${esc(next.title)} ›</button>` : ''}</div></article>`;
  }
  const chip = (r: string) => { const id = resolve(r); return id ? `<button class="chip" data-go="${id}">${esc(r)}</button>` : ''; };
  function indexHtml() {
    const terms = [...D.index].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' })), letters = new Set(terms.map((t) => t.term[0].toUpperCase()));
    let out = `<div class="bookhead">The index printed at the back of the ${esc((D.books.find((b) => b.id === 'series') ?? D.books[0]).sub)}. Tap a number to read the rule.</div>`
      + `<div class="az">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `<button data-az="${l}" ${letters.has(l) ? '' : 'disabled'}>${l}</button>`).join('')}</div>`, cur = '';
    for (const t of terms) {
      const l = t.term[0].toUpperCase(); if (l !== cur) { cur = l; out += `<div class="letter" data-letter="${l}">${l}</div>`; }
      const own = t.subs.filter((x) => !x.label), subs = t.subs.filter((x) => x.label);
      out += `<div class="ix" data-term="${esc(t.term.toLowerCase())}"><div class="term"><b>${esc(t.term)}</b><span class="refs">${own.flatMap((x) => x.refs).map(chip).join('')}</span></div>`
        + subs.map((x) => `<div class="term sub"><span>${esc(x.label)}</span><span class="refs">${x.refs.map(chip).join('')}</span></div>`).join('')
        + (t.see.length ? `<div class="term sub"><span class="see">see ${t.see.map((x) => `<button class="seebtn" data-see="${esc(x)}">${esc(x)}</button>`).join(', ')}</span><span></span></div>` : '') + '</div>';
    }
    return out;
  }
  const flat = all.map((s) => ({ s, title: s.title.toLowerCase(), text: s.paras.join(' ').replace(/[*_]/g, '').toLowerCase() }));
  function search(q: string) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
    const qq = q.trim(), num = /^[NA]?\d{1,2}(\.\d{0,3})?[a-z]?$/i.test(qq) ? qq.replace(/[a-z]$/, '') : null;
    return flat.map(({ s, title, text }) => {
      let sc = 0;
      if (num && (label(s.id) === num || label(s.id).startsWith(num + (num.includes('.') ? '' : '.')))) sc += label(s.id) === num ? 300 : 80;
      else for (const w of words) { const n = text.split(w).length - 1; if (!n && !title.includes(w)) return null; sc += (title.includes(w) ? 40 : 0) + Math.min(n, 8) * 4; }
      if (!num) for (const e of D.index) if (words.every((w) => e.term.toLowerCase().includes(w)) && e.subs.some((x) => x.refs.some((r) => resolve(r) === s.id))) sc += 30;
      return sc ? { s, sc } : null;
    }).filter((x): x is { s: X; sc: number } => !!x).sort((a, b) => b.sc - a.sc).slice(0, 60);
  }
  const mark = (h: string, words: string[]) => (words.length ? h.replace(new RegExp(words.map(reEsc).join('|'), 'gi'), (m) => `<mark>${m}</mark>`) : h);
  function snippet(s: X, words: string[]) {
    const text = s.paras.join(' ').replace(/[*_]/g, ''), low = text.toLowerCase(), at = words.map((w) => low.indexOf(w)).filter((x) => x >= 0)[0] ?? 0;
    return mark(esc((at > 40 ? '… ' : '') + text.slice(Math.max(0, at - 40), at + 150) + (text.length > at + 150 ? '…' : '')), words);
  }
  function searchHtml(q: string) {
    const r = search(q), words = /^[NA]?\d/.test(q.trim()) ? [] : q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!r.length) return `<div class="empty">No rule mentions “${esc(q)}”. Try a shorter word, or a rule number such as ${esc(D.books[1]?.sections[5]?.id ?? '6.4')}.</div>`;
    return `<div class="bookhead">${r.length === 60 ? 'The best 60' : r.length} result${r.length === 1 ? '' : 's'} for “${esc(q)}”</div><div class="res">`
      + r.map(({ s }) => `<button class="hit" data-go="${s.id}"><span class="n">${label(s.id)}</span><span><b class="tt">${mark(esc(s.title), words)}</b><small>${esc(D.books[s.book].title)} · ${esc(s.source)}</small><span class="sn">${snippet(s, words)}</span></span></button>`).join('') + '</div>';
  }

  /* ---------- the sheet ---------- */
  const root = document.createElement('section');
  root.id = 'rules'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'false'); root.setAttribute('aria-label', `${o.title} rules reference`);
  root.innerHTML = `<div class="hd"><div class="top"><h1>Rules</h1><span class="game">${esc(o.title)}</span><span class="sp"></span>
      <button class="ib" data-act="back" title="Back" hidden>${ICON.back}<span>Back</span></button>
      <button class="ib" data-act="close" title="Close the rules (Esc)" aria-label="Close the rules">${ICON.close}</button></div>
    <label class="search">${ICON.search}<input type="search" placeholder="Search the rules: a word or a number" autocomplete="off" aria-label="Search the rules"></label>
    <div class="tabs" role="tablist">${[['index', 'Index'], ...D.books.map((b) => [b.id, b.title])].map(([id, t]) => `<button class="tab" role="tab" data-tab="${id}" aria-selected="false">${esc(t)}</button>`).join('')}</div></div>
    <div class="bd" tabindex="-1"></div>`;
  document.body.appendChild(root);
  const bd = root.querySelector<HTMLElement>('.bd')!, input = root.querySelector<HTMLInputElement>('input')!, backBtn = root.querySelector<HTMLButtonElement>('[data-act="back"]')!;
  const firstBook = D.books.find((b) => b.id === 'series')?.id ?? D.books[0].id;
  let view: View = { kind: 'list', tab: firstBook }; const hist: View[] = [];
  const store = { get: () => { try { return sessionStorage.getItem('fab-rules:' + o.game); } catch { return null; } }, set: (v: string) => { try { sessionStorage.setItem('fab-rules:' + o.game, v); } catch { /* private mode */ } } };

  function render(keepScroll = false) {
    root.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === view.tab && view.kind !== 'search')));
    backBtn.hidden = !hist.length;
    if (view.kind === 'search') bd.innerHTML = searchHtml(view.q ?? '');
    else if (view.kind === 'sec' && view.id && byId.has(view.id)) bd.innerHTML = secHtml(byId.get(view.id)!);
    else if (view.tab === 'index') bd.innerHTML = indexHtml();
    else bd.innerHTML = listHtml(Math.max(0, D.books.findIndex((b) => b.id === view.tab)));
    if (!keepScroll) bd.scrollTop = view.top ?? 0;
    if (view.kind === 'sec' && view.id) store.set(view.id);
    root.querySelector('.tabs [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const push = () => hist.push({ ...view, top: bd.scrollTop });
  function go(id: string) {
    const r = resolve(id) ?? id; if (!byId.has(r)) return;
    if (!(view.kind === 'sec' && view.id === r)) push();
    view = { kind: 'sec', id: r, tab: D.books[byId.get(r)!.book].id }; render(); bd.focus({ preventScroll: true });
  }
  function doSearch(q: string) {
    q = q.trim(); input.value = q;
    if (q) { if (view.kind !== 'search') push(); view = { kind: 'search', q, tab: view.tab }; }
    else if (view.kind === 'search') view = hist.pop() ?? { kind: 'list', tab: firstBook };
    render(view.kind === 'search');
  }
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go],[data-tab],[data-az],[data-see],[data-act]'); if (!t) return;
    e.preventDefault();
    if (t.dataset.go) return go(t.dataset.go);
    if (t.dataset.act === 'close') return close();
    if (t.dataset.act === 'back') { const h = hist.pop(); if (h) { view = h; input.value = h.kind === 'search' ? h.q ?? '' : ''; render(); } return; }
    if (t.dataset.az) return bd.querySelector(`[data-letter="${t.dataset.az}"]`)?.scrollIntoView({ block: 'start' });
    if (t.dataset.see) { const k = t.dataset.see.toLowerCase(); const el = bd.querySelector(`[data-term="${CSS.escape(k)}"]`) ?? Array.from(bd.querySelectorAll<HTMLElement>('[data-term]')).find((x) => x.dataset.term!.startsWith(k)); el?.scrollIntoView({ block: 'start' }); return; }
    if (t.dataset.tab) { push(); view = { kind: 'list', tab: t.dataset.tab }; input.value = ''; render(); }
  });
  let tm = 0;
  input.addEventListener('input', () => { clearTimeout(tm); tm = window.setTimeout(() => doSearch(input.value), 140); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = search(input.value.trim()); if (r[0]) go(r[0].s.id); } });
  root.addEventListener('keydown', (e) => {                                                          // the game's own keys (Enter, N, Esc, Ctrl+Z) stay out of the reader
    e.stopPropagation();
    if (e.key === 'Escape') { if (input.value && document.activeElement === input) doSearch(''); else close(); }
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
  for (const ty of ['pointerdown', 'wheel', 'touchstart']) root.addEventListener(ty, (e) => e.stopPropagation(), { passive: true });
  function close() { root.remove(); current = null; o.onClose?.(); }

  if (o.at) go(o.at); else if (o.q) doSearch(o.q); else { const last = store.get(); if (last && byId.has(last)) { view = { kind: 'sec', id: last, tab: D.books[byId.get(last)!.book].id }; } render(); }
  if (!o.at && matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 30);      // no keyboard popping up on a phone
  return { close, go, search: doSearch, game: o.game };
}
