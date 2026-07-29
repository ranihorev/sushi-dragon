import { describe, expect, it } from 'vitest';
import {
  blankProfile,
  dueScore,
  hoard,
  isNew,
  isSolid,
  recordPick,
  recordRead,
  statFor,
} from './progress';

const read = (word: string, times: number, verdict: 'got' | 'nudge' | 'not-yet' = 'got') => {
  let p = blankProfile();
  for (let i = 0; i < times; i++) p = recordRead(p, word, verdict);
  return p;
};

describe('recordRead', () => {
  it('moves the score toward what you tapped', () => {
    const p = recordRead(blankProfile(), 'dragon', 'got');
    expect(statFor(p, 'dragon').mastery).toBeGreaterThan(0);
    expect(statFor(p, 'dragon').last).toBe('got');
  });

  it('treats a nudge as half, not as a failure', () => {
    /* It is the most common honest outcome. Scored as a miss almost every word
       would look broken; scored as a pass, words he cannot quite read would
       quietly leave the rotation. */
    const got = statFor(read('a', 1, 'got'), 'a').mastery;
    const nudge = statFor(read('a', 1, 'nudge'), 'a').mastery;
    const not = statFor(read('a', 1, 'not-yet'), 'a').mastery;
    expect(nudge).toBeGreaterThan(not);
    expect(nudge).toBeLessThan(got);
  });

  it('weighs reading aloud more heavily than picking from a line-up', () => {
    // one is production, the other is recognition — they are not equal evidence
    const spoken = statFor(recordRead(blankProfile(), 'a', 'got'), 'a').mastery;
    const picked = statFor(recordPick(blankProfile(), 'a', true), 'a').mastery;
    expect(spoken).toBeGreaterThan(picked);
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

  it('is not reached by picking alone', () => {
    /* Four correct picks is not proof he can read the word — he may be
       recognising a shape. Production has to be part of it. */
    let p = blankProfile();
    for (let i = 0; i < 8; i++) p = recordPick(p, 'dragon', true);
    expect(isSolid(p, 'dragon')).toBe(false);
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
