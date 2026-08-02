import { describe, expect, it } from 'vitest';
import { TRICKY, TRICKY_WORDS, trickySpan } from './tricky';
import { family, isRoll, makeWord, reseam, starterDictionary } from './words';

describe('makeWord', () => {
  it('cuts the seams and marks the liars in one go', () => {
    const w = makeWord('dragon');
    expect(w.chunks).toEqual(['drag', 'on']);
    expect(w.tricky).toBeNull();

    const said = makeWord('said');
    expect(said.chunks).toEqual(['said']);
    expect(said.tricky).toMatchObject({ start: 1, end: 3 });
  });

  it('tidies what a tired parent types at bedtime', () => {
    expect(makeWord('  Dragon! ').text).toBe('dragon');
  });

  it('accepts seams handed to it, for the ones the chunker gets wrong', () => {
    const w = makeWord('tiger', { chunks: ['tig', 'er'] });
    expect(w.chunks).toEqual(['tig', 'er']);
  });

  it('remembers where a word came from', () => {
    const w = makeWord('dragon', { source: 'the bedtime book', addedAt: '2026-07-29' });
    expect(w.source).toBe('the bedtime book');
    expect(w.addedAt).toBe('2026-07-29');
  });

  it('stamps the moment, not the day', () => {
    /* Two iPads settle an argument about a word by which copy is newer. A date
       ties whenever both were edited the same day, and a tie is settled by
       whichever device happened to sync last — which is not a rule, it is a
       coin. */
    expect(makeWord('dragon').updatedAt).toMatch(/T.*Z$/);
  });

  it('starts a word with no recording', () => {
    expect(makeWord('dragon').voiceKey).toBeNull();
  });
});

describe('reseam', () => {
  it('moves a seam and keeps everything else', () => {
    const w = makeWord('tiger');
    const fixed = reseam(w, ['ti', 'ger']);
    expect(fixed.chunks).toEqual(['ti', 'ger']);
    expect(fixed.text).toBe('tiger');
  });

  it('counts as a change, so the corrected seam wins on the other iPad', () => {
    const w = { ...makeWord('tiger'), updatedAt: '2020-01-01T00:00:00.000Z' };
    expect(reseam(w, ['ti', 'ger']).updatedAt > w.updatedAt).toBe(true);
  });

  it('refuses pieces that do not spell the word', () => {
    /* A dropped letter here would put a piece of sushi on the counter that
       cannot be assembled into anything, with no way for him to tell why. */
    expect(() => reseam(makeWord('tiger'), ['ti', 'gerr'])).toThrow();
  });
});

describe('family', () => {
  it('brings the relatives along as words of their own', () => {
    const words = family(makeWord('night'));
    const texts = words.map((w) => w.text);
    expect(texts).toContain('light');
    expect(texts).toContain('right');
    expect(texts).not.toContain('night');
  });

  it('says where they came from, so the parent screen can explain itself', () => {
    expect(family(makeWord('night'))[0].source).toBe('came with night');
  });

  it('brings nobody along for a word with no pattern', () => {
    expect(family(makeWord('dragon'))).toEqual([]);
  });
});

describe('isRoll', () => {
  it('is a roll when there is something to arrange', () => {
    // one syllable is one piece of nigiri — nothing to put in order
    expect(isRoll(makeWord('night'))).toBe(false);
    expect(isRoll(makeWord('dragon'))).toBe(true);
  });
});

describe('the tricky table', () => {
  it('marks letters that are really in the word', () => {
    /* Hand-counted positions rot silently: the wasabi ends up on the wrong
       letter and the word teaches the opposite of what it should. */
    for (const word of TRICKY_WORDS) {
      expect(word.includes(TRICKY[word].bit), `${word} / ${TRICKY[word].bit}`).toBe(true);
      const span = trickySpan(word);
      expect(span, word).not.toBeNull();
      expect(word.slice(span!.start, span!.end)).toBe(TRICKY[word].bit);
    }
  });

  it('leaves honest words alone', () => {
    for (const w of ['cat', 'dragon', 'jumping', 'night']) {
      expect(trickySpan(w), w).toBeNull();
    }
  });
});

describe('the starter dictionary', () => {
  it('is short enough that a word comes back round while he still has it', () => {
    /* It was thirty-three, which is a term's work handed over on the first
       evening. The meal planner ranks by need, so with that many waiting a word
       he half-knew did not reappear for a fortnight — by which time he did not
       half-know it any more. */
    expect(starterDictionary().length).toBeLessThanOrEqual(10);
  });

  it('is the two things that beat a child who can already blend', () => {
    const words = starterDictionary();
    const tricky = words.filter((w) => w.tricky).length;
    const long = words.filter((w) => w.chunks.length > 1).length;
    // letters that lie, mostly, and a couple too long to hold in your head
    expect(tricky).toBeGreaterThanOrEqual(words.length - 3);
    expect(long).toBeGreaterThan(0);
  });

  it('gives every word pieces that spell it', () => {
    for (const w of starterDictionary()) expect(w.chunks.join('')).toBe(w.text);
  });

  it('is dated when it was written, so a word you deleted stays deleted', () => {
    /* A second iPad seeds this list before it has heard from iCloud. Stamped
       `now`, every seeded word would out-date the note saying you threw `was`
       away last month, and `was` would come back — on both devices, because the
       merge would agree it was the newer fact. */
    for (const w of starterDictionary()) {
      expect(w.updatedAt.startsWith('2026-07-29'), w.text).toBe(true);
    }
  });
});
