import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { RICE, SALMON, TEXT, WASABI } from '@/theme';

/**
 * A piece of nigiri, drawn in a box 200 wide and 120 tall and stretched
 * sideways to whatever the letters need.
 *
 * It is drawn here and not built out of rectangles because of one line: the
 * underside of the fish. A slice of salmon laid on rice sags in the middle and
 * curls down over both ends of the bed, and a rectangle — however round its
 * corners — has a straight bottom edge, so it floats above the rice like the
 * lid of a jar. It did, three times.
 */
const FISH =
  'M2,46 C2,18 54,6 100,6 C146,6 198,18 198,46 C198,64 150,56 100,56 C50,56 2,64 2,46 Z';
/** The pale streaks of fat, following the curve of the slice rather than crossing it. */
const STREAKS = [
  'M28,32 C62,20 104,17 142,23',
  'M58,44 C92,35 132,33 168,38',
];

interface Props {
  /** the pieces of the word — one piece of sushi each */
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
 * One piece per part of the word, laid out in a row on the counter. So the food
 * is telling him how the word comes apart before he has read a letter of it,
 * and a long word plainly costs more than a short one.
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
  /* Where each piece starts in the whole word, so a letter can be checked
     against the tricky span, which is measured in the word and not the piece. */
  const starts = chunks.reduce<number[]>(
    (at, chunk) => [...at, at[at.length - 1] + chunk.length],
    [0],
  );

  return (
    <View testID="sushi" style={[styles.row, { gap: 8 * scale }]}>
      {chunks.map((chunk, index) => (
        <View key={index} style={styles.piece}>
          {/* Stretched, not scaled: the piece gets longer for a longer part of
              the word, and the fish stays as thick as it was. That is also how
              nigiri works. */}
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 200 120"
            preserveAspectRatio="none"
          >
            {/* the bed, pressed by hand: no corners anywhere on it */}
            <Rect x={10} y={46} width={180} height={70} rx={35} fill={RICE} />
            <Path d={FISH} fill={SALMON} />
            {STREAKS.map((d, i) => (
              <Path
                key={i}
                d={d}
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
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  piece: { alignSelf: 'center' },
  letters: { flexDirection: 'row', alignItems: 'baseline' },
  letter: { color: TEXT, fontWeight: '700', letterSpacing: 0.5 },
  /* the dab of wasabi: careful, this bit bites */
  lying: {
    color: '#2f4f0f',
    backgroundColor: WASABI,
    borderRadius: 5,
    overflow: 'hidden',
  },
});
