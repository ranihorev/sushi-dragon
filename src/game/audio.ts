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

/**
 * Something to play, or a number of milliseconds of deliberate silence.
 *
 * Sounds are wrapped rather than passed bare because a bundled asset is itself
 * a number in React Native, which would be indistinguishable from a pause —
 * and a silence played as a clip, or a clip skipped as a silence, is exactly
 * the class of bug this module exists to prevent.
 */
export type Sound = { play: number | string };
export type Beat = Sound | number;

/** A bundled asset (a module id) or a recording on disk (a uri). */
export const sound = (source: number | string): Sound => ({ play: source });

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
    else await playOne(beat.play, token);
  }
}

/** True once the queue this call started has been replaced by another. */
export const wasInterrupted = (token: number) => token !== sequence;
export const currentSequence = () => sequence;
