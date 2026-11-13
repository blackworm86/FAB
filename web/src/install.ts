/** Installing the site as an app (4.2): the service worker for offline start, and the browser's install offer.
 *  Chrome, Edge and Android offer it through `beforeinstallprompt`; iPhone and iPad Safari only through Share → Add to Home Screen. */
type Offer = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let offer: Offer | null = null,
  onChange = () => {};
const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function setupInstall() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      /* no offline start: the site still works */
    });
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as Offer;
    onChange();
  });
  addEventListener('appinstalled', () => {
    offer = null;
    onChange();
  });
}
/** What the home page can offer: the browser's own install dialog, the iPhone steps, or nothing (already installed, or not offered). */
export const installKind = (): 'prompt' | 'ios' | null => (standalone() ? null : offer ? 'prompt' : ios() ? 'ios' : null);
export async function install() {
  const o = offer;
  if (!o) return;
  offer = null;
  await o.prompt();
  await o.userChoice.catch(() => null);
  onChange();
}
export const onInstallChange = (f: () => void) => {
  onChange = f;
};
