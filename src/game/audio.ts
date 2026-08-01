/**
 * The dragon's voice.
 *
 * Small, and shaped by one lesson from the letter game: the bug that made that
 * game genuinely hard to follow was never a missing sound, it was two sounds
 * arriving on top of each other. A new prompt would cut the previous one in
 * half and the child heard a stream with no telling where one thing ended and
 * the next began.
 *
 * So everything goes through a single queue that plays one thing at a time and
 * waits for it to finish, silences are first-class members of that queue
 * rather than an afterthought, and starting a new sequence explicitly
 * abandons the old one instead of talking over it.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

/**
 * Something to play, something to say, or a number of milliseconds of
 * deliberate silence.
 *
 * Sounds are wrapped rather than passed bare because a bundled asset is itself
 * a number in React Native, which would be indistinguishable from a pause —
 * and a silence played as a clip, or a clip skipped as a silence, is exactly
 * the class of bug this module exists to prevent.
 */
export type Sound = { play: number | string };
export type Spoken = { say: string };
export type Beat = Sound | Spoken | number;

/** A bundled asset (a module id) or a recording on disk (a uri). */
export const sound = (source: number | string): Sound => ({ play: source });

/**
 * A word for the iPad to say in its own voice.
 *
 * The dragon used to have no voice at all until a grown-up had sat down and
 * recorded one, and until then the game could not ask him to *hear* anything —
 * so it fell back to showing words in silence, which is not a game, it is a
 * flashcard. The device voice is not as good as his father's and it is not
 * supposed to be: it is what makes the game playable the moment it is
 * installed, on any word, with nobody in the room. A recording still wins
 * wherever there is one.
 */
export const said = (text: string): Spoken => ({ say: text });

/** Slower than talking. A word he is learning arrives one sound at a time. */
const SPEECH = { language: 'en-GB', rate: 0.62, pitch: 1.06 } as const;

let sequence = 0;
let playing: AudioPlayer | null = null;

/**
 * Without this the iPad's mute switch silences the game, and a game whose only
 * instructions are spoken becomes unplayable with no visible explanation.
 */
export async function prepare() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    /* nothing to be done, and it is not worth failing to start over */
  }
}

function release() {
  try {
    playing?.remove();
  } catch {
    /* already gone */
  }
  playing = null;
}

/** Cut off whatever is talking. */
export function stop() {
  sequence++;
  release();
  try {
    Speech.stop();
  } catch {
    /* nothing was being said */
  }
}

/**
 * The iPad saying a word, as one beat of the queue.
 *
 * Same shape as playing a clip, and for the same reason: whatever is speaking
 * has to be interruptible by the next question, and the round after it must not
 * start until this has finished.
 */
function sayOne(text: string, token: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let guard: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };

    try {
      Speech.speak(text, {
        ...SPEECH,
        onDone: finish,
        onStopped: finish,
        onError: finish,
      });
    } catch {
      finish();
      return;
    }

    // a voice that never arrives must not be able to wedge the game shut
    guard = setTimeout(finish, 6000);
    if (token !== sequence) finish();
  });
}

function playOne(source: number | string, token: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    let guard: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      try {
        subscription?.remove();
      } catch {
        /* already gone */
      }
      if (token === sequence) release();
      resolve();
    };

    let subscription: { remove: () => void } | undefined;
    let player: AudioPlayer;
    try {
      player = createAudioPlayer(typeof source === 'string' ? { uri: source } : source);
    } catch {
      resolve();
      return;
    }

    playing = player;
    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (token !== sequence) return finish();
      if (status.didJustFinish || status.error) finish();
    });

    /* A clip that never loads must not be able to wedge the game shut. Six
       seconds is far longer than any word and far shorter than a child's
       patience for a dragon that has stopped responding. */
    guard = setTimeout(finish, 6000);

    try {
      player.play();
    } catch {
      finish();
    }
  });
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Play a sequence, in order, abandoning anything already in progress.
 *
 * Resolves when the last beat has finished — which is what lets the screen
 * hold the dragon's pleased expression through a silence rather than moving on
 * underneath it.
 */
export async function speak(beats: Beat[]): Promise<void> {
  stop();
  const token = sequence;

  for (const beat of beats) {
    if (token !== sequence) return;
    if (typeof beat === 'number') await wait(beat);
    else if ('say' in beat) await sayOne(beat.say, token);
    else await playOne(beat.play, token);
  }
}

/** True once the queue this call started has been replaced by another. */
export const wasInterrupted = (token: number) => token !== sequence;
export const currentSequence = () => sequence;
