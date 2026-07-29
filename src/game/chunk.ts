/**
 * Cutting a word into pieces he can already read.
 *
 * This is not a dictionary syllabifier and it isn't trying to be. The only
 * thing that matters is that every piece handed to him is decodable on its
 * own: `drag` + `on` teaches, `dra` + `gon` does not, even though plenty of
 * dictionaries put the seam in the second place. So wherever English is
 * genuinely ambiguous — most often a single consonant sitting between two
 * vowels, which resolves about half each way — this closes the first syllable,
 * because a closed syllable is a chunk he can sound out and an open one often
 * isn't.
 *
 * It will still get some words wrong. `tiger` comes out `tig|er`. That is why
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
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk',
  'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'dw', 'sq', 'rh', 'shr',
  'thr', 'chr', 'scr', 'spl', 'spr', 'str', 'squ', 'sch',
]);

/**
 * Words where the first vowel is long, so the seam falls before the consonant
 * rather than after it. There is no rule that predicts these — `tiger` and
 * `finger` look identical to any algorithm — so the common ones are simply
 * listed, and anything missed can be fixed with a tap.
 */
const OPEN_FIRST = new Set([
  'tiger', 'paper', 'water', 'open', 'over', 'even', 'baby', 'lady', 'music',
  'robot', 'spider', 'tulip', 'pilot', 'hotel', 'human', 'moment', 'total',
  'later', 'super', 'ruler', 'zero', 'bacon', 'begin', 'hero', 'lazy', 'tiny',
  'crazy', 'famous', 'frozen', 'silent', 'motor', 'photo', 'polar', 'pony',
  'story', 'tidy', 'able', 'email', 'evil', 'fever', 'final', 'label', 'legal',
  'local', 'major', 'metal', 'minus', 'nature', 'ocean', 'April', 'apron',
]);

const isVowel = (c: string) => VOWELS.has(c);
const legalOnset = (s: string) => s.length <= 1 || ONSET_CLUSTERS.has(s);
const clean = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '');

/**
 * The vowel groups, which is what a syllable is built around.
 *
 * `y` counts as a vowel everywhere except at the start of a word, and it never
 * lets a following vowel join it — otherwise `crying` would come out with one
 * nucleus (`yi`) and be called a one-syllable word.
 */
function nuclei(w: string): Array<[number, number]> {
  const groups: Array<[number, number]> = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const vowelish = isVowel(c) || (c === 'y' && i > 0);
    if (!vowelish) continue;
    const last = groups[groups.length - 1];
    /* A group grows only off the back of a true vowel. `ay` in `play` is one
       sound, so the `y` joins; the `i` in `crying` follows a `y` rather than a
       vowel and starts a new one, which is what keeps it a two-syllable word. */
    if (last && last[1] === i && isVowel(w[i - 1])) last[1] = i + 1;
    else groups.push([i, i + 1]);
  }
  return groups;
}

/** `cake` is one syllable, but `table` is two — the `e` in `-Cle` is doing work. */
const consonantLe = (w: string) => /[^aeiouy]le$/.test(w);

function silentFinalE(w: string, groups: Array<[number, number]>) {
  if (groups.length < 2) return false;
  const last = groups[groups.length - 1];
  return last[1] === w.length && w.slice(last[0]) === 'e' && !consonantLe(w);
}

/**
 * Where the seam falls inside a run of consonants, as the number of them that
 * stay with the syllable on the left.
 */
function seamWithin(run: string, word: string): number {
  if (run.length === 0) return 0;
  if (run.length === 1) return OPEN_FIRST.has(word) ? 0 : 1;

  /* Every position the seam could legally take, then the one nearest to
     "one consonant stays on the left".

     Nudging a single seam left and right by rule deadlocks: in `birthday` the
     digraph rule pulls it left to keep `th` whole and the onset rule pushes it
     right because `thd` cannot start a syllable, and it oscillates forever.
     Listing the valid positions and choosing among them cannot.

     One consonant on the left is the target because it is what closes the
     first syllable without starving the second: `fas|ter` rather than
     `fa|ster`. Where that position is illegal — `th` is one sound and cannot
     be halved — the nearest legal one wins, and a tie goes to the smaller,
     which hands the whole digraph to the syllable it belongs to (`mo|ther`). */
  const valid: number[] = [];
  for (let k = 0; k <= run.length; k++) {
    const cuts = k > 0 && k < run.length ? run.slice(k - 1, k + 1) : '';
    if (ONSET_DIGRAPHS.includes(cuts) || CODA_DIGRAPHS.includes(cuts)) continue;
    if (!legalOnset(run.slice(k))) continue;
    valid.push(k);
  }
  if (!valid.length) return 1;

  return valid.reduce((best, k) =>
    Math.abs(k - 1) < Math.abs(best - 1) || (Math.abs(k - 1) === Math.abs(best - 1) && k < best)
      ? k
      : best,
  );
}

/**
 * `-ing` is a piece in its own right, and he meets it constantly.
 *
 * Left to the consonant rules `washing` would come out `wa|shing`, because
 * `sh` gets pulled into the onset. Reading it as `wash` + `ing` is both easier
 * and truer to how the word is built. Doubled consonants split, so `running`
 * gives `run|ning` rather than `runn|ing`.
 */
function ingSeam(w: string): number | null {
  if (!w.endsWith('ing') || w.length < 5) return null;
  const stem = w.slice(0, -3);
  if (![...stem].some((c) => isVowel(c) || c === 'y')) return null;
  const doubled = stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2];
  return doubled ? stem.length - 1 : stem.length;
}

/**
 * Split a word into readable chunks, left to right.
 *
 * A one-syllable word comes back as a single chunk — it is one piece of
 * sushi, and there is nothing to arrange.
 */
export function chunk(word: string): string[] {
  const w = clean(word);
  if (w.length < 3) return [w];

  const groups = nuclei(w);
  if (silentFinalE(w, groups)) groups.pop();
  if (groups.length < 2) return [w];

  const seams: number[] = [];
  for (let i = 0; i + 1 < groups.length; i++) {
    const from = groups[i][1];
    const to = groups[i + 1][0];
    seams.push(from + seamWithin(w.slice(from, to), w));
  }

  // `-Cle` is a syllable of its own: `ap|ple`, `ta|ble`, `lit|tle`
  if (consonantLe(w)) {
    const at = w.length - 3;
    if (at > 0 && !seams.includes(at)) seams[seams.length - 1] = at;
  }

  const ing = ingSeam(w);
  if (ing !== null && ing > 0 && !seams.includes(ing)) {
    seams[seams.length - 1] = ing;
  }

  const cuts = [...new Set(seams)].sort((a, b) => a - b).filter((s) => s > 0 && s < w.length);
  const out: string[] = [];
  let at = 0;
  for (const c of cuts) {
    out.push(w.slice(at, c));
    at = c;
  }
  out.push(w.slice(at));

  // never hand him a piece with no vowel in it — fold it into its neighbour
  return out.reduce<string[]>((acc, piece) => {
    const voiceless = ![...piece].some((c) => isVowel(c) || c === 'y');
    if (voiceless && acc.length) acc[acc.length - 1] += piece;
    else acc.push(piece);
    return acc;
  }, []);
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
  let i = 0;
  while (i < w.length && !isVowel(w[i]) && !(w[i] === 'y' && i > 0)) i++;
  return { onset: w.slice(0, i), rime: w.slice(i) };
}
