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

/** Where the spoken word comes from. The audio itself lives in a file beside it. */
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
  /**
   * When this word was last changed, to the millisecond — how two iPads settle
   * an argument about it. `addedAt` is a date and cannot do the job: two edits
   * on the same day would tie, and a tie has to be broken by something, which
   * in practice means by whichever device happened to sync last.
   */
  updatedAt: string;
  /**
   * The name of its recording in iCloud, if it has one.
   *
   * Not `<word>.m4a`. A name that two devices both want to write is a name
   * iCloud has to resolve a conflict over, and its idea of resolving one is to
   * keep both and ask somebody. So every recording gets a name nothing else
   * will ever claim, and is written exactly once. Locally the file is still
   * plainly `voice/<word>.m4a` — the unique name is a cloud-side concern, and
   * the game does not need to know about it.
   */
  voiceKey: string | null;
}

export interface NewWord {
  source?: string;
  addedAt?: string;
  voice?: Voice;
  updatedAt?: string;
  voiceKey?: string | null;
  /** override the computed seams, for a word the chunker got wrong */
  chunks?: string[];
}

export function makeWord(text: string, opts: NewWord = {}): Word {
  const clean = text.toLowerCase().trim().replace(/[^a-z']/g, '');
  const addedAt = opts.addedAt ?? new Date().toISOString().slice(0, 10);
  return {
    text: clean,
    chunks: opts.chunks ?? chunk(clean),
    tricky: trickySpan(clean),
    family: familyOf(clean),
    source: opts.source ?? '',
    addedAt,
    voice: opts.voice ?? 'none',
    updatedAt: opts.updatedAt ?? new Date().toISOString(),
    voiceKey: opts.voiceKey ?? null,
  };
}

/** Move a seam, keeping everything else about the word intact. */
export function reseam(word: Word, chunks: string[]): Word {
  if (chunks.join('') !== word.text) throw new Error('the pieces must spell the word');
  return { ...word, chunks, updatedAt: new Date().toISOString() };
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

/**
 * The seeded words are stamped with the day the starter list was written, not
 * with today.
 *
 * That is what stops a deleted word walking back in. Install the app on a
 * second iPad and it seeds this list before it has heard from iCloud; if those
 * words were stamped `now` they would out-date the note saying you threw `was`
 * away last month, and `was` would return — on both devices, because the merge
 * would agree it was the newer fact. Stamped 2026-07-29 they lose that argument
 * every time, which is the right answer, since a seeded word carries no
 * intention behind it and a deletion carries yours.
 */
export const starterDictionary = (addedAt = '2026-07-29'): Word[] =>
  STARTER_WORDS.map((w) =>
    makeWord(w, { source: 'starter', addedAt, updatedAt: `${addedAt}T00:00:00.000Z` }),
  );
