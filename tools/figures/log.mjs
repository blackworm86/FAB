// One line per service run in runs.log: what ran, how many images or models, and what it cost (the owner wants the cost of each run).
import { appendFileSync } from 'node:fs';
export const logRun = (step, service, n, cost) => { const line = `${new Date().toISOString()}  ${step}  ${service}  ${n} done  cost: ${cost}`; if (!process.env.FIG_TEST) appendFileSync(new URL('runs.log', import.meta.url), line + '\n'); console.log(line); };
/** The types named on the command line, or all of them. */
export const pick = (all) => { const want = process.argv.slice(2).filter((a) => !a.startsWith('--')); const bad = want.filter((w) => !all.includes(w)); if (bad.length) throw new Error(`unknown types: ${bad.join(', ')}`); return want.length ? want : all; };
export const flag = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
