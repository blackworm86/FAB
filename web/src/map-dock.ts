// The Map button and its list (layers, labels, legend), the legend's key to the markers on the pieces, and Rotate.
import * as E from '../../engine/src';
import * as SBU from './sandbox-ui';
import { SANDBOX } from './online';
import { ico } from './icons';
import { PIP } from './block-kit';
import { reg } from './ui-kit';
import { hasLegend, legendCard } from './map-legend';
import { VOL } from './page';
import { g, selArea, selChit, selUnit, setHoverArea, setPreviewArea, setSelArea, setSelChit, setSelUnit } from './game-state';
import { labelMode, setLabelMode, setTint, supplySide, tint } from './map-paint';
import { setYaw, yaw } from './camera';
import { selArr, setSelArr } from './flow';
import { setGoal } from './map-input';
import { syncAreaTags } from './map-marks';
import { anims } from './rolls';
import { svgUri } from './unit-card';
import { frameSide, lastInput, legend, refresh, relayer, setLastInput } from './main';

/** A block drawn as a real 3D object (front label, right and top faces), for the tray and the battle view. */
export const unitFace = (u: E.Unit) => svgUri(VOL.unitSvg(u, g));
export const b3 = (face: string, side: E.Side | 'british', chit = false) =>
  `<span class="b3 ${side} ${chit ? 'flat' : ''}" aria-hidden="true"><i class="f"><img alt="" draggable="false" src="${face}"></i><i class="r"></i><i class="t"></i></span>`;
export const sideOfUnit = (u: E.Unit) => VOL.cssSide(u);
/** The printed map's legend, redrawn (map-legend.ts): a chip at the map's top-left corner opens it. */
export let legendOpen = false,
  legendShownAt = 0;
