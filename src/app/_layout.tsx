import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
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
  /* Take an update at launch rather than the launch after.

     Left to itself expo-updates downloads in the background and only runs the
     new version next time the app opens, which means every change has to be
     launched twice before it appears — long enough to convince you a fix
     didn't work. Doing it here costs a moment at startup and nothing else,
     since the child is never mid-round when the app is starting. */
  useEffect(() => {
    if (__DEV__) return;
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        /* offline, or the update server is unreachable — play the version
           already on the device, which is the whole point of it being local */
      }
    })();
  }, []);

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
