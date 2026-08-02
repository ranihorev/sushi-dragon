/* eslint-disable react-hooks/immutability --
   Same as Carry: the whole component writes to Reanimated shared values, which
   the React compiler reads as mutating something it was told to leave alone. */
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { CREAM, NIGHT } from '@/theme';

/** How far left it has to go before letting go means anything. */
const FAR_ENOUGH = 90;
/** and how far it can go at all — enough to read the word behind it */
const STOP = 130;

interface Props {
  children: ReactNode;
  /** the swipe finished — ask, then remove */
  onRemove: () => void;
  label?: string;
}

/**
 * Push a row aside to get rid of it.
 *
 * The row already has a **remove** button on it, and that button stays: a
 * gesture nobody can see is a feature nobody finds, and this is the screen a
 * grown-up visits twice a year. The swipe is here because it is what a thumb
 * tries first on a list on an iPad, and a list that ignores it feels dead.
 *
 * Letting go does not delete anything. It asks — the same question the button
 * asks — and the row slides back while the question is on screen, so cancelling
 * leaves the list exactly as it was.
 */
export function SwipeAway({ children, onRemove, label }: Props) {
  const x = useSharedValue(0);

  const home = useCallback(() => {
    x.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [x]);

  const ask = useCallback(() => {
    onRemove();
    home();
  }, [onRemove, home]);

  const swipe = Gesture.Pan()
    /* Sideways only, and only after the finger has committed to sideways: this
       row lives in a scrolling list and the list has the first claim on an
       up-and-down drag. */
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.value = Math.max(-STOP, Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < -FAR_ENOUGH) runOnJS(ask)();
      else runOnJS(home)();
    });

  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // the word behind only appears once the row is genuinely on its way
  const behind = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -x.value - 20) / (FAR_ENOUGH - 20)),
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.behind, behind]} pointerEvents="none">
        <Text style={styles.behindText}>remove</Text>
      </Animated.View>

      <GestureDetector gesture={swipe}>
        <Animated.View
          style={[styles.row, sliding]}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 12, overflow: 'hidden' },
  behind: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#a33a2b',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 22,
  },
  behindText: { color: CREAM, fontSize: 15, fontWeight: '700' },
  /* Solid, because the row it carries is a translucent panel and the red would
     otherwise glow through it from the first pixel of the drag. */
  row: { backgroundColor: NIGHT, borderRadius: 12 },
});
