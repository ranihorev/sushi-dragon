import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as cloud from '@/game/cloud';
import { NIGHT } from '@/theme';

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

  /**
   * Keeping up with the other device, for as long as the app is open.
   *
   * The subscription lives here rather than on a screen because the folder is
   * only watched while somebody is listening, and the screen most likely to be
   * open — the one with the dragon on it — is the one least likely to think of
   * it. Coming back to the foreground is the moment that matters: it is when a
   * grown-up has just added a word on the phone and picked the iPad up.
   */
  useEffect(() => {
    const stop = cloud.watch(() => {});
    const changes = AppState.addEventListener('change', (next) => {
      // going away too, so the meal that just finished travels while it is fresh
      if (next === 'active' || next === 'background') void cloud.sync();
    });
    void cloud.sync();

    return () => {
      stop();
      changes.remove();
    };
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
