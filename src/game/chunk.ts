/**
 * Cutting a word into pieces he can already read.
 *
 * This is not a dictionary syllabifier and it isn't trying to be. The only
 * thing that matters is that every piece handed to him is decodable on its
 * own: `drag` + `on` teaches, `dra` + `gon` does not, even though plenty of
 * dictionaries put the seam in the second place.
 *
 * That instinct — close the first syllable wherever English is ambiguous —
 * is right for a two-syllable word and quietly wrong for a long one, where
 * applying it at every seam produced pieces that are not syllables of
 * anything: `ban|an|a`, `hol|id|ay`, `croc|od|ile`, `hel|ic|op|ter`. So the
 * rules below work in three layers, in this order:
 *
 *   1. the pieces the word is *built* from — `re|`, `|ing`, `|tion`, `|ly` —
 *      because a seam on a real join is never wrong;
 *   2. the first vowel, which closes, because it is usually the stressed one
 *      and `drag` beats `dra`;
 *   3. every seam after that, which opens — a lone consonant leans forward
 *      onto the vowel it is about to be read with, giving `an|i|mal` and
 *      `croc|o|dile`.
 *
 * It will still get some words wrong: `dif|fe|rent` should close, `wa|ter|
 * me|lon` splits one syllable later than the dictionary does. That is why
 * every seam is editable by tapping in the parent screen, and why the stored
 * word keeps its chunks rather than recomputing them: a seam you fixed once
 * stays fixed.
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Two letters making one sound. A seam must never fall between them. */
const ONSET_DIGRAPHS = ['sh', 'ch', 'th', 'wh', 'ph', 'qu', 'kn', 'gn', 'wr'];

/**
 * Digraphs that can only ever end a syllable. No English syllable begins with
 * `ng` or `ck`, so when a seam would cut one the pieces go to the syllable on
 * the left — `hung|ry`, not `hu|ngry`.
 */
const CODA_DIGRAPHS = ['ng', 'ck'];

/** Consonant clusters that can start a syllable. */
const ONSET_CLUSTERS = new Set([
  ...ONSET_DIGRAPHS,
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'gu', 'pl', 'pr', 'sc',
  'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'sq', 'rh', 'shr',
  'thr', 'chr', 'scr', 'spl', 'spr', 'str', 'squ', 'sch',
]);

/**
 * Words where the first vowel is long, so the first seam falls before the
 * consonant rather than after it. There is no rule that predicts these —
 * `tiger` and `finger` look identical to any algorithm — so the common ones
 * are simply listed, and anything missed can be fixed with a tap.
 *
 * Matched as a beginning, not as the whole word, so `water` also settles
 * `watermelon` and `photo` settles `photograph`.
 */
const OPEN_FIRST = [
  'tiger', 'paper', 'water', 'open', 'over', 'even', 'baby', 'lady', 'music',
  'robot', 'spider', 'tulip', 'pilot', 'hotel', 'human', 'moment', 'total',
  'later', 'super', 'ruler', 'zero', 'bacon', 'begin', 'hero', 'lazy', 'tiny',
  'crazy', 'famous', 'frozen', 'silent', 'motor', 'photo', 'polar', 'pony',
  'story', 'tidy', 'able', 'email', 'evil', 'fever', 'final', 'label', 'legal',
  'local', 'major', 'metal', 'minus', 'nature', 'ocean', 'april', 'apron',
  'banana', 'tomato', 'potato', 'giraffe', 'dinosaur', 'pirate', 'pyjamas',
];

/**
 * Beginnings that are a piece in their own right.
 *
 * A seam on a real join can't be wrong, and it rescues the words the vowel
 * rules mangle: `be|cause` rather than `bec|ause`, `re|mem|ber` rather than
 * `rem|em|ber`. Only taken when what's left starts with a consonant that can
 * legally open a syllable, which is what stops `bell` becoming `be|ll` and
 * `pretty` becoming `pre|tty`.
 */
const PREFIXES = [
  'under', 'over', 'trans', 'inter', 'dis', 'mis', 'non', 'pre', 'con', 'com',
  'sub', 'un', 're', 'de', 'be', 'to', 'in', 'im', 'ex',
];

/** The sounds after which a plural `-es` is spoken as a syllable of its own. */
const HISSES = /[szxj]$|[cs]h$/;

/**
 * Endings that are a piece in their own right.
 *
 * `min` is the shortest word the ending may be taken off, and it is doing
 * real work: without it `sing` becomes `si|ng` while `going` still has to
 * become `go|ing`, and `best` becomes `b|est`. It is the cheapest stand-in
 * for knowing whether the letters are actually an ending or just the end of a
 * short word.
 *
 * `when` is the same job for the endings that are only sometimes spoken:
 * `-ed` is a syllable after `t` or `d` (`want|ed`) and silent otherwise
 * (`jumped`), `-es` after a hiss (`wish|es`) and silent otherwise (`makes`).
 * It also keeps `butterfly` off the `-ly` rule: an `l` that could start the
 * last syllable is a `fly`, not an ending.
 */
