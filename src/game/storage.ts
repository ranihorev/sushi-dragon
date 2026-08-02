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
import { trickySpan } from './tricky';
import type { Word } from './words';
import { starterDictionary } from './words';

/**
 * Both folders are found on first use, and never at import time.
 *
 * The dev server renders every screen once in node before it serves anything,
 * and in node there is no file system behind `expo-file-system`: asking it for
 * the document directory throws. Built at module scope, that throw happened
 * while this module was being imported, which killed every screen that touches
 * storage — that is, all of them — and the app served a 500 instead of a game.
 *
 * Found lazily, the same throw lands inside the try/catch of whichever function
 * asked, and a platform with no file system simply plays without a memory.
 */
let root: Directory | undefined;
let voice: Directory | undefined;

function dirs() {
  if (!root || !voice) {
    root = new Directory(Paths.document, 'sushi-dragon');
    voice = new Directory(root, 'voice');
  }
  return { root, voice };
}

function ensure() {
  const { root, voice } = dirs();
  if (!root.exists) root.create({ intermediates: true });
  if (!voice.exists) voice.create({ intermediates: true });
}

function readJson<T>(name: string): T | null {
  try {
    ensure();
    const file = new File(dirs().root, name);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown) {
  try {
    ensure();
    const file = new File(dirs().root, name);
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
  if (stored?.length) return stored.map(retrick);
  const seeded = starterDictionary();
  saveDictionary(seeded);
  return seeded;
}

/**
 * Work out the misbehaving letters again, rather than trusting the copy on disk.
 *
 * Which letters lie and what they say instead belongs to the app, not to the
 * child: it was written down beside the word the day the word was added, and if
 * that sentence is later improved — as it was, from `says /u/, as in cup` to
 * something a parent can read — every word already on the iPad would otherwise
 * keep the old one forever. Seams are left alone, because those can be
 * corrected by hand and that correction is his.
 */
const retrick = (word: Word): Word => ({ ...word, tricky: trickySpan(word.text) });

export const saveDictionary = (words: Word[]) => writeJson('words.json', words);

/** Where a word's recording lives — one file per word, named after it. */
export const voiceFile = (word: string) => new File(dirs().voice, `${word}.m4a`);

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
