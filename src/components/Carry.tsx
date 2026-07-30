import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  enabled: boolean;
  /** carried far enough up and let go */
  onFeed: () => void;
  /** tapped instead of carried — a child's first instinct, and it must do something */
  onTap?: () => void;
  /** screen Y above which letting go counts as feeding */
  dropAboveY: number;
  /** so the animal can open its mouth as the food approaches */
  onOverChange?: (over: boolean) => void;
}

/**
 * Carrying a piece of sushi up to the animal.
 *
 * Three things this has to get right, all of which the first version got
 * wrong:
 *
 * **It has to look grabbed.** A piece that doesn't move under the finger reads
 * as broken. It lifts and grows slightly the moment it is picked up.
 *
 * **The drop zone is a place, not a distance.** The first version fed the
 * animal when the finger had travelled 80 points upward, which meant a piece
 * dragged sideways and back counted, and a piece already near the top did not.
 * Now it is simply: let go above this line. The line is the bottom of the
 * animal, and the whole area above it counts — being fussy about the drop
 * point tests motor control rather than reading.
 *
 * **A tap has to do something.** He is five; his first instinct is to tap. The
 * web version answered a tap by hopping the piece and replaying the question,
 * and that got lost in the port — so tapping did nothing at all, which is
 * exactly the sort of thing that makes a game feel broken.
 */
export function Carry({ children, enabled, onFeed, onTap, dropAboveY, onOverChange }: Props) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const held = useSharedValue(0);
  const over = useSharedValue(0);
  const hop = useSharedValue(0);

  const notify = useCallback(
    (isOver: boolean) => onOverChange?.(isOver),
    [onOverChange],
  );

  useAnimatedReaction(
    () => over.value,
    (now, before) => {
      if (before !== null && now !== before) runOnJS(notify)(now === 1);
    },
  );

  const bounce = useCallback(() => {
    hop.value = withSpring(1, { damping: 4, stiffness: 260 }, () => {
      hop.value = withSpring(0);
    });
  }, [hop]);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(6)
    .onStart(() => {
      held.value = withTiming(1, { duration: 120 });
    })
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
      over.value = e.absoluteY < dropAboveY ? 1 : 0;
    })
    .onEnd((e) => {
      const landed = e.absoluteY < dropAboveY;
      held.value = withTiming(0, { duration: 140 });
      over.value = 0;
      if (landed) {
        runOnJS(onFeed)();
        // it has been eaten; snap back invisibly rather than flying home
        x.value = 0;
        y.value = 0;
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  /* A tap is a real answer to "I don't know what to do", so it gets a reply:
     the piece hops to show it wants carrying, and the question plays again. */
  const tap = Gesture.Tap()
    .enabled(enabled && !!onTap)
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(bounce)();
      if (onTap) runOnJS(onTap)();
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value - hop.value * 16 },
      { scale: 1 + held.value * 0.08 + over.value * 0.06 },
    ],
    shadowOpacity: 0.35 * held.value,
    zIndex: held.value > 0 ? 50 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View style={[styles.piece, style]}>
        <View>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  piece: {
    shadowColor: '#000',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
});
