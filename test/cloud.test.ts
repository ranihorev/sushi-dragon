import { beforeEach, describe, expect, it, vi } from 'vitest';

import { blankProfile, recordRead, type DragonProfile } from '../src/game/progress';
import type { Shared } from '../src/game/sync';
import { makeWord, type Tombstones, type Word } from '../src/game/words';
import * as fake from './stubs/icloud';

const uri = (word: string) => `file:///voice/${word}.m4a`;

let profile: DragonProfile;
let words: Word[];
let tombstones: Tombstones;
let local: { deviceId: string; pulled: Record<string, string>; lastSyncAt: string };

/**
 * Storage, in memory, sharing its disk with the fake iCloud.
 *
 * The recordings are the reason it shares: half of what the engine does is move
 * an `.m4a` between the two, and a test that cannot see both ends of that can
 * only check that a function was called.
 */
vi.mock('../src/game/storage', () => ({
  loadProfile: () => profile,
  saveProfile: (next: DragonProfile) => (profile = next),
  loadDictionary: () => words,
  saveDictionary: (next: Word[]) => (words = next),
  loadTombstones: () => tombstones,
  saveTombstones: (next: Tombstones) => (tombstones = next),
  localState: () => local,
  saveLocalState: (next: typeof local) => (local = next),
  hasVoice: (word: string) => fake.disk.has(uri(word)),
  voiceFile: (word: string) => ({ uri: uri(word) }),
}));

const cloud = await import('../src/game/cloud');

const word = (text: string, updatedAt = '2026-07-29T00:00:00.000Z', over: Partial<Word> = {}) => ({
  ...makeWord(text, { addedAt: updatedAt.slice(0, 10), updatedAt }),
  ...over,
});

/** A file as the phone would have left it. */
const phoneFile = (over: Partial<Shared> = {}) =>
  JSON.stringify({
    version: 1,
    deviceId: 'phone',
    writtenAt: '2026-08-02T20:00:00.000Z',
    profile: blankProfile(),
    words: [],
    tombstones: {},
    ...over,
  });

beforeEach(() => {
  fake.reset();
  profile = blankProfile();
  words = [word('have')];
  tombstones = {};
  local = { deviceId: 'ipad', pulled: {}, lastSyncAt: '' };
});

/**
 * The case that has to work, because it is most evenings.
 *
 * An iPad with no iCloud account is not a broken iPad. It is the iPad this game
 * was built on, and it has to play exactly as it always did.
 */
describe('with no iCloud at all', () => {
  beforeEach(() => fake.reset({ available: false }));

  it('says so, and touches nothing', async () => {
    const state = await cloud.sync();

    expect(state.on).toBe(false);
    expect(fake.paths()).toEqual([]);
    expect(words.map((w) => w.text)).toEqual(['have']);
  });
});

describe('the first device to arrive', () => {
  it('leaves a complete copy of itself behind', async () => {
    await cloud.sync();

    const written = JSON.parse(fake.peek('devices/ipad.json')!);
    expect(written.deviceId).toBe('ipad');
    expect(written.words.map((w: Word) => w.text)).toEqual(['have']);
    expect(written.profile.version).toBe(1);
  });

  it('reads back as done', async () => {
    const state = await cloud.sync();
    expect(state).toMatchObject({ on: true, busy: false, waiting: 0 });
    expect(state.at).not.toBe('');
  });
});

describe('a word added on the phone', () => {
  beforeEach(() => {
    fake.seed(
      'devices/phone.json',
      phoneFile({ words: [word('have'), word('night', '2026-08-01T20:00:00.000Z')] }),
    );
  });

  it('is on the iPad after a sync', async () => {
    await cloud.sync();
    expect(words.map((w) => w.text)).toContain('night');
  });

  it('does not cost the meal the iPad was in the middle of', async () => {
    profile = recordRead(recordRead(blankProfile(), 'have', 'got'), 'have', 'got');
    await cloud.sync();

    expect(profile.stats.have.spoken).toBe(2);
    expect(words.map((w) => w.text)).toContain('night');
  });
});

