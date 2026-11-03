/** Victory points on screen: the strip under the top bar (turn track + VP gauge), the breakdown sheet and the end-of-game panel (docs/design/score-*.png). */
import * as E from '../../engine/src';
import { esc } from './util';

const netText = (n: number) => (n > 0 ? `German +${n}` : n < 0 ? `Allied +${-n}` : 'even');
const track = (g: E.Game) => (g.track ?? E.TRACK).slice(0, g.lastTurn);
/** Areas worth points to `s` that it holds, with whether they count (in supply). */
function objectives(g: E.Game, s: E.Side) {
  return [...E.areas.values()].map((a) => ({ a, pts: (s === 'allied' ? a.vp.allied : a.vp.german) + (a.vp.mutual ? 1 : 0) }))
    .filter(({ a, pts }) => pts > 0 && g.control[a.id] === s).map(({ a, pts }) => ({ name: a.name, id: a.id, pts, ok: E.inSupply(g, s, a.id) }));
}
const objRows = (g: E.Game, s: E.Side) => objectives(g, s).map((o) => `<div class="vrow ${o.ok ? '' : 'cut'}"><span>${esc(o.name)} (${o.id})${o.ok ? '' : ' · cut off'}</span><b>+${o.pts}</b></div>`).join('') || '<p class="hint">None held.</p>';
/** Big units of the other side destroyed by `s` (+1 VP each). */
const kills = (g: E.Game, s: E.Side, face: (u: E.Unit) => string) => g.elimLarge.map((id) => g.units.find((u) => u.id === id)).filter((u): u is E.Unit => !!u && u.side !== s)
  .map((u) => `<span class="vkill" title="${esc(u.name)}">${face({ ...u, str: u.max })}</span>`).join('') || '<small class="hint">none yet</small>';
const pos = (n: number) => 50 + Math.max(-10, Math.min(10, n)) * 4.6;

/** The slim strip under the top bar; `open` is the handler key for tapping it. */
export function vpStrip(g: E.Game, open: string) {
  if (g.opts.scenario === 'intro') return '';                    // Nuts! is decided in Bastogne, not by VP
  const v = E.victory(g), sd = track(g)[g.turn - 1]?.sd;
  return `<button class="vps" data-ui="${open}" title="Victory points: tap for the details" aria-label="Victory points, net ${netText(v.net)}">
    <span class="vlab">VP</span><span class="vtt">${track(g).map((t, i) => `<span class="vtb ${i + 1 === g.turn ? 'now' : i + 1 < g.turn ? 'past' : ''}"><b>T${i + 1}</b>${t.sd ? `<i>${t.sd[0]}/${t.sd[1]}</i>` : '<i class="no">–</i>'}</span>`).join('')}</span>
    <span class="vlab al">AL ${v.allied}</span>
    <span class="gauge"><span class="z"></span>${sd ? `<span class="sd" style="left:${pos(-sd[1])}%"><span>AL wins ${sd[1]}</span></span><span class="sd" style="left:${pos(sd[0])}%"><span>GE wins ${sd[0]}</span></span>` : ''}<span class="nd" style="left:${pos(v.net)}%"></span></span>
    <span class="vlab ge">GE ${v.german}</span><span class="vlab net">${netText(v.net).toUpperCase()}</span></button>`;
}

function tableRows(g: E.Game, hit: string | null) { return `<div class="vtab">${E.victoryTable(g).map(([a, b]) => `<div class="${hit?.includes(b) ? 'on' : ''}">${esc(a)} = ${esc(b)}</div>`).join('')}</div>`; }
function columns(g: E.Game, face: (u: E.Unit) => string, v: { german: number; allied: number }) {
  return `<div class="vcols"><div><h4 class="ge">German · ${v.german} VP</h4>${objRows(g, 'german')}<h4>Allied big units destroyed (+1 each)</h4><div class="vkills">${kills(g, 'german', face)}</div></div>
    <div><h4 class="al">Allied · ${v.allied} VP</h4>${objRows(g, 'allied')}<h4>German big units destroyed (+1 each)</h4><div class="vkills">${kills(g, 'allied', face)}</div></div></div>`;
}

