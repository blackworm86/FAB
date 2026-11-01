/** What a hit did (step losses, eliminations, retreats, field works, control) and the pop-ups that show it over the map. */
import * as E from '../../engine/src';
import { ico } from './icons';
import { esc, nm } from './util';

export type Fx = { area: number; unit?: string; icon: string; head: string; text: string; cls: 'loss' | 'elim' | 'dis' | 'fw' | 'ret' | 'cap' };
export const snap = (x: E.Game) => ({ u: new Map(x.units.map((u) => [u.id, { str: u.str, area: u.area, dis: u.disorder, name: u.name }])), c: new Map(x.chits.map((c) => [c.id, c.box])), fw: [...x.fieldWorks], ctl: { ...x.control }, area: x.battle?.area ?? null });
export function diffFx(a: ReturnType<typeof snap>, x: E.Game): Fx[] {
  const out: Fx[] = [], ba = x.battle?.area ?? a.area;
  for (const u of x.units) {
    const o = a.u.get(u.id); if (!o) continue;
    if (u.area == null && o.area != null) out.push({ area: o.area, unit: u.id, icon: 'xbold', head: 'ELIMINATED', text: o.name, cls: 'elim' });
    else if (u.str < o.str) out.push({ area: u.area ?? o.area ?? 0, unit: u.id, icon: 'burst', head: `−${o.str - u.str} STEP`, text: `${u.name} ${u.str}/${o.str}`, cls: 'loss' });
    if (u.area != null && o.area != null && u.area !== o.area) out.push({ area: u.area, unit: u.id, icon: 'back', head: 'RETREATS', text: `${u.name} → ${E.areas.get(u.area)!.name}`, cls: 'ret' });
    if (u.area != null && u.disorder > o.dis) out.push({ area: u.area, unit: u.id, icon: 'disorder', head: 'DISORDERED', text: u.name, cls: 'dis' });
  }
  for (const c of x.chits) if (ba != null && a.c.get(c.id) === 'map' && c.box === 'eliminated') out.push({ area: ba, icon: 'xbold', head: 'ASSET LOST', text: c.name, cls: 'elim' });
  for (const f of new Set(a.fw)) if (!x.fieldWorks.includes(f)) out.push({ area: f, icon: 'nogear', head: 'FIELD WORKS REMOVED', text: E.areas.get(f)!.name, cls: 'fw' });
  for (const [k, v] of Object.entries(x.control)) if (a.ctl[+k] !== v) out.push({ area: +k, icon: 'flag', head: `${nm(v as E.Side).toUpperCase()} CONTROL`, text: E.areas.get(+k)!.name, cls: 'cap' });
  const seenFx = new Set<string>();
  return out.filter((f) => { const k = `${f.head}|${f.text}|${f.area}`; if (seenFx.has(k)) return false; seenFx.add(k); return true; });
}

/** The pop-up layer: `show` adds pop-ups, `place` is called every frame with a function that turns an area into screen coordinates. */
export class FxLayer {
  private els: { el: HTMLElement; area: number; unit?: string; born: number; k: number }[] = [];
  private last = new Map<string, number>();
  show(list: Fx[]) {
    const now = performance.now(); list = list.filter((f) => { const k = `${f.head}|${f.text}|${f.area}`, t = this.last.get(k) ?? -1e9; if (now - t < 1500) return false; this.last.set(k, now); return true; });      // the same effect is never shown twice in a row
    let layer = document.getElementById('fx'); if (!layer) { layer = document.createElement('div'); layer.id = 'fx'; document.body.appendChild(layer); }
    list.forEach((f, i) => { const el = document.createElement('div'); el.className = `fx ${f.cls}`; el.style.animationDelay = `${i * 0.18}s`; el.innerHTML = `${ico(f.icon)}<b>${esc(f.head)}</b><small>${esc(f.text)}</small>`; layer!.appendChild(el); this.els.push({ el, area: f.area, unit: f.unit, born: performance.now() + i * 180, k: this.els.filter((x) => x.area === f.area).length }); });
  }
  place(project: (area: number, unit?: string) => { x: number; y: number; visible: boolean }) {
    const now = performance.now();
    for (let i = this.els.length - 1; i >= 0; i--) {
      const f = this.els[i]; if (now - f.born > 7000) { f.el.remove(); this.els.splice(i, 1); continue; }
      const p = project(f.area, f.unit); f.el.style.display = p.visible && now >= f.born ? '' : 'none';
      f.el.style.transform = `translate(${p.x}px, ${p.y - f.k * 58}px) translate(-50%, -100%)`;
    }
  }
}
export const fxRow = (f: Fx) => `<div class="fxrow ${f.cls}">${ico(f.icon)}<b>${esc(f.head)}</b><span>${esc(f.text)}</span></div>`;
export const FX_SAMPLES: Fx[] = [
  { area: 0, icon: 'burst', head: '−1 STEP', text: '212 VG 2/3', cls: 'loss' }, { area: 0, icon: 'xbold', head: 'ELIMINATED', text: '560 VG', cls: 'elim' }, { area: 0, icon: 'xbold', head: 'ASSET LOST', text: 'Arty 405th', cls: 'elim' },
  { area: 0, icon: 'disorder', head: 'DISORDERED', text: 'Peiper', cls: 'dis' }, { area: 0, icon: 'back', head: 'RETREATS', text: '4 Inf → Weiswampach', cls: 'ret' }, { area: 0, icon: 'nogear', head: 'FIELD WORKS REMOVED', text: 'Weiswampach', cls: 'fw' }, { area: 0, icon: 'flag', head: 'GERMAN CONTROL', text: 'Echternach', cls: 'cap' }];
