import { act, fireEvent, render, screen } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { blankProfile, type DragonProfile } from '@/game/progress';
import { makeWord, type Word } from '@/game/words';
import { pan, resetGestures } from '../stubs/gesture-handler';

let words: Word[] = [];
let profile: DragonProfile;
const saved = vi.fn();
const forgot = vi.fn();

vi.mock('@/game/storage', () => ({
  loadProfile: () => profile,
  saveProfile: vi.fn(),
  loadDictionary: () => words,
  saveDictionary: (next: Word[]) => saved(next),
  hasVoice: () => false,
  voiceFile: (w: string) => ({ uri: `file:///${w}.m4a` }),
  forgetRecording: (w: string) => forgot(w),
  exportAll: () => '{}',
  importAll: vi.fn(),
}));

vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-sharing', () => ({ shareAsync: vi.fn() }));
vi.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));

const { default: ParentScreen } = await import('@/app/dragon/parent');

/** The confirmation is a native alert; press its buttons by hand. */
function pressed(label: string) {
  const call = vi.mocked(Alert.alert).mock.calls.at(-1);
  const button = (call?.[2] as { text: string; onPress?: () => void }[]).find(
    (b) => b.text === label,
  );
  act(() => button?.onPress?.());
}

/** Drag the nth row sideways by `by` points and let go. */
function swipe(row: number, by: number) {
  const it = pan(row);
  act(() => {
    it.start();
    it.update({ translationX: by });
    it.end({ translationX: by });
  });
}

beforeEach(() => {
  resetGestures();
  words = [makeWord('have'), makeWord('sushi')];
  profile = blankProfile();
  saved.mockClear();
  forgot.mockClear();
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('taking a word off the list', () => {
  /* There was already a way to do this: hold the row down for a second. Nobody
     found it — the only mention of it was a line of small print at the bottom
     of the screen, under the backup buttons. */
  it('offers a button on the word itself', () => {
    render(<ParentScreen />);
    expect(screen.getByLabelText('remove have')).toBeInTheDocument();
    expect(screen.getByLabelText('remove sushi')).toBeInTheDocument();
  });

  it('asks first, because the recording goes with it', () => {
    render(<ParentScreen />);
    fireEvent.click(screen.getByLabelText('remove have'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });

  it('drops the word and its recording once that is confirmed', () => {
    render(<ParentScreen />);
    fireEvent.click(screen.getByLabelText('remove have'));
    pressed('Remove');

    expect(forgot).toHaveBeenCalledWith('have');
    expect(saved.mock.calls.at(-1)![0].map((w: Word) => w.text)).toEqual(['sushi']);
    expect(screen.queryByLabelText('remove have')).toBeNull();
  });

  it('keeps it if that is what the grown-up says', () => {
    render(<ParentScreen />);
    fireEvent.click(screen.getByLabelText('remove have'));
    pressed('Keep it');

    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('remove have')).toBeInTheDocument();
  });
});

describe('pushing a word off the list', () => {
  it('asks the same question the button asks', () => {
    render(<ParentScreen />);
    swipe(0, -120);

    expect(Alert.alert).toHaveBeenCalled();
    expect(String(vi.mocked(Alert.alert).mock.calls.at(-1)![0])).toMatch(/have/);
    expect(saved).not.toHaveBeenCalled();
  });

  it('removes the word once that is confirmed', () => {
    render(<ParentScreen />);
    swipe(1, -120);
    pressed('Remove');

    expect(forgot).toHaveBeenCalledWith('sushi');
    expect(screen.queryByLabelText('remove sushi')).toBeNull();
  });

  /* A list that lives inside a scroll view gets nudged sideways all day. A nudge
     must not put a question on the screen. */
  it('ignores a nudge', () => {
    render(<ParentScreen />);
    swipe(0, -30);

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('ignores a swipe the other way', () => {
    render(<ParentScreen />);
    swipe(0, 140);

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('the settings', () => {
  it('say what they do to the game, not what the grown-up is doing', () => {
    /* They were called "I sit with him and tap how it went" and "Words per
       meal", neither of which says which rounds appear or disappear. */
    render(<ParentScreen />);
    expect(screen.getByText(/reads aloud/i)).toBeInTheDocument();
    expect(screen.getByText(/he reads it to you/i)).toBeInTheDocument();
    expect(screen.getByText(/before it is full/i)).toBeInTheDocument();
  });

  it('describes what turning the read-aloud rounds off would do', () => {
    profile = {
      ...blankProfile(),
      settings: { ...blankProfile().settings, parentCheck: false },
    };
    render(<ParentScreen />);
    expect(screen.getByText(/he can play alone/i)).toBeInTheDocument();
  });
});
