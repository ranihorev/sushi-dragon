/**
 * Word families, and the near-misses that make a choice worth making.
 *
 * Two jobs, one table.
 *
 * The first is leverage. A child who trips on `night` has not met a hard word;
 * he has met a pattern he doesn't own yet. Teach `night` and he can read
 * `night`. Teach `-ight` and he can read `light`, `right`, `fight`, `might`
 * and `bright` — so adding one word to the dictionary quietly brings its
 * relatives with it.
 *
 * The second is honesty in the picking rounds. Offering `night` against `dog`
 * and `cup` tests nothing: the shapes differ so wildly he can pick by outline
 * without reading a letter. Offering it against `light` and `right` leaves no
 * shortcut. Same table, read the other way round.
 */

import { onsetRime } from './chunk';

/**
 * Rimes worth owning, each with the words an early reader actually meets.
 *
 * Ordered longest-first at lookup, so `night` matches `-ight` and not `-it`.
 */
export const FAMILIES: Record<string, string[]> = {
  ight: ['night', 'light', 'right', 'might', 'sight', 'tight', 'fight', 'bright', 'flight'],
  ake: ['cake', 'make', 'take', 'lake', 'bake', 'wake', 'shake', 'snake'],
  ame: ['name', 'game', 'same', 'came', 'flame', 'frame'],
  ide: ['ride', 'side', 'hide', 'wide', 'slide', 'bride'],
  ine: ['nine', 'line', 'mine', 'fine', 'shine', 'spine'],
  ime: ['time', 'lime', 'dime', 'slime', 'crime'],
  ike: ['bike', 'like', 'hike', 'spike', 'strike'],
  ain: ['rain', 'main', 'pain', 'train', 'chain', 'brain', 'plain'],
  ail: ['tail', 'mail', 'sail', 'nail', 'snail', 'trail'],
  eep: ['keep', 'deep', 'sleep', 'sheep', 'steep', 'sweep'],
  eat: ['eat', 'seat', 'heat', 'meat', 'treat', 'wheat'],
  oat: ['boat', 'coat', 'goat', 'float', 'throat'],
  oon: ['moon', 'soon', 'noon', 'spoon', 'balloon'],
  ool: ['cool', 'pool', 'tool', 'school', 'stool'],
  ook: ['book', 'look', 'took', 'cook', 'hook', 'shook'],
  own: ['down', 'town', 'brown', 'clown', 'crown', 'frown'],
  ound: ['round', 'found', 'sound', 'ground', 'around'],
  ing: ['king', 'ring', 'sing', 'wing', 'thing', 'bring', 'spring'],
  all: ['ball', 'call', 'fall', 'tall', 'wall', 'small'],
  ell: ['bell', 'tell', 'well', 'sell', 'shell', 'smell'],
  ill: ['hill', 'will', 'fill', 'still', 'spill', 'chill'],
  ick: ['kick', 'lick', 'pick', 'sick', 'stick', 'trick', 'chick'],
  ock: ['lock', 'rock', 'sock', 'clock', 'block', 'knock'],
  uck: ['duck', 'luck', 'truck', 'stuck', 'cluck'],
  ack: ['back', 'pack', 'sack', 'black', 'snack', 'track'],
  ear: ['ear', 'hear', 'near', 'year', 'clear'],
  ore: ['more', 'store', 'score', 'shore', 'before'],
  at: ['cat', 'bat', 'hat', 'mat', 'rat', 'sat', 'flat', 'that'],
  an: ['can', 'man', 'pan', 'ran', 'van', 'plan', 'than'],
  ap: ['cap', 'map', 'tap', 'nap', 'clap', 'snap'],
  ag: ['bag', 'tag', 'wag', 'flag', 'drag'],
  ed: ['bed', 'red', 'fed', 'led', 'shed', 'sled'],
  en: ['hen', 'pen', 'ten', 'men', 'then', 'when'],
  et: ['get', 'let', 'net', 'pet', 'wet', 'jet'],
  ig: ['big', 'dig', 'pig', 'wig', 'twig'],
  in: ['bin', 'pin', 'win', 'fin', 'chin', 'thin', 'skin'],
  ip: ['dip', 'lip', 'rip', 'tip', 'chip', 'ship', 'skip'],
  it: ['bit', 'fit', 'hit', 'sit', 'pit', 'spit'],
  og: ['dog', 'fog', 'log', 'jog', 'frog'],
  op: ['hop', 'mop', 'top', 'pop', 'stop', 'shop', 'drop'],
  ot: ['dot', 'got', 'hot', 'not', 'pot', 'spot'],
  ug: ['bug', 'hug', 'jug', 'rug', 'mug', 'plug'],
  un: ['bun', 'fun', 'run', 'sun', 'spun'],
  ut: ['but', 'cut', 'hut', 'nut', 'shut'],
  ay: ['day', 'may', 'say', 'way', 'play', 'stay', 'away'],
  y: ['my', 'by', 'fly', 'try', 'cry', 'sky', 'why'],
};

const RIMES_BY_LENGTH = Object.keys(FAMILIES).sort((a, b) => b.length - a.length);

