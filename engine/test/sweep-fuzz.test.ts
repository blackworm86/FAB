// Sweep fuzzer: complete games of every volume, scenario and optional-rule mix, played by a seeded RANDOM legal-move policy
// (random moves, strategic moves, chit plays, battle choices, arrival placements), checking invariants after every action:
// no exception from a legal action, rejected actions leave the game untouched, always a way forward, the game ends by its last
// turn, units in one place with valid steps, stacking at phase ends, control follows occupation, supply flags, VP recomputation,
// the turn/phase sequence, auditChange on honest play, the split/redacted copy never leaks a hidden block and round-trips,
// and determinism (same seed, same game). FUZZ_SEEDS=n widens the sweep while hunting.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import type { Game, Side, Unit, Battle } from '../src';

const G = E.golan, S = E.sicily;
/** Hunting switches (FUZZ_SEEDS, FUZZ_BASE, FUZZ_PRINT, FUZZ_FULL, FUZZ_DEBUG, FUZZ_DET) read without Node typings. */
const ENV: Record<string, string | undefined> = ((globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env) ?? {};

/* ================= seeded policy RNG ================= */
const mulberry = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type Cfg = { game: 'bulge' | 'golan73' | 'sicily'; scenario: string; opts: Record<string, unknown>; seed: number; maxActions?: number; light?: boolean; stopAt?: number };
type Result = { g: Game; problems: string[]; trace: string[]; actions: number };

const canon = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
export const TIMES = { clone: 0, check: 0, redact: 0 };
const PHASE_ORDER = ['reinforcement', 'admin', 'movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat', 'supply'];
const STATE_KEYS = new Set(['id', 'side', 'area', 'disorder', 'unsupplied', 'moved', 'reserve', 'exploit', 'up', 'spent', 'adjOnly', 'delayed', 'interdict', 'rec', 'box', 'garrison', 'bcross', 'paradrop', 'untried', 'nation']);
const BLANK_KEYS = new Set(['name', 'cls', 'q', 'max', 'str', 'code', 'symbol', 'ech', 'entry', 'arrival', 'chitId', 'from', 'ghost', 'fort', 'kind', 'division', 'brigade', 'symbol2', 'peiperFull', 'heydte']);

export function play(cfg: Cfg): Result {
  E.useGame(cfg.game);
  E.setRandom(null);
  const r = mulberry(cfg.seed * 7 + 13), pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)], chance = (p: number) => r() < p;
  const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const g = E.newGame(cfg.seed, { scenario: cfg.scenario, ...cfg.opts } as never);
  const problems: string[] = [], trace: string[] = [];
  let actions = 0, stop = false, battles = 0, stale = new Set<number>();
  const max = cfg.maxActions ?? 20000;
  const sides = E.sidesOf(g), [P1, P2] = sides;
  const markerTotal = (gg: Game) => { const t: Record<string, number> = {}; for (const s of sides) for (const [k, v] of Object.entries(gg.markers[s] ?? {})) t[`${s}.${k}`] = (t[`${s}.${k}`] ?? 0) + v; for (const u of gg.units) if (u.reserve) t[`${u.side}.${u.reserve}`] = (t[`${u.side}.${u.reserve}`] ?? 0) + 1; return t; };
  const markers0 = JSON.stringify(markerTotal(g));
  const where = () => `T${g.turn} ${g.phasing} ${g.phase}`;
  const seen = new Set<string>();
  const fail = (msg: string) => { const k = msg.replace(/[0-9]+/g, 'N'); if (seen.has(k)) return; seen.add(k); if (problems.length < 100) problems.push(`[${cfg.game}/${cfg.scenario}/${JSON.stringify(cfg.opts)}/seed ${cfg.seed}] #${actions} ${where()}: ${msg}`); };
  const replace = (from: Game) => { for (const k of Object.keys(g)) delete (g as unknown as Record<string, unknown>)[k]; Object.assign(g, structuredClone(from)); };
  const json = (x: unknown) => JSON.stringify(x);
  const isBoxArea = (a: number) => (cfg.game === 'sicily' ? S.isBox(a) : cfg.game === 'golan73' ? G.isAssembly(a) : false);

  /** One action by `side`. legal: chosen from the engine's own options, so it must not throw. Otherwise a probe: a throw is fine but must not change the game. */
  function act(side: Side | null, label: string, f: () => unknown, legal = true): unknown {
    if (stop || problems.length >= 100) { stop = true; return undefined; }
    actions++; if (actions > max) { fail('too many actions: the game does not end'); stop = true; return undefined; }
    if (cfg.stopAt != null && actions >= cfg.stopAt) { stop = true; return undefined; }
    const t1 = performance.now(); const prev = structuredClone(g); TIMES.clone += performance.now() - t1; let out: unknown, err: Error | null = null;
    E.useGame(cfg.game); E.setPlayArea(g.inPlay);
    try { out = f(); } catch (e) { err = e as Error; }
    if (err) {
      if (legal) { fail(`${label} threw: ${err.message}`); trace.push(`${label} !! ${err.message}`); replace(prev); return undefined; }
      if (json(prev) !== json(g)) { fail(`rejected ${label} (${err.message}) changed the game`); }
      replace(prev); return undefined;
    }
    trace.push(label);
    const t0 = performance.now(); check(prev, side, label); TIMES.check += performance.now() - t0;
    return out ?? true;
  }

  /* ================= invariants ================= */
  function check(prev: Game, side: Side | null, label: string) {
    const ids = new Set<string>();
    for (const u of g.units) {
      if (ids.has(u.id)) fail(`duplicate unit id ${u.id}`); ids.add(u.id);
      if (u.area != null) {
        if (!E.areas.has(u.area)) fail(`${u.id} in unknown area ${u.area}`);
        if (g.inPlay && !g.inPlay.includes(u.area)) fail(`${u.id} ${u.name} in area ${u.area} outside the area of play`);
        if (!Number.isInteger(u.str) || u.str < 1 || u.str > u.max) fail(`${u.id} ${u.name} on the map with ${u.str}/${u.max} steps`);
        if (u.box) fail(`${u.id} ${u.name} on the map (area ${u.area}) and in box ${u.box}`);
      } else {
        if (u.reserve) fail(`${u.id} ${u.name} off the map keeps reserve marker ${u.reserve}`);
      }
      if (![0, 1, 2].includes(u.disorder)) fail(`${u.id} disorder ${u.disorder}`);
      if (u.str < 0) fail(`${u.id} negative strength`);
    }
    for (const s of sides) for (const [k, v] of Object.entries(g.markers[s] ?? {})) if (v < 0) fail(`${s} reserve markers ${k} = ${v}`);
    const mt = json(markerTotal(g)); if (mt !== markers0) fail(`reserve markers not conserved after ${label}: ${markers0} -> ${mt}`);
    if (g.turn > g.lastTurn) fail(`turn ${g.turn} past the last turn ${g.lastTurn}`);
    if (g.battle && !['setup', 'attArty', 'defArty', 'defFire', 'offFire', 'attChoice', 'attFirst', 'loss', 'defChoice', 'retreat', 'exploit', 'done'].includes(g.battle.stage)) fail(`battle stage ${g.battle.stage}`);
    if (!g.battle && !g.pendingBlow) {
      // control follows occupation (5.2): an area held by regular blocks of one side only is that side's
      const staleNow = new Set<number>();
      for (const a of E.areas.keys()) {
        if (isBoxArea(a)) continue;
        const us = E.unitsIn(g, a); if (!us.length) continue;
        const sd = new Set(us.map((u) => u.side)); if (sd.size !== 1) continue;
        const s = us[0].side; if (!us.some((u) => !u.garrison)) continue;
        if (g.control[a] !== s) { staleNow.add(a); if (!stale.has(a)) fail(`area ${a} ${E.areas.get(a)!.name} held only by ${s} blocks (${us.map((u) => u.name).join(', ')}) but controlled by ${g.control[a]} after ${label}`); }
      }
      stale = staleNow;
    }
    // VP: the victory function is a pure recomputation
    if (!cfg.light || label === 'endPhase') { const before = json(g), v1 = E.victory(g), v2 = E.victory(g); if (json(g) !== before) fail('victory() changed the game'); if (json(v1) !== json(v2)) fail('victory() not repeatable');
      if (!Number.isFinite(v1.net) || v1.net !== v1[P1] - v1[P2]) fail(`victory net ${v1.net} != ${v1[P1]} - ${v1[P2]}`); }
    // the turn and phase sequence
    if (label === 'endPhase' && !g.over) {
      const a = { t: prev.turn, s: prev.phasing, p: prev.phase }, b = { t: g.turn, s: g.phasing, p: g.phase };
      let ok = false;
      if (a.p === 'deploy') ok = b.t === 1 && (b.p === 'movement' || b.p === 'combat');
      else if (a.p === 'supply') ok = (a.s === P1 && b.t === a.t && b.s === P2 && b.p === 'admin') || (a.s === P2 && b.t === a.t + 1 && b.s === P1 && b.p === 'reinforcement');
      else ok = b.t === a.t && b.s === a.s && PHASE_ORDER.indexOf(b.p) === PHASE_ORDER.indexOf(a.p) + 1;
      if (!ok) fail(`phase sequence ${a.t} ${a.s} ${a.p} -> ${b.t} ${b.s} ${b.p}`);
      if (['movement', 'strategic', 'combat', 'reaction', 'btMove', 'btCombat'].includes(a.p)) stacking(`end of ${a.p}`);
      if (b.p === 'supply') supplyFlags();
    }
    // referee-lite: honest play is never flagged
    if (side) { const pr = E.auditChange(prev, g, side); if (pr.length) fail(`auditChange flags honest ${label} by ${side}: ${pr.join(' | ')}`); }
    if (cfg.light ? (label === 'endPhase' && ['movement', 'supply'].includes(prev.phase)) || (label === 'closeBattle' && ++battles % 3 === 0) : label === 'endPhase' || label.startsWith('beginCombat') || label.startsWith('closeBattle')) redaction(label);
  }
  function stacking(when: string) {
    const lim = (a: number) => (E.VOLUME.stackLimit?.(g, a) ?? 2);
    for (const a of E.areas.keys()) for (const s of sides) {
      const us = E.blocks(g, a, s).filter((u) => !u.fort && !u.ghost), gh = E.blocks(g, a, s).filter((u) => u.ghost);
      if (us.length > lim(a)) fail(`${when}: ${us.length} ${s} blocks in ${a} ${E.areas.get(a)!.name} (${us.map((u) => u.name).join(', ')})`);
      if (gh.length + us.length > lim(a) + (g.opts.advGhosts ? 1 : 0) && !G.isAssembly?.(a)) fail(`${when}: ${gh.length} ghosts + ${us.length} units in ${a}`);
    }
  }
  function supplyFlags() {
    const V = E.VOLUME;
    for (const u of g.units) {
      if (u.area == null || u.garrison) continue;
      const want = !(V.alwaysSupplied?.(g, u) || (V.unitSupply ? V.unitSupply(g, u) : E.inSupply(g, u.side, u.area))) && !u.fort;
      if (u.unsupplied !== want) fail(`supply flag of ${u.id} ${u.name} in ${u.area}: ${u.unsupplied}, recomputed ${want}`);
    }
  }
  function redaction(label: string) { const t4 = performance.now(); try { redaction0(label); } finally { TIMES.redact += performance.now() - t4; } }
  function redaction0(label: string) {
    const salts: Record<string, string> = { [P1]: `s1-${cfg.seed}`, [P2]: `s2-${cfg.seed}` };
    const priv = (s: Side) => ({ salt: salts[s], secrets: E.secretsOf(g, s) });
    const p1 = E.toPublic(g, P1, priv(P1), new Map());
    const pubStr = E.toPublic(JSON.parse(p1) as Game, P2, priv(P2), new Map()), pub = JSON.parse(pubStr) as Game;
    const hidden = g.units.filter((u) => !E.visibleTo(g, u, 'spectator'));
    const visibleNames = new Set([...g.units.filter((u) => E.visibleTo(g, u, 'spectator')).map((u) => u.name), ...g.chits.map((c) => c.name)]);
    const prose = json([pub.log, pub.checks, pub.battle?.rolls]);
    for (const u of hidden) {
      if (pubStr.includes(`"${u.id}"`)) fail(`redaction (${label}): hidden ${u.id} ${u.name} keeps its id in the shared copy`);
      const esc = u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (u.name.length > 2 && !visibleNames.has(u.name) && new RegExp(`(?<![\\w+])${esc}(?![\\w])`).test(prose)) fail(`redaction (${label}): hidden ${u.id} ${u.name}'s name appears in the shared copy`);
    }
    const aliases = new Set(pub.units.filter((u) => E.isPlaceholder(u)).map((u) => u.id));
    for (const pu of pub.units.filter((u) => aliases.has(u.id))) {
      const real = hidden.find((h) => E.aliasOf({ salt: salts[h.side] }, h.id) === pu.id);
      for (const [k, v] of Object.entries(pu)) if (!STATE_KEYS.has(k) && !BLANK_KEYS.has(k) && v !== undefined && v !== false) fail(`redaction (${label}): hidden ${real?.id} ${real?.name} shows ${k}=${json(v)} in the shared copy`);
    }
    for (const s of sides) {
      const mine = E.compose(pub, priv(s), {}).game;
      for (const u of g.units.filter((x) => x.side === s)) { const m = mine.units.find((x) => x.id === u.id); if (canon(m) !== canon(u)) { const ks = [...new Set([...Object.keys(u), ...Object.keys(m ?? {})])].filter((k) => json((m as unknown as Record<string, unknown>)?.[k]) !== json((u as unknown as Record<string, unknown>)[k])); fail(`redaction round-trip (${label}): ${s} seat gets ${u.id} ${u.name} back with ${ks.map((k) => `${k}=${json((m as unknown as Record<string, unknown>)?.[k])} (was ${json((u as unknown as Record<string, unknown>)[k])})`).join(', ')}`); break; } }
      const theirs = JSON.parse(E.toPublic(g, E.other(s), priv(E.other(s)), new Map())) as Game, strip = (x: Game) => canon({ ...x, units: [], log: [], checks: [] });
      if (strip(mine) !== strip(theirs)) fail(`redaction round-trip (${label}): the ${s} seat's game differs outside the units`);
    }
  }

  /* ================= the policy ================= */
  const inPlayAreas = () => [...E.areas.keys()].filter((a) => !g.inPlay || g.inPlay.includes(a));
  const own = (s: Side) => g.units.filter((u) => u.side === s && u.area != null);
  const areaGuess = (s: Side) => { const mine = own(s).map((u) => u.area!); const near = mine.flatMap((a) => E.neighbors(a)); return chance(0.15) || !mine.length ? pick(inPlayAreas()) : chance(0.5) ? pick(mine) : pick(near.length ? near : mine); };
  const avail = (s: Side) => E.boxOf(g, s, 'available');

  function resolvePending() {
    for (let k = 0; k < 10 && !stop; k++) {
      if (g.pendingBlow) { const u = g.units.find((x) => x.id === g.pendingBlow!.unit)!; act(E.other(u.side), 'resolveBlow', () => E.resolveBlow(g, chance(0.5))); continue; }
      if (g.recover.length) { const s = g.recover[0]; const used = E.boxOf(g, s, 'used').filter((c) => E.VOLUME.id === 'bulge' ? ['engineer', 'artillery', 'rocket_artillery', 'armor_asset', 'fuel', 'infantry_asset', 'command_staff', 'task_force'].includes(c.kind) : true);
        const cand = used.filter((c) => { try { return isAssetChit(c); } catch { return false; } }); act(s, 'recoverAsset', () => E.recoverAsset(g, s, cand.length && chance(0.8) ? pick(cand).id : null)); continue; }
      if (g.artyPick) { const arts = E.boxOf(g, 'german', 'used').filter((c) => c.kind === 'artillery'); act('german', 'chooseArtyLoss', () => E.chooseArtyLoss(g, pick(arts).id)); continue; }
      if (cfg.game === 'golan73' && G.state(g).samTarget) { const sams = avail('syrian').filter((c) => c.kind === 'sam'); act('syrian', 'SAM answer', () => (sams.length && chance(0.6) ? G.fireSam(g, pick(sams).id) : G.declineSam(g))); continue; }
      if (cfg.game === 'sicily') { const V = S.state(g); const sd = V.moralePick && (['axis', 'allied'] as const).find((x) => V.moralePick![x] > 0);
        if (sd) { const pool = g.chits.filter((x) => x.side === 'axis' && x.nation === 'italian' && x.box === 'available' && x.kind !== 'command_staff' && (E.isArty(x) || E.isBattleAsset(x)));
          if (pool.length) act(sd, 'pickMoraleLoss', () => S.pickMoraleLoss(g, sd, pick(pool).id)); else act(sd, 'autoMoraleLoss', () => S.autoMoraleLoss(g)); continue; } }
      break;
    }
  }
  const isAssetChit = (c: E.Chit) => E.isArty(c) || E.isBattleAsset(c) || c.kind === 'fuel' || c.kind === 'command_staff' || c.kind === 'sam' || (c.kind === 'air_mission' && cfg.game !== 'bulge');

  /* ---------- set-up ---------- */
  function deploy() {
    if (cfg.game === 'golan73') {
      const V = G.state(g);
      act('israeli', 'autoStrongpoints', () => G.autoStrongpoints(g, chance(0.5) ? 'historical' : 'shuffle'));
      for (const u of shuffle(g.units.filter((x) => x.box === 'deploy'))) { const o = G.deployOptions(g, u.id); if (o.length) act(u.side, `deploy ${u.id}`, () => G.deploy(g, u.id, pick(o))); }
      for (let k = 0; k < 6 && V.minesLeft; k++) { const o = G.minefieldOptions(g); if (!o.length) break; const [a, b] = pick(o).split('-').map(Number); act('israeli', 'placeMinefield', () => G.placeMinefield(g, a, b)); }
      for (const s of sides) { const n = Math.floor(r() * 3); for (let k = 0; k < n; k++) { const us = g.units.filter((u) => u.side === s && u.area != null && !u.garrison && !u.fort && !u.ghost && !G.isAssembly(u.area)); if (us.length && G.setupReserves(g, s).max) act(s, 'deployReserve', () => G.deployReserve(g, pick(us).id), false); } }
      act(null, 'autoReserves', () => G.autoReserves(g));
      for (const c of G.alowdaCommandos(g)) { const o = G.alowdaRaidAreas(g); if (o.length) act('syrian', 'alowdaRaid', () => G.alowdaRaid(g, c.id, pick(o))); }
      if (g.units.some((u) => u.box === 'deploy')) fail(`set-up cannot be completed: ${g.units.filter((u) => u.box === 'deploy').map((u) => `${u.id} (${G.deployOptions(g, u.id).length} options)`).join(', ')}`);
    } else if (cfg.game === 'sicily') {
      for (const u of shuffle(g.units.filter((x) => x.box === 'deploy' && x.untried))) { const o = S.deployOptions(g, u.id); if (o.length) act('axis', `deploy ${u.id}`, () => S.deploy(g, u.id, pick(o))); }
      if (!S.state(g).plan) { const plan = chance(0.5) ? 'alternate' : 'historical', o = S.planOptions(g, plan); act('allied', `choosePlan ${plan}`, () => S.choosePlan(g, plan, pick(o.british), o.us.length ? pick(o.us) : undefined)); }
      for (const u of shuffle(g.units.filter((x) => x.box === 'deploy' && !x.untried))) { const o = S.deployOptions(g, u.id); if (o.length) act('allied', `deploy ${u.id}`, () => S.deploy(g, u.id, pick(o))); }
      if (g.units.some((u) => u.box === 'deploy')) fail(`set-up cannot be completed: ${g.units.filter((u) => u.box === 'deploy').map((u) => u.id).join(', ')}`);
    }
  }

  /* ---------- battles ---------- */
  function fight(a: number, viaSA = false) {
    const att = g.phasing, def = E.other(att);
    if (!act(att, `startBattle ${a}${viaSA ? ' (SA)' : ''}`, () => E.startBattle(g, a, viaSA), !viaSA)) return;
    let b = g.battle!;
    // set-up in the order of 6.21-6.23: the Defender's Special Action decision, then the Attacker's assets, then the Defender's
    if (b.defSA) {
      const ro = cfg.game === 'golan73' ? G.reinforceOptions(g, b) : E.neighbors(a).flatMap((x) => E.unitsIn(g, x, def)).filter((u) => !u.garrison).map((u) => u.id);
      if (chance(0.1)) act(def, 'defenderRetreatSA', () => E.defenderRetreatSA(g, b), false);
      else if (ro.length && chance(0.3)) act(def, 'defenderReinforceSA', () => E.defenderReinforceSA(g, b, pick(ro)), false);
      resolvePending(); if (!g.battle) return; b = g.battle;
      if (b.stage === 'setup' && b.defSA) act(def, 'passSA', () => E.passSA(g, b));
    }
    /** The volume's own battle choices, each made by its side in that side's own set-up step. */
    const options = (s: Side) => {
      b = g.battle!; if (!b || b.stage !== 'setup') return;
      if (cfg.game === 'golan73') {
        const ew = avail(att).find((c) => c.kind === 'event_ew'); if (s === att && ew && chance(0.3)) act(att, 'playJamming', () => G.playJamming(g, b, ew.id), false);
        if (G.battleState(b).ew?.pending) { const cm = avail(def).find((c) => c.kind === 'event_ew'); act(def, 'answerJamming', () => G.answerJamming(g, b, cm && chance(0.5) ? cm.id : undefined)); }
        const cb = avail(s).find((c) => c.kind === 'event_counterbattery'); if (cb && chance(0.3)) act(s, 'playCounterbattery', () => G.playCounterbattery(g, b, cb.id), false);
        const ch = G.chemicalOptions(g); if (s === 'syrian' && ch.length && chance(0.5)) act('syrian', 'playChemical', () => G.playChemical(g, pick(ch)));
        const fl = G.flankOptions(g); if (s === 'israeli' && fl.length && chance(0.5)) act('israeli', 'playFlank', () => G.playFlank(g, pick(fl)), false);
        if (s === 'israeli' && G.strongpointSwapOption(g) && chance(0.5)) act('israeli', 'swapStrongpointIntoAttack', () => G.swapStrongpointIntoAttack(g));
        if (s === att && att === 'syrian' && chance(0.3)) act('syrian', 'setEngineerBridge', () => G.setEngineerBridge(g, b, pick(E.neighbors(a))), false);
      } else if (cfg.game === 'sicily') {
        const air = avail(s).find((c) => c.kind === 'air_mission'); if (air && E.airOf(b, E.other(s)).length && !E.airOf(b, s).length && chance(0.4)) act(s, 'dogfight', () => S.dogfight(g, b, air.id));   // 16.32: the dogfight is the side's one air commitment
        const nav = b.assets[att].find((id) => E.chit(g, id).kind === 'naval_support'); if (s === att && nav && chance(0.5)) act(att, 'setNavalShock', () => S.setNavalShock(g, b, nav));
        const rg = b.assets[att].find((id) => ['ranger', 'commando'].includes(E.chit(g, id).subtype ?? '')); if (s === att && rg && chance(0.5)) act(att, 'setRangerFw', () => S.setRangerFw(g, b, rg));
      } else if (s === att && chance(0.3)) act(att, 'setEngFw', () => E.setEngFw(g, b, true));
      resolvePending();
    };
    if (b.stage === 'setup') for (const s of [att, def]) {
      if (s === def) {
        resolvePending(); b = g.battle!; if (!b || b.stage !== 'setup') break;
        if (chance(0.04) && !b.locked) { act(att, 'cancelBattle', () => E.cancelBattle(g)); return; }
        act(att, 'setReady', () => E.setReady(g, b, att));
      }
      for (const c of shuffle(avail(s))) {
        if (!chance(0.5)) continue;
        const mode = c.kind === 'air_mission' ? (chance(0.5) ? 'arty' : 'support') : undefined;
        const unit = mode === 'support' ? pick(E.unitsIn(g, a, s).filter((u) => !u.garrison).map((u) => u.id).concat([''])) || undefined : undefined;
        if (E.canAssign(g, b, s, c, mode) == null) act(s, `assign ${c.id}`, () => E.assign(g, b, c.id, mode, unit));
        resolvePending(); b = g.battle!; if (!b) return;
      }
      if (chance(0.3)) { const us = E.unitsIn(g, a, s).filter((u) => !u.garrison && !u.ghost && (s !== att || !u.disorder)); if (us.length) act(s, 'setPoint', () => E.setPoint(g, b, s, pick(us).id), false); }
      options(s); if (!g.battle) return; b = g.battle;
    }
    resolvePending(); if (!g.battle) return; b = g.battle;
    // the rounds
    for (let k = 0; k < 300 && g.battle && !stop; k++) {
      b = g.battle; const st = b.stage;
      const who = (E.actorOf(g) === 'both' ? att : E.actorOf(g)) as Side;
      if (st === 'done') { act(att, 'closeBattle', () => E.closeBattle(g)); return; }
      if (st === 'setup') { resolvePending(); if (!g.battle || g.battle.stage !== 'setup') continue; const w = E.setupSide(g, g.battle); act(w, 'setReady', () => E.setReady(g, g.battle!, w)); continue; }
      if (st === 'loss') { const keys = E.lossOptions(g, b); if (!keys.length) fail('loss stage with nothing to choose'); const who = b.loss!.side; if (chance(0.2)) act(who, 'autoLosses', () => E.autoLosses(g, b)); else act(who, 'chooseLoss', () => E.chooseLoss(g, b, pick(keys))); continue; }
      if (st === 'attFirst') { const keys = [b.attPoint, ...b.assets[att].filter((id) => E.isBattleAsset(E.chit(g, id)))]; act(att, 'chooseFirstLoss', () => E.chooseFirstLoss(g, b, pick(keys))); continue; }
      if (st === 'attChoice') { const abort = chance(0.25) && !E.VOLUME.canAbort?.(g, b); act(att, `attackerChoice ${abort}`, () => E.attackerChoice(g, b, abort)); continue; }
      if (st === 'defChoice') { const use = chance(0.5); act(def, `defenderChoice ${use}`, () => E.defenderChoice(g, b, use)); continue; }
      if (st === 'retreat') { const o = E.retreatOptions(g, b); if (!o.length) { fail(`battle in ${a} stuck at stage retreat with no retreat option`); stop = true; return; } act(b.retreat!.side, 'chooseRetreat', () => E.chooseRetreat(g, b, pick(o))); continue; }
      if (st === 'exploit') { if (chance(0.5)) act(att, 'declineExploit', () => E.declineExploit(g, b)); else act(att, 'roll exploit', () => E.roll_step(g, b)); continue; }
      act(who, `roll ${st}`, () => E.roll_step(g, b));
    }
    if (g.battle && !stop) { fail(`battle in ${a} never finished (stage ${g.battle.stage})`); stop = true; }
  }

  /* ---------- the phases ---------- */
  const moveSome = (mover: Side, p: number) => {
    for (const u of shuffle(g.units.filter((x) => x.side === mover && x.area != null))) {
      if (stop) return;
      if (!chance(p)) continue;
      for (let k = 0; k < 3; k++) {
        const o = E.moveOptions(g, u.id); if (!o.length) break;
        const res = act(mover, `move ${u.id} -> ${'?'}`, () => E.move(g, u.id, pick(o).area));
        resolvePending();
        if (res !== 'stopped' && res !== 'minefield' && res !== 'interdict' && !(u.moved === false && u.spent)) break;
      }
    }
  };
  function admin() {
    for (const s of shuffle([...sides])) {
      const tries = 25;
      for (let k = 0; k < tries && !stop; k++) {
        const cs = avail(s); if (!cs.length) break;
        const c = pick(cs), A = () => areaGuess(s), U = (mine = true) => pick(g.units.filter((u) => (mine ? u.side === s : u.side !== s) && u.area != null).concat(g.units.filter((u) => u.side === s && u.area == null && u.str === 0))) ?? g.units[0];
        const tries2: [string, () => unknown][] = [];
        if (cfg.game === 'bulge') tries2.push(
          ['blowBridges', () => { const a = A(); const t = E.bridgeTargets(g, s, a); return E.blowBridges(g, c.id, a, t.slice(0, 1 + Math.floor(r() * 2))); }],
          ['repairBridge', () => { const a = A(); return E.repairBridge(g, c.id, a, pick(E.repairTargets(g, s, a))); }],
          ['fieldWorksFor', () => E.fieldWorksFor(g, c.id, A())], ['playReplacement', () => E.playReplacement(g, c.id, U().id)], ['playRebuild', () => E.playRebuild(g, c.id, U().id, A())],
          ['alternateUse', () => E.alternateUse(g, c.id)], ['rally', () => E.rally(g, s, A(), c.id)], ['qualityReplacement', () => E.qualityReplacement(g, U().id, c.id)],
          ['staffReplacement', () => E.staffReplacement(g, c.id, U().id)], ['staffReserve', () => E.staffReserve(g, c.id, U().id)], ['releaseUnit', () => E.releaseUnit(g, c.id, pick([4, 6] as const))],
          ['playGreifBridge', () => { const a = A(); return E.playGreifBridge(g, c.id, a, pick(E.neighbors(a))); }], ['playInterdict', () => E.playInterdict(g, c.id, U(false).id)], ['playBodenplatte', () => E.playBodenplatte(g, c.id)],
          ['heydteDrop', () => E.heydteDrop(g, c.id, pick([31, 52] as const))], ['roadblock', () => E.roadblock(g, c.id, pick(E.roadblockAreas(g, s).concat([A()])), chance(0.5))],
          ['staffBoundary', () => E.staffBoundary(g, c.id, U().id)], ['staffPool', () => E.staffPool(g, c.id, A())], ['staffIntel', () => E.staffIntel(g, c.id, U(false).id)], ['playInterdiction', () => E.playInterdiction(g, c.id, A())]);
        if (cfg.game === 'golan73') tries2.push(
          ['blowBridges', () => { const a = A(); return G.blowBridges(g, c.id, a, [pick(E.neighbors(a))]); }], ['repairBridge', () => { const a = A(); return G.repairBridge(g, c.id, a, pick(E.neighbors(a))); }],
          ['engineerFieldWorks', () => G.engineerFieldWorks(g, c.id, A())], ['bridgeDitch', () => { const a = A(); return G.bridgeDitch(g, c.id, a, pick(E.neighbors(a))); }], ['removeMinefield', () => { const a = A(); return G.removeMinefield(g, c.id, a, pick(E.neighbors(a))); }],
          ['airInterdiction', () => G.airInterdiction(g, c.id, A())], ['airRecon', () => G.airRecon(g, c.id, U(false).area!)], ['placeRaid', () => G.placeRaid(g, c.id, A())], ['playRelease', () => G.playRelease(g, c.id)], ['playSSM', () => G.playSSM(g, c.id)],
          ['playArrivingBattalion', () => G.playArrivingBattalion(g, c.id, chance(0.5) ? { add: U().id } : { rebuild: U().id, assembly: pick(['A', 'B'] as const) })], ['playLtZvika', () => G.playLtZvika(g, c.id, A())], ['playKingHassan', () => G.playKingHassan(g, c.id)],
          ['playReplacement', () => G.playReplacement(g, c.id, U().id)], ['alternateEventUse', () => G.alternateEventUse(g, c.id, E.boxOf(g, s, 'eliminated').slice(0, 2).map((x) => x.id))], ['mergeUnits', () => G.mergeUnits(g, U().id, U().id, c.id)],
          ['releaseOperationalReserve', () => G.releaseOperationalReserve(g, c.id)], ['replaceAsset', () => G.replaceAsset(g, s, pick(E.boxOf(g, s, 'eliminated')).id, c.id)], ['freeThe33rd', () => G.freeThe33rd(g, c.id)], ['releaseGolani', () => G.releaseGolani(g, c.id)],
          ['rally', () => E.rally(g, s, A(), c.id)], ['qualityReplacement', () => E.qualityReplacement(g, U().id, c.id)]);
        if (cfg.game === 'sicily') tries2.push(
          ['releaseDivision', () => S.releaseDivision(g, U().division ?? '', c.id, chance(0.3) ? pick(['br_1st_cdn_arm', 'br_4th_arm', 'br_231st']) : undefined)], ['playArmyRelease', () => S.playArmyRelease(g, c.id)],
          ['airInterdiction', () => S.airInterdiction(g, c.id, A())], ['dogfightInterdiction', () => S.dogfightInterdiction(g, c.id, pick(Object.keys(g.interdicted).map(Number).concat([A()])))], ['portWork', () => S.portWork(g, c.id, pick(['P1', 'P2', 'P3']))],
          ['axisStaffRecover', () => S.axisStaffRecover(g, c.id, pick(E.boxOf(g, 'axis', 'eliminated').concat(c)).id)], ['playPatton', () => S.playPatton(g, c.id)], ['playTacticalExtract', () => S.playTacticalExtract(g, c.id)], ['playFadingMorale', () => S.playFadingMorale(g, c.id)],
          ['playFlanking', () => S.playFlanking(g, c.id, pick(S.flankTargets(g, c.id).concat([A()])))], ['playReplacement', () => E.playReplacement(g, c.id, U().id)], ['rally', () => E.rally(g, s, A(), c.id)], ['qualityReplacement', () => E.qualityReplacement(g, U().id, c.id)],
          ['staffIntel', () => E.staffIntel(g, c.id, U(false).id)]);
        const [nm, f] = pick(tries2);
        act(s, `${nm} ${c.id}`, f, false); resolvePending();
        // a flanking invasion that landed on defenders may fight one round now (17.22)
        if (cfg.game === 'sicily' && nm === 'playFlanking' && g.phasing === 'allied') for (const a of Object.keys(S.state(g).flank).map(Number)) if (E.contested(g, a) && !g.fought.includes(a) && E.VOLUME.battleAllowed?.(g, a)) fight(a);   // 17.22 (an older landing still contested fights in the Combat Phase): the round is fought at once
      }
    }
  }
  function phase() {
    resolvePending();
    const ph = g.phase, mover = ph === 'reaction' ? E.other(g.phasing) : g.phasing;
    if (ph === 'deploy') deploy();
    else if (ph === 'reinforcement') {
      for (const id of g.tfNew ?? []) { const ok = inPlayAreas().filter((a) => g.control[a] === 'allied' && !E.contested(g, a) && E.inSupply(g, 'allied', a)); if (ok.length && chance(0.8)) act('allied', 'placeTaskForce', () => E.placeTaskForce(g, id, pick(ok))); }
      for (const id of shuffle([...g.pendingArrivals])) { const o = E.arrivalOptions(g, id); const u = g.units.find((x) => x.id === id)!; if (o.length && chance(0.85)) { const opt = pick(o); act(u.side, `placeArrival ${id}`, () => E.placeArrival(g, id, opt.area)); } }
      for (const id of [...g.arrived]) { const ro = E.rerouteOptions(g, id); const u = g.units.find((x) => x.id === id)!; if (ro.length && chance(0.1)) act(u.side, 'reroute', () => E.reroute(g, id, pick(ro))); }
    } else if (ph === 'admin') admin();
    else if (ph === 'movement' || ph === 'reaction' || ph === 'btMove') {
      if (ph === 'btMove') for (const u of shuffle(own(mover))) if (chance(0.1) && E.saAvailable(g, mover, u.ech).length) act(mover, 'activateBreakthrough', () => E.activateBreakthrough(g, u.id), false);
      if (ph === 'btMove' && cfg.game === 'bulge') for (const u of own(mover)) if (E.peiperCan(g, u) && chance(0.5)) act(mover, 'setPeiperFull', () => E.setPeiperFull(g, u.id, true));
      if (ph === 'movement' && cfg.game === 'sicily') for (const u of own(mover)) if (S.canEvacuate(g, u) && chance(0.3)) act(mover, 'evacuate', () => S.evacuate(g, u.id));
      moveSome(mover, ph === 'movement' ? 0.7 : 0.5);
      for (const u of shuffle(own(mover))) { if (chance(0.08)) act(mover, 'buildFieldWorks', () => (cfg.game === 'golan73' ? G.unitFieldWorks(g, u.id) : cfg.game === 'sicily' ? S.unitFieldWorks(g, u.id) : E.buildFieldWorks(g, u.id)), false); }
      if (ph === 'movement') for (const u of shuffle(own(mover))) if (E.canReserve(g, u) && chance(0.4)) act(mover, 'setReserve', () => E.setReserve(g, u.id, true), false);
    } else if (ph === 'strategic') {
      for (const u of shuffle(own(g.phasing))) { const o = E.stratOptions(g, u.id); if (o.length && chance(0.6)) act(g.phasing, `stratMove ${u.id}`, () => E.stratMove(g, u.id, pick(o))); else if (cfg.game === 'sicily' && S.canEvacuate(g, u) && chance(0.3)) act(g.phasing, 'evacuate', () => S.evacuate(g, u.id)); }
    } else if (ph === 'combat' || ph === 'btCombat') {
      if (cfg.game === 'golan73') { const t = G.airAssaultTargets(g); if (t.length && chance(0.5)) act('syrian', 'airAssault', () => G.airAssault(g, pick(t))); }
      if (cfg.game === 'sicily' && S.state(g).dropPending) for (const u of g.units.filter((x) => x.box === 'airborne_assault' && x.side === 'allied')) { const t = S.airDropTargets(g, u.id); act('allied', `airDrop ${u.id}`, () => S.airDrop(g, u.id, t.length ? pick(t) : null)); }
      for (let k = 0; k < 40 && !stop; k++) {
        const must = E.mustFight(g);
        // airborne assaults first (Sicily 14.27a)
        const fb = E.firstBattle(g), first = fb != null ? [fb] : cfg.game === 'sicily' ? S.state(g).airborneAreas.filter((a) => E.contested(g, a) && !g.fought.includes(a)) : [];   // 15.3 / 14.27a: fought first
        if (first.length) { fight(first[0]); continue; }
        if (must.length) { fight(pick(must)); continue; }
        const opt = E.contestedAreas(g).filter((a) => !g.fought.includes(a) && E.fighters(g, a, g.phasing, true).some((u) => !u.garrison));
        if (opt.length && chance(0.3)) { fight(pick(opt), ph === 'btCombat' && !E.newlyContested(g).includes(opt[0])); continue; }
        break;
      }
    } else if (ph === 'supply') {
      if (cfg.game === 'bulge') { const air = avail(g.phasing).find((c) => c.kind === 'air_mission'); const ar = E.airSupplyAreas(g, g.phasing); if (air && ar.length && chance(0.5)) act(g.phasing, 'playAirSupply', () => E.playAirSupply(g, air.id, pick(ar))); }
      if (cfg.game === 'sicily') { const air = avail(g.phasing).find((c) => c.kind === 'air_mission'); const ar = own(g.phasing).filter((u) => u.unsupplied).map((u) => u.area!); if (air && ar.length && chance(0.5)) act(g.phasing, 'airSupply', () => S.airSupply(g, air.id, pick(ar))); }
      if (cfg.game === 'golan73' && G.zvikaOnMap(g) && chance(0.3)) act('israeli', 'zvikaToCup', () => G.zvikaToCup(g));
      if (chance(0.5)) act(g.phasing, 'rollSupply', () => E.rollSupply(g));
    }
    resolvePending();
  }

  for (let turns = 0; !g.over && !stop; turns++) {
    if (turns > 400) { fail('too many phases'); break; }
    phase();
    if (stop) break;
    const who = E.actorOf(g) === 'both' ? g.phasing : (E.actorOf(g) as Side);
    if (!act(who, 'endPhase', () => E.endPhase(g))) { fail('stuck: the phase cannot end after the policy did everything it must'); break; }
  }
  if (!stop && !g.over) fail('game did not end');
  if (g.over && g.turn > g.lastTurn) fail('ended after the last turn');
  return { g, problems, trace, actions };
}

