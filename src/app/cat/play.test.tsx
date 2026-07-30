import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pan, tap } from '../../../test/stubs/gesture-handler';
import type { Letter } from '@/cat/letters';
import { blankProfile } from '@/cat/store';
import type { Profile, Round } from '@/cat/types';

/* A fixed round, because a test cannot assert anything about "the right piece"
   until it knows which one that is. */
const ROUND: Round = { kind: 'sound', target: 'M', options: ['M', 'T'] };

const say = vi.fn(async () => {});
const saveProfile = vi.fn();
let profile: Profile;

vi.mock('@/cat/audio', () => ({
  say: (...args: unknown[]) => say(...(args as [])),
  stop: vi.fn(),
  tap: vi.fn(),
  chomp: vi.fn(),
  happy: vi.fn(),
  puzzled: vi.fn(),
  sparkle: vi.fn(),
}));

vi.mock('@/cat/engine', async () => {
  const real = await vi.importActual<typeof import('@/cat/engine')>('@/cat/engine');
  return { ...real, nextRound: () => ROUND };
});

vi.mock('@/cat/store', async () => {
  const real = await vi.importActual<typeof import('@/cat/store')>('@/cat/store');
  return { ...real, loadProfile: () => profile, saveProfile: (p: Profile) => saveProfile(p) };
});

const { default: CatPlayScreen } = await import('./play');

/** The cat's chin is unmeasurable in a test, so the screen keeps its default. */
const ABOVE_THE_CAT = 40;

/** Wait out the lead-in before the first question, which is what unlocks the sushi. */
async function opening() {
  render(<CatPlayScreen />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

/** Carry the given letter up to the cat. */
async function feed(letter: Letter) {
  const index = ROUND.options.indexOf(letter);
  await act(async () => {
    pan(index).dragTo(ABOVE_THE_CAT);
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  say.mockClear();
  saveProfile.mockClear();
  profile = { ...blankProfile(), level: 1, activeSet: ['M', 'T', 'S', 'A'] };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the sushi is not live until the question has been asked', () => {
  it('ignores a piece carried up before the cat has spoken', () => {
    /* He taps and drags at everything the moment the screen appears. Feeding
       the cat before it has asked anything would score a round he never heard. */
    render(<CatPlayScreen />);
    expect(pan(0).enabled).toBe(false);
  });

  it('comes alive once the question has been asked', async () => {
    await opening();
    expect(pan(0).enabled).toBe(true);
  });
});

describe('getting it wrong', () => {
  it('does not point at the answer on a first miss', async () => {
    // one wrong go is thinking; the game should let him have it
    await opening();
    await feed('T');
    expect(screen.queryByTestId('ringed-M')).toBeNull();
  });

  it('rings the right piece on a second miss', async () => {
    /* This is the rescue, and in the build he played it did nothing at all: it
       was drawn as a shadow on a view with no background, which iOS declines
       to render. Whether a ring is *visible* is still not something a test can
       see — what is nailed down here is that the game marks the right piece. */
    await opening();
    await feed('T');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await feed('T');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId('ringed-M')).toBeInTheDocument();
    expect(screen.getByTestId('piece-T')).toBeInTheDocument();
  });

  it('takes nothing away for a wrong answer', async () => {
    // it is recorded as a confusion, never as a mark against him
    await opening();
    await feed('T');
    const saved = saveProfile.mock.calls.at(-1)![0] as Profile;
    expect(saved.confusions.M?.T).toBe(1);
    expect(saved.letterStats.M?.seen ?? 0).toBe(0);
  });
});

describe('getting it right', () => {
  it('takes the piece off the counter and records it', async () => {
    await opening();
    await feed('M');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    const saved = saveProfile.mock.calls.at(-1)![0] as Profile;
    expect(saved.letterStats.M?.correct).toBe(1);
  });
});

describe('a child who taps instead of dragging', () => {
  it('gets the question again rather than silence', async () => {
    /* Tapping was the first thing he tried and nothing happened. A tap is a
       fair way to say "I did not catch that", so it is answered as one. */
    await opening();
    say.mockClear();
    await act(async () => {
      tap(0).end();
    });
    expect(say).toHaveBeenCalled();
  });
});

describe('the cat game', () => {
  it('has a way out', async () => {
    await opening();
    expect(screen.getByLabelText(/back to the front/i)).toBeInTheDocument();
  });

  it('can be asked to say it again', async () => {
    await opening();
    expect(screen.getByLabelText('say it again')).toBeInTheDocument();
  });
});
