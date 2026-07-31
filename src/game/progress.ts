/**
 * What he can read, how well, and what to show him next.
 *
 * Two kinds of evidence arrive here and they are not worth the same. When he
 * reads a word off the sushi and you tap `got it`, that is production — the
 * thing we actually care about, and the strongest signal available. When he
 * hears a word and picks it out of four near-identical ones, that is
 * recognition: real evidence, obtainable without an adult in the room, but
 * weaker.
 *
 * Both feed one score, because the question that score answers is always the
 * same one — how soon should this word come round again? — and for that
 * question a correct pick really is evidence. The distinction is kept where it
 * actually matters instead: the hoard, the list that means *these are words my
 * son can read*, counts only the times he read it out loud. See `isSolid`.
 */

export type Verdict =
  /** read it straight off */
  | 'got'
  /** got there with a hint, a covered second half, a second look */
  | 'nudge'
  /** couldn't, and was told */
  | 'not-yet';

export interface WordStat {
  seen: number;
  /** how the last few showings went, oldest first — see `grip` */
  recent: Verdict[];
  /** meal index when last shown, for spacing */
  lastSeenAt: number;
  /** the last thing you tapped, so the parent screen can show it back */
  last: Verdict | null;
  /** times he read it out loud and you said he got it — see `isSolid` */
  spoken: number;
}

/** How many showings the score looks at. */
const WINDOW = 4;

export interface DragonSettings {
  roundsPerMeal: number;
  /** show the three check buttons — off when he plays on his own */
  parentCheck: boolean;
}

export interface DragonProfile {
  version: 1;
  stats: Record<string, WordStat>;
  mealsCompleted: number;
  decorations: string[];
  lastPlayed: string;
  dayStreak: number;
  settings: DragonSettings;
}

export function blankProfile(): DragonProfile {
  return {
    version: 1,
    stats: {},
    mealsCompleted: 0,
    // the room starts lit; an empty restaurant reads as broken rather than as promise
    decorations: ['lantern-left', 'lantern-right'],
    lastPlayed: '',
    dayStreak: 0,
    settings: { roundsPerMeal: 6, parentCheck: true },
  };
}

const NEVER_SEEN: WordStat = { seen: 0, recent: [], lastSeenAt: -99, last: null, spoken: 0 };

/** A stat as it was stored before the window replaced the running average. */
type StoredStat = Partial<WordStat> & { mastery?: number };

export const statFor = (p: DragonProfile, word: string): WordStat => {
  const stored = p.stats[word] as StoredStat | undefined;
  if (!stored) return NEVER_SEEN;
  return { ...NEVER_SEEN, ...stored, recent: stored.recent ?? spread(stored) };
};

/**
 * An old running-average score, read as a window of results.
 *
 * Nobody's hoard is allowed to empty because the scoring changed underneath
 * it, so a stored `mastery` is spread back across a full window worth the same
 * credit. It is a guess about a past that was never recorded in this much
 * detail, and it only has to be close.
 */
function spread(stored: StoredStat): Verdict[] {
  if (!stored.seen || stored.mastery === undefined) return [];
  const target = Math.round(stored.mastery * WINDOW * 2) / 2;
  const gots = Math.min(WINDOW, Math.floor(target));
  const half = target - gots >= 0.5 && gots < WINDOW ? 1 : 0;
  return [
    ...(Array(Math.max(0, WINDOW - gots - half)).fill('not-yet') as Verdict[]),
    ...(Array(half).fill('nudge') as Verdict[]),
    ...(Array(gots).fill('got') as Verdict[]),
  ].slice(-Math.min(WINDOW, stored.seen));
}

/**
 * How much a verdict is worth.
 *
 * `nudge` counts as half rather than as a failure because it is the most
 * common honest outcome and the one that should bring a word back tomorrow
 * instead of next week. Treating it as a miss would make almost everything
 * look broken; treating it as a pass would let words he can't quite read slip
 * out of rotation.
 */
const CREDIT: Record<Verdict, number> = { got: 1, nudge: 0.5, 'not-yet': 0 };

