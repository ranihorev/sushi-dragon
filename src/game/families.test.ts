import { describe, expect, it } from 'vitest';
import { ALL_FAMILY_WORDS, CONFUSABLE, distractors, familyOf, relatives } from './families';
import { STARTER_WORDS } from './words';
import { onsetRime } from './chunk';

describe('familyOf', () => {
  it('finds the pattern a word belongs to', () => {
    expect(familyOf('night')).toBe('ight');
    expect(familyOf('bright')).toBe('ight');
    expect(familyOf('snake')).toBe('ake');
  });

  it('prefers the longest pattern that fits', () => {
    // `night` ends in `-it` too, but `-ight` is the pattern worth owning
    expect(familyOf('night')).toBe('ight');
    expect(familyOf('found')).toBe('ound');
  });

  it('gives multi-syllable words no family', () => {
    /* The end of `dragon` teaches nothing he can carry to another word, so
       there is no leverage to be had and pretending otherwise would fill his
       dictionary with words nobody chose. */
    expect(familyOf('dragon')).toBeNull();
    expect(familyOf('rabbit')).toBeNull();
  });
});

describe('relatives', () => {
  it('hands back the rest of the family, minus the word itself', () => {
    const rest = relatives('night');
    expect(rest).toContain('light');
    expect(rest).toContain('right');
    expect(rest).not.toContain('night');
  });

  it('is empty for a word that stands alone', () => {
    expect(relatives('dragon')).toEqual([]);
  });
});

describe('distractors', () => {
  it('offers the family first, because that is what cannot be guessed', () => {
    const wrong = distractors('night', ['dog', 'cup', 'elephant'], 3);
    // every one of these differs from `night` only at the start
    for (const w of wrong) expect(onsetRime(w).rime).toBe('ight');
  });

  it('falls back to words that differ by a single letter', () => {
    const wrong = distractors('dragon', ['dragan', 'wagon', 'elephant', 'cup'], 2);
    expect(wrong[0]).toBe('dragan');
  });

  it('never offers the answer as one of the wrong ones', () => {
    expect(distractors('night', ['night', 'light'], 3)).not.toContain('night');
  });

  it('asks for as many as it is given', () => {
    expect(distractors('cake', [], 3)).toHaveLength(3);
    expect(distractors('cake', [], 1)).toHaveLength(1);
  });

  it('offers the same letters in another order, once he has hold of the word', () => {
    /* `tub` against `but`, `was` against `saw`: no shape to fall back on, no
       first letter to guess from, nothing to do but read it left to right. */
    expect(distractors('tub', ['but', 'cup'], 1, 1)).toEqual(['but']);
    expect(distractors('on', ['no', 'cup'], 1, 1)).toEqual(['no']);
  });

  it('keeps that pair away from a word he is still learning', () => {
    /* Reading right to left is not a mistake about this word, it is a habit he
       is still losing — and losing it on a word he cannot yet read is just a
       round he fails for a reason nobody can explain to him. */
    expect(distractors('tub', ['but', 'cup'], 1, 0.25)).toEqual(['cup']);
  });

  it('offers words that start the same and end differently', () => {
    // where a guessing reader stops: two letters in, recognises something, stops looking
    expect(distractors('start', ['star', 'cup'], 1)).toEqual(['star']);
    expect(distractors('mother', ['moth', 'cup'], 1)).toEqual(['moth']);
  });

  it('puts a word he shares a family with ahead of both', () => {
    /* `net` against `get` is not softer than `net` against `ten` — the first
       letter is the whole difference, and he has to read it. */
    expect(distractors('net', ['ten', 'get'], 1, 1)).toEqual(['get']);
  });
});

describe('the counter a starter word gets', () => {
  /**
   * Close enough to be worth reading.
   *
   * One letter apart, the same letters shuffled, a shared start, or named by
   * hand as a pair. Anything else is a wrong answer he can reject on shape,
   * and a round of those teaches him to look at outlines instead of letters.
   */
  const alike = (word: string, other: string): boolean => {
    if ((CONFUSABLE[word] ?? []).includes(other)) return true;
    if ((CONFUSABLE[other] ?? []).includes(word)) return true;
    if (relatives(word).includes(other)) return true;
    if (word.length === other.length) {
      const diff = [...word].filter((c, i) => c !== other[i]).length;
      if (diff <= 1) return true;
      if ([...word].sort().join('') === [...other].sort().join('')) return true;
    }
    let shared = 0;
    while (shared < word.length && word[shared] === other[shared]) shared++;
    return shared >= 3;
  };

  it('holds nothing he can reject without reading it', () => {
    /* It used to. `one` was offered against `apple`, `because` and `birthday`
       — three words he could rule out by length alone, which is a round he
       wins with his eyes shut. */
    const pool = STARTER_WORDS;
    for (const word of STARTER_WORDS) {
      for (const wrong of distractors(word, pool, 3, 1)) {
        expect(alike(word, wrong), `${word} against ${wrong}`).toBe(true);
      }
    }
  });
});

describe('the family table itself', () => {
  it('lists every member under a rime it actually ends with', () => {
    /* A word filed under the wrong family would be served as a distractor that
       looks nothing like the answer, quietly making that round free. */
    for (const word of ALL_FAMILY_WORDS) {
      const fam = familyOf(word);
      expect(fam, word).not.toBeNull();
      expect(word.endsWith(fam!), `${word} filed under -${fam}`).toBe(true);
    }
  });

  it('has enough members everywhere to fill a round', () => {
    // three wrong answers plus the right one is the widest round the game offers
    for (const word of ALL_FAMILY_WORDS) {
      expect(relatives(word).length, word).toBeGreaterThanOrEqual(3);
    }
  });
});