/** The breakdown sheet opened from the strip. */
export function vpSheet(g: E.Game, face: (u: E.Unit) => string, close: string, icoClose: string) {
  const v = E.victory(g), sd = track(g)[g.turn - 1]?.sd;
  return `<div class="modal"><div class="sheet vsheet"><h3>Victory points · turn ${g.turn} <button class="ico" data-ui="${close}" aria-label="Close">${icoClose}</button></h3>
    <div class="vtot"><span class="al">${v.allied}<small>ALLIED</small></span><i>:</i><span class="ge">${v.german}<small>GERMAN</small></span></div>
    <p class="vnote">Net <b>${netText(v.net)}</b> · ${sd ? `sudden death this turn at German +${sd[0]} or Allied +${sd[1]}` : 'no sudden death this turn'}. Areas count only when in supply (19.3).</p>
    ${columns(g, face, v)}<h4>Victory table (end of turn ${g.lastTurn})</h4>${tableRows(g, null)}</div></div>`;
}

/** The end-of-game panel; `actions` are already-rendered buttons. */
export function endPanel(g: E.Game, face: (u: E.Unit) => string, actions: string) {
  const v = E.victory(g), hist = g.vpHist ?? [], lost = (s: E.Side) => g.elimLarge.filter((id) => g.units.find((u) => u.id === id)?.side === s).length;
  const sudden = /Sudden/.test(g.over ?? ''), title = (g.over ?? '').replace(/^Sudden death victory: (\w+).*/, '$1 Sudden Death Victory');
  const W = innerWidth < 600 ? 360 : 720, H = innerWidth < 600 ? 140 : 120, n = Math.max(g.lastTurn, 2), x = (i: number) => 24 + (i * (W - 48)) / (n - 1), y = (net: number) => H / 2 - Math.max(-12, Math.min(12, net)) * 3.6;
  const pts = hist.map((net, i) => (net == null ? '' : `${x(i).toFixed(0)},${y(net).toFixed(0)}`)).filter(Boolean).join(' ');
  const chart = `<svg class="vchart" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Net VP by turn"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#ffffff33"/>
    ${track(g).map((t, i) => (t.sd ? `<line x1="${x(i) - 10}" x2="${x(i) + 10}" y1="${y(t.sd[0])}" y2="${y(t.sd[0])}" stroke="#d1432f"/><line x1="${x(i) - 10}" x2="${x(i) + 10}" y1="${y(-t.sd[1])}" y2="${y(-t.sd[1])}" stroke="#d1432f"/>` : '')).join('')}
    ${pts ? `<polyline fill="none" stroke="#e7b04a" stroke-width="3" points="${pts}"/>` : ''}${hist.map((net, i) => (net == null ? '' : `<circle cx="${x(i)}" cy="${y(net)}" r="4" fill="#e7b04a"/>`)).join('')}
    ${track(g).map((_, i) => `<text x="${x(i)}" y="${H + 12}" fill="#999" font-size="10" text-anchor="middle">T${i + 1}</text>`).join('')}<text x="4" y="12" fill="#c9ccd2" font-size="9">German ↑</text><text x="4" y="${H - 2}" fill="#b8d27a" font-size="9">Allied ↓</text></svg>`;
  return `<div class="vend"><div class="vin"><div class="vban"><small>END OF GAME · ${sudden ? `SUDDEN DEATH, TURN ${g.turn}` : `TURN ${g.turn}`}</small><h1>${esc(title.toUpperCase())}</h1>
      <p>Final score: German ${v.german}, Allied ${v.allied} · net ${netText(v.net)}</p></div>
    <div class="vcards"><div><small>Turns</small><b>${g.turn}</b></div><div><small>Battles</small><b>${g.battles ?? '–'}</b></div><div><small>Big units lost</small><b><span class="ge">${lost('german')}</span> / <span class="al">${lost('allied')}</span></b></div></div>
    ${g.opts.scenario === 'intro' ? '' : `<h4>Net VP by turn</h4>${chart}${columns(g, face, v)}`}<h4>Victory table</h4>${tableRows(g, g.over ?? null)}
    <div class="vbtns">${actions}</div></div></div>`;
}
