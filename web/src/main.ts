import * as THREE from 'three';
import * as E from '../../engine/src';
import { loadChitArt } from './chits';
import { loadGolanChitArt } from './golan-art';
import { loadSicilyChitArt } from './sicily-art';
import * as SB from './sandbox';
import * as SBU from './sandbox-ui';
import { online, startOnline, lobby, TABLE, HAS_TABLE, DEV_FAKE, SANDBOX, TUTORIAL, type Match } from './online';
import { ICONS, ico } from './icons';
import { esc, nm } from './util';
import { sheets } from './sheets';
import { ABBR, STAGE_NAME } from './table-text';
import { initChat } from './chat';
import { reg, regv, ubtn } from './ui-kit';
import { optChooser } from './opt-rules';
import { moveNotice, handedOver, turnOf } from './notices';
import { STEP_NAME, homeUrl } from './home';
import { snap, FX_SAMPLES } from './fx';
import { initTouch } from './touch';
import { throwDice } from './dice3d';
import { initTutorial } from './tutorial';
import { $, areaName, first, MAP, MH, MW, P1, P2, PARAMS, S, toWorld, TUT, VOL } from './page';
export * from './page';
import {
  addressOpts,
  g,
  previewArea,
  record,
  replayShown,
  save,
  selArea,
  selChit,
  selUnit,
  setApplyingRemote,
  setAreaPick,
  setG,
  setHoverArea,
  setOppTurn,
  setPreviewArea,
  setReplayShown,
  setSelArea,
  setSelChit,
  setSelUnit,
  setTut,
  showReplay,
  tut,
} from './game-state';
export * from './game-state';
import { boardCv, cam, canvas, PHONE, renderer, scene } from './scene';
export * from './scene';
import { REL, settle, show3d } from './map3d';
export * from './map3d';
import { clearRatio, fitBattleView, markers, pieces, pumpTextures, setClearRatio } from './piece-kit';
export * from './piece-kit';
export * from './pieces';
import { camFar, labelsGrp, labelTilt, paintBoard, setCamFar, setLabelTilt, setTutView, viewRot } from './map-paint';
export * from './map-paint';
import { dist, opened, pitch, placeCam, ptrs, setDist, setOpened, setPitch, setYaw, target, yaw } from './camera';
export * from './camera';
import {
  act,
  actorNow,
  allowed,
  fxLayer,
  hist,
  infoOpen,
  lockOf,
  mine,
  noteFx,
  other,
  say,
  selArr,
  setBattleFx,
  setInfoOpen,
  setNote,
  setRollFx,
  setSelArr,
} from './flow';
export * from './flow';
import { auditWarn, followFoe, gotRemote, setAuditWarn, setGotRemote, setHeldBad, setScoreOpen } from './choices';
export * from './choices';
import { center, clampDist, goal, lock, optsFor, setGoal, setInBattle, setReinforcing, syncBattleCam } from './map-input';
export * from './map-input';
export * from './routes';
import { pieceScreen, placeBadges, renderFocus, tagPpu } from './map-marks';
export * from './map-marks';
import {
  afterDice,
  anims,
  commitRoll,
  heldNext,
  hideDice,
  modal,
  rollView,
  type RollView,
  runAnims,
  setHeldNext,
  setModal,
  setRestartAsk,
  setRollView,
  showChecks,
} from './rolls';
export * from './rolls';
import { chitImg } from './cards';
export * from './cards';
import { guide, lookAt, setGuide } from './prompt';
export * from './prompt';
export * from './dock';
import { chitPic, unitPic } from './pieces-window';
export * from './pieces-window';
export * from './unit-card';
import { b3, unitFace } from './map-dock';
export * from './map-dock';
export * from './battle-view';
import { onScreen, openingTarget, setMatches, showAreas } from './menus';
export * from './menus';
import { refresh, render, setTgtKey, syncView, tgtKey } from './render';
export * from './render';
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches; // no floating motion for players who asked for less motion
export let lastPhase = '';
export const setLastPhase = <T extends typeof lastPhase>(v: T): T => ((lastPhase = v), v);
export let lastInput = performance.now(),
  tick = 0,
  fxBattle: number | null = null,
  frameAt = 0,
  openFrame = false,
  camTouched = false;
