// Make the VAPID key pair once: node keys.mjs. The public key goes to the site (VITE_VAPID_PUBLIC) and to the relay (VAPID_PUBLIC);
// the private key is the relay's secret (wrangler secret put VAPID_PRIVATE_JWK). Never commit the private key.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const pub = Buffer.from(raw).toString('base64url');
console.log('VAPID public key (VITE_VAPID_PUBLIC and VAPID_PUBLIC):\n' + pub);
console.log('\nVAPID private key (paste when wrangler asks for VAPID_PRIVATE_JWK):\n' + JSON.stringify(await crypto.subtle.exportKey('jwk', privateKey)));
