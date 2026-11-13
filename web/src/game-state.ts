// The game on this table and what the player has selected; saving it, the game record and the replay.
import * as E from '../../engine/src';
import { figKit } from './vol';
import { online, push, auth, journal, seatKey, TABLE, HAS_TABLE, SANDBOX, TUTORIAL, seatName } from './online';
import { Recorder, unitsOf, localJournal, buildSteps } from './journal';
import { openReplay } from './replay';
import { turnOf, pushNotify } from './notices';
import { STEP_NAME } from './home';
import { initTutorial } from './tutorial';
import { setRulesContext } from './rules-link';
import { KEY, load, MAP, MH, MW, P1, P2, PARAMS, VOL } from './page';
import { boardCv, heldNext, other, render, say } from './main';

/* ---------- state ---------- */
export let tut: ReturnType<typeof initTutorial> | null = null;
export const setTut = <T extends typeof tut>(v: T): T => ((tut = v), v);
/** The options of a new game from the address (scenario, fuel, optional rules): the sandbox's ready test situations. */
export const addressOpts = (): Partial<E.Opts> => {
  const o: Record<string, unknown> = { ...VOL.defaultOpts };
  const sc = PARAMS.get('scenario');
  if (sc && VOL.scenarios.some((x) => x.id === sc)) o.scenario = sc;
  if (PARAMS.has('fuel')) o.fuel = PARAMS.get('fuel') === '1';
  for (const k of (PARAMS.get('rules') ?? '').split(',').filter(Boolean)) {
    const [key, v] = k.split(':');
    if (E.optionalRules().some((r) => r.key === key)) o[key] = key === 'bid' ? +(v ?? 0) : true;
  }
  return o as Partial<E.Opts>;
};
export let g: E.Game = (() => {
  const s = HAS_TABLE && !SANDBOX && !TUTORIAL ? null : load();
  return s && (s.game ?? 'bulge') === VOL.id ? s : E.newGame(undefined, VOL.defaultOpts);
})(); // a shared table starts from what the database sends, never from an old local copy
export const setG = <T extends typeof g>(v: T): T => ((g = v), v);
setRulesContext({
  game: VOL.id,
  title: VOL.name,
  art: (k) => VOL.ruleArt(k, g),
  fig: () => {
    const k = figKit(VOL, E.newGame(1, g.opts));
    E.setPlayArea(g.inPlay);
    return k;
  },
}); // a fresh game for every block's face (online the other side's are hidden); the play area stays this game's          // the rules reference shows this game's rulebooks and pieces
export let selArea: number | null = null,
  selUnit: string | null = null,
  selChit: string | null = null,
  previewArea: number | null = null,
  hoverArea: number | null = null,
  newOpts: E.Opts = { scenario: VOL.defaultOpts.scenario ?? 'tournament', fuel: !!VOL.defaultOpts.fuel };
export const setSelArea = <T extends typeof selArea>(v: T): T => ((selArea = v), v);
export const setHoverArea = <T extends typeof hoverArea>(v: T): T => ((hoverArea = v), v);
export const setPreviewArea = <T extends typeof previewArea>(v: T): T => ((previewArea = v), v);
export const setSelUnit = <T extends typeof selUnit>(v: T): T => ((selUnit = v), v);
export const setSelChit = <T extends typeof selChit>(v: T): T => ((selChit = v), v);
/** A prompt of the volume asked for an area (an air assault landing): the legal ones light up, a tap runs it. */
export let areaPick: { label: string; areas: Set<number>; run: (a: number) => void } | null = null;
export const setAreaPick = <T extends typeof areaPick>(v: T): T => ((areaPick = v), v);
export let applyingRemote = false;
export const setApplyingRemote = <T extends typeof applyingRemote>(v: T): T => ((applyingRemote = v), v);
export let oppTurn: boolean | null = null; // 4.3: was it the opponent's move when last seen
export const setOppTurn = <T extends typeof oppTurn>(v: T): T => ((oppTurn = v), v);
/** The game is kept in the browser's storage; when it is full, the replay journals of the other tables go first (they are only a replay), then it tries once more. */
function storeGame(json: string): boolean {
  try {
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    /* full or off */
  }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fab-journal:') && k !== `fab-journal:${KEY}`) localStorage.removeItem(k);
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}
let storageTold = false;
function storageWarn() {
  if (storageTold) return;
  storageTold = true;
  setTimeout(
    () =>
      say(
        'This device cannot store the game (storage is full or off): it will be lost when the page closes. Delete old games on the home page.',
      ),
    0,
  );
}
export const save = () => {
  if (heldNext) return; // a roll is on screen: its result is already saved; the board shown is older and must not be written back
  const json = JSON.stringify(g);
  if (!storeGame(json)) storageWarn();
  if (!applyingRemote) {
    void push(g);
    handOver();
    record(true);
  }
};
/* 4.1 the replay journal: each change is a step; online each seat writes only its own blocks (the database keeps the journal unread until the game is over) */
const rec = new Recorder(VOL.sides);
export let recLast = '',
  replayShown = false;
