import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { CREAM } from '@/theme';

/**
 * The way out.
 *
 * There wasn't one. Both games could only be left by finishing a meal or by
 * knowing about an invisible long-press corner, which is fine for the person
 * who wrote it and useless for everyone else — a child who wants to switch to
 * the other animal, or a parent who wants to stop, was simply stuck.
 *
 * Deliberately quiet rather than hidden: a house is legible to a child who
 * can't read, it sits away from the sushi so it isn't hit by accident during a
 * drag, and it doesn't compete with the word he is supposed to be looking at.
 */
export function HomeButton() {
  return (
    <Pressable
      style={styles.button}
      onPress={() => router.replace('/')}
      accessibilityRole="button"
      accessibilityLabel="back to the front"
      hitSlop={14}
    >
      <Text style={styles.glyph}>⌂</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 10,
    left: 14,
    zIndex: 60,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,231,0.10)',
  },
  glyph: { color: CREAM, fontSize: 30, opacity: 0.75, marginTop: -4 },
});
