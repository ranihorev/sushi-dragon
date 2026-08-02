/**
 * What the dragon says just before it says the word.
 *
 * There used to be one sentence per kind of round, so the same eight words
 * arrived in the same order every single time: *A new word. This one says …*,
 * twice a meal, every meal, forever. A child stops hearing a sentence he can
 * predict, and once he has stopped hearing it he has stopped hearing the word
 * on the end of it too.
 *
 * So each kind of round has a handful of ways to ask, and which one comes up
 * moves with the meal rather than being drawn at random — the same round of the
 * same meal always sounds the same, so nothing feels unstable, but two rounds
 * running never do.
 *
 * Every line here is written to stop dead where the word begins. That is what
 * lets the same string be either spoken whole by the iPad (`Find the word
 * sushi`) or played as a recorded clip with the word's own clip behind it,
 * without keeping two versions of the wording in step.
 */

import type { RoundKind } from './engine';

const CARRIERS: Record<RoundKind, string[]> = {
  meet: [
    "Here's a new word. It says",
    'A new one for you. This says',
    'Something new. This one says',
    'Look what I made. It says',
  ],
  pick: ['Which one says', 'Find the word', 'I would like', 'Can you find'],
  /* Say what to do, not what you want. "Make me the word sushi" is a dragon
     placing an order; it never says that the pieces are in the wrong order or
     that anything has to be moved, which is the entire round. */
  order: [
    'My pieces are mixed up. Put them in order to make',
    'Put the pieces in the right order to make',
    'These pieces are muddled. Put them in order to make',
  ],
  /* A reading round asks for nothing out loud on purpose: the whole test is
     whether he can get the word off the page with no help. */
  read: [],
};

/**
 * What the dragon says when somebody turns up.
 *
 * A game that opens by demanding a word is a game that opened in the middle. It
 * costs a second and a half and it is the only moment in the app where the
 * dragon says something to him rather than about a word.
 */
export const GREETINGS = [
  "Hello! I'm hungry. Let's read some words.",
  'There you are! I could eat a whole word.',
  'Hello again. Shall we feed the dragon?',
];

/**
 * What the dragon says the moment the pieces are in the right order.
 *
 * The round is two jobs — put it together, then feed it — and the second one
 * was invisible: the pieces became a roll on the plate and nothing said that it
 * was now his to carry. A finished puzzle looks finished.
 */
export const READY = 'You made it! Now feed it to me.';

export const greetingFor = (turn: number) =>
  GREETINGS[((Math.trunc(turn) % GREETINGS.length) + GREETINGS.length) % GREETINGS.length];

/**
 * The words before the word, for this round of this meal.
 *
 * `turn` is the round's place in the meal plus the number of meals behind him,
 * so the rotation carries on across a session instead of restarting at the same
 * line every time the dragon gets hungry again.
 */
export function carrierFor(kind: RoundKind, turn: number): string | null {
  const lines = CARRIERS[kind];
  if (!lines.length) return null;
  const n = lines.length;
  return lines[((Math.trunc(turn) % n) + n) % n];
}

/** Every line, for whatever has to record them all. */
export const ALL_CARRIERS: string[] = [...new Set(Object.values(CARRIERS).flat())];

/** The question as one sentence, for a voice that has to say the whole thing. */
export const wholeQuestion = (carrier: string, word: string) => `${carrier} ${word}`;
