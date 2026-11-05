// FAB: Golan '73 combat round (series 6.1–6.8 with 14.01 assaults, 14.51b engineers bridging the AT ditch, 15.3 air assault,
// 15.6 strongpoints, 15.7 ghosts, 15.12 mixed Syrian divisions, 16.11 commando raids, 16.12 SAM fire, 16.21/16.22 Israeli bonuses,
// 16.24 garrisons, 16.31a close air support, 22.17 free Breakthrough combat rounds).
// A battle is a small state machine on g.battle: set-up (assign assets), then the firing steps one roll at a time, with the
// players' choices in between (first loss, abort, disorder/retreat, retreat destination, exploitation).
import { HERMON, area, connection, edgeKey, eastOfSam, enemyOf, isAssembly, neighbors, type GSide } from './map';
import { assetLimits, brigadeExtraDie, moraleSn, samResult, successNumber, unitDice, type GShooter, type GTarget, type Quality } from './combat';
import { chit, contested, count, eliminate, inSupply, isNight, newlyContested, onMap, roll, unit, updateControl, type GChit, type GGame, type GUnit } from './game';
export { mustFight, newlyContested } from './game';

type Step = 'attArty' | 'defArty' | 'defFire' | 'offFire';
export interface GRoll { who: string; sn: number; dice: number[]; hits: number; kind: 'arty' | 'ground' | 'morale' | 'sam' }
export interface GBattle {
  area: number; attacker: GSide; bt: boolean; assault: boolean; airAssault: boolean;
  stage: 'setup' | Step | 'attFirst' | 'attChoice' | 'defChoice' | 'retreat' | 'exploit' | 'done';
  queue: Step[]; assets: Record<GSide, string[]>;
  air: Record<GSide, { id: string; mode: 'arty' | 'support'; unit?: string }[]>;
  engBridge?: string;                       // 14.51b: the AT ditch edge a Syrian engineer will bridge instead of firing
  attPoint?: string; defPoint?: string; pending: number; pendingKind?: 'arty' | 'ground';
  hit: Record<GSide, string[]>; unitHit: Record<GSide, boolean>; rolls: GRoll[];
  retreat?: { side: GSide; queue: string[]; moved: boolean; after: 'arty' | 'ground' | 'abort'; excess: number };
  exploitIds?: string[]; exploit: boolean; result?: string;
}
export const other = enemyOf;
const ok = (die: number, sn: number) => die === 1 || (die !== 10 && die <= sn);
const say = (g: GGame, text: string) => g.log.push({ turn: g.turn, side: g.player, phase: g.phase, text });
const quality = (u: GUnit): Quality => u.q[Math.max(0, u.str - 1)] ?? 'veteran';
const ARTY = new Set(['artillery', 'rocket_artillery']);
const BATTLE = new Set(['armor_asset', 'infantry_asset', 'engineer', 'task_force', 'commando']);
const isBattleAsset = (c: GChit) => BATTLE.has(c.kind);
const chitCls = (c: GChit) => (c.kind === 'armor_asset' || (c.kind === 'task_force' && c.name.includes('armor')) ? 'armor' : 'infantry') as 'armor' | 'infantry';

/* ---------- who is in the battle ---------- */
/** Units of a side in the area that take part: ghosts never; for the Attacker, units in good order and no strongpoints (6.2, 15.6). */
export function fighters(g: GGame, a: number, side: GSide, attacker: boolean) {
  return onMap(g, a).filter((u) => u.side === side && u.kind !== 'ghost' && !(attacker && (u.disorder > 0 || u.kind === 'strongpoint')));
}
/** Assets standing in the area: garrisons (16.24) and commando raids (16.11a) act as battle assets or as a defended roadblock. */
const standing = (g: GGame, a: number, side: GSide) => g.chits.filter((c) => c.box === 'map' && c.area === a && c.side === side && (c.kind === 'garrison' || c.kind === 'commando'));

