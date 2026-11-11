// Run a script's 'worker' mode on every core over a range of seeds and collect the JSON lines it prints.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

export async function onAllCores<T>(script: string, n: number, extra: string[] = []): Promise<T[]> {
  const k = Math.min(cpus().length, n), per = Math.ceil(n / k), out: T[] = [];
  await Promise.all(Array.from({ length: k }, (_, i) => new Promise<void>((done) => {
    const p = spawn('npx', ['vite-node', script, '--', 'worker', String(1 + i * per), String(1 + Math.min(n, (i + 1) * per)), ...extra], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; const lines = buf.split('\n'); buf = lines.pop()!; for (const l of lines) if (l.startsWith('{')) { out.push(JSON.parse(l)); if (out.length % 50 === 0) console.error(`${out.length}/${n}`); } });
    p.on('close', () => done());
  })));
  return out;
}
