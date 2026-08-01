import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { router, stackedOn } from '../stubs/expo-router';
import { leave } from '@/leaving';
import type { Word } from '@/game/words';

vi.mock('@/game/storage', () => ({
  loadDictionary: (): Word[] => [],
  saveDictionary: vi.fn(),
  keepRecording: vi.fn(),
  hasVoice: () => false,
  voiceFile: (word: string) => ({ uri: `file:///${word}.m4a` }),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  forgetRecording: vi.fn(),
}));

const { default: AddWordScreen } = await import('@/app/dragon/add-word');

beforeEach(() => {
  router.back.mockClear();
  router.replace.mockClear();
  stackedOn(1);
});

/**
 * The back arrow, on a screen that was opened from nowhere.
 *
 * `router.back()` on the bottom of the stack does nothing and says so only in
 * the log — "The action 'GO_BACK' was not handled by any navigator" — which
 * leaves whoever pressed it on a screen with no exit.
 */
describe('leaving a grown-ups’ screen', () => {
  it('goes back when there is something behind it', () => {
    leave();
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('goes to the game when there is not', () => {
    stackedOn(0);
    leave();
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('gets the word list off the bottom of the stack', () => {
    // reloaded on this screen, or opened by a link: the arrow must still work
    stackedOn(0);
    render(<AddWordScreen />);
    fireEvent.click(screen.getByText('‹ back'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('lands on the game after saving a word from the bottom of the stack', () => {
    stackedOn(0);
    render(<AddWordScreen />);
    fireEvent.change(screen.getByPlaceholderText('dragon'), { target: { value: 'dragon' } });
    fireEvent.click(screen.getByText(/add to the dictionary/i));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
