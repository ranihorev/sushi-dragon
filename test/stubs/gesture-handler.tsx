/**
 * A gesture handler that records instead of listening.
 *
 * There is no touch screen in a test, so this keeps hold of every gesture that
 * is currently mounted and lets a test drive one by hand:
 * `pan(0).dragTo(40)`. That is the only way to ask the questions that actually
 * matter — does letting go up by the animal feed it, does letting go back down
 * on the counter not, does a tap do anything at all.
 *
 * Only *mounted* gestures are visible. React rebuilds them on every render, so
 * a list that simply accumulated would hand a test the very first one built,
 * back when the sushi was still locked, and every assertion after that would
 * be about a screen that no longer exists.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

type Handler = (event: Record<string, unknown>) => void;

export interface Recorded {
  type: 'pan' | 'tap' | 'longPress';
  enabled: boolean;
  handlers: Record<string, Handler>;
}

let nextId = 0;
let drawn = 0;
let live = new Map<number, { at: number; parts: Recorded[] }>();

export function resetGestures() {
  live = new Map();
  nextId = 0;
  drawn = 0;
}

/**
 * Every gesture on screen right now, in the order it is drawn.
 *
 * Drawn order and not mounted order, which are the same thing until something
 * comes back: a slice taken off the plate is a detector that unmounted and
 * mounted again, and by the order it mounted it now sits behind pieces that
 * have been on the counter the whole time. A test that looked up the third
 * piece from the left then drove the second one — silently, and only when the
 * slices happened to be dealt in that order.
 *
 * So each detector says where it was drawn as it registers, which it does on
 * every render, and the number it gave last is the one that counts.
 */
export const gestures = () =>
  [...live.values()].sort((a, b) => a.at - b.at).flatMap((entry) => entry.parts);

const CHAINABLE = [
  'enabled',
  'minDistance',
  'maxDistance',
  'activeOffsetX',
  'failOffsetY',
  'minDuration',
  'maxDuration',
  'shouldCancelWhenOutside',
  'activateAfterLongPress',
  'onBegin',
  'onStart',
  'onUpdate',
  'onEnd',
  'onFinalize',
  'onTouchesDown',
];

function builder(type: Recorded['type']) {
  const self: Recorded = { type, enabled: true, handlers: {} };
  const api: Record<string, unknown> = { __parts: [self] };
  for (const name of CHAINABLE) {
    api[name] = (arg: unknown) => {
      if (name === 'enabled') self.enabled = arg !== false;
      else if (typeof arg === 'function') self.handlers[name] = arg as Handler;
      return api;
    };
  }
  return api;
}

const partsOf = (g: unknown): Recorded[] => (g as { __parts?: Recorded[] })?.__parts ?? [];

const combine = (...gs: unknown[]) => ({ __parts: gs.flatMap(partsOf) });

export const Gesture = {
  Pan: () => builder('pan'),
  Tap: () => builder('tap'),
  LongPress: () => builder('longPress'),
  Exclusive: combine,
  Race: combine,
  Simultaneous: combine,
};

export function GestureDetector({ gesture, children }: { gesture: unknown; children: ReactNode }) {
  const id = useRef<number>(null);
  if (id.current === null) id.current = nextId++;
  // re-registered on every render, so the handlers are always this render's
  live.set(id.current, { at: drawn++, parts: partsOf(gesture) });

  useEffect(() => {
    const mine = id.current!;
    return () => void live.delete(mine);
  }, []);

  return <View>{children}</View>;
}

export const GestureHandlerRootView = View;

/** The nth pan gesture on screen, counting from the left. */
export const pan = (index = 0) => driver('pan', index);
/** The nth tap gesture on screen. */
export const tap = (index = 0) => driver('tap', index);

function driver(type: Recorded['type'], index: number) {
  const found = gestures().filter((g) => g.type === type)[index];
  if (!found) throw new Error(`no ${type} gesture at index ${index}`);

  const fire = (name: string, event: Record<string, unknown> = {}) => {
    if (!found.enabled) return false;
    found.handlers[name]?.({
      translationX: 0,
      translationY: 0,
      absoluteX: 0,
      absoluteY: 0,
      ...event,
    });
    return true;
  };

  return {
    get enabled() {
      return found.enabled;
    },
    start: (e?: Record<string, unknown>) => fire('onStart', e),
    update: (e?: Record<string, unknown>) => fire('onUpdate', e),
    end: (e?: Record<string, unknown>) => fire('onEnd', e),
    /** pick it up, carry it to a screen position, let go there */
    dragTo: (absoluteY: number, absoluteX = 0) => {
      const at = { absoluteX, absoluteY, translationX: absoluteX, translationY: absoluteY };
      fire('onStart', {});
      fire('onUpdate', at);
      return fire('onEnd', at);
    },
  };
}
