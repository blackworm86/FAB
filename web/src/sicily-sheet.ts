// Dev page (sicily-sheet.html): every Sicily block (each strength), counter and back drawn by sicily-art.ts, for review against the printed sheets.
import units from '../../data/sicily/units.json';
import counters from '../../data/sicily/counters.json';
import backs from '../../data/sicily/counter_backs.json';
import {
  sicilyChitSvg,
  sicilyBlockSvg,
  sicilyBackSvg,
  restricted,
  sicilyControl,
  sicilyTrack,
  loadSicilyChitArt,
  SICILY_WOOD,
  type SCounter,
  type SUnit,
  type Nation,
} from './sicily-art';
import { loadChitArt } from './chits';

const svgUri = (s: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const U = units as unknown as (SUnit & { division?: string })[],
  C = counters as unknown as (SCounter & { restricts?: string[] })[];
/** A Restricted marker shows its division: the stripe and symbol of the blocks it restricts. */
const divOf = (c: SCounter & { restricts?: string[] }) => {
  const u = U.find((x) => c.restricts?.includes(x.id));
  return { stripe: u?.colours?.stripe ?? undefined, symbol: u?.symbol ?? 'inf', box: u?.colours?.box ?? undefined };
};
const chit = (c: SCounter & { restricts?: string[] }) =>
  c.kind === 'marker_restricted' ? restricted(c, false, divOf(c).stripe, divOf(c).symbol, divOf(c).box) : sicilyChitSvg(c);
const fig = (src: string, cap: string) => `<figure><img src="${svgUri(src)}" alt=""><figcaption>${cap}</figcaption></figure>`;

function sheets() {
  const blocks = (n: Nation | 'sa') =>
    U.filter((u) => (n === 'sa' ? u.kind === 'special_action_block' : u.nation === n && u.kind !== 'special_action_block'))
      .map((u) => `<figure class="blk"><img src="${svgUri(sicilyBlockSvg(u))}" alt=""><figcaption>${u.id} ${u.name}</figcaption></figure>`)
      .join('');
  const chits = (f: (c: SCounter) => boolean) =>
    C.filter(f)
      .map((c) => fig(chit(c), `${c.id} ${c.name}`))
      .join('');
  const released = C.filter((c) => c.kind === 'marker_restricted')
    .map((c) => fig(restricted(c, true, divOf(c).stripe, divOf(c).symbol, divOf(c).box), `${c.id} back: Released`))
    .join('');
  document.getElementById('sheets')!.innerHTML =
    `<h2>US blocks</h2><div class="g">${blocks('us')}</div><h2>British blocks</h2><div class="g">${blocks('british')}</div>
    <h2>German blocks</h2><div class="g">${blocks('german')}</div><h2>Italian blocks</h2><div class="g">${blocks('italian')}</div><h2>Special Action blocks</h2><div class="g">${blocks('sa')}</div>
    <h2>US counters</h2><div class="g">${chits((c) => c.nation === 'us' && !c.kind.startsWith('marker') && c.kind !== 'reserve_marker')}</div>
    <h2>British counters</h2><div class="g">${chits((c) => c.nation === 'british' && !c.kind.startsWith('marker') && c.kind !== 'reserve_marker')}</div>
    <h2>Allied (both armies)</h2><div class="g">${chits((c) => c.side === 'allied' && !c.nation)}</div>
    <h2>German counters</h2><div class="g">${chits((c) => c.nation === 'german')}</div><h2>Italian counters</h2><div class="g">${chits((c) => c.nation === 'italian' && c.kind !== 'reserve_marker')}</div>
    <h2>Markers</h2><div class="g">${chits((c) => c.kind.startsWith('marker') || c.kind === 'reserve_marker' || c.kind === 'field_works')}${fig(sicilyControl('axis'), 'Control (Axis)')}${fig(sicilyTrack('Game Turn', 'axis'), 'Game Turn (Axis)')}${fig(sicilyTrack('VPs', 'axis'), 'VPs (Axis)')}</div>
    <h2>Backs</h2><div class="g">${(backs as { id: string; name: string }[])
      .filter((b) => b.id !== 'back_released')
      .map((b) => fig(sicilyBackSvg(b.id), b.name))
      .join('')}${released}</div>`;
}
/** Every piece's SVG by id, for tools that capture the sheet (the review page). */
function dump() {
  (window as unknown as { __sicilyArt: unknown }).__sicilyArt = {
    blocks: Object.fromEntries(U.map((u) => [u.id, Array.from({ length: u.steps ?? 1 }, (_, i) => sicilyBlockSvg(u, (u.steps ?? 1) - i))])),
    chits: Object.fromEntries(C.map((c) => [c.id, chit(c)])),
    backs: Object.fromEntries((backs as { id: string }[]).map((b) => [b.id, sicilyBackSvg(b.id)])),
    wood: SICILY_WOOD,
  };
}
Promise.all([loadChitArt(), loadSicilyChitArt()]).then(() => {
  sheets();
  dump();
  document.body.dataset.ready = '1';
});
