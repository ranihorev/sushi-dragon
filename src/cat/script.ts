/**
 * What the cat says, and how long it leaves between the pieces of it.
 *
 * Carried over unchanged from the web version, because these timings were
 * arrived at by watching a four-year-old rather than by reasoning about them,
 * and they are the part that makes the game teach rather than merely run.
 *
 * Kept free of any playback, any bundled asset and any Expo import, so it can
 * be tested in milliseconds — a prompt that plays its clips in the wrong order
 * is a teaching bug, not a cosmetic one.
 */

import type { Letter } from './letters';
import type { Round } from './types';

export type Clip = string;

export const PRAISE_COUNT = 6;

/**
 * Stop consonants: barely a tenth of a second of sound each, and gone before
 * he has looked up. They get a longer run-up after the letter's name.
 */
const STOP_LETTERS = new Set<Letter>(['B', 'C', 'D', 'G', 'J', 'K', 'P', 'Q', 'T', 'X']);

/** A prompt is a small script: clip names interleaved with pauses in ms. */
export const promptClips = (round: Round): Array<Clip | number> => {
  const L = round.target;
  /* Word and letter-name rounds carry their own context, so the sound lands
     once. A bare phoneme does not, so the letter's name comes first and primes
     him for it: "M … /mmm/". */
  if (round.kind === 'word') return [`word/${L}`, 280, `prompt/${L}`];
  if (round.kind === 'name') return [`name/${L}`];
  return [`letter/${L}`, STOP_LETTERS.has(L) ? 460 : 340, `prompt/${L}`];
};

export const confirmClip = (l: Letter): Clip => `confirm/${l}`;

export const randomPraise = (): Clip => `praise/${1 + Math.floor(Math.random() * PRAISE_COUNT)}`;

/* The cat's own voice. It carries the feedback he actually reads — a delighted
   meow or a puzzled mrrp lands long before any of the words do. */
export const CAT_VARIANTS = {
  happy: ['cat/meow-happy-1', 'cat/meow-happy-2'],
  excited: ['cat/trill-1', 'cat/trill-2'],
  curious: ['cat/curious-1', 'cat/curious-2'],
} as const;

const pickOne = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const catSound = (kind: keyof typeof CAT_VARIANTS): Clip => pickOne(CAT_VARIANTS[kind]);

/** Every clip the game can ever ask for, so the bundle can be checked against it. */
export const allClipNames = (letters: readonly Letter[]): Clip[] => [
  ...letters.flatMap((l) => [
    `prompt/${l}`,
    `confirm/${l}`,
    `word/${l}`,
    `name/${l}`,
    `letter/${l}`,
  ]),
  ...CAT_VARIANTS.happy,
  ...CAT_VARIANTS.excited,
  ...CAT_VARIANTS.curious,
  'cat/purr',
  'cat/nom',
  'cat/yawn',
  'cat/greet',
  ...Array.from({ length: PRAISE_COUNT }, (_, i) => `praise/${i + 1}`),
];