export const setLegendShownAt = <T extends typeof legendShownAt>(v: T): T => ((legendShownAt = v), v);
export const setLegendOpen = <T extends typeof legendOpen>(v: T): T => ((legendOpen = v), v);
function mapLegend() {
  if (!hasLegend(VOL.id)) return '';
  const close = `<button class="ico" aria-label="Close the legend" data-ui="${reg(() => {
    legendOpen = false;
  })}">${ico('close')}</button>`;
  if (g.battle) return ''; // the battle bar takes the top of the map
  return legendOpen
    ? legendCard(VOL.id, close, pieceKey())
    : `<button class="mlchip" aria-expanded="false" aria-label="Map legend" data-ui="${reg(() => {
        legendOpen = true;
        legendShownAt = performance.now();
      })}">${ico('info')}<span>Legend</span></button>`;
}
/** The legend's "Markers on the pieces", drawn with the same art and colours the map uses (VOL.markSvg, tag(), PIP), so the key cannot drift from the board. */
function pieceKey(): [string, string][] {
  const img = (code: string, bg: string) => {
    const svg = VOL.markSvg(code);
    return svg
      ? `<img alt="" width="22" height="22" src="${svgUri(svg)}">`
      : `<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" fill="${bg}" stroke="#fff" stroke-width="1.4"/><text x="11" y="15" text-anchor="middle" font-size="${code.length > 2 ? 7 : 9}" font-weight="700" fill="#fff" font-family="Arial Narrow, Arial, sans-serif">${code}</text></svg>`;
  };
  const dot = (q: string, x: number) => {
    const [f, s2] = PIP[q];
    return `<circle cx="${x}" cy="11" r="4" fill="${f}" stroke="${s2 === f ? '#141414' : s2}" stroke-width="1.2"/>`;
  };
  const sides = VOL.sides,
    res = [...new Set(sides.map((sd) => VOL.reserveTag({ side: sd, reserve: null } as unknown as E.Unit)))];
  const rows: [string, string][] = [
    [
      `<svg viewBox="0 0 34 22" width="34" height="22" aria-hidden="true">${dot('elite', 6)}${dot('veteran', 17)}${dot('green', 28)}</svg>`,
      'Pips: one per step the unit still has; the colour is the quality of that step: red elite, black veteran, white green',
    ],
    [
      '<svg viewBox="0 0 26 22" width="26" height="22" aria-hidden="true"><circle cx="13" cy="11" r="8" fill="none" stroke="#c8e86a" stroke-width="2.6"/><circle cx="13" cy="11" r="10.4" fill="none" stroke="#c8e86a66" stroke-width="1.6"/></svg>',
      'Lime halo: can still move, build field works or go into reserve this step (Skip in its card sets it aside)',
    ],
    [
      '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="#e7b04a"/><circle cx="11" cy="11" r="4.3" fill="none" stroke="#1a1608" stroke-width="2.2"/><path d="M11 3.5v3M11 15.5v3M3.5 11h3M15.5 11h3" stroke="#1a1608" stroke-width="2.2" stroke-linecap="round"/></svg>',
      'Gold target: the point unit of the battle',
    ],
    [img('DIS', '#8a1f1f'), 'Disordered'],
    [img('REC', '#a8741a'), 'Recovering from disorder'],
    [img('OOS', '#b8312f'), 'Out of supply'],
    [res.map((r) => img(r, '#2d6cb0')).join(''), `Reserve marker${res.length > 1 ? 's' : ''}`],
    [img('E', '#d9741c'), 'Exploitation (may move in Breakthrough)'],
    [img('RA', '#2a7fb8'), 'River assault'],
    ...(VOL.id === 'bulge'
      ? ([
          [img('GI', '#8a2f9c'), 'Greif team interdiction'],
          [img('B', '#8a6a1c'), 'Boundary crossing (left its army zone)'],
        ] as [string, string][])
      : []),
  ];
  return rows;
}
/** The map's own corner: the printed-map legend, the colour layer switch (one tap, no window) and the active layer's key right under it. */
/** A quarter turn of the board, eased (phones have no right-drag to turn it). */
function rotateQuarter() {
  const y0 = yaw;
  setGoal(null);
  anims.push({
    t0: performance.now(),
    dur: 450,
    fn: (k) => {
      setYaw(y0 + (Math.PI / 2) * (1 - (1 - k) * (1 - k)));
      setLastInput(performance.now());
    },
  });
}
/** One button for the area tags: on → see-through → off, kept on this device. */
const LABEL_NAME = { on: 'On', tr: 'See-through', off: 'Off' };
function labelsBtn() {
  // inside the Map list: the three settings side by side
  const set = (m: typeof labelMode) => {
    setLabelMode(m);
    try {
      localStorage.setItem('fab-labels', m);
    } catch {
      /* private mode */
    }
    syncAreaTags();
  };
  return `<div class="laysw labsw" role="group" aria-label="Area labels"><b>Labels</b>${(['on', 'tr', 'off'] as const).map((m) => `<button aria-pressed="${labelMode === m}" title="Area labels: ${LABEL_NAME[m]}" data-ui="${reg(() => set(m))}">${ico('tag')}<span class="l">${LABEL_NAME[m]}</span><span class="s">${{ on: 'On', tr: 'Dim', off: 'Off' }[m]}</span></button>`).join('')}</div>`;
}
export let mapMenu = false; // phones: the layers, legend and rotate fold into one Map button
export const setMapMenu = <T extends typeof mapMenu>(v: T): T => ((mapMenu = v), v);
export function mapDock() {
  if (g.battle) return ''; // the battle bar takes the top of the map
  if (legendOpen && SANDBOX && SBU.st.sbOpen && innerWidth < 700) {
    if (legendShownAt < SBU.st.sbOpenedAt) legendOpen = false;
    else SBU.closeSb();
  } // phones: the legend and the sandbox sheet never stack; the newer one wins
  if (legendOpen && hasLegend(VOL.id)) return mapLegend();
  type Opt = [typeof tint, string, string, string, string]; // layer, label, short label (phone), icon, what it shows
  const opts: Opt[] = [
    ['off', 'None', 'None', 'close', 'No colour on the map'],
    ['tdn', 'TDN', 'TDN', 'tree', 'Terrain defence'],
    ...(VOL.features.zones ? [['zones', 'Zones', 'Zones', 'layers', 'Army zones'] as Opt] : []),
    ['control', 'Control', 'Ctrl', 'flag', 'Who holds each area'],
    ['supply', 'Supply', 'Supply', 'fuel', 'Supply: which areas trace supply'],
  ];
  const sw = opts
    .map(
      ([v, label, short, icon, title]) =>
        `<button aria-pressed="${tint === v}" title="${title}" aria-label="${title}" data-ui="${reg(() => {
          setTint(v);
          mapMenu = false;
          relayer();
          if (v === 'supply') frameSide(supplySide());
        })}">${ico(icon)}<span class="l">${label}</span><span class="s">${short}</span></button>`,
    )
    .join('');
  const sel = selUnit || selArr || selChit || selArea != null;
  const tools = `<div class="maptools"><button aria-label="Rotate the map a quarter turn" title="Rotate the map" data-ui="${reg(rotateQuarter)}">${ico('rotate')}</button>${
    sel
      ? `<button aria-label="Deselect" title="Deselect" data-ui="${reg(() => {
          setSelUnit(setSelArr(setSelChit(null)));
          setSelArea(null);
          setPreviewArea(null);
          setHoverArea(null);
          refresh();
        })}">${ico('deselect')}<span>Deselect</span></button>`
      : ''
  }</div>`;
  const cur = opts.find(([v]) => v === tint)?.[1] ?? 'None';
  return `<div class="mapdock ${mapMenu ? 'menuopen' : ''}"><div class="dockrow"><button class="mapmenu-btn" aria-expanded="${mapMenu}" aria-label="Map layers, legend and rotate: ${cur}" data-ui="${reg(
    () => {
      mapMenu = !mapMenu;
    },
  )}">${ico('layers')}<span>Map: <b>${cur}</b><span class="mlab"><i class="msep">·</i>Labels <b>${LABEL_NAME[labelMode]}</b></span></span><span aria-hidden="true">▾</span></button>${mapLegend()}<div class="laysw" role="group" aria-label="Map colour layer"><b>Layer</b>${sw}</div>${labelsBtn()}</div>${legend()}${tools}</div>`;
}
