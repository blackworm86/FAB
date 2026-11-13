/** The map legend of each printed board, redrawn: the same boundary types, terrain shapes and symbols, in the same colours as the board's own line work
 *  (web/scripts/import_map.py, tools/golan73/board.py, tools/sicily/board.py). It opens from a small chip at the edge of the map. */

type Row = [string, string];
const W = 46,
  H = 18;
const sw = (inner: string, bg = '#d9d6c3') =>
  `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><rect width="${W}" height="${H}" rx="2" fill="${bg}"/>${inner}</svg>`;
const ln = (stroke: string, w: number, extra = '') => `<path d="M3 9H43" fill="none" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
const wave = (stroke: string, w: number, extra = '') =>
  `<path d="M3 11C10 4 15 15 23 8S36 4 43 10" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const tufts = (col: string) =>
  `${ln('#4f4a42', 2)}${Array.from({ length: 9 }, (_, i) => `<path d="M${5 + i * 4.5} 8V3M${5 + i * 4.5} 10V15" stroke="${col}" stroke-width=".9"/>`).join('')}`;
/** The four TDN shapes as the app draws them on each area (board-art.ts). */
const TDN: Row[] = [
  [
    `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><circle cx="15" cy="15" r="12" fill="#f4e3a4" stroke="#8a7a3a" stroke-width="1.6"/><text x="15" y="20" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="13" fill="#1a1608">0</text></svg>`,
    'TDN 0: open ground',
  ],
  [
    `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><rect x="3" y="4" width="24" height="22" rx="3" fill="#c9a24f" stroke="#6b5420" stroke-width="1.6"/><text x="15" y="20" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="13" fill="#1a1608">1</text></svg>`,
    'TDN 1: −1 to fire into it',
  ],
  [
    `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><path d="M2 15L8 4H22L28 15L22 26H8Z" fill="#8a8f86" stroke="#2d3330" stroke-width="1.6"/><text x="15" y="20" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="13" fill="#111">2</text></svg>`,
    'TDN 2: −2',
  ],
  [
    `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><path d="M2 4H28L15 27Z" fill="#4a5028" stroke="#1d2110" stroke-width="1.6"/><text x="15" y="16" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="12" fill="#fff">3</text></svg>`,
    'TDN 3: −3',
  ],
];

