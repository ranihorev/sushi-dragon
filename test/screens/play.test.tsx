import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pan } from '../stubs/gesture-handler';
import { refocus, router } from '../stubs/expo-router';
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

const spoke = vi.fn();

vi.mock('@/game/audio', () => ({
  prepare: vi.fn(async () => {}),
  stop: vi.fn(),
  speak: vi.fn(async (beats: unknown[]) => spoke(beats)),
  sound: (source: string) => ({ play: source }),
  said: (text: string) => ({ say: text }),
}));

const { default: PlayScreen } = await import('@/app/index');

const stat = (over: Partial<WordStat> = {}): WordStat => ({
  seen: 1,
  recent: ['not-yet'],
  lastSeenAt: 0,
  last: 'not-yet',
  spoken: 0,
  ...over,
});

/**
 * Everything the screen has said by the time the question has been asked.
 *
 * The question is deliberately a beat behind the round appearing — a prompt
 * that arrives on top of the last one is the fault this game's audio exists to
 * avoid — so a test that looks straight after rendering sees silence.
 */
async function asked(): Promise<{ play?: string; say?: string }[]> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
  return spoke.mock.calls.flat(2) as { play?: string; say?: string }[];
}

/** One round, one word, a grown-up listening — the situation each test wants. */
function situation(word: string, over: Partial<WordStat>) {
  profile = {
    ...blankProfile(),
    // the how-it-works card is a first-launch thing; these tests are past it
    introSeen: true,
    stats: { [word]: stat(over) },
    settings: { ...blankProfile().settings, roundsPerMeal: 1, parentCheck: true },
  };
  dictionary = [makeWord(word)];
}

beforeEach(() => {
  voiced = true;
  saveProfile.mockClear();
  spoke.mockClear();
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
    situation('dragon', { seen: 8, recent: ['got', 'got', 'got', 'got'], spoken: 4, last: 'got' });
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

describe('the front page', () => {
  /* There used to be a title screen in front of the game with one thing on
     it: a dragon to tap. It made sense while there were two games to choose
     between, and once there was one it was a tap and a wait between him and
     the thing he opened the app for. */
  it('is the game, not a door in front of it', () => {
    render(<PlayScreen />);
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
    expect(screen.queryByLabelText('feed the dragon')).toBeNull();
  });

  it('is where the way out puts him, without leaving the screen', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText(/back to the front/i));

    expect(screen.getByLabelText('feed the dragon')).toBeInTheDocument();
    expect(screen.queryByLabelText('the plate')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('serves another meal when the dragon is asked for one', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText(/back to the front/i));
    fireEvent.click(screen.getByLabelText('feed the dragon'));
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
  });

  it('shows him the words he can read, once he can read any', () => {
    /* The score has always known this list; nothing ever showed it to him. It
       is the only reward in the game made of the thing being learnt. */
    situation('dragon', { seen: 9, recent: ['got', 'got', 'got', 'got'], spoken: 4, last: 'got' });
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText(/back to the front/i));

    expect(screen.getByText(/1 word he can read/i)).toBeInTheDocument();
    expect(screen.getByLabelText('his word dragon')).toBeInTheDocument();
  });

  it('has no empty shelf to explain when he has not earned one yet', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText(/back to the front/i));
    expect(screen.queryByText(/he can read/i)).toBeNull();
  });

  it('is the only place the grown-ups entrance appears', () => {
    // never on a screen where something is being dragged around
    render(<PlayScreen />);
    expect(screen.queryByLabelText('grown-ups')).toBeNull();

    fireEvent.click(screen.getByLabelText(/back to the front/i));
    expect(screen.getByLabelText('grown-ups')).toBeInTheDocument();
  });
});