/* ================= the sweep ================= */
const MIXES: Record<string, { scen: string[]; opts: Record<string, unknown>[] }> = {
  bulge: { scen: ['tournament', 'campaign', 'intro', 'cold'], opts: [{}, { fuel: false }, { bridgeLimit: true, bid: 2, peiper: true, pz150: true, airborne: true, advArty: true, overrun: true, fwMaintain: true, randomReinf: true }, { bid: -3, overrun: true, randomReinf: true }] },
  golan73: { scen: ['badr', 'badr_alt', 'nafakh', 'alowda'], opts: [{}, { atAssets: true, t62: true, chemical: true, flank: true, artyArmor: true, zvikaCup: true, raidMod: true, battleRecovery: true, advGhosts: true }, { advGhosts: true, artyArmor: true }] },
  sicily: { scen: ['sunrise_bridge', 'tournament', 'campaign', 'campaign_hist'], opts: [{}, { airborne: true, advArty: true, overrun: true, fwMaintain: true }] },
};
const HUNT = +(ENV.FUZZ_SEEDS ?? 0);
const sweepGames = (m: { opts: Record<string, unknown>[] }) => (HUNT ? m.opts.flatMap((o, i) => Array.from({ length: HUNT }, (_, s) => ({ opts: o, seed: 1000 * i + s + 1 + +(ENV.FUZZ_BASE ?? 0) })))
  : [{ opts: m.opts[0], seed: 1 }, { opts: m.opts[m.opts.length - 1], seed: 2 }]);

