import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bob } from '@/components/Bob';
import { Carry } from '@/components/Carry';
import { Dragon, type Mood } from '@/components/Dragon';
import { HomeButton } from '@/components/HomeButton';
import { SayAgain } from '@/components/SayAgain';
import { Sushi } from '@/components/Sushi';
import { carrierFor, greetingFor, READY, wholeQuestion } from '@/game/asking';
import * as audio from '@/game/audio';
import { isCorrectPick, planMeal, type Round, type RoundKind } from '@/game/engine';
import { hoard, noteSession, recordPick, recordRead, type Verdict } from '@/game/progress';
import * as store from '@/game/storage';
import { phraseClip, wordClip } from '@/game/voices';
import type { Word } from '@/game/words';
import { CREAM, LANTERN, NIGHT, RICE, WASABI, WOOD, WOOD_DARK } from '@/theme';

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
/** between the dragon's question and the word on the end of it */
const BREATH_MS = 120;
/** long enough to watch a piece disappear into a dragon */
const SWALLOW_MS = 340;

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
  /* How far into its habits the dragon is. The wording of the question rotates
     with this, so it carries on across meals rather than restarting at the same
     sentence every time it gets hungry again. */
  const turn = at + profile.mealsCompleted;

  const [mood, setMood] = useState<Mood>('idle');
  /** bumped once per mouthful, to set the dragon gulping */
  const [bites, setBites] = useState(0);
  /** the piece on its way into the mouth — still drawn, no longer touchable */
  const [going, setGoing] = useState('');
  const [eaten, setEaten] = useState<string[]>([]);
  const [plate, setPlate] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);
  const [awaitingCheck, setAwaitingCheck] = useState(false);
  /** bottom of the dragon on screen — everything above it is the drop zone */
  const [dropLine, setDropLine] = useState(320);
  /** bottom of the plate — a piece let go above this line goes onto the plate */
  const [plateLine, setPlateLine] = useState(0);

  /* What the focus effect below needs to know, without it having to re-run
     every time one of them changes. */
  const alive = useRef({ resting });
  alive.current = { resting };

  /** The word list the meal on screen was dealt from, to notice a new one. */
  const dealtFrom = useRef('');

  /** Which round has already been marked and moved on from. */
  const done = useRef('');

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
   * Three voices, in order of how much they are worth to him. Yours, recorded
   * on this iPad, wins outright. Failing that the dragon's own voice, recorded
   * before the app was built — which covers the words it shipped with. Failing
   * both, the iPad reads it, which is how a word a parent typed in last night
   * gets said at all.
   */
  const voiceOf = useCallback((word: Word) => {
    if (store.hasVoice(word.text)) return audio.sound(store.voiceFile(word.text).uri);
    const clip = wordClip(word.text);
    return clip ? audio.sound(clip) : audio.said(word.text);
  }, []);

  const say = useCallback(
    (word: Word, lead: audio.Beat[] = []) => audio.speak([...lead, voiceOf(word)]),
    [voiceOf],
  );

  /**
   * Hello.
   *
   * The game used to open by demanding a word, which is a game that opened in
   * the middle of itself. This is the one moment the dragon says something to
   * him rather than about a word, and it costs a second and a half.
   */
  const hello = useCallback((): audio.Beat[] => {
    const line = greetingFor(profileRef.current.mealsCompleted);
    const clip = phraseClip(line);
    return [clip ? audio.sound(clip) : audio.said(line), 380];
  }, []);

  /** The dragon eating, and then telling him what he just fed it. */
  const swallow = useCallback(
    (word: Word) => audio.speak([audio.sound(MUNCH), 240, voiceOf(word)]),
    [voiceOf],
  );

  /**
   * The question, out loud.
   *
   * Two clips back to back — what the dragon wants, then the word — rather than
   * one recording per phrase-and-word pair, which would be several hundred
   * files that all have to be remade the day a line of dialogue changes.
   *
   * Whichever voice is about to say the word says the question too. A recorded
   * phrase in front of a word the iPad is reading is two different people
   * finishing each other's sentence, which is worse than either of them alone.
   *
   * Where you have recorded the word yourself, your voice says it and nothing
   * else — the point of the recording is that it is yours.
   */
  const ask = useCallback(
    (round: Round, lead: audio.Beat[] = []) => {
      const voice = voiceOf(round.word);
      const carrier = carrierFor(round.kind, turn);
      if (!carrier || store.hasVoice(round.word.text)) return audio.speak([...lead, voice]);

      // the iPad has no clips, so it reads the question and the word as one line
      if ('say' in voice) {
        return audio.speak([...lead, audio.said(wholeQuestion(carrier, round.word.text))]);
      }

      const phrase = phraseClip(carrier);
      return audio.speak([
        ...lead,
        phrase ? audio.sound(phrase) : audio.said(carrier),
        BREATH_MS,
        voice,
      ]);
    },
    [turn, voiceOf],
  );

  useEffect(() => {
    if (!round || resting) return;
    setPlate([]);
    setEaten([]);
    setGoing('');
    setMissed(false);
    setAwaitingCheck(false);
    setMood('idle');

    // the dragon greets whoever has just sat down, once per meal
    const lead = at === 0 ? hello() : [];

    /* A reading round arrives in silence on purpose: nothing tells him the
       word until he has committed to it. */
    if (round.kind === 'read') {
      if (lead.length) after(ASK_LEAD_MS, () => void audio.speak(lead));
      return;
    }

    after(ASK_LEAD_MS, () => void ask(round, lead));
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
      /* Once per round, whoever asks. The round now ends when the dragon has
         finished speaking, and a sound can be cut short by anything he taps —
         which would land two of these on the same round and skip one. */
      if (done.current === `${served}:${at}`) return;
      done.current = `${served}:${at}`;

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
    [after, at, meal.length, served],
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

      /* The piece is not taken off the counter yet. For a third of a second it
         is still drawn, shrinking into the dragon's mouth, because a piece that
         blinks out of existence the instant he lets go of it never looked like
         it was eaten by anything. */
      setGoing(piece.text);
      setBites((n) => n + 1);
      setMood('chewing');
      after(SWALLOW_MS, () => {
        setGoing('');
        setEaten((e) => [...e, piece.text]);
      });
      after(500 + SWALLOW_MS, () => setMood('happy'));

      if (round.kind === 'read') {
        // the word arrives as a reward for committing, not as a correction
        const said = swallow(round.word);
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
        void said.then(() => finishRound((p) => p));
        return;
      }

      if (round.kind === 'meet') {
        void audio
          .speak([audio.sound(MUNCH)])
          .then(() => finishRound((p) => recordPick(p, round.word.text, true)));
        return;
      }

      /* The next round waits for this to finish speaking.
         It did not, and the two overlapped: the dragon said the word he had
         just fed it while it was already halfway into asking for the next one,
         so the reward for getting it right was a sentence with a word buried in
         the middle of it. The pause after that is measured from the end of the
         word, where a pause belongs. */
      void swallow(round.word).then(() =>
        finishRound((p) => recordPick(p, round.word.text, !missed)),
      );
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

  /**
   * The moment the pieces come out right.
   *
   * This round is two jobs and the second one was invisible. The pieces became a
   * roll sitting on the plate and nothing said that it was now his to carry, so
   * a child who had just solved the puzzle sat looking at a finished puzzle. Now
   * the dragon says so, the roll rocks where it stands, and the line under it
   * changes from what to do to what to do *next*.
   */
  const cheerReady = useCallback(() => {
    const clip = phraseClip(READY);
    void audio.speak([clip ? audio.sound(clip) : audio.said(READY)]);
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

  /**
   * Where the counter ends and the dragon's half of the screen begins.
   *
   * The whole upper half counts as feeding it. Being fussy about the drop point
   * tests motor control rather than reading, and on a 13-inch iPad held by a
   * five-year-old the difference between the chin and the chest is a long way.
   */
  /* The plate, worked out before the screen is drawn, because the dragon has
     something to say the instant the last piece lands in the right place. */
  const slices = round?.kind === 'order' ? round.slices : [];
  const assembled = plate.map((i) => slices[i]).join('');
  const rollFull = round?.kind === 'order' && plate.length === slices.length;
  const rollReady = rollFull && assembled === round.word.text;

  useEffect(() => {
    if (rollReady) cheerReady();
  }, [rollReady, cheerReady]);

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setDropLine(y + height);
  };

  /* The same idea one shelf lower: the plate is where the pieces of a long word
     go, so letting go anywhere at or above it counts as putting one down. */
  const onPlateLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setPlateLine(y + height);
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

  return (
    <SafeAreaView style={styles.screen}>
      <HomeButton onPress={rest} />

      {/* The dragon's half of the screen: it sits in the middle of whatever is
          left over rather than clinging to the top, because on a tall iPad that
          left a hand's width of empty night between it and its dinner. */}
      <View style={styles.stage} onLayout={onStageLayout}>
        <View style={styles.dragonRow}>
          {/* Pleased, the moment the pieces come out right — and pleased is
              the face of an animal waiting to be handed something. */}
          <Dragon
            mood={rollReady && mood === 'idle' ? 'happy' : mood}
            fullness={fullness}
            chomp={bites}
            size={320}
          />
        </View>

        {/* What to do, in one line, on every round.
          Without it the game is a dragon, some sushi, and no clue: the rules
          were only ever in the spoken prompt, which says the word and not what
          to do with it — and says nothing at all in a reading round. */}
        {/* The button that says it again lives here, next to the question it
            repeats. It used to be a 🔊 in the far corner by the food — system
            grey, on a night-blue screen, nowhere near the thing it acts on. */}
        <View style={styles.promptRow}>
          <Text style={styles.prompt}>
            {rollReady ? 'Well done — that is the word!' : PROMPT[round.kind]}
          </Text>
          {round.kind !== 'read' && <SayAgain onPress={again} />}
        </View>

        {/* What the green dab on a letter means.
            The mark has been there since the first version and the explanation
            for it has been sitting in the word list, unread, since the same day:
            a mark nobody can read is decoration, and this one is the single most
            useful thing the game knows about the word. It appears while the word
            is being introduced, which is the moment it is worth saying — and now
            nowhere else, because everywhere else it was a green dab on the only
            sushi on the counter that had one. */}
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
      </View>

      {/* The plate. Slots are drawn empty so it is obvious something goes in
          them, and how many — a blank space told him nothing. */}
      {round.kind === 'order' && (
        <View style={styles.plateRow} onLayout={onPlateLayout}>
          {rollReady ? (
            <Carry
              label={`the roll ${round.word.text}`}
              enabled={!going}
              swallowed={going === round.word.text}
              onFeed={() => feed(round.word)}
              onTap={cheerReady}
              dropAboveY={dropLine}
              onOverChange={(over) => setMood(over ? 'happy' : 'idle')}
            >
              {/* Rocking, until he takes it. The dragon says what to do once;
                  this goes on saying it. */}
              <Bob on={!going}>
                <Sushi chunks={plate.map((i) => slices[i])} scale={0.9} />
              </Bob>
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
          {rollReady && <Text style={styles.readyHint}>now drag it up to the dragon</Text>}
          {rollFull && !rollReady && (
            <Text style={styles.hint}>tap the plate to take one back</Text>
          )}
        </View>
      )}

      <View style={styles.counterRow}>
        {round.kind === 'order'
          ? slices.map((text, index) =>
              plate.includes(index) ? null : (
                /* Carried onto the plate, or tapped onto it. Tapping was the
                   only way for a long time, on a screen where every other piece
                   of food is dragged — so the one round that asked him to do
                   something else looked broken to a child who tried the thing
                   the rest of the game had taught him. */
                <Carry
                  key={`${text}-${index}`}
                  label={`piece ${text}`}
                  enabled={!going}
                  onFeed={() => place(index)}
                  onTap={() => place(index)}
                  // until the plate has been measured, the dragon's line will do
                  dropAboveY={plateLine || dropLine}
                >
                  <Sushi chunks={[text]} scale={0.85} />
                </Carry>
              ),
            )
          : optionsFor(round)
              .filter((w) => !eaten.includes(w.text))
              .map((word) => (
                <Carry
                  key={word.text}
                  label={`piece ${word.text}`}
                  enabled={!awaitingCheck && !going}
                  swallowed={going === word.text}
                  onFeed={() => feed(word)}
                  onTap={again}
                  dropAboveY={dropLine}
                  onOverChange={(over) => setMood(over ? 'happy' : 'idle')}
                >
                  {/* The green mark only ever appears alongside the line that
                      explains it. On a counter of three it appeared on one
                      sushi and one only — the right one — which handed him the
                      answer without his having read a letter of it. */}
                  <Sushi
                    chunks={word.chunks}
                    tricky={round.kind === 'meet' ? word.tricky : null}
                    scale={optionsFor(round).length > 2 ? 0.8 : 1}
                  />
                </Carry>
              ))}
      </View>
      <View style={styles.counter} />


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
            <Sushi chunks={word.chunks} scale={0.42} />
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
 * Two lines. It was five, which is a page — and a page in front of a child who
 * has just been handed an iPad is a page nobody reads, including the parent,
 * who is being hurried. Everything the five lines said is still written down
 * under *How the game works* on the grown-ups' side, where there is time.
 */
function HowItWorks({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={[styles.screen, styles.middle, styles.intro]}>
      <Dragon mood="happy" size={220} />
      <Text style={styles.introTitle}>Sushi Dragon</Text>
      <Text style={styles.introLine}>The dragon asks for a word.</Text>
      <Text style={styles.introLine}>Drag the right sushi into its mouth.</Text>
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
    ? `The green “${word.text.slice(word.tricky.start, word.tricky.end)}” is a liar. Here it ${word.tricky.says}.`
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
  introTitle: { color: CREAM, fontSize: 32, fontWeight: '800', marginBottom: 8 },
  /* Full brightness, and bigger. It was cream at seven-tenths opacity on a dark
     blue room, which is a grey on a navy — legible on a screenshot and hard
     work on a tablet held at arm's length by somebody being hurried. */
  introLine: {
    color: CREAM,
    fontSize: 20,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 29,
  },
  introButton: {
    marginTop: 18,
    backgroundColor: LANTERN,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 14,
  },
  introButtonText: { color: NIGHT, fontWeight: '800', fontSize: 18 },

  stage: { flex: 1, justifyContent: 'center', paddingBottom: 8 },
  dragonRow: { alignItems: 'center' },

  prompt: {
    color: CREAM,
    opacity: 0.92,
    fontSize: 19,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
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
  /* Drawn in the rice colour, not in the seam colour it used to use: a seam is
     a dark line meant to be seen against rice, and on a night-blue background
     it was a slot nobody could see they were meant to fill. */
  slot: {
    minWidth: 86,
    height: 68,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,248,231,0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,248,231,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  slotFull: { backgroundColor: RICE, borderStyle: 'solid', borderColor: RICE },
  slotText: { fontSize: 34, fontWeight: '700', color: '#2b2118' },
  hint: { color: CREAM, opacity: 0.45, fontSize: 13 },
  /* Brighter than a hint, because this one is not a note to the grown-up: it is
     the second half of the round, and it was not on the screen at all. */
  readyHint: { color: LANTERN, fontSize: 15, fontWeight: '600' },

  /* The height is fixed so that the counter does not collapse when the last
     piece is eaten. It used to, and the dragon — centred in whatever was left
     over — dropped half an inch at the exact moment the sushi disappeared,
     which looked like the animal flinching. */
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 22,
    paddingHorizontal: 24,
    marginTop: 'auto',
    paddingBottom: 16,
    minHeight: 136,
  },
  counter: { height: 16, backgroundColor: WOOD, borderTopWidth: 4, borderTopColor: WOOD_DARK },

  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },

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
