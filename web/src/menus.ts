// The windows: seats, framing the map round open panels, the View window, the log, and the Game menu with its tabs.
import * as THREE from 'three';
import { LANG, LANGS, setLang } from './i18n';
import * as E from '../../engine/src';
import { online, sit, auth, TABLE, SANDBOX, TUTORIAL, seatOf, seatName, type Match } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { modIcon, modWord } from './table-text';
import { reg, regv, ubtn, chip, srow, swtch } from './ui-kit';
import { setZoom } from './troops';
import { optChooser, optOn } from './opt-rules';
import { noticesOn, noticesBlocked, noticesSupported, setNotices } from './notices';
import { STEP_NAME, homeUrl, tutUrl, share, dropMatch, rulesHtml } from './home';
import { showRules, RULES_GAMES } from './rules-link';
import { coursesOf } from './tutorial-script';
import { LAB_SIDE, lab, labClear, labDownload, recordKey } from './lab';
import { MAP, MH, MW, P1, P2, toWorld, VOL } from './page';
import { g, newOpts, save, setG, setSelArea, setSelChit, setSelUnit } from './game-state';
import { cam, canvas } from './scene';
import { map3d, setMap3d } from './map3d';
import { FIG_VOLS, setTroopSize, setTroopsOn, troopSize, troopsOn } from './piece-kit';
import { paintAreas, paintBoard, saveLayers, supOk, viewRot } from './map-paint';
import { dist, pitch, setYaw, target, yaw } from './camera';
import { hist, say, setNote, setSelArr, setToast, setToastInfo } from './flow';
import { followFoe, setFollowFoe } from './choices';
import { center, clampDist, goal, setGoal, setInBattle } from './map-input';
import { badgeList, setBadges, syncBadges } from './routes';
import { menuTab, modal, restartAsk, setMenuTab, setModal, setRestartAsk } from './rolls';
import { COARSE, guide, setGuide } from './prompt';
import { piecesHtml } from './pieces-window';
import { inGame, refresh, render } from './main';

/* ---------- home: sign in, your games, a new game, join ---------- */
export let matches: Match[] = []; // your games (the lobby): the table's title in the menu
export const setMatches = <T extends typeof matches>(v: T): T => ((matches = v), v);
/** The optional rules a game uses, as short tags ('18.1 Bridge repair limits', 'bid +2'). */
function rulesInUse(o: Partial<E.Opts>, extra = true): string {
  const on = optOn(o, VOL.id);
  if (!on.length) return '<span class="hint">Optional rules: none</span>';
  return `<span class="rulesuse">${on.map((r) => `<span title="${esc(r.text)}">${r.rule} ${esc(r.key === 'bid' ? `Bid ${o.bid! > 0 ? '+' : ''}${o.bid}` : r.name)}</span>`).join('')}${extra && o.bridgeLimit && inGame() ? `<span>German bridge repairs left: ${g.bridgesLeft ?? 6}</span>` : ''}</span>`;
}
/** A slim bar over the table when you are not seated, or while you wait for an opponent. */
export function seatBar() {
  if (LAB_SIDE)
    return `<div class="seatbar" title="${esc(lab.reason)}"><span>${ico('info')} Computer: ${nm(LAB_SIDE)}${lab.thinking ? ' · thinking…' : ''}${lab.reason ? ` · <small>${esc(lab.reason.split(' (')[0].split(': judged')[0])}</small>` : ''}</span></div>`; // the full reason on hover: a phone keeps the map
  if (online.mode !== 'remote' || !online.hasAccounts) return '';
  if (online.error)
    return `<div class="seatbar err"><span>${esc(online.error)}</span>${ubtn('OK', () => {
      online.error = '';
    })}</div>`;
  const a = online.account,
    me = online.mySide(),
    s = online.seats,
    title = matches.find((m) => m.id === TABLE)?.title ?? 'a game of FAB';
  if (!a || a.guest)
    return `<div class="seatbar"><span>You are watching.</span>${ubtn(
      'Sign in to play',
      () => {
        try {
          sessionStorage.setItem('fab-next', TABLE);
        } catch {
          /* private mode */
        }
        location.href = homeUrl();
      },
      'primary',
    )}</div>`;
  if (!me) {
    const free = VOL.sides.filter((x) => !seatOf(s, x));
    return `<div class="seatbar"><span>${free.length ? 'Take a seat:' : 'Both seats are taken. You are watching.'}</span>${free
      .map((x) =>
        ubtn(
          `Play ${nm(x)}`,
          () => {
            void sit(x);
          },
          'primary',
        ),
      )
      .join('')}</div>`;
  }
  if (!s.german || !s.allied)
    return `<div class="seatbar"><span>Waiting for your opponent.</span>${ubtn(
      `${ico('share')} Invite`,
      () => {
        void share(TABLE, title, say);
      },
      'primary',
    )}</div>`;
  return '';
}
export const modChips = (parts: [string, number][]) =>
  parts
    .map(
      ([w, v]) =>
        `<span class="m2 ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" role="button" tabindex="0" data-ui="${reg(() => say(`${v > 0 ? '+' : '−'}${Math.abs(v)}: ${w}`, true))}" title="${esc(w)}" aria-label="${esc(`${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)}, ${w}`)}">${ico(modIcon(w))}${v > 0 ? '+' : v < 0 ? '−' : ''}${v ? Math.abs(v) : ''}${modWord(w) ? ` <small>${modWord(w)}</small>` : ''}</span>`,
    )
    .join('');
