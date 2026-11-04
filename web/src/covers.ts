/** Our own box artwork for each FAB volume, in a flat, blocky style (no publisher art is used). */
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const n1 = (v: number) => v.toFixed(1);
/** A soldier seen from behind or side, walking: helmet, pack, legs apart, rifle. */
function soldier(x: number, y: number, h: number, c: string, step = 1) {
  const k = h / 40, P = (dx: number, dy: number) => `${n1(x + dx * k)} ${n1(y + dy * k)}`;
  return `<g fill="${c}"><path d="M${P(-4, -40)} L${P(4, -40)} L${P(6, -36)} L${P(-6, -36)}Z"/><path d="M${P(-3, -36)} L${P(3, -36)} L${P(3, -33)} L${P(-3, -33)}Z"/>`
    + `<path d="M${P(-6, -33)} L${P(6, -33)} L${P(7, -18)} L${P(-6, -18)}Z"/><path d="M${P(-5, -18)} L${P(0, -18)} L${P(-4 - 3 * step, 0)} L${P(-8 - 3 * step, 0)}Z"/><path d="M${P(0, -18)} L${P(6, -18)} L${P(7 + 3 * step, 0)} L${P(3 + 3 * step, 0)}Z"/>`
    + `<path d="M${P(-4, -24)} L${P(9, -36)} L${P(10.5, -34.5)} L${P(-2.5, -22.5)}Z"/></g>`;
}
/** A tank, three-quarter view, flat facets: hull, tracks, turret, gun; crew heads optional. */
function tank(x: number, y: number, s: number, c: [string, string, string], dir = 1, crew = 0) {
  const P = (dx: number, dy: number) => `${n1(x + dx * s * dir)} ${n1(y + dy * s)}`;
  let t = `<g><path d="M${P(-46, -4)} L${P(40, -4)} L${P(48, 8)} L${P(-40, 10)}Z" fill="${c[2]}"/>`
    + `<path d="M${P(-44, -16)} L${P(36, -18)} L${P(44, -4)} L${P(-46, -4)}Z" fill="${c[1]}"/><path d="M${P(-44, -16)} L${P(-30, -24)} L${P(30, -26)} L${P(36, -18)}Z" fill="${c[0]}"/>`
    + `<path d="M${P(-18, -24)} L${P(14, -26)} L${P(18, -36)} L${P(-12, -40)} L${P(-20, -32)}Z" fill="${c[1]}"/><path d="M${P(-12, -40)} L${P(18, -36)} L${P(16, -40)} L${P(-8, -43)}Z" fill="${c[0]}"/>`
    + `<path d="M${P(14, -33)} L${P(62, -38)} L${P(62, -35)} L${P(15, -30)}Z" fill="${c[2]}"/>`;
  for (let i = 0; i < 6; i++) t += `<circle cx="${n1(x + (-36 + i * 14) * s * dir)}" cy="${n1(y + 3 * s)}" r="${n1(4 * s)}" fill="${c[0]}" opacity=".5"/>`;
  for (let i = 0; i < crew; i++) t += `<path d="M${P(-6 + i * 9, -43)} L${P(-1 + i * 9, -43)} L${P(0 + i * 9, -50)} L${P(-3.5 + i * 9, -53)} L${P(-7 + i * 9, -50)}Z" fill="${c[2]}"/>`;
  return t + '</g>';
}
const bulge = (() => {
  const r = rng(11); let a = `<svg class="art" aria-hidden="true" viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice"><rect width="300" height="240" fill="#e9eae6"/>`;
  // a battle map behind: contour lines, roads, a town, unit boxes and red attack arrows
  for (let i = 0; i < 9; i++) { const y0 = 18 + i * 13; a += `<path d="M-10 ${y0} C 60 ${y0 - 10 + r() * 20}, 140 ${y0 + r() * 22 - 8}, 310 ${y0 - 6 + r() * 14}" fill="none" stroke="#c9ccc4" stroke-width="1.2"/>`; }
  a += `<path d="M20 40 L120 92 L190 70 L290 112" fill="none" stroke="#9aa09a" stroke-width="2.4"/><path d="M150 0 L172 60 L160 130" fill="none" stroke="#9aa09a" stroke-width="2"/><path d="M168 58 l14 -4 l6 10 l-12 6z" fill="#6f746f"/>`;
  for (const [x, y] of [[60, 52], [228, 62], [110, 118], [252, 96]]) a += `<rect x="${x}" y="${y}" width="14" height="10" fill="#fff" stroke="#55606a" stroke-width="1.2"/><path d="M${x} ${y} l14 10 M${x + 14} ${y} l-14 10" stroke="#55606a" stroke-width="1"/>`;
  a += `<g fill="none" stroke="#c0392b" stroke-width="2.4" stroke-linecap="round"><path d="M270 30 Q232 44 214 70"/><path d="M96 26 Q118 52 128 84"/></g><path d="M208 64 l10 -1 l-3 11z M124 78 l9 2 l-6 8z" fill="#c0392b"/>`;
  // snow field, a road, pines, the tank driving out of the map
  a += `<path d="M0 150 Q80 128 160 142 T300 134 L300 240 L0 240Z" fill="#cfd2cf"/><path d="M110 240 L150 150 L176 150 L250 240Z" fill="#8f938f"/><path d="M118 240 L154 156 L170 156 L236 240Z" fill="#a9ada9"/>`;
  for (let i = 0; i < 26; i++) { const x = r() * 300, y = 140 + r() * 26, h = 14 + r() * 16; if (x > 118 && x < 220) continue; a += `<path d="M${n1(x)} ${n1(y - h)} L${n1(x - h * .32)} ${n1(y)} L${n1(x + h * .32)} ${n1(y)}Z" fill="#3c423e"/><path d="M${n1(x)} ${n1(y - h)} L${n1(x - h * .12)} ${n1(y - h * .6)} L${n1(x + h * .12)} ${n1(y - h * .6)}Z" fill="#f2f3f0"/>`; }
  a += tank(178, 206, 1.25, ['#7b807c', '#5a5f5b', '#2f3330'], 1, 2) + `<path d="M120 222 Q170 214 250 226 L250 240 L110 240Z" fill="#dfe1de" opacity=".7"/>`;
  return a + '</svg>';
})();
const sicily = (() => {
  const r = rng(5); let a = `<svg class="art" aria-hidden="true" viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="sky-s" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fbf4ea"/><stop offset=".6" stop-color="#e3d2bd"/><stop offset="1" stop-color="#b59b80"/></radialGradient></defs><rect width="300" height="240" fill="url(#sky-s)"/>`;
  // a street between ruined stone houses, seen down its length: haze at the far end
  a += `<path d="M0 0 L112 70 L112 190 L0 240Z" fill="#6b5a4c"/><path d="M0 0 L60 37 L60 213 L0 240Z" fill="#544538"/><path d="M300 0 L188 64 L188 190 L300 240Z" fill="#7a6858"/><path d="M300 0 L246 31 L246 214 L300 240Z" fill="#5e4e41"/>`;
  for (let i = 0; i < 4; i++) { const x = 70 + i * 10, y = 70 + i * 6; a += `<path d="M${x} ${y + 14} l6 3 l0 18 l-6 -3z" fill="#2e251e" opacity=".8"/>`; }
  for (let i = 0; i < 4; i++) { const x = 224 - i * 9, y = 56 + i * 6; a += `<path d="M${x} ${y + 12} l-6 3 l0 22 l6 -3z" fill="#2e251e" opacity=".8"/>`; }
  a += `<path d="M252 70 l30 -14 l0 70 l-30 10z" fill="#3a2f26"/>`;       // a shuttered shop front
  for (let i = 0; i < 9; i++) a += `<path d="M254 ${74 + i * 7} l26 -12" stroke="#5e4e41" stroke-width="1.6"/>`;
  a += `<path d="M14 40 l26 16 l-4 6 l-26 -15z M120 40 l-8 30" stroke="#2e251e" stroke-width="2" fill="#2e251e"/><path d="M28 54 q-2 30 4 60" stroke="#2e251e" stroke-width="1.8" fill="none"/>`;
  a += `<path d="M112 190 L188 190 L300 240 L0 240Z" fill="#c9b49c"/>`;
  for (let i = 0; i < 40; i++) { const x = 20 + r() * 260, y = 196 + r() * 40, w = 4 + r() * 12; a += `<path d="M${n1(x)} ${n1(y)} l${n1(w)} ${n1(-r() * 4)} l${n1(r() * 3)} ${n1(4 + r() * 3)} l${n1(-w)} 0z" fill="${['#8a7663', '#a6927d', '#6e5e4f'][i % 3]}"/>`; }
  a += `<path d="M112 120 Q150 104 188 118 L188 192 L112 192Z" fill="#f4ece0" opacity=".55"/>`;   // dust and smoke in the street
  for (const [x, y, h, st] of [[138, 170, 20, 1], [158, 172, 22, -1], [128, 182, 30, -1], [172, 186, 34, 1], [104, 206, 46, 1], [196, 214, 56, -1], [150, 228, 64, 1]] as const) a += soldier(x, y, h, '#2a221c', st);
  return a + '</svg>';
})();
const golan = (() => {
  const r = rng(9); let a = `<svg class="art" aria-hidden="true" viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb8c9"/><stop offset="1" stop-color="#e9e2d2"/></linearGradient></defs><rect width="300" height="240" fill="url(#sky-g)"/>`;
  a += `<path d="M0 110 L60 104 L130 108 L220 100 L300 106 L300 240 L0 240Z" fill="#b8956a"/><path d="M0 126 Q150 112 300 130 L300 240 L0 240Z" fill="#a5814f"/>`;
  a += `<path d="M150 112 L170 112 L300 210 L300 240 L60 240Z" fill="#cfb187"/><path d="M156 116 L166 116 L250 240 L120 240Z" fill="#dcc29c"/>`;          // the dirt road
  for (let i = 0; i < 70; i++) { const x = r() * 300, y = 118 + r() * 120, w = 2 + r() * 7; a += `<path d="M${n1(x)} ${n1(y)} l${n1(w)} ${n1(-r() * 2)} l1 2 l${n1(-w)} 1z" fill="${['#7d5e3a', '#8f6f47', '#6a4e30'][i % 3]}"/>`; }
  // a burnt-out wreck at the roadside with black smoke
  a += `<path d="M206 150 l60 -6 l18 14 l-70 8z" fill="#2a2420"/><path d="M220 146 l26 -14 l8 4 l-24 14z" fill="#3a322c"/><path d="M236 132 l22 -26 l3 2 l-20 26z" fill="#2a2420"/>`;
  for (let i = 0; i < 9; i++) { const x = 228 + i * 6 + r() * 8, y = 128 - i * 12, rr = 10 + i * 3; a += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${rr}" fill="#2b2b2b" opacity="${(0.75 - i * 0.07).toFixed(2)}"/>`; }
  a += `<path d="M232 152 l6 -10 l5 8 l4 -12 l5 14z" fill="#e8742a"/>`;
  a += tank(104, 176, 1.15, ['#d6b886', '#b8955f', '#6f5534'], 1, 2) + `<path d="M40 186 Q100 176 170 188 L170 196 L40 196Z" fill="#e2cfa8" opacity=".55"/>`;
  return a + '</svg>';
})();
const ART: Record<string, string> = { bulge, sicily, golan73: golan };
let uid = 0;
/** Each copy gets its own gradient ids: a copy inside a hidden element would otherwise lend its (unrendered) gradients to the visible ones. */
export const coverArt = (id: string) => { const n = ++uid; return (ART[id] ?? ART.bulge).replace(/sky-(\w)\b/g, `sky-$1-${n}`); };

/** Box front and spine laid out like the series boxes: art panel on top with the title in heavy italic over it, the volume colour below with
 *  the series line and the designers, a slice of the art at one end of the spine. Artwork, type and the cycle mark are our own. */
type Box = { id: string; vol: string; name: string; tail?: string; design: string; bg: string; ink: string; title: string; titleTail?: string; tone: string; inset?: boolean };
export const BOXES: Box[] = [
  { id: 'bulge', vol: 'I', name: 'The Bulge', design: 'Rick Young', bg: '#0e0e0e', ink: '#f2f0e8', title: '#111', tone: 'grayscale(1) contrast(1.05)', inset: true },
  { id: 'sicily', vol: 'II', name: 'Sicily', design: 'Rick Young', bg: '#b3261e', ink: '#fff', title: '#c3241c', tone: 'sepia(.25)' },
  { id: 'golan73', vol: 'III', name: 'Golan', tail: "'73", design: 'Michael Gustavsson & Rick Young', bg: '#e9d3a8', ink: '#2a2420', title: '#c3241c', titleTail: '#23201c', tone: 'none' },
];
const mark = (c: string) => `<svg class="bxmark" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round"><path d="M8 20a12 12 0 0 1 20-9"/><path d="M32 20a12 12 0 0 1-20 9"/></g><path d="M25 5l6 6-8 2z M15 35l-6-6 8-2z" fill="${c}"/></svg>`;
const ttl = (b: Box) => `<b class="bxt" style="color:${b.title}">${b.name}${b.tail ? `<span style="color:${b.titleTail}">${b.tail}</span>` : ''}</b>`;
export function boxFront(b: Box) {
  return `<span class="bx ${b.inset ? 'inset' : ''}" style="--bg:${b.bg};--ink:${b.ink}"><span class="bxart" style="filter:${b.tone}">${coverArt(b.id)}</span>${ttl(b)}<span class="bxlow"><span class="bxser">${mark(b.ink)}<i>A Fast Action Battle Game</i></span><small>Game design</small><em>${b.design}</em><span class="bxfoot"><span>FAB · Volume ${b.vol}</span><span>Digital edition</span></span></span></span>`;
}
export function boxSpine(b: Box) {
  return `<span class="bxs" style="--bg:${b.bg};--ink:${b.ink}"><span class="bxsart" style="filter:${b.tone}">${coverArt(b.id)}</span>${ttl(b).replace('class="bxt" style="color:' + b.title, `class="bxt" style="color:${b.id === 'golan73' ? b.title : b.ink}`)}<span class="bxsv"><small>Volume ${b.vol}</small><i>Fast Action Battle Game</i></span>${mark(b.id === 'golan73' ? b.title : b.ink)}</span>`;
}
