/** The admin sandbox's screen: tools panel, piece library, notes, hotseat cover. Moved out of main.ts; main hands over its state and helpers once (initSandboxUi). */
import * as E from '../../engine/src';
import * as SB from './sandbox';
import { ico } from './icons';
import { esc, nm } from './util';
import { RULE, ruleHtml } from './rules-text';
import { online, setDevSeat, SANDBOX } from './online';
import type { History } from './history';
import { GAMES } from './games';
import { srow, swtch } from './ui-kit';

/** What the sandbox needs from main: the game and selection (read and written), and the shared screen helpers. */
export interface SbCtx {
  g: E.Game; selUnit: string | null; selChit: string | null; selArr: string | null; selArea: number | null; previewArea: number | null; rollView: unknown;
  ABBR: Record<string, string>; actorNow: () => E.Side | 'both'; areaName: (a: number) => string; b3: (face: string, side: E.Side | 'british', chit?: boolean) => string;
  chitImg: (c: E.Chit) => string; unitFace: (u: E.Unit) => string; unitPic: (u: E.Unit) => string; chitPic: (c: E.Chit) => string; hist: History<E.Game>; optChooser: (o: Partial<E.Opts>) => string; refresh: () => void; render: () => void; save: () => void; say: (t: string) => void;
  scenarios: { id: string; name: string }[]; defaultOpts: Partial<E.Opts>; optional: boolean; startOver: (g: E.Game) => void;
  reg: (f: () => void) => string; regv: (f: (v: string) => void) => string; ubtn: (label: string, f: () => void, cls?: string, dis?: boolean, title?: string) => string;
}
let M: SbCtx; let unitPic: SbCtx['unitPic'], chitPic: SbCtx['chitPic'], ABBR: SbCtx['ABBR'], actorNow: SbCtx['actorNow'], areaName: SbCtx['areaName'], b3: SbCtx['b3'], chitImg: SbCtx['chitImg'], unitFace: SbCtx['unitFace'], hist: SbCtx['hist'], refresh: SbCtx['refresh'], render: SbCtx['render'], save: SbCtx['save'], say: SbCtx['say'], reg: SbCtx['reg'], regv: SbCtx['regv'], ubtn: SbCtx['ubtn'];
export function initSandboxUi(ctx: SbCtx) { M = ctx; ({ unitPic, chitPic, ABBR, actorNow, areaName, b3, chitImg, unitFace, hist, refresh, render, save, say, reg, regv, ubtn } = ctx); sbJump = { turn: M.g.turn, side: M.g.phasing, phase: M.g.phase }; }
const other = E.other;
const $ = (q: string) => document.querySelector(q) as HTMLElement;
/* admin sandbox (?sandbox=1): free edits, seat switch, notes and the test report ---------- */
export const st = { sbHot: (() => { try { return localStorage.getItem('fab-hotseat') === '1'; } catch { return false; } })(), hotCover: null as E.Side | null, sbOpen: (() => { try { return localStorage.getItem('fab-sb-open') === '1'; } catch { return false; } })(), sbPlace: null as string | null, resetAsk: null as Partial<E.Opts> | null, sbAuto: false, sbFilter: '', sbDraft: '', rules: {} as Partial<E.Opts> };
let sbTab = 'Pieces';
let sbJump: { turn: number; side: E.Side; phase: E.Phase };
let sbNotes = SB.loadNotes();
/** A sandbox edit: no turn or seat checks, no automatic phase skipping, still undoable. */
export function sbx(f: () => void) { const r = hist.run(M.g, f); M.g = r.game; if (r.error) say(r.error.message); save(); refresh(); }
const sbtn = (label: string, f: () => void, cls = '', title = '') => ubtn(label, () => sbx(f), cls, false, title);
const sbSel = (opts: [string, string][], cur: string, f: (v: string) => void) => `<select data-sel="${regv((v) => { f(v); render(); })}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const sbChk = (label: string, on: boolean, f: (v: boolean) => void) => `<label class="sbchk"><input type="checkbox" ${on ? 'checked' : ''} data-sel="${regv((v) => sbx(() => f(v === 'on')))}"> ${esc(label)}</label>`;
/** Hotseat: one screen, two players. The seat follows whoever has to act; between players a cover hides the hidden blocks until the next player taps. */
export function hotWant(): E.Side | null {
  if (!SANDBOX || !st.sbHot || M.g.over) return null;
  const a = actorNow(), cur = online.mySide(); if (a !== 'both') return a;
  if (cur && cur !== M.g.phasing && M.g.done?.includes(cur)) return M.g.phasing;                       // the other side said Done: back to the Phasing Player
  return cur ?? M.g.phasing;
}
export function hotseatSync() { if (M.rollView) return; const w = hotWant(); if (w && w !== online.mySide() && !st.hotCover) { st.hotCover = w; M.selUnit = M.selChit = M.selArr = null; M.previewArea = null; } }
export const hotPass = (to: E.Side) => { st.hotCover = to; M.selUnit = M.selChit = M.selArr = null; M.previewArea = null; render(); };
export function hotCoverHtml() {
  if (!st.hotCover) return '';
  return `<div class="hotcover"><div><small>Hotseat</small><h2 class="${st.hotCover}">${nm(st.hotCover)} player</h2><p>Pass the device. The other side's hidden blocks are covered until you tap.</p><button class="primary" data-ui="${reg(() => { setDevSeat(st.hotCover!); st.hotCover = null; refresh(); })}">${ico('next')} I am the ${nm(st.hotCover)} player</button></div></div>`;
}
/** Reset asks first, inside the panel (a browser confirm() can be silenced, and then Reset silently did nothing). */
export function sbReset(opts: Partial<E.Opts>) { st.resetAsk = opts; openSb(true); render(); }
function sbResetNow(opts: Partial<E.Opts>) {
  st.resetAsk = null; st.sbPlace = null; M.startOver(E.newGame(undefined, { ...M.defaultOpts, ...st.rules, ...opts }));
  sbJump = { turn: M.g.turn, side: M.g.phasing, phase: M.g.phase };
  if (st.sbHot) { setDevSeat(M.g.phasing); st.hotCover = M.g.phasing; render(); }
}
const resetAskHtml = () => { const o = st.resetAsk; if (!o) return ''; const sc = M.scenarios.find((x) => x.id === o.scenario)?.name ?? 'this scenario';
  return `<div class="askrow sbask"><p>Start ${esc(sc)} again from its first turn? This sandbox game is lost.</p><div class="row">${ubtn(`${ico('undo')} Reset`, () => sbResetNow(o), 'danger')}${ubtn('Keep this game', () => { st.resetAsk = null; })}</div></div>`; };