/** A toggle chip. With `icon` the icon replaces the tick; with an empty label it is icon-only and `title` names it. */
export const relayer = () => {
  saveLayers();
  paintBoard();
  paintAreas();
  setBadges(g.battle ? [] : badgeList());
  syncBadges();
}; // the source labels come and go with the Supply layer
/** The camera takes in all the areas a side holds (the supply colour then always shows something). */
/** Where a full-map game opens: the middle of the blocks on the map (the front), so no game opens on its empty margin. */
export function openingTarget() {
  const ps = g.units.filter((u) => u.area != null && MAP.areas.some((a) => a.id === u.area)).map((u) => center(u.area!));
  if (!ps.length) {
    const p = toWorld(MW / 2, MH / 2);
    return new THREE.Vector3(p.x, 0, p.z);
  }
  const xs = ps.map((p) => p.x),
    zs = ps.map((p) => p.z);
  return new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
}
/** The opening view: the whole map, or a scenario's own sheet (its play area) framed from above. */
export function homeGoal() {
  const ids = g.inPlay ? MAP.areas.filter((a) => g.inPlay!.includes(a.id)).flatMap((a) => a.polygon.map(([x, y]) => toWorld(x, y))) : []; // every corner of the sheet
  if (!ids.length) return { t: openingTarget(), dist: innerWidth < 700 ? 52 : 36, pitch: 1.0 };
  const x0 = Math.min(...ids.map((p) => p.x)),
    x1 = Math.max(...ids.map((p) => p.x)),
    z0 = Math.min(...ids.map((p) => p.z)),
    z1 = Math.max(...ids.map((p) => p.z));
  return {
    t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2),
    dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * (innerWidth < 700 ? 1.7 : 1.12) + 3),
    pitch: 1.0,
  };
}
export function frameSide(sd: E.Side) {
  const ids = MAP.areas.filter((a) => g.control[a.id] === sd && (!g.inPlay || g.inPlay.includes(a.id))).map((a) => center(a.id));
  if (!ids.length) return;
  const x0 = Math.min(...ids.map((p) => p.x)),
    x1 = Math.max(...ids.map((p) => p.x)),
    z0 = Math.min(...ids.map((p) => p.z)),
    z1 = Math.max(...ids.map((p) => p.z));
  setGoal({ t: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), dist: clampDist(Math.max(x1 - x0, (z1 - z0) * 1.3) * 0.95 + 8), pitch });
}
/** The part of the canvas no bar or panel covers, in pixels: each one over the map (bars, Map button, block card, battle panel, set-up panel,
 *  tray, hand, sandbox) takes away the strip of screen, top, bottom, left or right, that leaves the most map (playtest B8). */
