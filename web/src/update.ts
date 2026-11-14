/** After the site is published while a page stays open, the page can mix two versions: a file the old code asks for is gone,
 *  or the service worker hands back an old copy beside a new one, and the maps come up blank. When a load fails, this asks the
 *  server whether a newer version is out (its entry script has another name); if so the page says so and reloads, once. */
import { tr } from './i18n';

let checking = false;
export async function checkUpdate(): Promise<boolean> {
  if (checking) return false;
  checking = true;
  try {
    const mine = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src,
      html = await fetch(`${location.pathname}?fresh=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text()),
      src = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1],
      theirs = src && new URL(src, location.href).href;
    if (!mine || !theirs || theirs === mine) return false;
    const key = `fab-updated:${theirs}`;
    if (sessionStorage.getItem(key)) return false; // already reloaded once for this version: never a loop
    sessionStorage.setItem(key, '1');
    const note = document.createElement('div');
    note.className = 'updnote';
    note.setAttribute('role', 'status');
    note.textContent = tr('Updating to the new version…');
    document.body.appendChild(note);
    setTimeout(() => location.reload(), 900);
    return true;
  } catch {
    return false;
  } finally {
    checking = false;
  }
}
/** A piece of code loaded later (a game, the rules, the 3D map) failed to arrive: most likely the site changed under the page. */
export function watchUpdates() {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    void checkUpdate();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (
      /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
        String((e.reason as Error)?.message ?? e.reason),
      )
    )
      void checkUpdate();
  });
}
