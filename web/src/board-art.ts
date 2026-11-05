/** The items printed on the board (area number plates, TDN shapes, victory points, names, entry letters), drawn upright around the origin. */
import * as E from '../../engine/src';

export interface Layers { numbers: boolean; tdn: boolean; vp: boolean; names: boolean }
/** One area's printed items around (0, 0) = the area's label point, upright for the viewer. */
export function drawItems(c: CanvasRenderingContext2D, a: { id: number }, layers: Layers, vpIcons: Record<'allied' | 'german' | 'mutual', HTMLImageElement>, withName: boolean) {
  const ar = E.areas.get(a.id)!, t = ar.tdn;
  const showShape = layers.numbers || layers.tdn;
  if (showShape) {
    c.lineWidth = 1.6; const col = layers.tdn ? t : -1;
    c.beginPath();
    if (col === 0 || col === -1) { c.arc(0, -3, 13, 0, 7); c.fillStyle = col === 0 ? '#f4e3a4' : '#ece6cc'; c.strokeStyle = '#8a7a3a'; }
    else if (col === 1) { c.roundRect(-14, -15, 28, 24, 3); c.fillStyle = '#c9a24f'; c.strokeStyle = '#6b5420'; }
    else if (col === 2) { [[-15, -3], [-7, -15], [7, -15], [15, -3], [7, 9], [-7, 9]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = '#8a8f86'; c.strokeStyle = '#2d3330'; }
    else { c.moveTo(-15, -14); c.lineTo(15, -14); c.lineTo(0, 12); c.closePath(); c.fillStyle = '#4a5028'; c.strokeStyle = '#1d2110'; }
    c.fill(); c.stroke();
    c.font = '700 16px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = col === 3 ? '#fff' : col === 2 ? '#111' : '#1a1608';
    c.fillText(String(layers.numbers ? a.id : t), 0, col === 3 ? -3 : 0);
    if (layers.numbers && layers.tdn && t > 0) { c.beginPath(); c.arc(15, -15, 8, 0, 7); c.fillStyle = '#1a1608'; c.fill(); c.font = '700 11px "Arial Narrow", Arial, sans-serif'; c.fillStyle = '#f4e3a4'; c.fillText(`−${t}`, 15, -11); }     // the terrain defence as a number too, not only the plate's shape
  }
  if (layers.vp) {                                                                                   // the symbols are the editable files in public/icons
    const v = ar.vp, put = (img: HTMLImageElement, x: number, y: number) => { if (img.naturalWidth) c.drawImage(img, x - 13, y - 13, 26, 26); };
    for (let i = 0; i < v.allied; i++) put(vpIcons.allied, (i - (v.allied - 1) / 2) * 24, -40);
    for (let i = 0; i < v.german; i++) put(vpIcons.german, 0, -40 - i * 20);
    if (v.mutual) put(vpIcons.mutual, 0, -40);
  }
  if (layers.names && withName) { c.font = 'italic 600 16px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3.2; c.strokeStyle = '#bcc0ab'; c.strokeText(ar.name, 0, 26); c.fillStyle = '#1c2216'; c.fillText(ar.name, 0, 26); }
}
/** Entry-zone letters are printed on the map as well; they turn with the viewer. */
export function drawEntry(c: CanvasRenderingContext2D, e: { letter: string; side: E.Side }) {
  const ge = e.side === 'german'; c.font = '700 19px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = ge ? '#ffffffcc' : '#14502a'; c.strokeText(e.letter, 0, 6); c.fillStyle = ge ? '#111' : '#fff'; c.fillText(e.letter, 0, 6);
}
/** 14.1 Restricted boundary (the Schnee Eifel between Prüm 4 and Bleialf 11): a ridge of hachures along the shared border, as on the printed map.
 *  `border` is the shared border as a polyline in map pixels. */
export function drawRestricted(c: CanvasRenderingContext2D, border: [number, number][], label = 'Schnee Eifel') {
  if (border.length < 2) return;
  const seg: { x: number; y: number; nx: number; ny: number; t: number }[] = []; let total = 0;
  for (let i = 1; i < border.length; i++) total += Math.hypot(border[i][0] - border[i - 1][0], border[i][1] - border[i - 1][1]);
  let run = 0;
  for (let i = 1; i < border.length; i++) {
    const [x0, y0] = border[i - 1], [x1, y1] = border[i], L = Math.hypot(x1 - x0, y1 - y0); if (!L) continue;
    const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let d = 0; d < L; d += 3.2) { const t = (run + d) / total; seg.push({ x: x0 + ((x1 - x0) * d) / L, y: y0 + ((y1 - y0) * d) / L, nx, ny, t }); }
    run += L;
  }
  c.save(); c.lineCap = 'round'; c.strokeStyle = '#4a3a24'; c.lineWidth = 1.1;
  seg.forEach((p, i) => {
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, p.t))) ** 0.6, len = (6 + (i % 2) * 3) * taper + 1.5;      // longer in the middle of the ridge
    c.beginPath(); c.moveTo(p.x + p.nx * 2, p.y + p.ny * 2); c.lineTo(p.x + p.nx * (2 + len), p.y + p.ny * (2 + len));
    c.moveTo(p.x - p.nx * 2, p.y - p.ny * 2); c.lineTo(p.x - p.nx * (2 + len), p.y - p.ny * (2 + len)); c.stroke();
  });
  const mid = border[Math.floor(border.length / 2)], prev = border[Math.max(0, Math.floor(border.length / 2) - 1)];
  let ang = Math.atan2(mid[1] - prev[1], mid[0] - prev[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
  c.translate(mid[0], mid[1]); c.rotate(ang); c.font = 'italic 700 9px "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 2.6; c.strokeStyle = '#e9e6d4'; c.strokeText(label, 0, 0); c.fillStyle = '#3a2d1a'; c.fillText(label, 0, 0);
  c.restore();
}
