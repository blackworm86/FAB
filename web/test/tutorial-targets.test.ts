// Every element a lesson points at or waits for still exists in the interface code: a class, a title or a data
// attribute renamed or moved (as when the colour chips left the View window for the Layer bar) breaks a lesson silently.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '../src'),
  files = readdirSync(SRC).filter((f) => /\.(ts|css)$/.test(f));
const ui = files
  .filter((f) => !f.startsWith('tutorial'))
  .map((f) => readFileSync(join(SRC, f), 'utf8'))
  .join('\n');
const lessons = files.filter((f) => /^tutorial-(bulge|golan|sicily|basics)(-new)?\.ts$/.test(f));
const selectors = (src: string) => [...src.matchAll(/(?:el: |q\()'([.[][^']*)'/g)].map((m) => m[1]);

describe('tutorial targets', () => {
  for (const f of lessons)
    it(`${f}: every selector names something the interface draws`, () => {
      const missing: string[] = [];
      for (const sel of selectors(readFileSync(join(SRC, f), 'utf8'))) {
        for (const [, cls] of sel.matchAll(/\.([a-zA-Z][\w-]*)/g))
          if (!new RegExp(`\\b${cls}\\b`).test(ui)) missing.push(`${sel}: class ${cls}`);
        for (const [, attr, , val] of sel.matchAll(/\[([\w-]+)(\^?=)"([^"]*)"\]/g))
          if (attr !== 'data-chit' && attr !== 'data-arr' && attr !== 'aria-pressed' && !ui.includes(val))
            missing.push(`${sel}: ${attr} "${val}"`);
      }
      expect(missing).toEqual([]);
    });
});