describe('a dragon nobody has recorded a voice for', () => {
  /* It used to say "the dragon can't speak yet" and refuse to play until a
     grown-up had sat down and recorded something. A brand new app, opened by a
     child, showed him a paragraph he could not read. The iPad has a voice; the
     recording is the upgrade, not the entry fee. */
  it('plays anyway, in the iPad’s own voice', () => {
    voiced = false;
    render(<PlayScreen />);

    expect(screen.queryByText(/can.t speak/i)).toBeNull();
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
  });

  it('asks the whole question out loud, since it is one voice throughout', async () => {
    voiced = false;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);

    const beats = await asked();
    expect(beats.some((b) => b?.say?.includes('dragon'))).toBe(true);
  });

  it('uses your recording where there is one, and says nothing else over it', async () => {
    voiced = true;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);

    const beats = await asked();
    expect(beats.some((b) => b?.play === 'file:///dragon.m4a')).toBe(true);
    expect(beats.some((b) => b?.say)).toBe(false);
  });
});

describe('coming back from the grown-ups’ side', () => {
  it('deals the meal again, so words added while away are in it', () => {
    dictionary = [makeWord('dragon')];
    render(<PlayScreen />);

    dictionary = [makeWord('rabbit')];
    profile = { ...profile, stats: { rabbit: stat({ seen: 1 }) } };
    act(() => refocus());

    expect(screen.getByLabelText('piece rab')).toBeInTheDocument();
  });

  it('leaves a meal in progress alone when nothing has changed', () => {
    // coming back from the word list must not wipe the plate he was filling
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText('piece drag'));
    expect(screen.getByTestId('slot-full')).toHaveTextContent('drag');

    act(() => refocus());
    expect(screen.getByTestId('slot-full')).toHaveTextContent('drag');
  });
});

describe('saying what the game wants', () => {
  /* The rules were only ever in the spoken prompt, which says the word and not
     what to do with it — and in a reading round says nothing at all. */
  it('tells the grown-up how it works, once, before the first meal', () => {
    profile = { ...profile, introSeen: false };
    render(<PlayScreen />);

    expect(screen.getByText(/feed the dragon words/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('the plate')).toBeNull();

    fireEvent.click(screen.getByLabelText('start playing'));
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
    expect((saveProfile.mock.calls.at(-1)![0] as DragonProfile).introSeen).toBe(true);
  });

  it('never shows it again', () => {
    render(<PlayScreen />);
    expect(screen.queryByText(/feed the dragon words/i)).toBeNull();
  });

  it('says what to do in the round he is in', () => {
    render(<PlayScreen />);
    expect(screen.getByText(/put the pieces in order/i)).toBeInTheDocument();

    situation('dragon', { seen: 8, recent: ['got', 'got', 'got', 'got'], spoken: 4 });
    render(<PlayScreen />);
    expect(screen.getByText(/read it out loud/i)).toBeInTheDocument();
  });

  it('says what the green letter is doing, while the word is being introduced', () => {
    /* The mark is the most useful thing the game knows about a word like
       `have`, and the sentence explaining it sat unread in the word list. */
    profile = { ...blankProfile(), introSeen: true, stats: {} };
    dictionary = [makeWord('have')];
    render(<PlayScreen />);

    expect(screen.getByText(/the “e” does nothing/i)).toBeInTheDocument();
  });

  it('does not explain a word with nothing odd about it', () => {
    profile = { ...blankProfile(), introSeen: true, stats: {} };
    dictionary = [makeWord('dragon')];
    render(<PlayScreen />);

    expect(screen.queryByText(/^the “/)).toBeNull();
  });

  it('labels the three buttons as a question for the grown-up', () => {
    situation('dragon', { seen: 8, recent: ['got', 'got', 'got', 'got'], spoken: 4 });
    render(<PlayScreen />);
    act(() => void pan().dragTo(40));

    expect(screen.getByText(/how did he read it/i)).toBeInTheDocument();
  });

  it('says how to start, because a dragon is not obviously a button', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByLabelText(/back to the front/i));
    expect(screen.getByText(/tap the dragon/i)).toBeInTheDocument();
  });
});
