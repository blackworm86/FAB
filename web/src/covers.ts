/** Our own box-cover artwork for each FAB volume (drawn here: no publisher art is used). */
const R = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
let trees = ''; for (let i = 0; i < 60; i++) { const x = R() * 300, y = 245 + R() * 110, h = 14 + R() * 22; trees += `<path d="M${x} ${y - h} L${x - h * 0.33} ${y} L${x + h * 0.33} ${y}Z"/><path d="M${x} ${y - h} L${x - h * 0.14} ${y - h * 0.55} L${x + h * 0.14} ${y - h * 0.55}Z" fill="#f4f6f8"/>`; }
let snow = ''; for (let i = 0; i < 90; i++) { const x = R() * 300, y = R() * 400; snow += `<path d="M${x} ${y}l.6 1.6"/>`; }
const ART: Record<string, string> = {
  bulge: `<svg class="art" aria-hidden="true" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa5ad"/><stop offset=".55" stop-color="#d9dde0"/><stop offset="1" stop-color="#eef1f3"/></linearGradient>
  <linearGradient id="sky-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7a34a"/><stop offset=".5" stop-color="#f1cf8a"/><stop offset=".51" stop-color="#2f6f8f"/><stop offset="1" stop-color="#173f55"/></linearGradient>
  <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c48a"/><stop offset=".6" stop-color="#d79a5a"/><stop offset="1" stop-color="#8a5a34"/></linearGradient></defs><rect width="300" height="400" fill="url(#sky-b)"/>
  <path d="M0 250 L40 205 L80 228 L130 180 L175 215 L215 190 L260 222 L300 200 L300 400 L0 400Z" fill="#c9d0d4"/>
  <path d="M0 290 L60 255 L110 275 L170 240 L230 268 L300 245 L300 400 L0 400Z" fill="#e9edef"/>
  <g fill="#24382e">__TREES__</g>
  <path d="M0 360 Q80 335 150 352 T300 340 L300 400 L0 400Z" fill="#f6f8f9"/>
  <g fill="#3a3f46" opacity=".9"><rect x="150" y="318" width="44" height="14" rx="2"/><rect x="160" y="309" width="22" height="10" rx="2"/><rect x="180" y="312" width="34" height="3"/><rect x="146" y="330" width="52" height="6" rx="3" fill="#2a2d32"/></g>
  <g stroke="#fff" stroke-width="1" opacity=".55">__SNOW__</g></svg>`,
  sicily: `<svg class="art" aria-hidden="true" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa5ad"/><stop offset=".55" stop-color="#d9dde0"/><stop offset="1" stop-color="#eef1f3"/></linearGradient>
  <linearGradient id="sky-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7a34a"/><stop offset=".5" stop-color="#f1cf8a"/><stop offset=".51" stop-color="#2f6f8f"/><stop offset="1" stop-color="#173f55"/></linearGradient>
  <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c48a"/><stop offset=".6" stop-color="#d79a5a"/><stop offset="1" stop-color="#8a5a34"/></linearGradient></defs><rect width="300" height="400" fill="url(#sky-s)"/>
  <circle cx="220" cy="120" r="34" fill="#fbe7b0" opacity=".9"/>
  <path d="M0 205 L50 150 L85 172 L120 120 L150 140 L175 98 L205 150 L240 135 L300 185 L300 206 L0 206Z" fill="#7d5a3a"/>
  <path d="M175 98 L188 112 L198 108 L205 150Z" fill="#a9825a"/><path d="M168 106 L175 98 L178 103Z" fill="#fff" opacity=".7"/>
  <g stroke="#cfe6ee" stroke-width="1.2" opacity=".5"><path d="M0 230 H300"/><path d="M20 255 H280"/><path d="M0 285 H300"/></g>
  <g fill="#1d2a30"><path d="M40 300 h70 l-8 14 h-56z"/><rect x="60" y="290" width="22" height="10"/><path d="M150 330 h60 l-7 12 h-48z"/><rect x="168" y="321" width="18" height="9"/><path d="M230 270 h44 l-5 9 h-35z"/></g>
  <g stroke="#e9f4f8" stroke-width="1" opacity=".7"><path d="M36 316 q40 8 80 0"/><path d="M146 344 q34 7 66 0"/></g></svg>`,
  golan73: `<svg class="art" aria-hidden="true" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa5ad"/><stop offset=".55" stop-color="#d9dde0"/><stop offset="1" stop-color="#eef1f3"/></linearGradient>
  <linearGradient id="sky-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7a34a"/><stop offset=".5" stop-color="#f1cf8a"/><stop offset=".51" stop-color="#2f6f8f"/><stop offset="1" stop-color="#173f55"/></linearGradient>
  <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c48a"/><stop offset=".6" stop-color="#d79a5a"/><stop offset="1" stop-color="#8a5a34"/></linearGradient></defs><rect width="300" height="400" fill="url(#sky-g)"/>
  <path d="M0 210 L70 180 L120 196 L190 150 L240 168 L300 140 L300 400 L0 400Z" fill="#5a4a3e"/>
  <path d="M0 250 L90 232 L160 246 L230 222 L300 236 L300 400 L0 400Z" fill="#3b322b"/>
  <g fill="none" stroke="#7a6550" stroke-width="1" opacity=".7"><path d="M0 270 Q75 258 150 268 T300 262"/><path d="M0 290 Q75 280 150 288 T300 282"/><path d="M0 312 Q75 302 150 310 T300 304"/><path d="M0 336 Q75 326 150 334 T300 328"/></g>
  <g fill="#1c1916"><path d="M60 300 h56 l8 12 h-72z"/><rect x="74" y="290" width="26" height="10" rx="2"/><rect x="98" y="293" width="40" height="3"/><path d="M180 320 h48 l7 10 h-62z"/><rect x="192" y="312" width="22" height="9" rx="2"/><rect x="212" y="314" width="34" height="3"/></g>
  <g fill="#f3d9a6" opacity=".35"><circle cx="135" cy="292" r="10"/><circle cx="148" cy="286" r="7"/><circle cx="246" cy="312" r="8"/></g></svg>`,
};
export const coverArt = (id: string) => (ART[id] ?? ART.bulge).replace('__TREES__', trees).replace('__SNOW__', snow);
