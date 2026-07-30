import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Carry } from '@/components/Carry';
import { Cat, type Mood } from '@/components/Cat';
import { HomeButton } from '@/components/HomeButton';
import { Sushi } from '@/components/Sushi';
import * as audio from '@/cat/audio';
import { demote, nextRound, promote } from '@/cat/engine';
import type { Letter } from '@/cat/letters';
import { LETTERS } from '@/cat/letters';
import { catSound, confirmClip, promptClips, randomPraise } from '@/cat/script';
import { loadProfile, recordAnswer, recordConfusion, saveProfile } from '@/cat/store';
import type { Level, Profile, Round } from '@/cat/types';
import { CREAM, LANTERN, NIGHT, WOOD, WOOD_DARK } from '@/theme';

const IDLE_NUDGE_MS = 7000;

/* Pacing. Everything he hears at a round boundary is letters — the
   confirmation is "/mmm/ … M!" and the next prompt is "T … /t/". Butted
   together they are four letter sounds in a row with nothing marking where the
   answer ended and the new question began. Silence is the only thing that
   marks it, so these gaps are deliberately longer than they look. */
const PROMPT_LEAD_MS = 450;
const ROUND_GAP_MS = 1400;
const RETRY_GAP_MS = 450;
const GREETING_GAP_MS = 700;

/* The cat greets him in front of the first question rather than underneath it.
   Riding in the same chain as the prompt is what keeps them in order — fired
   separately, the prompt cut the meow in half. */
const GREETING: Array<string | number> = ['cat/greet', GREETING_GAP_MS];