function pickPoint(g: GGame, b: GBattle, side: GSide): string | undefined {
  const us = fighters(g, b.area, side, side === b.attacker);
  if (us.length) return [...us].sort((x, y) => +!!x.kind - +!!y.kind || y.str - x.str)[0].id;       // regular units before strongpoints
  return side === b.attacker ? undefined : standing(g, b.area, side)[0]?.id;                         // 6.24: an asset only if no unit is present
}
function fixPoint(g: GGame, b: GBattle) {
  const live = (id?: string) => !!id && (g.units.some((u) => u.id === id && u.box === 'map' && u.area === b.area) || g.chits.some((c) => c.id === id && c.box === 'map' && c.area === b.area));
  if (!live(b.attPoint)) b.attPoint = pickPoint(g, b, b.attacker);
  if (!live(b.defPoint)) b.defPoint = pickPoint(g, b, other(b.attacker));
}
const pointOf = (g: GGame, id?: string): { cls: 'armor' | 'infantry'; q: Quality; sp?: 'armor' | 'infantry' } | null => {
  if (!id) return null;
  const u = g.units.find((x) => x.id === id); if (u) return { cls: u.cls, q: quality(u), sp: u.kind === 'strongpoint' ? u.support : undefined };
  const c = g.chits.find((x) => x.id === id); return c ? { cls: chitCls(c), q: c.quality ?? 'veteran' } : null;
};
/** Syrian units of different divisions in one area (15.12); independent units mix freely. */
const mixedDivisions = (g: GGame, a: number) => new Set(onMap(g, a).filter((u) => u.side === 'syrian' && u.division).map((u) => u.division)).size > 1;

/* ---------- starting a battle ---------- */
export function startBattle(g: GGame, a: number): GBattle {
  if (g.battle) throw new Error('a battle is already open');
  const bt = g.phase === 'btCombat';
  if ((g.phase !== 'combat' && !bt) || (g.fought ?? []).includes(a)) throw new Error('no battle here this phase');
  const att = g.player, isNew = newlyContested(g).includes(a);
  if (!contested(g, a) && !(isNew && standing(g, a, other(att)).length)) throw new Error('the area is not contested');
  if (!fighters(g, a, att, true).length) throw new Error('no attacking unit in good order');
  if (bt && !isNew) {                                                                                 // 7.42: re-engaging costs a Special Action, 22.17 two free rounds on turn 1
    if (g.turn === 1 && att === 'syrian' && g.freeCombatRound > 0) { g.freeCombatRound--; say(g, `Free Breakthrough combat round in ${a} (22.17).`); }
    else throw new Error('re-engaging an already contested area costs a Special Action (8.22)');
  }
  const b: GBattle = { area: a, attacker: att, bt, assault: g.riverAssault.includes(a), airAssault: !!g.airAssaultArea && g.airAssaultArea === a, stage: 'setup', queue: [],
    assets: { israeli: [], syrian: [] }, air: { israeli: [], syrian: [] }, pending: 0, hit: { israeli: [], syrian: [] }, unitHit: { israeli: false, syrian: false }, rolls: [], exploit: false };
  g.battle = b; fixPoint(g, b);
  return b;
}

