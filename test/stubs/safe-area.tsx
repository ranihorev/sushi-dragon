import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

export const SafeAreaView = ({ children, ...rest }: ViewProps & { children?: ReactNode }) => (
  <View {...rest}>{children}</View>
);
export const SafeAreaProvider = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
};
