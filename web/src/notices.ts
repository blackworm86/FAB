/** 4.3 "Your move" notices, step 1: while the game is open but out of sight (another tab, the app minimised), a system notice when the
 *  opponent's move makes it this player's turn. Opt-in per device (Menu > Settings, or the home page). */
import { actorOf, type Game, type Side } from '../../engine/src';
const KEY = 'fab-notices';
/** The other player's move just made it `me`'s turn (to act alone, or in a step both sides play). */
export function handedOver(prev: Game, next: Game, me: Side) {
  const mine = (x: Game) => { const a = actorOf(x); return !x.over && (a === 'both' || a === me); };
  return !mine(prev) && mine(next);
}
const supported = () => typeof Notification !== 'undefined';
export const noticesOn = () => { try { return supported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const noticesBlocked = () => supported() && Notification.permission === 'denied';
export const noticesSupported = supported;
/** Turn the notices on (asks the browser's permission: call it from a tap) or off. Returns a sentence for the player. */
export async function setNotices(on: boolean): Promise<string> {
  if (!supported()) return 'This browser cannot show notices. On iPhone, install the app first (Share, then Add to Home Screen).';
  if (!on) { try { localStorage.setItem(KEY, '0'); } catch { /* private mode */ } return 'Notices off on this device.'; }
  const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (p !== 'granted') return 'Notices are blocked for this site: allow them in the browser settings, then try again.';
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
  return 'Notices on: you will be told when it is your move while the game is out of sight.';
}
/** Show a notice when the page is out of sight. `tag` keeps one notice per game (a newer one replaces it). */
export async function moveNotice(title: string, body: string, tag: string) {
  if (!noticesOn() || document.visibilityState === 'visible') return;
  const opts: NotificationOptions = { body, tag, icon: './icons/app-192.png', badge: './icons/app-192.png', data: { url: location.href } };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return await reg.showNotification(title, opts); } catch { /* fall back below */ }
  try { const n = new Notification(title, opts); n.onclick = () => { focus(); n.close(); }; } catch { /* Android needs the service worker */ }
}
