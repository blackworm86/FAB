// node --test: the relay's token check, its VAPID signature and its three endpoints, with stand-ins for Google, the database and a push service.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { verifyIdToken, vapidHeader, pushHost } from './worker.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
const rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', rsa.publicKey)), kid: 'k1', alg: 'RS256' };
const now = Math.floor(Date.now() / 1000);
async function token(claims, kid = 'k1') {
  const h = b64u(JSON.stringify({ alg: 'RS256', kid })), c = b64u(JSON.stringify({ aud: 'proj', iss: 'https://securetoken.google.com/proj', sub: 'u1', iat: now, exp: now + 3600, firebase: { sign_in_provider: 'google.com' }, ...claims }));
  return `${h}.${c}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsa.privateKey, new TextEncoder().encode(`${h}.${c}`)))}`;
}
const keys = async () => [jwk];

test('a valid Firebase token gives its uid; wrong project, expired, guest, other key or tampered ones give nothing', async () => {
  assert.equal(await verifyIdToken(await token({}), 'proj', keys), 'u1');
  assert.equal(await verifyIdToken(await token({ aud: 'other' }), 'proj', keys), null);
  assert.equal(await verifyIdToken(await token({ exp: now - 10 }), 'proj', keys), null);
  assert.equal(await verifyIdToken(await token({ firebase: { sign_in_provider: 'anonymous' } }), 'proj', keys), null);
  assert.equal(await verifyIdToken(await token({}, 'k2'), 'proj', keys), null);
  const t = await token({}); assert.equal(await verifyIdToken(t.slice(0, -4) + 'AAAA', 'proj', keys), null);
});

const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = { VAPID_SUBJECT: 'mailto:t@example.com', VAPID_PUBLIC: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', ec.publicKey))), VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', ec.privateKey)),
  FIREBASE_PROJECT: 'proj', DATABASE_URL: 'https://db.example', ALLOWED_ORIGIN: 'https://site.example' };

test('the VAPID header is an ES256 JWT for the push service origin, signed with the relay key', async () => {
  const h = await vapidHeader('https://push.example/send/abc', env), [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h);
  assert.equal(k, env.VAPID_PUBLIC); const [a, b, s] = t.split('.');
  assert.equal(JSON.parse(Buffer.from(b, 'base64url')).aud, 'https://push.example');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ec.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${a}.${b}`)));
});

test('only real push services are accepted as endpoints', () => {
  for (const e of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) assert.ok(pushHost(e), e);
  for (const e of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.example/x', 'https://push.apple.com/x', 'https://evilpush.apple.com/x', 'https://evil.example/web.push.apple.com', 'https://127.0.0.1/x', 'not a url', undefined]) assert.ok(!pushHost(e), e);
});

test('subscribe, then notify the opponent at a shared table: one push, throttled for a minute; strangers are refused', async () => {
  const kv = new Map(), pushes = [];
  const SUBS = { get: async (k, type) => (kv.has(k) ? (type === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null), put: async (k, v) => { kv.set(k, v); } };
  globalThis.fetch = async (url, init) => {
    url = String(url);
    if (url.startsWith('https://www.googleapis.com/')) return new Response(JSON.stringify({ keys: [jwk] }));
    if (url.startsWith('https://db.example/games/t1/seats.json')) return new Response(JSON.stringify({ german: 'u1', allied: 'u2' }));
    if (url.startsWith('https://db.example/')) return new Response('null');
    if (url.startsWith('https://fcm.googleapis.com/')) { pushes.push({ url, auth: init.headers.Authorization }); return new Response('', { status: 201 }); }
    throw new Error('unexpected ' + url);
  };
  const call = async (path, body) => { const r = await worker.fetch(new Request(`https://relay.example${path}`, { method: 'POST', headers: { origin: env.ALLOWED_ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { ...env, SUBS }); return { status: r.status, body: await r.json() }; };
  const u1 = await token({}), u2 = await token({ sub: 'u2' }), u3 = await token({ sub: 'u3' });
  assert.equal((await call('/subscribe', { idToken: u2, sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/dev-u2' } })).status, 200);
  assert.equal((await call('/subscribe', { idToken: u2, sub: { endpoint: 'https://evil.example/hook' } })).status, 400);
  const n = await call('/notify', { idToken: u1, table: 't1' }); assert.equal(n.status, 200); assert.equal(n.body.sent, 1);
  assert.equal(pushes.length, 1); assert.match(pushes[0].auth, /^vapid t=/);
  assert.equal((await call('/notify', { idToken: u1, table: 't1' })).body.throttled, true); assert.equal(pushes.length, 1);
  assert.equal((await call('/notify', { idToken: u3, table: 't1' })).status, 403);
  assert.equal((await call('/notify', { idToken: 'junk', table: 't1' })).status, 401);
  const bad = await worker.fetch(new Request('https://relay.example/notify', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), { ...env, SUBS }); assert.equal(bad.status, 403);
});
