/** The entry point. A game page (a shared table, the sandbox, a tutorial, a development table) loads the 3D table (main.ts);
 *  the home page loads without it, so the first screen arrives quickly. */
import { HAS_TABLE, SANDBOX, TUTORIAL, DEV_FAKE } from './online';
import { setupInstall } from './install';
import { loadLang } from './i18n';

setupInstall();

void loadLang().catch(() => {}).then(() => {                                                      // the Italian dictionary first (4.6), then the page
  if (HAS_TABLE || SANDBOX || TUTORIAL || DEV_FAKE) void import('./main');
  else void import('./home').then((h) => h.startHome(() => { void import('./main'); }));
});       // no online play set up (development): the local table
