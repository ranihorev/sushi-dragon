/**
 * How big the game draws itself, on whatever screen it has been given.
 *
 * Every size in this app was a number typed while looking at a 13-inch iPad
 * lying on its side: a dragon 320 points tall, a shelf of sushi 136 points
 * deep, a door screen with a 300-point animal on it. Held upright, or opened
 * on a phone, those numbers add up to more than the screen has — and what
 * falls off the bottom is the counter, which is the half of the game he
 * touches. That is an app you cannot play at all rather than an app that looks
 * a bit tight.
 *
 * So the numbers live here now, as one answer to one question: given this much
 * room, how big is everything? They are all ceilings. On the iPad the game was
 * built on, none of them bite and nothing moves.
 *
 * The room being talked about is the usable screen — the window less whatever
 * the notch and the home bar have already taken. On a phone lying on its side
 * that is an inch narrower than the window, which is exactly the inch the
 * sushi was falling into.
 */

export interface Room {
  width: number;
  height: number;
}

export interface Fitting {
  /** the tall shape: a phone held the way a phone is held */
  portrait: boolean;
  /**
   * Less height than the furniture wants.
   *
   * A phone on its side is shorter than the iPad's dragon and counter added
   * together, so on one the game has to spend its padding rather than its
   * sushi. Measured against the height a phone has in landscape, and no iPad
   * is ever below it in either direction.
   */
  snug: boolean;
  /** the biggest the dragon is drawn while the game is being played */
  dragon: number;
  /** and on the screen where it is resting, which is mostly dragon */
  door: number;
  /** and on the page that explains the game once */
  intro: number;
  /** what a piece on the shelf of words he owns is multiplied by */
  hoard: number;
}

/** the rice showing at either end of a piece, before the first letter */
const PIECE_PAD = 60;
/** one letter of the word, at full size — near enough for a bold sans at 44pt */
const LETTER_W = 27;
/** and the dot that stands where the word comes apart */
const SEAM_W = 16;
/** how deep the counter has to be to hold a piece */
export const PIECE_H = 118;
/** the counter's own margins, and the gap between two pieces on it */
const EDGE = 48;
const GAP = 22;

/**
 * How wide one word is, served, at full size.
 *
 * A word is one piece of sushi however many parts it comes in — the parts are
 * marked by a dot between the letters rather than by a gap between two pieces
 * of food. So the thing that makes a piece long is the letters, and the seams
 * only add a dot each.
 *
 * Guessed from a letter count rather than measured, because this is read while
 * deciding how big to draw the word and the drawing has not happened yet. It
 * errs wide: an `i` is narrower than this and an `m` is not, and a piece drawn
 * a little small is a piece that fits.
 */
export const pieceWidth = (chunks: string[]): number =>
  PIECE_PAD +
  chunks.reduce((n, chunk) => n + chunk.length, 0) * LETTER_W +
  Math.max(chunks.length - 1, 0) * SEAM_W;

export function fitting({ width, height }: Room): Fitting {
  const snug = height < 480;

  return {
    portrait: height > width,
    snug,

    /* Half the height, because the counter and the question need the other
       half; and two thirds of the width, because a dragon as wide as the
       screen leaves the food nowhere to be carried from. */
    dragon: clamp(Math.min(height * 0.5, width * 0.62), 100, 320),
    door: clamp(Math.min(height * 0.5, width * 0.55), 120, 300),
    intro: clamp(Math.min(height * 0.3, width * 0.45), 90, 220),

    /* The shelf is a row that scrolls sideways, so it never has to fit — it
       only has to be shallow enough not to push the dragon off a short
       screen. */
    hoard: snug ? 0.3 : 0.42,
  };
}

/**
 * The most a piece of sushi can be scaled by before it runs off the side.
 *
 * `widest` is `pieceWidth` of the longest word on the counter, because that is
 * the widest single thing that has to fit: a word is one piece and a piece
 * cannot be wrapped, which would be a word cut in half by the edge of the
 * screen.
 *
 * Never above 1. A wide screen gets whatever the round asked for and this says
 * nothing about it.
 */
export const sushiCap = (width: number, widest: number): number =>
  clamp((width - EDGE) / Math.max(widest, 1), 0.4, 1);

/**
 * How deep to keep the counter, given what is going to be laid out on it.
 *
 * `words` is one `pieceWidth` per word on the counter, at full size.
 *
 * Deep enough for every row, worked out the way the counter itself lays them
 * out: along until the next piece would not fit, then down. It is a floor and
 * not a ceiling — the counter is free to be taller — but it is what stops the
 * shelf collapsing as the pieces are eaten off it, which used to drop the
 * dragon half an inch at the exact moment the food disappeared and read as the
 * animal flinching.
 *
 * The guess errs high on purpose. Too deep costs a few points of dragon; too
 * shallow means the counter grows a row at the moment the round starts, which
 * is a whole layout moving under a five-year-old's finger.
 */
export function counterDepth(width: number, words: number[], scale: number): number {
  if (!words.length) return PIECE_H * scale;

  const room = width - EDGE;
  let rows = 1;
  let used = 0;

  for (const word of words) {
    const piece = word * scale;
    if (used && used + GAP + piece > room) {
      rows += 1;
      used = piece;
    } else {
      used += (used ? GAP : 0) + piece;
    }
  }

  return rows * PIECE_H * scale + (rows - 1) * GAP;
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
