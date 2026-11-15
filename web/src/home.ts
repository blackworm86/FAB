/** The home page: the shelf of volumes, your tables, a new game, the tutorials and sign-in. It loads without the 3D table (three.js),
 *  which main.ts brings in only when a game opens. Some of its parts (the sign-in panel, invites, the rules window) also serve the table's menu. */
import * as E from '../../engine/src';
import { translateDom, LANG, LANGS, setLang } from './i18n';
import { installKind, install, onInstallChange } from './install';
import { moveNotice, noticesOn, noticesSupported, setNotices } from './notices';
import { online, startOnline, auth, lobby, DEV, TABLE, type Match } from './online';
import { gameInfo, GAMES } from './games';
import { BOXES, boxFront, boxSpine } from './covers';
import { ico } from './icons';
import { esc } from './util';
import { setRulesContext, showRules, linkRules, RULES_GAMES } from './rules-link';
import { coursesOf } from './tutorial-list';
import databaseRules from '../../database.rules.json?raw';
import { acts, actv, resetActs, reg, regv, ubtn, btn, chip } from './ui-kit';
import { optChooser, optOn, rulesOf } from './opt-rules';

/** Each step of the turn by name (the game list and the table's log). */
export const STEP_NAME: Record<string, string> = {
  deploy: 'Set-up',
  reinforcement: 'Reinforcement',
  admin: 'Admin',
  movement: 'Movement',
  strategic: 'Strategic movement',
  combat: 'Combat',
  reaction: 'Reaction',
  btMove: 'Breakthrough movement',
  btCombat: 'Breakthrough combat',
  supply: 'Supply',
};
const GAME_PARAM = new URLSearchParams(location.search).get('game');
const $ = (s: string) => document.querySelector(s) as HTMLElement;
let noticeMsg = '',
  watched = false,
  matches: Match[] = [],
  modal: 'rules' | null = null,
  toast = '',
  toastInfo = false,
  authTab: 'in' | 'reg' = 'in'; // the sign-in panel's tab, kept across redraws
