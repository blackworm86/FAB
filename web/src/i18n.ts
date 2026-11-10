/** 4.6 The interface in English or Italian. The game is written in English; Italian comes from dictionaries (src/i18n/it-ui.json for the interface, it-tut-<game>.json for each game's tutorials):
 *  - `text`: whole strings (a button, a label, a sentence) as they appear in one text node or attribute;
 *  - `patterns`: sentences with numbers or names in them, as regular expressions with $1, $2… (e.g. "Turn (\\d+)" → "Turno $1");
 *  - `html`: whole passages written with markup (the tutorials' lessons), translated before they are drawn.
 *  After each redraw `translateDom` replaces the text nodes and attributes it knows; anything not yet translated stays in English.
 *  The rulebooks stay in English (the reader is skipped). `?i18n=collect` (development) lists what is still missing: __i18nMissing(). */
export type Lang = 'en' | 'it';
const KEY = 'fab-lang';
export const LANG: Lang = (() => { try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'it') return s; } catch { /* private mode */ } return /^it\b/i.test(navigator.language ?? '') ? 'it' : 'en'; })();
export function setLang(l: Lang) { try { localStorage.setItem(KEY, l); } catch { /* private mode */ } location.reload(); }
export const LANGS: [Lang, string][] = [['en', 'English'], ['it', 'Italiano']];

type Dict = { text: Record<string, string>; patterns: [string, string][]; html: Record<string, string> };
let D: Dict = { text: {}, patterns: [], html: {} }, PATS: [RegExp, string][] = [];
const COLLECT = typeof location !== 'undefined' && /[?&]i18n=collect\b/.test(location.search), missing = new Set<string>();
if (COLLECT) Object.assign(window, { __i18nMissing: () => [...missing] });
/** Load the dictionary for the chosen language (nothing to load for English). */
export async function loadLang() {
  if (LANG === 'en') return;
  const parts = (await Promise.all([import('./i18n/it-tut-bulge.json'), import('./i18n/it-tut-golan73.json'), import('./i18n/it-tut-sicily.json'), import('./i18n/it-ui.json')])).map((m) => (m.default as unknown) as Dict);
  for (const p of parts) { Object.assign(D.text, p.text);      /* it-ui.json last: the interface's own words win over a lesson's */ D.patterns.push(...p.patterns); Object.assign(D.html, p.html); }
  PATS = D.patterns.map(([re, out]) => [new RegExp(`^${re}$`), out]);
}
/** A string in the chosen language (or itself when there is no translation yet). */
export function tr(s: string): string {
  if (LANG === 'en' || !s) return s;
  const t = D.text[s]; if (t != null) return t;
  for (const [re, out] of PATS) { const m = re.exec(s); if (m) return out.replace(/\$(\d)/g, (_, i: string) => { const v = m[+i] ?? ''; return v && v !== s ? tr(v) : v; }).replace(/\b1 colpi\b/g, '1 colpo'); }      // one pattern serves 1 and many hits      // the pattern's variable parts are translated too when the dictionary knows them (a side, "last action")
  if (COLLECT) missing.add(s);
  return s;
}
/** A passage with markup (a lesson's text), whole. */
export const trHtml = (s: string) => (LANG === 'en' || !s ? s : D.html[s] ?? (COLLECT && missing.add(`html:${s}`), s));
const SKIP = 'script, style, #rules .sec, #rules .ix, #rules .row, .notr, [contenteditable], input, textarea';
const ATTRS = ['title', 'aria-label', 'placeholder', 'data-tip', 'data-cap'];
const SKIP_ATTR = 'script, style, #rules .sec, #rules .ix, #rules .row, .notr, [contenteditable]';      // inputs keep their typed text, but their hints are translated
/** A CSS selector that also finds elements whose title / aria-label was translated (it matches their English). */
export const enSel = (sel: string) => (LANG === 'en' || !/\[(title|aria-label)/.test(sel) ? sel : `${sel}, ${sel.replace(/\[(title|aria-label)/g, '[data-en-$1')}`);
/** Translate the text nodes and attributes under `root` that the dictionary knows. */
export function translateDom(root: Element | null) {
  if (LANG === 'en' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/[A-Za-z]{2}/.test(n.nodeValue ?? '') && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  for (let n = w.nextNode(); n; n = w.nextNode()) { const raw = n.nodeValue!, key = raw.trim(), t = tr(key); if (t !== key) n.nodeValue = raw.replace(key, t); }
  for (const a of ATTRS) root.querySelectorAll<HTMLElement>(`[${a}]`).forEach((e) => { if (e.closest(SKIP_ATTR)) return; const v = e.getAttribute(a)!, t = tr(v); if (t !== v) { e.setAttribute(a, t); e.setAttribute(`data-en-${a}`, v); } });      // the English stays alongside, for the tutorials' targets
}