/* ---------- assets (6.22, 6.23, 15.12, 16.21, 16.22, 16.31a, 9.34a) ---------- */
export function limits(g: GGame, b: GBattle, side: GSide) {
  const hermon = side === 'israeli' && !g.hermonLost && g.control[HERMON] === 'israeli' && (count(g, HERMON).israeli > 0 || g.chits.some((c) => c.box === 'map' && c.area === HERMON && c.side === 'israeli'));
  const samUp = g.chits.some((c) => c.kind === 'sam' && c.box === 'available');
  return assetLimits(side, side === b.attacker, { mixedDivisions: side === 'syrian' && mixedDivisions(g, b.area), israeliHoldsHermon: hermon, eastOfSamBarrier: eastOfSam(b.area), samAvailable: samUp });
}
export function canAssign(g: GGame, b: GBattle, c: GChit, mode?: 'arty' | 'support'): string | null {
  const side = c.side as GSide;
  if (b.stage !== 'setup') return 'assets are committed before the first roll';
  if (c.box !== 'available') return 'not in the Available Box';
  const supplied = inSupply(g, side, b.area) && !onMap(g, b.area).some((u) => u.side === side && u.unsupplied);
  const lim = limits(g, b, side), mine = b.assets[side].map((id) => chit(g, id));
  if (c.kind === 'air_mission') {                                                                    // 16.31a, 16.22; air needs no supply (16.31)
    if (isNight(g)) return 'no air support on the night turn (14.03)';
    const air = b.air[side];
    if (air.length >= lim.air) return lim.air === 2 ? 'at most two air support assets' : 'one air support asset per battle';
    if (air.length === 1 && air[0].mode === (mode ?? 'arty')) return 'with two air assets, one fires as artillery and the other supports a unit (16.22)';
    return null;
  }
  if (b.airAssault && !inSupply(g, side, b.area) && side === 'syrian') return 'an air assault that cannot trace supply gets only one air support asset (15.3)';
  if (!supplied) return 'units that cannot trace supply may not have assets (9.34a)';
  if (ARTY.has(c.kind)) return mine.filter((x) => ARTY.has(x.kind)).length >= lim.artillery ? `at most ${lim.artillery} artillery asset(s)` : null;
  if (isBattleAsset(c)) {
    if (c.kind === 'commando' && c.side !== 'syrian') return 'Syrian only';
    if (b.area === HERMON && c.kind !== 'infantry_asset' && c.kind !== 'commando') return 'on Mt Hermon only infantry-class battle assets (14.16)';
    return mine.filter(isBattleAsset).length >= lim.battle ? (lim.battle ? `at most ${lim.battle} battle assets` : 'mixed Syrian divisions: no battle assets (15.12)') : null;
  }
  return 'this counter is not assigned to battles (events come with the event rules)';
}
export function assign(g: GGame, b: GBattle, id: string, mode?: 'arty' | 'support', unitId?: string) {
  const c = chit(g, id), err = canAssign(g, b, c, mode); if (err) throw new Error(err);
  const side = c.side as GSide;
  c.box = 'map'; c.area = b.area;
  if (c.kind === 'air_mission') {
    b.air[side].push({ id, mode: mode ?? 'arty', unit: unitId });
    if (side === 'israeli' && eastOfSam(b.area)) samWindow(g, b, id);
  } else b.assets[side].push(id);
}
export function unassign(g: GGame, b: GBattle, id: string) {
  if (b.stage !== 'setup') throw new Error('combat has begun');
  const c = chit(g, id), side = c.side as GSide; c.box = 'available'; c.area = undefined;
  b.assets[side] = b.assets[side].filter((x) => x !== id); b.air[side] = b.air[side].filter((x) => x.id !== id);
}
/** 16.12: an Israeli air asset placed east of the SAM barrier may be answered at once by an available SAM. */
function samWindow(g: GGame, _b: GBattle, airId: string) { g.samTarget = airId; }
export function fireSam(g: GGame, samId: string) {
  const b = g.battle, air = g.samTarget; if (!air) throw new Error('no Israeli air mission to answer');
  const sam = chit(g, samId); if (sam.kind !== 'sam' || sam.box !== 'available') throw new Error('no SAM asset available');
  const die = roll(g), res = samResult(g.turn, die); sam.box = 'used'; g.samTarget = undefined;
  const a = chit(g, air);
  if (res !== 'none') { a.box = res === 'eliminated' ? 'eliminated' : 'used'; a.area = undefined; if (b) for (const s of ['israeli', 'syrian'] as GSide[]) b.air[s] = b.air[s].filter((x) => x.id !== air); }
  b?.rolls.push({ who: `SAM against ${a.name}`, sn: 0, dice: [die], hits: res === 'none' ? 0 : 1, kind: 'sam' });
  say(g, `SAM air defence fire: ${die} — ${res === 'eliminated' ? 'the air asset is shot down' : res === 'used' ? 'the air mission is cancelled' : 'no effect'} (16.12).`);
  return res;
}
export const declineSam = (g: GGame) => { g.samTarget = undefined; };
/** 14.51b: a Syrian engineer in a battle on the Israeli side may bridge an adjoining AT ditch boundary instead of firing. */
export function setEngineerBridge(g: GGame, b: GBattle, to: number | null) {
  if (to == null) { b.engBridge = undefined; return; }
  const c = connection(b.area, to);
  if (b.attacker !== 'syrian' || area(b.area).syria || !c?.atDitch || g.bridgedDitch.includes(edgeKey(b.area, to))) throw new Error('no AT ditch to bridge there');
  if (!b.assets.syrian.some((id) => chit(g, id).kind === 'engineer')) throw new Error('assign an engineer asset first');
  b.engBridge = edgeKey(b.area, to);
}