describe('sweep fuzz: random legal play keeps every invariant', () => {
  for (const [game, m] of Object.entries(MIXES)) for (const scen of m.scen) {
    it(`${game} ${scen}`, () => {
      const all: string[] = [];
      for (const { opts, seed } of sweepGames(m)) all.push(...play({ game: game as Cfg['game'], scenario: scen, opts, seed, light: !ENV.FUZZ_FULL }).problems);
      if (ENV.FUZZ_PRINT) console.log(all.join('\n'));
      expect(all).toEqual([]);
    }, 600_000);
  }
  it('is deterministic: the same seed and the same choices give the same game', () => {
    for (const [game, scenario] of [['bulge', 'campaign'], ['golan73', 'badr'], ['sicily', 'campaign']] as const) {
      const a = play({ game, scenario, opts: {}, seed: 7, light: true, stopAt: 400 }), b = play({ game, scenario, opts: {}, seed: 7, light: true, stopAt: 400 });
      expect(b.trace).toEqual(a.trace); expect(canon(b.g)).toBe(canon(a.g));
    }
  }, 600_000);
});

if (ENV.FUZZ_DEBUG) describe('debug one game', () => {
  it('replays', () => {
    const [game, scenario, opts, seed, stopAt, light] = JSON.parse(ENV.FUZZ_DEBUG!);
    const res = play({ game, scenario, opts, seed, stopAt, light });
    console.log(JSON.stringify(TIMES), res.actions); console.log(res.problems.join('\n')); console.log(res.trace.slice(-25).join('\n'));
  }, 600_000);
});

