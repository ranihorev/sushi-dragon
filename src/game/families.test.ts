import { describe, expect, it } from 'vitest';
import { ALL_FAMILY_WORDS, distractors, familyOf, relatives } from './families';
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