export const setFxBattle = <T extends typeof fxBattle>(v: T): T => ((fxBattle = v), v);
export const setOpenFrame = <T extends typeof openFrame>(v: T): T => ((openFrame = v), v);
export const setFrameAt = <T extends typeof frameAt>(v: T): T => ((frameAt = v), v);
export const setCamTouched = <T extends typeof camTouched>(v: T): T => ((camTouched = v), v);
export const setLastInput = <T extends typeof lastInput>(v: T): T => ((lastInput = v), v);
/** ?fps=1: a small corner counter (frames per second, slowest frame) for measuring on a real phone. */
const fpsEl = new URLSearchParams(location.search).has('fps')
  ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'fps' })
  : null;
let fpsN = 0,
  fpsT = performance.now(),
  fpsWorst = 0,
  fpsLast = performance.now();
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize'])
  window.addEventListener(
    ev,
    () => {
      lastInput = performance.now();
    },
    { passive: true },
  );
function frame() {
  requestAnimationFrame(frame);
  pumpTextures();
  if (!goal && !anims.length && !rollView && performance.now() - lastInput > 2000 && tick++ % 3) return;
  if (fpsEl) {
    const now = performance.now();
    fpsWorst = Math.max(fpsWorst, now - fpsLast);
    fpsLast = now;
    fpsN++;
    if (now - fpsT > 1000) {
      fpsEl.textContent = `${Math.round((fpsN * 1000) / (now - fpsT))} fps · slowest ${Math.round(fpsWorst)} ms${now - lastInput > 2000 ? ' · idle' : ''}`;
      fpsN = 0;
      fpsT = now;
      fpsWorst = 0;
    }
  }
  // idle: about 20 frames a second is enough for the floating markers, and spares the battery
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * renderer.getPixelRatio())) {
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.updateProjectionMatrix();
  }
  if (goal) {
    const k = goal.fast ? 0.28 : 0.1;
    target.lerp(goal.t, k);
    setDist(dist + (goal.dist - dist) * k);
    setPitch(pitch + (goal.pitch - pitch) * k);
    if (target.distanceTo(goal.t) < 0.05 && Math.abs(dist - goal.dist) < 0.1) setGoal(null);
  }
  if (lock && !goal) target.copy(lock.c);
  if (!CALM) {
    const t = performance.now() / 1000;
    for (const k of markers.children) {
      const f = k.userData.float;
      if (f) {
        k.position.y = f.y + ((k.userData.lift as number | undefined) ?? 0) + Math.sin(t * 1.6 + f.ph) * 0.07;
        k.rotation.y = viewRot() + Math.sin(t * 0.9 + f.ph) * 0.22;
      }
    }
  } // a slow 4 s bob and 7 s sway, each marker out of step
  {
    const old = Math.round(clearRatio * 5);
    setClearRatio(fitBattleView());
    if (g.battle && Math.round(clearRatio * 5) !== old) syncBattleCam();
  }
  if (REL) {
    const near = dist < (PHONE ? 40 : 55);
    REL.props.children[0].visible = REL.props.children[1].visible = near;
  } // trees only up close: at overview they are noise over the map   // phones: trees only when zoomed in (thousands of them are the heaviest part)
  {
    const f = Math.cos(yaw) < 0;
    if (f !== camFar) {
      setCamFar(f);
      paintBoard();
    }
  } // the camera has swung past the side: the printed words turn to face it
  {
    const tilt = show3d() ? Math.min(0.75, Math.max(0, 0.8 - pitch) * 1.3) : 0; // a low look across the 3D table: the names stand up toward the player, as the hovering boxes do, so they stay readable
    if (Math.abs(tilt - labelTilt) > 0.005) {
      setLabelTilt(tilt);
      for (const l of labelsGrp.children)
        if (l.userData.lh) {
          l.rotation.x = -Math.PI / 2 + tilt;
          l.position.y = l.userData.y0 + (Math.sin(tilt) * l.userData.lh) / 2;
        }
    }
  }
  if (!opened) {
    setOpened(true);
    if (!g.inPlay && !TUT) {
      target.copy(openingTarget());
      if (innerWidth <= 700) {
        const ps = g.units.filter((u) => u.area != null && MAP.areas.some((x) => x.id === u.area)).map((u) => center(u.area!)),
          span = ps.length ? Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x)) : 40;
        setDist(clampDist(span * 1.25 + 8));
      }
    }
  } // the first frame looks at the front of this game; a phone frames the front's width, not the whole sheet
  placeCam();
  runAnims();
  settle();
  renderer.render(scene, cam);
  renderFocus();
  placeBadges();
  if (frameAt && performance.now() > frameAt) {
    frameAt = 0;
    if (!g.battle && mine(g.phasing) && allowed()) {
      // a new step (or the opening): what it is about comes into view
      const ids =
        g.phase === 'combat' || g.phase === 'btCombat'
          ? E.mustFight(g).slice(0, 1)
          : ['movement', 'btMove'].includes(g.phase)
            ? [...new Set(g.units.filter((u) => u.side === g.phasing && u.area != null && optsFor(u.id).length).map((u) => u.area!))]
            : [];
      if (ids.length && !ids.some(onScreen)) {
        showAreas(ids);
        if (openFrame && goal) {
          target.copy(goal.t);
          setDist(goal.dist);
          setPitch(goal.pitch);
          setGoal(null);
        }
      }
    }
    openFrame = false;
  }
}
/** A new or loaded game replaces the table: nothing of the old one stays on screen (dice, pop-ups, selection, windows, undo). */
function startOver(x: E.Game) {
  if (heldNext) commitRoll();
  setRollView(null);
  hideDice();
  setG(x);
  hist.clear();
  setSelUnit(setSelChit(setSelArr(null)));
  setSelArea(setPreviewArea(setHoverArea(null)));
  setModal(null);
  setScoreOpen(false);
  setReinforcing(false);
  setBattleFx([]);
  setRollFx([]);
  setTgtKey('');
  setInBattle(false);
  setNote('');
  setAreaPick(null);
  setRestartAsk(false);
  fxLayer.clear();
  save();
  refresh();
}
SBU.initSandboxUi({
  get g() {
    return g;
  },
  set g(v) {
    setG(v);
  },
  get selUnit() {
    return selUnit;
  },
  set selUnit(v) {
    setSelUnit(v);
  },
  get selChit() {
    return selChit;
  },
  set selChit(v) {
    setSelChit(v);
  },
  get selArr() {
    return selArr;
  },
  set selArr(v) {
    setSelArr(v);
  },
  get selArea() {
    return selArea;
  },
  set selArea(v) {
    setSelArea(v);
  },
  get previewArea() {
    return previewArea;
  },
  set previewArea(v) {
    setPreviewArea(v);
  },
  get rollView() {
    return rollView;
  },
  set rollView(v) {
    setRollView(v as RollView | null);
  },
  ABBR,
  actorNow,
  areaName,
  b3,
  chitImg,
  unitFace,
  unitPic,
  chitPic,
  hist,
  refresh,
  render,
  save,
  say,
  reg,
  regv,
  ubtn,
  optChooser: (o: Partial<E.Opts>) => optChooser(o, VOL.id),
  scenarios: VOL.scenarios,
  defaultOpts: VOL.defaultOpts,
  optional: VOL.features.optional,
  startOver,
});
initTouch(document.body);
initChat(say, render);
const toScreen = (p: THREE.Vector3) => {
  const r = canvas.getBoundingClientRect(),
    v = p.clone().project(cam);
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
};
setTut(
  TUT
    ? initTutorial(
        {
          game: () => g,
          act,
          load: startOver,
          unitScreen: (id) => pieceScreen(id),
          areaScreen: (a) => {
            const c = center(a);
            return toScreen(new THREE.Vector3(c.x, 0, c.z));
          },
          lookAt: (a) => {
            const p = center(a);
            setGoal({ t: new THREE.Vector3(p.x, 0, p.z), dist: Math.min(dist, innerWidth < 700 ? 34 : 30), pitch });
          },
          select: (id) => {
            if (g.pendingArrivals.includes(id)) setSelArr(id);
            else {
              setSelUnit(id);
              setSelArea(g.units.find((u) => u.id === id)?.area ?? null);
            }
            refresh();
          },
          moving: () => ptrs.size > 0,
          pan: (dx, dy) => {
            setGoal(null);
            const k = dist * 0.0018,
              c = Math.cos(yaw),
              sn = Math.sin(yaw);
            target.x -= (dx * c + dy * sn) * k;
            target.z -= (-dx * sn + dy * c) * k;
          },
          fold: () => {
            if (infoOpen) {
              setInfoOpen(false);
              render();
            }
          },
          toast: (t) => say(t),
          busy: () => !!rollView || !!heldNext,
          guide: () => guide,
          setGuide: (v) => {
            setGuide(v);
            render();
          },
          view: (sd) => {
            if (VOL.sides.includes(sd)) {
              setTutView(sd as E.Side);
              refresh();
            }
          },
          home: (to) => {
            try {
              if (to) sessionStorage.setItem('fab-new', `${to.game}:${to.scenario}`);
            } catch {
              /* private mode */
            }
            location.href = homeUrl();
          },
        },
        TUT,
      )
    : null,
);
frame();
Promise.all([loadChitArt(), VOL.id === 'golan73' ? loadGolanChitArt() : null, VOL.id === 'sicily' ? loadSicilyChitArt() : null])
  .catch((e) => console.error(e))
  .finally(() => {
    refresh();
  });