function freeRect() {
  const r = canvas.getBoundingClientRect(),
    f = { l: r.left + 16, t: r.top + 40, r: r.right - 16, b: r.bottom - 12 }; // room for the labels and MP badges drawn above an area's centre
  const panels =
    '#ui .c-bar, #ui .mapdock, #ui .sbx, #ui .c-dispatch, #ui .c-ledger, #ui .volstack, #ui .arrtray, #ui .c-hand, #ui .handtab';
  for (const e of Array.from(document.querySelectorAll<HTMLElement>(panels))) {
    const b = e.getBoundingClientRect();
    if (!e.offsetParent || !b.width || b.bottom < f.t || b.top > f.b || b.right < f.l || b.left > f.r) continue;
    const cuts = [
      { ...f, t: Math.max(f.t, b.bottom + 8) },
      { ...f, b: Math.min(f.b, b.top - 8) },
      { ...f, l: Math.max(f.l, b.right + 8) },
      { ...f, r: Math.min(f.r, b.left - 8) },
    ];
    Object.assign(f, cuts.sort((x, y) => (y.r - y.l) * (y.b - y.t) - (x.r - x.l) * (x.b - x.t))[0]); // the cut that leaves the most map
  }
  return f;
}
const ray = new THREE.Raycaster(),
  ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Where the areas land on screen with the camera aimed at t from distance d (the live camera is not moved). */
function shot(t: THREE.Vector3, d: number, ids: number[], pt = pitch) {
  const c = cam.clone(),
    r = canvas.getBoundingClientRect();
  c.position.set(t.x + d * Math.sin(yaw) * Math.cos(pt), d * Math.sin(pt), t.z + d * Math.cos(yaw) * Math.cos(pt));
  c.lookAt(t);
  c.updateMatrixWorld();
  const px = ids.map((a) => {
    const v = center(a).clone().project(c);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  });
  /** The point of the table under a screen pixel. */
  const at = (x: number, y: number) => {
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), c);
    return ray.ray.intersectPlane(ground, new THREE.Vector3());
  };
  return { px, at };
}
const inside = (p: { x: number; y: number }, f: ReturnType<typeof freeRect>) => p.x >= f.l && p.x <= f.r && p.y >= f.t && p.y <= f.b;
/** Where the camera is going (a slide under way) or, still, where it is. */
const aim = () => ({ t: goal?.t ?? target, d: goal?.dist ?? dist, pt: goal?.pitch ?? pitch });
export const onScreen = (a: number) => ((v) => inside(shot(v.t, v.d, [a], v.pt).px[0], freeRect()))(aim());
/** Bring areas into view when any of them is hidden: the camera frames them all in the part of the screen no panel covers, no closer than now. */
export function showAreas(ids: number[]) {
  if (!ids.length) return;
  const f = freeRect();
  const v = aim();
  if (shot(v.t, v.d, ids, v.pt).px.every((p) => inside(p, f))) return;
  const ps = ids.map(center),
    t = new THREE.Vector3(
      (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x))) / 2,
      0,
      (Math.min(...ps.map((p) => p.z)) + Math.max(...ps.map((p) => p.z))) / 2,
    );
  let d = v.d;
  for (let k = 0; k < 6; k++) {
    const { px, at } = shot(t, d, ids, v.pt),
      x0 = Math.min(...px.map((p) => p.x)),
      x1 = Math.max(...px.map((p) => p.x)),
      y0 = Math.min(...px.map((p) => p.y)),
      y1 = Math.max(...px.map((p) => p.y));
    const grow = Math.max((x1 - x0) / (f.r - f.l), (y1 - y0) / (f.b - f.t));
    if (grow > 1) d = clampDist(d * grow * 1.05); // too wide or tall for the free part: step back
    const a = at((x0 + x1) / 2, (y0 + y1) / 2),
      b = at((f.l + f.r) / 2, (f.t + f.b) / 2);
    if (a && b) t.add(a.sub(b)); // the middle of the areas onto the middle of the free part
    if (grow <= 1 && px.every((p) => inside(p, f))) break;
  }
  setGoal({ t, dist: d, pitch: v.pt });
}
export const cutOffCount = (sd: E.Side) => MAP.areas.filter((a) => g.control[a.id] === sd && !supOk(sd, a.id)).length;
const resetBtn = () =>
  ubtn(`${ico('home')}<span>Reset view</span>`, () => {
    setGoal(homeGoal());
    setYaw(viewRot());
  });