const form = {
  game: gameInfo(GAME_PARAM ?? '')?.ready ? GAME_PARAM! : 'bulge',
  title: '',
  side: '' as string,
  scenario: gameInfo(GAME_PARAM ?? '')?.defaultScenario ?? 'tournament',
  fuel: true,
  rules: {} as Partial<E.Opts>,
};
let homeMsg: string;
homeMsg = (() => {
  try {
    const m = sessionStorage.getItem('fab-notice') ?? '';
    sessionStorage.removeItem('fab-notice');
    return m;
  } catch {
    return '';
  }
})();
let creating = false;
{
  try {
    const sc = sessionStorage.getItem('fab-new');
    sessionStorage.removeItem('fab-new');
    const [gm, scn] = (sc ?? '').split(':'),
      gi = gameInfo(gm ?? '');
    if (gi?.ready && gi.scenarios.some((x) => x.id === scn)) {
      form.game = gm;
      form.scenario = scn;
      form.side = gi.sides[0];
      creating = true;
    }
  } catch {
    /* private mode */
  }
} // the tutorial's last buttons open a new game (game:scenario)
export const inviteLink = (id: string) => `${location.origin}${location.pathname}?table=${id}`;
export const homeUrl = () => location.pathname;
/** The invite sheet: the game code written large (to read out or type on the home page), the link to copy or share (owner's issue #2). */
export function share(
  id: string,
  title: string,
  say: (t: string) => void = (t) => {
    homeMsg = t;
    render();
  },
) {
  document.querySelector('.invite-sheet')?.remove();
  const url = inviteLink(id),
    el = document.createElement('div');
  el.className = 'modal invite-sheet';
  el.innerHTML = `<div class="sheet slim" role="dialog" aria-label="Invite a player"><h3>Invite a player <button class="ico" data-k="x" aria-label="Close">${ico('close')}</button></h3>
    <p class="hint">Send the link, or read out the code: it goes in the box Have an invitation? on the FAB home page.</p>
    <div class="invcode" aria-label="Game code">${esc(id)}</div>
    <div class="invqr" role="img" aria-label="QR code of the invite link"></div>
    <div class="row"><button class="primary" data-k="copy">Copy the link</button>${'share' in navigator ? '<button data-k="share">Share…</button>' : ''}</div>
    <p class="hint invurl">${esc(url)}</p></div>`;
  el.addEventListener('click', async (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
    if (e.target === el || k === 'x') return el.remove();
    try {
      if (k === 'copy') {
        await navigator.clipboard.writeText(url);
        say('Invite link copied');
      } else if (k === 'share') await navigator.share({ title: `FAB · ${title}`, text: 'Join my game of FAB', url });
    } catch {
      say(url);
    }
  });
  document.body.append(el);
  translateDom(el);
  void import('qrcode-generator').then(({ default: qr }) => {
    const q = qr(0, 'M'); // the link as a QR code, for a phone next to this screen (owner's issue #2); black on white so every camera reads it
    q.addData(url);
    q.make();
    el.querySelector('.invqr')!.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  });
}
export async function dropMatch(m: { id: string; title: string; owner: string }) {
  const own = m.owner === online.uid || online.admin;
  if (!confirm(own ? `Delete "${m.title}" for everyone? This cannot be undone.` : `Remove "${m.title}" from your games?`)) return;
  await (own ? lobby.remove(m.id) : lobby.leave(m.id));
  if (m.id === TABLE) location.href = homeUrl();
}
const SCEN_NAME: Record<string, string> = Object.fromEntries(GAMES.flatMap((x) => x.scenarios.map((sc) => [sc.id, sc.name])));
export const tableUrl = (id: string, game: string) => `${homeUrl()}?table=${id}${game && game !== 'bulge' ? `&game=${game}` : ''}`;
async function createGame() {
  const info = gameInfo(form.game);
  if (!info?.ready) return;
  const keep = new Set(rulesOf(info.id).map((r) => r.key as string)),
    chosen = Object.fromEntries(Object.entries(form.rules).filter(([k]) => keep.has(k))); // only this game's optional rules
  const opts: E.Opts = JSON.parse(
      JSON.stringify({
        ...(info.optional ? chosen : {}),
        scenario: form.scenario || info.defaultScenario,
        fuel: info.fuel ? form.fuel : false,
      }),
    ),
    title = form.title.trim() || `${info.name} · ${new Date().toLocaleDateString()}`;
  homeMsg = 'Creating…';
  render();
  E.useGame(info.id);
  const json = JSON.stringify(E.newGame(undefined, opts)); // the new game is of the chosen volume
  const id = await lobby.create(
    { game: form.game, title, opts },
    form.side ? (form.side === info.sides[0] ? 'german' : 'allied') : null,
    json,
  );
  if (id.startsWith('!')) {
    homeMsg = id.slice(1);
    return render();
  }
  location.href = tableUrl(id, form.game);
}
function joinByCode(v: string) {
  const m = v.trim().match(/[?&]table=([\w-]+)/)?.[1] ?? v.trim();
  if (!/^[\w-]{3,40}$/.test(m)) {
    homeMsg = 'Paste the invite link or the game code.';
    return render();
  }
  location.href = `${homeUrl()}?table=${m}`; // only the code: the game it belongs to comes from the database (main.ts reloads as that game)
}
const stateOf = (m: Match) => (m.germanName && m.alliedName ? 'In play' : 'Waiting for an opponent');
/** The first screen: never on top of a game. Signed out it is just the sign-in; signed in it is your games, a new game and a way to join one. */
export const tutUrl = (course: string) => `${homeUrl()}?tutorial=${course}`;
/** Learn to play and the rules reference of a volume: one thin line of two quiet buttons (one per course). Works offline. */
const learnRow = (game: string) => {
  const cs = coursesOf(game);
  return !cs.length && !RULES_GAMES.includes(game)
    ? ''
    : `<nav class="learnrow" aria-label="Learn to play">${cs
        .map((c) => {
          let at = 0;
          try {
            at = Number(localStorage.getItem(`fab-tut:${c.id}`) ?? 0) || 0;
          } catch {
            /* private mode */
          }
          return ubtn(
            `${ico('flag')}<span><b>Learn to play</b><small>${at ? '<em>Resume</em> · ' : ''}<i>${parseInt(c.sub)} lessons · ${c.minutes} min</i></small></span>`,
            () => {
              location.href = tutUrl(c.id);
            },
            '',
            false,
            `${c.title}: an interactive tutorial on the Play Book examples`,
          );
        })
        .join('')}${
        RULES_GAMES.includes(game)
          ? ubtn(
              `${ico('book')}<span><b>Rules reference</b><small>Searchable</small></span>`,
              () => {
                void openReader(game);
              },
              '',
              false,
              'Open the rules reference',
            )
          : ''
      }</nav>`;
};
/** The invitation code, one line under the title, signed in or not: a code opens its own game whatever battle is chosen. */
const codeBar = () =>
  `<div class="codebar"><label for="join">Have an invitation?</label><input id="join" placeholder="Code or link" autocomplete="off" autocapitalize="off" enterkeyhint="go">${ubtn(
    `<span>Join</span>${ico('next')}`,
    () => {
      joinByCode(($('#join') as HTMLInputElement).value);
    },
    'primary',
    false,
    'Join a game with an invite',
  )}</div>`;
