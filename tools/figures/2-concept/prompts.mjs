// Step 2a: the prompts for every figure type -> 2-concept/prompts.json (read by the scripts) and PROMPTS.md (to paste into any image or 3D service by hand).
import { readFileSync, writeFileSync } from 'node:fs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url)));
const L = JSON.parse(readFileSync(new URL('../1-list/list.json', import.meta.url)));
export const VIEWS = { front: 'seen straight from the front', side: 'seen exactly from the left side', threequarter: 'seen in three-quarter view from the front left, slightly from above' };
const NEG = 'swastika, SS runes, text, letters, numbers, watermark, logo, signature, base, pedestal, plinth, ground, terrain, shadow, background scenery, multiple objects, crowd, cropped, cut off, blurry, photo, gore, blood';
const CLIPS = { idle: 'Idle (standing, breathing)', move: 'Walking (tick "In Place")', fire: 'Firing Rifle (standing)', fall: 'Dying (falling backwards)' };
const prompts = {}, md = ['# Figure prompts', '', 'Made by `2-concept/prompts.mjs` from `types.json`: do not edit by hand. Each type: three concept views (paste into any image AI), the negative prompt, what the 3D step needs and, for soldiers, the animation clips.', '',
  `Negative prompt for every image: \`${NEG}\``, ''];
for (const [id, t] of Object.entries(T.types)) {
  const k = T.kinds[t.kind];
  const view = Object.fromEntries(Object.entries(VIEWS).map(([v, how]) => [v, `Painted tabletop wargame miniature: ${t.what}. ${k.pose[0].toUpperCase() + k.pose.slice(1)}, ${how}. A single ${k.noun}, the whole of it in frame with a margin, centred, product photo with soft even studio light, plain flat light-grey background, historically accurate details, matte hand-painted colours, clean readable shapes, no base, no ground, no text.`]));
  prompts[id] = { kind: t.kind, views: view, negative: NEG, model: { input: 'threequarter', size: k.size, tris: k.tris }, clips: k.clips ?? [] };
  md.push(`## ${id} (${t.kind})`, '', `Used by ${L.types[id]?.length ?? 0} pieces: ${(L.types[id] ?? []).slice(0, 4).map((s) => s.split(' ').slice(1).join(' ')).join(', ')}${(L.types[id]?.length ?? 0) > 4 ? ', …' : ''}`, '');
  for (const [v, p] of Object.entries(view)) md.push(`- **${v}**: ${p}`);
  md.push('', `3D: from the three-quarter pick (or all three views in multi-image mode), reduced to about ${k.tris} triangles; the game scales it to ${k.size} cm.`);
  if (k.clips) md.push(`Animation (Mixamo, free): ${k.clips.map((c) => `${c}: "${CLIPS[c]}"`).join('; ')}.`);
  else if (t.kind === 'vehicle' || t.kind === 'gun') md.push('Animation: none; the game turns the turret, recoils the gun and rocks the hull in code.');
  md.push('');
}
writeFileSync(new URL('prompts.json', import.meta.url), JSON.stringify(prompts, null, 1) + '\n');
writeFileSync(new URL('../PROMPTS.md', import.meta.url), md.join('\n'));
console.log(`prompts for ${Object.keys(prompts).length} types`);
