// "Your move" push relay (4.3 step 2): a Cloudflare Worker on the free plan. It keeps each player's push subscriptions (KV) and, when a
// player's move hands the move to the opponent, sends that opponent a Web Push. No game data passes through it and no message body is
// sent (an empty push needs no encryption): the app's service worker shows "Your move" and opens the home page, which lists the games.
//
// Every request carries the caller's Firebase ID token; the relay checks it against Google's keys and reads the game's seats from the
// Realtime Database AS that player, so it can only notify the opponent seated at a table where the caller is seated.
//
// Environment: SUBS (KV namespace), VAPID_PUBLIC (base64url), VAPID_PRIVATE_JWK (JSON, secret), VAPID_SUBJECT ("mailto:..."),
// FIREBASE_PROJECT, DATABASE_URL, ALLOWED_ORIGIN (the site's origin, e.g. https://<user>.github.io).

const b64u = {
  enc: (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const text = (s) => new TextEncoder().encode(s);
const json = (body, status, origin) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(origin) } });
const cors = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  vary: 'origin',
});

/** Check a Firebase ID token (RS256, Google's securetoken keys); returns the uid or null. */
export async function verifyIdToken(token, project, fetchKeys = defaultKeys, now = Date.now() / 1000) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  let head, claims;
  try {
    head = JSON.parse(new TextDecoder().decode(b64u.dec(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64u.dec(parts[1])));
  } catch {
    return null;
  }
  if (head.alg !== 'RS256' || !head.kid) return null;
  if (
    claims.aud !== project ||
    claims.iss !== `https://securetoken.google.com/${project}` ||
    !claims.sub ||
    claims.exp < now ||
    claims.iat > now + 300
  )
    return null;
  if (claims.firebase?.sign_in_provider === 'anonymous') return null; // guests only watch
  const jwk = (await fetchKeys()).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(parts[2]), text(`${parts[0]}.${parts[1]}`));
  return ok ? claims.sub : null;
}
async function defaultKeys() {
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', {
    cf: { cacheTtl: 3600 },
  });
  return (await r.json()).keys;
}
/** Only real browser push services: the relay must not be made to POST to any other host. */
export function pushHost(endpoint) {
  let u;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    u.protocol === 'https:' &&
    /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[\w-]+(\.[\w-]+)*\.push\.apple\.com|[\w-]+(\.[\w-]+)*\.notify\.windows\.com)$/.test(
      u.hostname,
    )
  );
}
/** The VAPID header for one push service (RFC 8292): an ES256 JWT for the endpoint's origin, signed with the relay's private key. */
export async function vapidHeader(endpoint, env, now = Math.floor(Date.now() / 1000)) {
  const head = b64u.enc(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.enc(text(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: env.VAPID_SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${env.VAPID_PUBLIC}`;
}
const subsOf = async (env, uid) => (await env.SUBS.get(`u:${uid}`, 'json')) ?? [];

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'POST' || req.headers.get('origin') !== origin) return json({ error: 'not allowed' }, 403, origin);
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad request' }, 400, origin);
    }
    const uid = await verifyIdToken(body.idToken, env.FIREBASE_PROJECT).catch(() => null);
    if (!uid) return json({ error: 'sign in first' }, 401, origin);
    const path = new URL(req.url).pathname;

    if (path === '/subscribe') {
      // keep up to five devices per player
      const sub = body.sub;
      if (!pushHost(sub?.endpoint)) return json({ error: 'bad subscription' }, 400, origin);
      const list = (await subsOf(env, uid)).filter((s) => s.endpoint !== sub.endpoint);
      list.push({ endpoint: sub.endpoint });
      await env.SUBS.put(`u:${uid}`, JSON.stringify(list.slice(-5)));
      return json({ ok: true }, 200, origin);
    }
    if (path === '/unsubscribe') {
      const list = (await subsOf(env, uid)).filter((s) => s.endpoint !== body.endpoint);
      await env.SUBS.put(`u:${uid}`, JSON.stringify(list));
      return json({ ok: true }, 200, origin);
    }
    if (path === '/notify') {
      const table = String(body.table ?? '');
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(table)) return json({ error: 'bad table' }, 400, origin);
      const r = await fetch(`${env.DATABASE_URL}/games/${table}/seats.json?auth=${encodeURIComponent(body.idToken)}`);
      const seats = r.ok ? await r.json() : null;
      if (!seats) return json({ error: 'no such table' }, 404, origin);
      const to = seats.german === uid ? seats.allied : seats.allied === uid ? seats.german : null;
      if (!to) return json({ error: 'you are not seated at this table' }, 403, origin);
      const gate = `t:${to}:${table}`;
      if (await env.SUBS.get(gate)) return json({ ok: true, throttled: true }, 200, origin); // one push per game a minute
      await env.SUBS.put(gate, '1', { expirationTtl: 60 });
      const list = await subsOf(env, to);
      let gone = false;
      await Promise.all(
        list.map(async (s) => {
          const res = await fetch(s.endpoint, {
            method: 'POST',
            headers: { TTL: '86400', Urgency: 'normal', Authorization: await vapidHeader(s.endpoint, env), 'Content-Length': '0' },
          }).catch(() => null);
          if (res && (res.status === 404 || res.status === 410)) {
            s.gone = true;
            gone = true;
          } // the device unsubscribed
        }),
      );
      if (gone) await env.SUBS.put(`u:${to}`, JSON.stringify(list.filter((s) => !s.gone)));
      return json({ ok: true, sent: list.length }, 200, origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },
};
