/**
 * What the dragon asks for next.
 *
 * A meal is a handful of words chosen by how badly each one needs the
 * practice, each wrapped in whichever kind of round suits how well he knows
 * it. The ladder runs: meet it, handle it with the answer in front of you,
 * then read it cold. Words climb it at their own pace and slide back down when
 * they stop sticking.
 */

import { distractors } from './families';
import type { DragonProfile } from './progress';
import { dueScore, statFor } from './progress';
import type { Word } from './words';
import { isRoll } from './words';

export type RoundKind =
  /** first meeting: the dragon sears the word and says it. Nothing is scored. */
  | 'meet'
  /** hear it, pick it out of near-identical neighbours */
  | 'pick'
  /** put the slices of the roll back in order, then feed it */
  | 'order'
  /** the word alone. He reads it, feeds it, the dragon says it back. */
  | 'read';

export interface Round {
  kind: RoundKind;
  word: Word;
  /** `pick` only — what sits on the counter, answer included, already shuffled */
  options: Word[];
  /** `order` only — the slices, jumbled */
  slices: string[];
}

export type Rng = () => number;

/** Fisher–Yates, so a test can hand in a predictable rng and get a fixed deal. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * How many words to choose between.
 *
 * Two while a word is new, four once it is nearly his. Widening the field is
 * the only difficulty knob in the game and it is never announced — he
 * experiences a busier counter, not a harder level.
 */
function optionCount(mastery: number): number {
  if (mastery < 0.3) return 2;
  if (mastery < 0.65) return 3;
  return 4;
}

/**
 * Which kind of round a word has earned.
 *
 * Reading it cold is the point of the whole game, so with a parent sitting
 * there to hear it that is the default for anything he has met before. The
 * scaffolded kinds are for words that are still new to him — and for the
 * evenings he plays alone, when nobody can hear him and picking is the only
 * thing the game can honestly score.
 */
export function kindFor(profile: DragonProfile, word: Word, index: number): RoundKind {
  const stat = statFor(profile, word.text);
  if (stat.seen === 0) return 'meet';

  const scaffolded: RoundKind = isRoll(word) && stat.mastery < 0.7 ? 'order' : 'pick';
  if (!profile.settings.parentCheck) return scaffolded;
  if (stat.mastery < 0.3) return scaffolded;

  /* Even once he is reading them cold, every third round is something else.
     Six identical rounds is a worksheet; a child who can feel a worksheet
     coming stops trying somewhere around the fourth one. */
  return index % 3 === 2 ? scaffolded : 'read';
}

/** Dress a chosen word as a round of the given kind. */
export function buildRound(
  profile: DragonProfile,
  word: Word,
  dictionary: Word[],
  kind: RoundKind,
  rng: Rng = Math.random,
): Round {
  if (kind === 'pick') {
    const mastery = statFor(profile, word.text).mastery;
    const pool = dictionary.map((w) => w.text);
    const wrong = distractors(word.text, pool, optionCount(mastery) - 1);
    const byText = new Map(dictionary.map((w) => [w.text, w]));
    const options = wrong.map((t) => byText.get(t) ?? asWord(t, word));
    return { kind, word, options: shuffle([word, ...options], rng), slices: [] };
  }

  if (kind === 'order') {
    return { kind, word, options: [], slices: jumble(word.chunks, rng) };
  }

  return { kind, word, options: [], slices: [] };
}

/** A distractor that isn't in his dictionary still needs to look like a word. */
const asWord = (text: string, like: Word): Word => ({
  ...like,
  text,
  chunks: [text],
  tricky: null,
});

/**
 * Jumble the slices, and never hand them back already in order.
 *
 * A roll that arrives correct is a round he wins by touching nothing, which
 * teaches him that not looking is sometimes rewarded.
 */
function jumble(chunks: string[], rng: Rng): string[] {
  if (chunks.length < 2) return [...chunks];
  for (let attempt = 0; attempt < 8; attempt++) {
    const out = shuffle(chunks, rng);
    if (out.join('') !== chunks.join('')) return out;
  }
  return [...chunks].reverse();
}

/**
 * Choose the words for one meal.
 *
 * Ordered by need, but with two guards. New words are capped, because a meal
 * of words he has never seen is a meal he loses — and the ones he has met
 * carry the sense that he is getting good at this, which is the thing that
 * brings him back tomorrow. And no word repeats inside a meal, however badly
 * it needs the work; that is what tomorrow is for.
 */
export function chooseWords(
  profile: DragonProfile,
  dictionary: Word[],
  count: number,
  maxNew = 2,
): Word[] {
  const ranked = [...dictionary].sort(
    (a, b) => dueScore(profile, b.text) - dueScore(profile, a.text),
  );

  const picked: Word[] = [];
  const taken = new Set<string>();
  const take = (word: Word) => {
    picked.push(word);
    taken.add(word.text);
  };

  let fresh = 0;
  for (const word of ranked) {
    if (picked.length >= count) break;
    const isNew = statFor(profile, word.text).seen === 0;
    if (isNew && fresh >= maxNew) continue;
    if (isNew) fresh++;
    take(word);
  }

  /* The cap on new words stretches rather than shortening the meal.
     It exists so he isn't drowned in strangers while there are familiar words
     available to carry him — not to make the first week's meals two rounds
     long, which is what a hard cap would do while his whole dictionary is
     still unmet. */
  for (const word of ranked) {
    if (picked.length >= count) break;
    if (!taken.has(word.text)) take(word);
  }

  // only now, with the dictionary genuinely exhausted, does anything repeat
  for (let i = 0; picked.length < count && ranked.length; i++) {
    picked.push(ranked[i % ranked.length]);
  }
  return picked;
}

/** A whole meal, ready to play. */
export function planMeal(
  profile: DragonProfile,
  dictionary: Word[],
  rng: Rng = Math.random,
): Round[] {
  const words = chooseWords(profile, dictionary, profile.settings.roundsPerMeal);
  return words.map((word, i) =>
    buildRound(profile, word, dictionary, kindFor(profile, word, i), rng),
  );
}

/** Did he feed the right thing? */
export const isCorrectPick = (round: Round, fed: Word) => fed.text === round.word.text;

/** Are the slices in the order that spells the word? */
export const isOrdered = (round: Round, slices: string[]) =>
  slices.join('') === round.word.text;