/**
 * The words an early reader mixes up, listed together.
 *
 * The family table above only reaches words that rhyme, and the words a child
 * meets first mostly do not: `was`, `come`, `they`, `there`. Left to the
 * families alone, the counter filled up with `apple` and `because` — nothing
 * alike, nothing to read, a round he wins by looking at the length of it.
 *
 * These are the pairs that actually cost him: the same letters backwards
 * (`was`/`saw`), one letter apart (`want`/`what`), or the same first two
 * letters and a different tail (`the`/`they`/`there`/`them`).
 *
 * A word here does not have to be in his dictionary. It is only ever offered
 * as a wrong answer, and the point of a wrong answer is to look right.
 */
export const CONFUSABLE: Record<string, string[]> = {
  was: ['saw', 'way', 'want'],
  saw: ['was', 'say', 'sat'],
  on: ['no', 'one', 'own'],
  no: ['on', 'now', 'not'],
  of: ['off', 'for', 'or'],
  for: ['form', 'from', 'four', 'of'],
  from: ['form', 'for', 'front'],
  the: ['then', 'they', 'them', 'there'],
  they: ['the', 'them', 'then', 'there'],
  them: ['the', 'then', 'they'],
  then: ['the', 'them', 'they', 'when'],
  there: ['their', 'these', 'three', 'they'],
  where: ['were', 'we', 'there', 'here'],
  were: ['where', 'we', 'here'],
  here: ['her', 'hear', 'there', 'where'],
  what: ['want', 'that', 'when', 'hat'],
  want: ['what', 'went', 'wait'],
  come: ['came', 'some', 'home', 'cone'],
  some: ['same', 'come', 'sun'],
  said: ['says', 'sad', 'sand', 'slid'],
  says: ['said', 'stay', 'sky'],
  have: ['gave', 'has', 'hive'],
  who: ['how', 'why', 'what', 'whose'],
  how: ['who', 'now', 'show'],
  you: ['your', 'yes', 'yet'],
  your: ['you', 'our', 'yours'],
  one: ['once', 'on', 'own', 'none'],
  two: ['to', 'too', 'tow'],
  could: ['cloud', 'would', 'should', 'cold'],
  would: ['world', 'could', 'should', 'wood'],
  love: ['live', 'like', 'lone', 'move'],
  live: ['love', 'life', 'like'],
  put: ['pot', 'pat', 'but', 'cut'],
  friend: ['fried', 'find', 'friends'],
  because: ['before', 'became', 'beside'],
  little: ['letter', 'title', 'bottle'],
  hungry: ['angry', 'hunger', 'hurry'],
  monster: ['master', 'monsters', 'mister'],
  rabbit: ['rabbits', 'ribbon', 'robot'],
  dragon: ['wagon', 'drag', 'dragons'],
  chicken: ['kitchen', 'chick', 'children'],
  picnic: ['panic', 'pick', 'picture'],
  apple: ['ample', 'apples', 'ripple'],
  birthday: ['birth', 'bird', 'birthdays'],
  sunshine: ['sunny', 'shine', 'sunshade'],
  jumping: ['jumped', 'jumper', 'bumping'],
  sushi: ['shush', 'sunny', 'sunshine'],
};

/** Near-misses for a word, from the table above, both ways round. */
function confusable(word: string): string[] {
  const listed = CONFUSABLE[word] ?? [];
  const mentions = Object.entries(CONFUSABLE)
    .filter(([, alike]) => alike.includes(word))
    .map(([other]) => other);
  return [...new Set([...listed, ...mentions])];
}

/**
 * The family a word belongs to, or null if it stands alone.
 *
 * Only single-syllable words get one: `-ight` is a pattern you can carry to a
 * new word, whereas the end of `dragon` teaches nothing transferable.
 */
export function familyOf(word: string): string | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const { rime } = onsetRime(w);
  if (!rime) return null;
  const hit = RIMES_BY_LENGTH.find((r) => FAMILIES[r].includes(w) || rime === r);
  return hit ?? null;
}

/** The rest of the family — what he gets for free by learning this one. */
export function relatives(word: string): string[] {
  const fam = familyOf(word);
  if (!fam) return [];
  const w = word.toLowerCase();
  return FAMILIES[fam].filter((m) => m !== w);
}

/**
 * Words to offer alongside the answer, hardest first.
 *
 * Ranked by how little they give away:
 *
 * 1. Same family, different start — `night` against `light`. Identical but for
 *    the first letter or two, so the choice cannot be made on shape.
 * 2. Same length, one letter different — `cat` against `cot`. Forces him to
 *    look at the vowel, which is where most of his errors will be.
 * 3. The same letters in another order — `was` against `saw`. See `SCRAMBLED`.
 * 4. Same start, different end — `the` against `then`, `star` against `start`.
 * 5. Same first letter and length — still requires reading past the start,
 *    which is where a guessing reader stops.
 *
 * Anything that survives none of those is a filler, and fillers are a wasted
 * round: he answers correctly without having read anything.
 *
 * The list is offered hardest first, so a counter of four holds the four
 * nastiest words available. The one thing that waits is the scrambled pair,
 * which arrives only once he has some hold on the word.
 */