function layersHtml() {
  const map = VOL.art.relief
    ? srow(
        'Map',
        VOL.art.reliefName,
        `<span class="seg">${chip('2D', !map3d, () => setMap3d(false), 'The printed board, flat')}${chip('3D', map3d, () => setMap3d(true), VOL.art.reliefName)}</span>`,
      )
    : '';
  const setTroops = (on: boolean) => {
    setTroopsOn(on);
    try {
      localStorage.setItem('fab-troops', on ? '1' : '0');
    } catch {
      /* private mode */
    }
    refresh();
  };
  const units =
    FIG_VOLS.includes(VOL.id) && !TUTORIAL
      ? srow(
          'Units',
          'on either map',
          `<span class="seg">${chip('Blocks', !troopsOn, () => setTroops(false), 'The wooden blocks')}${chip('Figures', troopsOn, () => setTroops(true), 'Soldiers and tanks, one per unit')}</span>`,
        )
      : '';
  const setSize = (z: number) => {
    setTroopSize(z);
    setZoom(z);
    try {
      localStorage.setItem('fab-troop-size', String(z));
    } catch {
      /* private mode */
    }
    refresh();
  };
  const size =
    FIG_VOLS.includes(VOL.id) && !TUTORIAL && troopsOn
      ? srow(
          'Figure size',
          '',
          `<span class="seg">${(
            [
              [1, 'Small'],
              [1.5, 'Medium'],
              [2, 'Large'],
              [2.5, 'Huge'],
            ] as const
          )
            .map(([z, w]) => chip(w, troopSize === z, () => setSize(z), `Figures ${z}×`))
            .join('')}</span>`,
        )
      : '';
  return `<div class="modal"><div class="sheet menu view"><h3><span class="grow">${ico('eye')} View</span><button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
    <div class="mbody"><h4>Board</h4><div class="sgrid"><div>${map || srow('Camera', '', resetBtn())}${units}${size}</div><div>${map ? srow('Camera', '', resetBtn()) : ''}</div></div></div></div></div>`;
}
/** The game log, newest first, grouped by turn; each line tinted by the side it concerns. */
/** A log line with its side prefix (GE / AL) as a coloured tag: side shown by colour and name. */
export const TAGRE = VOL.sides.map((s) => VOL.tag[s]).join('|'),
  sideByTag = (t: string) => VOL.sides.find((s) => VOL.tag[s] === t || VOL.sideName[s] === t) ?? '';
/** Engine log wording for the eye: side ids as names (german → German), and a real plural for hit(s). */
const tidyLog = (x: string) =>
  x
    .replace(new RegExp(`: (${VOL.sides.join('|')}) `, 'g'), (_, sd: string) => `: ${nm(sd)} `)
    .replace(/(\d+) hit\(s\)/g, (_, n: string) => `${n} hit${n === '1' ? '' : 's'}`);