/**
 * How well he has hold of a word, 0..1.
 *
 * A window of the last few showings rather than a running average, and the
 * difference is not academic: an average settles on the child's own credit
 * rate, so a child who alternates `got` and `nudge` sits at 0.75 forever and
 * can never clear a bar set at 0.85 — a word he substantially reads, marked
 * permanently unlearnt. A window is a plain count of recent evidence, it can
 * reach the top, and one bad day cannot undo it for long.
 *
 * A part-filled window scores low on purpose. Four showings is not much to ask
 * before calling a word his, and until then the word keeps coming round.
 */
export const grip = (s: WordStat): number =>
  s.recent.reduce((n, v) => n + CREDIT[v], 0) / WINDOW;

function bump(prev: WordStat, verdict: Verdict, meal: number, spoke: boolean): WordStat {
  return {
    seen: prev.seen + 1,
    recent: [...prev.recent, verdict].slice(-WINDOW),
    lastSeenAt: meal,
    last: spoke ? verdict : prev.last,
    spoken: prev.spoken + (spoke && verdict === 'got' ? 1 : 0),
  };
}

/** He read it aloud and you said how it went. */
export function recordRead(p: DragonProfile, word: string, verdict: Verdict): DragonProfile {
  const stat = bump(statFor(p, word), verdict, p.mealsCompleted, true);
  return { ...p, stats: { ...p.stats, [word]: stat } };
}

/**
 * He heard it and picked it out — scored on the first attempt only.
 *
 * It counts in the window like anything else, because it is real evidence of
 * how well the word is going. What it cannot do is fill the hoard: `isSolid`
 * asks separately for times he has read the word out loud.
 */
export function recordPick(p: DragonProfile, word: string, correct: boolean): DragonProfile {
  const stat = bump(statFor(p, word), correct ? 'got' : 'not-yet', p.mealsCompleted, false);
  return { ...p, stats: { ...p.stats, [word]: stat } };
}

/** He put the slices back in the right order. */
export const recordOrder = recordPick;

/**
 * A word he owns — which requires having heard him say it.
 *
 * Picking a word out of a line-up eight times running is not proof he can read
 * it; it may only be proof that he can tell four shapes apart. Since the hoard
 * is meant to mean *these are words my son can read*, nothing enters it on
 * recognition alone. The cost is that a word he only ever meets while playing
 * on his own stays outside the hoard until the next time you sit with him —
 * which is the honest answer, and the same reason the picking rounds still
 * count towards everything else.
 */
export function isSolid(p: DragonProfile, word: string): boolean {
  const s = statFor(p, word);
  // three of his last four, counting a nudge as half
  return s.spoken >= 2 && s.recent.length >= WINDOW && grip(s) >= 0.75;
}

/**
 * How badly a word wants to be next.
 *
 * Weakness and staleness multiply rather than add, so a word he half-knows and
 * hasn't seen for five meals beats both a word he has never met and one he got
 * wrong this morning. Words he has never seen score high enough to lead, which
 * is right — but the engine limits how many new ones enter a single meal,
 * because a meal made entirely of unfamiliar words is a meal he loses.
 */
export function dueScore(p: DragonProfile, word: string): number {
  const s = statFor(p, word);
  const weakness = 1 - grip(s);
  const staleness = Math.min(p.mealsCompleted - s.lastSeenAt, 8) / 8;
  return (0.3 + weakness) * (0.5 + staleness);
}

export const isNew = (p: DragonProfile, word: string) => statFor(p, word).seen === 0;

/** Words he can now read, newest first — the dragon's hoard. */
export function hoard(p: DragonProfile, words: string[]): string[] {
  return words.filter((w) => isSolid(p, w)).sort((a, b) => statFor(p, b).seen - statFor(p, a).seen);
}

export function noteSession(p: DragonProfile): DragonProfile {
  const d = new Date().toISOString().slice(0, 10);
  if (p.lastPlayed === d) return p;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return { ...p, lastPlayed: d, dayStreak: p.lastPlayed === yesterday ? p.dayStreak + 1 : 1 };
}
