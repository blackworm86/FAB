// Step 2b: concept art. For each type, front / side / three-quarter images (N variants each) into 2-concept/<type>/<view>-<n>.png.
// The owner then copies the one they like to 2-concept/<type>/pick.png (or drops in a picture made by hand anywhere: Gemini, ChatGPT, Bing...).
//   node 2-concept/make.mjs [type ...] [--service=pollinations|hf] [--n=2]
// pollinations: free, no key (image.pollinations.ai, FLUX). hf: Hugging Face FLUX.1-schnell, free monthly credits, needs HF_TOKEN.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { logRun, pick, flag } from '../log.mjs';
const P = JSON.parse(readFileSync(new URL('prompts.json', import.meta.url))), service = flag('service', 'pollinations'), N = +flag('n', 2);
const get = {
  pollinations: (p, seed) => fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true&private=true`, { headers: process.env.POLLINATIONS_TOKEN ? { Authorization: `Bearer ${process.env.POLLINATIONS_TOKEN}` } : {} }),
  hf: (p, seed, neg) => fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', { method: 'POST', headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs: p, parameters: { seed, negative_prompt: neg } }) }),
}[service];
if (!get) throw new Error(`unknown service ${service}`);
let made = 0;
for (const id of pick(Object.keys(P))) {
  const dir = new URL(`${id}/`, import.meta.url); mkdirSync(dir, { recursive: true });
  for (const [view, prompt] of Object.entries(P[id].views)) for (let n = 1; n <= N; n++) {
    const file = new URL(`${view}-${n}.png`, dir); if (existsSync(file)) continue;          // already made (or dropped in by hand): never paid for twice
    const r = await get(prompt, n, P[id].negative);
    if (!r.ok) { console.error(`${id} ${view}-${n}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    await sharp(Buffer.from(await r.arrayBuffer())).png().toFile(file.pathname);          // Pollinations may send JPEG: always store PNG made++; console.log(`${id} ${view}-${n}`);
    if (service === 'pollinations') await new Promise((ok) => setTimeout(ok, 16000));      // shortcut: the free tier allows about one image per 15 s; a token raises it
  }
}
logRun('concept', service, made, 'free');