/* ---------- fire ---------- */
export interface GFire { key: string; who: string; shooter: GShooter; dice: number; sn: number; parts: [string, number][]; brigade?: string }
export function fireList(g: GGame, b: GBattle, side: GSide, kind: 'arty' | 'ground'): GFire[] {
  fixPoint(g, b);
  const att = side === b.attacker, tp = pointOf(g, att ? b.defPoint : b.attPoint); if (!tp) return [];
  const defender = other(b.attacker);
  const tgt: GTarget = { pointCls: tp.cls, pointQuality: tp.q, strongpoint: tp.sp, fieldWorks: att && g.fieldWorks.includes(b.area), riverAssaultMarker: !att && b.assault };
  const set = { firerIsAttacker: att, tdn: area(b.area).tdn, assault: b.assault, night: isNight(g) };
  const out: GFire[] = [];
  const add = (key: string, who: string, s: GShooter, dice: number, brigade?: string) => { const r = successNumber(s, tgt, set); out.push({ key, who, shooter: s, dice, sn: r.sn, parts: r.parts, brigade }); };
  if (kind === 'arty') {
    for (const id of b.assets[side]) { const c = chit(g, id); if (ARTY.has(c.kind)) add(id, c.name, { side, kind: 'artillery', cls: 'infantry', rocket: c.kind === 'rocket_artillery' }, 1); }
    for (const a of b.air[side]) if (a.mode === 'arty') add(a.id, 'Air Support (as artillery)', { side, kind: 'air', cls: 'infantry' }, 1);
    return out;
  }
  const cas = new Set(b.air[side].filter((a) => a.mode === 'support').map((a) => a.unit));
  for (const u of fighters(g, b.area, side, att))
    add(u.id, u.name, { side, kind: 'unit', cls: u.cls, quality: quality(u), strongpoint: u.kind === 'strongpoint' ? u.support : undefined, disordered: u.disorder > 0, unsupplied: u.unsupplied, closeAirSupport: cas.has(u.id) },
      unitDice(u.str, u.kind === 'strongpoint'), side === 'israeli' && u.brigade && !u.kind ? u.brigade : undefined);
  for (const id of b.assets[side]) {
    const c = chit(g, id); if (!isBattleAsset(c)) continue;
    if (att && c.kind === 'engineer' && b.engBridge) continue;                                     // 14.51b: bridging instead of firing
    add(id, c.name, { side, kind: 'battle', cls: chitCls(c), quality: c.quality ?? 'veteran' }, 1);
  }
  for (const c of standing(g, b.area, side)) {
    if (c.kind === 'commando' && g.raidPartial?.includes(b.area)) continue;                          // 16.11a partly successful raid does not fire back
    add(c.id, c.name, { side, kind: 'battle', cls: 'infantry', quality: c.quality ?? 'veteran' }, 1);
  }
  for (const x of brigadeExtraDie(out.filter((f) => f.brigade).map((f) => ({ brigade: f.brigade!, sn: f.sn, side }))))           // 15.51
    out.push({ key: `brigade:${x.brigade}`, who: `${x.brigade} brigade integrity`, shooter: { side, kind: 'unit', cls: 'infantry' }, dice: 1, sn: x.sn, parts: [['brigade integrity extra die (15.51)', 0]] });
  void defender;
  return out;
}
function doFire(g: GGame, b: GBattle, side: GSide, kind: 'arty' | 'ground') {
  let total = 0;
  for (const f of fireList(g, b, side, kind)) {
    const dice = Array.from({ length: f.dice }, () => roll(g)), hits = dice.filter((d) => ok(d, f.sn)).length; total += hits;
    b.rolls.push({ who: f.who, sn: f.sn, dice, hits, kind });
  }
  say(g, `${area(b.area).name}: ${side} ${kind === 'arty' ? 'artillery' : 'ground fire'} ${total} hit(s).`);
  return total;
}