export function distractors(
  word: string,
  pool: string[],
  count: number,
  /** how well he holds this word, 0..1 — see `SCRAMBLED` and `nearMisses` */
  hold = 1,
): string[] {
  const w = word.toLowerCase();
  const others = [
    ...new Set([...relatives(w), ...confusable(w), ...pool.map((p) => p.toLowerCase())]),
  ].filter((o) => o !== w && o.length > 0);

  const made =
    hold >= HARD_FROM
      ? nearMisses(w)
          .filter((o) => !others.includes(o))
          .slice(0, MADE_UP)
      : [];

  const ranked = [
    ...others.map((o) => ({ o, r: rank(w, o) })),
    ...made.map((o) => ({ o, r: MADE_UP_RANK })),
  ]
    .filter(({ r }) => r !== SCRAMBLED || hold >= HARD_FROM)
    .sort((a, b) => a.r - b.r || a.o.localeCompare(b.o));

  return ranked.slice(0, count).map((x) => x.o);
}

/**
 * The same word with one vowel changed: `sushi` and `sashi`, `my` and `me`.
 *
 * Most of these are not words. That is the point of them. A word with a family
 * gets four hard neighbours for nothing, but `sushi` has none, and the counter
 * used to fill up with whatever else was in his dictionary — which by the
 * ranking above is a filler, a wrong answer he can reject without reading a
 * letter of it. Those rounds were free.
 *
 * A made-up neighbour cannot be free. There is no shape to go on, no length, no
 * first letter, and nothing to remember, because the piece has never been on the
 * counter before. Rejecting it is decoding and nothing else — which is why the
 * phonics screening check at the end of Year 1 is half made-up words too.
 *
 * Whether the result happens to be real does not matter. `cat` gives `cot`,
 * which is real, and `cot` is exactly the wrong answer this was reaching for.
 *
 * `y` is swapped out but never in: `my` gives `me`, and `cat` never gives `cyt`,
 * which is not a thing an English reader has to be able to turn down.
 */
export function nearMisses(word: string): string[] {
  const out = new Set<string>();
  [...word].forEach((letter, i) => {
    if (!SWAPPABLE.includes(letter)) return;
    for (const vowel of VOWELS) {
      if (vowel !== letter) out.add(word.slice(0, i) + vowel + word.slice(i + 1));
    }
  });
  out.delete(word);
  return [...out];
}

const VOWELS = 'aeiou';
const SWAPPABLE = 'aeiouy';

/**
 * One made-up wrong answer per counter, at most.
 *
 * Three pieces, of which two are nothing, is a round he can win by finding the
 * one thing on the counter that is a word — and a counter that is mostly
 * gibberish stops being a plate of food. One is enough to make the other two
 * worth reading.
 */
const MADE_UP = 1;

/**
 * Where a made-up word sits among the real ones: behind every class the table
 * can name, ahead of both kinds of filler.
 *
 * A real near-miss is worth more when there is one. `night` against `light` is
 * a word he will meet in a book tomorrow, and rejecting `noght` is not. This
 * only takes the rounds that had nothing better to offer.
 */
const MADE_UP_RANK = 3.5;

/**
 * How much hold a word needs before its wrong answers can get properly nasty.
 *
 * The same bar for both of the hard classes, for the same reason: reading a
 * word right to left, and turning down a word that does not exist, are both
 * things he fails at while he is still learning the word — for reasons that
 * have nothing to do with that word.
 */
const HARD_FROM = 0.5;

/**
 * The same letters, in another order: `was` and `saw`, `net` and `ten`.
 *
 * The hardest class there is, and the one a beginner fails at for a reason
 * that has nothing to do with knowing the word — he is still learning that
 * English is read left to right, every time, without exception. So it is held
 * back until he has a grip on the word, and then it is the sharpest test in
 * the game: there is no shape to fall back on, no first letter to guess from,
 * nothing to do but read it.
 */
const SCRAMBLED = 2;

function rank(w: string, o: string): number {
  if (relatives(w).includes(o)) return 0;
  // one letter different, which is nearly always the vowel: `cat` and `cot`
  if (o.length === w.length && differsBy(o, w) === 1) return 1;
  if (o.length === w.length && sameLetters(o, w)) return SCRAMBLED;
  // named as a pair by hand, because these are the ones that actually cost him
  if (confusable(w).includes(o)) return 2.5;
  /* Shares the start, differs at the end: `the` and `then`, `star` and
     `start`. This is the trap a guessing reader walks into every time — he
     reads two letters, recognises something, and stops looking. */
  if (Math.abs(o.length - w.length) <= 2 && sharedStart(o, w) >= Math.min(3, w.length)) return 3;
  if (o.length === w.length && o[0] === w[0]) return 4;
  return 5;
}

function differsBy(a: string, b: string): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

const sorted = (s: string) => [...s].sort().join('');
const sameLetters = (a: string, b: string) => a !== b && sorted(a) === sorted(b);

function sharedStart(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Every word the families know about — the seed pool for a new dictionary. */
export const ALL_FAMILY_WORDS = [...new Set(Object.values(FAMILIES).flat())].sort();
