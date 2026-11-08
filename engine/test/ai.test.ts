// 4.4 The computer opponent: it plays whole games of every volume and scenario against itself without a single illegal action, the games end,
// and against a player who only does what the rules force (ends steps, fights where it must, takes losses in the suggested order) it comes out ahead.
import { describe, expect, it } from 'vitest';
import * as E from '../src';
import type { Game, Side } from '../src';

const AI = E.ai;
type Cfg = { game: 'bulge' | 'golan73' | 'sicily'; scenario: string; opts?: Record<string, unknown>; seed: number };
type Policy = (g: Game, side: Side) => E.ai.Action | null;

/** A player who does nothing of his own: the least the rules make him do. */
const lazy: Policy = (g, side) => {
  if (g.over || !AI.turnOf(g, side)) return null;
  const run = (label: string, f: (x: Game) => void): E.ai.Action => ({ label, op: ['lazy'], run: f });
  if (g.pendingBlow) return run('cross', (x) => { E.resolveBlow(x, false); });
  if (g.recover.includes(side)) return run('recover', (x) => E.recoverAsset(x, side, null));
  if (g.artyPick && side === 'german') { const c = E.boxOf(g, 'german', 'used').find((x) => x.kind === 'artillery')!; return run('arty', (x) => E.chooseArtyLoss(x, c.id)); }
  if (g.game === 'golan73' && side === 'syrian' && E.golan.state(g).samTarget) return run('no sam', (x) => E.golan.declineSam(x));
  if (g.game === 'sicily' && E.sicily.state(g).moralePick?.[side]) return run('morale', (x) => E.sicily.autoMoraleLoss(x));
  const b = g.battle;
  if (b) {
    const att = side === b.attacker;
    if (b.stage === 'setup') return b.ready?.includes(side) ? null : run('ready', (x) => E.setReady(x, x.battle!, side));
    if (b.stage === 'done') return att ? run('close', (x) => E.closeBattle(x)) : null;
    if (b.stage === 'loss' && b.loss?.side === side) return run('losses', (x) => E.autoLosses(x, x.battle!));
    if (b.stage === 'attFirst' && att) return run('first', (x) => E.chooseFirstLoss(x, x.battle!, x.battle!.attPoint));
    if (b.stage === 'attChoice' && att) return run('on', (x) => E.attackerChoice(x, x.battle!, false));
    if (b.stage === 'defChoice' && !att) return run('stand', (x) => E.defenderChoice(x, x.battle!, false));
    if (b.stage === 'retreat' && b.retreat?.side === side) return run('retreat', (x) => E.chooseRetreat(x, x.battle!, E.retreatOptions(x, x.battle!)[0]));
    if (b.stage === 'exploit' && att) return run('decline', (x) => E.declineExploit(x, x.battle!));
    if ((['attArty', 'offFire'].includes(b.stage) && att) || (['defArty', 'defFire'].includes(b.stage) && !att)) return run('roll', (x) => E.roll_step(x, x.battle!));
    return null;
  }
  if (g.phase === 'deploy') { const a = AI.next(g, side); return a; }                                   // the set-up has no lazy way: the same quick placement
  if (g.game === 'sicily' && g.phasing === side && E.sicily.state(g).dropPending) return run('drops', (x) => E.sicily.autoAirDrop(x));
  const must = E.mustFight(g); if ((g.phase === 'combat' || g.phase === 'btCombat') && g.phasing === side && must.length) return run('fight', (x) => { E.startBattle(x, must[0]); });
  if (g.phase === 'supply' && g.phasing === side && g.supplyPending) return run('supply', (x) => E.rollSupply(x));
  if (g.phase === 'admin' || g.phase === 'reinforcement') { if (g.phasing !== side) return g.done?.includes(side) ? null : run('done', (x) => E.setDone(x, side)); return g.done?.includes(E.other(side)) ? run('end', (x) => E.endPhase(x)) : null; }
  const actor = E.actorOf(g); return actor === side ? run('end', (x) => E.endPhase(x)) : null;
};

/** A whole game: each side's policy acts whenever it may; the set-up is ended once nobody has anything left to place. */
function game(cfg: Cfg, p1: Policy, p2: Policy) {
  E.useGame(cfg.game); E.setRandom(null);
  const g = E.newGame(cfg.seed, { scenario: cfg.scenario, ...cfg.opts } as never), [s1, s2] = E.sidesOf(g);
  const trace: string[] = []; let actions = 0, idle = 0;
  while (!g.over) {
    if (++actions > 6000) throw new Error(`${cfg.game}/${cfg.scenario}/${cfg.seed}: the game does not end (${trace.slice(-12).join(' | ')})`);
    E.useGame(cfg.game); E.setPlayArea(g.inPlay);
    const a = p1(g, s1) ?? p2(g, s2);
    if (!a) {
      if (g.phase === 'deploy' && !g.units.some((u) => u.box === 'deploy')) { E.endPhase(g); trace.push('end set-up'); continue; }
      if (++idle > 3) throw new Error(`${cfg.game}/${cfg.scenario}/${cfg.seed}: stuck at T${g.turn} ${g.phasing} ${g.phase} ${g.battle?.stage ?? ''} actor ${E.actorOf(g)} (${trace.slice(-12).join(' | ')})`);
      continue;
    }
    idle = 0;
    const who = AI.turnOf(g, s1) && p1 === AI.next ? s1 : s2;
    const before = JSON.stringify(g);
    try { a.run(g); } catch (e) { throw new Error(`${cfg.game}/${cfg.scenario}/${cfg.seed}: ${a.label} by ${who} threw at T${g.turn} ${g.phasing} ${g.phase} ${g.battle?.stage ?? ''}: ${(e as Error).message} (${trace.slice(-10).join(' | ')})`); }
    if (JSON.stringify(g) === before) { trace.push(`${a.label} (no change)`); if (++idle > 3) throw new Error(`${cfg.game}/${cfg.scenario}/${cfg.seed}: ${a.label} changes nothing at T${g.turn} ${g.phasing} ${g.phase} ${g.battle?.stage ?? ''}`); } else idle = 0;
    trace.push(`T${g.turn} ${a.label}${a.unit ? ' ' + a.unit : ''}${a.area != null ? ' ->' + a.area : ''}`);
  }
  return { g, actions, v: E.victory(g) };
}