interface Suffix {
  text: string;
  min: number;
  when?: (stem: string) => boolean;
  /** doubled consonants split, so `run|ning` — false where the ending glues on whole */
  double?: boolean;
}

const SUFFIXES: Suffix[] = [
  { text: 'thing', min: 7 },
  { text: 'tion', min: 6 },
  { text: 'sion', min: 6 },
  { text: 'ness', min: 6 },
  { text: 'ment', min: 6 },
  { text: 'less', min: 6 },
  { text: 'able', min: 6 },
  { text: 'ible', min: 6 },
  { text: 'ing', min: 5 },
  { text: 'ful', min: 5 },
  { text: 'est', min: 5 },
  { text: 'ed', min: 5, when: (stem) => /[td]$/.test(stem) },
  { text: 'es', min: 5, when: (stem) => HISSES.test(stem), double: false },
  { text: 'ly', min: 4, when: (stem) => !ONSET_CLUSTERS.has(`${stem.slice(-1)}l`) },
];

const isVowel = (c: string) => VOWELS.has(c);
const isVowelish = (c: string, at = 1) => isVowel(c) || (c === 'y' && at > 0);
const legalOnset = (s: string) => s.length <= 1 || ONSET_CLUSTERS.has(s);
const clean = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');
const hasVowel = (s: string) => [...s].some((c) => isVowelish(c));

/** Does this word begin like one of the long-first-vowel words? */
const opensFirst = (w: string) => OPEN_FIRST.some((entry) => w.startsWith(entry));

/**
 * A `-le` that is a syllable of its own: `ap|ple`, `ta|ble`, `lit|tle`.
 *
 * The `s` and `d` are there because `apples` and `giggled` are still that
 * word plus an ending, and the `e` in them is no more spoken than it was.
 */
const SYLLABIC_LE = /[^aeiouy]le[sd]?$/;

/**
 * The vowel groups, which is what a syllable is built around.
 *
 * `y` counts as a vowel everywhere except at the start of a word, and it never
 * lets a following vowel join it — otherwise `crying` would come out with one
 * nucleus (`yi`) and be called a one-syllable word.
 */
function nuclei(w: string): [number, number][] {
  const groups: [number, number][] = [];
  for (let i = 0; i < w.length; i++) {
    if (!isVowelish(w[i], i)) continue;
    const last = groups[groups.length - 1];
    /* A group grows only off the back of a true vowel. `ay` in `play` is one
       sound, so the `y` joins; the `i` in `crying` follows a `y` rather than a
       vowel and starts a new one, which is what keeps it a two-syllable word. */
    if (last && last[1] === i && isVowel(w[i - 1])) last[1] = i + 1;
    else groups.push([i, i + 1]);
  }
  return groups;
}

/**
 * A last vowel that isn't spoken, and so isn't a syllable.
 *
 * The plain case is `cake`. The other two are the endings that only sometimes
 * say themselves: `-ed` is a syllable after `t` or `d` (`want|ed`) and silent
 * everywhere else (`jumped`, `liked`), and `-es` is a syllable after a hissing
 * sound (`wish|es`, `box|es`) and silent everywhere else (`makes`, `rides`).
 */
function silentTail(w: string, groups: [number, number][]): boolean {
  if (groups.length < 2 || SYLLABIC_LE.test(w)) return false;
  const last = groups[groups.length - 1];
  if (last[1] !== w.length && w.slice(last[1]) !== 'd' && w.slice(last[1]) !== 's') return false;

  const tail = w.slice(last[0]);
  const before = w[last[0] - 1] ?? '';
  if (tail === 'e') return true;
  if (tail === 'ed') return !'td'.includes(before);
  if (tail === 'es') return !HISSES.test(w.slice(0, last[0]));
  return false;
}

/**
 * Where the seam falls inside a run of consonants, as the number of them that
 * stay with the syllable on the left.
 *
 * `target` is where we would put it if English let us: one consonant on the
 * left closes the syllable (`fas|ter`), none leaves it open (`i|mal`). Every
 * position the seam could legally take is listed and the one nearest the
 * target wins.
 *
 * Listing them, rather than nudging a single seam left and right by rule, is
 * what stops the deadlock: in `birthday` the digraph rule pulls the seam left
 * to keep `th` whole and the onset rule pushes it right because `thd` cannot
 * start a syllable, and it oscillates forever. A tie goes to the smaller,
 * which hands a whole digraph to the syllable it belongs to (`mo|ther`).
 */