if (ENV.FUZZ_DET) describe('debug determinism across games', () => {
  it('same seed alone and after other games', () => {
    const [target, before] = JSON.parse(ENV.FUZZ_DET!) as [Cfg, Cfg[]];
    const a = play(target), sa = JSON.stringify(a.g);
    for (const c of before) play(c);
    const b = play(target), sb = JSON.stringify(b.g);
    let i = 0; while (i < a.trace.length && a.trace[i] === b.trace[i]) i++;
    console.log(a.problems.filter((p) => /held only|supply flag/.test(p)).join('\n')); console.log('same state:', sa === sb, 'traces diverge at', i, a.trace.slice(i - 3, i + 2), b.trace.slice(i - 3, i + 2));
  }, 600_000);
});

/* ================= confirmed problems, minimised (each test fails while the problem is there) ================= */
const sicilyStart = (seed = 1) => { E.useGame('sicily'); const g = E.newGame(seed, { scenario: 'tournament' }); S.autoDeploy(g); return g; };
const clear = (g: Game, keep: string[]) => { for (const u of g.units) if (u.area != null && !keep.includes(u.id)) { u.area = null; u.reserve = null; } };
const unitOf = (g: Game, id: string) => g.units.find((u) => u.id === id)!;

describe('fuzz finding: auditChange after the set-up', () => {
  // golan73/badr seed 1, sicily/tournament seed 4 (action 6 / 48): the first endPhase after the set-up is flagged as "the game went back"
  it('Golan: ending the Israeli set-up (deploy) is not flagged as going back in time', () => {
    E.useGame('golan73'); const g = E.newGame(1, { scenario: 'badr' }); G.autoStrongpoints(g, 'historical'); G.state(g).minesLeft = 0;
    const prev = structuredClone(g); E.endPhase(g); expect([g.phasing, g.phase]).toEqual(['syrian', 'combat']);
    expect(E.auditChange(prev, g, 'israeli')).toEqual([]);
  });
  it('Sicily: ending the set-up (deploy, Axis phasing) is not flagged as going back in time', () => {
    const g = sicilyStart(); const prev = structuredClone(g); E.endPhase(g); expect([g.phasing, g.phase]).toEqual(['allied', 'movement']);
    expect(E.auditChange(prev, g, 'allied')).toEqual([]);
  });
});

