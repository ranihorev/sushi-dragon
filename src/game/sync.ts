/**
 * Putting two iPads' versions of the truth back together.
 *
 * The house has a phone and an iPad, and they are used for different halves of
 * the same thing: words get added on the phone at bedtime, with the book still
 * open, and meals get eaten on the iPad. So both devices are writing, all the
 * time, to different parts of one record — which rules out the obvious scheme.
 * If the newest whole copy won, the iPad's meal would erase the word you added
 * last night, or the word would erase the meal. One of them, every time.
 *
 * So the copies merge. Three rules do all the work:
 *
 *   counters take the larger of the two
 *   choices take the more recent
 *   a word you deleted stays deleted, because the deletion is written down
 *
 * The first rule is why this file adds nothing up. Summing would be more
 * accurate when two devices really have been used at once — but it is only safe
 * if each device's file holds that device's own contribution and nothing else,
 * and then no single file is a complete record and no single file can restore a
 * lost iPad. Taking the larger lets every device write back the whole merged
 * picture, which makes each file a full backup, and makes merging the same
 * thing twice a no-op. The cost is that three readings on one device and three
 * on the other count as three. Under-counting slows a word down; double
 * counting would put a word in the hoard he cannot actually read.
 *
 * Nothing in here touches a file, a clock or a native module, which is the
 * point: this is the part that is worth being certain about, so it is testable
 * in milliseconds.
 */

import type { DragonProfile, WordStat } from './progress';
import { statFor } from './progress';
import type { Tombstones, Word } from './words';

/** The part of a device's state that belongs to everybody. */
export interface Shared {
  profile: DragonProfile;
  words: Word[];
  tombstones: Tombstones;
}

/** One device's file in iCloud: the shared state, plus who wrote it and when. */
export interface DeviceState extends Shared {
  version: 1;
  deviceId: string;
  writtenAt: string;
}

const later = (a: string, b: string) => (a > b ? a : b);

/**
 * Merge any number of devices' states into the one they should all agree on.
 *
 * Order does not matter and repetition does not matter: merging the same states
 * in a different order, or merging a result back into itself, gives the same
 * answer. That is not a nicety — devices sync in whatever order they happen to
 * wake up in, and each writes its answer back where the others will read it, so
 * anything less would have the two iPads arguing forever.
 */
export function merge(states: Shared[]): Shared {
  if (!states.length) throw new Error('nothing to merge');
  return states.map(canonical).reduce(pair);
}

/**
 * One state, written the one way it is allowed to be written.
 *
 * Merging a state with itself is exactly what tidying it up means: the larger
 * of two equal numbers, the union of a set with itself, the same words sorted
 * and de-duplicated, every key in a fixed order. Defining it this way rather
 * than by hand means it cannot drift away from what the merge actually does.
 *
 * It matters because of what the engine does with the answer. Each device
 * writes the merged view back into its own file, and watches the folder for
 * files that changed. If the same answer could be spelled two ways, every sync
 * would look like news to the other device, which would sync, which would look
 * like news to this one — two iPads talking to each other about nothing for as
 * long as the battery lasts.
 */
export const canonical = (state: Shared): Shared => pair(state, state);

function pair(a: Shared, b: Shared): Shared {
  const tombstones = mergeTombstones(a.tombstones, b.tombstones);
  return {
    profile: mergeProfiles(a.profile, b.profile),
    words: mergeWords(a.words, b.words, tombstones),
    tombstones,
  };
}

/**
 * Two notes about the same word: the later one, since a word can be re-added.
 * Sorted, for the same reason `mergeStats` is.
 */
function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const out: Tombstones = {};
  for (const word of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    out[word] = later(a[word] ?? '', b[word] ?? '');
  }
  return out;
}

/**
 * The newest copy of each word, minus the ones a deletion outranks.
 *
 * A tombstone only wins if it is newer than the word it is pointed at, which is
 * what lets you change your mind: add `was` back after deleting it and the new
 * copy is newer than the note, so it stays. Delete it and never touch it again
 * and the note is newer forever, so the copy still sitting on the other iPad
 * cannot bring it back.
 */
function mergeWords(a: Word[], b: Word[], tombstones: Tombstones): Word[] {
  const best = new Map<string, Word>();
  for (const word of [...a, ...b]) {
    const held = best.get(word.text);
    if (!held || newer(word, held)) best.set(word.text, word);
  }

  return [...best.values()]
    .filter((w) => !((tombstones[w.text] ?? '') > w.updatedAt))
    .sort((x, y) => x.addedAt.localeCompare(y.addedAt) || x.text.localeCompare(y.text));
}

