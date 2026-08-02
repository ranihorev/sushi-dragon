import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LANTERN, NIGHT } from '@/theme';

/**
 * Ask the dragon to say it again.
 *
 * It used to be the 🔊 emoji in a faint grey circle, down in the corner by the
 * counter. Two things were wrong with that. The emoji is drawn by the system in
 * its own grey plastic, so on a night-blue screen it was the one thing in the
 * game that looked like it belonged to a different app — and it sat by the
 * food, when what it does is repeat the question.
 *
 * So it is drawn here, in the colour the game uses for *press this*, and it
 * lives beside the question it repeats.
 */
export function SayAgain({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={16}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="say it again"
    >
      <View style={styles.circle}>
        <Svg width={26} height={26} viewBox="0 0 24 24">
          {/* the cone, filled: a hollow outline this small reads as a triangle */}
          <Path d="M3,9 h4 l5,-4.5 v15 l-5,-4.5 h-4 z" fill={NIGHT} />
          {/* and the sound coming out of it */}
          <Path
            d="M15.5,8.5 a5,5 0 0 1 0,7"
            stroke={NIGHT}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M18.5,5.5 a9.5,9.5 0 0 1 0,13"
            stroke={NIGHT}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
      <Text style={styles.label}>again</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* A column, so the circle sits on the middle of the screen with everything
     else in this stack. Side by side, the word beside it pushed the circle off
     the line the dragon and the question are drawn on. */
  button: { alignItems: 'center', gap: 3 },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: LANTERN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* For the grown-up. He cannot read it, and the grown-up handing him the iPad
     has three seconds to work out what everything on the screen does. */
  label: { color: LANTERN, fontSize: 13, opacity: 0.75 },
});