const LEGEND: Record<string, { title: string; rows: Row[] }> = {
  bulge: {
    title: 'The Bulge',
    rows: [
      [sw(ln('#fbfbf6', 2.8), '#b9bfa8'), 'Open boundary'],
      [sw(`${ln('#6d706c', 7, 'stroke-dasharray="6 4"')}${ln('#fbfbf6', 2.6)}`, '#b9bfa8'), 'Army boundary'],
      [sw(`${wave('#ffffff', 4.2)}${wave('#1c78c0', 2.2)}`, '#b9bfa8'), 'River boundary'],
      [sw(`${ln('#e4e6d8', 4)}${ln('#585b56', 2.4)}`, '#b9bfa8'), 'Primary road'],
      [sw(tufts('#4a3a24'), '#b9bfa8'), 'Restricted boundary (Schnee Eifel)'],
      [sw(`${ln('#c2287f', 3)}`, '#b9bfa8'), 'German border'],
      [sw(`<circle cx="23" cy="9" r="5" fill="#f6f4ec" stroke="#575b5b" stroke-width="1.6"/>`, '#b9bfa8'), 'Town'],
      [
        sw(
          `<rect x="12" y="3" width="22" height="12" fill="#aeb2b4" stroke="#5a5f62"/><path d="M14 15L24 3M20 15L30 3" stroke="#6c7175"/>`,
          '#b9bfa8',
        ),
        'City',
      ],
      [sw(`<rect x="3" y="3" width="40" height="12" fill="#2f9a52"/>`, '#bccad3'), 'Allied entry area'],
      [sw(`<rect x="3" y="3" width="40" height="12" fill="#9fb0b8"/>`, '#bccad3'), 'German entry area'],
    ],
  },
  golan73: {
    title: "Golan '73",
    rows: [
      [sw(ln('#5e5a52', 3)), 'Open boundary'],
      [sw(`${ln('#8d8a82', 5)}${ln('#dedbd0', 2.4)}`), 'Primary road'],
      [sw(`${wave('#4f8fc4', 5)}${wave('#9ccbee', 2.6)}`), 'River boundary'],
      [sw(`${wave('#a08868', 6, 'stroke-opacity=".55"')}${wave('#4f4a42', 2.8)}`), 'Wadi boundary'],
      [sw(`${wave('#b08a5c', 12, 'stroke-opacity=".45"')}${wave('#1d1d1b', 2.8)}`), 'Escarpment boundary'],
      [sw(`${ln('#7a6a52', 10, 'stroke-dasharray="1.2 2.6"')}${ln('#4f4a42', 3)}`), 'Rugged boundary'],
      [sw(`${ln('#5f4630', 9)}${ln('#9a7650', 5)}`), 'Anti-tank ditch boundary'],
      [sw(ln('#8e4f9f', 2.2, 'stroke-dasharray="6 4"')), 'Purple Line'],
      [sw(`${ln('#5e5a52', 4.5)}${ln('#ffffff', 1.6, 'stroke-dasharray="4 3"')}`), 'Sector boundary'],
      [sw(`${ln('#eef4f6', 6)}${ln('#2a72c0', 3, 'stroke-dasharray="5 4"')}`), 'Syrian SAM barrier'],
      [sw(`<path d="M17 3H29L23 15Z" fill="#91a763" stroke="#5f7a3c"/>`), 'Syrian entry area'],
      [
        sw(
          `<circle cx="23" cy="9" r="6" fill="#fbfbf6"/><path d="M23 3A6 6 0 0 0 23 15Z" fill="#1d5fa8"/><circle cx="23" cy="9" r="6" fill="none" stroke="#1d5fa8" stroke-width="1.4"/>`,
        ),
        'Israeli supply source',
      ],
    ],
  },
  sicily: {
    title: 'Sicily',
    rows: [
      [sw(ln('#2a86c2', 3), '#88c1dc'), 'Coast'],
      [sw(ln('#626262', 3.6)), 'Open boundary'],
      [sw(`${ln('#5a5a5a', 6)}${ln('#ffffff', 1.8, 'stroke-dasharray="6 5"')}`), 'Army boundary (zones A–D)'],
      [sw(`${wave('#2f7fb5', 5)}${wave('#6cc4ec', 2.8)}`), 'River'],
      [sw(`${ln('#8e8e8e', 4.4)}${ln('#d6d5d2', 2.2)}`), 'Primary road'],
      [sw(tufts('#4b3b2a')), 'Restricted terrain (Mount Etna)'],
      [
        sw(
          `<circle cx="23" cy="9" r="7" fill="#1e6fc0" stroke="#fff" stroke-width="1.2"/><path d="M23 5V13M20 8H26M19 11A4 4 0 0 0 27 11" fill="none" stroke="#fff" stroke-width="1.3"/>`,
        ),
        'Port',
      ],
      [
        sw(
          `<circle cx="23" cy="9" r="7" fill="#e7cf5a" stroke="#4a463c"/><path d="M23 4V14M18 9H28" stroke="#4a463c" stroke-width="1.6"/>`,
        ),
        'Airfield',
      ],
      [
        sw(
          `<rect x="8" y="2" width="30" height="14" rx="2" fill="#c9def0" stroke="#fff"/><rect x="8" y="11" width="30" height="5" fill="#2a7fc8"/>`,
          '#88c1dc',
        ),
        'Landing box (beachhead)',
      ],
    ],
  },
};

export const hasLegend = (game: string) => !!LEGEND[game];
/** The legend card, as the print lays it out: the line types, the symbols, then the TDN shapes. */
const swatch = (bg: string, border = '#0006') =>
  `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><rect x="3" y="6" width="24" height="18" rx="3" fill="${bg}" stroke="${border}" stroke-width="1.6"/></svg>`;
/** The colours the game paints over the printed map (one meaning each). */
const GAME: Row[] = [
  [swatch('#c8e86a'), 'Your block can move there'],
  [swatch('#e7b04a'), 'Stop there, or selected'],
  [swatch('#d1432f'), 'A battle: must fight (filled) or may fight (outline)'],
  [
    `<svg viewBox="0 0 30 30" width="22" height="22" aria-hidden="true"><rect x="3" y="6" width="24" height="18" rx="3" fill="#d8d4c0" stroke="#0006" stroke-width="1.6"/><path d="M6 24L18 6M13 24L25 6M20 24L27 13.5" stroke="#23251a" stroke-width="3"/></svg>`,
    'Out of supply (stripes)',
  ],
  [
    '<b class="ar" style="color:#c8e86a">━▶</b>',
    'Move route: lime = move, brass = uses fuel, silver = minimum move, ivory = strategic, ╳ = blown bridge',
  ],
];
/** pieces: the markers on and above the pieces, drawn by the caller with the very art the map uses. */
export function legendCard(game: string, close: string, pieces: Row[] = []) {
  const L = LEGEND[game];
  if (!L) return '';
  const row = ([pic, label]: Row) => `<li>${pic}<span>${label}</span></li>`;
  return `<div class="maplegend" role="dialog" aria-label="Map legend: ${L.title}"><div class="mlhead"><b>Map legend</b><small>${L.title}</small>${close}</div>
    <ul class="mlrows">${L.rows.map(row).join('')}</ul><b class="mlsub">Terrain defence (TDN)</b><ul class="mlrows tdn">${TDN.map(row).join('')}</ul><b class="mlsub">The game's own colours</b><ul class="mlrows">${GAME.map(row).join('')}</ul>${pieces.length ? `<b class="mlsub">Markers on the pieces</b><ul class="mlrows">${pieces.map(row).join('')}</ul>` : ''}</div>`;
}