let lobbyUid = '';
const onNet = (): void => {
  if (online.mode !== 'remote' || !online.hasAccounts) return;
  if (lobbyUid !== online.uid) {
    lobbyUid = online.uid;
    lobby.watch((m) => {
      setMatches(m);
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
  if (next && !HAS_TABLE && online.account && !online.account.guest) {
    try {
      sessionStorage.removeItem('fab-next');
    } catch {
      /* private mode */
    }
    location.href = `${homeUrl()}?table=${next}`;
  } // back to the invite that sent you to sign in
};
document.addEventListener('fab-redraw', () => render());
void startOnline(
  (rg) => {
    setApplyingRemote(true);
    if (heldNext) commitRoll();
    const prevG = g,
      firstRemote = !gotRemote; // a roll still on screen is finished locally, never pushed back over what arrived
    if ((rg.game ?? 'bulge') !== VOL.id) {
      const u = new URL(location.href);
      u.searchParams.set('game', rg.game ?? 'bulge');
      location.replace(u.href);
      return;
    } // a shared table of another game: this page is built for one game, so it reloads as that one
    {
      const by = online.lastBy,
        w: E.Side | null = online.seats.german === by ? P1 : online.seats.allied === by ? P2 : null; // referee-lite: check what the other browser wrote
      if (by && by !== online.uid && E.isRestore(prevG, rg)) {
        setHeldBad(null);
        setAuditWarn(
          [
            ...auditWarn,
            `The other player's rules check put the game back to the last legal position: ${rg.restored!.why.join(' ')}`,
          ].slice(-6),
        );
      } else if (by && by !== online.uid && gotRemote) {
        const p = E.auditChange(prevG, rg, w);
        if (p.length) {
          console.warn('rules check', p);
          setHeldBad({ game: rg, why: p });
          setApplyingRemote(false);
          render();
          return;
        }
      }
      setGotRemote(true);
      setHeldBad(null);
      record(false, rg);
      if (PARAMS.get('replay') && rg.over && !replayShown) {
        setReplayShown(true);
        setTimeout(() => {
          void showReplay();
        }, 400);
      } // opened from the home page list
      {
        const me = online.mySide();
        if (me) setOppTurn(turnOf(rg, other(me))); // 4.3: the other player's move made it ours
        if (me && by && by !== online.uid && !firstRemote && handedOver(prevG, rg, me))
          void moveNotice(
            `Your move · ${VOL.name}`,
            `Turn ${rg.turn} · ${STEP_NAME[rg.phase] ?? rg.phase}${rg.battle ? ' · a battle waits for you' : ''}`,
            `fab-${TABLE}`,
          );
      }
    }
    const ckLast = JSON.stringify(g.checks?.at(-1) ?? null);
    const was = g.battle,
      n0 = was?.rolls.length ?? 0,
      st0 = was?.stage,
      pre = was ? snap(g) : null;
    setApplyingRemote(true);
    setG(rg);
    const nb = g.battle;
    if (nb && !was) {
      setBattleFx([]);
      setRollFx([]);
    }
    const rolled = !!(was && nb && nb.area === was.area && nb.rolls.length > n0);
    if (pre) {
      try {
        noteFx(pre, g, rolled);
      } catch (e) {
        console.error(e);
      }
    } // a failure while describing the changes must never stop the screen from updating
    if (was && nb && nb.area === was.area && nb.rolls.length > n0 && st0 && STAGE_NAME[st0]) {
      // the other player rolled: show their dice here too
      const side = st0 === 'attArty' || st0 === 'offFire' || st0 === 'exploit' ? nb.attacker : other(nb.attacker);
      setRollView({
        remote: true,
        morale: st0 === 'exploit',
        title: `${nm(side)} ${STAGE_NAME[st0]}`,
        pos: null,
        groups: nb.rolls.slice(n0).map((r) => ({
          label: r.who,
          col: r.kind === 'arty' ? 's' : first(side) ? 'k' : 'w',
          sn: r.sn,
          dice: r.dice,
          hits: r.hits,
          parts: [],
        })),
      });
      if (rollView!.groups.length) {
        setHeldNext(g);
        setG(prevG);
      } // the board keeps the old state until the dice land
      if (rollView!.groups.length) {
        const cv = $('#dice') as HTMLCanvasElement;
        cv.style.display = 'block';
        throwDice(cv, rollView!.groups, (p) => {
          if (rollView) {
            const rv = rollView;
            rv.pos = p;
            render();
            afterDice(rv);
          }
        });
      } else setRollView(null); // the other player's dice clear themselves
    }
    {
      const same = prevG.turn === g.turn && prevG.phase === g.phase && prevG.phasing === g.phasing && !!prevG.battle === !!g.battle;
      const keep = (prev: E.Game, id: string | null, f: (x: E.Game) => unknown) =>
        same && id && JSON.stringify(f(prev)) === JSON.stringify(f(g)) ? id : null; // the other player's write keeps what you picked, unless it changed that very piece
      setSelUnit(keep(prevG, selUnit, (x) => x.units.find((u) => u.id === selUnit)));
      setSelChit(keep(prevG, selChit, (x) => x.chits.find((c) => c.id === selChit)));
      setSelArr(keep(prevG, selArr, (x) => [x.pendingArrivals.includes(selArr!), x.units.find((u) => u.id === selArr)?.area]));
      if (!same) setSelArea(null);
      if (!selUnit) setPreviewArea(null);
      setHoverArea(null);
    }
    hist.remote(prevG, g, lockOf);
    if (rolled) hist.clear('dice rolled');
    if (followFoe && online.lastBy && online.lastBy !== online.uid && !g.battle) {
      const mv = g.units.find((u) => {
        const o = prevG.units.find((x) => x.id === u.id);
        return o && u.area != null && o.area !== u.area;
      });
      if (mv) lookAt(mv.area!);
    }
    try {
      save();
    } finally {
      setApplyingRemote(false);
    }
    refresh();
    {
      const cs = g.checks ?? [],
        k = cs.findIndex((c) => JSON.stringify(c) === ckLast);
      const fresh = ckLast === 'null' ? [] : k >= 0 ? cs.slice(k + 1) : [];
      if (fresh.length) showChecks(fresh);
    }
  },
  () => {
    onNet();
    syncView();
    render();
  },
  say,
  () => {
    try {
      sessionStorage.setItem('fab-notice', 'That game was deleted by its creator.');
    } catch {
      /* private mode */
    }
    location.href = homeUrl();
  },
); // the table is gone: nobody stays inside it
if (SANDBOX && SB.PRESET_KEYS.some((k) => PARAMS.has(k))) {
  // a rules-checklist link: a fresh table set up on the rule's situation, once (the address is cleaned so a reload keeps the edits)
  setG(SB.preset(E.newGame(undefined, addressOpts()), PARAMS));
  hist.clear();
  save();
  const q = new URLSearchParams(location.search);
  for (const k of [...SB.PRESET_KEYS, 'scenario', 'rules', 'fuel']) q.delete(k);
  history.replaceState(null, '', `${location.pathname}?${q}`);
  refresh();
  if (PARAMS.get('case')) say(`Testing ${PARAMS.get('case')}`);
}
if (import.meta.env.DEV || DEV_FAKE || SANDBOX || TUTORIAL)
  Object.assign(window, {
    __fab: {
      seat: (sd: E.Side) => {
        setTutView(sd);
        refresh();
      },
      viewMap: (mx: number, my: number, d: number, pt: number, yw: number) => {
        const p = toWorld(mx, my);
        setGoal({ t: new THREE.Vector3(p.x, show3d() ? REL!.h(p.x, p.z) : 0, p.z), dist: d, pitch: pt, fast: true });
        setYaw(yw);
      },
      tut: () => tut,
      tagPpu: () => tagPpu,
      unitAt: (id: string) => {
        const m = pieces.children.find((o) => o.userData.unit === id || o.userData.chit === id);
        if (!m) return null;
        const r = canvas.getBoundingClientRect(),
          v = m.getWorldPosition(new THREE.Vector3()).project(cam);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      },
      game: () => g,
      setGame: (x: E.Game) => {
        setG(x);
        hist.clear();
        save();
        refresh();
      },
      at: (a: number) => {
        const p = center(a),
          r = canvas.getBoundingClientRect(),
          v = new THREE.Vector3(p.x, 0, p.z).project(cam);
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      },
      project: (x: number, y: number, z: number) => {
        const r = canvas.getBoundingClientRect(),
          v = new THREE.Vector3(x, y, z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
      },
      online,
      setMatches: (m: Match[]) => {
        setMatches(m);
      },
      iconList: () => Object.keys(ICONS).map((k) => ({ k, html: ico(k) })),
      fxDemo: () =>
        FX_SAMPLES.map(
          (f) =>
            `<div class="fx ${f.cls}" style="position:static;animation:none;margin:8px;width:max-content">${ico(f.icon)}<b>${esc(f.head)}</b><small>${esc(f.text)}</small></div>`,
        ).join(''),
      sheets: () => sheets(VOL),
      setModal: (m: typeof modal) => {
        setModal(m);
        render();
      },
      info: () => renderer.info.memory,
      rel: () => ({
        tris: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        trees: (REL?.props.children[0] as THREE.InstancedMesh | undefined)?.count,
      }),
      board: () => boardCv.toDataURL('image/png'),
      view: (x: number, z: number, d: number, pt: number, yw: number) => {
        setGoal({ t: new THREE.Vector3(x, 0, z), dist: d, pitch: pt, fast: true });
        setYaw(yw);
      },
      layout: () => ({
        MW,
        MH,
        S,
        pieces: pieces.children.map((o) => ({ unit: o.userData.unit as string, x: o.position.x, z: o.position.z })),
      }),
      E,
      get g() {
        return g;
      },
      set g(v: E.Game) {
        setG(v);
      },
      refresh,
      act,
      sel: (u: string, a?: number) => {
        setSelUnit(u);
        setSelArea(g.units.find((x) => x.id === u)!.area);
        setPreviewArea(a ?? null);
        refresh();
      },
    },
  });
