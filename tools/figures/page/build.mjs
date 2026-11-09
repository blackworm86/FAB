// The Figure Workshop page (published as a claude.ai artifact): template.html + the catalogue and prompts -> page/index.html.
// Rebuild and republish after `npm run list` changes types or prompts; progress lives in the page's own records, not here.
import { readFileSync, writeFileSync } from 'node:fs';
const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url)));
const T = read('types.json'), L = read('1-list/list.json'), P = read('2-concept/prompts.json');
const vol = (id) => ({ 44: 'bulge', 43: 'sicily', 73: 'golan73' })[id.match(/^[a-z]+(\d\d)/)?.[1]] ?? 'any';
const types = Object.entries(T.types).map(([id, t]) => { const k = T.kinds[t.kind], used = (L.types[id] ?? []).filter((s) => s.includes(':'));
  return { id, kind: t.kind, what: t.what, vol: vol(id), pieces: used.length, sample: [...new Set(used.map((s) => s.split(' ').slice(1).join(' ')))].slice(0, 5), prompt: P[id].prompt, tris: k.tris, size: k.size, clips: k.clips ?? [] }; });
const data = { types, negative: Object.values(P)[0].negative, clipNames: { idle: 'Idle', move: 'Walking (In Place)', fire: 'Firing Rifle', fall: 'Dying' } };
const html = readFileSync(new URL('template.html', import.meta.url), 'utf8').replace('__DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'));
writeFileSync(new URL('index.html', import.meta.url), html);
console.log(`page/index.html: ${types.length} types, ${(html.length / 1024).toFixed(0)} KB`);