describe('fuzz finding: Golan retreat past a full neighbour', () => {
  // golan73/nafakh seed 4 (#392), golan73/badr {advGhosts,artyArmor} seed 2001 (#680): defenderChoice(true) throws a TypeError
  it('a Syrian defender whose only friendly neighbour is full can retreat onward (14.42 retreatPrefer)', () => {
    E.useGame('golan73'); const g = E.newGame(4, { scenario: 'badr' }); G.autoStrongpoints(g, 'historical'); G.state(g).minesLeft = 0; E.endPhase(g);
    clear(g, ['S27', 'S25', 'S28', 'I10']);
    for (const a of E.areas.keys()) if (!G.isAssembly(a)) g.control[a] = 'syrian';
    for (const n of [36, 37, 43, 45, 47]) g.control[n] = 'israeli';
    unitOf(g, 'S27').area = 42; unitOf(g, 'S25').area = 41; unitOf(g, 'S28').area = 41; unitOf(g, 'I10').area = 42; g.control[42] = 'syrian';
    g.turn = 3; g.phasing = 'israeli'; g.phase = 'combat'; g.fought = []; g.riverAssault = []; g.contestedAtMoveStart = []; g.battle = null;
    const b = E.startBattle(g, 42); g.force = [...Array(unitOf(g, 'S27').str).fill(10), 1, 1];      // the defender's dice miss, the attacker's hit
    E.beginCombat(g, b);
    for (let i = 0; i < 6 && b.stage !== 'defChoice'; i++) E.roll_step(g, b);
    expect(b.stage).toBe('defChoice'); expect(b.pendingKind).toBe('ground');
    expect(() => E.defenderChoice(g, b, true)).not.toThrow();
  });
});

