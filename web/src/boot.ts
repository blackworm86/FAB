/** The entry point. A game page (a shared table, the sandbox, a tutorial, a development table) loads the 3D table (main.ts);
 *  the home page loads without it, so the first screen arrives quickly. */
import { HAS_TABLE, SANDBOX, TUTORIAL, DEV_FAKE, LAB } from './online';
import { setupInstall } from './install';
import { loadLang } from './i18n';
import { watchUpdates } from './update';

setupInstall();
watchUpdates();
// The old computer opponent's games, removed from the site: cleared from this browser's storage (a no-op once they are gone).
try {
  for (const k of Object.keys(localStorage)) if (/^fab-(solo|cpu)|^fab-journal:fab-(solo|cpu)/.test(k)) localStorage.removeItem(k);
} catch {
  /* storage off */
}

void loadLang()
  .catch(() => {})
  .then(() => {
    // the Italian dictionary first (4.6), then the page
    if (HAS_TABLE || SANDBOX || TUTORIAL || DEV_FAKE || LAB) void import('./main');
    else
      void import('./home').then((h) =>
        h.startHome(() => {
          void import('./main');
        }),
      );
  }); // no online play set up (development): the local table
