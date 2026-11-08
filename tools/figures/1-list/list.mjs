// Step 1: every piece of the three volumes -> its figure type (types.json rules). Writes 1-list/list.json; fails if a piece matches no rule.
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url), root = new URL('../../../', import.meta.url);
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url)));
const NAT = { us: 'us', german: 'de', british: 'uk', italian: 'it', israeli: 'il', syrian: 'sy', de: 'de', br: 'uk' };
const nat = (p) => NAT[p.nation] ?? NAT[(p.echelon ?? '').split('_')[0]] ?? NAT[p.side] ?? ([p.side, p.echelon].includes('allied') ? 'us' : undefined);   // Bulge counters carry only an echelon; its 'allied' air and staff are American
const eq = (rule, val) => typeof rule === 'string' && rule.startsWith('/') ? new RegExp(rule.slice(1, -1)).test(val ?? '') : rule === val;
const hit = (r, p) => Object.entries(r).every(([k, v]) => ['type', 'why'].includes(k) || (k === 'name' ? new RegExp(v).test(p.name) : eq(v, p[k])));

const out = { types: {}, pieces: {}, none: {} }, bad = [];
for (const vol of ['bulge', 'sicily', 'golan73']) {
  const load = (f) => { const d = JSON.parse(readFileSync(new URL(`data/${vol}/${f}.json`, root))); return Array.isArray(d) ? d : d.units ?? d.counters; };
  const units = load('units').map((u) => ({ id: u.id, name: u.name, vol, nat: nat(u), kind: u.kind ?? 'block', sym: u.symbol }));
  const chits = load('counters').map((c) => ({ id: c.id ?? c.ids?.[0], name: c.name, vol, nat: nat(c), kind: c.kind, sym: c.symbol, sub: c.subtype }));
  for (const p of [...units, ...chits]) {
    const r = T.rules.find((x) => hit(x, p));
    if (!r) { bad.push(p); continue; }
    if (r.type && !T.types[r.type]) throw new Error(`rule names unknown type ${r.type}`);
    if (!r.type) { (out.none[r.why] ??= []).push(`${vol}:${p.id}`); continue; }
    out.pieces[`${vol}:${p.id}`] = r.type; (out.types[r.type] ??= []).push(`${vol}:${p.id} ${p.name}`);
  }
}
(out.types.cover ??= []).unshift('every hidden enemy unit');                     // the covered figure is drawn for any face-down enemy
const unused = Object.keys(T.types).filter((t) => !out.types[t]);
if (bad.length || unused.length) { console.error('No rule for:', bad, '\nTypes no piece uses:', unused); process.exit(1); }
writeFileSync(new URL('list.json', here), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.types).length} figure types for ${Object.keys(out.pieces).length} pieces; ${Object.values(out.none).flat().length} pieces keep their block or counter.`);
