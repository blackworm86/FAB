// The database rules decide who may take a seat, write the game and read each side's secrets. Run: npm test (Firebase emulator, needs Java).
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, set, get, update, remove } from 'firebase/database';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';

let env;
const G = 'game1';
const dbs = new Map();            // one database handle per account and test (the SDK allows one per context)
const user = (uid) => dbs.get(uid) ?? dbs.set(uid, env.authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } }).database()).get(uid);
const guest = (uid = 'guest') => dbs.get('~' + uid) ?? dbs.set('~' + uid, env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).database()).get('~' + uid);
const admin = (f) => env.withSecurityRulesDisabled(async (c) => { await f(c.database()); });
const meta = { title: 'Test', game: 'bulge', owner: 'alice', created: 1 };

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-fab', database: { host: '127.0.0.1', port: 9000, rules: readFileSync('../../database.rules.json', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearDatabase();
  dbs.clear();
  await admin(async (d) => { await set(ref(d, `games/${G}`), { meta, seats: { german: 'alice' }, state: { rev: 1, by: 'alice', f: { turn: '1' } }, priv: { german: { salt: 's1' }, allied: { salt: 's2' } } }); await set(ref(d, 'admins/root'), true); });
});

describe('creating a game', () => {
  it('the creator writes meta, the private records and the first state, in that order', async () => {
    const db = user('carol'), P = (p) => ref(db, `games/new/${p}`);
    await assertSucceeds(set(P('meta'), { title: 'Mine', game: 'bulge', owner: 'carol', created: 2 }));
    await assertSucceeds(set(P('priv/german'), { salt: 'x' })); await assertSucceeds(set(P('priv/allied'), { salt: 'y' }));
    await assertSucceeds(set(P('state'), { rev: 1, by: 'carol', f: {} }));
  });
  it('nobody else can create the private records or the state of someone else\'s new game', async () => {
    await admin((d) => set(ref(d, 'games/g2/meta'), { ...meta, owner: 'carol' }));
    await assertFails(set(ref(user('mallory'), 'games/g2/priv/german'), { salt: 'evil' }));
    await assertFails(set(ref(user('mallory'), 'games/g2/state'), { rev: 1, by: 'mallory' }));
  });
  it('meta cannot be rewritten or claimed for someone else', async () => {
    await assertFails(set(ref(user('alice'), `games/${G}/meta`), { ...meta, title: 'changed' }));
    await assertFails(set(ref(user('mallory'), 'games/g3/meta'), { ...meta, owner: 'alice' }));
  });
});

describe('seats and factions', () => {
  it('a signed-in player takes a free seat for themself', async () => { await assertSucceeds(update(ref(user('bob'), `games/${G}/seats`), { allied: 'bob' })); });
  it('a guest cannot sit', async () => { await assertFails(update(ref(guest(), `games/${G}/seats`), { allied: 'guest' })); });
  it('nobody can seat someone else, or take a seat that is taken', async () => {
    await assertFails(update(ref(user('bob'), `games/${G}/seats`), { allied: 'carol' }));
    await assertFails(update(ref(user('bob'), `games/${G}/seats`), { german: 'bob' }));
  });
  it('one account cannot hold both sides', async () => { await assertFails(update(ref(user('alice'), `games/${G}/seats`), { allied: 'alice' })); });
  it('a player can leave their own seat but not free the other', async () => {
    await assertSucceeds(update(ref(user('alice'), `games/${G}/seats`), { german: null }));
    await admin((d) => set(ref(d, `games/${G}/seats`), { german: 'alice', allied: 'bob' }));
    await assertFails(update(ref(user('alice'), `games/${G}/seats`), { allied: null }));
  });
  it('an admin can free a seat', async () => { await assertSucceeds(update(ref(user('root'), `games/${G}/seats`), { german: null })); });
  it('seats hold only german and allied', async () => { await assertFails(update(ref(user('bob'), `games/${G}/seats`), { spectator: 'bob' })); });
  it('a seat name is written only by the seat holder', async () => {
    await assertSucceeds(set(ref(user('alice'), `games/${G}/seatNames/german`), 'Alice'));
    await assertFails(set(ref(user('bob'), `games/${G}/seatNames/german`), 'Bob'));
  });
  it('a Golan game uses the same two seats (german = Israel, allied = Syria) and the same flow', async () => {
    const db = user('dave'), P = (p) => ref(db, `games/golan/${p}`);
    await assertSucceeds(set(P('meta'), { title: 'Golan', game: 'golan73', owner: 'dave', created: 3, opts: { scenario: 'badr' } }));
    await assertSucceeds(set(P('priv/german'), { salt: 'x' })); await assertSucceeds(set(P('priv/allied'), { salt: 'y' }));
    await assertSucceeds(set(P('state'), { rev: 1, by: 'dave', f: { phasing: 'israeli' } }));
    await assertSucceeds(update(P('seats'), { german: 'dave' })); await assertSucceeds(update(ref(user('erin'), 'games/golan/seats'), { allied: 'erin' }));
    await assertFails(update(ref(user('erin'), 'games/golan/seats'), { syrian: 'erin' }));
  });
  it('seats need an existing game', async () => { await assertFails(set(ref(user('bob'), 'games/nogame/seats'), { german: 'bob' })); });
});