const WHEN: Record<string, string> = Object.fromEntries(GAMES.map((x) => [x.id, x.when]));
/** The shelf: one box cover per FAB volume; tapping one shows that volume's tables (option A of the home mockup). */
function shelfHtml() {
  const pick = (id: string) =>
    reg(() => {
      form.game = id;
      form.scenario = gameInfo(id)?.defaultScenario ?? '';
      form.side = '';
      creating = false;
    });
  const st = (x: { ready: boolean }) => `<span class="cst ${x.ready ? 'ready' : 'soon'}">${x.ready ? 'Play' : 'Soon'}</span>`;
  const spines = `<div class="spines" role="group" aria-label="Choose a battle">${GAMES.map((x, i) => `<button class="spine ${x.ready ? '' : 'soon'}" style="--off:${[0, 10, 4][i] ?? 0}px" aria-pressed="${form.game === x.id}" data-ui="${pick(x.id)}" aria-label="${esc(x.name)}, ${x.ready ? 'ready to play' : 'in preparation'}">${boxSpine(BOXES[i])}${st(x)}</button>`).join('')}</div>`;
  return `<h2 class="sec">Choose a battle</h2>${spines}<div class="shelf">${GAMES.map((x, i) => `<button class="cover ${x.ready ? '' : 'soon'}" aria-pressed="${form.game === x.id}" data-ui="${pick(x.id)}" aria-label="${esc(x.name)}, ${x.ready ? 'ready to play' : 'in preparation'}">${boxFront(BOXES[i])}${st(x)}</button>`).join('')}</div>`;
}
const soonCard = (x: { name: string; id: string }) =>
  `<section class="card soonbox"><h2>${esc(x.name)} is in preparation</h2><p class="hint">Rules, map and counters are being transcribed. You'll be able to play it here when the engine supports it.</p><p class="hint">${esc(WHEN[x.id] ?? '')}</p><div class="row">${ubtn(
    'Go to The Bulge',
    () => {
      form.game = 'bulge';
      form.scenario = 'tournament';
    },
  )}</div></section>`;
