// Dev page (review-art.html): every block face, counter and back of all three games, rasterised for the review tool (scratch build, not in the app).
import * as E from '../../engine/src';
import bulgeCounters from '../../data/bulge/counters.json';
import bulgeBacks from '../../data/bulge/counter_backs.json';
import gUnits from '../../data/golan73/units.json';
import gCounters from '../../data/golan73/counters.json';
import gBacks from '../../data/golan73/counter_backs.json';
import sUnits from '../../data/sicily/units.json';
import sCounters from '../../data/sicily/counters.json';
import sBacks from '../../data/sicily/counter_backs.json';
import { labelSvg } from './art';
import { chitSvg, loadChitArt, saBlockSvg, type Counter } from './chits';
import { golanChitSvg, golanBlockSvg, golanBackSvg, loadGolanChitArt, type GCounter, type GUnit } from './golan-art';
import { sicilyChitSvg, sicilyBlockSvg, sicilyBackSvg, restricted, loadSicilyChitArt, type SCounter, type SUnit } from './sicily-art';

const raster = (svg: string, px = 176) =>
  new Promise<string | null>((ok) => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d')!.drawImage(i, 0, 0, px, px);
      ok(c.toDataURL('image/webp', 0.86));
    };
    i.onerror = () => ok(null);
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
type Art = { blocks: Record<string, string[]>; chits: Record<string, string>; backs: Record<string, string> };
async function pack(blocks: [string, string[]][], chits: [string, string][], backs: [string, string][]): Promise<Art> {
  const r: Art = { blocks: {}, chits: {}, backs: {} };
  for (const [id, fs] of blocks) r.blocks[id] = (await Promise.all(fs.map((s) => raster(s)))).filter(Boolean) as string[];
  for (const [id, s] of chits) {
    const x = await raster(s);
    if (x) r.chits[id] = x;
  }
  for (const [id, s] of backs) {
    const x = await raster(s);
    if (x) r.backs[id] = x;
  }
  return r;
}
const faces = (n: number, f: (s: number) => string) => Array.from({ length: n }, (_, i) => f(n - i));
const bSide = (e: string): Counter['side'] => (e.startsWith('de_') || e === 'german' ? 'german' : 'allied');

async function bulge() {
  E.useGame('bulge');
  const g = E.newGame(1, { scenario: 'campaign', fuel: true });
  const blocks = g.units.filter((u) => !u.garrison).map((u): [string, string[]] => [u.id, faces(u.max, (s) => labelSvg({ ...u, str: s }))]);
  blocks.push(['SA-german', [saBlockSvg('german')]], ['SA-allied', [saBlockSvg('allied')]]);
  const chits = (
    bulgeCounters as { id: string; kind: string; name: string; echelon: string; turn?: number | 'S' | null; quality?: string | null }[]
  ).map((c): [string, string] => [
    c.id,
    chitSvg({
      id: c.id,
      kind: c.kind,
      name: c.name,
      side: bSide(c.echelon),
      ech: c.echelon,
      turn: c.turn ?? null,
      q: c.quality ?? null,
    } as Counter),
  ]);
  const backs = (bulgeBacks as { id: string; name: string }[]).map((b): [string, string] => [
    b.id,
    chitSvg({ id: b.id, kind: 'back', name: b.name, side: 'none', ech: 'none' } as Counter),
  ]);
  return pack(blocks, chits, backs);
}
async function golan() {
  const U = gUnits as unknown as GUnit[];
  return pack(
    U.map((u) => [u.id, faces(u.steps ?? 1, (s) => golanBlockSvg(u, s))]),
    (gCounters as unknown as GCounter[]).map((c) => [c.id, golanChitSvg(c)]),
    (gBacks as { id: string }[]).map((b) => [b.id, golanBackSvg(b.id)]),
  );
}
async function sicily() {
  const U = sUnits as unknown as (SUnit & { division?: string })[],
    C = sCounters as unknown as (SCounter & { restricts?: string[] })[];
  const div = (c: { restricts?: string[] }) => U.find((x) => c.restricts?.includes(x.id));
  const chit = (c: SCounter & { restricts?: string[] }) => {
    const u = div(c);
    return c.kind === 'marker_restricted'
      ? restricted(c, false, u?.colours?.stripe ?? undefined, u?.symbol ?? 'inf', u?.colours?.box ?? undefined)
      : sicilyChitSvg(c);
  };
  const own = C.filter((c) => c.kind === 'marker_restricted').map((c): [string, string] => {
    const u = div(c);
    return [`${c.id}:back`, restricted(c, true, u?.colours?.stripe ?? undefined, u?.symbol ?? 'inf', u?.colours?.box ?? undefined)];
  }); // each Restricted marker's own Released side
  return pack(
    U.map((u) => [u.id, faces(u.steps ?? 1, (s) => sicilyBlockSvg(u, s))]),
    C.map((c) => [c.id, chit(c)]),
    [...(sBacks as { id: string }[]).map((b): [string, string] => [b.id, sicilyBackSvg(b.id)]), ...own],
  );
}
Promise.all([loadChitArt(), loadGolanChitArt(), loadSicilyChitArt()]).then(async () => {
  (window as unknown as { __art: unknown }).__art = { bulge: await bulge(), golan73: await golan(), sicily: await sicily() };
  document.body.dataset.ready = '1';
});
