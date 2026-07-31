import { describe, expect, it } from 'vitest';
import {
  blankProfile,
  dueScore,
  grip,
  hoard,
  isNew,
  isSolid,
  recordPick,
  recordRead,
  statFor,
  type DragonProfile,
} from './progress';

const read = (word: string, times: number, verdict: 'got' | 'nudge' | 'not-yet' = 'got') => {
  let p = blankProfile();
  for (let i = 0; i < times; i++) p = recordRead(p, word, verdict);
  return p;
};

const score = (p: DragonProfile, word: string) => grip(statFor(p, word));

describe('recordRead', () => {
  it('moves the score toward what you tapped', () => {
    const p = recordRead(blankProfile(), 'dragon', 'got');
    expect(score(p, 'dragon')).toBeGreaterThan(0);
    expect(statFor(p, 'dragon').last).toBe('got');
  });

  it('treats a nudge as half, not as a failure', () => {
    /* It is the most common honest outcome. Scored as a miss almost every word
       would look broken; scored as a pass, words he cannot quite read would
       quietly leave the rotation. */
    const got = score(read('a', 1, 'got'), 'a');
    const nudge = score(read('a', 1, 'nudge'), 'a');
    const not = score(read('a', 1, 'not-yet'), 'a');
    expect(nudge).toBeGreaterThan(not);
    expect(nudge).toBeLessThan(got);
  });

  it('remembers only the last few showings', () => {
    /* The score used to be a running average, which settles on the child's own
       credit rate: a child who alternated `got` and `nudge` sat at 0.75 and
       could never clear a bar set at 0.85, so words he substantially read
       stayed marked unlearnt forever. A window has a reachable top. */
    let p = read('dragon', 4, 'not-yet');
    for (let i = 0; i < 4; i++) p = recordRead(p, 'dragon', 'got');
    expect(score(p, 'dragon')).toBe(1);
  });

  it('lets a word he half-knows still become his', () => {
    // got, nudge, got, nudge is a child who reads the word — three of four
    let p = blankProfile();
    for (const v of ['got', 'nudge', 'got', 'nudge'] as const) p = recordRead(p, 'dragon', v);
    expect(isSolid(p, 'dragon')).toBe(true);
  });

  it('lets a word recover after a bad day', () => {
    let p = read('dragon', 3, 'not-yet');
    for (let i = 0; i < 6; i++) p = recordRead(p, 'dragon', 'got');
    expect(isSolid(p, 'dragon')).toBe(true);
  });
});

describe('isSolid', () => {
  it('needs more than a lucky run', () => {
    expect(isSolid(read('dragon', 2), 'dragon')).toBe(false);
    expect(isSolid(read('dragon', 6), 'dragon')).toBe(true);
  });

  it('is not reached before there is enough evidence', () => {
    // three clean reads is a lucky run; the window wants four showings
    expect(isSolid(read('dragon', 3), 'dragon')).toBe(false);
  });

  it('is not reached by picking alone', () => {
    /* Four correct picks is not proof he can read the word — he may be
       recognising a shape. Production has to be part of it. */
    let p = blankProfile();
    for (let i = 0; i < 8; i++) p = recordPick(p, 'dragon', true);
    expect(isSolid(p, 'dragon')).toBe(false);
  });
});

describe('an old profile', () => {
  it('keeps the hoard it had before the score changed shape', () => {
    /* The stored field was a running average and is now a window. A child who
       had earned a word must not lose it to an upgrade. */
    const stored = {
      ...blankProfile(),
      stats: {
        dragon: { seen: 9, mastery: 0.95, lastSeenAt: 2, last: 'got' as const, spoken: 4 },
      } as unknown as DragonProfile['stats'],
    };
    expect(isSolid(stored, 'dragon')).toBe(true);
    expect(score(stored, 'dragon')).toBeGreaterThan(0.75);
  });

  it('does not hand out a hoard nobody earned', () => {
    const stored = {
      ...blankProfile(),
      stats: {
        friend: { seen: 5, mastery: 0.2, lastSeenAt: 1, last: 'not-yet' as const, spoken: 0 },
      } as unknown as DragonProfile['stats'],
    };
    expect(isSolid(stored, 'friend')).toBe(false);
  });
});

describe('dueScore', () => {
  it('puts a word he has never met near the front', () => {
    const p = read('known', 6);
    expect(dueScore(p, 'brandnew')).toBeGreaterThan(dueScore(p, 'known'));
  });

  it('prefers a shaky word to a solid one', () => {
    let p = read('solid', 6, 'got');
    for (let i = 0; i < 6; i++) p = recordRead(p, 'shaky', 'nudge');
    expect(dueScore(p, 'shaky')).toBeGreaterThan(dueScore(p, 'solid'));
  });

  it('brings a word back as it goes stale', () => {
    const p = read('dragon', 5);
    const fresh = dueScore(p, 'dragon');
    const later = dueScore({ ...p, mealsCompleted: p.mealsCompleted + 6 }, 'dragon');
    expect(later).toBeGreaterThan(fresh);
  });
});

describe('the hoard', () => {
  it('holds only the words he can actually read', () => {
    let p = read('dragon', 6, 'got');
    p = recordRead(p, 'friend', 'not-yet');
    expect(hoard(p, ['dragon', 'friend'])).toEqual(['dragon']);
  });
});

describe('isNew', () => {
  it('knows a word he has not met', () => {
    const p = read('dragon', 1);
    expect(isNew(p, 'dragon')).toBe(false);
    expect(isNew(p, 'sushi')).toBe(true);
  });
});
