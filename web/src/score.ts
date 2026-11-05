/** Victory points on screen: the strip under the top bar (turn track + VP gauge), the breakdown sheet and the end-of-game panel (docs/design/score-*.png).
 *  Works for any volume: the First Player is "ge" (left/up on the gauge), the Second "al"; names and tags come from the volume. */
import * as E from '../../engine/src';
import { esc } from './util';

const sides = (g: E.Game) => E.sidesOf(g);
const N = (s: E.Side) => E.VOLUME.sideName[s] ?? s, T = (s: E.Side) => E.VOLUME.tag[s] ?? s.slice(0, 2).toUpperCase();
const netText = (g: E.Game, n: number) => { const [p, q] = sides(g); return n > 0 ? `${N(p)} +${n}` : n < 0 ? `${N(q)} +${-n}` : 'even'; };
const track = (g: E.Game) => (g.track ?? E.VOLUME.track).slice(0, g.lastTurn);
/** Areas worth points to `s` that it holds, with whether they count (in supply). */
function objectives(g: E.Game, s: E.Side) {
  return [...E.areas.values()].map((a) => ({ a, pts: ((a.vp as Record<string, number | boolean>)[s] as number || 0) + (a.vp.mutual ? 1 : 0) }))
    .filter(({ a, pts }) => pts > 0 && g.control[a.id] === s).map(({ a, pts }) => ({ name: a.name, id: a.id, pts, ok: E.inSupply(g, s, a.id) }));
}
const objRows = (g: E.Game, s: E.Side) => objectives(g, s).map((o) => `<div class="vrow ${o.ok ? '' : 'cut'}"><span>${esc(o.name)} (${o.id})${o.ok ? '' : ' · cut off'}</span><b>+${o.pts}</b></div>`).join('') || '<p class="hint">None held.</p>';
/** Big units of the other side destroyed by `s` (+1 VP each). */
const kills = (g: E.Game, s: E.Side, face: (u: E.Unit) => string) => g.elimLarge.map((id) => g.units.find((u) => u.id === id)).filter((u): u is E.Unit => !!u && u.side !== s)
  .map((u) => `<span class="vkill" title="${esc(u.name)}">${face({ ...u, str: u.max })}</span>`).join('') || '<small class="hint">none yet</small>';
const pos = (n: number) => 50 + Math.max(-10, Math.min(10, n)) * 4.6;

/** The slim strip under the top bar; `open` is the handler key for tapping it. */
/* Cold Shoulder (P.7) is won on German-controlled Zone 6 areas, not on VP: the strip, sheet and end panel count areas (10 = draw sits in the middle of the gauge). */
const cold = (g: E.Game) => g.opts.scenario === 'cold';
const heldNames = (g: E.Game) => (g.inPlay ?? []).filter((a) => g.control[a] === 'german').map((a) => `<div class="vrow"><span>${esc(E.areas.get(a)!.name)} (${a})</span><b>GE</b></div>`).join('');
const coldText = (n: number) => (n >= 11 ? 'German victory' : n === 10 ? 'draw' : 'Allied victory');
function coldStrip(g: E.Game, open: string) {
  const n = E.coldAreas(g);
  return `<button class="vps" data-ui="${open}" title="Victory: German-controlled Zone 6 areas at the end of turn 9; tap for the details" aria-label="German Zone 6 areas ${n}, ${coldText(n)} now">
    <span class="vlab">AREAS</span><span class="vtt">${track(g).map((_, i) => `<span class="vtb ${i + 1 === g.turn ? 'now' : i + 1 < g.turn ? 'past' : ''}"><b>T${i + 1}</b><i class="no">${g.vpHist?.[i] ?? '–'}</i></span>`).join('')}</span>
    <span class="vlab al">AL ≤9</span>
    <span class="gauge"><span class="sd" style="left:${pos(0)}%"><span>10 = draw</span></span><span class="nd" style="left:${pos(n - 10)}%"></span></span>
    <span class="vlab ge">GE ${n}</span><span class="vlab net">${(n >= 11 ? 'German ahead' : n === 10 ? 'level' : 'Allied ahead').toUpperCase()}</span></button>`;
}
export function vpStrip(g: E.Game, open: string) {
  if (g.opts.scenario === 'intro') return '';                    // Nuts! is decided in Bastogne, not by VP
  if (cold(g)) return coldStrip(g, open);
  const [p, q] = sides(g), v = E.victory(g), sd = track(g)[g.turn - 1]?.sd;
  return `<button class="vps" data-ui="${open}" title="Victory points: tap for the details" aria-label="Victory points, net ${netText(g, v.net)}">
    <span class="vlab">VP</span><span class="vtt"${track(g).some((t) => t.sd) ? ` data-cap="SUDDEN DEATH ${T(p)}/${T(q)}"` : ''} title="Under each turn: the net VP that wins at once that turn, ${N(p)} / ${N(q)}">${track(g).map((t, i) => `<span class="vtb ${i + 1 === g.turn ? 'now' : i + 1 < g.turn ? 'past' : ''}"><b>T${i + 1}</b>${t.sd ? `<i aria-label="sudden death at ${N(p)} +${t.sd[0]} or ${N(q)} +${t.sd[1]}">${t.sd[0]}/${t.sd[1]}</i>` : '<i class="no">–</i>'}</span>`).join('')}</span>
    <span class="vlab al">${T(q)} ${v[q]}</span>
    <span class="gauge"><span class="z"></span>${sd ? `<span class="sd" style="left:${pos(-sd[1])}%"><span>${T(q)} wins ${sd[1]}</span></span><span class="sd" style="left:${pos(sd[0])}%"><span>${T(p)} wins ${sd[0]}</span></span>` : ''}<span class="nd" style="left:${pos(v.net)}%"></span></span>
    <span class="vlab ge">${T(p)} ${v[p]}</span><span class="vlab net ${v.net > 0 ? 'ge' : v.net < 0 ? 'al' : ''}">${netText(g, v.net).toUpperCase()}</span></button>`;
}