describe('fuzz finding: area control after out-of-supply eliminations', () => {
  // bulge/cold seed 2 (#308), bulge/tournament {bid:-3,...} seed 3004 (#612, #728), sicily/tournament seed 1 (#475), golan73/nafakh seed 1004 (#502):
  // a unit eliminated by its out-of-supply check leaves the area to the enemy units in it, but control stays (and the Victory Check reads it)
  it('The Bulge: the surviving side controls the area once the out-of-supply unit is gone', () => {
    E.useGame('bulge'); const g = E.newGame(1, { scenario: 'tournament' });
    const ge = g.units.find((u) => u.side === 'german' && u.area != null && !u.garrison && u.q[0] === 'green')!, al = g.units.find((u) => u.side === 'allied' && u.area != null && !u.garrison)!;
    clear(g, [ge.id, al.id]); const a = ge.area!; al.area = a; g.control[a] = 'german';
    Object.assign(ge, { str: 1, unsupplied: true, disorder: 1 });
    g.phase = 'supply'; g.phasing = 'german'; g.supplyPending = true; g.force = [10];
    E.rollSupply(g);
    expect(ge.area).toBeNull();
    expect(g.control[a]).toBe('allied');
  });
});

describe('fuzz finding: area control after a defended roadblock goes home', () => {
  // bulge/cold {bid:-3,overrun,randomReinf} seed 2 (#479): the Supply Phase returns the surviving defended roadblock (4.35) after it has updated control
  it('the side left alone in the area controls it', () => {
    E.useGame('bulge'); const g = E.newGame(1, { scenario: 'tournament' });
    const ge = g.units.find((u) => u.side === 'german' && u.area != null && !u.garrison)!; clear(g, [ge.id]); const a = ge.area!;
    const eng = g.chits.find((c) => c.side === 'allied' && c.kind === 'engineer')!; eng.box = 'map';
    g.units.push({ id: `DR-${eng.id}`, name: 'roadblock', side: 'allied', cls: 'infantry', q: ['green'], max: 1, str: 1, area: a, garrison: true, disorder: 0, unsupplied: false, moved: true, reserve: null, exploit: false, ech: eng.ech, chitId: eng.id });
    g.control[a] = 'allied'; g.phase = 'btCombat'; g.phasing = 'german'; g.contestedAtMoveStart = [a]; g.fought = [];
    E.endPhase(g); expect(g.phase).toBe('supply');
    expect(E.unitsIn(g, a).map((u) => u.side)).toEqual(['german']);
    expect(g.control[a]).toBe('german');
  });
});

