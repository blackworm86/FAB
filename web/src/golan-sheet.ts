// Dev page (golan-sheet.html): the Golan '73 board with its printed labels, and every block, counter and back drawn by golan-art.ts.
import map from '../../data/golan73/map.json';
import labels from '../../data/golan73/labels.json';
import units from '../../data/golan73/units.json';
import counters from '../../data/golan73/counters.json';
import backs from '../../data/golan73/counter_backs.json';
import { drawLabel, drawEntry } from './board-art';
import { golanChitSvg, golanBlockSvg, golanBackSvg, loadGolanChitArt, GOLAN_WOOD, type GCounter, type GUnit } from './golan-art';
import { loadChitArt } from './chits';

const svgUri = (s: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(i); i.src = src; });
type Area = { id: number; name: string; tdn: number; vp: { mutual: boolean; syrian: number } };
const LAB = labels as Record<string, { mode: string; x: number; y: number; w: number; h: number }>;

async function board() {
  const [W, H] = map.size as number[], k = 1.5, cv = document.getElementById('board') as HTMLCanvasElement;
  cv.width = W * k; cv.height = H * k; const c = cv.getContext('2d')!;
  const [base, lines, syr, mut] = await Promise.all([load('./golan73/map-base.svg'), load('./golan73/map-lines.svg'), load('./icons/vp-golan-syrian.svg'), load('./icons/vp-mutual.svg')]);
  c.drawImage(base, 0, 0, cv.width, cv.height); c.drawImage(lines, 0, 0, cv.width, cv.height);
  c.scale(k, k);
  const layers = { numbers: true, tdn: true, vp: true, names: true }, icons = { syrian: syr, israeli: mut, mutual: mut };
  for (const a of map.areas as Area[]) {
    const L = LAB[a.id]; c.save(); c.translate(L.x, L.y);
    drawLabel(c, a, layers, icons, L, { tdn: a.tdn, name: a.name, vp: { syrian: a.vp.syrian, israeli: 0, mutual: a.vp.mutual } }); c.restore();
  }
  for (const e of map.entries as { letter: string; x: number; y: number }[]) { c.save(); c.translate(e.x, e.y); drawEntry(c, { letter: e.letter }, true); c.restore(); }
}
function sheets() {
  const fig = (src: string, cap: string, cls = '') => `<figure class="${cls}"><img src="${svgUri(src)}" alt=""><figcaption>${cap}</figcaption></figure>`;
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const blocks = (side: 'israeli' | 'syrian') => (units as GUnit[]).filter((u) => u.side === side).map((u) => `<figure class="blk"><img src="${svgUri(golanBlockSvg(u))}" alt=""><figcaption>${u.id} ${u.name}</figcaption></figure>`).join('');
  const chits = (side: string) => (counters as GCounter[]).filter((c) => c.side === side).map((c) => fig(golanChitSvg(c), `${c.id} ${c.name}`)).join('');
  const extra = [fig(golanChitSvg({ id: 'M06s', kind: 'marker_control', side: 'syrian', name: 'Control' }), 'M06 Control (Syria)')].join('');
  document.getElementById('sheets')!.innerHTML = `<h2>Israeli blocks</h2><div class="g">${blocks('israeli')}</div><h2>Syrian blocks</h2><div class="g">${blocks('syrian')}</div>
    <h2>Israeli counters</h2><div class="g">${chits('israeli')}</div><h2>Syrian counters</h2><div class="g">${chits('syrian')}</div>
    <h2>Markers</h2><div class="g">${chits('none')}${extra}</div><h2>Backs</h2><div class="g">${(backs as { id: string; name: string }[]).map((b) => fig(golanBackSvg(b.id), b.name)).join('')}</div>`;
}
/** Every piece's SVG by id, for tools that capture the sheet (the review page). */
function dump() {
  (window as unknown as { __golanArt: unknown }).__golanArt = {
    blocks: Object.fromEntries((units as GUnit[]).map((u) => [u.id, Array.from({ length: u.steps ?? 1 }, (_, i) => golanBlockSvg(u, (u.steps ?? 1) - i))])),
    chits: Object.fromEntries((counters as GCounter[]).map((c) => [c.id, golanChitSvg(c)])), backs: Object.fromEntries((backs as { id: string }[]).map((b) => [b.id, golanBackSvg(b.id)])),
    wood: GOLAN_WOOD,
  };
}
Promise.all([loadChitArt(), loadGolanChitArt()]).then(() => { sheets(); dump(); return board(); }).then(() => { document.body.dataset.ready = '1'; });