describe('a word removed on the phone', () => {
  it('goes from the iPad too', async () => {
    fake.seed(
      'devices/phone.json',
      phoneFile({ words: [], tombstones: { have: '2026-08-02T09:00:00.000Z' } }),
    );
    await cloud.sync();

    expect(words.map((w) => w.text)).toEqual([]);
  });
});

describe('the recordings', () => {
  it('go up, when this device is the one that made them', async () => {
    words = [word('have', '2026-08-01T10:00:00.000Z', { voiceKey: 'have-ipad-1.m4a' })];
    local.pulled = { have: 'have-ipad-1.m4a' };
    fake.disk.set(uri('have'), 'a father saying have');

    await cloud.sync();

    expect(fake.peek('voice/have-ipad-1.m4a')).toBe('a father saying have');
  });

  it('come down, when the phone made them', async () => {
    fake.seed(
      'devices/phone.json',
      phoneFile({
        words: [word('have', '2026-08-01T10:00:00.000Z', { voiceKey: 'have-phone-1.m4a' })],
      }),
    );
    fake.seed('voice/have-phone-1.m4a', 'a father saying have');

    await cloud.sync();

    expect(fake.disk.get(uri('have'))).toBe('a father saying have');
    expect(local.pulled.have).toBe('have-phone-1.m4a');
  });

  /* The dragon already knows what to do with a word it has no recording for —
     it reads it in the iPad's own voice. So a recording still on its way is
     something to mention, not something to wait for. */
  it('are counted, not waited for, while they are still coming', async () => {
    fake.seed(
      'devices/phone.json',
      phoneFile({
        words: [word('have', '2026-08-01T10:00:00.000Z', { voiceKey: 'have-phone-1.m4a' })],
      }),
    );
    fake.seed('voice/have-phone-1.m4a', 'a father saying have', false);

    const state = await cloud.sync();

    expect(state.waiting).toBe(1);
    expect(fake.disk.has(uri('have'))).toBe(false);
  });

  it('arrive on the sync after that', async () => {
    fake.seed(
      'devices/phone.json',
      phoneFile({
        words: [word('have', '2026-08-01T10:00:00.000Z', { voiceKey: 'have-phone-1.m4a' })],
      }),
    );
    fake.seed('voice/have-phone-1.m4a', 'a father saying have', false);

    await cloud.sync();
    const state = await cloud.sync();

    expect(state.waiting).toBe(0);
    expect(fake.disk.get(uri('have'))).toBe('a father saying have');
  });
});

/**
 * The property that keeps the house quiet.
 *
 * Each device writes its answer where the other one is watching. If a sync that
 * changed nothing still rewrote the file, the other device would see a change,
 * sync, rewrite its own, and the two of them would go round all evening —
 * burning battery on an iPad that is meant to be asleep in a drawer.
 */
describe('a sync with nothing to say', () => {
  it('does not rewrite this device its own file', async () => {
    await cloud.sync();
    const first = fake.peek('devices/ipad.json');

    await cloud.sync();

    expect(fake.peek('devices/ipad.json')).toBe(first);
  });

  it('stays quiet even after taking a word from the phone', async () => {
    fake.seed('devices/phone.json', phoneFile({ words: [word('night', '2026-08-01T20:00:00.000Z')] }));

    await cloud.sync();
    const settled = fake.peek('devices/ipad.json');

    await cloud.sync();

    expect(fake.peek('devices/ipad.json')).toBe(settled);
  });
});

describe('two triggers at once', () => {
  /* The app coming to the foreground is also when iCloud notices the other
     device and also when the screen that just opened asks. Three syncs reading
     each other's half-written answers is not three times as good. */
  it('are one sync', async () => {
    const first = cloud.sync();
    const second = cloud.sync();

    expect(first).toBe(second);
    await first;
  });
});
