import { StyleSheet, Text, View } from 'react-native';

import { NORI, RICE, ROE, SALMON, SEAM, TEXT, WASABI } from '@/theme';

interface Props {
  /** the pieces of the word — one slice of the roll each */
  chunks: string[];
  /** letters that don't say what they should, as an index range into the word */
  tricky?: { start: number; end: number } | null;
  /** draw the seams between slices, for a roll he is still assembling */
  showSeams?: boolean;
  scale?: number;
}

/**
 * A piece of sushi with a word on it.
 *
 * The word is the point, so it is the brightest and largest thing here and the
 * sushi around it is kept quiet — a rice-coloured bed, a strip of nori, and
 * for a single piece a slice of salmon over the top. Anything more competes
 * with the letters for his attention and the letters have to win.
 *
 * One syllable is one piece of nigiri. More is a roll, and the cuts between
 * the slices fall exactly where the seams in the word do, so the shape of the
 * food is telling him how to break up the word before he has read a letter of
 * it.
 *
 * Letters are laid out one at a time rather than as a single run of text. That
 * costs a little typographic polish and buys the ability to put the dab of
 * wasabi on precisely the letters that misbehave — the `ai` of `said` and
 * nothing else.
 */
export function Sushi({ chunks, tricky, showSeams = true, scale = 1 }: Props) {
  const nigiri = chunks.length === 1;
  let seen = 0;

  return (
    <View style={styles.piece}>
      {chunks.map((chunk, index) => {
        const from = seen;
        seen += chunk.length;

        return (
          <View
            key={index}
            style={[
              styles.slice,
              { paddingHorizontal: 14 * scale, paddingVertical: 10 * scale },
              index > 0 && showSeams && styles.seam,
              index === 0 && styles.firstSlice,
              index === chunks.length - 1 && styles.lastSlice,
            ]}
          >
            {nigiri && <View style={[styles.topping, { height: 10 * scale }]} />}

            <View style={styles.letters}>
              {[...chunk].map((letter, i) => {
                const at = from + i;
                const lying = tricky && at >= tricky.start && at < tricky.end;
                return (
                  <Text
                    key={i}
                    style={[
                      styles.letter,
                      { fontSize: 44 * scale },
                      lying && styles.lying,
                    ]}
                  >
                    {letter}
                  </Text>
                );
              })}
            </View>

            <View style={[styles.nori, { height: 7 * scale }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { flexDirection: 'row', alignItems: 'stretch' },
  slice: {
    backgroundColor: RICE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstSlice: { borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  lastSlice: { borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  // where the roll was cut — and where the word comes apart
  seam: { borderLeftWidth: 3, borderLeftColor: SEAM, borderStyle: 'dashed' },
  topping: {
    alignSelf: 'stretch',
    backgroundColor: SALMON,
    borderRadius: 6,
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: ROE,
  },
  letters: { flexDirection: 'row', alignItems: 'baseline' },
  letter: { color: TEXT, fontWeight: '700', letterSpacing: 0.5 },
  /* the dab of wasabi: careful, this bit bites */
  lying: {
    color: '#2f4f0f',
    backgroundColor: WASABI,
    borderRadius: 5,
    overflow: 'hidden',
  },
  nori: {
    alignSelf: 'stretch',
    backgroundColor: NORI,
    borderRadius: 4,
    marginTop: 6,
  },
});
