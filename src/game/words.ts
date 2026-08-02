/**
 * A word he couldn't read, and everything the game needs to teach it.
 *
 * Words arrive one at a time, from real life — a book at bedtime, a sign, a
 * cereal box. Each one is stored with its seams already cut and its dishonest
 * letters already marked, rather than working them out afresh each time it
 * appears. That is deliberate: the chunker is a good guess and not an oracle,
 * so once a seam has been corrected by hand it has to stay corrected.
 */

import { chunk } from './chunk';
import { familyOf, relatives } from './families';
import { trickySpan } from './tricky';

/** Where the spoken word comes from. The audio itself lives in IndexedDB. */
export type Voice =
  /** a parent said it into the tablet — the good case */
  | 'recorded'
  /** generated, for words added away from the child */
  | 'generated'
  /** nothing yet; the word can still be read aloud, just not checked by ear */
  | 'none';

export interface Word {
  text: string;
  /** readable pieces — one per slice of sushi */
  chunks: string[];
  /** the letters that misbehave, if any */
  tricky: { start: number; end: number; says: string } | null;
  /** the rime it shares with its relatives, if it has any */
  family: string | null;
  /** the book or moment it came from, so a parent can remember why it's here */
  source: string;
  addedAt: string;
  voice: Voice;
}

export interface NewWord {
  source?: string;
  addedAt?: string;
  voice?: Voice;
  /** override the computed seams, for a word the chunker got wrong */
  chunks?: string[];
}

export function makeWord(text: string, opts: NewWord = {}): Word {
  const clean = text.toLowerCase().trim().replace(/[^a-z']/g, '');
  return {
    text: clean,
    chunks: opts.chunks ?? chunk(clean),
    tricky: trickySpan(clean),
    family: familyOf(clean),
    source: opts.source ?? '',
    addedAt: opts.addedAt ?? new Date().toISOString().slice(0, 10),
    voice: opts.voice ?? 'none',
  };
}

/** Move a seam, keeping everything else about the word intact. */
export function reseam(word: Word, chunks: string[]): Word {
  if (chunks.join('') !== word.text) throw new Error('the pieces must spell the word');
  return { ...word, chunks };
}

/**
 * The relatives that come along with a word, as words in their own right.
 *
 * This is the whole argument for the family table: adding `night` should mean
 * he can shortly read `light` and `right` too, and neither of those needs a
 * separate trip to the parent screen.
 */
export function family(word: Word, opts: NewWord = {}): Word[] {
  return relatives(word.text).map((r) =>
    makeWord(r, { ...opts, source: opts.source ?? `came with ${word.text}` }),
  );
}

/** One syllable is one piece of nigiri; more is a roll, sliced. */
export const isRoll = (w: Word) => w.chunks.length > 1;

/**
 * A starting dictionary, until the real list of words he's tripped on arrives.
 *
 * Chosen for a child who can already blend `mat` and comes unstuck on the two
 * things that beat CVC readers: words too long to hold in your head one sound
 * at a time, and words where the letters don't keep their promises.
 *
 * Ten of them, where there used to be thirty-three. Thirty-three is a term's
 * work handed over on the first evening, and the meal planner ranks by need:
 * with that many waiting, a word he half-knows does not come back round for a
 * fortnight, by which time he has lost it again. Ten come back often enough to
 * stick, and the eleventh is supposed to be a word he actually tripped on,
 * added by hand from a real book.
 */
export const STARTER_WORDS = [
  // the letters lie in all of these
  'said', 'was', 'come', 'have', 'they', 'you', 'what', 'one',
  // and these two are simply too long to sound out in one go
  'dragon', 'sushi',
];

export const starterDictionary = (addedAt = '2026-07-29'): Word[] =>
  STARTER_WORDS.map((w) => makeWord(w, { source: 'starter', addedAt }));
