/** The box artwork of each FAB volume: the owner's own cover illustrations (web/public/covers), one per volume. */
const ART: Record<string, { file: string; pos: string; spine: string }> = {
  bulge: { file: 'bulge', pos: '62% 70%', spine: '56% 50%' },               // the tank destroyer driving off the battle map
  sicily: { file: 'sicily', pos: '50% 62%', spine: '62% 50%' },             // the patrol in the ruined street
  golan73: { file: 'golan73', pos: '40% 64%', spine: '30% 50%' },           // the tank on the desert road, the burning wreck beside it
};
/** The cover picture of a volume, filling its panel (`spine`: the slice shown on a box's spine). */
export const coverArt = (id: string, spine = false) => { const a = ART[id] ?? ART.bulge; return `<img class="art" alt="" loading="lazy" decoding="async" src="./covers/${a.file}.webp" style="object-position:${spine ? a.spine : a.pos}">`; };

/** Box front and spine laid out like the series boxes: art panel on top with the title in heavy italic over it, the volume colour below with
 *  the series line and the designers, a slice of the art at one end of the spine. Artwork, type and the cycle mark are our own. */
type Box = { id: string; vol: string; name: string; tail?: string; design: string; bg: string; ink: string; title: string; titleTail?: string; tone: string; inset?: boolean };
export const BOXES: Box[] = [
  { id: 'bulge', vol: 'I', name: 'The Bulge', design: 'Rick Young', bg: '#0e0e0e', ink: '#f2f0e8', title: '#111', tone: 'none', inset: true },
  { id: 'sicily', vol: 'II', name: 'Sicily', design: 'Rick Young', bg: '#b3261e', ink: '#fff', title: '#c3241c', tone: 'none' },
  { id: 'golan73', vol: 'III', name: 'Golan', tail: "'73", design: 'Michael Gustavsson & Rick Young', bg: '#e9d3a8', ink: '#2a2420', title: '#c3241c', titleTail: '#23201c', tone: 'none' },
];
const mark = (c: string) => `<svg class="bxmark" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round"><path d="M8 20a12 12 0 0 1 20-9"/><path d="M32 20a12 12 0 0 1-20 9"/></g><path d="M25 5l6 6-8 2z M15 35l-6-6 8-2z" fill="${c}"/></svg>`;
const ttl = (b: Box) => `<b class="bxt" style="color:${b.title}">${b.name}${b.tail ? `<span style="color:${b.titleTail}">${b.tail}</span>` : ''}</b>`;
export function boxFront(b: Box) {
  return `<span class="bx ${b.inset ? 'inset' : ''}" style="--bg:${b.bg};--ink:${b.ink}"><span class="bxart" style="filter:${b.tone}">${coverArt(b.id)}</span>${ttl(b)}<span class="bxlow"><span class="bxser">${mark(b.ink)}<i>A Fast Action Battle Game</i></span><small>Game design</small><em>${b.design}</em><span class="bxfoot"><span>FAB · Volume ${b.vol}</span><span>Digital edition</span></span></span></span>`;
}
export function boxSpine(b: Box) {
  return `<span class="bxs" style="--bg:${b.bg};--ink:${b.ink}"><span class="bxsart" style="filter:${b.tone}">${coverArt(b.id, true)}</span>${ttl(b).replace('class="bxt" style="color:' + b.title, `class="bxt" style="color:${b.id === 'golan73' ? b.title : b.ink}`)}<span class="bxsv"><small>Volume ${b.vol}</small><i>Fast Action Battle Game</i></span>${mark(b.id === 'golan73' ? b.title : b.ink)}</span>`;
}
