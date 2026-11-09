// Step 2a: one picture prompt per figure type, in the low-poly style of types.json -> 2-concept/prompts.json (read by the scripts) and PROMPTS.md (to paste by hand).
// One three-quarter view per type: it is all the image-to-3D step needs, and image AIs keep one figure consistent far better than a set of views.
import { readFileSync, writeFileSync } from 'node:fs';
const T = JSON.parse(readFileSync(new URL('../types.json', import.meta.url)));
const L = JSON.parse(readFileSync(new URL('../1-list/list.json', import.meta.url)));
const NEG = 'swastika, SS runes, text, letters, numbers, watermark, logo, base, pedestal, plinth, ground, terrain, grass, shadow, scenery, multiple objects, several views, character sheet, cropped, photorealistic, high detail, smooth subdivided surfaces, fine texture, gore, blood';
const CLIPS = { idle: 'Idle', move: 'Walking (tick "In Place")', fire: 'Firing Rifle', fall: 'Dying' };
const prompts = {}, md = ['# Figure prompts', '', 'Made by `2-concept/prompts.mjs` from `types.json`: change the style or a subject there, not here. One picture per type, seen in three-quarter view; the 3D step builds the model from it.', '',
  `Style, part of every prompt: ${T.style}.`, '', `Leave out (negative prompt, where the service has one): \`${NEG}\``, ''];
for (const [id, t] of Object.entries(T.types)) {
  const k = T.kinds[t.kind], prompt = `${T.style}. Subject: ${t.what}. ${k.pose[0].toUpperCase() + k.pose.slice(1)}. One single ${k.noun} alone, seen in three-quarter view from the front left and slightly from above, whole and centred with a margin, on a plain flat light-grey background, soft even light, no base, no ground, no text.`;
  prompts[id] = { kind: t.kind, prompt, negative: NEG, tris: k.tris, size: k.size, clips: k.clips ?? [] };
  const used = L.types[id] ?? [];
  md.push(`## ${id} (${t.kind})`, '', `Used by ${used.length} pieces: ${used.slice(0, 4).map((s) => s.split(' ').slice(1).join(' ') || s).join(', ')}${used.length > 4 ? ', …' : ''}`, '', prompt, '',
    `Low-poly target: about ${k.tris} faces; in the game ${k.size} cm (a block is 1.6).${k.clips ? ` Mixamo clips: ${k.clips.map((c) => `${c} "${CLIPS[c]}"`).join(', ')}.` : t.kind === 'vehicle' || t.kind === 'gun' ? ' No animation: the game turns the turret, recoils the gun and rocks the hull in code.' : ''}`, '');
}
writeFileSync(new URL('prompts.json', import.meta.url), JSON.stringify(prompts, null, 1) + '\n');
writeFileSync(new URL('../PROMPTS.md', import.meta.url), md.join('\n'));
console.log(`prompts for ${Object.keys(prompts).length} types`);