function homeHtml() {
  const a = online.account,
    signed = !!a && !a.guest,
    info = gameInfo(form.game),
    ready = !!info?.ready;
  const head = `<header class="hbar"><div><h1>Fast Action Battles</h1><p>Board-game battles with the series rules, played online.</p></div></header>`,
    learn = !ready ? soonCard(info!) : learnRow(form.game),
    msgs = `${homeMsg ? `<p class="hint"><b>${esc(homeMsg)}</b></p>` : ''}${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}`; // right under the code line: next to the field or the sign-in they are about
  if (!online.ready)
    return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}${shelfHtml()}<p class="hint">Connecting…</p></div></div>`;
  if (online.mode !== 'remote' || !online.hasAccounts)
    return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}${shelfHtml()}<section class="card"><p class="hint">Online play is not set up on this site.${online.error ? ' ' + esc(online.error) : ''}</p></section>${learn}</div></div>`;
  if (!signed)
    return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">${head}${codeBar()}${msgs}<section class="card signcard" aria-label="Sign in">${accountHtml()}${
      (() => {
        try {
          return sessionStorage.getItem('fab-next');
        } catch {
          return null;
        }
      })()
        ? '<p class="hint">You will go straight back to the game you were invited to.</p>'
        : '<p class="hint">To create a game or join one. Anyone can watch a game from its link.</p>'
    }</section>${shelfHtml()}${learn}</div></div>`;
  const mine =
    matches
      .filter((m) => (m.game ?? 'bulge') === form.game)
      .sort((x, y) => +!!y.myMove - +!!x.myMove)
      .map(
        (m, mi) =>
          `<div class="matchrow ${m.myMove ? 'yours' : ''}"><button class="open" data-do="${reg(() => {
            location.href = tableUrl(m.id, m.game ?? 'bulge');
          })}"><b>${esc(m.title)}${m.myMove ? '<span class="stampy">Your move</span>' : ''}</b><small class="seats"><span class="st ${m.germanName && m.alliedName ? 'live' : 'wait'}" aria-hidden="true"></span><small class="stw">${esc(stateOf(m))}</small><b>${info!.tag[info!.sides[0]]}</b> ${esc(m.germanName || '—')} <b>${info!.tag[info!.sides[1]]}</b> ${esc(m.alliedName || '—')}</small><small class="mrules">${SCEN_NAME[(m.opts as Partial<E.Opts> | undefined)?.scenario ?? 'tournament'] ?? ''}${(m.opts as Partial<E.Opts> | undefined)?.fuel === false ? ' · no fuel rule' : ''}${
            optOn(m.opts as Partial<E.Opts>, m.game ?? 'bulge').length
              ? ` · optional ${optOn(m.opts as Partial<E.Opts>, m.game ?? 'bulge')
                  .map((r) => r.rule)
                  .join(', ')}`
              : ''
          }</small></button><div class="row">${
            m.over
              ? btn(
                  `${ico('dice')}`,
                  () => {
                    location.href = `${tableUrl(m.id, m.game ?? 'bulge')}&replay=1`;
                  },
                  'ico',
                  false,
                  'Watch the replay of this finished game',
                )
              : ''
          }${btn(
            m.germanName && m.alliedName ? ico('share') : `${ico('share')}Invite`, // an empty seat: the button says what it is for
            () => {
              void share(m.id, m.title);
            },
            m.germanName && m.alliedName ? 'ico' : 'word',
            false,
            'Invite a player',
          )}${btn(
            `${ico('trash')}`,
            () => {
              void dropMatch(m);
            },
            'ico danger',
            false,
            m.owner === online.uid || online.admin ? 'Delete this game for everyone' : 'Remove from my list',
          )}</div>${
            m.myMove
              ? `<button class="${mi === 0 ? 'go' : 'primary'} resume" data-do="${reg(() => {
                  location.href = tableUrl(m.id, m.game ?? 'bulge');
                })}">Resume${m.turn ? ` turn ${m.turn}` : ''}${m.step && STEP_NAME[m.step] ? ` · ${STEP_NAME[m.step]}` : ''}${ico('next')}</button>`
              : ''
          }</div>`,
      )
      .join('') || '<p class="hint">No games yet: tap New game for an online table.</p>';
  const tile = (v: string, label: string, tag: string) =>
    `<button class="tile ${form.side === v ? 'on' : ''} ${v}" aria-pressed="${form.side === v}" data-ui="${reg(() => {
      form.side = v;
    })}" title="${label}"><b>${tag}</b><small>${label}</small></button>`;
  const create = creating
    ? `<div class="sheetbox"><div class="lh"><h3>${ico('plus')} New game</h3>${ubtn(
        ico('close'),
        () => {
          creating = false;
        },
        'ico',
        false,
        'Cancel',
      )}</div>
      <div class="authform"><input placeholder="Name (optional)" value="${esc(form.title)}" data-sel="${regv((x) => {
        form.title = x;
      })}"></div>
      <div class="tiles">${info!.sides.map((sd) => tile(sd, info!.sideName[sd], info!.tag[sd])).join('')}${tile('', 'Later', '?')}</div>
      <div class="chips"><div class="scens">${info!.scenarios
        .filter((sc) => !sc.testing)
        .map((sc) =>
          chip(
            `${esc(sc.name)}<small>${esc(sc.sub)}</small>`,
            form.scenario === sc.id,
            () => {
              form.scenario = sc.id;
            },
            sc.title,
          ),
        )
        .join('')}</div>${
        info!.fuel
          ? `<div class="optrules fuelrow"><button class="orow tog ${form.fuel ? 'on' : ''}" aria-pressed="${form.fuel}" data-ui="${reg(
              () => {
                form.fuel = !form.fuel;
              },
            )}"><span class="orn">16.13</span><span class="ort"><b>German fuel</b><small>Moves over 3 MP and strategic moves spend a fuel asset.</small></span><span class="sw ${form.fuel ? 'on' : ''}">${form.fuel ? 'ON' : 'OFF'}</span></button></div>`
          : ''
      }</div>${info!.optional ? optChooser(form.rules, form.game) : ''}
      <div class="row createrow">${btn(
        `${ico('check')}<span>Create game</span>`,
        () => {
          void createGame();
        },
        'primary',
        !info?.ready,
      )}</div></div>`
    : '';
  return `<div class="homepage" style="background-image: radial-gradient(ellipse at 55% 35%, #0b0d0866 0%, #0b0d08d9 62%, #0b0d08 100%), url('./home-table.jpg')"><div class="homein">
    <header class="hbar"><div><h1>Fast Action Battles</h1></div><div class="who"><span class="avatar" aria-hidden="true">${esc((a!.name || a!.email || '?').slice(0, 1).toUpperCase())}</span><span class="nm notr">${esc(a!.name || a!.email)}</span>${
      online.admin
        ? ubtn(
            ico('wand'),
            () => {
              location.href = `${homeUrl()}?sandbox=1&game=${form.game}${DEV ? '&dev=1' : ''}`;
            },
            'ico',
            false,
            'Admin: sandbox test table',
          ) +
          ubtn(
            ico('lock'),
            () => {
              modal = 'rules';
            },
            'ico',
            false,
            'Admin: update the database rules',
          )
        : ''
    }<button class="word" data-auth="out">${ico('logout')}Sign out</button></div></header>
    ${codeBar()}${msgs}${shelfHtml()}${
      ready
        ? `<section class="card"><div class="lh"><h2>${ico('users')} ${esc(info!.name)} · your games</h2>${
            creating
              ? ''
              : ubtn(
                  `${ico('plus')}<span>New game</span>`,
                  () => {
                    creating = true;
                  },
                  'primary',
                  false,
                  'Start a new game',
                )
          }</div>${create}${mine}</section>`
        : ''
    }
    ${learn}
  </div></div>`;
}
/** Sign-in panel (Firebase only): Google, or email and password; guests can watch but not play. */
export function accountHtml() {
  if (!online.hasAccounts) return '';
  const a = online.account;
  if (a && !a.guest)
    return `<h4>Account</h4><p class="hint">Signed in as <b>${esc(a.name || a.email)}</b>${a.email ? ' · ' + esc(a.email) : ''}${a.admin ? ' · <b>admin</b>' : ''}</p><div class="row"><button data-auth="out">Sign out</button>${
      noticesSupported()
        ? ubtn(
            `<span class="sw ${noticesOn() ? 'on' : ''}">${noticesOn() ? 'ON' : 'OFF'}</span> Your-move notices`,
            () => {
              void setNotices(!noticesOn(), auth.token).then((m) => {
                noticeMsg = m;
                document.dispatchEvent(new Event('fab-redraw'));
              });
            },
            noticesOn() ? 'on' : '',
            false,
            'A system notice when the other player hands you the move, while a game or this page is open out of sight (this device only)',
          )
        : ''
    }</div>${noticeMsg ? `<p class="hint">${esc(noticeMsg)}</p>` : ''}`;
  // two tabs over one form: the class `reg` shows the name field and swaps the main button, so what is typed stays (bindAuth switches it)
  const tab = (k: 'in' | 'reg', t: string) => `<button role="tab" data-tab="${k}" aria-selected="${authTab === k}">${t}</button>`;
  return `<div class="signin${authTab === 'reg' ? ' reg' : ''}"><div class="tabs" role="tablist">${tab('in', 'Sign in')}${tab('reg', 'Create account')}</div>
    <button class="wide" data-auth="google">Continue with Google</button><div class="or">or with email</div>
    <div class="authform"><label class="regonly">Your name in games (optional)<input id="a-name" autocomplete="name"></label>
    <label>Email<input id="a-mail" type="email" autocomplete="email"></label>
    <label><span class="inonly">Password</span><span class="regonly">Password (6+ characters)</span><input id="a-pass" type="password" autocomplete="${authTab === 'reg' ? 'new-password' : 'current-password'}" enterkeyhint="go"></label>
    <button class="primary wide inonly" data-auth="in">Sign in</button><button class="primary wide regonly" data-auth="reg">Create account</button>
    <button class="textlink inonly" data-auth="reset">Forgot password?</button></div></div>`;
}
/** The rules this version of the site expects (database.rules.json), as pretty text and as one line. */
const rulesText = databaseRules;
const rulesOne = () => JSON.stringify(JSON.parse(rulesText));
const rulesLink = () => {
  const p = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    u = (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined) ?? '';
  let name = '';
  try {
    name = new URL(u).hostname.split('.')[0];
  } catch {
    /* not configured */
  }
  return `https://console.firebase.google.com/project/${p}/database/${name}/rules`;
};
async function copyText(t: string, what: string, say: (t: string, ok: boolean) => void) {
  try {
    await navigator.clipboard.writeText(t);
    say(`${what} copied`, true);
  } catch {
    say('Copy failed: select the text below and copy it by hand', false);
  }
}
/** The admin's "update the database rules" window. `back`: the window the close button returns to ('' = none). */
export function rulesHtml(back: string, say: (t: string, ok: boolean) => void) {
  return `<div class="modal"><div class="sheet"><h3>Update Firebase rules <button class="ico" data-modal="${back}" aria-label="Back">${ico('close')}</button></h3>
    <p class="hint">These are the rules this version of the site expects. Copy them, open the Firebase rules editor, replace everything there with them and press Publish.</p>
    <div class="row"><a class="primary" href="${rulesLink()}" target="_blank" rel="noopener" style="padding:8px 12px;text-decoration:none">Open Firebase rules ↗</a>${btn(
      'Copy expanded',
      () => {
        void copyText(rulesText, 'Rules', say);
      },
    )}${btn('Copy single line', () => {
      void copyText(rulesOne(), 'Single-line rules', say);
    })}</div>
    <h4>Expanded</h4><textarea readonly rows="10" style="width:100%;font:12px monospace">${esc(rulesText)}</textarea>
    <h4>Single line</h4><textarea readonly rows="4" style="width:100%;font:12px monospace">${esc(rulesOne())}</textarea></div></div>`;
}

