import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Link } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const refresh = useCallback(() => {
    setWords(store.loadDictionary());
    setProfile(store.loadProfile());
  }, []);

  const setSetting = <K extends keyof DragonProfile['settings']>(
    key: K,
    value: DragonProfile['settings'][K],
  ) => {
    const next = { ...profile, settings: { ...profile.settings, [key]: value } };
    setProfile(next);
    store.saveProfile(next);
  };

  const remove = (word: Word) => {
    Alert.alert(`Remove “${word.text}”?`, 'Its recording goes too.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          store.forgetRecording(word.text);
          const next = words.filter((w) => w.text !== word.text);
          store.saveDictionary(next);
          setWords(next);
        },
      },
    ]);
  };

  /* Save to Files → iCloud Drive and the list survives anything, including
     deleting the app. The recordings ride along inside the same file, because
     they are the one part you cannot regenerate. */
  const backup = async () => {
    try {
      const file = new File(Paths.cache, 'sushi-dragon-backup.json');
      if (file.exists) file.delete();
      file.create();
      file.write(store.exportAll());
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    } catch (error) {
      Alert.alert('Could not make a backup', String(error));
    }
  };

  const restore = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (picked.canceled) return;
    Alert.alert('Restore from this file?', 'It replaces the current words and progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: () => {
          try {
            store.importAll(new File(picked.assets[0].uri).textSync());
            refresh();
          } catch (error) {
            Alert.alert('That file could not be read', String(error));
          }
        },
      },
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
            <Pressable
              key={word.text}
              style={styles.word}
              onLongPress={() => remove(word)}
              accessibilityRole="button"
              accessibilityLabel={word.text}
            >
              <View style={styles.wordMain}>
                <Text style={styles.wordText}>{word.chunks.join('·')}</Text>
                {word.tricky && <View style={styles.dot} />}
                {!store.hasVoice(word.text) && <Text style={styles.silent}>no voice</Text>}
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
            </Pressable>
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
          'A green mark on a letter means that letter does not say its usual sound. Every marked word in the list above says what it is up to.',
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

        <Text style={styles.section}>Settings</Text>

        <View style={styles.setting}>
          <Text style={styles.settingText}>I sit with him and tap how it went</Text>
          <Switch
            value={profile.settings.parentCheck}
            onValueChange={(v) => setSetting('parentCheck', v)}
          />
        </View>
        <Text style={styles.hint}>
          Off, the game stops asking him to read aloud and only sets him rounds it can score by
          itself.
        </Text>

        <View style={styles.setting}>
          <Text style={styles.settingText}>Words per meal</Text>
          <View style={styles.stepper}>
            {[4, 6, 8].map((n) => (
              <Pressable
                key={n}
                onPress={() => setSetting('roundsPerMeal', n)}
                style={[styles.step, profile.settings.roundsPerMeal === n && styles.stepOn]}
                accessibilityRole="button"
              >
                <Text style={styles.stepText}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Backup</Text>
        <Text style={styles.hint}>
          The words and progress are already included in the iPad&apos;s iCloud backup. This is the
          copy you keep somewhere you choose — Files → iCloud Drive works well.
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.secondary} onPress={backup} accessibilityRole="button">
            <Text style={styles.secondaryText}>Save a copy</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={restore} accessibilityRole="button">
            <Text style={styles.secondaryText}>Restore</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Hold a word to remove it.</Text>
      </ScrollView>
    </SafeAreaView>
  );
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
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,248,231,0.25)',
  },
  secondaryText: { color: CREAM, fontSize: 15 },
});