export default function CatPlayScreen() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const total = profile.settings.roundsPerMeal;

  const [level, setLevel] = useState<Level>(profile.level);
  const [round, setRound] = useState<Round>(() => nextRound(profile, profile.level, []));
  const [eaten, setEaten] = useState<Letter[]>([]);
  const [streak, setStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState<Letter | null>(null);
  const [swallowed, setSwallowed] = useState<Letter | null>(null);
  const [mood, setMood] = useState<Mood>('idle');
  const [locked, setLocked] = useState(true);
  const [look, setLook] = useState(0);
  const [heard, setHeard] = useState(0);
  /** bottom of the cat on screen — everything above it is the drop zone */
  const [dropLine, setDropLine] = useState(320);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recentTargets = useRef<Letter[]>([]);
  const alive = useRef(true);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const update = useCallback((change: (p: Profile) => Profile) => {
    setProfile((p) => {
      const next = change(p);
      saveProfile(next);
      return next;
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      timers.current.forEach(clearTimeout);
      clearTimeout(idleTimer.current);
      audio.stop();
    };
  }, []);

  const speakPrompt = useCallback((r: Round) => void audio.say(promptClips(r)), []);

  /* He asked to hear it again, so give him another quiet stretch to think in.
     Without this the nudge keeps its original deadline and the game can repeat
     the question a moment after he pressed the button. */
  const replayPrompt = useCallback(
    (r: Round) => {
      speakPrompt(r);
      setHeard((n) => n + 1);
    },
    [speakPrompt],
  );

  const beginRound = useCallback(
    (r: Round, intro: Array<string | number> = []) => {
      setRound(r);
      setHint(null);
      setSwallowed(null);
      setMisses(0);
      setMood('idle');
      setLocked(true);
      recentTargets.current = [...recentTargets.current, r.target].slice(-4);

      after(PROMPT_LEAD_MS, () => {
        void audio.say([...intro, ...promptClips(r)]);
        setLocked(false);
      });
    },
    [after],
  );

  // first round — the cat greets him, then asks
  useEffect(() => {
    beginRound(round, GREETING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle nudge — replay the prompt if he stalls
  useEffect(() => {
    if (locked) return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => speakPrompt(round), IDLE_NUDGE_MS);
    return () => clearTimeout(idleTimer.current);
  }, [round, locked, misses, heard, speakPrompt]);

  const pick = (letter: Letter) => {
    if (locked) return;
    clearTimeout(idleTimer.current);
    setLook(round.options.indexOf(letter) < round.options.length / 2 ? -1 : 1);

    if (letter !== round.target) {
      /* Wrong piece — no penalty, just a puzzled cat and another go. */
      const m = misses + 1;
      setMisses(m);
      setStreak(0);
      setMood('confused');
      audio.puzzled();
      update((p) => recordConfusion(p, round.target, letter));

      if (m >= 2 && level > 1) {
        const down = demote(level);
        setLevel(down);
        update((p) => ({ ...p, level: down }));
      }

      // the cat reacts first, then the question comes back — in that order
      void audio.say([catSound('curious')]).then(() => {
        if (!alive.current) return;
        setMood('idle');
        /* On a second miss the right piece starts glowing, so the glow does the
           pointing. The beat first lets the glow land before the sound. */
        if (m >= 2) setHint(round.target);
        return audio.say([RETRY_GAP_MS, ...promptClips(round)]);
      });
      return;
    }

    setLocked(true);
    audio.tap();
    setSwallowed(letter);
    setMood('anticipate');

    after(380, () => {
      setMood('eating');
      audio.chomp();
    });

    const first = misses === 0;
    const nextEaten = [...eaten, letter];
    const nextStreak = first ? streak + 1 : 0;
    let nextLevel = level;
    if (first && nextStreak > 0 && nextStreak % 3 === 0 && level < 3) nextLevel = promote(level);

    after(760, async () => {
      /* One ordered chain, not a pile of timers. Chewing, then the cat's
         reaction, then the confirmation, then maybe a word of praise — each
         waits for the last. Fired independently, the meow talked over the
         confirmation and the praise talked over the next prompt. */
      await audio.say(['cat/nom']);
      if (!alive.current) return;

      setMood('happy');
      audio.happy();
      setEaten(nextEaten);
      update((p) => recordAnswer(p, round.target, first));
      setStreak(nextStreak);
      if (nextLevel !== level) {
        setLevel(nextLevel);
        update((p) => ({ ...p, level: nextLevel }));
      }
      if (nextStreak >= 3) audio.sparkle();

      const praise = Math.random() < 0.35;
      await audio.say([
        catSound(nextStreak >= 3 ? 'excited' : 'happy'),
        160,
        confirmClip(letter),
        ...(praise ? [320, randomPraise()] : []),
      ]);
      if (!alive.current) return;

      if (nextEaten.length >= total) {
        setMood('asleep');
        await audio.say(['cat/yawn']);
        if (!alive.current) return;
        const done = { ...profileRef.current, mealsCompleted: profileRef.current.mealsCompleted + 1 };
        saveProfile(done);
        router.replace('/');
        return;
      }

      /* A real pause before the next question. The cat stays looking pleased
         through it, so the quiet reads as "that was right" rather than as the
         game having stalled. */
      after(ROUND_GAP_MS, () =>
        beginRound(nextRound(profileRef.current, nextLevel, recentTargets.current)),
      );
    });
  };

  const fullness = eaten.length / total;
  const wordHint = round.kind === 'word' ? LETTERS[round.target].word : null;

  const onCatLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    // let go anywhere above the cat's chin and it counts
    setDropLine(y + height * 0.92);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <HomeButton />

      <View style={styles.room}>
        <View onLayout={onCatLayout}>
          <Cat fullness={fullness} mood={mood} look={look} size={320} />
        </View>

        {/* how much of the meal is gone */}
        <View style={styles.plate}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.pip, i < eaten.length && styles.pipEaten]} />
          ))}
        </View>

        <View style={styles.controls}>
          {wordHint && <Text style={styles.wordHint}>{wordHint}</Text>}
          <Pressable
            style={styles.again}
            onPress={() => replayPrompt(round)}
            accessibilityRole="button"
            accessibilityLabel="say it again"
            hitSlop={16}
          >
            <Text style={styles.againText}>🔊</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.counterRow}>
        {round.options
          .filter((l) => l !== swallowed)
          .map((letter) => (
            <Carry
              key={`${round.target}-${letter}`}
              enabled={!locked}
              onFeed={() => pick(letter)}
              onTap={() => replayPrompt(round)}
              dropAboveY={dropLine}
              onOverChange={(over) => !locked && setMood(over ? 'anticipate' : 'idle')}
            >
              {/* on a second miss the right piece is ringed, so the ring does
                  the pointing — a shadow on a transparent view draws nothing */}
              <View
                testID={hint === letter ? `ringed-${letter}` : `piece-${letter}`}
                style={hint === letter ? styles.glow : undefined}
              >
                <Sushi
                  chunks={[letter]}
                  scale={round.options.length > 3 ? 0.85 : 1.05}
                  showSeams={false}
                />
              </View>
            </Carry>
          ))}
      </View>
      <View style={styles.counter} />

      {/* level breadcrumb, for the parent only */}
      <View style={styles.dots}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.dot, n <= level && styles.dotOn]} />
        ))}
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  exit: { position: 'absolute', top: 0, left: 0, width: 64, height: 64, zIndex: 30 },
  room: { alignItems: 'center', paddingTop: 6 },
  plate: { flexDirection: 'row', gap: 6, marginTop: 4 },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,248,231,0.18)',
  },
  pipEaten: { backgroundColor: LANTERN },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  wordHint: {
    color: CREAM,
    opacity: 0.75,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  again: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,248,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  againText: { fontSize: 26 },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 20,
    marginTop: 'auto',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  /* The right piece is ringed on a second miss. This used to be a shadow,
     which iOS declines to draw on a view with no background — so the hint that
     was supposed to rescue him after two wrong answers did nothing at all. */
  glow: {
    borderRadius: 20,
    borderWidth: 5,
    borderColor: LANTERN,
    padding: 3,
  },
  counter: { height: 16, backgroundColor: WOOD, borderTopWidth: 4, borderTopColor: WOOD_DARK },
  dots: { position: 'absolute', right: 10, bottom: 6, flexDirection: 'row', gap: 4, opacity: 0.25 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,248,231,0.3)' },
  dotOn: { backgroundColor: CREAM },
});
