/**
 * Keeping the phone and the iPad in step.
 *
 * The merge in `sync.ts` decides what the answer is. This decides when to ask,
 * where the files go, and what to do when iCloud is not there — which, on any
 * given evening, it might not be.
 *
 * The shape is: write what we have, read what everybody else has, merge, keep
 * the answer, write the answer back. Every device does the same thing and none
 * of them is in charge, which is what makes it survive a device being off for a
 * week and rejoining.
 *
 * Nothing here is allowed to cost a meal. Every failure is swallowed, the same
 * way `storage.ts` swallows a full disk: a sync that did not happen is a sync
 * that happens in a minute, and a child holding a piece of sushi does not care
 * either way.
 */

import * as icloud from './icloud';
import * as store from './storage';
import { canonical, merge, type DeviceState, type Shared } from './sync';
import type { Word } from './words';

/** One file per device, and one file per recording, both under `Data/`. */
const DEVICES = 'devices';
const VOICE = 'voice';

export interface SyncState {
  /** there is an iCloud account, and we can reach the folder */
  on: boolean;
  busy: boolean;
  /** when this device last finished a sync, ISO, or '' for never */
  at: string;
  /** recordings the word list knows about that have not arrived here yet */
  waiting: number;
}

let state: SyncState = { on: false, busy: false, at: '', waiting: 0 };
let running: Promise<SyncState> | null = null;
const listeners = new Set<(s: SyncState) => void>();

export const current = () => state;

/**
 * Watch the sync, and the folder.
 *
 * One subscription does both jobs, because every caller that wants to know the
 * sync finished also wants to know the phone just added a word — the parent
 * screen is looking at exactly the list that changes.
 */
export function watch(onChange: (s: SyncState) => void): () => void {
  listeners.add(onChange);
  const fromCloud = icloud.watch(() => void sync());
  return () => {
    listeners.delete(onChange);
    fromCloud.remove();
  };
}

function announce(next: SyncState) {
  state = next;
  for (const listener of listeners) listener(next);
  return next;
}

/**
 * Sync, unless a sync is already happening, in which case join that one.
 *
 * The triggers overlap constantly — the app comes to the foreground, which is
 * also when iCloud notices the other device's file, which is also when the
 * screen that just opened asks. Three syncs at once would each read a
 * half-written answer and write three more.
 */
export function sync(): Promise<SyncState> {
  if (!running) running = run().finally(() => (running = null));
  return running;
}

async function run(): Promise<SyncState> {
  try {
    if (!(await icloud.isAvailable())) {
      return announce({ ...state, on: false, busy: false, waiting: 0 });
    }
    announce({ ...state, on: true, busy: true });

    const local = store.localState();
    const mine = canonical({
      profile: store.loadProfile(),
      words: store.loadDictionary(),
      tombstones: store.loadTombstones(),
    });

    await pushRecordings(mine.words, local.pulled);
    const merged = merge([mine, ...(await readOthers(local.deviceId))]);

    if (JSON.stringify(merged) !== JSON.stringify(mine)) {
      store.saveProfile(merged.profile);
      store.saveDictionary(merged.words);
      store.saveTombstones(merged.tombstones);
    }

    const waiting = await pullRecordings(merged.words);
    await publish(local.deviceId, merged);

    const at = new Date().toISOString();
    store.saveLocalState({ ...store.localState(), lastSyncAt: at });
    return announce({ on: true, busy: false, at, waiting });
  } catch {
    /* signed out mid-sync, no network, iCloud having a day. The words and the
       progress are all still on this device, which is where the game reads
       them from anyway. */
    return announce({ ...state, busy: false });
  }
}

/**
 * Write our own file — but only if it would say something new.
 *
 * This is the whole reason the merge produces identical bytes for identical
 * answers. Writing unconditionally would change the file on every sync, the
 * other device watches this folder, and the two of them would spend the evening
 * telling each other that nothing happened.
 */
async function publish(deviceId: string, merged: Shared) {
  const path = `${DEVICES}/${deviceId}.json`;
  const existing = parse(await icloud.read(path));
  if (existing && JSON.stringify(strip(existing)) === JSON.stringify(merged)) return;

  const file: DeviceState = {
    version: 1,
    deviceId,
    writtenAt: new Date().toISOString(),
    ...merged,
  };
  await icloud.write(path, JSON.stringify(file));
}

/** Everybody else's view of the truth. Ours is already in hand. */
async function readOthers(mine: string): Promise<Shared[]> {
  const files = await icloud.list(DEVICES);
  const others: Shared[] = [];

  for (const file of files) {
    if (!file.name.endsWith('.json') || file.name === `${mine}.json`) continue;
    const found = parse(await icloud.read(`${DEVICES}/${file.name}`));
    if (found) others.push(strip(found));
  }
  return others;
}

/**
 * A file another device wrote, or nothing.
 *
 * Nothing covers a good deal: a file half-written when we read it, a file from
 * a version of the app that has not been invented yet, a file iCloud handed
 * over empty. All of them mean the same thing here — merge what we can and
 * come back later — and none of them should stop the other devices being read.
 */
function parse(text: string | null): DeviceState | null {
  if (!text) return null;
  try {
    const found = JSON.parse(text) as DeviceState;
    return found?.version === 1 && found.profile && found.words ? found : null;
  } catch {
    return null;
  }
}

const strip = (file: DeviceState): Shared => ({
  profile: file.profile,
  words: file.words,
  tombstones: file.tombstones ?? {},
});

/**
 * Send up any recording iCloud has not got.
 *
 * `pulled` says which recording each local file is a copy of, so a word whose
 * key is in there is a word whose audio came from — or has already gone to —
 * the cloud. Anything else was recorded on this device just now.
 *
 * They are written once and never overwritten, which is why they can be
 * uploaded without coordinating with anybody: no other device will ever choose
 * the same name.
 */
async function pushRecordings(words: Word[], pulled: Record<string, string>) {
  const there = new Set((await icloud.list(VOICE)).map((f) => f.name));

  for (const word of words) {
    if (!word.voiceKey || there.has(word.voiceKey)) continue;
    if (pulled[word.text] !== word.voiceKey) continue;
    if (!store.hasVoice(word.text)) continue;
    await icloud.copyIn(`${VOICE}/${word.voiceKey}`, store.voiceFile(word.text).uri);
  }
}

/**
 * Fetch the recordings this device does not have, and count the ones still out.
 *
 * A recording that has not arrived is not a problem to report. The dragon
 * already knows what to do with a word it has no recording for — it reads it in
 * the iPad's own voice — so the only thing the count is for is telling a parent
 * that their voice is on the way.
 */
async function pullRecordings(words: Word[]): Promise<number> {
  const there = new Map((await icloud.list(VOICE)).map((f) => [f.name, f]));
  let waiting = 0;

  for (const word of words) {
    const key = word.voiceKey;
    if (!key) continue;

    const local = store.localState();
    if (local.pulled[word.text] === key && store.hasVoice(word.text)) continue;

    const item = there.get(key);
    if (!item) continue;

    if (!item.downloaded) {
      // ask, and count it — it will be here by the next sync
      await icloud.download(`${VOICE}/${key}`);
      waiting += 1;
      continue;
    }

    try {
      await icloud.copyOut(`${VOICE}/${key}`, store.voiceFile(word.text).uri);
      store.saveLocalState({
        ...local,
        pulled: { ...local.pulled, [word.text]: key },
      });
    } catch {
      // it will be there next time; the iPad's own voice covers the gap
      waiting += 1;
    }
  }
  return waiting;
}