/** The scenario's victory table: The Bulge's own tables, the series 19.3 table for the other volumes. */
function victoryTable(g: E.Game): [string, string][] {
  if (E.VOLUME.id === 'bulge') return E.victoryTable(g);
  const [p, q] = sides(g);
  return [[`3+ ${N(p)} VP`, `${N(p)} Operational Victory`], [`1–2 ${N(p)} VP`, `${N(p)} Marginal Victory`], ['0', 'Draw'], [`1–2 ${N(q)} VP`, `${N(q)} Marginal Victory`], [`3+ ${N(q)} VP`, `${N(q)} Operational Victory`]];
}
function tableRows(g: E.Game, hit: string | null) { return `<div class="vtab">${victoryTable(g).map(([a, b]) => `<div class="${hit?.includes(b) ? 'on' : ''}">${esc(a)} = ${esc(b)}</div>`).join('')}</div>`; }
function columns(g: E.Game, face: (u: E.Unit) => string, v: Record<string, number>) {
  const [p, q] = sides(g);
  return `<div class="vcols"><div><h4 class="ge">${N(p)} · ${v[p]} VP</h4>${objRows(g, p)}<h4>${N(q)} big units destroyed (+1 each)</h4><div class="vkills">${kills(g, p, face)}</div></div>
    <div><h4 class="al">${N(q)} · ${v[q]} VP</h4>${objRows(g, q)}<h4>${N(p)} big units destroyed (+1 each)</h4><div class="vkills">${kills(g, q, face)}</div></div></div>`;
}

/** The breakdown sheet opened from the strip. */
export function vpSheet(g: E.Game, face: (u: E.Unit) => string, close: string, icoClose: string) {
  if (cold(g)) { const n = E.coldAreas(g);
    return `<div class="modal"><div class="sheet vsheet"><h3>Victory · turn ${g.turn} <button class="ico" data-ui="${close}" aria-label="Close">${icoClose}</button></h3>
    <div class="vtot"><span class="ge">${n}<small>GERMAN AREAS</small></span><i>/</i><span class="al">${(g.inPlay ?? []).length}<small>IN ZONE 6</small></span></div>
    <p class="vnote">Cold Shoulder (P.7): the Germans need <b>11</b> Zone 6 areas at the end of turn 9 to win; 10 is a draw. Now: <b>${coldText(n)}</b>. They started with 4.</p>
    <h4>Zone 6 areas the Germans control</h4>${heldNames(g) || '<p class="hint">None.</p>'}<h4>Victory table (end of turn ${g.lastTurn})</h4>${tableRows(g, null)}</div></div>`; }
  const [p, q] = sides(g), v = E.victory(g), sd = track(g)[g.turn - 1]?.sd;
  return `<div class="modal"><div class="sheet vsheet"><h3>Victory points · turn ${g.turn} <button class="ico" data-ui="${close}" aria-label="Close">${icoClose}</button></h3>
    <div class="vtot"><span class="al">${v[q]}<small>${N(q).toUpperCase()}</small></span><i>:</i><span class="ge">${v[p]}<small>${N(p).toUpperCase()}</small></span></div>
    <p class="vnote">Net <b>${netText(g, v.net)}</b> · ${sd ? `sudden death this turn at ${N(p)} +${sd[0]} or ${N(q)} +${sd[1]}` : 'no sudden death this turn'}. Areas count only when in supply (19.3).${g.opts.bridgeLimit ? ` German bridge repairs left: <b>${g.bridgesLeft ?? 6}</b> of 6 (18.1).` : ''}</p>
    ${columns(g, face, v)}<h4>Victory table (end of turn ${g.lastTurn})</h4>${tableRows(g, null)}</div></div>`;
}

