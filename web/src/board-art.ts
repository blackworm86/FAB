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
