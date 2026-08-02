import { useEffect, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  children: ReactNode;
  /** off until there is something to say */
  on: boolean;
}

/**
 * Something on the screen, rocking gently, because it is his turn now.
 *
 * A five-year-old cannot read *drag it to the dragon*, and the dragon says so
 * out loud exactly once. Movement is the part of the instruction that is still
 * there thirty seconds later, and a piece of sushi that lifts and settles is
 * asking to be picked up in the only language everybody in the room shares.
 */
export function Bob({ children, on }: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!on) {
      t.value = withTiming(0, { duration: 200 });
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620 }),
        withTiming(0, { duration: 620 }),
      ),
      -1,
      false,
    );
  }, [on, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 * t.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
