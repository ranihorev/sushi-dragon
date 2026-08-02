import { describe, expect, it } from 'vitest';

import { blankProfile, recordRead, type DragonProfile } from './progress';
import { merge, type Shared } from './sync';
import { makeWord, starterDictionary, type Word } from './words';

const device = (over: Partial<Shared> = {}): Shared => ({
  profile: blankProfile(),
  words: [],
  tombstones: {},
  ...over,
});

const word = (text: string, updatedAt = '2026-07-29T00:00:00.000Z'): Word =>
  makeWord(text, { addedAt: updatedAt.slice(0, 10), updatedAt });

const texts = (s: Shared) => s.words.map((w) => w.text);

const read = (p: DragonProfile, w: string, times: number): DragonProfile =>
  Array.from({ length: times }).reduce<DragonProfile>((acc) => recordRead(acc, w, 'got'), p);

/**
 * The reason this file exists, in one test.
 *
 * Anything that picked a winner between the two whole copies would lose one of
 * these two facts, and which one it lost would depend on the order the devices
 * happened to sync in.
 */
describe('a word added on the phone while a meal was eaten on the iPad', () => {
  const phone = device({ words: [word('have'), word('night', '2026-08-01T20:00:00.000Z')] });
  const ipad = device({
    words: [word('have')],
    profile: read(blankProfile(), 'have', 2),
  });

  it('keeps the word', () => {
    expect(texts(merge([phone, ipad]))).toContain('night');
  });

  it('keeps the meal', () => {
    expect(merge([phone, ipad]).profile.stats.have.spoken).toBe(2);
  });
});

describe('the three rules', () => {
  it('takes the larger counter, and does not add them up', () => {
    /* Both devices have watched him read `have` twice — the same two times,
       synced round. Adding would say four, and four readings is most of the way
       to calling a word his. */
    const both = device({ profile: read(blankProfile(), 'have', 2) });
    expect(merge([both, both]).profile.stats.have.seen).toBe(2);
  });

  it('takes the whole window from the device that watched more closely', () => {
    /* Half of one device's history and half of the other's is a history that
       never happened — it can read `got, not-yet, got, not-yet` for a child who
       never had a bad day. */
    const watched = device({ profile: read(blankProfile(), 'have', 3) });
    const glanced = device({ profile: read(blankProfile(), 'have', 1) });
    expect(merge([watched, glanced]).profile.stats.have.recent).toEqual(['got', 'got', 'got']);
  });

  it('takes the more recent choice, and takes both halves of it together', () => {
    const older = device({
      profile: {
        ...blankProfile(),
        settings: { roundsPerMeal: 8, parentCheck: false },
        settingsAt: '2026-08-01T10:00:00.000Z',
      },
    });
    const newer = device({
      profile: {
        ...blankProfile(),
        settings: { roundsPerMeal: 4, parentCheck: true },
        settingsAt: '2026-08-02T10:00:00.000Z',
      },
    });
    expect(merge([older, newer]).profile.settings).toEqual({
      roundsPerMeal: 4,
      parentCheck: true,
    });
  });

  it('keeps a decoration earned on either device', () => {
    const a = device({ profile: { ...blankProfile(), decorations: ['lantern-left', 'carp'] } });
    const b = device({ profile: { ...blankProfile(), decorations: ['lantern-left', 'banner'] } });
    expect(merge([a, b]).profile.decorations).toEqual(['banner', 'carp', 'lantern-left']);
  });
});

describe('a word you threw away', () => {
  const removed = device({ tombstones: { was: '2026-08-01T09:00:00.000Z' } });

  it('stays away, though the other iPad still has it', () => {
    const stillHasIt = device({ words: [word('was')] });
    expect(texts(merge([stillHasIt, removed]))).not.toContain('was');
  });

  it('stays away when the other iPad seeds the starter list from scratch', () => {
    /* The real shape of it: a second device is installed, seeds the ten starter
       words before it has heard from iCloud, and syncs. This is the case that
       decided how `starterDictionary` is dated. */
    const fresh = device({ words: starterDictionary() });
    expect(texts(merge([fresh, removed]))).not.toContain('was');
    expect(texts(merge([fresh, removed]))).toContain('said');
  });

  it('comes back if you add it again, because that is newer than the note', () => {
    const readded = device({ words: [word('was', '2026-08-02T19:00:00.000Z')] });
    expect(texts(merge([readded, removed]))).toContain('was');
  });

  it('keeps the note, so a third device cannot bring it back either', () => {
    expect(merge([device({ words: [word('was')] }), removed]).tombstones.was).toBe(
      '2026-08-01T09:00:00.000Z',
    );
  });
});

describe('the newest copy of a word wins', () => {
  it('so a seam corrected on the phone reaches the iPad', () => {
    const stale = device({ words: [makeWord('tiger', { updatedAt: '2026-08-01T10:00:00.000Z' })] });
    const fixed = device({
      words: [
        makeWord('tiger', { chunks: ['ti', 'ger'], updatedAt: '2026-08-02T10:00:00.000Z' }),
      ],
    });
    expect(merge([stale, fixed]).words[0].chunks).toEqual(['ti', 'ger']);
  });

  it('so a recording made on the phone is the one the iPad looks for', () => {
    const silent = device({ words: [word('have')] });
    const voiced = device({
      words: [makeWord('have', { voiceKey: 'have-abc-1.m4a', updatedAt: '2026-08-02T10:00:00.000Z' })],
    });
    expect(merge([silent, voiced]).words[0].voiceKey).toBe('have-abc-1.m4a');
  });
});

/**
 * The properties that stop two iPads arguing forever.
 *
 * Every device writes its answer back where the others will read it. If the
 * answer depended on the order the files were read in, or changed when merged
 * again, each sync would produce a new disagreement and the pair would never
 * settle.
 *
 * These compare the text rather than the value on purpose. Two answers that are
 * equal but spelled differently — the same words in a different order, the same
 * stats under differently ordered keys — are two different files as far as
 * iCloud is concerned, and each device watches the container for files that
 * changed. Equal is not enough; it has to be identical.
 */
describe('merging settles', () => {
  const a = device({
    words: [word('have'), word('night', '2026-08-01T20:00:00.000Z')],
    profile: read(blankProfile(), 'have', 3),
    tombstones: { was: '2026-08-01T09:00:00.000Z' },
  });
  const b = device({
    words: [word('have'), word('was'), makeWord('sushi', { updatedAt: '2026-08-02T08:00:00.000Z' })],
    profile: { ...read(blankProfile(), 'sushi', 1), mealsCompleted: 4, introSeen: true },
  });

  it('gives the same answer whichever order the devices are read in', () => {
    expect(JSON.stringify(merge([a, b]))).toBe(JSON.stringify(merge([b, a])));
  });

  it('changes nothing when the answer is merged back in', () => {
    const once = merge([a, b]);
    expect(JSON.stringify(merge([once, a, b]))).toBe(JSON.stringify(once));
    expect(JSON.stringify(merge([once, once]))).toBe(JSON.stringify(once));
  });

  /* A device on its own still goes through the merge — that is how its file
     gets written in the one spelling everybody agrees on. It must lose nothing
     doing it, and it must not keep finding something new to say. */
  it('leaves a lone device with everything it had, and nothing more to say', () => {
    const alone = merge([a]);

    expect(alone.words.map((w) => w.text)).toEqual(['have', 'night']);
    expect(alone.profile.stats.have.spoken).toBe(3);
    expect(alone.tombstones).toEqual(a.tombstones);
    expect(JSON.stringify(merge([alone]))).toBe(JSON.stringify(alone));
  });
});