export const sideTag = (x0: string) => {
  const x = tidyLog(x0);
  const m = new RegExp(`^(${TAGRE})\\b ?`).exec(x);
  return m
    ? `<b class="stag ${sideByTag(m[1])}">${m[1]}</b> <span class="lt">${esc(x.slice(m[0].length))}</span>`
    : `<span class="lt">${esc(x)}</span>`;
};
/** The game log, newest first: a heading per turn, a smaller one per step, each line with its side tag (the step is in the heading, not on the line). */
function logHtml() {
  const groups: { turn: string; steps: { step: string; lines: string[] }[] }[] = [];
  for (const l of g.log) {
    const m = /^T(\d+) /.exec(l),
      t = m ? m[1] : '0',
      rest = m ? l.slice(m[0].length) : l,
      s = new RegExp(`^(${TAGRE}) (\\w+): `).exec(rest),
      step = s && STEP_NAME[s[2]] ? s[2] : '',
      text = step ? `${s![1]} ${rest.slice(s![0].length)}` : rest;
    if (groups.at(-1)?.turn !== t) groups.push({ turn: t, steps: [] });
    const gr = groups.at(-1)!;
    if (gr.steps.at(-1)?.step !== step) gr.steps.push({ step, lines: [] });
    if (!new RegExp(`^(${TAGRE}) (phase start|[a-zA-Z]+ phase)$`).test(text))
      gr.steps.at(-1)!.lines.push(text); /* the heading already says which step began */
  }
  const side = (x: string) => sideByTag(x.split(/\s/)[0]);
  const quiet = g.log.length <= 2 ? '<p class="hint">The log fills in as the turn goes on.</p>' : ''; // turn 1 starts with one line
  return (
    quiet +
    `<div class="log">${
      groups
        .reverse()
        .map(
          (gr) =>
            `<h5>${gr.turn === '0' ? 'Set-up' : `Turn ${gr.turn}`}</h5>${[...gr.steps]
              .reverse()
              .map(
                (st) =>
                  `${st.step ? `<h6>${STEP_NAME[st.step]}</h6>` : ''}${[...st.lines]
                    .reverse()
                    .map((x) => `<div class="ll ${side(x)}">${sideTag(x)}</div>`)
                    .join('')}`,
              )
              .join('')}`,
        )
        .join('') || '<p class="hint">Nothing yet.</p>'
    }</div>`
  );
}
export function modalHtml() {
  if (modal === 'layers') return layersHtml();
  if (modal === 'rules')
    return rulesHtml('menu', (t, ok) => {
      setToast(t);
      setToastInfo(ok);
      render();
      setTimeout(() => {
        setToast('');
        render();
      }, 2500);
    });
  if (modal === 'boxes') return piecesHtml();
  if (modal === 'menu') {
    const tabs = ['Settings', 'Log', 'Help', 'Table', ...(online.admin ? ['Admin'] : [])];
    if (!tabs.includes(menuTab)) setMenuTab('Settings');
    if (menuTab !== 'Table') setRestartAsk(false); // the restart question never waits on another tab
    const body =
      menuTab === 'Log'
        ? logHtml()
        : menuTab === 'Help'
          ? `${
              coursesOf(VOL.id).length || RULES_GAMES.includes(VOL.id)
                ? `<h4>Learn</h4><div class="row">${
                    RULES_GAMES.includes(VOL.id)
                      ? ubtn(
                          `${ico('info')} Rules reference`,
                          () => {
                            void showRules();
                          },
                          '',
                          false,
                          'The full rulebooks, searchable (shortcut: ?)',
                        )
                      : ''
                  }${coursesOf(VOL.id)
                    .map((c) =>
                      ubtn(`${ico('info')} ${esc(c.title)}`, () => {
                        location.href = tutUrl(c.id);
                      }),
                    )
                    .join('')}</div>`
                : ''
            }${COARSE ? '' : `<h4>Keyboard</h4><dl class="keys"><dt>Tab</dt><dd>to the map (or “Skip to the map” first)</dd><dt>← ↑ → ↓</dt><dd>move between neighbouring areas</dd><dt>Enter</dt><dd>select or move there; on a button, press it</dd><dt>N</dt><dd>next block that can move</dd><dt>Esc</dt><dd>clear the selection, close a window</dd><dt>Ctrl+Z</dt><dd>undo</dd></dl>`}`
          : menuTab === 'Settings'
            ? `<div class="sgrid"><div><h4>Play</h4>${srow(
                'Full explanations',
                'every option and rule',
                swtch(guide === 'full', () => setGuide(guide === 'full' ? 'short' : 'full'), 'Full explanations'),
              )}${
                noticesSupported()
                  ? srow(
                      'My-move notices',
                      noticesBlocked() ? 'blocked in this browser: allow notices for this site' : 'when the game is out of sight',
                      swtch(
                        noticesOn(),
                        () => {
                          void setNotices(!noticesOn(), auth.token).then((m) => {
                            say(m);
                            render();
                          });
                        },
                        'My-move notices',
                      ),
                    )
                  : ''
              }</div>
        <div><h4>Screen</h4>${srow(
          'Follow the other side',
          'the camera goes to their moves',
          swtch(
            followFoe,
            () => {
              setFollowFoe(!followFoe);
              try {
                localStorage.setItem('fab-follow', followFoe ? '1' : '0');
              } catch {
                /* private mode */
              }
            },
            'Follow the other side',
          ),
        )}${srow('Language', '', `<span class="seg notr">${LANGS.map(([l]) => chip(l.toUpperCase(), LANG === l, () => setLang(l), l === 'it' ? 'Interfaccia in italiano (i regolamenti restano in inglese)' : 'Interface in English')).join('')}</span>`)}${srow('Rules in use', rulesInUse(g.opts), '')}</div></div>`
            : menuTab === 'Admin'
              ? `<div class="row">${ubtn(`${ico('wand')} Sandbox`, () => {
                  location.href = `${homeUrl()}?sandbox=1`;
                })}${ubtn('Update rules', () => {
                  setModal('rules');
                })}${VOL.sides
                  .map((sd) =>
                    ubtn(`Free ${nm(sd)} seat`, () => {
                      void auth.freeSeat(sd);
                    }),
                  )
                  .join(
                    '',
                  )}</div><h4>Computer opponent (experimental, The Bulge)</h4><p class="hint">A local game against the computer, saved in this browser apart from your other games.</p>${(
                  ['german', 'allied'] as const
                )
                  .map((cpu) => {
                    const you = cpu === 'german' ? 'Allies' : 'Germans',
                      go = () => {
                        location.href = `${homeUrl()}?game=bulge&lab=${cpu}`;
                      },
                      saved = (() => {
                        try {
                          return !!localStorage.getItem(`fab-lab-${cpu}`);
                        } catch {
                          return false;
                        }
                      })();
                    return `<div class="row"><span class="grow">You play the ${you}</span>${saved ? ubtn('Continue', go, LAB_SIDE === cpu ? 'primary' : '') : ''}${ubtn(
                      'New game',
                      () => {
                        try {
                          localStorage.removeItem(`fab-lab-${cpu}`);
                          localStorage.removeItem(recordKey(cpu));
                        } catch {
                          /* storage off */
                        }
                        if (LAB_SIDE === cpu) location.reload();
                        else go();
                      },
                      saved ? '' : 'primary',
                    )}</div>`;
                  })
                  .join(
                    '',
                  )}${LAB_SIDE ? `<div class="row">${ubtn(`${ico('share')} Download game record`, () => labDownload(g), '', false, 'A file with this whole game and every move the computer made with its reason: send it to have the game checked')}</div>` : ''}`
              : online.mode === 'remote'
                ? (() => {
                    const a = online.account,
                      signed = !!a && !a.guest,
                      me = online.mySide(),
                      title = matches.find((m) => m.id === TABLE)?.title ?? TABLE,
                      m = matches.find((x) => x.id === TABLE),
                      own = !!m && (m.owner === online.uid || online.admin);
                    const row = (sd: E.Side) => {
                      const seat = seatOf(online.seats, sd),
                        who = seat ? (seat === online.uid ? 'you' : esc(seatName(online.seats, sd) || 'taken')) : 'free';
                      return `<div class="seatrow"><b class="${sd}">${nm(sd)}</b><span>${who}</span>${
                        seat === online.uid
                          ? ubtn('Leave seat', () => {
                              void sit(null);
                            })
                          : !seat && signed && !me
                            ? ubtn(
                                'Take seat',
                                () => {
                                  void sit(sd);
                                },
                                'primary',
                              )
                            : ''
                      }</div>`;
                    };
                    return `<h4>Players</h4>${VOL.sides.map(row).join('')}<p class="inuse">${rulesInUse(g.opts)}</p>${online.error ? `<p class="hint"><b class="bad">${esc(online.error)}</b></p>` : ''}
          <div class="row">${ubtn(`${ico('share')} Invite a player`, () => {
            void share(TABLE, title, say);
          })}</div>
          <p class="hint">Connection: ${esc(online.sync)}</p>
          <p class="hint">${signed ? `Signed in as <b>${esc(a!.name || a!.email)}</b>` : 'You are watching as a guest.'}</p>
          ${
            own && TABLE !== 'main'
              ? `<div class="row">${ubtn(
                  `${ico('close')} Delete this game`,
                  () => {
                    void dropMatch(m ?? { id: TABLE, title: TABLE, owner: '' });
                  },
                  'danger',
                )}</div>`
              : ''
          }`;
                  })()
                : `<h4>Players</h4><p class="hint">Developer table. The Seat button in the top bar switches between ${nm(P1)}, ${nm(P2)}, both and watching; turn rules are enforced for the seat you hold.</p>`;
    const newGame = `${
      online.active && !online.admin && !online.both()
        ? '<p class="hint">Restarting a shared game is limited to its admin.</p>'
        : `<h4>Restart this game</h4><div class="row"><select data-sel="${regv((x) => {
            newOpts.scenario = x as E.Opts['scenario'];
          })}">${VOL.scenarios
            .filter((sc) => SANDBOX || !sc.testing)
            .map(
              (sc) => `<option value="${sc.id}" ${newOpts.scenario === sc.id ? 'selected' : ''}>${esc(sc.name)} (${esc(sc.sub)})</option>`,
            )
            .join('')}</select>
        </div>${
          VOL.features.fuel
            ? `${srow(
                'German fuel rule',
                '',
                swtch(
                  !!newOpts.fuel,
                  () => {
                    newOpts.fuel = !newOpts.fuel;
                  },
                  'German fuel rule',
                ),
              )}`
            : ''
        }${VOL.features.optional ? optChooser(newOpts, VOL.id) : ''}${
          restartAsk
            ? `<div class="askrow" data-reveal="restart"><p>Restart and lose the current game?</p><div class="row">${ubtn(
                'Restart now',
                () => {
                  setRestartAsk(false);
                  setG(E.newGame(undefined, newOpts));
                  setSelArea(setSelUnit(setSelChit(null)));
                  setModal(null);
                  setInBattle(false);
                  hist.clear();
                  setNote('');
                  setSelArr(null);
                  save();
                  if (LAB_SIDE) {
                    labClear();
                    location.reload();
                  } else refresh();
                },
                'danger',
              )}${ubtn('Keep playing', () => {
                setRestartAsk(false);
              })}</div></div>`
            : `<div class="row">${ubtn(
                'Restart',
                () => {
                  setRestartAsk(true);
                },
                'danger',
              )}</div>`
        }`
    }`;
    const all = menuTab === 'Table' ? `${body}${newGame}` : body;
    return `<div class="modal"><div class="sheet menu"><h3><span class="grow">Game</span>${ubtn(
      `${ico('back')}<span>Leave game</span>`,
      () => {
        location.href = homeUrl();
      },
      'leave',
      false,
      'Back to the home page (the game is saved)',
    )}<button class="ico" data-modal="" aria-label="Close">${ico('close')}</button></h3>
      <div class="tabs">${tabs
        .map(
          (t) =>
            `<button class="${t === menuTab ? 'on' : ''}" data-ui="${reg(() => {
              setMenuTab(t);
            })}" title="${t}" aria-label="${t}">${ico(({ Table: 'users', Log: 'list', Settings: 'sliders', Admin: 'lock' } as Record<string, string>)[t] ?? 'info')}<span>${t}</span></button>`,
        )
        .join('')}</div><div class="mbody">${all}</div></div></div>`;
  }
  return '';
}
