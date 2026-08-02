import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pan, tap } from '../stubs/gesture-handler';
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

/* The clips the app ships with. Real ones are bundled assets, which a test
   cannot tell apart from each other, so they are named here instead: `recorded`
   means the dragon's own voice, and its absence means the iPad has to read the
   word itself. */
let recorded = true;

vi.mock('@/game/voices', () => ({
  wordClip: (text: string) => (recorded ? `clip:${text}` : undefined),
  phraseClip: (text: string) => (recorded ? `clip:${text}` : undefined),
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

/**
 * Let time pass in steps rather than in one go.
 *
 * A round schedules the next round, which schedules the question after it, so
 * the timers are a chain and not a list. One long `act` runs the first link and
 * only then flushes React — by which time the second link is being scheduled
 * from a moment that has already gone past.
 */
async function settle(ms: number, step = 300) {
  for (let waited = 0; waited < ms; waited += step) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, step));
    });
  }
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
  recorded = true;
  saveProfile.mockClear();
  spoke.mockClear();
  situation('dragon', {});
});

/**
 * Which gesture belongs to which piece.
 *
 * The pieces on the counter are carried now, not tapped, so they are gestures
 * rather than buttons — and the gestures are numbered in the order they were
 * mounted, which is the order the pieces are drawn in. The slices arrive
 * shuffled, so the number has to be looked up rather than assumed.
 */
function pieceAt(label: string) {
  const on = [...document.querySelectorAll('[aria-label^="piece "]')];
  const found = on.findIndex((el) => el.getAttribute('aria-label') === label);
  if (found < 0) throw new Error(`no “${label}” on the counter`);
  return found;
}

/** Put a slice on the plate the short way. */
const tapPiece = (label: string) => act(() => void tap(pieceAt(label)).end());

/** And the way the rest of the game works: pick it up and carry it there. */
const dragPiece = (label: string) => act(() => void pan(pieceAt(label)).dragTo(60));

describe('putting a roll back together', () => {
  it('draws an empty slot for every slice, so he can see how many go in', () => {
    /* The first version showed a blank space. It told him nothing: not that
       anything went there, not how much, not that he was meant to act. */
    render(<PlayScreen />);
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(2);
  });

  it('fills a slot when he taps a slice', () => {
    render(<PlayScreen />);
    tapPiece('piece drag');
    expect(screen.getByTestId('slot-full')).toHaveTextContent('drag');
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(1);
  });

  /* Every other piece of food in this game is dragged. The one round that could
     only be tapped looked broken to a child who tried what the rest of the game
     had taught him — he dragged a slice at the plate and it sprang back. */
  it('fills a slot when he carries a slice up to the plate', () => {
    render(<PlayScreen />);
    dragPiece('piece drag');
    expect(screen.getByTestId('slot-full')).toHaveTextContent('drag');
  });

  it('lets him take one back instead of wiping the plate for him', () => {
    /* It used to clear itself 700ms after a wrong arrangement, silently. He
       never saw what he had built, so he never saw what was wrong with it. */
    render(<PlayScreen />);
    tapPiece('piece on');
    tapPiece('piece drag');
    expect(screen.queryAllByTestId('slot-empty')).toHaveLength(0);

    fireEvent.click(screen.getByLabelText('the plate'));
    expect(screen.getAllByTestId('slot-empty')).toHaveLength(1);
    expect(screen.getByTestId('slot-full')).toHaveTextContent('on');
  });

  it('says how to undo, once undoing is the only thing left to do', () => {
    render(<PlayScreen />);
    tapPiece('piece on');
    expect(screen.queryByText(/take one back/i)).toBeNull();
    tapPiece('piece drag');
    expect(screen.getByText(/take one back/i)).toBeInTheDocument();
  });

  it('cannot be fed until the slices spell the word', () => {
    // a wrong roll is not carryable — there is nothing to pick up
    render(<PlayScreen />);
    tapPiece('piece on');
    tapPiece('piece drag');
    expect(screen.queryByLabelText(/^the roll/)).toBeNull();
  });

  it('becomes a roll he can carry once it is right', () => {
    render(<PlayScreen />);
    tapPiece('piece drag');
    tapPiece('piece on');
    expect(screen.getByLabelText('the roll dragon')).toBeInTheDocument();
  });

  /* The round is two jobs and the second one was invisible: the pieces became a
     roll on the plate and nothing said it was now his to carry. */
  it('says out loud that it is finished and wants feeding', () => {
    render(<PlayScreen />);
    tapPiece('piece drag');
    spoke.mockClear();
    tapPiece('piece on');

    const said = spoke.mock.calls.flat(2) as { play?: string; say?: string }[];
    expect(said.some((b) => `${b?.play ?? ''}${b?.say ?? ''}`.match(/feed it to me/i))).toBe(
      true,
    );
    expect(screen.getByText(/drag it up to the dragon/i)).toBeInTheDocument();
  });
});

