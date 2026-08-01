import { cloneElement, isValidElement, useEffect, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { vi } from 'vitest';

export const router = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  navigate: vi.fn(),
  dismissAll: vi.fn(),
  /* Whether there is a screen behind this one. A test that cares says so with
     `stackedOn(n)`; by default there is one, which is the ordinary case of
     having walked here from the game. */
  canGoBack: vi.fn(() => true),
};

/** How deep the stack is, for a test about a screen opened from nowhere. */
export const stackedOn = (screens: number) => router.canGoBack.mockReturnValue(screens > 0);

export const useRouter = () => router;
export const usePathname = () => '/';
export const useLocalSearchParams = () => ({});
/**
 * Focus, as far as a test is concerned.
 *
 * The real hook runs its callback every time the screen comes back to the
 * front. A screen that only reads the word list once, at startup, is a real
 * bug — the dragon kept saying it could not speak after three words had been
 * recorded — so the stub keeps the callbacks and `refocus()` runs them again,
 * which is what coming back from the grown-ups' side looks like from here.
 */
const focusing: Array<() => void> = [];

export const useFocusEffect = (callback: () => void) => {
  useEffect(() => {
    focusing.push(callback);
    callback();
    return () => {
      const at = focusing.indexOf(callback);
      if (at >= 0) focusing.splice(at, 1);
    };
  }, [callback]);
};

export const refocus = () => focusing.forEach((callback) => callback());

export function Link({
  href,
  children,
  asChild,
}: {
  href: string;
  children: ReactNode;
  asChild?: boolean;
}) {
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ onPress?: () => void }>;
    return cloneElement(child, { onPress: () => router.push(href) });
  }
  return (
    <Pressable onPress={() => router.push(href)}>
      <Text>{children}</Text>
    </Pressable>
  );
}

export const Stack = Object.assign(({ children }: { children?: ReactNode }) => children ?? null, {
  Screen: () => null,
});
export const Slot = ({ children }: { children?: ReactNode }) => children ?? null;