/* ---------- losses (6.41–6.43) ---------- */
function participants(g: GGame, b: GBattle, side: GSide) {
  const att = side === b.attacker;
  return [...b.assets[side].map((id) => chit(g, id)).filter(isBattleAsset).map((c) => ({ key: c.id, asset: true, str: 1 })),
    ...standing(g, b.area, side).map((c) => ({ key: c.id, asset: true, str: 1 })),
    ...fighters(g, b.area, side, att).map((u) => ({ key: u.id, asset: false, str: u.str }))];
}
function stepLoss(g: GGame, b: GBattle, side: GSide, key: string) {
  const c = g.chits.find((x) => x.id === key);
  if (c) {
    c.box = 'eliminated'; c.area = undefined; b.assets[side] = b.assets[side].filter((x) => x !== key);
    if (c.kind === 'commando') { g.raids = g.raids.filter((a) => a !== b.area); g.raidPartial = (g.raidPartial ?? []).filter((a) => a !== b.area); }
    say(g, `${c.name} eliminated.`); return;
  }
  const u = unit(g, key); u.str -= 1; b.unitHit[side] = true;
  if (u.str <= 0) { say(g, `${u.name} eliminated.`); eliminate(g, u); } else say(g, `${u.name} loses a step.`);
}
function allocate(g: GGame, b: GBattle, side: GSide, n: number) {
  const hit = new Set(b.hit[side]);
  for (let i = 0; i < n; i++) {
    fixPoint(g, b);
    const ps = participants(g, b, side); if (!ps.length) return n - i;
    let cand = ps.filter((p) => !hit.has(p.key)); if (!cand.length) { hit.clear(); cand = ps; }
    const pid = side === b.attacker ? b.attPoint : b.defPoint;
    if (!b.unitHit[side] && cand.some((p) => p.key === pid)) cand = cand.filter((p) => p.asset || p.key === pid);
    cand.sort((x, y) => +!x.asset - +!y.asset || +(x.key !== pid) - +(y.key !== pid) || x.str - y.str);
    stepLoss(g, b, side, cand[0].key); hit.add(cand[0].key); b.hit[side] = [...hit];
  }
  return 0;
}
const allGone = (g: GGame, b: GBattle, side: GSide) => !participants(g, b, side).length;

