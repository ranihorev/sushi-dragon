import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Carry } from '@/components/Carry';
import { Dragon, type Mood } from '@/components/Dragon';
import { HomeButton } from '@/components/HomeButton';
import { Sushi } from '@/components/Sushi';
import * as audio from '@/game/audio';
import { isCorrectPick, planMeal, type Round, type RoundKind } from '@/game/engine';
import { hoard, noteSession, recordPick, recordRead, type Verdict } from '@/game/progress';
import * as store from '@/game/storage';
import type { Word } from '@/game/words';
import { CREAM, LANTERN, NIGHT, RICE, SEAM, WASABI, WOOD, WOOD_DARK } from '@/theme';

/* The two noises the game makes that are not words: a bite as the dragon takes
   a piece, and two notes at the end of a meal. Everything else he hears is
   language, which is the point — but a game that answers a correct answer with
   nothing but the next question does not feel like a game. */
import CHEER from '../../assets/audio/cheer.m4a';
import MUNCH from '../../assets/audio/munch.m4a';

/* Pacing, inherited from the letter game, where the thing that made it hard to
   follow was never a missing sound but two sounds arriving on top of one
   another. These gaps are longer than they look like they should be. */
const ASK_LEAD_MS = 450;
const ROUND_GAP_MS = 1400;
const RETRY_GAP_MS = 500;
const SEAR_MS = 900;

/**
 * The game, and the only screen the app opens on.
 *
 * There used to be a door in front of this: a title screen with the dragon on
 * it, waiting to be tapped. It made sense while there were two games to choose
 * between. With one, it is a screen whose only content is the answer to a
 * question nobody is being asked, and it cost him a tap and a wait every time
 * he wanted to play the game he opened.
 *
 * So the app opens mid-meal, and the door has moved to the end, where there is
 * something to say: the dragon is full, that was a meal, and here is how to
 * ask for another. That resting state is also where the grown-ups' entrance
 * lives, one deliberate tap away from the game and out of the way of a child
 * who is dragging sushi around.
 */
