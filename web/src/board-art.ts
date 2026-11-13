/** The items printed on the board (area number plates, TDN shapes, victory points, names, entry letters), drawn upright around the origin. */
import * as E from '../../engine/src';

export interface Layers {
  numbers: boolean;
  tdn: boolean;
  vp: boolean;
  names: boolean;
}
/** The victory-point symbols: one per side (by side id) and the mutual star. The first side listed prints its stars in a row, the second stacks them. */
export type VpIcons = Record<string, HTMLImageElement>;
/** What a label prints about an area; normally read from the engine's map, a dev page may pass its own. */
export type AreaInfo = { tdn: number; name: string; vp: Record<string, number | boolean> };
const count = (v: Record<string, number | boolean>, k: string) => (typeof v[k] === 'number' ? (v[k] as number) : 0);
/** One area's printed items around (0, 0) = the area's label point, upright for the viewer. */
export function drawItems(
  c: CanvasRenderingContext2D,
  a: { id: number },
  layers: Layers,
  vpIcons: VpIcons,
  withName: boolean,
  info?: AreaInfo,
) {
  const ar = (info ?? E.areas.get(a.id)!) as AreaInfo,
    t = ar.tdn;
  const showShape = layers.numbers || layers.tdn;
  if (showShape) {
    c.lineWidth = 1.6;
    const col = layers.tdn ? t : -1;
    c.beginPath();
    if (col === 0 || col === -1) {
      c.arc(0, -3, 13, 0, 7);
      c.fillStyle = col === 0 ? '#f4e3a4' : '#ece6cc';
      c.strokeStyle = '#8a7a3a';
    } else if (col === 1) {
      c.roundRect(-14, -15, 28, 24, 3);
      c.fillStyle = '#c9a24f';
      c.strokeStyle = '#6b5420';
    } else if (col === 2) {
      [
        [-15, -3],
        [-7, -15],
        [7, -15],
        [15, -3],
        [7, 9],
        [-7, 9],
      ].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = '#8a8f86';
      c.strokeStyle = '#2d3330';
    } else {
      c.moveTo(-15, -14);
      c.lineTo(15, -14);
      c.lineTo(0, 12);
      c.closePath();
      c.fillStyle = '#4a5028';
      c.strokeStyle = '#1d2110';
    }
    c.fill();
    c.stroke();
    c.font = '700 16px "Arial Narrow", Arial, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = col === 3 ? '#fff' : col === 2 ? '#111' : '#1a1608';
    c.fillText(String(layers.numbers ? a.id : t), 0, col === 3 ? -3 : 0);
    if (layers.numbers && layers.tdn && t > 0) {
      c.beginPath();
      c.arc(14, -14, 6.6, 0, 7);
      c.fillStyle = '#3a3a2c';
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = '#f4e3a499';
      c.stroke();
      c.font = '700 10px "Arial Narrow", Arial, sans-serif';
      c.fillStyle = '#f4e3a4';
      c.fillText(`−${t}`, 14, -10.5); /* a lighter TDN bubble: it modifies the number, it does not outweigh it */
    } // the terrain defence as a number too, not only the plate's shape
  }
  if (layers.vp) {
    // the symbols are the editable files in public/icons
    const v = ar.vp,
      put = (img: HTMLImageElement, x: number, y: number) => {
        if (img?.naturalWidth) c.drawImage(img, x - 13, y - 13, 26, 26);
      };
    const sides = Object.keys(vpIcons).filter((k) => k !== 'mutual');
    sides.forEach((s, i) => {
      const n = count(v, s);
      for (let k = 0; k < n; k++)
        if (i === 0) put(vpIcons[s], (k - (n - 1) / 2) * 24, -40);
        else put(vpIcons[s], 0, -40 - k * 20);
    });
    if (v.mutual) put(vpIcons.mutual, 0, -40);
  }
  if (layers.names && withName) {
    c.font = 'italic 600 16px "Arial Narrow", Arial, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 3.2;
    c.strokeStyle = '#bcc0ab';
    c.strokeText(ar.name, 0, 26);
    c.fillStyle = '#1c2216';
    c.fillText(ar.name, 0, 26);
  }
}
/** Entry-zone letters are printed on the map as well; they turn with the viewer. `dark`: the First Player's letters are dark on a light halo, the Second's white on green. */
export function drawEntry(c: CanvasRenderingContext2D, e: { letter: string }, dark: boolean) {
  c.font = '700 19px Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.lineWidth = 3;
  c.strokeStyle = dark ? '#ffffffcc' : '#14502a';
  c.strokeText(e.letter, 0, 6);
  c.fillStyle = dark ? '#111' : '#fff';
  c.fillText(e.letter, 0, 6);
}
/** 14.1 Restricted boundary (the Schnee Eifel between Prüm 4 and Bleialf 11): a ridge of hachures along the shared border, as on the printed map.
 *  `border` is the shared border as a polyline in map pixels. */