describe('the game and its secrets', () => {
  beforeEach(async () => { await admin((d) => set(ref(d, `games/${G}/seats/allied`), 'bob')); });
  it('each seat reads only its own private record', async () => {
    await assertSucceeds(get(ref(user('alice'), `games/${G}/priv/german`)));
    await assertFails(get(ref(user('alice'), `games/${G}/priv/allied`)));
    await assertFails(get(ref(guest(), `games/${G}/priv/german`)));
  });
  it('a seat writes only its own private record, and cannot delete it', async () => {
    await assertSucceeds(set(ref(user('bob'), `games/${G}/priv/allied`), { salt: 's2', secrets: {} }));
    await assertFails(set(ref(user('bob'), `games/${G}/priv/german`), { salt: 'x' }));
    await assertFails(remove(ref(user('bob'), `games/${G}/priv/allied`)));
  });
  it('seated players write the game, signed with their own id', async () => {
    await assertSucceeds(update(ref(user('bob'), `games/${G}/state`), { 'f/turn': '2', by: 'bob' }));
    await assertFails(update(ref(user('bob'), `games/${G}/state`), { 'f/turn': '3', by: 'alice' }));
  });
  it('watchers and strangers read but never write the game', async () => {
    await assertSucceeds(get(ref(guest(), `games/${G}/state`)));
    await assertFails(update(ref(user('mallory'), `games/${G}/state`), { 'f/turn': '9', by: 'mallory' }));
    await assertFails(update(ref(guest(), `games/${G}/state`), { 'f/turn': '9' }));
  });
  it('a player cannot delete the game state; only the owner or an admin deletes the game', async () => {
    await assertFails(remove(ref(user('bob'), `games/${G}/state`)));
    await assertFails(remove(ref(user('bob'), `games/${G}`)));
    await assertSucceeds(remove(ref(user('alice'), `games/${G}`)));
  });
  it('reveals are written only by seated players', async () => {
    await assertSucceeds(update(ref(user('bob'), `games/${G}/reveals`), { h1: '{"id":"B1"}' }));
    await assertFails(update(ref(user('mallory'), `games/${G}/reveals`), { h1: '{}' }));
  });
  it('a player\'s game list is theirs alone', async () => {
    await assertSucceeds(set(ref(user('bob'), `users/bob/games/${G}`), { title: 'T', game: 'bulge', created: 1 }));
    await assertFails(set(ref(user('bob'), `users/alice/games/${G}`), { title: 'T', game: 'bulge', created: 1 }));
    await assertFails(get(ref(user('bob'), 'users/alice/games')));
  });
  it('nobody can make themself an admin', async () => { await assertFails(set(ref(user('bob'), 'admins/bob'), true)); });
});

describe('the app\'s own flows (as web/src/store-rtdb.ts writes them)', () => {
  it('createMatch: one combined update for meta, seat, membership and game list, then name, private records, state', async () => {
    const db = user('carol'), id = 'made';
    await assertSucceeds(update(ref(db, '/'), { [`games/${id}/meta`]: { title: 'T', game: 'bulge', opts: { scenario: 'intro', fuel: true }, owner: 'carol', created: 3, split: true }, [`games/${id}/members/carol`]: true, [`games/${id}/seats/german`]: 'carol', [`users/carol/games/${id}`]: { title: 'T', game: 'bulge', created: 3 } }));
    await assertSucceeds(set(ref(db, `games/${id}/seatNames/german`), 'Carol'));
    await assertSucceeds(set(ref(db, `games/${id}/priv/german`), { salt: 'a', secrets: {} })); await assertSucceeds(set(ref(db, `games/${id}/priv/allied`), { salt: 'b', secrets: {} }));
    await assertSucceeds(set(ref(db, `games/${id}/state`), { f: { turn: '1' }, units: {}, chits: {}, rev: 1, by: 'carol' }));
  });
  it('sit: take the free seat, then name, membership and game list in one update', async () => {
    const db = user('bob');
    await assertSucceeds(set(ref(db, `games/${G}/seats`), { german: 'alice', allied: 'bob' }));
    await assertSucceeds(update(ref(db, '/'), { [`games/${G}/seatNames/allied`]: 'Bob', [`games/${G}/members/bob`]: true, [`users/bob/games/${G}`]: { title: 'Test', game: 'bulge', created: 1 } }));
  });
  it('a move: changed values plus the writer, then the log through a transaction', async () => {
    await admin((d) => set(ref(d, `games/${G}/seats/allied`), 'bob'));
    await assertSucceeds(update(ref(user('bob'), `games/${G}/state`), { 'f/phase': '"movement"', 'units/0001': '{}', by: 'bob' }));
    await assertSucceeds(set(ref(user('bob'), `games/${G}/state/f/log`), '["a"]'));
  });
  it('leave and delete: a player leaves their list; the owner deletes the game', async () => {
    await admin((d) => set(ref(d, `users/bob/games/${G}`), { title: 'T', game: 'bulge', created: 1 }));
    await assertSucceeds(remove(ref(user('bob'), `users/bob/games/${G}`)));
    await assertSucceeds(remove(ref(user('alice'), `games/${G}`)));
  });
  it('admin frees a seat and its name in one update', async () => {
    await assertSucceeds(update(ref(user('root'), `games/${G}`), { 'seats/german': null, 'seatNames/german': null }));
  });
});