export default function PlayScreen() {
  const [profile, setProfile] = useState(() => store.loadProfile());
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [meal, setMeal] = useState<Round[]>(() =>
    planMeal(store.loadProfile(), store.loadDictionary()),
  );
  /* Bumped on every fresh meal. The round intro below keys off it as well as
     the round number, because starting a second meal moves neither. */
  const [served, setServed] = useState(0);
  const [at, setAt] = useState(0);
  const [resting, setResting] = useState(false);
  /** resting because the meal is over, rather than because he asked to stop */
  const [finished, setFinished] = useState(false);
  const round = meal[at];

  const [mood, setMood] = useState<Mood>('idle');
  const [searing, setSearing] = useState(false);
  const [eaten, setEaten] = useState<string[]>([]);
  const [plate, setPlate] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);
  const [awaitingCheck, setAwaitingCheck] = useState(false);
  /** bottom of the dragon on screen — everything above it is the drop zone */
  const [dropLine, setDropLine] = useState(320);

  /* What the focus effect below needs to know, without it having to re-run
     every time one of them changes. */
  const alive = useRef({ resting });
  alive.current = { resting };

  /** The word list the meal on screen was dealt from, to notice a new one. */
  const dealtFrom = useRef('');

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    void audio.prepare();
    // the day counter only means anything if something marks the days
    const noted = noteSession(profileRef.current);
    if (noted !== profileRef.current) {
      store.saveProfile(noted);
      setProfile(noted);
    }
    return () => {
      timers.current.forEach(clearTimeout);
      audio.stop();
    };
  }, []);

  /**
   * The dragon saying a word.
   *
   * Your recording if there is one, and the iPad's own voice if there is not.
   * It used to be the recording or nothing, which meant a brand new app could
   * not ask him to listen to anything at all — every round fell back to reading
   * a word off a card in silence, and the game arrived looking like a flashcard
   * that had lost its instructions.
   */
  const voiceOf = useCallback(
    (word: Word) =>
      store.hasVoice(word.text)
        ? audio.sound(store.voiceFile(word.text).uri)
        : audio.said(word.text),
    [],
  );

  const say = useCallback(
    (word: Word, lead: number[] = []) => audio.speak([...lead, voiceOf(word)]),
    [voiceOf],
  );

  /** The dragon eating, and then telling him what he just fed it. */
  const swallow = useCallback(
    (word: Word) => audio.speak([audio.sound(MUNCH), 240, voiceOf(word)]),
    [voiceOf],
  );

  /**
   * The question, out loud.
   *
   * With no recording the whole thing is one sentence in one voice, which is
   * plainer than a bare word for a child who does not yet know what the game
   * wants. Where you have recorded the word, your voice says it alone — the
   * point of the recording is that it is yours, and a synthetic voice reading
   * an instruction over the top of it spoils that.
   */
  const ask = useCallback(
    (round: Round, lead: number[] = []) => {
      if (store.hasVoice(round.word.text)) return say(round.word, lead);
      const question =
        round.kind === 'meet'
          ? `A new word. This one says ${round.word.text}`
          : round.kind === 'order'
            ? `Build the word ${round.word.text}`
            : `Which one says ${round.word.text}?`;
      return audio.speak([...lead, audio.said(question)]);
    },
    [say],
  );

  useEffect(() => {
    if (!round || resting) return;
    setPlate([]);
    setEaten([]);
    setMissed(false);
    setAwaitingCheck(false);
    setMood('idle');

    if (round.kind === 'meet') {
      setSearing(true);
      after(SEAR_MS, () => {
        setSearing(false);
        void ask(round);
      });
      return;
    }

    /* A reading round arrives in silence on purpose: nothing tells him the
       word until he has committed to it. */
    if (round.kind === 'read') return;

    after(ASK_LEAD_MS, () => void ask(round));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, served, resting]);

  /** Put the dragon down, mid-meal or at the end of one. */
  const rest = useCallback(() => {
    timers.current.forEach(clearTimeout);
    audio.stop();
    setAwaitingCheck(false);
    setResting(true);
  }, []);

  /** Deal a fresh meal from the word list as it stands right now. */
  const plan = useCallback((from: typeof profile, dictionary: Word[]) => {
    dealtFrom.current = dictionary.map((w) => w.text).join(' ');
    setMeal(planMeal(from, dictionary));
    setAt(0);
    setServed((n) => n + 1);
  }, []);

  /** Another meal, chosen fresh — his word list has moved on since this one. */
  const serve = useCallback(() => {
    const dictionary = store.loadDictionary();
    const from = store.loadProfile();
    setProfile(from);
    plan(from, dictionary);
    setFinished(false);
    setResting(false);
  }, [plan]);

  /** The grown-up has read how it works. Never ask again. */
  const start = useCallback(() => {
    const seen = { ...profileRef.current, introSeen: true };
    store.saveProfile(seen);
    setProfile(seen);
  }, []);

  /**
   * Coming back from the grown-ups' side, where words and recordings are made.
   *
   * This screen never unmounts while the parent screens sit on top of it, so
   * nothing it read at startup refreshes by itself. Without this you could add
   * three words, come back, and find a meal that could not contain any of them
   * — the commonest thing a grown-up does in this app, followed by no visible
   * effect at all.
   *
   * A meal in progress is left alone unless the word list itself changed, since
   * re-dealing would take the plate away from a child in the middle of filling
   * it.
   */
  useFocusEffect(
    useCallback(() => {
      const dictionary = store.loadDictionary();
      const changed = dictionary.map((w) => w.text).join(' ') !== dealtFrom.current;
      if (!changed && !alive.current.resting) return;

      const from = store.loadProfile();
      setProfile(from);
      plan(from, dictionary);
    }, [plan]),
  );

  const finishRound = useCallback(
    (next: (p: typeof profile) => typeof profile) => {
      const updated = next(profileRef.current);
      setProfile(updated);
      store.saveProfile(updated);

      after(ROUND_GAP_MS, () => {
        setMood('idle');
        if (at + 1 >= meal.length) {
          const done = { ...updated, mealsCompleted: updated.mealsCompleted + 1 };
          store.saveProfile(done);
          setProfile(done);
          setFinished(true);
          setResting(true);
          // the end of a meal should sound like the end of something
          void audio.speak([audio.sound(CHEER)]);
        } else {
          setAt((i) => i + 1);
        }
      });
    },
    [after, at, meal.length],
  );

  const feed = useCallback(
    (piece: Word) => {
      if (!round) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (round.kind === 'pick' && !isCorrectPick(round, piece)) {
        // no buzzer and no penalty — a puzzled dragon, a beat, then the question again
        setMood('puzzled');
        setMissed(true);
        void audio.speak([RETRY_GAP_MS]).then(() => say(round.word));
        after(900, () => setMood('idle'));
        return;
      }

      setEaten((e) => [...e, piece.text]);
      setMood('chewing');
      after(500, () => setMood('happy'));

      if (round.kind === 'read') {
        // the word arrives as a reward for committing, not as a correction
        void swallow(round.word);
        if (profileRef.current.settings.parentCheck) {
          setAwaitingCheck(true);
          after(9000, () =>
            setAwaitingCheck((waiting) => {
              if (waiting) finishRound((p) => p);
              return false;
            }),
          );
          return;
        }
        finishRound((p) => p);
        return;
      }

      if (round.kind === 'meet') {
        void audio.speak([audio.sound(MUNCH)]);
        finishRound((p) => recordPick(p, round.word.text, true));
        return;
      }

      void swallow(round.word);
      finishRound((p) => recordPick(p, round.word.text, !missed));
    },
    [after, finishRound, missed, round, say, swallow],
  );

  /** Hearing it again, and the reply to a tap on a piece he was meant to carry. */
  const again = useCallback(() => {
    if (round && round.kind !== 'read') void say(round.word);
  }, [round, say]);

  const place = useCallback(
    (index: number) => {
      if (!round || round.kind !== 'order') return;
      void Haptics.selectionAsync();
      setPlate((p) => (p.includes(index) ? p : [...p, index]));
    },
    [round],
  );

  /** Taking the last slice back off the plate — a wrong order must be undoable. */
  const unplace = useCallback(() => {
    void Haptics.selectionAsync();
    setPlate((p) => p.slice(0, -1));
  }, []);

  const check = useCallback(
    (verdict: Verdict) => {
      setAwaitingCheck(false);
      finishRound((p) => recordRead(p, round.word.text, verdict));
    },
    [finishRound, round],
  );

  /**
   * The words he can read, as words rather than as a number.
   *
   * The score has always known this list and nothing ever showed it to him. It
   * is the only reward in the game that is made of the thing being learnt: not
   * a star for playing, a pile of words he could not read a fortnight ago.
   */
  const hoarded = useMemo(() => {
    if (!resting) return [];
    const dictionary = store.loadDictionary();
    const owned = new Set(hoard(profile, dictionary.map((w) => w.text)));
    return dictionary.filter((w) => owned.has(w.text)).reverse();
  }, [resting, profile]);

  const onDragonLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    // let go anywhere above the dragon's chin and it counts
    setDropLine(y + height * 0.92);
  };

  if (!profile.introSeen) return <HowItWorks onStart={start} />;

  if (resting || !round) {
    return (
      <SafeAreaView style={[styles.screen, styles.middle]}>
        <Text style={styles.doorTitle}>{finished ? 'The dragon is full!' : 'Sushi Dragon'}</Text>
        <Pressable
          onPress={serve}
          style={styles.door}
          accessibilityRole="button"
          accessibilityLabel="feed the dragon"
        >
          <Dragon fullness={1} mood="happy" size={300} />
          <View style={styles.doorCounter} />
        </Pressable>
        {/* The one instruction on this screen, because a dragon sitting there
            is not obviously a button, and nothing else here is either. */}
        <Text style={styles.doorHint}>
          {finished ? 'Tap the dragon to feed it again' : 'Tap the dragon to start'}
        </Text>
        <Hoard words={hoarded} onSay={(w) => void say(w)} />
        <GrownUps />
      </SafeAreaView>
    );
  }

  const fullness = at / Math.max(meal.length, 1);
  const slices = round.kind === 'order' ? round.slices : [];
  const assembled = plate.map((i) => slices[i]).join('');
  const rollFull = round.kind === 'order' && plate.length === slices.length;
  const rollReady = rollFull && assembled === round.word.text;

  return (
    <SafeAreaView style={styles.screen}>
      <HomeButton onPress={rest} />

      <View style={styles.dragonRow} onLayout={onDragonLayout}>
        <Dragon mood={mood} fullness={fullness} breathing={searing} size={300} />
      </View>

      {/* What to do, in one line, on every round.
          Without it the game is a dragon, some sushi, and no clue: the rules
          were only ever in the spoken prompt, which says the word and not what
          to do with it — and says nothing at all in a reading round. */}
      <Text style={styles.prompt}>{PROMPT[round.kind]}</Text>

      {/* What the green dab on a letter means.
          The mark has been there since the first version and the explanation
          for it has been sitting in the word list, unread, since the same day:
          a mark nobody can read is decoration, and this one is the single most
          useful thing the game knows about the word. It appears while the word
          is being introduced, which is the moment it is worth saying. */}
      {round.kind === 'meet' && round.word.tricky && (
        <Text style={styles.lying}>{lyingBit(round.word)}</Text>
      )}

      {/* How much of the meal is left, as plates. He cannot read "round 3 of
          6", and a meal with no visible end is one he has no reason to
          finish. */}
      <View style={styles.progress}>
        {meal.map((_, i) => (
          <View key={i} style={[styles.plate, i < at && styles.plateEaten]} />
        ))}
      </View>

      {/* The plate. Slots are drawn empty so it is obvious something goes in
          them, and how many — a blank space told him nothing. */}
      {round.kind === 'order' && (
        <View style={styles.plateRow}>
          {rollReady ? (
            <Carry enabled onFeed={() => feed(round.word)} dropAboveY={dropLine}>
              <Sushi chunks={plate.map((i) => slices[i])} tricky={round.word.tricky} scale={0.9} />
            </Carry>
          ) : (
            <Pressable
              onPress={plate.length ? unplace : undefined}
              style={styles.slots}
              accessibilityRole="button"
              accessibilityLabel="the plate"
            >
              {slices.map((_, slot) => (
                <View
                  key={slot}
                  testID={plate[slot] === undefined ? 'slot-empty' : 'slot-full'}
                  style={[styles.slot, plate[slot] !== undefined && styles.slotFull]}
                >
                  {plate[slot] !== undefined && (
                    <Text style={styles.slotText}>{slices[plate[slot]]}</Text>
                  )}
                </View>
              ))}
            </Pressable>
          )}
          {rollFull && !rollReady && (
            <Text style={styles.hint}>tap the plate to take one back</Text>
          )}
        </View>
      )}

      <View style={styles.counterRow}>
        {round.kind === 'order'
          ? slices.map((text, index) =>
              plate.includes(index) ? null : (
                <Pressable
                  key={`${text}-${index}`}
                  onPress={() => place(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`piece ${text}`}
                >
                  <Sushi chunks={[text]} scale={0.85} showSeams={false} />
                </Pressable>
              ),
            )
          : optionsFor(round)
              .filter((w) => !eaten.includes(w.text))
              .map((word) => (
                <Carry
                  key={word.text}
                  enabled={!awaitingCheck}
                  onFeed={() => feed(word)}
                  onTap={again}
                  dropAboveY={dropLine}
                  onOverChange={(over) => setMood(over ? 'happy' : 'idle')}
                >
                  <Sushi
                    chunks={word.chunks}
                    tricky={word.tricky}
                    scale={optionsFor(round).length > 2 ? 0.8 : 1}
                  />
                </Carry>
              ))}
      </View>
      <View style={styles.counter} />

      {round.kind !== 'read' && (
        <Pressable
          style={styles.again}
          onPress={again}
          accessibilityRole="button"
          accessibilityLabel="say it again"
          hitSlop={16}
        >
          <Text style={styles.againGlyph}>🔊</Text>
        </Pressable>
      )}

      {/* The three buttons are for the grown-up and were unlabelled, which
          made them look like the game asking the child something. */}
      {awaitingCheck && (
        <View style={styles.check}>
          <Text style={styles.checkAsk}>How did he read it?</Text>
          {(['got', 'nudge', 'not-yet'] as Verdict[]).map((verdict) => (
            <Pressable
              key={verdict}
              style={styles.checkButton}
              onPress={() => check(verdict)}
              accessibilityRole="button"
              accessibilityLabel={verdict}
            >
              <Text style={styles.checkText}>{CHECK_LABEL[verdict]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * The hoard: every word he owns, on the shelf behind the counter.
 *
 * Drawn as the same sushi he fed the dragon, because that is what makes it
 * his — he has seen each of these pieces before and can now read all of them.
 * Tapping one says it back in your voice, which is the only reason a child who
 * cannot read the label would ever touch it.
 */
function Hoard({ words, onSay }: { words: Word[]; onSay: (word: Word) => void }) {
  if (!words.length) return null;

  return (
    <View style={styles.hoard}>
      <Text style={styles.hoardTitle}>
        {words.length === 1 ? '1 word he can read' : `${words.length} words he can read`}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hoardRow}
      >
        {words.map((word) => (
          <Pressable
            key={word.text}
            onPress={() => onSay(word)}
            accessibilityRole="button"
            accessibilityLabel={`his word ${word.text}`}
          >
            <Sushi chunks={word.chunks} tricky={word.tricky} scale={0.42} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The grown-ups' entrance.
 *
 * Only ever on a screen where nothing is being dragged, and quiet enough that
 * it is not the most interesting thing on it — but written in words, because
 * the person who needs it can read and the person who shouldn't press it
 * can't.
 */
function GrownUps() {
  return (
    <Link href="/dragon/parent" asChild>
      <Pressable
        style={styles.parent}
        accessibilityRole="button"
        accessibilityLabel="grown-ups"
        hitSlop={12}
      >
        <Text style={styles.parentText}>grown-ups</Text>
      </Pressable>
    </Link>
  );
}

/**
 * What to do, per round, in the fewest words that say it.
 *
 * Written for the grown-up sitting next to him — he cannot read these yet, and
 * the day he can is the day the app has done its job.
 */
const PROMPT: Record<RoundKind, string> = {
  meet: 'A new word — listen, then feed it to the dragon',
  pick: 'Feed the dragon the word it asked for',
  order: 'Put the pieces in order, then feed it to the dragon',
  read: 'Read it out loud, then feed it to the dragon',
};

/**
 * How the game works, once, before the first meal.
 *
 * A dragon, some sushi and no instructions is a game whose rules you have to
 * guess, and the person who has to understand them first is the parent — who
 * gets thirty seconds of a five-year-old's patience to work out what the app
 * wants from them. Four lines, one button, never seen again.
 */
function HowItWorks({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, styles.middle, styles.intro]}>
      <Dragon mood="happy" size={200} />
      <Text style={styles.introTitle}>Feed the dragon words</Text>
      {[
        'The dragon asks for a word out loud. Drag the right sushi up to its mouth.',
        'Some words arrive in pieces to put back in order. Some he reads out loud himself — then you tap how it went.',
        'A green mark sits on a letter that does not say its usual sound — the e in “have”, which does nothing at all.',
        'Words he reads go on the shelf behind the counter, and the game brings back the ones he is still learning.',
        'Grown-ups: add the words he trips on in his bedtime book, in your own voice.',
      ].map((line) => (
        <Text key={line} style={styles.introLine}>
          {line}
        </Text>
      ))}
      <Pressable
        onPress={onStart}
        style={styles.introButton}
        accessibilityRole="button"
        accessibilityLabel="start playing"
      >
        <Text style={styles.introButtonText}>Start</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/**
 * The green letters, in words.
 *
 * `have` is not a shape to memorise. It is a regular word with one letter in
 * it that does nothing, and saying which letter — and what it is up to — is
 * the whole difference between learning to read and learning to guess.
 */
export const lyingBit = (word: Word): string =>
  word.tricky
    ? `the “${word.text.slice(word.tricky.start, word.tricky.end)}” ${word.tricky.says}`
    : '';

const CHECK_LABEL: Record<Verdict, string> = {
  got: 'got it',
  nudge: 'a nudge',
  'not-yet': 'not yet',
};

const optionsFor = (round: Round): Word[] =>
  round.kind === 'pick' ? round.options : [round.word];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  middle: { alignItems: 'center', justifyContent: 'center' },

  doorTitle: { color: CREAM, fontSize: 30, fontWeight: '800', marginBottom: 6 },
  doorHint: { color: LANTERN, opacity: 0.75, fontSize: 16, marginTop: 14 },
  door: { alignItems: 'center' },
  doorCounter: {
    width: 300,
    height: 14,
    marginTop: -26,
    borderRadius: 5,
    backgroundColor: WOOD,
    borderBottomWidth: 5,
    borderBottomColor: WOOD_DARK,
  },
  hoard: { position: 'absolute', left: 0, right: 0, bottom: 44, gap: 8 },
  hoardTitle: {
    color: CREAM,
    opacity: 0.45,
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  hoardRow: { gap: 12, paddingHorizontal: 24, alignItems: 'flex-end' },

  parent: { position: 'absolute', right: 22, bottom: 16, padding: 8 },
  parentText: { color: LANTERN, opacity: 0.55, fontSize: 13 },

  intro: { padding: 32, gap: 10 },
  introTitle: { color: CREAM, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  introLine: {
    color: CREAM,
    opacity: 0.7,
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 23,
  },
  introButton: {
    marginTop: 18,
    backgroundColor: LANTERN,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 14,
  },
  introButtonText: { color: NIGHT, fontWeight: '800', fontSize: 18 },

  dragonRow: { alignItems: 'center', paddingTop: 2 },

  prompt: {
    color: CREAM,
    opacity: 0.72,
    fontSize: 17,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  lying: {
    color: WASABI,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingTop: 10 },
  plate: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: CREAM,
    opacity: 0.18,
  },
  plateEaten: { backgroundColor: LANTERN, opacity: 0.9 },

  plateRow: { alignItems: 'center', gap: 6, minHeight: 92, justifyContent: 'center' },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    minWidth: 86,
    height: 68,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: SEAM,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  slotFull: { backgroundColor: RICE, borderStyle: 'solid', borderColor: RICE },
  slotText: { fontSize: 34, fontWeight: '700', color: '#2b2118' },
  hint: { color: CREAM, opacity: 0.45, fontSize: 13 },

  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 22,
    paddingHorizontal: 24,
    marginTop: 'auto',
    paddingBottom: 16,
  },
  counter: { height: 16, backgroundColor: WOOD, borderTopWidth: 4, borderTopColor: WOOD_DARK },

  again: {
    position: 'absolute',
    left: 20,
    bottom: 30,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,248,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  againGlyph: { fontSize: 28 },

  check: {
    position: 'absolute',
    right: 16,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkAsk: { color: CREAM, opacity: 0.55, fontSize: 13, marginRight: 2 },
  checkButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255,248,231,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,248,231,0.25)',
  },
  checkText: { color: CREAM, fontSize: 13, opacity: 0.8 },
});
