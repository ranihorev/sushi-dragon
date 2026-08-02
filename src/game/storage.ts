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
import type { Tombstones, Word } from './words';
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
 * Work out the misbehaving letters again, rather than trusting the copy on disk,
 * and fill in anything a word written by an older version of the app is missing.
 *
 * Which letters lie and what they say instead belongs to the app, not to the
 * child: it was written down beside the word the day the word was added, and if
 * that sentence is later improved — as it was, from `says /u/, as in cup` to
 * something a parent can read — every word already on the iPad would otherwise
 * keep the old one forever. Seams are left alone, because those can be
 * corrected by hand and that correction is his.
 *
 * The two sync fields are filled in rather than demanded, because there are
 * already words on an iPad that predate them. A word with no `updatedAt` is
 * dated by the day it was added, which loses every argument with a word edited
 * since — correct, because it has not been touched since either.
 */
const retrick = (word: Word): Word => ({
  ...word,
  tricky: trickySpan(word.text),
  updatedAt: word.updatedAt ?? `${word.addedAt}T00:00:00.000Z`,
  voiceKey: word.voiceKey ?? null,
});

export const saveDictionary = (words: Word[]) => writeJson('words.json', words);

/**
 * The words you threw away, and when.
 *
 * Without this list a deletion does not survive contact with a second device.
 * Remove `was` on the iPad, and the phone — which still has it — hands it back
 * at the next sync, and neither device can tell the difference between a word
 * that was just added and a word that was just deleted somewhere else. A note
 * saying *this went, at this moment* is the only thing that can outrank a copy
 * of the word itself.
 *
 * Nothing prunes these. They are a word and a timestamp, they arrive at the
 * rate a parent presses `remove`, and the day that becomes a storage problem is
 * a day worth celebrating.
 */
export const loadTombstones = (): Tombstones => readJson<Tombstones>('removed.json') ?? {};

export const saveTombstones = (t: Tombstones) => writeJson('removed.json', t);

/** Throw a word away — the recording, and the note saying you meant it. */
export function removeWord(word: string, words: Word[]): Word[] {
  saveTombstones({ ...loadTombstones(), [word]: new Date().toISOString() });
  forgetRecording(word);
  const next = words.filter((w) => w.text !== word);
  saveDictionary(next);
  return next;
}

/**
 * What only this iPad knows about itself.
 *
 * The name it writes under in iCloud, and which recording each local file is a
 * copy of. Neither is any of another device's business, so neither is synced.
 */
export interface LocalState {
  deviceId: string;
  /** word → the `voiceKey` the local `voice/<word>.m4a` was copied from */
  pulled: Record<string, string>;
  lastSyncAt: string;
}

/**
 * A name for this device, made once and kept.
 *
 * Random rather than the device's own identifier, because the only thing it has
 * to do is differ from the other iPad in the house, and a borrowed identifier
 * is a promise about privacy that this does not need to make.
 */
export function localState(): LocalState {
  const stored = readJson<Partial<LocalState>>('local.json');
  if (stored?.deviceId) return { pulled: {}, lastSyncAt: '', ...stored } as LocalState;
  const fresh: LocalState = {
    deviceId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    pulled: {},
    lastSyncAt: '',
  };
  saveLocalState(fresh);
  return fresh;
}

export const saveLocalState = (s: LocalState) => writeJson('local.json', s);

/** Where a word's recording lives — one file per word, named after it. */
export const voiceFile = (word: string) => new File(dirs().voice, `${word}.m4a`);

export const hasVoice = (word: string) => {
  try {
    return voiceFile(word).exists;
  } catch {
    return false;
  }
};

/**
 * Move a fresh recording into place, replacing any earlier take, and hand back
 * the name it will travel under.
 *
 * The name is minted here rather than in iCloud's half of the code because this
 * is the moment the recording comes into existence, and a recording made on a
 * kitchen table with no signal still has to be able to get a name.
 */
export function keepRecording(word: string, from: string): string {
  ensure();
  const target = voiceFile(word);
  if (target.exists) target.delete();
  new File(from).move(target);

  const local = localState();
  const key = `${word}-${local.deviceId}-${Date.now().toString(36)}.m4a`;
  saveLocalState({ ...local, pulled: { ...local.pulled, [word]: key } });
  return key;
}

export function forgetRecording(word: string) {
  try {
    const file = voiceFile(word);
    if (file.exists) file.delete();
    const local = localState();
    const { [word]: _gone, ...rest } = local.pulled;
    saveLocalState({ ...local, pulled: rest });
  } catch {
    /* no file system here — there was nothing to forget */
  }
}

/* There were an `exportAll` and an `importAll` here, which put everything —
   including every recording, base64'd — into one file for the share sheet, and
   read one back. They are gone. Not because iCloud does the same job, but
   because they only ever ran when somebody remembered to press a button, and
   what they were protecting against is a lost iPad, which does not send a
   warning first. `cloud.ts` writes a whole copy of this device to iCloud after
   every meal and every word, and each other device keeps one too. */