/**
 * Which of two copies of a word is the one to keep.
 *
 * The tie-break matters more than it looks. Two devices can hold copies stamped
 * the same millisecond — most often the same word, seeded from the same starter
 * list on both — and if the answer depended on which file was read first, the
 * two iPads would write different answers back and undo each other on every
 * sync. Comparing something about the word itself ends it.
 */
function newer(word: Word, held: Word): boolean {
  if (word.updatedAt !== held.updatedAt) return word.updatedAt > held.updatedAt;
  return signature(word) > signature(held);
}

const signature = (w: Word) => `${w.chunks.join('·')}|${w.voiceKey ?? ''}|${w.source}`;

function mergeProfiles(a: DragonProfile, b: DragonProfile): DragonProfile {
  const chosen = settingsWinner(a, b);
  return {
    version: 1,
    stats: mergeStats(a, b),
    mealsCompleted: Math.max(a.mealsCompleted, b.mealsCompleted),
    // earned, and never taken away again, so having it anywhere means having it
    decorations: [...new Set([...a.decorations, ...b.decorations])].sort(),
    lastPlayed: later(a.lastPlayed, b.lastPlayed),
    dayStreak: Math.max(a.dayStreak, b.dayStreak),
    introSeen: a.introSeen || b.introSeen,
    settings: chosen.settings,
    settingsAt: chosen.settingsAt,
  };
}

/**
 * The settings move as one, so a half-applied pair of choices cannot happen.
 *
 * When neither has been stamped, the device that has actually been used wins.
 * That is not a detail: a profile written before settings were stamped carries
 * no time at all, so an iPad set to four words a sitting last spring ties with
 * a phone installed this morning, and the tie has to be broken by something
 * better than which number is bigger. Meals eaten is the closest thing to
 * evidence that somebody meant it.
 */
function settingsWinner(a: DragonProfile, b: DragonProfile): DragonProfile {
  if (a.settingsAt !== b.settingsAt) return a.settingsAt > b.settingsAt ? a : b;
  if (a.mealsCompleted !== b.mealsCompleted) return a.mealsCompleted > b.mealsCompleted ? a : b;
  if (a.settings.roundsPerMeal !== b.settings.roundsPerMeal) {
    return a.settings.roundsPerMeal > b.settings.roundsPerMeal ? a : b;
  }
  return a.settings.parentCheck ? a : b;
}

/**
 * Sorted, because the bytes have to come out the same both ways round.
 *
 * The merge is already order-independent in its content; leaving the keys in
 * whichever order the two devices happened to insert them would still write two
 * different files for one answer. Each device watches the container for
 * changes, so a file that differs only in key order reads as news, and the pair
 * spend the evening telling each other about it.
 */
function mergeStats(a: DragonProfile, b: DragonProfile): Record<string, WordStat> {
  const out: Record<string, WordStat> = {};
  for (const word of [...new Set([...Object.keys(a.stats), ...Object.keys(b.stats)])].sort()) {
    out[word] = mergeStat(statFor(a, word), statFor(b, word));
  }
  return out;
}

/**
 * One word's history, as seen from two iPads.
 *
 * The counters take the larger. The window of recent verdicts cannot be merged
 * that way — it is a sequence, and half of one device's plus half of the
 * other's is a history that never happened — so it is taken whole from whichever
 * device has watched the word more closely.
 */
function mergeStat(a: WordStat, b: WordStat): WordStat {
  const fuller = closerWatched(a, b);
  return {
    seen: Math.max(a.seen, b.seen),
    spoken: Math.max(a.spoken, b.spoken),
    lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
    recent: fuller.recent,
    last: fuller.last ?? (fuller === a ? b.last : a.last),
  };
}

/** Deterministic, and symmetric — see the tie-break note on `newer`. */
function closerWatched(a: WordStat, b: WordStat): WordStat {
  if (a.seen !== b.seen) return a.seen > b.seen ? a : b;
  if (a.spoken !== b.spoken) return a.spoken > b.spoken ? a : b;
  if (a.lastSeenAt !== b.lastSeenAt) return a.lastSeenAt > b.lastSeenAt ? a : b;
  return a.recent.join('|') >= b.recent.join('|') ? a : b;
}
