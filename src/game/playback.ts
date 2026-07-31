import { createAudioPlayer } from 'expo-audio';

/**
 * Playing a take back, once, with something to show for it.
 *
 * The button used to say `▶ hear it` while the sound was playing as well, so a
 * quiet recording and a button that did nothing looked identical — and the
 * usual reply to that is to press it again, which started a second player on
 * top of the first and made the word say itself twice.
 *
 * So playing is a state the caller can draw, and it ends three ways: the sound
 * finishes, the caller cancels, or the deadline passes. Whichever happens
 * first, `playing` goes false exactly once and the player is released. A take
 * that never reports finishing must not leave the button stuck.
 *
 * It lives here rather than in the screen so it can be tested without a
 * microphone, a speaker, or a finger.
 */
export function hearOnce(
  uri: string,
  playing: (isPlaying: boolean) => void,
  limitMs = 6000,
): () => void {
  playing(true);

  const player = createAudioPlayer({ uri });
  let closed = false;
  const done = () => {
    if (closed) return;
    closed = true;
    clearTimeout(deadline);
    playing(false);
    player.remove();
  };

  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) done();
  });
  player.play();

  const deadline = setTimeout(done, limitMs);
  return done;
}
