import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeAway } from '@/components/SwipeAway';
import * as cloud from '@/game/cloud';
import { grip, isSolid, statFor, type DragonProfile } from '@/game/progress';
import * as store from '@/game/storage';
import type { Word } from '@/game/words';
import { leave } from '@/leaving';
import { CREAM, FIRE, LANTERN, NIGHT, SCALE, WASABI } from '@/theme';

/**
 * The grown-ups' side.
 *
 * Three jobs: see what he can read, add the words he can't, and make sure the
 * list cannot be lost. Everything here is reversible and nothing here is
 * urgent, so it is allowed to be a plain list rather than a designed thing.
 */
export default function ParentScreen() {
  const [words, setWords] = useState<Word[]>(() => store.loadDictionary());
  const [profile, setProfile] = useState<DragonProfile>(() => store.loadProfile());

  const [sync, setSync] = useState<cloud.SyncState>(() => cloud.current());

  const refresh = useCallback(() => {
    setWords(store.loadDictionary());
    setProfile(store.loadProfile());
  }, []);

  /* This is the screen a word arrives on. Somebody adds one on the phone, walks
     into the next room, and is looking at exactly the list that is about to
     change — so it reads itself again when a sync lands rather than waiting to
     be closed and reopened. */
  useEffect(
    () =>
      cloud.watch((next) => {
        setSync(next);
        if (!next.busy) refresh();
      }),
    [refresh],
  );

  const setSetting = <K extends keyof DragonProfile['settings']>(
    key: K,
    value: DragonProfile['settings'][K],
  ) => {
    /* Stamped, because the other iPad has settings too and they are choices
       rather than counters — the newer decision wins, and without a time on it
       there is no such thing as newer. */
    const next = {
      ...profile,
      settings: { ...profile.settings, [key]: value },
      settingsAt: new Date().toISOString(),
    };
    setProfile(next);
    store.saveProfile(next);
  };

  /* `removeWord` also writes down that you meant it. Without that note the
     other iPad, which still has the word, hands it straight back. */
  const drop = (word: Word) => setWords(store.removeWord(word.text, words));

  /* There is a confirmation because the recording goes with the word and a
     recording cannot be got back. The button, on the other hand, is right there
     on the row: removing a word used to be a long press with a line of small
     print at the bottom of the screen explaining that it existed, which is a
     feature nobody has. */
  const remove = (word: Word) => {
    Alert.alert(`Remove “${word.text}”?`, 'Its recording goes with it.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => drop(word) },
    ]);
  };

  const known = words.filter((w) => isSolid(profile, w.text)).length;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <Pressable onPress={leave} hitSlop={16} accessibilityRole="button">
            <Text style={styles.back}>‹ back</Text>
          </Pressable>
          <Text style={styles.count}>
            {known} of {words.length} words
            {profile.dayStreak > 1 ? ` · ${profile.dayStreak} days running` : ''}
          </Text>
        </View>

        <Link href="/dragon/add-word" asChild>
          <Pressable style={styles.add} accessibilityRole="button">
            <Text style={styles.addText}>+ a word he got stuck on</Text>
          </Pressable>
        </Link>

        {words.map((word) => {
          const stat = statFor(profile, word.text);
          return (
            <SwipeAway
              key={word.text}
              onRemove={() => remove(word)}
              label={`${word.text} — swipe left to remove`}
            >
              <View style={styles.word}>
                <View style={styles.wordMain}>
                  <Text style={styles.wordText}>{word.chunks.join('·')}</Text>
                  {word.tricky && <View style={styles.dot} />}
                  {!store.hasVoice(word.text) && <Text style={styles.silent}>no voice</Text>}
                  <View style={styles.spacer} />
                  <Pressable
                    onPress={() => remove(word)}
                    hitSlop={10}
                    style={styles.drop}
                    accessibilityRole="button"
                    accessibilityLabel={`remove ${word.text}`}
                  >
                    <Text style={styles.dropText}>remove</Text>
                  </Pressable>
                </View>

                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(grip(stat) * 100)}%`,
                        backgroundColor: isSolid(profile, word.text) ? SCALE : FIRE,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.meta}>
                  {stat.seen === 0
                    ? 'not met yet'
                    : `read ${stat.spoken}× · ${stat.last ?? 'seen'}${
                        word.source ? ` · ${word.source}` : ''
                      }`}
                </Text>

                {/* Why this word is marked. The game has always known it and has
                    never said it anywhere you could read it. */}
                {word.tricky && (
                  <Text style={styles.lying}>
                    the “{word.text.slice(word.tricky.start, word.tricky.end)}” {word.tricky.says}
                  </Text>
                )}
              </View>
            </SwipeAway>
          );
        })}

        {/* The rules, written down somewhere they can be found again. They
            used to exist only in the game itself, which explained them by
            playing them — fine for the child, no help at all for the adult
            being asked to run it. */}
        <Text style={styles.section}>How the game works</Text>
        <Text style={styles.hint}>
          A meal is a handful of words. Each one arrives as a round, and which round it gets depends
          on how well he knows it:
        </Text>
        {[
          'New word — the dragon sears it and says it. Nothing is scored.',
          'Heard it — the dragon asks for a word out loud; he drags the right sushi up to its mouth.',
          'In pieces — a long word arrives cut into syllables to put back in order.',
          'Read it — the word alone. He reads it out loud, feeds it, and you tap how it went.',
          'A green mark on a letter means that letter does not say its usual sound. It is only drawn while a word is being introduced, alongside the line that explains it — on a counter of three it was a green dab on the right answer and nowhere else. Every marked word in the list above says what it is up to.',
        ].map((line) => (
          <Text key={line} style={styles.rule}>
            · {line}
          </Text>
        ))}
        <Text style={styles.hint}>
          Words he reads well go on the shelf behind the counter, and come back less often. Words he
          stumbles on come back tomorrow. The dragon speaks in the iPad&apos;s voice until you
          record one — a word with your own voice on it is worth far more to him.
        </Text>

        {/* Two switches, and both used to be named after the parent rather than
            after what they do to the game — "I sit with him and tap how it went"
            says nothing about which rounds disappear if you turn it off. */}
        <Text style={styles.section}>Settings</Text>

        <View style={styles.setting}>
          <Text style={styles.settingText}>Include rounds where he reads aloud</Text>
          <Switch
            value={profile.settings.parentCheck}
            onValueChange={(v) => setSetting('parentCheck', v)}
          />
        </View>
        <Text style={styles.hint}>
          {profile.settings.parentCheck
            ? 'On: a word he knows well appears with no sound at all. He reads it to you, feeds it, and three buttons ask you how it went. This is the round that teaches the most, and it only works with somebody listening.'
            : 'Off: every round can be marked right or wrong by the game itself, so he can play alone. Nothing asks him to read out loud.'}
        </Text>

        <View style={styles.setting}>
          <Text style={styles.settingText}>Words in one sitting</Text>
          <View style={styles.stepper}>
            {[4, 6, 8].map((n) => (
              <Pressable
                key={n}
                onPress={() => setSetting('roundsPerMeal', n)}
                style={[styles.step, profile.settings.roundsPerMeal === n && styles.stepOn]}
                accessibilityRole="button"
                accessibilityLabel={`${n} words in one sitting`}
              >
                <Text style={styles.stepText}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.hint}>
          How many words the dragon eats before it is full and the game stops. Four is about two
          minutes. Stop before he wants to stop.
        </Text>

        <Text style={styles.section}>iCloud</Text>
        <Pressable
          onPress={() => void cloud.sync()}
          accessibilityRole="button"
          accessibilityLabel="check iCloud now"
        >
          <Text style={styles.hint}>{syncLine(sync)}</Text>
        </Pressable>
        {/* There used to be a `Save a copy` / `Restore` pair here, and the
            reason it is gone is not that iCloud replaced it — it is that a
            backup somebody has to remember to take is a backup nobody has. What
            it protected against, iCloud now holds all the time and on more than
            one device. */}
        <Text style={styles.hint}>
          Words, progress and your recordings travel between every device signed into the same
          iCloud account — add a word on your phone at bedtime and it is on the iPad. Each device
          keeps a whole copy, so a lost or replaced iPad costs you nothing. Tap the line above to
          check now.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What the sync is doing, in one line a tired adult can act on.
 *
 * Signed out is the only one of these that asks anything of anybody, so it is
 * the only one that says where to go. The rest are there to answer the single
 * question this screen gets asked — *has the word I just added arrived?* — and
 * a recording still on its way is worth mentioning, because the dragon will be
 * reading that word in the iPad's own voice until it lands.
 */
function syncLine(state: cloud.SyncState): string {
  if (!state.on) return 'iCloud is off — turn it on in Settings to share with another device';
  if (state.busy) return 'iCloud · checking…';
  if (!state.at) return 'iCloud · not checked yet';

  const waiting = state.waiting ? ` · ${state.waiting} recording${plural(state.waiting)} still coming` : '';
  return `iCloud · synced ${ago(state.at)}${waiting}`;
}

const plural = (n: number) => (n === 1 ? '' : 's');

function ago(at: string): string {
  const minutes = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${plural(minutes)} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${plural(hours)} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${plural(days)} ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  body: { padding: 22, gap: 10, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: LANTERN, fontSize: 16 },
  count: { color: CREAM, opacity: 0.6, fontSize: 14 },
  add: {
    backgroundColor: FIRE,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 8,
  },
  addText: { color: NIGHT, fontWeight: '800', fontSize: 16 },
  word: {
    backgroundColor: 'rgba(255,248,231,0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  wordMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordText: { color: CREAM, fontSize: 20, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WASABI },
  silent: { color: '#ff8f5e', fontSize: 11, opacity: 0.8 },
  spacer: { flex: 1 },
  drop: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,248,231,0.25)',
  },
  dropText: { color: CREAM, opacity: 0.7, fontSize: 12 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,248,231,0.12)' },
  barFill: { height: 4, borderRadius: 2 },
  meta: { color: CREAM, opacity: 0.45, fontSize: 12 },
  section: { color: CREAM, fontSize: 17, fontWeight: '700', marginTop: 26 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  settingText: { color: CREAM, fontSize: 15, flex: 1 },
  hint: { color: CREAM, opacity: 0.45, fontSize: 12, lineHeight: 17 },
  rule: { color: CREAM, opacity: 0.6, fontSize: 13, lineHeight: 19, paddingLeft: 4 },
  lying: { color: WASABI, opacity: 0.85, fontSize: 12, marginTop: 3 },
  stepper: { flexDirection: 'row', gap: 6 },
  step: {
    width: 40,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,248,231,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOn: { backgroundColor: LANTERN },
  stepText: { color: NIGHT, fontWeight: '700' },
});