/* ---------- the round ---------- */
export function beginCombat(g: GGame, b: GBattle) {
  if (b.stage !== 'setup') throw new Error('already started');
  if (g.samTarget) throw new Error('the SAM answer to the air mission is pending');
  for (const u of onMap(g, b.area)) {
    if (u.kind === 'ghost') { u.box = 'eliminated'; u.area = null; say(g, `A Ghost is revealed in ${b.area} and removed (15.7).`); continue; }
    u.revealed = true;                                                                                   // 6.24
  }
  fixPoint(g, b);
  if (!pickPoint(g, b, other(b.attacker))) {                                                             // only ghosts were there
    for (const a of [b.area]) updateControl(g, a);
    return end(g, b, 'Defender eliminated (the Israeli position was a Ghost)');
  }
  b.queue = ['attArty', 'defArty', 'defFire', 'offFire']; next(g, b);
}
function next(g: GGame, b: GBattle) {
  fixPoint(g, b);
  if (!fighters(g, b.area, b.attacker, true).length) return end(g, b, b.result ?? 'Attacker eliminated');
  const s = b.queue.shift(); if (!s) return end(g, b, b.result ?? 'Area remains contested');
  if ((s === 'attArty' || s === 'defArty') && !fireList(g, b, s === 'attArty' ? b.attacker : other(b.attacker), 'arty').length) return next(g, b);
  b.stage = s;
}
/** Roll the current firing step. */
export function rollStep(g: GGame, b: GBattle) {
  const st = b.stage, def = other(b.attacker);
  if (st === 'exploit') {
    for (const id of b.exploitIds ?? []) { const u = unit(g, id); if (u.area !== b.area) continue;
      const sn = moraleSn(quality(u), { disordered: u.disorder > 0, unsupplied: u.unsupplied, nightExploitation: isNight(g) }), die = roll(g), pass = ok(die, sn);
      if (pass) u.exploit = true; b.rolls.push({ who: u.name, sn, dice: [die], hits: pass ? 1 : 0, kind: 'morale' }); say(g, `${u.name} exploitation check ${die} vs ${sn}: ${pass ? 'exploitation marker' : 'no'}.`); }
    b.exploitIds = undefined; b.stage = 'done'; return;
  }
  if (st === 'attArty') return hitDefender(g, b, doFire(g, b, b.attacker, 'arty'), 'arty');
  if (st === 'defArty' || st === 'defFire') return hitAttacker(g, b, doFire(g, b, def, st === 'defArty' ? 'arty' : 'ground'));
  if (st === 'offFire') {
    if (b.engBridge) {                                                                                  // 14.51b: the engineer survived both fire steps
      if (b.assets.syrian.some((id) => chit(g, id).kind === 'engineer')) { g.bridgedDitch.push(b.engBridge); say(g, `A Syrian engineer bridges the AT ditch ${b.engBridge} (14.51b).`); }
      b.engBridge = undefined;
    }
    return hitDefender(g, b, doFire(g, b, b.attacker, 'ground'), 'ground');
  }
  throw new Error('nothing to roll');
}
function hitAttacker(g: GGame, b: GBattle, h: number) {
  if (h > 0) {
    if (b.assets[b.attacker].some((id) => isBattleAsset(chit(g, id)))) { b.pending = h; b.stage = 'attFirst'; return; }    // 6.41a
    allocate(g, b, b.attacker, 1);
  }
  afterFirstHit(g, b, h - 1);
}
function afterFirstHit(g: GGame, b: GBattle, rest: number) {
  if (rest > 0 && fighters(g, b.area, b.attacker, true).length) { b.pending = rest; b.stage = 'attChoice'; return; }
  next(g, b);
}
/** 6.41a: the first hit on the Attacker falls on the point unit or on one assigned battle asset. */
export function chooseFirstLoss(g: GGame, b: GBattle, key: string) {
  if (b.stage !== 'attFirst') throw new Error('no choice pending');
  fixPoint(g, b);
  if (key !== b.attPoint && !b.assets[b.attacker].includes(key)) throw new Error('the first loss falls on the point unit or one battle asset');
  const h = b.pending; b.pending = 0; stepLoss(g, b, b.attacker, key); b.hit[b.attacker] = [...new Set([...b.hit[b.attacker], key])];
  afterFirstHit(g, b, h - 1);
}
/** 6.41b: abort (attackers disordered; in an assault they go back across the boundary they crossed, 14.01a) or take the losses. */
export function attackerChoice(g: GGame, b: GBattle, abort: boolean) {
  if (b.stage !== 'attChoice') throw new Error('no choice pending');
  if (!abort) { allocate(g, b, b.attacker, b.pending); b.pending = 0; return next(g, b); }
  b.pending = 0; b.queue = [];
  const us = fighters(g, b.area, b.attacker, true);
  for (const u of onMap(g, b.area).filter((x) => x.side === b.attacker)) u.disorder = 1;
  if (b.assault) { b.retreat = { side: b.attacker, queue: us.map((u) => u.id), moved: false, after: 'abort', excess: 0 }; b.result = 'Attack aborted: the attackers fall back across the boundary they crossed'; return advanceRetreat(g, b); }
  end(g, b, 'Attack aborted: attackers disordered');
}
function hitDefender(g: GGame, b: GBattle, h: number, kind: 'arty' | 'ground') {
  const def = other(b.attacker);
  if (h > 0 && g.fieldWorks.includes(b.area)) { g.fieldWorks = g.fieldWorks.filter((x) => x !== b.area); h--; say(g, 'Field works absorb a hit.'); }   // 6.42a
  b.pending = h; b.pendingKind = kind;
  const real = fighters(g, b.area, def, false);
  const canDis = kind === 'arty' && real.some((u) => u.disorder !== 1);                                // 6.42b
  const canRet = kind === 'ground' && real.some((u) => !u.kind);                                       // 6.42c: strongpoints never retreat
  if (h > 0 && (canDis || canRet)) { b.stage = 'defChoice'; return; }
  applyDef(g, b, h, kind, false);
}
/** 6.42b/c: absorb one hit by disordering the defenders (artillery) or retreating them (ground fire). */
export function defenderChoice(g: GGame, b: GBattle, use: boolean) {
  if (b.stage !== 'defChoice') throw new Error('no choice pending');
  const kind = b.pendingKind!, def = other(b.attacker); let h = b.pending;
  if (use && kind === 'arty') { for (const u of fighters(g, b.area, def, false)) u.disorder = 1; h--; say(g, 'The defenders become disordered to absorb a hit.'); }
  applyDef(g, b, h, kind, use && kind === 'ground');
}
function applyDef(g: GGame, b: GBattle, h: number, kind: 'arty' | 'ground', retreat: boolean) {
  const def = other(b.attacker);
  if (retreat) {
    h--;
    for (const c of standing(g, b.area, def)) { if (h > 0) h--; stepLoss(g, b, def, c.id); }          // 16.24: a garrison left behind is destroyed, and counts as a hit taken
  }
  const excess = allocate(g, b, def, h); b.pending = 0;
  if (retreat) {
    const goers = fighters(g, b.area, def, false).filter((u) => !u.kind);
    b.retreat = { side: def, queue: goers.map((u) => u.id), moved: false, after: kind, excess };
    return advanceRetreat(g, b);
  }
  finishDef(g, b, kind, false, excess);
}
function finishDef(g: GGame, b: GBattle, kind: 'arty' | 'ground', retreated: boolean, excess: number) {
  const def = other(b.attacker);
  if (allGone(g, b, def)) {
    b.result = retreated ? 'Defender retreated' : 'Defender eliminated';
    b.exploit = !retreated && (kind === 'arty' || excess > 0);
    b.queue = b.queue.filter((s) => s === 'defArty');
  }
  next(g, b);
}

