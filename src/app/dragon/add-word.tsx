import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SeamEditor } from '@/components/SeamEditor';
import { Sushi } from '@/components/Sushi';
import * as store from '@/game/storage';
import { family, makeWord, reseam, type Word } from '@/game/words';
import { relatives } from '@/game/families';
import { CREAM, FIRE, LANTERN, NIGHT, WASABI } from '@/theme';

/**
 * Adding a word he couldn't read.
 *
 * Designed for one moment: it is bedtime, he has just stalled on a word, and
 * the book is still open. Anything that takes longer than about twenty seconds
 * will not survive contact with that moment, so the whole thing is type it,
 * check the cuts, hold a button and say it.
 *
 * Your own voice rather than a synthesised one, because it is better to listen
 * to and because it works with no network, no API key and no waiting.
 */
export default function AddWordScreen() {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [withFamily, setWithFamily] = useState(true);
  const [take, setTake] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  useEffect(() => {
    void (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setGranted(status.granted);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const word = useMemo(() => {
    const built = makeWord(text);
    return chunks.length && chunks.join('') === built.text ? reseam(built, chunks) : built;
  }, [text, chunks]);

  // a fresh word gets fresh seams, until you move one yourself
  useEffect(() => setChunks([]), [text]);

  const kin = relatives(word.text);

  const startRecording = async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    await recorder.stop();
    if (recorder.uri) setTake(recorder.uri);
  };

  const hear = () => {
    if (!take) return;
    const player = createAudioPlayer({ uri: take });
    player.play();
    setTimeout(() => player.remove(), 4000);
  };

  const save = () => {
    if (!word.text) return;
    const dictionary = store.loadDictionary();
    const existing = dictionary.findIndex((w) => w.text === word.text);

    const entry: Word = { ...word, source, voice: take ? 'recorded' : 'none' };
    const next = [...dictionary];
    if (existing >= 0) next[existing] = entry;
    else next.push(entry);

    /* One word he tripped on is really a pattern he does not own yet. Bringing
       the rest of the family in costs nothing here and means the next time he
       meets `light` he has already met its shape. */
    if (withFamily) {
      for (const relative of family(entry)) {
        if (!next.some((w) => w.text === relative.text)) next.push(relative);
      }
    }

    store.saveDictionary(next);
    if (take) store.keepRecording(word.text, take);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>The word he got stuck on</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="dragon"
          placeholderTextColor="rgba(255,248,231,0.3)"
          autoFocus
        />

        {word.text.length > 1 && (
          <>
            <Text style={styles.label}>How it gets cut up — tap to move a seam</Text>
            <SeamEditor text={word.text} chunks={word.chunks} onChange={setChunks} />

            <Text style={styles.label}>On the counter it looks like this</Text>
            <View style={styles.preview}>
              <Sushi chunks={word.chunks} tricky={word.tricky} scale={0.7} />
            </View>

            {word.tricky && (
              <Text style={styles.tricky}>
                {word.text.slice(word.tricky.start, word.tricky.end)} {word.tricky.says} — it gets
                the wasabi
              </Text>
            )}

            <Text style={styles.label}>Say it, in your voice</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.record, state.isRecording && styles.recording]}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={!granted}
                accessibilityRole="button"
                accessibilityLabel="hold to record"
              >
                <Text style={styles.recordText}>
                  {state.isRecording ? 'listening…' : take ? 'record again' : 'hold and say it'}
                </Text>
              </Pressable>

              {take && !state.isRecording && (
                <Pressable style={styles.hear} onPress={hear} accessibilityRole="button">
                  <Text style={styles.hearText}>▶ hear it</Text>
                </Pressable>
              )}
            </View>
            {!granted && <Text style={styles.warn}>Microphone permission was declined.</Text>}

            {kin.length > 0 && (
              <View style={styles.family}>
                <Switch value={withFamily} onValueChange={setWithFamily} />
                <Text style={styles.familyText}>
                  also add {kin.slice(0, 4).join(', ')}
                  {kin.length > 4 ? ` and ${kin.length - 4} more` : ''}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Where you met it (optional)</Text>
            <TextInput
              style={styles.input}
              value={source}
              onChangeText={setSource}
              placeholder="the bedtime book"
              placeholderTextColor="rgba(255,248,231,0.3)"
            />

            <Pressable style={styles.save} onPress={save} accessibilityRole="button">
              <Text style={styles.saveText}>Add to the dictionary</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  body: { padding: 24, gap: 10, paddingBottom: 60 },
  label: { color: CREAM, opacity: 0.55, fontSize: 13, marginTop: 12 },
  input: {
    backgroundColor: 'rgba(255,248,231,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: CREAM,
    fontSize: 22,
  },
  preview: { alignSelf: 'flex-start' },
  tricky: { color: WASABI, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  record: {
    backgroundColor: FIRE,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 14,
  },
  recording: { backgroundColor: '#ff4d00' },
  recordText: { color: NIGHT, fontWeight: '700', fontSize: 16 },
  hear: { paddingHorizontal: 14, paddingVertical: 14 },
  hearText: { color: LANTERN, fontSize: 15 },
  warn: { color: '#ff8f5e', fontSize: 13 },
  family: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  familyText: { color: CREAM, opacity: 0.75, fontSize: 14, flex: 1 },
  save: {
    marginTop: 24,
    backgroundColor: LANTERN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: NIGHT, fontWeight: '800', fontSize: 17 },
});