describe('chat: the two players write, everyone signed in reads', () => {
  beforeEach(async () => { await admin((d) => set(ref(d, `games/${G}/seats/allied`), 'bob')); });
  const msg = (uid, side, text = 'hello') => ({ uid, side, name: uid, text, t: Date.now() });
  it('a seated player posts as themself and their own side', async () => {
    await assertSucceeds(set(ref(user('bob'), `games/${G}/chat/m1`), msg('bob', 'allied')));
  });
  it('nobody posts as someone else or as the other side', async () => {
    await assertFails(set(ref(user('bob'), `games/${G}/chat/m2`), msg('alice', 'german')));
    await assertFails(set(ref(user('bob'), `games/${G}/chat/m3`), msg('bob', 'german')));
  });
  it('watchers and strangers read but cannot post', async () => {
    await assertSucceeds(get(ref(guest(), `games/${G}/chat`)));
    await assertFails(set(ref(user('mallory'), `games/${G}/chat/m4`), msg('mallory', 'allied')));
    await assertFails(set(ref(guest(), `games/${G}/chat/m5`), msg('guest', 'allied')));
  });
  it('messages are plain, short, and cannot be edited or deleted by players', async () => {
    await assertFails(set(ref(user('bob'), `games/${G}/chat/m6`), msg('bob', 'allied', 'x'.repeat(301))));
    await assertFails(set(ref(user('bob'), `games/${G}/chat/m7`), { ...msg('bob', 'allied'), html: '<b>' }));
    await assertSucceeds(set(ref(user('bob'), `games/${G}/chat/m8`), msg('bob', 'allied')));
    await assertFails(set(ref(user('bob'), `games/${G}/chat/m8`), msg('bob', 'allied', 'edited')));
    await assertFails(remove(ref(user('bob'), `games/${G}/chat/m8`)));
    await assertSucceeds(remove(ref(user('root'), `games/${G}/chat/m8`)));
  });
});


describe('the replay journal (4.1): each seat records its own blocks; readable only once the game is over', () => {
  const e = (d = '{}') => ({ at: { '.sv': 'timestamp' }, d });
  beforeEach(async () => { await admin((d) => Promise.all([set(ref(d, `games/${G}/seats/allied`), 'bob'), set(ref(d, `games/${G}/members`), { alice: true, bob: true })])); });
  it('a seated player writes the shared part and their own side, never the other side, never twice', async () => {
    await assertSucceeds(set(ref(user('alice'), `games/${G}/journal/pub/e1`), e()));
    await assertSucceeds(set(ref(user('alice'), `games/${G}/journal/german/e1`), e()));
    await assertFails(set(ref(user('alice'), `games/${G}/journal/allied/e1`), e()));
    await assertSucceeds(set(ref(user('bob'), `games/${G}/journal/allied/e1`), e()));
    await assertFails(set(ref(user('alice'), `games/${G}/journal/german/e1`), e('{"x":1}')));
    await assertFails(set(ref(user('mallory'), `games/${G}/journal/pub/e2`), e()));
    await assertFails(set(ref(user('alice'), `games/${G}/journal/pub/e3`), { at: 5, d: '{}' }));
    await assertFails(set(ref(user('alice'), `games/${G}/journal/other/e1`), e()));
  });
  it('nobody reads it while the game is on (it holds each side\'s hidden blocks); the players do once it is over', async () => {
    await assertFails(get(ref(user('alice'), `games/${G}/journal`)));
    await admin((d) => set(ref(d, `games/${G}/state/f/over`), '"German victory"'));
    await assertSucceeds(get(ref(user('alice'), `games/${G}/journal`)));
    await assertSucceeds(get(ref(user('bob'), `games/${G}/journal`)));
    await assertFails(get(ref(user('mallory'), `games/${G}/journal`)));
  });
});