/** The rules reference of a volume, opened from its learn card (the piece art comes with the volume's drawings, loaded now). */
async function openReader(game: string) {
  const VM = await import('./vol'),
    V = VM.useVolume(game);
  let g0: E.Game | null = null;
  setRulesContext({
    game,
    title: gameInfo(game)?.name ?? game,
    art: (k) => V.ruleArt(k, (g0 ??= (E.useGame(game), E.newGame()))),
    fig: () => VM.figKit(V, (g0 ??= (E.useGame(game), E.newGame()))),
  });
  void showRules();
}
/** The sign-in buttons (here and in the table's menu). */
export function bindAuth(ui: HTMLElement) {
  ui.querySelectorAll<HTMLElement>('[data-auth]').forEach(
    (e) =>
      (e.onclick = () => {
        const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '',
          k = e.dataset.auth;
        if (k === 'google') void auth.google();
        else if (k === 'out') void auth.signOut();
        else if (k === 'in') void auth.signIn(v('a-mail'), v('a-pass'));
        else if (k === 'reg') void auth.register(v('a-mail'), v('a-pass'), v('a-name'));
        else if (k === 'reset') void auth.reset(v('a-mail'));
      }),
  );
  ui.querySelectorAll<HTMLElement>('.signin [data-tab]').forEach(
    (t) =>
      (t.onclick = () => {
        const box = t.closest('.signin')!;
        authTab = t.dataset.tab as typeof authTab;
        box.classList.toggle('reg', authTab === 'reg');
        box.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
        box.querySelector('#a-pass')!.setAttribute('autocomplete', authTab === 'reg' ? 'new-password' : 'current-password');
      }),
  );
  const pass = ui.querySelector<HTMLElement>('.signin #a-pass');
  if (pass)
    pass.onkeydown = (e) => {
      if (e.key !== 'Enter') return; // Enter presses the tab's main button
      pass.blur(); // as a tap on the button does: the page may redraw, to show a wrong password
      ui.querySelector<HTMLElement>(`.signin [data-auth="${authTab}"]`)?.click();
    };
}
const notice = (t: string, ok: boolean) => {
  toast = t;
  toastInfo = ok;
  render();
  setTimeout(() => {
    toast = '';
    render();
  }, 2500);
};
/** 4.6: English or Italian, at the foot of the page. */
const langHtml = () =>
  `<div class="langchip notr" role="group" aria-label="Language">${LANGS.map(([l, n]) => `<button type="button" aria-pressed="${LANG === l}" data-ui="${reg(() => setLang(l))}" title="${n}">${l.toUpperCase()}</button>`).join('')}</div>`;