export function drawRestricted(c: CanvasRenderingContext2D, border: [number, number][], label = 'Schnee Eifel', far = false) {
  if (border.length < 2) return;
  const seg: { x: number; y: number; nx: number; ny: number; t: number }[] = [];
  let total = 0;
  for (let i = 1; i < border.length; i++) total += Math.hypot(border[i][0] - border[i - 1][0], border[i][1] - border[i - 1][1]);
  let run = 0;
  for (let i = 1; i < border.length; i++) {
    const [x0, y0] = border[i - 1],
      [x1, y1] = border[i],
      L = Math.hypot(x1 - x0, y1 - y0);
    if (!L) continue;
    const nx = -(y1 - y0) / L,
      ny = (x1 - x0) / L;
    for (let d = 0; d < L; d += 3.2) {
      const t = (run + d) / total;
      seg.push({ x: x0 + ((x1 - x0) * d) / L, y: y0 + ((y1 - y0) * d) / L, nx, ny, t });
    }
    run += L;
  }
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#4a3a24';
  c.lineWidth = 1.1;
  seg.forEach((p, i) => {
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, p.t))) ** 0.6,
      len = (6 + (i % 2) * 3) * taper + 1.5; // longer in the middle of the ridge
    c.beginPath();
    c.moveTo(p.x + p.nx * 2, p.y + p.ny * 2);
    c.lineTo(p.x + p.nx * (2 + len), p.y + p.ny * (2 + len));
    c.moveTo(p.x - p.nx * 2, p.y - p.ny * 2);
    c.lineTo(p.x - p.nx * (2 + len), p.y - p.ny * (2 + len));
    c.stroke();
  });
  const mid = border[Math.floor(border.length / 2)],
    prev = border[Math.max(0, Math.floor(border.length / 2) - 1)];
  let ang = Math.atan2(mid[1] - prev[1], mid[0] - prev[0]);
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  c.translate(mid[0], mid[1]);
  c.rotate(ang + (far ? Math.PI : 0)); // the name reads the right way up from the player's side c.font = 'italic 700 9px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 2.6;
  c.strokeStyle = '#e9e6d4';
  c.strokeText(label, 0, 0);
  c.fillStyle = '#3a2d1a';
  c.fillText(label, 0, 0);
  c.restore();
}

/** One area's label as a single printed group inside a w x h box centred on (0, 0): the number plate in its TDN shape with the VP stars beside it, the name below.
 *  Placement comes from the game's labels file (the largest clear spot that covers the least printed detail). */
/** The place-name lettering of the printed map: The Bulge sets them in a condensed italic sans, Golan and Sicily in a Times-like serif; the halo is the map's own paper colour. */
export type LabelFace = { family: string; style: 'italic' | 'normal'; weight: number; halo: string; ink: string };
let FACE: LabelFace = { family: '"Arial Narrow", Arial, sans-serif', style: 'italic', weight: 600, halo: '#e4e6d8', ink: '#1c2216' };
export const setLabelFace = (f: Partial<LabelFace>) => {
  FACE = { ...FACE, ...f };
};
export function drawLabel(
  c: CanvasRenderingContext2D,
  a: { id: number },
  layers: Layers,
  vpIcons: VpIcons,
  box: { w: number; h: number; mode: string },
  info?: AreaInfo,
) {
  const ar = (info ?? E.areas.get(a.id)!) as AreaInfo,
    v = ar.vp,
    icons: HTMLImageElement[] = [];
  if (layers.vp) {
    for (const s of Object.keys(vpIcons).filter((k) => k !== 'mutual')) for (let i = 0; i < count(v, s); i++) icons.push(vpIcons[s]);
    if (v.mutual) icons.push(vpIcons.mutual);
  }
  const plate = layers.numbers || layers.tdn,
    rowW = (plate ? 32 : 0) + icons.length * 21,
    name = layers.names && box.mode === 'full',
    top = name ? -box.h / 2 + 15 : 0;
  let x = -rowW / 2;
  if (plate) {
    c.save();
    c.translate(x + 16, top + 3);
    drawItems(c, a, { ...layers, vp: false, names: false }, vpIcons, false, info);
    c.restore();
    x += 32;
  }
  for (const im of icons) {
    if (im?.naturalWidth) c.drawImage(im, x, top - 10, 20, 20);
    x += 21;
  }
  if (name) {
    const f = (fs: number) => `${FACE.style} ${FACE.weight} ${fs}px ${FACE.family}`;
    let fs = 15;
    c.font = f(fs);
    while (fs > 9 && c.measureText(ar.name).width > box.w - 4) {
      fs -= 0.5;
      c.font = f(fs);
    } // a long name shrinks to its box, never clipped
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.lineWidth = 2.6;
    c.strokeStyle = FACE.halo;
    c.strokeText(ar.name, 0, box.h / 2 - 4);
    c.fillStyle = FACE.ink;
    c.fillText(ar.name, 0, box.h / 2 - 4);
  }
}