describe('fuzz finding: Sicily air supply', () => {
  // sicily/tournament {airborne,...} seed 1001 (#792), sicily/campaign seed 4 (#1589): 16.34 lasts "during this Supply Phase", then the asset goes to the Used Box
  it('an Air Supply mission does not carry into the next Supply Phase of that player', () => {
    const g = sicilyStart(); E.endPhase(g);
    const u = unitOf(g, 'US03'); clear(g, ['US03']); u.area = 30; g.control[30] = 'allied';
    g.phase = 'btCombat'; g.phasing = 'allied'; E.endPhase(g); expect(g.phase).toBe('supply'); expect(u.unsupplied).toBe(true);
    const air = g.chits.find((c) => c.side === 'allied' && c.kind === 'air_mission')!; air.box = 'available';
    S.airSupply(g, air.id, 30); expect(u.unsupplied).toBe(true); expect(E.supplyChecks(g).some((c) => c.unit.id === 'US03')).toBe(false);   // 16.34: the marker stays, no morale check
    E.endPhase(g);                                                                              // the Allied Supply Phase ends
    expect(E.inSupply(g, 'allied', 30)).toBe(false);                                            // 9.34a still applies after the Supply Phase
    g.turn = 2; g.phase = 'btCombat'; g.phasing = 'allied'; E.endPhase(g);                      // the next Allied Supply Phase: no air supply this time
    expect(u.unsupplied).toBe(true);
  });
});

