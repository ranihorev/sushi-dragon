/**
 * Enough of Reanimated to run a component in a test.
 *
 * Shared values are real here rather than inert: setting one runs any
 * `useAnimatedReaction` watching it. That matters because the way the game
 * tells the animal to open its mouth is a shared value written from inside a
 * gesture handler — a stub that swallowed the write would let that break
 * silently, which is exactly the class of bug this suite exists to catch.
 */
import { useRef } from 'react';
import { View } from 'react-native';

interface Reaction {
  prepare: () => unknown;
  react: (now: unknown, before: unknown) => void;
  last: unknown;
}

let reactions: Reaction[] = [];

/** Run every watcher, as the real runtime does after a shared value changes. */
function pump() {
  for (const r of reactions) {
    const now = r.prepare();
    if (now !== r.last) {
      const before = r.last;
      r.last = now;
      r.react(now, before);
    }
  }
}

/** Between tests — otherwise watchers from a torn-down tree keep firing. */
export function resetAnimated() {
  reactions = [];
}

export function useSharedValue<T>(initial: T) {
  const ref = useRef<{ value: T }>(null);
  if (!ref.current) {
    let held = initial;
    ref.current = {
      get value() {
        return held;
      },
      set value(next: T) {
        held = next;
        pump();
      },
    };
  }
  return ref.current;
}

export function useAnimatedReaction(
  prepare: () => unknown,
  react: (now: unknown, before: unknown) => void,
) {
  const ref = useRef<Reaction>(null);
  if (!ref.current) {
    ref.current = { prepare, react, last: prepare() };
    reactions.push(ref.current);
  } else {
    ref.current.prepare = prepare;
    ref.current.react = react;
  }
}

/* Animation is time; a test has none. Each of these lands on its target value
   immediately, which is the right approximation: what is asserted is where a
   thing ends up, never how it got there. */
export const withSpring = <T,>(to: T, _cfg?: unknown, done?: () => void) => (done?.(), to);
export const withTiming = <T,>(to: T, _cfg?: unknown, done?: () => void) => (done?.(), to);
export const withDelay = <T,>(_ms: number, to: T) => to;
export const withSequence = <T,>(...steps: T[]) => steps[steps.length - 1];
/** A loop, seen from outside time: wherever one pass of it leaves the value. */
export const withRepeat = <T,>(step: T) => step;
export const useAnimatedStyle = (fn: () => object) => fn();
export const runOnJS = <F,>(fn: F) => fn;
export const runOnUI = <F,>(fn: F) => fn;
export const interpolate = (x: number) => x;
export const Easing = { linear: (x: number) => x, out: (f: unknown) => f, ease: (x: number) => x };

const Animated = { View, Text: View, ScrollView: View, Image: View };
export default Animated;
