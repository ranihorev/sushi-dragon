import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { fileStore } from '@/file-store';
import { useStore } from '@/persist';
import { NIGHT } from '@/theme';

/* Both games keep their progress as JSON behind a swappable store — tests get
   an in-memory one, and the app points it at the documents directory here, on
   the way in. Documents are what the iPad's iCloud backup includes, so this
   one line is the whole reason a lost iPad costs nothing. */
useStore(fileStore());

export default function RootLayout() {
  return (
    /* Gesture handler wraps everything, because carrying a piece of sushi up
       to the dragon is very nearly the only control the game has. */
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: NIGHT }}>
      <StatusBar hidden />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: NIGHT },
        }}
      />
    </GestureHandlerRootView>
  );
}