describe('fuzz finding: Bulge roadblocks outside the area of play', () => {
  // bulge/cold seed 2 (#179) and bulge/intro: a defended roadblock (DR-) placed in an area that is not in play
  for (const scenario of ['intro', 'cold']) it(`${scenario}: roadblockAreas only lists areas in play`, () => {
    E.useGame('bulge'); const g = E.newGame(2, { scenario });
    for (const s of ['german', 'allied']) expect(E.roadblockAreas(g, s).filter((a) => !g.inPlay!.includes(a))).toEqual([]);
  });
});

describe('fuzz finding: the shared copy (split.ts) shows what a hidden block is', () => {
  // every sicily game: Livorno face down carries motorized=true in the shared copy, so the other seat can tell which block it is
  it('Sicily: a hidden Livorno is indistinguishable from other hidden Italian blocks', () => {
    const g = sicilyStart(); E.endPhase(g);
    const pub = JSON.parse(E.toPublic(JSON.parse(E.toPublic(g, 'allied', 'sa', new Map())) as Game, 'axis', 'sx', new Map())) as Game;
    expect(E.visibleTo(g, unitOf(g, 'IT01'), 'spectator')).toBe(false);
    expect(pub.units.filter((u) => E.isPlaceholder(u) && u.motorized).length).toBe(0);
  });
});

describe('fuzz finding: Sicily flanking invasion against defenders', () => {
  // sicily/sunrise_bridge {airborne,...} seed 1001 (#459): 17.22 "a round of combat is immediately fought during the Admin Phase", but startBattle refuses it
  it('the landing round can be fought', () => {
    const g = sicilyStart(); E.endPhase(g);
    const us = unitOf(g, 'US03'); us.area = 20; g.control[20] = 'allied'; for (const x of E.unitsIn(g, 20, 'axis')) x.area = null;
    g.phase = 'admin'; g.phasing = 'allied';
    const c = E.chit(g, 'USC27'); c.box = 'available';
    const t = S.flankTargets(g, c.id); expect(t.length).toBeGreaterThan(0);
    const a = t.find((x) => E.unitsIn(g, x, 'axis').length) ?? t[0];
    if (!E.unitsIn(g, a, 'axis').length) unitOf(g, 'IT02').area = a;
    S.playFlanking(g, c.id, a); expect(E.contested(g, a)).toBe(true);
    expect(() => E.startBattle(g, a)).not.toThrow();
  });
});

describe('fuzz finding: Golan Lt. Zvika variant in the Syrian Supply Phase', () => {
  // golan73/badr {all optional} seed 1002 (#603): zvikaToCup is offered in either Supply Phase, but the referee-lite check flags it in the Syrian one
  it('if the engine offers it, honest play is not flagged', () => {
    E.useGame('golan73'); const g = E.newGame(1, { scenario: 'badr', zvikaCup: true }); G.autoStrongpoints(g, 'historical'); G.state(g).minesLeft = 0; E.endPhase(g);
    const c = E.chit(g, 'IC04'); c.box = 'available'; g.phase = 'admin'; g.phasing = 'israeli';
    const a = [...E.areas.keys()].find((x) => !G.isAssembly(x) && g.control[x] === 'israeli' && !E.unitsIn(g, x).length)!; G.playLtZvika(g, c.id, a);
    g.phase = 'supply'; g.phasing = 'syrian';
    if (G.zvikaOnMap(g)) { const prev = structuredClone(g); G.zvikaToCup(g); expect(E.auditChange(prev, g, 'israeli')).toEqual([]); }
  });
});

describe('fuzz finding: Golan quick placement in the Battle for Nafakh', () => {
  // golan73/nafakh seeds 2, 2002-2004 (#1): autoStrongpoints('historical') looks up units the scenario does not have
  it('autoStrongpoints does not throw where the scenario has no strongpoints', () => {
    E.useGame('golan73'); const g = E.newGame(2, { scenario: 'nafakh' });
    expect(() => G.autoStrongpoints(g, 'historical')).not.toThrow();
  });
});
