import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pan } from '../stubs/gesture-handler';
import { blankProfile, type DragonProfile, type WordStat } from '@/game/progress';
import { makeWord } from '@/game/words';

/* The dictionary lives in a file and the dragon's voice is a recording; both
   are replaced here so a test can hand the screen an exact situation — this
   word, known this well — rather than whatever happens to be on disk. */
const saveProfile = vi.fn();
let profile: DragonProfile;
let dictionary = [makeWord('dragon')];
let voiced = true;

vi.mock('@/game/storage', () => ({
  loadProfile: () => profile,
  saveProfile: (p: DragonProfile) => saveProfile(p),
  loadDictionary: () => dictionary,
  saveDictionary: vi.fn(),
  hasVoice: () => voiced,
  voiceFile: (word: string) => ({ uri: `file:///${word}.m4a` }),
  keepRecording: vi.fn(),
  forgetRecording: vi.fn(),
}));

vi.mock('@/game/audio', () => ({
  prepare: vi.fn(async () => {}),
  stop: vi.fn(),
  speak: vi.fn(async () => {}),
  sound: (source: string) => ({ play: source }),
}));

const { default: PlayScreen } = await import('@/app/dragon/play');

const stat = (over: Partial<WordStat> = {}): WordStat => ({
  seen: 1,
  mastery: 0.1,
  lastSeenAt: 0,
  last: 'not-yet',
  spoken: 0,
  ...over,
});

/** One round, one word, a grown-up listening — the situation each test wants. */
function situation(word: string, over: Partial<WordStat>) {
  profile = {
    ...blankProfile(),
    stats: { [word]: stat(over) },
    settings: { ...blankProfile().settings, roundsPerMeal: 1, parentCheck: true },
  };
  dictionary = [makeWord(word)];
}

beforeEach(() => {
  voiced = true;
  saveProfile.mockClear();
  situation('dragon', {});
});

describe('putting a roll back together', () => {
  it('draws an empty slot for every slice, so he can see how many go in', () => {
    /* The first version showed a blank space. It told him nothing: not that
       anything went there, not how much, not that he was meant to act. */
    render(<PlayScreen />);
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(2);
  });

  it('fills a slot when he taps a slice', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece drag'));
    expect(screen.getByTestId('slot-full')).toHaveTextContent('drag');
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(1);
  });

  it('lets him take one back instead of wiping the plate for him', () => {
    /* It used to clear itself 700ms after a wrong arrangement, silently. He
       never saw what he had built, so he never saw what was wrong with it. */
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece on'));
    fireEvent.click(screen.getByLabelText('piece drag'));
    expect(screen.queryAllByTestId('slot-empty')).toHaveLength(0);

    fireEvent.click(screen.getByLabelText('the plate'));
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(1);
    expect(screen.getByTestId('slot-full')).toHaveTextContent('on');
  });

  it('says how to undo, once undoing is the only thing left to do', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece on'));
    expect(screen.queryByText(/take one back/i)).toBeNull();
    fireEvent.click(screen.getByLabelText('piece drag'));
    expect(screen.getByText(/take one back/i)).toBeInTheDocument();
  });

  it('cannot be fed until the slices spell the word', () => {
    // a wrong roll is not carryable — there is nothing to pick up
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece on'));
    fireEvent.click(screen.getByLabelText('piece drag'));
    expect(() => pan()).toThrow();
  });

  it('becomes a roll he can carry once it is right', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece drag'));
    fireEvent.click(screen.getByLabelText('piece on'));
    expect(() => pan()).not.toThrow();
  });
});

describe('reading a word cold', () => {
  beforeEach(() => {
    // a word he is good at, with someone there to hear him: read it aloud
    situation('dragon', { seen: 8, mastery: 0.9, spoken: 4, last: 'got' });
  });

  it('asks the grown-up how it went only after he has committed', () => {
    render(<PlayScreen />);
    expect(screen.queryByLabelText('got')).toBeNull();

    act(() => void pan().dragTo(40));
    expect(screen.getByLabelText('got')).toBeInTheDocument();
    expect(screen.getByLabelText('nudge')).toBeInTheDocument();
    expect(screen.getByLabelText('not-yet')).toBeInTheDocument();
  });

  it('does not give the word away before he reads it', () => {
    /* A reading round arrives in silence on purpose — and with no replay
       button, which would otherwise just be a button that says the answer. */
    render(<PlayScreen />);
    expect(screen.queryByLabelText('say it again')).toBeNull();
  });

  it('records the verdict the grown-up tapped', () => {
    render(<PlayScreen />);
    act(() => void pan().dragTo(40));
    fireEvent.click(screen.getByLabelText('nudge'));
    expect(saveProfile).toHaveBeenCalled();
    const saved = saveProfile.mock.calls.at(-1)![0] as DragonProfile;
    expect(saved.stats.dragon.last).toBe('nudge');
  });
});

describe('every round', () => {
  it('has a way out of the game', () => {
    /* There wasn't one. A meal had to be finished or the app killed, which is
       not a thing to hand a five-year-old. */
    render(<PlayScreen />);
    expect(screen.getByLabelText(/back to the front/i)).toBeInTheDocument();
  });

  it('can say the word again, in every round that already said it', () => {
    // an assembly round: he heard the word, and can hear it as often as he likes
    render(<PlayScreen />);
    expect(screen.getByLabelText('say it again')).toBeInTheDocument();
  });
});

describe('a dragon with no voice', () => {
  it('says so, instead of serving rounds he cannot answer', () => {
    voiced = false;
    render(<PlayScreen />);
    expect(screen.getByText(/can.t speak yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/back to the front/i)).toBeInTheDocument();
  });
});
