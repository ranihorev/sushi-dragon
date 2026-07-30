import { cloneElement, isValidElement, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { vi } from 'vitest';

export const router = {
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  navigate: vi.fn(),
  dismissAll: vi.fn(),
};

export const useRouter = () => router;
export const usePathname = () => '/';
export const useLocalSearchParams = () => ({});
export const useFocusEffect = () => {};

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