/** The end-of-game panel; `actions` are already-rendered buttons. */
export function endPanel(g: E.Game, face: (u: E.Unit) => string, actions: string) {
  const [p, q] = sides(g), v = E.victory(g), hist = g.vpHist ?? [], lost = (s: E.Side) => g.elimLarge.filter((id) => g.units.find((u) => u.id === id)?.side === s).length;
  const sudden = /Sudden/i.test(g.over ?? ''), title = (g.over ?? '').replace(/^Sudden death victory: (\w+).*/, '$1 Sudden Death Victory');
  const W = innerWidth < 600 ? 360 : 720, H = innerWidth < 600 ? 140 : 120, n = Math.max(g.lastTurn, 2), x = (i: number) => 24 + (i * (W - 48)) / (n - 1), y = (net: number) => H / 2 - Math.max(-12, Math.min(12, net)) * 3.6;
  const hv = cold(g) ? hist.map((n) => (n == null ? n : n - 10)) : hist;
  const pts = hv.map((net, i) => (net == null ? '' : `${x(i).toFixed(0)},${y(net).toFixed(0)}`)).filter(Boolean).join(' ');
  const chart = `<svg class="vchart" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Net VP by turn"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#ffffff33"/>
    ${track(g).map((t, i) => (t.sd ? `<line x1="${x(i) - 10}" x2="${x(i) + 10}" y1="${y(t.sd[0])}" y2="${y(t.sd[0])}" stroke="#d1432f"/><line x1="${x(i) - 10}" x2="${x(i) + 10}" y1="${y(-t.sd[1])}" y2="${y(-t.sd[1])}" stroke="#d1432f"/>` : '')).join('')}
    ${pts ? `<polyline fill="none" stroke="#e7b04a" stroke-width="3" points="${pts}"/>` : ''}${hv.map((net, i) => (net == null ? '' : `<circle cx="${x(i)}" cy="${y(net)}" r="4" fill="#e7b04a"/>`)).join('')}
    ${track(g).map((_, i) => `<text x="${x(i)}" y="${H + 12}" fill="#999" font-size="10" text-anchor="middle">T${i + 1}</text>`).join('')}<text x="${W - 4}" y="12" fill="#d1432f" font-size="9" text-anchor="end">red: sudden death this turn</text><text x="4" y="12" fill="#c9ccd2" font-size="9">${cold(g) ? 'German 11+ ↑' : `${N(p)} ↑`}</text><text x="4" y="${H - 2}" fill="#b8d27a" font-size="9">${cold(g) ? 'Allied ≤9 ↓' : `${N(q)} ↓`}</text></svg>`;
  return `<div class="vend"><div class="vin"><div class="vban"><small>END OF GAME · ${sudden ? `SUDDEN DEATH, TURN ${g.turn}` : `TURN ${g.turn}`}</small><h1 class="${title.includes(N(p)) ? 'ge' : title.includes(N(q)) ? 'al' : ''}">${esc(title.toUpperCase())}</h1>
      <p>${cold(g) ? `The Germans control ${E.coldAreas(g)} of ${(g.inPlay ?? []).length} Zone 6 areas` : g.opts.scenario === 'intro' ? 'Nuts! is decided in Bastogne (24.3)' : `Final score: ${N(p)} ${v[p]}, ${N(q)} ${v[q]} · net ${netText(g, v.net)}`}</p></div>
    <div class="vcards"><div><small>Turns</small><b>${g.turn}</b></div><div><small>Battles</small><b>${g.battles ?? '–'}</b></div><div><small>Big units lost</small><b><span class="ge">${T(p)} ${lost(p)}</span> · <span class="al">${T(q)} ${lost(q)}</span></b></div></div>
    ${g.opts.scenario === 'intro' ? '' : cold(g) ? `<h4>German Zone 6 areas by turn</h4>${chart}<h4>Zone 6 areas the Germans control</h4>${heldNames(g)}` : `<h4>Net VP by turn</h4>${chart}${columns(g, face, v)}`}<h4>Victory table</h4>${tableRows(g, g.over ?? null)}
    <div class="vbtns">${actions}</div></div></div>`;
}