/* ---------- retreats (6.6, 14.02, 14.42, 15.6 evacuation, 16.11a) ---------- */
export function retreatOptions(g: GGame, b: GBattle): number[] {
  const r = b.retreat; if (!r) return [];
  const u = unit(g, r.queue[0]), enemy = other(r.side);
  const allowed = (n: number) => {
    if (isAssembly(n)) return false;
    const c = connection(b.area, n)!;
    if (c.kind === 'hermon' && u.cls !== 'infantry') return false;
    if (c.rugged && c.kind !== 'road' && u.cls === 'armor') return false;                              // a boundary it could not cross moving
    if (c.escarpment && c.kind !== 'road') return false;
    if (r.after === 'abort') return u.from === n;                                                       // 14.01a: back across the boundary it crossed
    return g.control[n] === r.side && count(g, n)[enemy] === 0 && !(r.side === 'israeli' && g.raids.includes(n));
  };
  let opts = neighbors(b.area).filter(allowed);
  if (r.side === 'syrian' && g.turn <= 4 && r.after !== 'abort') {                                      // 14.42: across an operational boundary only if nothing else
    const inside = opts.filter((n) => !connection(b.area, n)!.sector); if (inside.length) opts = inside;
  }
  const roomy = opts.filter((n) => count(g, n)[r.side] < 2);
  return roomy.length ? roomy : [];
}
function advanceRetreat(g: GGame, b: GBattle) {
  const r = b.retreat!;
  while (r.queue.length) {
    const u = unit(g, r.queue[0]);
    if (u.box !== 'map' || u.area !== b.area) { r.queue.shift(); continue; }
    const opts = retreatOptions(g, b);
    if (!opts.length) { say(g, `${u.name} cannot retreat and loses a step instead.`); stepLoss(g, b, r.side, u.id); if (u.box === 'map') { r.queue.shift(); } else r.queue.shift(); continue; }
    if (opts.length === 1) { moveRetreat(g, b, u, opts[0]); r.queue.shift(); continue; }
    b.stage = 'retreat'; return;
  }
  b.retreat = undefined;
  evacuate(g, b.area);
  if (r.after === 'abort') return end(g, b, b.result ?? 'Attack aborted');
  finishDef(g, b, r.after, r.moved, r.excess);
}
function moveRetreat(g: GGame, b: GBattle, u: GUnit, to: number) {
  const from = u.area!, key = edgeKey(from, to);
  if (u.side === 'syrian' && g.minefields.includes(key)) {                                              // 14.02: retreating across a minefield
    const die = roll(g), sn = moraleSn(quality(u), { disordered: u.disorder > 0, unsupplied: u.unsupplied });
    if (!ok(die, sn)) { say(g, `${u.name} retreats through the minefield and loses a step (${die} vs ${sn}).`); u.str--; if (u.str <= 0) { eliminate(g, u); b.retreat!.moved = true; return; } }
  }
  u.area = to; u.disorder = 1; u.reserve = false; b.retreat!.moved = true;
  updateControl(g, from); updateControl(g, to); say(g, `${u.name} retreats to ${to}.`);
}
export function chooseRetreat(g: GGame, b: GBattle, to: number) {
  if (b.stage !== 'retreat' || !b.retreat) throw new Error('no retreat pending');
  if (!retreatOptions(g, b).includes(to)) throw new Error('cannot retreat there');
  moveRetreat(g, b, unit(g, b.retreat.queue[0]), to); b.retreat.queue.shift(); advanceRetreat(g, b);
}
/** 15.6: once a regular unit retreats (or leaves) a contested area, its strongpoint is evacuated and a matching Task Force goes into the cup. */
function evacuate(g: GGame, a: number) {
  const sp = onMap(g, a).find((u) => u.kind === 'strongpoint'); if (!sp || count(g, a).syrian === 0) return;
  sp.box = 'evacuated'; sp.area = null;
  const tf = g.chits.find((c) => c.box === 'evacuated_strongpoints' && c.kind === 'task_force' && c.name.includes(sp.support === 'armor' ? 'armor' : 'infantry'));
  if (tf) tf.box = 'cup';
  say(g, `The strongpoint in ${a} is evacuated; a Task Force goes into the Israeli cup (15.6).`);
}

