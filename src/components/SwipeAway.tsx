/* eslint-disable react-hooks/immutability --
   Same as Carry: the whole component writes to Reanimated shared values, which
   the React compiler reads as mutating something it was told to leave alone. */
import * as Haptics from 'expo-haptics';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CREAM, NIGHT } from '@/theme';

/** How much of the row has to leave the screen before letting go means anything. */
const FRACTION = 0.5;
/** and a floor under that, for a narrow row and for one not yet measured */
const LEAST = 150;
/** as far as the finger can carry it, when the width is still unknown */
const ASSUMED_WIDTH = 500;

/** The point of no return: half the row, never less than `LEAST`. */
function gate(width: number) {
  'worklet';
  return Math.max(LEAST, width * FRACTION);
}

interface Props {
  children: ReactNode;
  /** the row went all the way across — the word is gone */
  onRemove: () => void;
  label?: string;
}

/**
 * Push a row off the list to get rid of it.
 *
 * The row already has a **remove** button on it, and that button stays — with
 * its question, because a single tap is easy to make by accident. The swipe is
 * here because it is what a thumb tries first on a list, and a list that
 * ignores it feels dead.
 *
 * The swipe asks nothing. It used to put the button's question on the screen,
 * which made the gesture pointless: two deliberate acts to do what the button
 * already did in two. Instead the distance *is* the question — the row has to
 * be carried half way across before letting go removes anything, the red grows
 * to full as it goes, and the phone taps your thumb at the point where letting
 * go stops being harmless. Anything shorter springs back and costs nothing.
 */
export function SwipeAway({ children, onRemove, label }: Props) {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  /* whether the finger is currently past the point of no return, so the tap on
     the thumb happens once at the crossing rather than on every frame after it */
  const past = useSharedValue(false);

  const measure = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
    },
    [width],
  );

  const home = useCallback(() => {
    x.value = withSpring(0, { damping: 18, stiffness: 220 });
  }, [x]);

  const tick = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const swipe = Gesture.Pan()
    /* Sideways only, and only after the finger has committed to sideways: this
       row lives in a scrolling list and the list has the first claim on an
       up-and-down drag. */
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const full = width.value || ASSUMED_WIDTH;
      x.value = Math.max(-full, Math.min(0, e.translationX));

      const now = -x.value >= gate(width.value);
      if (now !== past.value) {
        past.value = now;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      past.value = false;
      if (-x.value >= gate(width.value)) {
        /* Out of the way first, then gone: the list closing over an empty gap
           is what says the word left, and it cannot say it if the row it is
           closing over is still sitting there. */
        const full = width.value || ASSUMED_WIDTH;
        x.value = withTiming(-full, { duration: 140 }, (finished) => {
          if (finished) runOnJS(onRemove)();
        });
      } else runOnJS(home)();
    });

  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // full red exactly where letting go starts to mean it
  const behind = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -x.value - 20) / (gate(width.value) - 20)),
  }));

  return (
    <View style={styles.track} onLayout={measure}>
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
