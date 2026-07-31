import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAudio } from '../stubs/expo-audio';
import { router } from '../stubs/expo-router';
import type { Word } from '@/game/words';

const saveDictionary = vi.fn();
const keepRecording = vi.fn();
let dictionary: Word[] = [];

vi.mock('@/game/storage', () => ({
  loadDictionary: () => dictionary,
  saveDictionary: (words: Word[]) => saveDictionary(words),
  keepRecording: (word: string, uri: string) => keepRecording(word, uri),
  hasVoice: () => false,
  voiceFile: (word: string) => ({ uri: `file:///${word}.m4a` }),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  forgetRecording: vi.fn(),
}));

const { default: AddWordScreen } = await import('@/app/dragon/add-word');

const type = (word: string) =>
  fireEvent.change(screen.getByPlaceholderText('dragon'), { target: { value: word } });

beforeEach(() => {
  resetAudio();
  dictionary = [];
  saveDictionary.mockClear();
  keepRecording.mockClear();
});

describe('the way in', () => {
  it('says the word is typed first, because the button in was about recording', () => {
    /* The entry point promised recording and the first thing that happened was
       a keyboard, which reads as the wrong screen until you know that saying
       it is step three. */
    render(<AddWordScreen />);
    expect(screen.getByText(/type it, check where it gets cut/i)).toBeInTheDocument();
    expect(screen.getByText(/1 · the word/i)).toBeInTheDocument();

    type('dragon');
    expect(screen.getByText(/3 · say it/i)).toBeInTheDocument();
  });

  it('has a way back out for someone who only came to look', () => {
    render(<AddWordScreen />);
    fireEvent.click(screen.getByText('‹ back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows nothing but the box until there is a word in it', () => {
    render(<AddWordScreen />);
    expect(screen.queryByLabelText('hold to record')).toBeNull();
    type('dragon');
    expect(screen.getByLabelText('hold to record')).toBeInTheDocument();
  });
});

describe('saving a word', () => {
  it('stores the word cut into the pieces he can read', () => {
    render(<AddWordScreen />);
    type('dragon');
    fireEvent.click(screen.getByText(/add to the dictionary/i));

    const saved = saveDictionary.mock.calls.at(-1)?.[0] as Word[];
    expect(saved.map((w) => w.text)).toContain('dragon');
    expect(saved.find((w) => w.text === 'dragon')?.chunks).toEqual(['drag', 'on']);
    expect(router.back).toHaveBeenCalled();
  });

  it('brings the rest of the family along', () => {
    // one word he tripped on is a pattern he does not own yet
    render(<AddWordScreen />);
    type('night');
    fireEvent.click(screen.getByText(/add to the dictionary/i));

    const saved = saveDictionary.mock.calls.at(-1)?.[0] as Word[];
    expect(saved.map((w) => w.text)).toContain('light');
    expect(saved.map((w) => w.text)).toContain('right');
  });
});
