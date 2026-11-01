/** Hidden blocks without a server (free Firebase plan): the shared game document holds every hidden block as an opaque placeholder, and each seat keeps the
 *  real details of its own blocks in a document only that seat can read. A client rebuilds the game it plays on by putting its own details back (`compose`)
 *  and writes the shared copy with its hidden blocks hidden again (`toPublic`). Details of a block the other side must see (a battle reveals them, 6.24;
 *  Intelligence Gathering) are published to a shared "reveals" document by the owner's client. */
import { visibleTo, other, type Game, type Side, type Unit } from './game';
import { alias } from './redact';

export type UnitSecret = Pick<Unit, 'name' | 'cls' | 'q' | 'max' | 'str' | 'code' | 'symbol' | 'ech' | 'entry' | 'arrival' | 'chitId' | 'from'>;
export interface Priv { salt: string; secrets: Record<string, UnitSecret> }
export type Reveal = UnitSecret & { id: string };
export type Reveals = Record<string, Reveal>;                 // by alias
const KEYS = ['name', 'cls', 'q', 'max', 'str', 'code', 'symbol', 'ech', 'entry', 'arrival', 'chitId', 'from'] as const;
const quote = (s: string) => JSON.stringify(s);
const swap = (json: string, pairs: Iterable<[string, string]>) => { for (const [a, b] of pairs) json = json.split(quote(a)).join(quote(b)); return json; };
const BLANK: Partial<Unit> = { name: 'Hidden block', cls: 'infantry', q: ['green'], max: 1, str: 1, code: '', symbol: 'inf', ech: '', entry: undefined, arrival: undefined, chitId: undefined, from: undefined };

export const secretOf = (u: Unit): UnitSecret => Object.fromEntries(KEYS.map((k) => [k, u[k]])) as UnitSecret;
/** The details of every block on `side`: what goes in that seat's private document. */
export const secretsOf = (g: Game, side: Side): Record<string, UnitSecret> => Object.fromEntries(g.units.filter((u) => u.side === side).map((u) => [u.id, secretOf(u)]));
export const isPlaceholder = (u: Unit) => u.name === 'Hidden block';

/** The shared copy: every block nobody may see is renamed with an opaque id and blanked. `enemyAlias` maps the real ids of the other side's blocks we learned about (reveals) back to their aliases. */
export function toPublic(g: Game, side: Side, salt: string, enemyAlias: Map<string, string>): string {
  const hidden = g.units.filter((u) => !visibleTo(g, u, 'spectator'));
  const pairs: [string, string][] = [], names: string[] = [];
  for (const u of hidden) { const a = u.side === side ? alias(salt, u.id) : enemyAlias.get(u.id); if (a) { pairs.push([u.id, a]); if (u.name.length > 2) names.push(u.name); } }
  const real = new Set(pairs.map(([id]) => id));
  const copy = JSON.parse(swap(JSON.stringify(g), pairs)) as Game;
  const al = new Set(pairs.map(([, a]) => a));
  for (const u of copy.units) if (al.has(u.id)) Object.assign(u, BLANK);
  names.sort((a, b) => b.length - a.length);
  copy.log = copy.log.slice(-120).map((l) => names.reduce((t, n) => t.split(n).join('a hidden block'), l));
  void real;
  return JSON.stringify(copy);
}

/** The game this seat plays on: the shared copy with this seat's own details put back, and the details of anything the other side has revealed. */
export function compose(pub: Game, priv: Priv | null, reveals: Reveals): { game: Game; enemyAlias: Map<string, string> } {
  const enemyAlias = new Map<string, string>(), pairs: [string, string][] = [], details = new Map<string, UnitSecret>();
  if (priv) for (const [id, s] of Object.entries(priv.secrets)) { const a = alias(priv.salt, id); pairs.push([a, id]); details.set(id, s); }
  for (const [a, r] of Object.entries(reveals)) if (!pairs.some(([x]) => x === a)) { pairs.push([a, r.id]); details.set(r.id, r); enemyAlias.set(r.id, a); }
  const present = new Set(pub.units.map((u) => u.id)), use = pairs.filter(([a]) => present.has(a));
  const game = JSON.parse(swap(JSON.stringify(pub), use)) as Game;
  for (const u of game.units) { const d = details.get(u.id); if (d && use.some(([, id]) => id === u.id)) for (const k of KEYS) (u as unknown as Record<string, unknown>)[k] = d[k]; }
  return { game, enemyAlias };
}

