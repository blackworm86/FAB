/** 4.3 "Your move" notices, step 1: while the game is open but out of sight (another tab, the app minimised), a system notice when the
 *  opponent's move makes it this player's turn. Opt-in per device (Menu > Settings, or the home page). */
import { actorOf, type Game, type Side } from '../../engine/src';
const KEY = 'fab-notices';
/** The other player's move just made it `me`'s turn (to act alone, or in a step both sides play). */
export const turnOf = (g: Game, side: Side) => { const a = actorOf(g); return !g.over && (a === 'both' || a === side); };
export const handedOver = (prev: Game, next: Game, me: Side) => !turnOf(prev, me) && turnOf(next, me);
const supported = () => typeof Notification !== 'undefined';
export const noticesOn = () => { try { return supported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const noticesBlocked = () => supported() && Notification.permission === 'denied';
export const noticesSupported = supported;
/** Turn the notices on (asks the browser's permission: call it from a tap) or off. Returns a sentence for the player. */
export async function setNotices(on: boolean, idToken: () => Promise<string | null> = async () => null): Promise<string> {
  if (!supported()) return 'This browser cannot show notices. On iPhone, install the app first (Share, then Add to Home Screen).';
  if (!on) { try { localStorage.setItem(KEY, '0'); } catch { /* private mode */ } await pushOff(idToken).catch(() => {}); return 'Notices off on this device.'; }
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (p !== 'granted') return 'Notices are blocked for this site: allow them in the browser settings, then try again.';
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
  const push = await pushOn(idToken).catch(() => false);
  return push ? 'Notices on: you will be told when it is your move, even with the app closed.' : 'Notices on: you will be told when it is your move while the game is out of sight.';
}

/* ---- step 2: closed-app push through the relay (tools/push-worker), when the site is set up for it ---- */
const PUSH_URL = (import.meta.env.VITE_PUSH_URL as string | undefined)?.replace(/\/$/, ''), VAPID = import.meta.env.VITE_VAPID_PUBLIC as string | undefined;
export const pushAvailable = () => !!PUSH_URL && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window;
const key = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const post = (path: string, body: object) => fetch(`${PUSH_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function pushOn(idToken: () => Promise<string | null>) {
  if (!pushAvailable()) return false; const t = await idToken(); if (!t) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID!) }));
  return (await post('/subscribe', { idToken: t, sub: sub.toJSON() })).ok;
}
async function pushOff(idToken: () => Promise<string | null>) {
  if (!pushAvailable()) return; const reg = await navigator.serviceWorker.getRegistration(), sub = await reg?.pushManager.getSubscription(); if (!sub) return;
  const t = await idToken(); if (t) await post('/unsubscribe', { idToken: t, endpoint: sub.endpoint }); await sub.unsubscribe();
}
/** This player's move just handed the move to the opponent: ask the relay to push them (it checks both are seated at `table`). */
export async function pushNotify(table: string, idToken: () => Promise<string | null>) {
  if (!PUSH_URL) return; const t = await idToken(); if (t) void post('/notify', { idToken: t, table }).catch(() => {});
}
/** Show a notice when the page is out of sight. One 'fab-move' notice at a time: a newer one (or the closed-app push) replaces it. */
export async function moveNotice(title: string, body: string, _tag: string) {
  if (!noticesOn() || document.visibilityState === 'visible') return;
  const opts = { body, tag: 'fab-move', renotify: true, icon: './icons/app-192.png', badge: './icons/app-192.png', data: { url: location.href } };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return await reg.showNotification(title, opts as NotificationOptions); } catch { /* fall back below */ }
  try { const n = new Notification(title, opts as NotificationOptions); n.onclick = () => { focus(); n.close(); }; } catch { /* Android needs the service worker */ }
}
