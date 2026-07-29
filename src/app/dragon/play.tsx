import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dragon, type Mood } from '@/components/Dragon';
import { Sushi } from '@/components/Sushi';
import * as audio from '@/game/audio';
import { isCorrectPick, planMeal, type Round } from '@/game/engine';
import { recordPick, recordRead, type Verdict } from '@/game/progress';
import * as store from '@/game/storage';
import { CREAM, LANTERN, NIGHT, WOOD, WOOD_DARK } from '@/theme';
import type { Word } from '@/game/words';

/* Pacing, inherited wholesale from the letter game, where the thing that made
   it hard to follow was never a missing sound but two sounds arriving on top
   of one another. At a round boundary he hears the word he just fed and then
   the next question, and without real silence between them they run together
   into one stream. These gaps are longer than they look like they should be. */
const ASK_LEAD_MS = 450; // after the pieces appear, before the dragon asks
const ROUND_GAP_MS = 1400; // after a word is eaten, before the next round
const RETRY_GAP_MS = 500; // after the puzzled look, before the question returns
const SEAR_MS = 900; // the torch, on a word he has not met

export default function PlayScreen() {
  const [profile, setProfile] = useState(() => store.loadProfile());
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [meal] = useState<Round[]>(() =>
    playable(planMeal(store.loadProfile(), store.loadDictionary())),
  );
  const [at, setAt] = useState(0);
  const round = meal[at];

  const [mood, setMood] = useState<Mood>('idle');
  const [searing, setSearing] = useState(false);
  const [eaten, setEaten] = useState<string[]>([]);
  const [plate, setPlate] = useState<string[]>([]);
  const [missed, setMissed] = useState(false);
  const [awaitingCheck, setAwaitingCheck] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    void audio.prepare();
    return () => {
      timers.current.forEach(clearTimeout);
      audio.stop();
    };
  }, []);

  /** The dragon saying the word, if there is a recording of it. */
  const say = useCallback((word: Word, lead: number[] = []) => {
    if (!store.hasVoice(word.text)) return Promise.resolve();
    return audio.speak([...lead, audio.sound(store.voiceFile(word.text).uri)]);
  }, []);

  // open each round: lay the pieces out, wait a beat, then ask
  useEffect(() => {
    if (!round) return;
    setPlate([]);
    setEaten([]);
    setMissed(false);
    setAwaitingCheck(false);
    setMood('idle');

    if (round.kind === 'meet') {
      setSearing(true);
      after(SEAR_MS, () => {
        setSearing(false);
        void say(round.word);
      });
      return;
    }

    /* A reading round is the only one that arrives in silence. The whole point
       is that nothing tells him what the word is until after he has committed
       to it, so the dragon keeps quiet until the sushi is in its mouth. */
    if (round.kind === 'read') return;

    after(ASK_LEAD_MS, () => void say(round.word));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

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
          router.replace('/');
        } else {
          setAt((i) => i + 1);
        }
      });
    },
    [after, at, meal.length],
  );

  /** He carried a piece up to the dragon. */
  const feed = useCallback(
    (piece: Word) => {
      if (!round) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (round.kind === 'pick' && !isCorrectPick(round, piece)) {
        /* No buzzer and no penalty — a puzzled dragon, a beat, and the question
           again. Every round in this game ends in success eventually. */
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
        // the answer arrives as a reward for having committed, not as a correction
        void say(round.word, [260]);
        if (profileRef.current.settings.parentCheck) {
          setAwaitingCheck(true);
          /* If nobody taps — you looked away, he is playing next to you rather
             than with you — the round moves on unscored rather than leaving a
             child staring at a dragon that has stopped responding. */
          after(9000, () => {
            setAwaitingCheck((waiting) => {
              if (waiting) finishRound((p) => p);
              return false;
            });
          });
          return;
        }
        finishRound((p) => p);
        return;
      }

      if (round.kind === 'meet') {
        finishRound((p) => recordPick(p, round.word.text, true));
        return;
      }

      void say(round.word, [260]);
      finishRound((p) => recordPick(p, round.word.text, !missed));
    },
    [after, finishRound, missed, round, say],
  );

  /** Tapping a slice moves it onto the plate, building the roll left to right. */
  const place = useCallback(
    (slice: string, index: number) => {
      if (!round || round.kind !== 'order') return;
      if (plate.length >= round.slices.length) return;
      void Haptics.selectionAsync();
      setPlate((p) => [...p, slice]);
      setEaten((e) => [...e, `slice-${index}`]);
    },
    [plate.length, round],
  );

  const check = useCallback(
    (verdict: Verdict) => {
      setAwaitingCheck(false);
      finishRound((p) => recordRead(p, round.word.text, verdict));
    },
    [finishRound, round],
  );

  const assembled = plate.join('');
  const rollReady = round?.kind === 'order' && assembled === round.word.text;
  const rollWrong = round?.kind === 'order' && plate.length === round.slices.length && !rollReady;

  useEffect(() => {
    if (!rollWrong) return;
    // the slices simply go back; nothing is scored and nothing is scolded
    setMood('puzzled');
    const t = after(700, () => {
      setPlate([]);
      setEaten([]);
      setMood('idle');
    });
    return () => clearTimeout(t);
  }, [after, rollWrong]);

  if (!round) return null;

  const fullness = at / Math.max(meal.length, 1);
  const counter = piecesFor(round, eaten, plate);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.dragonRow}>
        <Dragon mood={mood} fullness={fullness} breathing={searing} size={230} />
      </View>

      {/* the plate, where a roll gets put back together before it is fed */}
      {round.kind === 'order' && (
        <View style={styles.plate}>
          {plate.length > 0 ? (
            <Feedable enabled={rollReady} onFeed={() => feed(round.word)}>
              <Sushi chunks={plate} tricky={rollReady ? round.word.tricky : null} scale={0.8} />
            </Feedable>
          ) : (
            <Text style={styles.plateHint}>▁▁▁</Text>
          )}
        </View>
      )}

      <View style={styles.counterRow}>
        {counter.map((item) =>
          item.kind === 'slice' ? (
            <Pressable
              key={item.key}
              onPress={() => place(item.text, item.index)}
              accessibilityRole="button"
              accessibilityLabel={`piece ${item.text}`}
            >
              <Sushi chunks={[item.text]} scale={0.7} showSeams={false} />
            </Pressable>
          ) : (
            <Feedable key={item.key} enabled onFeed={() => feed(item.word)}>
              <Sushi
                chunks={item.word.chunks}
                tricky={item.word.tricky}
                scale={round.options.length > 2 ? 0.66 : 0.85}
              />
            </Feedable>
          ),
        )}
      </View>
      <View style={styles.counterTop} />

      {round.kind !== 'read' && (
        <Pressable
          style={styles.again}
          onPress={() => void say(round.word)}
          accessibilityRole="button"
          accessibilityLabel="say it again"
          hitSlop={16}
        >
          <Text style={styles.againText}>↺</Text>
        </Pressable>
      )}

      {/* Your three buttons. They change nothing he can see — the dragon is
          delighted either way — and only decide when the word comes back. */}
      {awaitingCheck && (
        <View style={styles.check}>
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

const CHECK_LABEL: Record<Verdict, string> = {
  got: 'got it',
  nudge: 'a nudge',
  'not-yet': 'not yet',
};

/**
 * Carrying a piece up to the dragon.
 *
 * The drop zone is deliberately the entire upper half of the screen rather
 * than the dragon's mouth. Being fussy about where the finger lets go would
 * test his motor control, which is not what this game is for.
 */
function Feedable({
  children,
  enabled,
  onFeed,
}: {
  children: React.ReactNode;
  enabled: boolean;
  onFeed: () => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY < -80) runOnJS(onFeed)();
      x.value = withSpring(0);
      y.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

type CounterItem =
  | { kind: 'word'; key: string; word: Word }
  | { kind: 'slice'; key: string; text: string; index: number };

function piecesFor(round: Round, eaten: string[], plate: string[]): CounterItem[] {
  if (round.kind === 'order') {
    return round.slices
      .map((text, index) => ({ kind: 'slice' as const, key: `${text}-${index}`, text, index }))
      .filter((_, index) => !eaten.includes(`slice-${index}`));
  }

  const options = round.kind === 'pick' ? round.options : [round.word];
  return options
    .filter((w) => !eaten.includes(w.text))
    .map((word) => ({ kind: 'word' as const, key: word.text, word }));
}

/**
 * A round he cannot possibly answer is worse than no round.
 *
 * Picking a word out of a line-up requires hearing it, so until a word has a
 * recording it gets read instead — which needs no audio at all, since the
 * dragon only speaks after he has already committed.
 */
function playable(meal: Round[]): Round[] {
  return meal.map((round) => {
    const needsVoice = round.kind === 'pick' || round.kind === 'meet';
    if (!needsVoice || store.hasVoice(round.word.text)) return round;
    return { ...round, kind: 'read' as const, options: [], slices: [] };
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  dragonRow: { alignItems: 'center', paddingTop: 4 },
  plate: { alignItems: 'center', minHeight: 78, justifyContent: 'center' },
  plateHint: { color: CREAM, opacity: 0.25, fontSize: 34, letterSpacing: 6 },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 18,
    paddingHorizontal: 24,
    marginTop: 'auto',
    paddingBottom: 14,
  },
  counterTop: {
    height: 14,
    backgroundColor: WOOD,
    borderTopWidth: 4,
    borderTopColor: WOOD_DARK,
  },
  again: {
    position: 'absolute',
    left: 20,
    bottom: 26,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LANTERN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againText: { fontSize: 26, color: NIGHT },
  check: {
    position: 'absolute',
    right: 16,
    bottom: 22,
    flexDirection: 'row',
    gap: 8,
  },
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
