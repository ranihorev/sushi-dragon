/**
 * The letters that lie.
 *
 * Words like `said` and `come` are usually handed to children as shapes to
 * memorise, which teaches them that reading is sometimes guessing. It isn't.
 * `said` is almost entirely regular — the `s` and the `d` behave perfectly —
 * and only the `ai` is misbehaving. Marking exactly that much keeps the rest
 * of his decoding instinct intact and gives him something far smaller to
 * remember.
 *
 * In the game this becomes a dab of wasabi sitting on the offending letters:
 * careful, this bit bites. He learns to read the word and to distrust two
 * letters of it, rather than to distrust the whole enterprise.
 *
 * Spellings are stored as the misbehaving letters themselves rather than as
 * positions, because a hand-counted index is a typo waiting to happen — and
 * there is a test that every one of these is actually found in its word.
 */

export interface Tricky {
  /** the letters that don't say what they should */
  bit: string;
  /**
   * What they say instead, in plain words a parent can read out.
   *
   * Plain means plain: these used to be written the way a phonics scheme writes
   * them, `says /u/, as in cup`, and a parent who has never taught reading has
   * no idea what the slashes are for.
   */
  says: string;
}

export const TRICKY: Record<string, Tricky> = {
  said: { bit: 'ai', says: 'says “eh”, like the e in bed' },
  says: { bit: 'ay', says: 'says “eh”, like the e in bed' },
  was: { bit: 'a', says: 'says “o”, like the o in dog' },
  what: { bit: 'a', says: 'says “o”, like the o in dog' },
  want: { bit: 'a', says: 'says “o”, like the o in dog' },
  water: { bit: 'a', says: 'says “o”, like the o in dog' },
  any: { bit: 'a', says: 'says “eh”, like the e in bed' },
  many: { bit: 'a', says: 'says “eh”, like the e in bed' },
  one: { bit: 'o', says: 'starts with a “w” sound' },
  once: { bit: 'o', says: 'starts with a “w” sound' },
  two: { bit: 'w', says: 'is silent' },
  who: { bit: 'wh', says: 'says “h”' },
  whose: { bit: 'wh', says: 'says “h”' },
  come: { bit: 'o', says: 'says “uh”, like the u in cup' },
  some: { bit: 'o', says: 'says “uh”, like the u in cup' },
  done: { bit: 'o', says: 'says “uh”, like the u in cup' },
  love: { bit: 'o', says: 'says “uh”, like the u in cup' },
  above: { bit: 'o', says: 'says “uh”, like the u in cup' },
  mother: { bit: 'o', says: 'says “uh”, like the u in cup' },
  brother: { bit: 'o', says: 'says “uh”, like the u in cup' },
  other: { bit: 'o', says: 'says “uh”, like the u in cup' },
  from: { bit: 'o', says: 'says “uh”, like the u in cup' },
  month: { bit: 'o', says: 'says “uh”, like the u in cup' },
  have: { bit: 'e', says: 'is silent — the a stays short' },
  give: { bit: 'e', says: 'is silent — the i stays short' },
  live: { bit: 'e', says: 'is silent — the i stays short' },
  are: { bit: 'e', says: 'is silent' },
  of: { bit: 'f', says: 'says “v”' },
  friend: { bit: 'ie', says: 'says “eh”, like the e in bed' },
  because: { bit: 'au', says: 'says “o”, like the o in dog' },
  people: { bit: 'eo', says: 'says “ee”, like the ee in see' },
  there: { bit: 'ere', says: 'says “air”, like the word air' },
  where: { bit: 'ere', says: 'says “air”, like the word air' },
  their: { bit: 'ei', says: 'says “air”, like the word air' },
  they: { bit: 'ey', says: 'says “ay”, like the a in cake' },
  you: { bit: 'ou', says: 'says “oo”, like the oo in moon' },
  your: { bit: 'our', says: 'says “or”, like the word or' },
  could: { bit: 'oul', says: 'says “oo”, like the oo in book' },
  would: { bit: 'oul', says: 'says “oo”, like the oo in book' },
  should: { bit: 'oul', says: 'says “oo”, like the oo in book' },
  put: { bit: 'u', says: 'says “oo”, like the oo in book' },
  push: { bit: 'u', says: 'says “oo”, like the oo in book' },
  pull: { bit: 'u', says: 'says “oo”, like the oo in book' },
  full: { bit: 'u', says: 'says “oo”, like the oo in book' },
  work: { bit: 'or', says: 'says “er”, like the er in her' },
  word: { bit: 'or', says: 'says “er”, like the er in her' },
  world: { bit: 'or', says: 'says “er”, like the er in her' },
  worm: { bit: 'or', says: 'says “er”, like the er in her' },
  eye: { bit: 'eye', says: 'the whole word just says “eye”' },
  laugh: { bit: 'augh', says: 'says “aff”' },
  through: { bit: 'ough', says: 'says “oo”, like the oo in moon' },
  enough: { bit: 'ough', says: 'says “uff”' },
  again: { bit: 'ai', says: 'says “eh”, like the e in bed' },
  great: { bit: 'ea', says: 'says “ay”, like the a in cake' },
  break: { bit: 'ea', says: 'says “ay”, like the a in cake' },
  steak: { bit: 'ea', says: 'says “ay”, like the a in cake' },
  head: { bit: 'ea', says: 'says “eh”, like the e in bed' },
  bread: { bit: 'ea', says: 'says “eh”, like the e in bed' },
  ready: { bit: 'ea', says: 'says “eh”, like the e in bed' },
  know: { bit: 'k', says: 'is silent' },
  knee: { bit: 'k', says: 'is silent' },
  write: { bit: 'w', says: 'is silent' },
  wrong: { bit: 'w', says: 'is silent' },
  climb: { bit: 'b', says: 'is silent' },
  thumb: { bit: 'b', says: 'is silent' },
  half: { bit: 'l', says: 'is silent' },
  talk: { bit: 'l', says: 'is silent' },
  walk: { bit: 'l', says: 'is silent' },
  island: { bit: 's', says: 'is silent' },
  sure: { bit: 's', says: 'says “sh”' },
  sugar: { bit: 's', says: 'says “sh”' },
  move: { bit: 'o', says: 'says “oo”, like the oo in moon' },
  lose: { bit: 'o', says: 'says “oo”, like the oo in moon' },
  the: { bit: 'e', says: 'barely says anything at all' },
  to: { bit: 'o', says: 'says “oo”, like the oo in moon' },
  do: { bit: 'o', says: 'says “oo”, like the oo in moon' },
};

/** Where the misbehaving letters sit, or null if the word plays fair. */
export function trickySpan(word: string): { start: number; end: number; says: string } | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const entry = TRICKY[w];
  if (!entry) return null;
  const start = w.indexOf(entry.bit);
  if (start < 0) return null;
  return { start, end: start + entry.bit.length, says: entry.says };
}

/** Words that need the wasabi treatment — the seed list for irregular practice. */
export const TRICKY_WORDS = Object.keys(TRICKY);
