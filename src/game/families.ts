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
 * 3. Same first letter and length — still requires reading past the start,
 *    which is where a guessing reader stops.
 *
 * Anything that survives none of those is a filler, and fillers are a wasted
 * round: he answers correctly without having read anything.
 */
export function distractors(word: string, pool: string[], count: number): string[] {
  const w = word.toLowerCase();
  const others = [...new Set([...relatives(w), ...pool.map((p) => p.toLowerCase())])].filter(
    (o) => o !== w && o.length > 0,
  );

  const family = new Set(relatives(w));
  const rank = (o: string) => {
    if (family.has(o)) return 0;
    if (o.length === w.length && differsByOne(o, w)) return 1;
    if (o.length === w.length && o[0] === w[0]) return 2;
    return 3;
  };

  return others
    .map((o) => ({ o, r: rank(o) }))
    .sort((a, b) => a.r - b.r || a.o.localeCompare(b.o))
    .slice(0, count)
    .map((x) => x.o);
}

function differsByOne(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

/** Every word the families know about — the seed pool for a new dictionary. */
export const ALL_FAMILY_WORDS = [...new Set(Object.values(FAMILIES).flat())].sort();