function seamWithin(run: string, target: number, next: string): number {
  const valid: number[] = [];
  for (let k = 0; k <= run.length; k++) {
    const cuts = k > 0 && k < run.length ? run.slice(k - 1, k + 1) : '';
    /* `gu` before a vowel is one sound and takes the `g` with it, which is the
       difference between `pen|guin` and the unreadable `peng|uin`. It is the
       one thing allowed to break up an `ng`. */
    const takesTheG = run.slice(k) === 'g' && next.startsWith('u') && isVowel(next[1] ?? '');
    if ((ONSET_DIGRAPHS.includes(cuts) || CODA_DIGRAPHS.includes(cuts)) && !takesTheG) continue;
    if (!legalOnset(run.slice(k)) && !takesTheG) continue;
    valid.push(k);
  }
  if (!valid.length) return Math.min(target, run.length);

  return valid.reduce((best, k) =>
    Math.abs(k - target) < Math.abs(best - target) ||
    (Math.abs(k - target) === Math.abs(best - target) && k < best)
      ? k
      : best,
  );
}

/** The consonants a piece starts with, which is what has to be sayable. */
const leadingConsonants = (s: string) => {
  let i = 0;
  while (i < s.length && !isVowelish(s[i], i)) i++;
  return s.slice(0, i);
};

/**
 * Split off a beginning or an ending the word is built from, and cut each
 * half on its own terms — which is what makes `re|turn|ing` come out right,
 * and what lets the first-vowel rule apply again to `turn` rather than to the
 * whole word.
 */
function byAffix(w: string): string[] | null {
  /* A listed long first vowel outranks a prefix that only looks like one:
     `to|ma|to` is the word, `to|mat|o` is what stripping `to` would give. */
  if (!opensFirst(w)) {
    for (const prefix of PREFIXES) {
      if (!w.startsWith(prefix)) continue;
      const rest = w.slice(prefix.length);
      if (rest.length < 3 || isVowelish(rest[0], 0) || !hasVowel(rest)) continue;
      if (!legalOnset(leadingConsonants(rest))) continue;
      return [...pieces(prefix), ...pieces(rest)];
    }
  }

  for (const suffix of SUFFIXES) {
    if (w.length < suffix.min || !w.endsWith(suffix.text)) continue;

    let stem = w.slice(0, -suffix.text.length);
    let tail = suffix.text;
    if (suffix.when && !suffix.when(stem)) continue;

    /* A doubled consonant belongs half to each side, as it does everywhere
       else: `run|ning`, not `runn|ing`. */
    const [last, penultimate] = [stem.at(-1) ?? '', stem.at(-2) ?? ''];
    if (suffix.double !== false && last && last === penultimate && !isVowelish(last)) {
      tail = last + tail;
      stem = stem.slice(0, -1);
    }
    if (stem.length < 2 || !hasVowel(stem)) continue;
    return [...pieces(stem), ...pieces(tail)];
  }

  return null;
}

/** Cut a word with nothing to take apart, on its vowels. */
function byVowels(w: string): string[] {
  const groups = nuclei(w);
  if (silentTail(w, groups)) groups.pop();
  if (groups.length < 2) return [w];

  const open = opensFirst(w);
  const seams: number[] = [];
  for (let i = 0; i + 1 < groups.length; i++) {
    const from = groups[i][1];
    const to = groups[i + 1][0];
    /* The first vowel closes, every one after it opens. See the top of the
       file: this is the whole difference between `hol|id|ay` and `hol|i|day`. */
    const target = i > 0 ? 0 : open ? 0 : 1;
    seams.push(from + seamWithin(w.slice(from, to), target, w.slice(to)));
  }

  const le = w.match(SYLLABIC_LE);
  if (le?.index && !seams.includes(le.index)) seams[seams.length - 1] = le.index;

  const cuts = [...new Set(seams)].sort((a, b) => a - b).filter((s) => s > 0 && s < w.length);
  const out: string[] = [];
  let at = 0;
  for (const cut of cuts) {
    out.push(w.slice(at, cut));
    at = cut;
  }
  out.push(w.slice(at));

  // never hand him a piece with no vowel in it — fold it into its neighbour
  return out.reduce<string[]>((acc, piece) => {
    if (!hasVowel(piece) && acc.length) acc[acc.length - 1] += piece;
    else acc.push(piece);
    return acc;
  }, []);
}

function pieces(w: string): string[] {
  if (w.length < 3) return [w];
  return byAffix(w) ?? byVowels(w);
}

/**
 * Split a word into readable chunks, left to right.
 *
 * A one-syllable word comes back as a single chunk — it is one piece of
 * sushi, and there is nothing to arrange.
 */
export function chunk(word: string): string[] {
  return pieces(clean(word));
}

export const syllableCount = (word: string) => chunk(word).length;

/**
 * The consonants a one-syllable word starts with, and everything after them.
 *
 * `night` is `n` + `ight`, and the second half is what it shares with `light`
 * and `right`. This is what turns one word he tripped on into a family.
 */
export function onsetRime(word: string): { onset: string; rime: string } {
  const w = clean(word);
  const onset = leadingConsonants(w);
  return { onset, rime: w.slice(onset.length) };
}
