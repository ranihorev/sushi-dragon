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
  /** what they say instead, in plain words a parent can read out */
  says: string;
}

export const TRICKY: Record<string, Tricky> = {
  said: { bit: 'ai', says: 'says /e/, as in bed' },
  says: { bit: 'ay', says: 'says /e/, as in bed' },
  was: { bit: 'a', says: 'says /o/' },
  what: { bit: 'a', says: 'says /o/' },
  want: { bit: 'a', says: 'says /o/' },
  water: { bit: 'a', says: 'says /o/' },
  any: { bit: 'a', says: 'says /e/' },
  many: { bit: 'a', says: 'says /e/' },
  one: { bit: 'o', says: 'sounds like it starts with w' },
  once: { bit: 'o', says: 'sounds like it starts with w' },
  two: { bit: 'w', says: 'is silent' },
  who: { bit: 'wh', says: 'says /h/' },
  whose: { bit: 'wh', says: 'says /h/' },
  come: { bit: 'o', says: 'says /u/, as in cup' },
  some: { bit: 'o', says: 'says /u/, as in cup' },
  done: { bit: 'o', says: 'says /u/, as in cup' },
  love: { bit: 'o', says: 'says /u/, as in cup' },
  above: { bit: 'o', says: 'says /u/, as in cup' },
  mother: { bit: 'o', says: 'says /u/, as in cup' },
  brother: { bit: 'o', says: 'says /u/, as in cup' },
  other: { bit: 'o', says: 'says /u/, as in cup' },
  from: { bit: 'o', says: 'says /u/, as in cup' },
  month: { bit: 'o', says: 'says /u/, as in cup' },
  have: { bit: 'e', says: 'does nothing — the a stays short' },
  give: { bit: 'e', says: 'does nothing — the i stays short' },
  live: { bit: 'e', says: 'does nothing — the i stays short' },
  are: { bit: 'e', says: 'is silent' },
  of: { bit: 'f', says: 'says /v/' },
  friend: { bit: 'ie', says: 'says /e/, as in bed' },
  because: { bit: 'au', says: 'says /o/' },
  people: { bit: 'eo', says: 'says /ee/' },
  there: { bit: 'ere', says: 'says /air/' },
  where: { bit: 'ere', says: 'says /air/' },
  their: { bit: 'ei', says: 'says /air/' },
  they: { bit: 'ey', says: 'says /ay/' },
  you: { bit: 'ou', says: 'says /oo/' },
  your: { bit: 'our', says: 'says /or/' },
  could: { bit: 'oul', says: 'says /oo/, as in book' },
  would: { bit: 'oul', says: 'says /oo/, as in book' },
  should: { bit: 'oul', says: 'says /oo/, as in book' },
  put: { bit: 'u', says: 'says /oo/, as in book' },
  push: { bit: 'u', says: 'says /oo/, as in book' },
  pull: { bit: 'u', says: 'says /oo/, as in book' },
  full: { bit: 'u', says: 'says /oo/, as in book' },
  work: { bit: 'or', says: 'says /er/' },
  word: { bit: 'or', says: 'says /er/' },
  world: { bit: 'or', says: 'says /er/' },
  worm: { bit: 'or', says: 'says /er/' },
  eye: { bit: 'eye', says: 'the whole word is odd — it just says /i/' },
  laugh: { bit: 'augh', says: 'says /aff/' },
  through: { bit: 'ough', says: 'says /oo/' },
  enough: { bit: 'ough', says: 'says /uff/' },
  again: { bit: 'ai', says: 'says /e/, as in bed' },
  great: { bit: 'ea', says: 'says /ay/' },
  break: { bit: 'ea', says: 'says /ay/' },
  steak: { bit: 'ea', says: 'says /ay/' },
  head: { bit: 'ea', says: 'says /e/, as in bed' },
  bread: { bit: 'ea', says: 'says /e/, as in bed' },
  ready: { bit: 'ea', says: 'says /e/, as in bed' },
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
  sure: { bit: 's', says: 'says /sh/' },
  sugar: { bit: 's', says: 'says /sh/' },
  move: { bit: 'o', says: 'says /oo/' },
  lose: { bit: 'o', says: 'says /oo/' },
  the: { bit: 'e', says: 'barely says anything at all' },
  to: { bit: 'o', says: 'says /oo/' },
  do: { bit: 'o', says: 'says /oo/' },
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
