/** The small part of the rules reference that is always loaded: which game the reader shows, how to open it, and rule numbers in the
 *  game's own text turned into links ("(14.02)" in a prompt opens 14.02). The reader itself (rules-ref.ts) and the rulebook text load on first use. */
import type { Art } from './rules-ref';

type Ctx = { game: string; title: string; art: (key: string) => Art | null; onOpen?: () => void; onClose?: () => void };
let ctx: Ctx | null = null;
export const RULES_GAMES = ['bulge', 'golan73'];
/** The game the reader shows (each game has its own rulebooks). */
export const setRulesContext = (c: Ctx) => { ctx = c; };
/** Open the reader, at a rule ('14.02'), on a search, or where the player left it. */
export async function showRules(at?: string, q?: string) {
  if (!ctx || !RULES_GAMES.includes(ctx.game)) return;
  const c = ctx; c.onOpen?.();
  const m = await import('./rules-ref');
  await m.openRules({ game: c.game, title: c.title, art: c.art, at, q, onClose: c.onClose });
}
export async function closeRules() { const m = await import('./rules-ref'); m.closeRules(); }

/* A rule reference as the game prints it: "(14.02)", "(6.25, 6.42)", "(see 14.8)", "(9.34a)" — never a decimal like "(3.5 hits)". */
const NUM = String.raw`\d{1,2}\.\d{1,3}[a-z]?`;
const GROUP = new RegExp(String.raw`\(((?:see\s+)?${NUM}(?:\s*(?:,|&|and|–|-|\/)\s*${NUM})*)\)`, 'g');
const ONE = new RegExp(NUM, 'g');
const SKIP = 'button, a, input, textarea, select, .rlink, [contenteditable]';
function wrap(text: string, all: boolean): DocumentFragment | null {
  const f = document.createDocumentFragment(); let at = 0, any = false;
  const link = (s: string) => { const a = document.createElement('a'); a.href = '#'; a.className = 'rlink'; a.dataset.rule = s; a.textContent = s; a.title = `Rule ${s}`; return a; };
  const re = all ? ONE : GROUP; re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    any = true; f.append(text.slice(at, m.index));
    if (all) f.append(link(m[0]));
    else { f.append('('); let k = 0; const inner = m[1]; ONE.lastIndex = 0; for (let n = ONE.exec(inner); n; n = ONE.exec(inner)) { f.append(inner.slice(k, n.index), link(n[0])); k = n.index + n[0].length; } f.append(inner.slice(k), ')'); }
    at = m.index + m[0].length;
  }
  if (!any) return null;
  f.append(text.slice(at)); return f;
}
/** Turn the rule references inside `root` into links. `all`: every rule number (a rule label such as "6.25 Artillery · 6.42"), not only those in brackets. */
export function linkRules(root: Element | null, all = false) {
  if (!root || !ctx || !RULES_GAMES.includes(ctx.game)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\d\.\d/.test(n.nodeValue ?? '') && !(n.parentElement?.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const hits: Text[] = []; for (let n = w.nextNode(); n; n = w.nextNode()) hits.push(n as Text);
  for (const t of hits) { const f = wrap(t.nodeValue ?? '', all); if (f) t.replaceWith(f); }
}
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('a.rlink'); if (!a) return;
  e.preventDefault(); e.stopPropagation(); void showRules(a.dataset.rule);
}, true);
