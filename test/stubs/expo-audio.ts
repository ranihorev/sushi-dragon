import { vi } from 'vitest';

/**
 * The microphone and the speaker, as far as a test is concerned.
 *
 * Neither exists in jsdom, and neither is what these tests are about. What
 * they are about is the state around them: whether the button says it is
 * recording, whether it says it is playing, and whether pressing it twice
 * starts two players. So the recorder and the player are plain objects a test
 * can drive, and `finish()` is the sound ending.
 */
export const RecordingPresets = { HIGH_QUALITY: {} };

export const AudioModule = {
  requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
};

export const setAudioModeAsync = vi.fn(async () => {});

let recording = false;

export const recorder = {
  prepareToRecordAsync: vi.fn(async () => {}),
  record: vi.fn(() => {
    recording = true;
  }),
  stop: vi.fn(async () => {
    recording = false;
  }),
  uri: 'file:///take.m4a',
};

export const useAudioRecorder = () => recorder;
export const useAudioRecorderState = () => ({ isRecording: recording });

type Listener = (status: { didJustFinish: boolean }) => void;

export const players: Array<{ played: boolean; removed: boolean; finish: () => void }> = [];

export const createAudioPlayer = vi.fn(() => {
  const listeners: Listener[] = [];
  const player = {
    played: false,
    removed: false,
    play: () => {
      player.played = true;
    },
    remove: () => {
      player.removed = true;
    },
    addListener: (_event: string, listener: Listener) => {
      listeners.push(listener);
    },
    /** the recording reaching its end, which is the only way it normally stops */
    finish: () => listeners.forEach((l) => l({ didJustFinish: true })),
  };
  players.push(player);
  return player;
});

export function resetAudio() {
  recording = false;
  players.length = 0;
  recorder.uri = 'file:///take.m4a';
}