describe('choosing between words', () => {
  /* A word he has met but does not hold yet: the dragon says one, and three
     sushi are on the counter. */
  beforeEach(() => situation('have', { seen: 2, recent: ['not-yet'] }));

  it('puts three on the counter, whatever he knows', () => {
    /* It used to widen from two to four. Two is a coin toss he wins half the
       time without reading anything. */
    render(<PlayScreen />);
    expect(screen.getAllByLabelText(/piece /)).toHaveLength(3);
  });

  it('marks no letter green, because only the answer would have one', () => {
    /* `have` is the only word here whose letters lie, so the dab of wasabi sat
       on the right sushi and no other — the answer, in green, before he had
       read a letter of any of them. */
    render(<PlayScreen />);
    expect(screen.queryAllByTestId('lying-letter')).toHaveLength(0);
  });

  it('still marks it while the word is being introduced', () => {
    // there, and only there, a line underneath says what the mark means
    situation('have', { seen: 0, recent: [] });
    render(<PlayScreen />);
    expect(screen.getAllByTestId('lying-letter').length).toBeGreaterThan(0);
  });
});

describe('the dragon eating', () => {
  it('keeps the piece on screen long enough to be swallowed', () => {
    /* It used to blink out of existence the instant he let go, which never
       looked like it had been eaten by anything. */
    situation('have', { seen: 0, recent: [] });
    render(<PlayScreen />);
    act(() => void pan().dragTo(40));
    expect(screen.getByLabelText('piece have')).toBeInTheDocument();
  });

  it('takes it off the counter once it is down', async () => {
    situation('have', { seen: 0, recent: [] });
    render(<PlayScreen />);
    act(() => void pan().dragTo(40));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(screen.queryByLabelText('piece have')).toBeNull();
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

describe('which voice says the word', () => {
  /* Three of them, worth different amounts to him. Yours, recorded on this
     iPad. The dragon's own, recorded before the app was built. And the iPad
     reading it, which is what a word typed in last night gets. It used to say
     "the dragon can't speak yet" and refuse to play at all until a grown-up had
     sat down with a microphone. */
  it('plays with nothing recorded at all', () => {
    voiced = false;
    recorded = false;
    render(<PlayScreen />);

    expect(screen.queryByText(/can.t speak/i)).toBeNull();
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
  });

  it('has the iPad read the question and the word as one line', async () => {
    /* Half a sentence in a recorded voice and the other half in the iPad's is
       two people finishing each other's sentence, which is worse than either. */
    voiced = false;
    recorded = false;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);

    const beats = await asked();
    expect(beats.some((b) => b?.say?.endsWith('dragon'))).toBe(true);
    expect(beats.some((b) => b?.play)).toBe(false);
  });

  it('plays the dragon’s own voice as two clips, question then word', async () => {
    voiced = false;
    recorded = true;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);

    const beats = await asked();
    expect(beats.some((b) => b?.play === 'clip:dragon')).toBe(true);
    expect(beats.some((b) => b?.play?.startsWith('clip:') && b.play !== 'clip:dragon')).toBe(true);
    expect(beats.some((b) => b?.say)).toBe(false);
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

describe('the dragon saying hello', () => {
  /* The game used to open by demanding a word, which is a game that opened in
     the middle of itself. */
  it('greets whoever has just sat down, before the first question', async () => {
    voiced = false;
    recorded = false;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);

    const beats = await asked();
    expect(beats[0]?.say).toMatch(/hello|there you are/i);
    expect(beats.some((b) => b?.say?.endsWith('dragon'))).toBe(true);
  });

  it('does not say it again in the middle of a meal', async () => {
    voiced = false;
    recorded = false;
    // two rounds of one word he has never met: one piece on the counter each time
    profile = {
      ...blankProfile(),
      introSeen: true,
      stats: {},
      settings: { ...blankProfile().settings, roundsPerMeal: 2, parentCheck: true },
    };
    dictionary = [makeWord('have')];
    render(<PlayScreen />);
    await asked();

    spoke.mockClear();
    act(() => void pan().dragTo(40));
    await settle(2500);

    const beats = spoke.mock.calls.flat(2) as { play?: string; say?: string }[];
    expect(beats.some((b) => b?.say?.match(/hello|there you are/i))).toBe(false);
    expect(beats.some((b) => b?.say?.endsWith('have'))).toBe(true);
  });
});

describe('the way the dragon words its question', () => {
  it('does not ask for the second word the way it asked for the first', async () => {
    /* "A new word. This one says …" arrived twice a meal, every meal, in the
       same eight words. A sentence he can predict is one he stops listening to,
       and the word is on the end of it. */
    voiced = false;
    recorded = false;
    situation('dragon', { seen: 2, recent: ['got'] });
    render(<PlayScreen />);
    const first = (await asked()).find((b) => b?.say)?.say;

    // the wording rotates with the meal, so the next meal opens differently
    spoke.mockClear();
    profile = { ...profile, mealsCompleted: profile.mealsCompleted + 1 };
    render(<PlayScreen />);
    const second = (await asked()).find((b) => b?.say)?.say;

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
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
    tapPiece('piece drag');
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

    expect(screen.getByLabelText('start playing')).toBeInTheDocument();
    expect(screen.queryByLabelText('the plate')).toBeNull();

    fireEvent.click(screen.getByLabelText('start playing'));
    expect(screen.getByLabelText('the plate')).toBeInTheDocument();
    expect((saveProfile.mock.calls.at(-1)![0] as DragonProfile).introSeen).toBe(true);
  });

  it('never shows it again', () => {
    render(<PlayScreen />);
    expect(screen.queryByLabelText('start playing')).toBeNull();
  });

  it('says what to do in the round he is in', () => {
    render(<PlayScreen />);
    expect(screen.getByText(/put the pieces in order/i)).toBeInTheDocument();

    situation('dragon', { seen: 8, recent: ['got', 'got', 'got', 'got'], spoken: 4 });
    render(<PlayScreen />);
    expect(screen.getByText(/read it out loud/i)).toBeInTheDocument();
  });

  it('names the green letter, and says it in plain words', () => {
    /* The mark is the most useful thing the game knows about a word like
       `have`, and it was explained in phonics notation — `the “e” says /u/` —
       which is unreadable to a parent who has never taught reading. */
    profile = { ...blankProfile(), introSeen: true, stats: {} };
    dictionary = [makeWord('come')];
    render(<PlayScreen />);

    expect(screen.getByText(/the green “o”/i)).toBeInTheDocument();
    expect(screen.getByText(/like the u in cup/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/u\//)).toBeNull();
  });

  it('does not explain a word with nothing odd about it', () => {
    profile = { ...blankProfile(), introSeen: true, stats: {} };
    dictionary = [makeWord('dragon')];
    render(<PlayScreen />);

    expect(screen.queryByText(/the green/i)).toBeNull();
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
