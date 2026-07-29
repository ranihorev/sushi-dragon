import { describe, expect, it } from 'vitest';
import { chunk, onsetRime, syllableCount } from './chunk';

/**
 * The bar here is not "matches a dictionary". It is "every piece is something
 * a five-year-old who can read CVC words could sound out". Where those two
 * disagree, the tests below follow the second one.
 */

describe('chunk', () => {
  it('leaves a one-syllable word whole', () => {
    for (const w of ['cat', 'night', 'stop', 'brush', 'street', 'jump']) {
      expect(chunk(w)).toEqual([w]);
    }
  });

  it('treats a silent e as part of the syllable it lengthens', () => {
    // `cake` is one piece of sushi, not two — the `e` makes no sound of its own
    for (const w of ['cake', 'smile', 'house', 'come', 'there', 'whale']) {
      expect(syllableCount(w)).toBe(1);
    }
  });

  it('closes the first syllable when a single consonant sits between vowels', () => {
    /* This is the ambiguous case, and the reason to close it is that the
       resulting chunk is readable. `drag` is a word he knows; `dra` is not
       anything. */
    expect(chunk('dragon')).toEqual(['drag', 'on']);
    expect(chunk('robin')).toEqual(['rob', 'in']);
    expect(chunk('seven')).toEqual(['sev', 'en']);
    expect(chunk('lemon')).toEqual(['lem', 'on']);
  });

  it('opens it for the listed exceptions, where the vowel is long', () => {
    expect(chunk('tiger')).toEqual(['ti', 'ger']);
    expect(chunk('paper')).toEqual(['pa', 'per']);
    expect(chunk('robot')).toEqual(['ro', 'bot']);
  });

  it('splits a doubled consonant down the middle', () => {
    expect(chunk('rabbit')).toEqual(['rab', 'bit']);
    expect(chunk('supper')).toEqual(['sup', 'per']);
    expect(chunk('happy')).toEqual(['hap', 'py']);
  });

  it('never cuts a digraph in half', () => {
    // `th` and `sh` are one sound each, so the seam goes around them
    expect(chunk('mother')).toEqual(['mo', 'ther']);
    expect(chunk('teacher')).toEqual(['tea', 'cher']);
    expect(chunk('sunshine')).toEqual(['sun', 'shine']);
  });

  it('keeps ng and ck on the left, where they can actually be read', () => {
    // no English syllable starts `ng` or `ck`, so they end one instead
    expect(chunk('hungry')).toEqual(['hung', 'ry']);
    expect(chunk('chicken')).toEqual(['chick', 'en']);
    expect(chunk('pocket')).toEqual(['pock', 'et']);
  });

  it('splits a consonant run so the second piece starts legally', () => {
    expect(chunk('monster')).toEqual(['mon', 'ster']);
    expect(chunk('children')).toEqual(['chil', 'dren']);
    expect(chunk('birthday')).toEqual(['birth', 'day']);
    expect(chunk('picnic')).toEqual(['pic', 'nic']);
    expect(chunk('basket')).toEqual(['bas', 'ket']);
  });

  it('gives -Cle its own piece', () => {
    expect(chunk('apple')).toEqual(['ap', 'ple']);
    expect(chunk('table')).toEqual(['ta', 'ble']);
    expect(chunk('little')).toEqual(['lit', 'tle']);
    expect(chunk('purple')).toEqual(['pur', 'ple']);
  });

  it('breaks -ing off as the piece he already recognises', () => {
    /* Left to the consonant rules `washing` becomes `wa|shing`, because `sh`
       gets pulled into the onset. He knows `wash` and he knows `ing`. */
    expect(chunk('washing')).toEqual(['wash', 'ing']);
    expect(chunk('jumping')).toEqual(['jump', 'ing']);
    expect(chunk('running')).toEqual(['run', 'ning']);
    expect(chunk('crying')).toEqual(['cry', 'ing']);
  });

  it('counts y as a vowel except at the front of a word', () => {
    expect(syllableCount('happy')).toBe(2);
    expect(syllableCount('yes')).toBe(1);
    expect(syllableCount('play')).toBe(1);
    expect(syllableCount('yellow')).toBe(2);
  });

  it('never produces a piece with no vowel in it', () => {
    const words = [
      'dragon', 'sushi', 'rabbit', 'monster', 'picnic', 'basket', 'garden',
      'window', 'sunshine', 'birthday', 'chicken', 'number', 'hungry',
      'little', 'apple', 'purple', 'jumping', 'sitting', 'elephant',
      'butterfly', 'strawberry', 'wonderful', 'crocodile', 'umbrella',
    ];
    for (const w of words) {
      for (const piece of chunk(w)) {
        expect(piece, `${w} -> ${chunk(w).join('|')}`).toMatch(/[aeiouy]/);
      }
    }
  });

  it('always puts the pieces back together into the word', () => {
    const words = [
      'dragon', 'sushi', 'elephant', 'butterfly', 'strawberry', 'crocodile',
      'umbrella', 'wonderful', 'said', 'friend', 'because', 'birthday',
    ];
    for (const w of words) expect(chunk(w).join('')).toBe(w);
  });

  it('shrugs off punctuation and capitals', () => {
    expect(chunk('Dragon')).toEqual(['drag', 'on']);
    expect(chunk("don't")).toEqual(['dont']);
  });
});

describe('onsetRime', () => {
  it('splits off the consonants a word starts with', () => {
    expect(onsetRime('night')).toEqual({ onset: 'n', rime: 'ight' });
    expect(onsetRime('bright')).toEqual({ onset: 'br', rime: 'ight' });
    expect(onsetRime('at')).toEqual({ onset: '', rime: 'at' });
  });

  it('is what makes two words rhyme', () => {
    // the shared half is the whole point — one word tripped on, a family gained
    const rime = (w: string) => onsetRime(w).rime;
    expect(rime('light')).toBe(rime('night'));
    expect(rime('cake')).toBe(rime('make'));
  });
});