/* ---------- end of the round (6.29, 6.8) ---------- */
function end(g: GGame, b: GBattle, result: string) {
  b.result = result; b.stage = 'done';
  for (const s of ['israeli', 'syrian'] as GSide[]) {
    for (const id of b.assets[s]) { const c = chit(g, id); if (c.box === 'map') { c.box = 'used'; c.area = undefined; } }
    for (const a of b.air[s]) { const c = chit(g, a.id); if (c.box === 'map') { c.box = 'used'; c.area = undefined; } }
  }
  (g.fought ??= []).push(b.area);
  for (const n of [b.area, ...neighbors(b.area)]) if (!isAssembly(n)) updateControl(g, n);
  if (!contested(g, b.area)) { for (const u of onMap(g, b.area)) u.revealed = false; g.riverAssault = g.riverAssault.filter((x) => x !== b.area); }
  if (b.airAssault) g.airAssaultArea = undefined;
  say(g, `${area(b.area).name}: ${result}.`);
  const cand = b.exploit && !b.bt && !b.assault ? fighters(g, b.area, b.attacker, true).filter((u) => u.cls === 'armor' && !u.unsupplied).map((u) => u.id) : [];   // 6.8, 14.01
  if (cand.length) { b.stage = 'exploit'; b.exploitIds = cand; }
}
export function declineExploit(g: GGame, b: GBattle) { if (b.stage !== 'exploit') throw new Error('no exploitation pending'); b.exploitIds = undefined; b.stage = 'done'; }
export function closeBattle(g: GGame) { if (g.battle?.stage !== 'done') throw new Error('battle not finished'); g.battle = null; }

/* ---------- 15.3 Air Assault: the 82nd Para, once, east of the SAM barrier or onto Mt Hermon, first thing in a Combat Phase ---------- */
export const airAssaultTargets = (g: GGame) => {
  const para = g.units.find((u) => u.id === 'S17');
  if (!para || para.box !== 'air_assault' || g.phase !== 'combat' || g.player !== 'syrian' || g.turn === 2 || (g.fought ?? []).length || g.battle) return [];
  return [...Array(84).keys()].filter((a) => a > 0 && (eastOfSam(a) || a === HERMON) && count(g, a).syrian < 2);
};
export function airAssault(g: GGame, a: number) {
  if (!airAssaultTargets(g).includes(a)) throw new Error('no air assault there');
  const u = unit(g, 'S17'); u.box = 'map'; u.area = a; u.revealed = false;
  say(g, `The 82nd Para lands in ${area(a).name} (15.3).`);
  if (count(g, a).israeli > 0 || g.chits.some((c) => c.box === 'map' && c.area === a && c.side === 'israeli')) { g.riverAssault.push(a); g.airAssaultArea = a; }
  else updateControl(g, a);
}
