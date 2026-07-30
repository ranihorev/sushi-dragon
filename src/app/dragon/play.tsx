import * as Haptics from 'expo-haptics';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Carry } from '@/components/Carry';
import { Dragon, type Mood } from '@/components/Dragon';
import { HomeButton } from '@/components/HomeButton';
import { Sushi } from '@/components/Sushi';
import * as audio from '@/game/audio';
import { isCorrectPick, planMeal, type Round } from '@/game/engine';
import { recordPick, recordRead, type Verdict } from '@/game/progress';
import * as store from '@/game/storage';
import type { Word } from '@/game/words';
import { CREAM, LANTERN, NIGHT, RICE, SEAM, WOOD, WOOD_DARK } from '@/theme';

/* Pacing, inherited from the letter game, where the thing that made it hard to
   follow was never a missing sound but two sounds arriving on top of one
   another. These gaps are longer than they look like they should be. */
const ASK_LEAD_MS = 450;
const ROUND_GAP_MS = 1400;
const RETRY_GAP_MS = 500;
const SEAR_MS = 900;

export default function PlayScreen() {
  const [profile, setProfile] = useState(() => store.loadProfile());
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [meal] = useState<Round[]>(() =>
    playable(planMeal(store.loadProfile(), store.loadDictionary())),
  );
  const [at, setAt] = useState(0);
  const round = meal[at];

  const [voiced, setVoiced] = useState(() =>
    store.loadDictionary().some((w) => store.hasVoice(w.text)),
  );

  const [mood, setMood] = useState<Mood>('idle');
  const [searing, setSearing] = useState(false);
  const [eaten, setEaten] = useState<string[]>([]);
  const [plate, setPlate] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);
  const [awaitingCheck, setAwaitingCheck] = useState(false);
  /** bottom of the dragon on screen — everything above it is the drop zone */
  const [dropLine, setDropLine] = useState(320);

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

  const say = useCallback((word: Word, lead: number[] = []) => {
    if (!store.hasVoice(word.text)) return Promise.resolve();
    return audio.speak([...lead, audio.sound(store.voiceFile(word.text).uri)]);
  }, []);

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

    /* A reading round arrives in silence on purpose: nothing tells him the
       word until he has committed to it. */
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
        void say(round.word, [260]);
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
        finishRound((p) => recordPick(p, round.word.text, true));
        return;
      }

      void say(round.word, [260]);
      finishRound((p) => recordPick(p, round.word.text, !missed));
    },
    [after, finishRound, missed, round, say],
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

  const onDragonLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    // let go anywhere above the dragon's chin and it counts
    setDropLine(y + height * 0.92);
  };

  if (!round) return null;

  if (!voiced) {
    return (
      <SafeAreaView style={[styles.screen, styles.empty]}>
        <HomeButton />
        <Dragon mood="idle" size={200} />
        <Text style={styles.emptyTitle}>The dragon can&apos;t speak yet</Text>
        <Text style={styles.emptyBody}>
          Record a few words in your own voice and it can say them back to him. Three of them takes
          about a minute.
        </Text>
        <Link href="/dragon/add-word" asChild>
          <Pressable style={styles.emptyButton} accessibilityRole="button">
            <Text style={styles.emptyButtonText}>Record a word</Text>
          </Pressable>
        </Link>
        <Pressable onPress={() => setVoiced(true)} accessibilityRole="button" hitSlop={14}>
          <Text style={styles.emptySkip}>play without it</Text>
        </Pressable>
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
      <HomeButton />

      <View style={styles.dragonRow} onLayout={onDragonLayout}>
        <Dragon mood={mood} fullness={fullness} breathing={searing} size={220} />
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

const optionsFor = (round: Round): Word[] =>
  round.kind === 'pick' ? round.options : [round.word];

/**
 * A round he cannot possibly answer is worse than no round: picking a word out
 * of a line-up requires hearing it, so an unrecorded word gets read instead.
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
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { color: CREAM, fontSize: 24, fontWeight: '800' },
  emptyBody: {
    color: CREAM,
    opacity: 0.6,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 21,
  },
  emptyButton: {
    marginTop: 12,
    backgroundColor: LANTERN,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: { color: NIGHT, fontWeight: '800', fontSize: 16 },
  emptySkip: { color: CREAM, opacity: 0.4, fontSize: 13, marginTop: 6 },

  dragonRow: { alignItems: 'center', paddingTop: 2 },

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

  check: { position: 'absolute', right: 16, bottom: 26, flexDirection: 'row', gap: 8 },
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