export const setReplayShown = <T extends typeof replayShown>(v: T): T => ((replayShown = v), v);
export function record(own: boolean, gm: E.Game = g) {
  if (TUTORIAL || SANDBOX) return;
  if (online.mode === 'remote') {
    const me = online.mySide();
    if (!me) return rec.seen(gm);
    const u = JSON.stringify(unitsOf(gm, me)),
      mine = () => {
        if (u !== rec.units) {
          rec.units = u;
          void journal.add(seatKey(me), u);
        }
      }; // the step first, then the blocks: a step's blocks are those written after it
    if (!own) {
      rec.seen(gm);
      return mine();
    }
    const p = rec.pub(gm),
      k = JSON.stringify([p.t, p.ph, p.side, u]);
    if (p.msg.length || p.dice || k !== recLast) {
      recLast = k;
      void journal.add('pub', JSON.stringify(p));
    }
    mine();
  } else if (own) {
    const p = rec.pub(gm),
      u = unitsOf(gm, null),
      k = JSON.stringify([p.t, p.ph, p.side, u]);
    if (!p.msg.length && !p.dice && k === recLast) return;
    recLast = k;
    localJournal.add(KEY, p, u);
  }
}
/** Open the replay of this game (4.1). */
export async function showReplay() {
  let steps = online.mode === 'remote' ? null : localJournal.read(KEY).map((e) => ({ pub: e.pub, units: e.units }));
  if (!steps) {
    const j = await journal.read();
    const part = (k: string) => Object.values(j?.[k] ?? {});
    steps = j ? buildSteps(part('pub'), [part('german'), part('allied')]) : [];
  }
  if (!steps.length) return say('No replay for this game: only games played since the replay arrived are recorded.');
  const ref = new Map<string, E.Unit>([...E.newGame(1, g.opts).units, ...g.units].map((u) => [u.id, u]));
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`,
    scen = VOL.scenarios.find((s) => s.id === g.opts.scenario)?.name ?? '';
  const names = online.active ? [seatName(online.seats, P1), seatName(online.seats, P2)].filter(Boolean).join(' vs ') : '';
  openReplay({
    title: [VOL.name, scen, names].filter(Boolean).join(' · '),
    result: g.over ?? `Turn ${g.turn}, not finished`,
    steps,
    sides: [P1, P2],
    sideName: VOL.sideName,
    tag: VOL.tag,
    board: boardCv.toDataURL('image/jpeg', 0.86),
    size: [MW, MH],
    label: (a) => MAP.areas.find((x) => x.id === a)?.label ?? null,
    areaName: (a) => E.areas.get(a)?.name ?? String(a),
    face: (id, str) => {
      const u = ref.get(id);
      return u ? { svg: VOL.unitSvg({ ...u, str, area: u.area ?? 0 }, g), side: u.side, name: u.name } : null;
    },
    wood: Object.fromEntries(VOL.sides.map((sd) => [sd, hex(VOL.wood[sd] ?? 0x777777)])),
    phaseName: (ph) => STEP_NAME[ph] ?? ph,
    close: () => render(),
    areaIds: MAP.areas.map((a) => a.id).filter((a) => E.areas.has(a) && (!g.inPlay || g.inPlay.includes(a))),
  });
}
/** This player's move handed the move to the opponent: the push relay tells them, even with their app closed (4.3 step 2). */
function handOver() {
  const me = online.mySide();
  if (online.mode !== 'remote' || !me) return;
  const now = turnOf(g, other(me));
  if (oppTurn === false && now) void pushNotify(TABLE, auth.token);
  oppTurn = now;
}
