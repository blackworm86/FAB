/** The admin sandbox's screen: tools panel, piece library, notes, hotseat cover. Moved out of main.ts; main hands over its state and helpers once (initSandboxUi). */
import * as E from '../../engine/src';
import * as SB from './sandbox';
import { ico } from './icons';
import { esc, nm } from './util';
import { RULE, ruleHtml } from './rules-text';
import { online, setDevSeat, SANDBOX, type DevSeat } from './online';
import type { History } from './history';

/** What the sandbox needs from main: the game and selection (read and written), and the shared screen helpers. */
export interface SbCtx {
  g: E.Game; selUnit: string | null; selChit: string | null; selArr: string | null; selArea: number | null; previewArea: number | null; rollView: unknown;
  ABBR: Record<string, string>; actorNow: () => E.Side | 'both'; areaName: (a: number) => string; b3: (face: string, side: E.Side | 'british', chit?: boolean) => string;
  chitImg: (c: E.Chit) => string; unitFace: (u: E.Unit) => string; hist: History<E.Game>; refresh: () => void; render: () => void; save: () => void; say: (t: string) => void;
  reg: (f: () => void) => string; regv: (f: (v: string) => void) => string; ubtn: (label: string, f: () => void, cls?: string, dis?: boolean, title?: string) => string;
}
let M: SbCtx; let ABBR: SbCtx['ABBR'], actorNow: SbCtx['actorNow'], areaName: SbCtx['areaName'], b3: SbCtx['b3'], chitImg: SbCtx['chitImg'], unitFace: SbCtx['unitFace'], hist: SbCtx['hist'], refresh: SbCtx['refresh'], render: SbCtx['render'], save: SbCtx['save'], say: SbCtx['say'], reg: SbCtx['reg'], regv: SbCtx['regv'], ubtn: SbCtx['ubtn'];
export function initSandboxUi(ctx: SbCtx) { M = ctx; ({ ABBR, actorNow, areaName, b3, chitImg, unitFace, hist, refresh, render, save, say, reg, regv, ubtn } = ctx); sbJump = { turn: M.g.turn, side: M.g.phasing, phase: M.g.phase }; }
const other = E.other;
const $ = (q: string) => document.querySelector(q) as HTMLElement;
/* admin sandbox (?sandbox=1): free edits, seat switch, notes and the test report ---------- */
export const st = { sbHot: (() => { try { return localStorage.getItem('fab-hotseat') === '1'; } catch { return false; } })(), hotCover: null as E.Side | null, sbOpen: true, sbPlace: null as string | null, sbAuto: false, sbFilter: '', sbDraft: '' };
let sbTab = 'Pieces';
let sbJump: { turn: number; side: E.Side; phase: E.Phase };
let sbNotes = SB.loadNotes();
/** A sandbox edit: no turn or seat checks, no automatic phase skipping, still undoable. */
export function sbx(f: () => void) { const r = hist.run(M.g, f); M.g = r.game; if (r.error) say(r.error.message); save(); refresh(); }
const sbtn = (label: string, f: () => void, cls = '', title = '') => ubtn(label, () => sbx(f), cls, false, title);
const sbSel = (opts: [string, string][], cur: string, f: (v: string) => void) => `<select data-sel="${regv((v) => { f(v); render(); })}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const sbChk = (label: string, on: boolean, f: (v: boolean) => void) => `<label class="sbchk"><input type="checkbox" ${on ? 'checked' : ''} data-sel="${regv((v) => sbx(() => f(v === 'on')))}"> ${esc(label)}</label>`;
const SEATS: [DevSeat, string][] = [['both', 'Both'], ['german', 'German'], ['allied', 'Allied'], ['watch', 'Watch']];
/** Hotseat: one screen, two players. The seat follows whoever has to act; between players a cover hides the hidden blocks until the next player taps. */
export function hotWant(): E.Side | null {
  if (!SANDBOX || !st.sbHot || M.g.over) return null;
  const a = actorNow(), cur = online.mySide(); if (a !== 'both') return a;
  const b = M.g.battle;
  if (b?.stage === 'setup') return cur && b.ready?.includes(cur) && !b.ready.includes(other(cur)) ? other(cur) : cur ?? M.g.phasing;
  if (cur && cur !== M.g.phasing && M.g.done?.includes(cur)) return M.g.phasing;                       // the other side said Done: back to the Phasing Player
  return cur ?? M.g.phasing;
}
export function hotseatSync() { if (M.rollView) return; const w = hotWant(); if (w && w !== online.mySide() && !st.hotCover) { st.hotCover = w; M.selUnit = M.selChit = M.selArr = null; M.previewArea = null; } }
export const hotPass = (to: E.Side) => { st.hotCover = to; M.selUnit = M.selChit = M.selArr = null; M.previewArea = null; render(); };
export function hotCoverHtml() {
  if (!st.hotCover) return '';
  return `<div class="hotcover"><div><small>Hotseat</small><h2 class="${st.hotCover}">${nm(st.hotCover)} player</h2><p>Pass the device. The other side's hidden blocks are covered until you tap.</p><button class="primary" data-ui="${reg(() => { setDevSeat(st.hotCover!); st.hotCover = null; refresh(); })}">${ico('next')} I am the ${nm(st.hotCover)} player</button></div></div>`;
}
function sbReset(opts: Partial<E.Opts>) {
  if (!confirm('Reset the sandbox and start a new game from the first turn?')) return;
  M.g = E.newGame(undefined, { fuel: true, ...opts }); hist.clear(); st.sbPlace = null; M.selUnit = M.selChit = M.selArr = null; M.selArea = null; M.previewArea = null; M.rollView = null;
  if (st.sbHot) { setDevSeat(M.g.phasing); st.hotCover = M.g.phasing; }
  save(); refresh();
}
export function sandboxBtns() {
  return ubtn(`${ico('wand')}<span class="bl">Sandbox</span>`, () => { st.sbOpen = !st.sbOpen; }, 'ico ' + (st.sbOpen ? 'on' : ''), false, 'Sandbox tools') + ubtn(`${ico('undo')}<span class="bl">Reset</span>`, () => sbReset({ scenario: M.g.opts.scenario }), 'ico', false, 'Reset: a new game from the first turn (same scenario)');
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
  return `<h4>Jump to</h4><div class="row">${sbSel(turns, String(sbJump.turn), (v) => { sbJump.turn = +v; })}${sbSel([['german', 'German'], ['allied', 'Allied']], sbJump.side, (v) => { sbJump.side = v as E.Side; })}</div>
    <div class="row">${sbSel(SB.PHASES, sbJump.phase, (v) => { sbJump.phase = v as E.Phase; })}${sbtn(`${ico('next')} Go`, () => SB.jump(M.g, sbJump.turn, sbJump.side, sbJump.phase), 'primary', 'Start of that phase: battles, moves and per-phase marks cleared')}</div>
    <p class="hint">Now: turn ${M.g.turn}, ${nm(M.g.phasing)}, ${esc(SB.PHASES.find((x) => x[0] === M.g.phase)?.[1] ?? M.g.phase)}${M.g.battle ? `, battle in ${esc(areaName(M.g.battle.area))} (${M.g.battle.stage})` : ''}.</p>
    <h4>Hotseat</h4><label class="sbchk"><input type="checkbox" ${st.sbHot ? 'checked' : ''} data-sel="${regv((v) => { st.sbHot = v === 'on'; try { localStorage.setItem('fab-hotseat', st.sbHot ? '1' : '0'); } catch { /* private mode */ } if (st.sbHot) { st.sbAuto = true; st.hotCover = hotWant() ?? M.g.phasing; } render(); })}"> Two players on this screen: the seat follows whoever acts, with a cover between players</label>
    <h4>Seat</h4><div class="chips">${SEATS.map(([k, l]) => ubtn(l, () => { setDevSeat(k); M.selUnit = M.selChit = M.selArr = null; M.previewArea = null; refresh(); }, online.devSeat === k ? 'on' : '')).join('')}</div>
    <label class="sbchk"><input type="checkbox" ${st.sbAuto ? 'checked' : ''} data-sel="${regv((v) => { st.sbAuto = v === 'on'; render(); })}"> Skip empty phases like a real game</label>
    <h4>Dice</h4><div class="row authform"><input id="sb-dice" class="grow" placeholder="Next results, e.g. 1 1 9" aria-label="Next die results">${sbtn('Queue', () => { const v = (($('#sb-dice') as HTMLInputElement)?.value ?? '').split(/[^0-9]+/).filter(Boolean).map(Number).map((x) => (x === 0 ? 10 : x)).filter((x) => x >= 1 && x <= 10); M.g.force = [...(M.g.force ?? []), ...v]; })}</div>
    <p class="hint">${M.g.force?.length ? `Queued: <b>${M.g.force.join(' ')}</b> ${sbtn('Clear', () => { M.g.force = []; })}` : 'No dice queued: rolls come from the seed.'}</p>
    <h4>Table</h4><div class="row">${sbtn(`${ico('trash')} Clear map`, () => SB.clearMap(M.g), '', 'Every block off the map')}${ubtn(`${ico('undo')} Reset: Nuts!`, () => sbReset({ scenario: 'intro' }))}${ubtn(`${ico('undo')} Reset: 5-turn game`, () => sbReset({ scenario: 'tournament' }))}${ubtn(`${ico('undo')} Reset: campaign`, () => sbReset({ scenario: 'campaign' }))}</div>`;
}
/* The piece library: every block and chit with its printed art, a search box and filters. */
let lbSide: 'all' | E.Side = 'all', lbType = 'all', lbWhere = 'all';
const chitType = (c: E.Chit) => (E.isAsset(c) ? 'assets' : 'events');
const whereOfU = (u: E.Unit) => (u.area != null ? 'map' : u.str <= 0 || M.g.elimLarge.includes(u.id) ? 'eliminated' : 'off');
const WHERE: [string, string][] = [['all', 'Anywhere'], ['map', 'On the map'], ['off', 'Off the map'], ['available', 'Available'], ['cup', 'Cup'], ['used', 'Used'], ['future', 'Future'], ['eliminated', 'Eliminated']];
const fchip = (label: string, on: boolean, f: () => void) => ubtn(label, f, on ? 'on' : '');
function sbLibrary() {
  const blocks = lbType === 'all' || lbType === 'blocks', chitsOn = lbType !== 'blocks';
  const us = blocks ? M.g.units.filter((u) => (lbSide === 'all' || u.side === lbSide) && (lbWhere === 'all' || whereOfU(u) === lbWhere)) : [];
  const cs = chitsOn ? M.g.chits.filter((c) => (lbSide === 'all' || c.side === lbSide) && (lbType === 'all' || chitType(c) === lbType) && (lbWhere === 'all' || c.box === lbWhere || (lbWhere === 'off' && c.box !== 'map'))) : [];
  const tile = (key: string, img: string, name: string, sub: string, on: boolean, f: () => void, cls: string, wood = false) => `<button class="lbt ${cls} ${on ? 'on' : ''}" data-k="${esc(key.toLowerCase())}" data-ui="${reg(f)}" title="${esc(name)}">${wood ? b3(img, cls as E.Side) : `<img alt="" src="${img}">`}<small>${esc(name)}</small><i>${esc(sub)}</i></button>`;
  const tiles = [...us.sort((a, b) => a.name.localeCompare(b.name)).map((u) => tile(`${u.name} ${u.code ?? ''} ${u.id} ${u.side} ${u.cls} block unit ${u.q.join(' ')}`, unitFace(u), u.name, u.area != null ? areaName(u.area) : whereOfU(u) === 'eliminated' ? 'eliminated' : u.arrival ? `turn ${u.arrival}` : 'off map', M.selUnit === u.id, () => { M.selUnit = u.id; M.selChit = null; M.selArea = u.area ?? M.selArea; refresh(); }, u.side, !u.garrison)),
    ...cs.map((c) => tile(`${c.name} ${c.kind} ${c.id} ${c.side} ${ABBR[c.kind] ?? ''} chit`, chitImg(c), c.name, `${c.box}${c.turn != null && c.box === 'future' ? ' t' + c.turn : ''}`, M.selChit === c.id, () => { M.selChit = c.id; M.selUnit = null; refresh(); }, c.side, c.kind === 'sa_block'))];
  return `<div class="authform lbsearch"><input id="lb-q" class="grow" placeholder="Search: name, unit, kind (e.g. Peiper, artillery, 116)" value="${esc(st.sbFilter)}" aria-label="Search pieces"></div>
    <div class="chips lbf">${(['all', 'german', 'allied'] as const).map((s) => fchip(s === 'all' ? 'Both sides' : nm(s), lbSide === s, () => { lbSide = s; })).join('')}</div>
    <div class="chips lbf">${[['all', 'All'], ['blocks', 'Blocks'], ['assets', 'Assets'], ['events', 'Events']].map(([k, l]) => fchip(l, lbType === k, () => { lbType = k; })).join('')}</div>
    <div class="chips lbf">${WHERE.map(([k, l]) => fchip(l, lbWhere === k, () => { lbWhere = k; })).join('')}</div>
    <div class="lbgrid">${tiles.join('') || '<p class="hint">Nothing matches.</p>'}</div>`;
}
/** What is selected, large, with its edits. */
function sbDetail() {
  const u = M.selUnit ? M.g.units.find((x) => x.id === M.selUnit) : null, c = !u && M.selChit ? M.g.chits.find((x) => x.id === M.selChit) : null;
  if (u) {
    const res: [string, string][] = [['', 'No reserve'], ...(u.side === 'german' ? ['z5', 'z6', 'z7'] : ['z56', 'z7']).map((z) => [z, `Reserve ${z.slice(1)}`] as [string, string])];
    return `<div class="lbd"><img alt="" src="${unitFace(u)}"><div><b>${esc(u.name)}</b><small>${nm(u.side)} ${u.cls} · ${esc(u.q.join('/'))} · ${u.area != null ? esc(areaName(u.area)) : 'off the map'}</small>
      <div class="row">${sbtn(ico('minus'), () => { u.str = Math.max(1, u.str - 1); }, 'ico', 'One step less')}<b>${u.str}/${u.max}</b>${sbtn(ico('plus'), () => { u.str = Math.min(u.max, u.str + 1); }, 'ico', 'One step more')}
      ${ubtn(`${ico('next')} ${u.area != null ? 'Move' : 'Place'}`, () => { st.sbPlace = u.id; }, 'primary', false, 'Then tap an area')}${u.area != null ? sbtn(ico('trash'), () => SB.lift(M.g, u.id), 'ico', 'Take off the map') : ''}${ubtn(ico('close'), () => { M.selUnit = null; refresh(); }, 'ico', false, 'Deselect')}</div></div></div>
      <div class="row">${sbSel([['0', 'Good order'], ['1', 'Disordered'], ['2', 'Recovering']], String(u.disorder), (v) => sbx(() => { u.disorder = +v as 0 | 1 | 2; }))}${sbSel(res, u.reserve ?? '', (v) => sbx(() => { u.reserve = v || null; }))}</div>
      <div class="row">${sbChk('Out of supply', u.unsupplied, (v) => { u.unsupplied = v; })}${sbChk('Moved', u.moved, (v) => { u.moved = v; })}${sbChk('Exploitation', u.exploit, (v) => { u.exploit = v; })}${sbChk('Face-up', u.up != null && u.up === u.area, (v) => { u.up = v && u.area != null ? u.area : undefined; })}</div>`;
  }
  if (c) {
    const [t, d] = RULE[c.kind] ?? [c.kind, ''];
    return `<div class="lbd"><img alt="" src="${chitImg(c)}"><div><b>${esc(c.name)}</b><small>${nm(c.side)} · ${esc(t)} · now: ${c.box}</small>
      <div class="chips">${SB.BOXES.filter((b) => b !== 'map' || c.box === 'map').map((b) => b === c.box ? `<button class="on" disabled>${b}</button>` : sbtn(b, () => { c.box = b; })).join('')}${ubtn(ico('close'), () => { M.selChit = null; refresh(); }, 'ico', false, 'Deselect')}</div></div></div>${d ? `<div class="hint">${ruleHtml(c.kind, E.isEvent(c))}</div>` : ''}`;
  }
  if (M.selArea != null) {
    const a = M.selArea;
    return `<div class="lbd area"><div><b>${esc(areaName(a))} (${a})</b><div class="row">${sbSel([['', 'Nobody holds it'], ['german', 'German control'], ['allied', 'Allied control']], M.g.control[a] ?? '', (v) => sbx(() => { if (v) M.g.control[a] = v as E.Side; else delete M.g.control[a]; }))}
      ${E.contested(M.g, a) && !M.g.battle ? sbtn(`${ico('burst')} Battle here`, () => { E.startBattle(M.g, a); }, 'primary') : ''}${ubtn(ico('close'), () => { M.selArea = null; refresh(); }, 'ico', false, 'Deselect')}</div>
      <div class="row">${sbChk('Field works', M.g.fieldWorks.includes(a), (v) => { M.g.fieldWorks = M.g.fieldWorks.filter((x) => x !== a); if (v) { M.g.fieldWorks.push(a); M.g.fwOwner[a] = M.g.control[a] ?? 'allied'; } })}${sbChk('River assault', M.g.riverAssault.includes(a), (v) => { M.g.riverAssault = M.g.riverAssault.filter((x) => x !== a); if (v) M.g.riverAssault.push(a); })}</div>
      <div class="lbrow">${E.unitsIn(M.g, a).map((x) => `<button class="lbt ${x.side}" data-u="${esc(x.id)}" title="${esc(x.name)}"><img alt="" src="${unitFace(x)}"><small>${esc(x.name)}</small></button>`).join('')}</div></div></div>`;
  }
  return '<p class="hint">Tap a piece below or a block or area on the map.</p>';
}
function sbPieces() {
  const u = st.sbPlace ? M.g.units.find((x) => x.id === st.sbPlace) : null;
  return `${u ? `<p class="hint sbgo"><b>Tap an area on the map to place ${esc(u.name)}.</b> ${ubtn('Cancel', () => { st.sbPlace = null; })}</p>` : ''}${sbDetail()}${sbLibrary()}`;
}
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
  const tabs = ['Turn', 'Pieces', 'Notes'], body = sbTab === 'Pieces' ? sbPieces() : sbTab === 'Notes' ? sbNotesHtml() : sbTurn();
  return `<div class="sbx"><div class="tabs">${tabs.map((t) => `<button class="${t === sbTab ? 'on' : ''}" data-ui="${reg(() => { sbTab = t; })}">${t === 'Notes' ? `Notes (${sbNotes.length})` : t}</button>`).join('')}${ubtn(ico('close'), () => { st.sbOpen = false; }, 'ico', false, 'Hide the sandbox tools')}</div>${body}</div>`;
}
