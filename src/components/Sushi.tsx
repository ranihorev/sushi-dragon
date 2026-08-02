import { Fragment, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { PIECE_H, pieceWidth } from '@/fitting';
import { RICE, SALMON, TEXT, WASABI } from '@/theme';

/**
 * The piece is drawn 120 tall, and as long as the word in it turned out to be.
 *
 * Everything below is a number in that space: the fish sits 6 down from the
 * top, the rice starts 46 down, and both of them run the length of the piece.
 */
const TALL = 120;

/**
 * A slice of salmon laid on rice, of any length.
 *
 * It is drawn rather than built out of rectangles because of one line: the
 * underside of the fish. A slice sags in the middle and curls down over both
 * ends of the bed, and a rectangle — however round its corners — has a
 * straight bottom edge, so it floats above the rice like the lid of a jar. It
 * did, three times.
 *
 * The two ends are the same curve at any length. Only the sag between them
 * gets longer, which is the difference between a long piece of nigiri and a
 * short one that has been stretched — and the stretched one is what a word
 * like `chocolate` used to be made of.
 */
const fish = (long: number) =>
  `M2,46 C2,18 54,6 ${long / 2},6 C${long - 54},6 ${long - 2},18 ${long - 2},46` +
  ` C${long - 2},64 ${long - 50},56 ${long / 2},56 C50,56 2,64 2,46 Z`;

/** The pale streaks of fat, following the length of the slice rather than crossing it. */
const STREAKS: [number, number][][] = [
  [[28, 32], [62, 20], [104, 17], [142, 23]],
  [[58, 44], [92, 35], [132, 33], [168, 38]],
];

/** A streak, spread over a piece of this length — they were drawn on one of 200. */
const streak = (points: [number, number][], long: number) => {
  const at = ([x, y]: [number, number]) => `${(x * long) / 200},${y}`;
  return `M${at(points[0])} C${at(points[1])} ${at(points[2])} ${at(points[3])}`;
};

interface Props {
  /** the pieces of the word — a dot between each of them */
  chunks: string[];
  /** letters that don't say what they should, as an index range into the word */
  tricky?: { start: number; end: number } | null;
  scale?: number;
}

/**
 * A word, served as sushi.
 *
 * The word is the point, so it is the brightest and largest thing here and the
 * sushi around it is kept quiet. Anything more competes with the letters for
 * his attention and the letters have to win.
 *
 * One word is one piece, and the parts it comes apart into are marked by a dot
 * between the letters — `choc·o·late`. It used to be one piece of sushi per
 * part, which told him how the word breaks up before he had read a letter of
 * it; but it also told him that `chocolate` is three separate things on a
 * plate, and by the time a word is worth three pieces it is a word he has to
 * hold together in his head to read at all. The dot says the same thing about
 * the seams while leaving the word whole, which is how the word is written
 * everywhere else — and it is already how the seams are shown to the grown-up
 * setting them.
 *
 * They are all the same kind of sushi. Long words used to arrive as a roll
 * instead — which, drawn flat, was a cream box with a dark outline around it,
 * and that is a button. Whatever a piece is worth saying about a word, it is
 * not worth saying it in a shape that stops looking like food.
 *
 * Letters are laid out one at a time rather than as a single run of text. That
 * costs a little typographic polish and buys the ability to put the dab of
 * wasabi on precisely the letters that misbehave — the `ai` of `said` and
 * nothing else.
 */
export function Sushi({ chunks, tricky, scale = 1 }: Props) {
  /* How long the piece is, in the drawing's own units, which is the one thing
     the drawing cannot work out for itself: it is however wide the letters
     came out. Guessed from the letters until the word has been laid out — the
     guess is close, and it is only ever wrong for the first frame. */
  const [long, setLong] = useState(() => (pieceWidth(chunks) / PIECE_H) * TALL);

  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    if (width && height) setLong((width / height) * TALL);
  };

  /* Where each piece starts in the whole word, so a letter can be checked
     against the tricky span, which is measured in the word and not the piece. */
  const starts = chunks.reduce<number[]>(
    (at, chunk) => [...at, at[at.length - 1] + chunk.length],
    [0],
  );

  return (
    <View testID="sushi" style={styles.piece} onLayout={measure}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${long} ${TALL}`}>
        {/* the bed, pressed by hand: no corners anywhere on it */}
        <Rect x={10} y={46} width={Math.max(long - 20, 1)} height={70} rx={35} fill={RICE} />
        <Path d={fish(long)} fill={SALMON} />
        {STREAKS.map((points, i) => (
          <Path
            key={i}
            d={streak(points, long)}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={i ? 3 : 4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>

      {/* Sitting low, in the rice, with the fish above it. */}
      <View
        style={{
          paddingTop: 58 * scale,
          paddingBottom: 16 * scale,
          paddingHorizontal: 30 * scale,
        }}
      >
        <View style={styles.letters}>
          {chunks.map((chunk, index) => (
            <Fragment key={index}>
              {/* The seam. Smaller and paler than a letter, because it is not
                  one and must not be read as one — it is the pause between
                  the two halves of the word, and it is the same dot the
                  grown-up moves the seams with. */}
              {index > 0 && (
                <Text
                  testID="seam"
                  style={[
                    styles.seam,
                    { fontSize: 30 * scale, paddingHorizontal: 3 * scale },
                  ]}
                >
                  ·
                </Text>
              )}
              {[...chunk].map((letter, i) => {
                const at = starts[index] + i;
                const lying = tricky && at >= tricky.start && at < tricky.end;
                return (
                  <Text
                    key={i}
                    testID={lying ? 'lying-letter' : undefined}
                    style={[styles.letter, { fontSize: 44 * scale }, lying && styles.lying]}
                  >
                    {letter}
                  </Text>
                );
              })}
            </Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { alignSelf: 'center' },
  letters: { flexDirection: 'row', alignItems: 'baseline' },
  letter: { color: TEXT, fontWeight: '700', letterSpacing: 0.5 },
  /* Pale enough to sit under the letters, and no paler: on the shelf of words
     he owns the whole piece is drawn at a third of this size, and a dot at the
     opacity a seam is drawn at elsewhere is a dot nobody can see. */
  seam: { color: TEXT, opacity: 0.42, fontWeight: '700' },
  /* the dab of wasabi: careful, this bit bites */
  lying: {
    color: '#2f4f0f',
    backgroundColor: WASABI,
    borderRadius: 5,
    overflow: 'hidden',
  },
});