/** 4.2: install the site as an app, where the browser offers it (or the iPhone steps). */
function installHtml() {
  const k = installKind();
  if (!k) return '';
  const fn =
    k === 'prompt'
      ? () => {
          void install();
        }
      : () => notice('On iPhone or iPad: tap Share, then Add to Home Screen.', true);
  return `<button class="installchip" data-ui="${reg(fn)}" title="Install Fast Action Battles as an app on this device">${ico('install')}<span>Install app</span></button>`;
}
/* A tap must land on the button it started on: while a finger or mouse is down on a button, redraws wait. */
let pressing = false,
  waiting = false;
function render() {
  if (pressing) {
    waiting = true;
    return;
  }
  waiting = false;
  if (document.activeElement?.closest?.('.authform, .codebar')) return; // do not wipe what is being typed
  resetActs();
  const ui = $('#ui'),
    typed = ['join', 'a-name', 'a-mail', 'a-pass'].map(
      (id) => [id, (document.getElementById(id) as HTMLInputElement | null)?.value] as const,
    ); // a redraw (a wrong password, a live update) keeps what was typed
  document.body.classList.toggle('caninstall', !!installKind()); // room at the foot of the page for the install button
  const keep = ui.querySelector<HTMLElement>('.homepage')?.scrollTop ?? 0; // picking a game or a live lobby update redraws the page: it keeps its place
  ui.innerHTML =
    (modal === 'rules' ? rulesHtml('', notice) : '') +
    homeHtml() +
    installHtml() +
    langHtml() +
    (toast ? `<div class="toast${toastInfo ? ' info' : ''}" role="status">${esc(toast)}</div>` : '');
  for (const [id, v] of typed) {
    const e = document.getElementById(id) as HTMLInputElement | null;
    if (e && v) e.value = v;
  }
  translateDom(ui);
  linkRules(ui);
  {
    const j = ui.querySelector<HTMLInputElement>('#join');
    if (j)
      j.onkeydown = (e) => {
        if (e.key !== 'Enter') return; // Enter presses Join
        j.blur(); // so the page may redraw, to say a code is wrong
        joinByCode(j.value);
      };
  }
  {
    const h = ui.querySelector<HTMLElement>('.homepage');
    if (h) h.scrollTop = keep;
  }
  ui.querySelectorAll<HTMLElement>('[data-ui], [data-do]').forEach(
    (e) =>
      (e.onclick = () => {
        acts[e.dataset.ui ?? e.dataset.do!]?.();
        render();
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-modal]').forEach(
    (e) =>
      (e.onclick = () => {
        modal = (e.dataset.modal || null) as typeof modal;
        render();
      }),
  );
  ui.querySelectorAll<HTMLElement>('[data-sel]').forEach(
    (e) =>
      (e.onchange = () =>
        actv[e.dataset.sel!]?.(
          e instanceof HTMLInputElement && e.type === 'checkbox' ? (e.checked ? 'on' : 'off') : (e as HTMLSelectElement).value,
        )),
  );
  bindAuth(ui);
}
/** Start the home page. `local`: no online play is set up on this site (development): open the local table instead. */
export function startHome(local: () => void) {
  onInstallChange(() => render());
  document.addEventListener('fab-redraw', () => render());
  (document.getElementById('gl') as HTMLElement).style.display = 'none';
  document.addEventListener(
    'pointerdown',
    (e) => {
      pressing = !!(e.target as HTMLElement).closest?.('#ui button, #ui [role=button]');
    },
    true,
  );
  const release = () => {
    if (!pressing) return;
    pressing = false;
    if (waiting)
      setTimeout(() => {
        if (waiting && !pressing) render();
      }, 0);
  };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', release);
  let lobbyUid = '',
    left = false;
  render();
  void startOnline(
    () => {},
    () => {
      if (left) return;
      if (online.ready && online.mode === 'local') {
        left = true;
        local();
        return;
      }
      if (online.mode === 'remote' && online.hasAccounts && lobbyUid !== online.uid) {
        lobbyUid = online.uid;
        lobby.watch((m) => {
          const was = new Set(matches.filter((x) => x.myMove).map((x) => x.id)),
            first = !watched;
          watched = true; // 4.3: a game that just became this player's move
          if (!first)
            for (const x of m)
              if (x.myMove && !was.has(x.id))
                void moveNotice(
                  `Your move · ${x.title}`,
                  `Turn ${x.turn ?? ''}${x.step && STEP_NAME[x.step] ? ` · ${STEP_NAME[x.step]}` : ''}`,
                  `fab-${x.id}`,
                );
          matches = m;
          render();
        });
      }
      const next = (() => {
        try {
          return sessionStorage.getItem('fab-next');
        } catch {
          return null;
        }
      })();
      if (next && online.account && !online.account.guest) {
        try {
          sessionStorage.removeItem('fab-next');
        } catch {
          /* private mode */
        }
        location.href = `${homeUrl()}?table=${next}`;
        return;
      } // back to the invite that sent you to sign in
      render();
    },
    (t) => {
      homeMsg = t;
      render();
    },
  );
}