const MIXES: Record<Cfg['game'], string[]> = { bulge: ['tournament', 'campaign', 'intro', 'cold'], golan73: ['badr', 'badr_alt', 'nafakh', 'alowda'], sicily: ['tournament', 'campaign', 'campaign_hist', 'sunrise_bridge'] };
const ALL_OPTS: Record<Cfg['game'], Record<string, unknown>> = {
  bulge: { bridgeLimit: true, bid: 2, peiper: true, pz150: true, airborne: true, advArty: true, overrun: true, fwMaintain: true, randomReinf: true },
  golan73: { atAssets: true, t62: true, chemical: true, flank: true, artyArmor: true, zvikaCup: true, raidMod: true, battleRecovery: true, advGhosts: true },
  sicily: { airborne: true, advArty: true, overrun: true, fwMaintain: true },
};

describe('computer opponent: whole games against itself', () => {
  for (const [game, scens] of Object.entries(MIXES) as [Cfg['game'], string[]][]) for (const scenario of scens) {
    it(`${game} ${scenario}`, () => {
      for (const [seed, opts] of [[1, {}], [2, ALL_OPTS[game]]] as [number, Record<string, unknown>][]) {
        const r = game === 'bulge' || true ? gameRun({ game, scenario, seed, opts }) : null;
        expect(r!.g.over).toBeTruthy();
      }
    }, 300_000);
  }
});
const gameRun = (cfg: Cfg) => game(cfg, AI.next, AI.next);

describe('computer opponent: ahead of a player who only does what the rules force', () => {
  const net = (g: Game, side: Side) => { const v = E.victory(g); return v[side] - v[E.other(side)]; };
  for (const [game, scenario] of [['bulge', 'tournament'], ['golan73', 'badr'], ['sicily', 'tournament']] as [Cfg['game'], string][]) {
    it(`${game} ${scenario}: as either side`, () => {
      E.useGame(game); const [s1, s2] = E.VOLUME.sides; let a = 0, b = 0;
      for (const seed of [11, 12, 13]) { const x = gameMixed({ game, scenario, seed }, AI.next, lazy); a += net(x.g, s1); const y = gameMixed({ game, scenario, seed }, lazy, AI.next); b += net(y.g, s2); }
      expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(0);
    }, 300_000);
  }
});
const gameMixed = (cfg: Cfg, p1: Policy, p2: Policy) => game(cfg, p1, p2);

const ENV: Record<string, string | undefined> = ((globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env) ?? {};
if (ENV.AI_STATS) describe('stats', () => {
  it('prints how the games go', () => {
    const lines: string[] = [];
    for (const [game, scens] of Object.entries(MIXES) as [Cfg['game'], string[]][]) for (const scenario of scens) for (const seed of [1, 2, 3]) {
      const r = gameRun({ game, scenario, seed }); const g = r.g, [s1, s2] = E.sidesOf(g);
      const els = (s: Side) => g.units.filter((u) => u.side === s && u.area == null && u.str === 0 && !u.garrison).length;
      lines.push(`${game}/${scenario}/${seed}: ${g.over} | battles ${g.battles} | lost ${s1} ${els(s1)} ${s2} ${els(s2)} | vp ${JSON.stringify(g.vpHist)} | actions ${r.actions}`);
    }
    for (const [game, scenario] of [['bulge', 'tournament'], ['golan73', 'badr'], ['sicily', 'tournament']] as [Cfg['game'], string][]) for (const seed of [11, 12, 13]) {
      const x = gameMixed({ game, scenario, seed }, AI.next, lazy), y = gameMixed({ game, scenario, seed }, lazy, AI.next);
      lines.push(`${game}/${scenario}/${seed}: AI first: ${x.g.over} | AI second: ${y.g.over}`);
    }
    console.log(lines.join('\n'));
  }, 600_000);
});

describe('computer opponent: the three levels play whole games', () => {
  for (const [game, scenario] of [['bulge', 'tournament'], ['golan73', 'nafakh'], ['sicily', 'sunrise_bridge']] as [Cfg['game'], string][]) {
    it(`${game} ${scenario}: hard against easy, both seatings, no illegal action`, () => {
      for (const [l1, l2] of [['hard', 'easy'], ['easy', 'hard']] as const) {
        const r = game2({ game, scenario, seed: 21 }, (g, s) => AI.next(g, s, l1), (g, s) => AI.next(g, s, l2));
        expect(r.g.over).toBeTruthy();
      }
    }, 600_000);
  }
  it('an action is data: applying its op does what running it does', () => {
    E.useGame('bulge'); const g = E.newGame(5, { scenario: 'tournament' } as never);
    const a = AI.next(g, 'german')!; const x = structuredClone(g), y = structuredClone(g);
    a.run(x); AI.apply(y, a.op); expect(JSON.stringify(y)).toBe(JSON.stringify(x));
  });
});
const game2 = (cfg: Cfg, p1: Policy, p2: Policy) => game(cfg, p1, p2);
