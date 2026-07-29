import { describe, expect, it } from 'vitest';
import { buildRound, chooseWords, isOrdered, kindFor, planMeal } from './engine';
import { blankProfile, recordRead, type DragonProfile } from './progress';
import { makeWord, type Word } from './words';

const dict = (...texts: string[]) => texts.map((t) => makeWord(t));
const solid = (p: DragonProfile, word: string, times = 6) => {
  for (let i = 0; i < times; i++) p = recordRead(p, word, 'got');
  return p;
};

/** A predictable deal, so a test asserts behaviour rather than luck. */
const fixedRng = () => {
  let n = 0;
  return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
};

describe('kindFor', () => {
  it('introduces a word before asking anything of it', () => {
    const p = blankProfile();
    expect(kindFor(p, makeWord('dragon'), 0)).toBe('meet');
  });

  it('scaffolds a word he barely knows', () => {
    let p = blankProfile();
    p = recordRead(p, 'dragon', 'not-yet');
    // a roll gets put in order; a single piece gets picked out of a line-up
    expect(kindFor(p, makeWord('dragon'), 0)).toBe('order');
    p = recordRead(p, 'said', 'not-yet');
    expect(kindFor(p, makeWord('said'), 0)).toBe('pick');
  });

  it('has him read aloud once he can, which is the point of the game', () => {
    const p = solid(blankProfile(), 'dragon');
    expect(kindFor(p, makeWord('dragon'), 0)).toBe('read');
  });

  it('breaks the pattern every third round', () => {
    /* Six reading rounds in a row is a worksheet, and a child who can feel a
       worksheet coming stops trying around the fourth one. */
    const p = solid(blankProfile(), 'dragon');
    const kinds = [0, 1, 2, 3, 4, 5].map((i) => kindFor(p, makeWord('dragon'), i));
    expect(new Set(kinds).size).toBeGreaterThan(1);
  });

  it('never asks him to read aloud when nobody is there to hear it', () => {
    // playing alone, the game can only honestly score what it can check itself
    let p = solid(blankProfile(), 'dragon');
    p = { ...p, settings: { ...p.settings, parentCheck: false } };
    for (let i = 0; i < 6; i++) expect(kindFor(p, makeWord('dragon'), i)).not.toBe('read');
  });
});

describe('buildRound', () => {
  it('puts the answer on the counter along with the wrong ones', () => {
    const p = blankProfile();
    const round = buildRound(p, makeWord('night'), dict('night', 'light', 'right'), 'pick');
    expect(round.options.map((o) => o.text)).toContain('night');
  });

  it('offers wrong answers that cannot be told apart by shape', () => {
    /* `night` against `dog` and `cup` is a free round — he picks the long one
       without reading a letter of it. */
    const p = blankProfile();
    const round = buildRound(p, makeWord('night'), dict('night', 'dog', 'cup'), 'pick');
    for (const o of round.options) expect(o.text).toMatch(/ight$/);
  });

  it('widens the counter as a word becomes his', () => {
    const weak = blankProfile();
    const strong = solid(blankProfile(), 'night');
    const pool = dict('night');
    expect(buildRound(weak, makeWord('night'), pool, 'pick').options).toHaveLength(2);
    expect(buildRound(strong, makeWord('night'), pool, 'pick').options).toHaveLength(4);
  });

  it('jumbles the slices of a roll', () => {
    const round = buildRound(blankProfile(), makeWord('dragon'), [], 'order', fixedRng());
    expect(round.slices).toHaveLength(2);
    expect([...round.slices].sort()).toEqual(['drag', 'on']);
  });

  it('never serves a roll already in the right order', () => {
    /* Winning by touching nothing teaches him that not looking sometimes pays,
       which is the exact habit this game exists to break. */
    const word = makeWord('dragon');
    for (let i = 0; i < 40; i++) {
      const round = buildRound(blankProfile(), word, [], 'order');
      expect(isOrdered(round, round.slices)).toBe(false);
    }
  });
});

describe('chooseWords', () => {
  it('leads with what needs the work', () => {
    let p = solid(blankProfile(), 'easy');
    p = recordRead(p, 'hard', 'not-yet');
    const picked = chooseWords(p, dict('easy', 'hard'), 1);
    expect(picked[0].text).toBe('hard');
  });

  it('rations new words while there are familiar ones to carry him', () => {
    /* Unmet words score highest on need, so left alone every meal would be
       nothing but strangers — and the feeling of getting good at this is what
       brings him back tomorrow. */
    const familiar = ['cake', 'make', 'take', 'lake'];
    const strangers = ['dragon', 'rabbit', 'monster', 'picnic'];
    let p = blankProfile();
    for (const w of familiar) p = solid(p, w);

    const picked = chooseWords(p, dict(...familiar, ...strangers), 4, 2);
    expect(picked.filter((w) => strangers.includes(w.text))).toHaveLength(2);
  });

  it('stretches that ration on the first evening, when everything is new', () => {
    /* Held strictly the cap would serve two-round meals for the first week,
       while his whole dictionary is still unmet. Better a full meal of
       introductions — nothing in a `meet` round is being tested anyway. */
    const picked = chooseWords(blankProfile(), dict('a', 'b', 'c', 'd', 'e', 'f'), 6, 2);
    expect(new Set(picked.map((w) => w.text)).size).toBe(6);
  });

  it('does not repeat a word inside one meal', () => {
    const p = solid(blankProfile(), 'one');
    const picked = chooseWords(p, dict('one', 'two', 'three', 'four'), 4);
    expect(new Set(picked.map((w) => w.text)).size).toBe(4);
  });

  it('still fills a meal from a tiny dictionary', () => {
    // the first evening, before you have added anything much
    const picked = chooseWords(blankProfile(), dict('night', 'dragon'), 6);
    expect(picked).toHaveLength(6);
  });
});

describe('planMeal', () => {
  it('serves as many rounds as the settings ask for', () => {
    const p = blankProfile();
    const meal = planMeal(p, dict('night', 'light', 'dragon', 'said', 'rabbit', 'come'));
    expect(meal).toHaveLength(p.settings.roundsPerMeal);
  });

  it('gives every round something to actually do', () => {
    const meal = planMeal(blankProfile(), dict('night', 'light', 'dragon', 'said'));
    for (const round of meal) {
      if (round.kind === 'pick') expect(round.options.length).toBeGreaterThan(1);
      if (round.kind === 'order') expect(round.slices.length).toBeGreaterThan(1);
      expect(round.word.text).toBeTruthy();
    }
  });

  it('opens a first-ever meal by introducing words, not testing them', () => {
    const meal = planMeal(blankProfile(), dict('night', 'dragon', 'said'));
    expect(meal[0].kind).toBe('meet');
  });
});

describe('isOrdered', () => {
  it('accepts only the arrangement that spells the word', () => {
    const round = buildRound(blankProfile(), makeWord('dragon'), [], 'order');
    expect(isOrdered(round, ['drag', 'on'])).toBe(true);
    expect(isOrdered(round, ['on', 'drag'])).toBe(false);
  });

  it('does not care how a one-piece word is arranged', () => {
    const round: { kind: 'read'; word: Word; options: Word[]; slices: string[] } = {
      kind: 'read',
      word: makeWord('night'),
      options: [],
      slices: [],
    };
    expect(isOrdered(round, ['night'])).toBe(true);
  });
});
