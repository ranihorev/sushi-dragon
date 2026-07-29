/**
 * Where everything lives on the iPad.
 *
 * All of it sits under the app's *document* directory rather than the cache,
 * and that choice is the entire backup story: documents are included in the
 * device's iCloud backup, caches are not. So a lost or replaced iPad costs you
 * nothing — the word list, the progress and the recordings of you saying each
 * word all come back with the restore.
 *
 * This module is deliberately thin. Nothing here decides anything; the parts
 * worth being sure about — how a word is cut up, which words rhyme, whether he
 * can read one — live in modules with no file system in them, so they can be
 * tested in milliseconds without a simulator.
 */

import { Directory, File, Paths } from 'expo-file-system';

import type { DragonProfile } from './progress';
import { blankProfile } from './progress';
import type { Word } from './words';
import { starterDictionary } from './words';

const ROOT = new Directory(Paths.document, 'sushi-dragon');
const VOICE = new Directory(ROOT, 'voice');

function ensure() {
  if (!ROOT.exists) ROOT.create({ intermediates: true });
  if (!VOICE.exists) VOICE.create({ intermediates: true });
}

function readJson<T>(name: string): T | null {
  try {
    ensure();
    const file = new File(ROOT, name);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown) {
  try {
    ensure();
    const file = new File(ROOT, name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    /* out of space, or a permission we don't have — the game plays on, it just
       won't remember this session. Losing a meal beats crashing mid-meal. */
  }
}

export const loadProfile = (): DragonProfile =>
  ({ ...blankProfile(), ...readJson<DragonProfile>('profile.json') });

export const saveProfile = (p: DragonProfile) => writeJson('profile.json', p);

/** First run seeds the starter words, so the dragon is never handed an empty counter. */
export function loadDictionary(): Word[] {
  const stored = readJson<Word[]>('words.json');
  if (stored?.length) return stored;
  const seeded = starterDictionary();
  saveDictionary(seeded);
  return seeded;
}

export const saveDictionary = (words: Word[]) => writeJson('words.json', words);

/** Where a word's recording lives — one file per word, named after it. */
export const voiceFile = (word: string) => new File(VOICE, `${word}.m4a`);

export const hasVoice = (word: string) => {
  try {
    return voiceFile(word).exists;
  } catch {
    return false;
  }
};

/** Move a fresh recording into place, replacing any earlier take. */
export function keepRecording(word: string, from: string) {
  ensure();
  const target = voiceFile(word);
  if (target.exists) target.delete();
  new File(from).move(target);
}

export function forgetRecording(word: string) {
  const file = voiceFile(word);
  if (file.exists) file.delete();
}

/**
 * Everything, as one file you can hand to the share sheet.
 *
 * The recordings are the bulky part and they are also the part you cannot
 * regenerate, so they go in as base64 rather than being left behind. Saving
 * the result to Files → iCloud Drive is the manual backup, and the only one
 * that survives deleting the app.
 */
export function exportAll(): string {
  const words = loadDictionary();
  const voices: Record<string, string> = {};
  for (const w of words) {
    const file = voiceFile(w.text);
    if (file.exists) voices[w.text] = file.base64Sync();
  }
  return JSON.stringify({ version: 1, profile: loadProfile(), words, voices });
}

export function importAll(json: string) {
  const data = JSON.parse(json) as {
    profile: DragonProfile;
    words: Word[];
    voices: Record<string, string>;
  };
  ensure();
  saveProfile(data.profile);
  saveDictionary(data.words);
  for (const [word, base64] of Object.entries(data.voices ?? {})) {
    const file = voiceFile(word);
    if (file.exists) file.delete();
    file.create();
    file.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
  }
}
