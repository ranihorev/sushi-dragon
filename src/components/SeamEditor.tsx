import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CREAM, FIRE, RICE, TEXT } from '@/theme';

interface Props {
  text: string;
  chunks: string[];
  onChange: (chunks: string[]) => void;
}

/**
 * Moving the cuts by tapping between letters.
 *
 * The chunker is a good guess and not an oracle — it gets `dragon` and
 * `birthday` right and `tiger` wrong, and there is no rule that separates
 * those cases. Rather than pretend otherwise, the seams are shown as they will
 * appear on the sushi and any of them can be moved in a second.
 *
 * The cuts are stored on the word afterwards rather than recomputed, so a seam
 * fixed once stays fixed.
 */
export function SeamEditor({ text, chunks, onChange }: Props) {
  const seams = new Set<number>();
  let at = 0;
  for (const chunk of chunks.slice(0, -1)) {
    at += chunk.length;
    seams.add(at);
  }

  const toggle = (position: number) => {
    const next = new Set(seams);
    if (next.has(position)) next.delete(position);
    else next.add(position);

    const cuts = [...next].sort((a, b) => a - b);
    const out: string[] = [];
    let from = 0;
    for (const cut of cuts) {
      out.push(text.slice(from, cut));
      from = cut;
    }
    out.push(text.slice(from));
    onChange(out.filter(Boolean));
  };

  return (
    <View>
      <View style={styles.row}>
        {[...text].map((letter, i) => (
          <View key={i} style={styles.pair}>
            {i > 0 && (
              <Pressable
                onPress={() => toggle(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`cut before letter ${i + 1}`}
                style={styles.gap}
              >
                <View style={[styles.cut, seams.has(i) && styles.cutOn]} />
              </Pressable>
            )}
            <Text style={styles.letter}>{letter}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.preview}>{chunks.join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: RICE,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pair: { flexDirection: 'row', alignItems: 'center' },
  gap: { paddingHorizontal: 3, justifyContent: 'center' },
  cut: { width: 3, height: 34, borderRadius: 2, backgroundColor: 'rgba(43,33,24,0.12)' },
  cutOn: { backgroundColor: FIRE },
  letter: { fontSize: 34, fontWeight: '700', color: TEXT, paddingHorizontal: 1 },
  preview: { color: CREAM, opacity: 0.6, marginTop: 8, fontSize: 14 },
});