/** The blocks of `side` standing in `area`, as reveals (for the owner's client to publish when a battle there begins). */
export function revealsIn(g: Game, side: Side, area: number, salt: string): Reveals {
  return Object.fromEntries(g.units.filter((u) => u.side === side && u.area === area && !u.garrison).map((u) => [alias(salt, u.id), { id: u.id, ...secretOf(u) }]));
}
export function revealOf(g: Game, unitId: string, salt: string): Reveals { const u = g.units.find((x) => x.id === unitId); return u ? { [alias(salt, u.id)]: { id: u.id, ...secretOf(u) } } : {}; }
export { other };

/** The reveals worth publishing: new blocks, and blocks whose details changed since they were last published (a block that lost a step and fights again). */
export function freshReveals(published: Reveals, wanted: Reveals): Reveals {
  return Object.fromEntries(Object.entries(wanted).filter(([k, v]) => JSON.stringify(published[k]) !== JSON.stringify(v)));
}

/** A new split table: the shared copy and one private document per seat, made from a fresh full game. Only used once, when the table is created. */
export function initSplit(full: Game, saltGerman: string, saltAllied: string): { pub: string; german: Priv; allied: Priv } {
  full.deferBegin = true;
  const german: Priv = { salt: saltGerman, secrets: secretsOf(full, 'german') }, allied: Priv = { salt: saltAllied, secrets: secretsOf(full, 'allied') };
  const step1 = toPublic(full, 'german', saltGerman, new Map());
  return { pub: toPublic(JSON.parse(step1) as Game, 'allied', saltAllied, new Map()), german, allied };
}

/** One seat's side of the split protocol: everything online.ts needs, with no network in it, so two seats can be played against each other in a test. */
export class SplitSeat {
  priv: Priv | null = null;
  reveals: Reveals = {};
  enemyAlias = new Map<string, string>();
  constructor(public side: Side) {}
  /** The game this seat plays on, from the shared copy (remembers the aliases of what the other side revealed). */
  open(pub: Game): Game { const r = compose(pub, this.priv, this.reveals); this.enemyAlias = r.enemyAlias; return r.game; }
  /** What to write after a move: the shared copy, and this seat's private details when they changed. */
  save(g: Game): { pub: string; priv?: Priv } {
    if (!this.priv) throw new Error('private details not loaded yet');
    const pub = toPublic(g, this.side, this.priv.salt, this.enemyAlias), secrets = secretsOf(g, this.side);
    if (JSON.stringify(secrets) === JSON.stringify(this.priv.secrets)) return { pub };
    this.priv = { salt: this.priv.salt, secrets }; return { pub, priv: this.priv };
  }
  /** The reveals this seat has to publish now (battle area once both are ready, an Intelligence target); they count as published from here on. */
  due(g: Game): Reveals {
    if (!this.priv) return {};
    let want: Reveals = {};
    const b = g.battle; if (b && b.stage === 'setup' && (b.ready?.length ?? 0) === 2) want = { ...want, ...revealsIn(g, this.side, b.area, this.priv.salt) };
    if (g.revealed && g.units.find((u) => u.id === g.revealed)?.side === this.side) want = { ...want, ...revealOf(g, g.revealed, this.priv.salt) };
    const fresh = freshReveals(this.reveals, want); this.reveals = { ...this.reveals, ...fresh }; return fresh;
  }
}