const openSb = (v: boolean) => { st.sbOpen = v; try { localStorage.setItem('fab-sb-open', v ? '1' : '0'); } catch { /* private mode */ } };
/** The sandbox's only control on the playing screen: a small floating button at the left edge, clear of the bars and the map's middle. */
export function sandboxFab() {
  return `<button class="sbfab" data-ui="${reg(() => openSb(true))}" title="Sandbox tools (admin testing)" aria-label="Open the sandbox tools">${ico('wand')}<span>Sandbox</span></button>`;
}
/** Which game and scenario the sandbox runs: another game reloads the page on that game's own sandbox table. */
function sbHead() {
  const gameSel = sbSel(GAMES.filter((x) => x.ready).map((x): [string, string] => [x.id, x.name]), E.VOLUME.id, (v) => { if (v === E.VOLUME.id) return; const q = new URLSearchParams(location.search); q.set('game', v); location.search = q.toString(); });
  const cur = M.g.opts.scenario ?? M.defaultOpts.scenario ?? '';
  const scenSel = sbSel(M.scenarios.map((sc): [string, string] => [sc.id, `${sc.name}${(sc as { testing?: boolean }).testing ? ' (in testing)' : ''}`]), String(cur), (v) => { if (v !== cur) sbReset({ scenario: v as E.Opts['scenario'] }); });
  return `<div class="sbhead"><b>Sandbox</b>${gameSel}${scenSel}${ubtn(`${ico('undo')}<span>Reset</span>`, () => sbReset({ scenario: M.g.opts.scenario }), 'sbreset', false, 'A new game of this scenario from its first turn')}${ubtn(ico('close'), () => openSb(false), 'ico', false, 'Hide the sandbox tools')}</div>${resetAskHtml()}`;
}
function sbTarget(): SB.Target {
  const u = M.selUnit ? M.g.units.find((x) => x.id === M.selUnit) : null; if (u) return { kind: 'unit', id: u.id, label: `${u.name} (${u.side}, ${u.id})` };
  const c = M.selChit ? M.g.chits.find((x) => x.id === M.selChit) : null; if (c) return { kind: 'chit', id: c.id, label: `${c.name} (${c.side}, ${c.id}, ${c.box})` };
  if (M.selArea != null) return { kind: 'area', id: String(M.selArea), label: `${areaName(M.selArea)} (${M.selArea})` };
  if (M.g.battle) return { kind: 'battle', id: String(M.g.battle.area), label: `battle in ${areaName(M.g.battle.area)}` };
  return { kind: 'phase', id: M.g.phase, label: `turn ${M.g.turn}, ${M.g.phasing} ${M.g.phase}` };
}
function sbTurn() {
  const turns = Array.from({ length: M.g.lastTurn }, (_, i) => [String(i + 1), `Turn ${i + 1}`] as [string, string]);
  const hot = () => { st.sbHot = !st.sbHot; try { localStorage.setItem('fab-hotseat', st.sbHot ? '1' : '0'); } catch { /* private mode */ } if (st.sbHot) { st.sbAuto = true; st.hotCover = hotWant() ?? M.g.phasing; } render(); };
  const queue = () => { const v = (($('#sb-dice') as HTMLInputElement)?.value ?? '').split(/[^0-9]+/).filter(Boolean).map(Number).map((x) => (x === 0 ? 10 : x)).filter((x) => x >= 1 && x <= 10); M.g.force = [...(M.g.force ?? []), ...v]; };
  return `<h4>Jump to</h4><div class="sbjump">${sbSel(turns, String(sbJump.turn), (v) => { sbJump.turn = +v; })}${sbSel(E.VOLUME.sides.map((x): [string, string] => [x, nm(x)]), sbJump.side, (v) => { sbJump.side = v as E.Side; })}${sbSel(SB.PHASES, sbJump.phase, (v) => { sbJump.phase = v as E.Phase; })}${sbtn('Go', () => SB.jump(M.g, sbJump.turn, sbJump.side, sbJump.phase), 'primary', 'Start of that phase: battles, moves and per-phase marks cleared')}</div>
    <h4>Play</h4>${srow('Hot seat', 'two players on this screen, a cover between turns', swtch(st.sbHot, hot, 'Hot seat'))}${srow('Skip empty phases', 'like a real game', swtch(st.sbAuto, () => { st.sbAuto = !st.sbAuto; render(); }, 'Skip empty phases'))}
    ${srow('Next dice', M.g.force?.length ? `queued: ${M.g.force.join(' ')}` : 'none queued: rolls come from the seed', `<input id="sb-dice" class="sbdice" placeholder="1 1 9" aria-label="Next die results">${sbtn('Queue', queue)}${M.g.force?.length ? sbtn(ico('close'), () => { M.g.force = []; }, 'ico', 'Clear the queued dice') : ''}`)}
    ${srow('Map', 'every block off the map', sbtn(`${ico('trash')}<span>Clear map</span>`, () => SB.clearMap(M.g)))}${M.optional ? `<h4>Optional rules for the next Reset</h4>${M.optChooser(st.rules)}` : ''}`;
}
/* The piece library: every block and chit with its printed art, a search box and filters. */
let lbSide: 'all' | E.Side = 'all', lbType = 'all', lbWhere = 'all';
const whereOfU = (u: E.Unit) => (u.area != null ? 'map' : u.str <= 0 || M.g.elimLarge.includes(u.id) ? 'eliminated' : 'off');
const WHERE: [string, string][] = [['all', 'Anywhere'], ['map', 'On the map'], ['off', 'Off the map'], ['available', 'Available'], ['cup', 'Cup'], ['used', 'Used'], ['future', 'Future'], ['eliminated', 'Eliminated']];
const fchip = (label: string, on: boolean, f: () => void) => ubtn(label, f, on ? 'on' : '');
function sbLibrary() {
  const blocks = lbType === 'all' || lbType === 'blocks', chitsOn = lbType !== 'blocks';
  const us = blocks ? M.g.units.filter((u) => (lbSide === 'all' || u.side === lbSide) && (lbWhere === 'all' || whereOfU(u) === lbWhere)) : [];
  const cs = chitsOn ? M.g.chits.filter((c) => (lbSide === 'all' || c.side === lbSide) && (lbWhere === 'all' || c.box === lbWhere || (lbWhere === 'off' && c.box !== 'map'))) : [];
  const tile = (key: string, img: string, name: string, sub: string, on: boolean, f: () => void, cls: string, wood = false) => `<button class="lbt ${cls} ${on ? 'on' : ''}" data-k="${esc(key.toLowerCase())}" data-ui="${reg(f)}" title="${esc(name)}">${wood ? b3(img, cls as E.Side) : `<img class="cb" alt="" src="${img}">`}<small>${esc(name)}</small><i>${esc(sub)}</i></button>`;
  const tiles = [...us.sort((a, b) => a.name.localeCompare(b.name)).map((u) => tile(`${u.name} ${u.code ?? ''} ${u.id} ${u.side} ${u.cls} block unit ${u.q.join(' ')}`, unitFace(u), u.name, u.area != null ? areaName(u.area) : whereOfU(u) === 'eliminated' ? 'eliminated' : u.arrival ? `turn ${u.arrival}` : 'off map', M.selUnit === u.id, () => { M.selUnit = u.id; M.selChit = null; M.selArea = u.area ?? M.selArea; st.sbPlace = u.id; refresh(); }, u.side, !u.garrison)),
    ...cs.map((c) => tile(`${c.name} ${c.kind} ${c.id} ${c.side} ${ABBR[c.kind] ?? ''} chit`, chitImg(c), c.name, `${c.box}${c.turn != null && c.box === 'future' ? ' t' + c.turn : ''}`, M.selChit === c.id, () => { M.selChit = c.id; M.selUnit = null; refresh(); }, c.side, c.kind === 'sa_block'))];
  const where = `<select aria-label="Where" data-sel="${regv((v) => { lbWhere = v; render(); })}">${WHERE.map(([k, l]) => `<option value="${k}" ${lbWhere === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="authform lbsearch"><input id="lb-q" class="grow" placeholder="Search: name, unit, kind (e.g. Peiper, artillery, 116)" value="${esc(st.sbFilter)}" aria-label="Search pieces"></div>
    <div class="lbf"><span class="seg">${(['all', ...E.VOLUME.sides] as const).map((x) => fchip(x === 'all' ? 'Both' : E.VOLUME.tag[x], lbSide === x, () => { lbSide = x; })).join('')}</span><span class="seg">${[['all', 'All'], ['blocks', 'Blocks'], ['chits', 'Chits']].map(([k, l]) => fchip(l, lbType === k, () => { lbType = k; })).join('')}</span>${where}</div>
    <div class="lbgrid">${tiles.join('') || '<p class="hint">Nothing matches.</p>'}</div>`;
}
/** What is selected, large, with its edits. */
function sbDetail() {
  const u = M.selUnit ? M.g.units.find((x) => x.id === M.selUnit) : null, c = !u && M.selChit ? M.g.chits.find((x) => x.id === M.selChit) : null;
  if (u) {
    const res = Object.keys(M.g.markers[u.side] ?? {}), resName = (z: string | null) => (!z ? 'Reserve' : z === 'res' ? 'Reserve' : `Reserve ${z.slice(1)}`);
    const tag = (label: string, on: boolean, f: () => void, title = label) => sbtn(label, f, `tag ${on ? 'on' : ''}`, title);
    const armed = st.sbPlace === u.id;
    return `<div class="lbd ${armed ? 'armed' : ''}">${unitPic(u)}<div class="t"><b>${esc(u.name)}</b><small>${nm(u.side)} ${u.cls} · ${esc(u.q.join('/'))} · ${u.area != null ? esc(areaName(u.area)) : 'off the map'}${u.arrival ? ` · arrives turn ${u.arrival}` : ''}</small>
      ${armed ? `<span class="sbgo">${ico('next')} Tap an area on the map to ${u.area != null ? 'move' : 'place'} it</span>` : ubtn(`${ico('next')}<span>${u.area != null ? 'Move freely' : 'Place'}</span>`, () => { st.sbPlace = u.id; }, 'sbarm', false, 'Then tap an area: no movement rules')}</div>
      <div class="step">${sbtn(ico('minus'), () => { u.str = Math.max(1, u.str - 1); }, 'ico', 'One step less')}<b>${u.str}/${u.max}</b>${sbtn(ico('plus'), () => { u.str = Math.min(u.max, u.str + 1); }, 'ico', 'One step more')}</div>${ubtn(ico('close'), () => { M.selUnit = null; st.sbPlace = null; refresh(); }, 'ico', false, 'Deselect')}</div>
      <div class="lbtags">${tag('Disordered', u.disorder > 0, () => { u.disorder = u.disorder ? 0 : 1; })}${res.length ? tag(resName(u.reserve ?? res[0]), !!u.reserve, () => { const i = u.reserve ? res.indexOf(u.reserve) + 1 : 0; u.reserve = res[i] ?? null; }, res.length > 1 ? 'Tap again for the next reserve marker' : 'Reserve') : ''}${tag('Out of supply', u.unsupplied, () => { u.unsupplied = !u.unsupplied; })}${tag('Moved', u.moved, () => { u.moved = !u.moved; })}${tag('Exploiting', u.exploit, () => { u.exploit = !u.exploit; })}${u.area != null ? tag('Face-up', u.up === u.area, () => { u.up = u.up === u.area ? undefined : u.area!; }) : ''}${u.area != null ? sbtn(`${ico('close')}<span>Off the map</span>`, () => { SB.lift(M.g, u.id); st.sbPlace = null; }, 'tag', 'Take it off the map') : ''}</div>`;
  }
  if (c) {
    const [t, d] = RULE[c.kind] ?? [c.kind, ''];
    return `<div class="lbd">${chitPic(c)}<div><b>${esc(c.name)}</b><small>${nm(c.side)} · ${esc(t)} · now: ${c.box}</small>
      <div class="chips">${SB.BOXES.filter((b) => b !== 'map' || c.box === 'map').map((b) => b === c.box ? `<button class="on" disabled>${b}</button>` : sbtn(b, () => { c.box = b; })).join('')}${ubtn(ico('close'), () => { M.selChit = null; refresh(); }, 'ico', false, 'Deselect')}</div></div></div>${d ? `<div class="hint">${ruleHtml(c.kind, E.isEvent(c))}</div>` : ''}`;
  }
  if (M.selArea != null) {
    const a = M.selArea;
    return `<div class="lbd area"><div><b>${esc(areaName(a))} (${a})</b><div class="row">${sbSel([['', 'Nobody holds it'], ...E.VOLUME.sides.map((x): [string, string] => [x, `${nm(x)} control`])], M.g.control[a] ?? '', (v) => sbx(() => { if (v) M.g.control[a] = v as E.Side; else delete M.g.control[a]; }))}
      ${E.contested(M.g, a) && !M.g.battle ? sbtn(`${ico('burst')} Battle here`, () => { E.startBattle(M.g, a); }, 'primary') : ''}${ubtn(ico('close'), () => { M.selArea = null; refresh(); }, 'ico', false, 'Deselect')}</div>
      <div class="row">${sbChk('Field works', M.g.fieldWorks.includes(a), (v) => { M.g.fieldWorks = M.g.fieldWorks.filter((x) => x !== a); if (v) { M.g.fieldWorks.push(a); M.g.fwOwner[a] = M.g.control[a] ?? E.VOLUME.sides[1]; } })}${sbChk('River assault', M.g.riverAssault.includes(a), (v) => { M.g.riverAssault = M.g.riverAssault.filter((x) => x !== a); if (v) M.g.riverAssault.push(a); })}</div>
      <div class="lbrow">${E.unitsIn(M.g, a).map((x) => `<button class="lbt ${x.side}" data-u="${esc(x.id)}" title="${esc(x.name)}">${unitPic(x)}<small>${esc(x.name)}</small></button>`).join('')}</div></div></div>`;
  }
  return `<p class="hint">${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} a piece below or a block or area on the map.</p>`;
}
function sbPieces() { return `${sbDetail()}${sbLibrary()}`; }
function sbNotesHtml() {
  const t = sbTarget();
  return `<p class="hint">Comment on: <b>${esc(t.kind)} · ${esc(t.label)}</b><br>Select a block, chit or area first to comment on it; otherwise the note goes on the current phase or battle.</p>
    <div class="authform"><textarea id="sb-note" rows="3" placeholder="What is wrong, what you expected">${esc(st.sbDraft)}</textarea></div>
    <div class="row">${ubtn(`${ico('plus')} Add note`, () => { const v = (($('#sb-note') as HTMLTextAreaElement)?.value ?? st.sbDraft).trim(); if (!v) return say('Write the note first.'); sbNotes.push(SB.makeNote(M.g, t, v, online.devSeat)); const w = SB.saveNotes(sbNotes); st.sbDraft = ''; say(w || 'Note added, with a snapshot of the game.'); }, 'primary')}
      ${ubtn(`${ico('share')} Download report (${sbNotes.length})`, () => SB.report(sbNotes, M.g, location.origin + location.pathname), '', !sbNotes.length)}
      ${ubtn(`${ico('trash')} Clear`, () => { if (confirm('Delete all notes?')) { sbNotes = []; SB.saveNotes(sbNotes); } }, '', !sbNotes.length)}</div>
    <div class="sblist">${[...sbNotes].reverse().map((x) => `<div class="sbnote"><small>T${x.turn} ${esc(x.phasing)} ${esc(x.phase)}${x.battle ? ' · battle' : ''} · ${esc(x.target.kind)} ${esc(x.target.label)}</small><p>${esc(x.text)}</p><div class="row">
      ${x.state ? ubtn('Back to this moment', () => { M.g = JSON.parse(x.state!); hist.clear(); save(); refresh(); }, '', false, 'Load the game as it was when the note was written') : ''}${ubtn(ico('trash'), () => { sbNotes = sbNotes.filter((y) => y.id !== x.id); SB.saveNotes(sbNotes); }, 'ico', false, 'Delete note')}</div></div>`).join('')}</div>`;
}
export function sandboxPanel() {
  const tabs = ['Pieces', 'Turn', 'Notes'], body = sbTab === 'Pieces' ? sbPieces() : sbTab === 'Notes' ? sbNotesHtml() : sbTurn();
  return `<div class="sbx">${sbHead()}<div class="tabs">${tabs.map((t) => `<button class="${t === sbTab ? 'on' : ''}" data-ui="${reg(() => { sbTab = t; })}">${t === 'Notes' ? `Notes (${sbNotes.length})` : t}</button>`).join('')}</div><div class="sbbody">${body}</div></div>`;
}
