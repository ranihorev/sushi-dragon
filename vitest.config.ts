import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const at = (p: string) => resolve(__dirname, p);

/**
 * The one stub both suites need.
 *
 * `src/game/icloud.ts` asks the native module for itself, which off the device
 * means asking `expo` for something that is not there. It is written to cope
 * with that and hand back nothing — but nothing is not a thing a test can put a
 * second device's file into. The stub is an iCloud made of two Maps.
 *
 * Two entries, because an alias is matched against what the importer wrote, not
 * against the file it lands on: the screens say `@/game/icloud` and `cloud.ts`,
 * sitting beside it, says `./icloud`.
 */
const icloud = [
  { find: /^\.\/icloud$/, replacement: at('test/stubs/icloud.ts') },
  { find: /^@\/game\/icloud$/, replacement: at('test/stubs/icloud.ts') },
];

/**
 * Two suites, because there are two kinds of thing to be wrong about.
 *
 * `core` is the game's thinking — how a word is cut up, which words rhyme with
 * it, how sure we are that he can read it. It is plain TypeScript with no
 * React Native in it anywhere, which is deliberate: the part that is hard to
 * get right can be tested in milliseconds, without a simulator.
 *
 * `screens` is the part that turned out to be wrong in practice. Every fault
 * in the first build he tried was in the wiring — a drop zone that measured
 * finger travel instead of position, a tap that did nothing, no way out of a
 * game. None of that is reachable from the core suite, so the components are
 * rendered here against React Native for Web, with the touch layer replaced by
 * a recorder a test can drive by hand.
 *
 * What this cannot see: whether anything is legible on a screen. A hint drawn
 * as a shadow on a transparent view passes every assertion here and draws
 * nothing at all on an iPad. That still needs eyes.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: icloud },
        test: {
          name: 'core',
          environment: 'node',
          include: ['src/**/*.test.ts', 'test/*.test.ts'],
          restoreMocks: true,
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: [
            /* Vite knows an image when it sees one and hands back a url. It
               does not know a sound: it hands the bytes to node, which tries to
               parse them as JavaScript and fails on the first one that isn't
               ASCII. */
            { find: /^.*\.m4a$/, replacement: at('test/stubs/sound.ts') },
            // before the `@/` rule below, which would otherwise claim it
            ...icloud,
            { find: /^@\//, replacement: `${at('src')}/` },
            { find: 'react-native-gesture-handler', replacement: at('test/stubs/gesture-handler.tsx') },
            { find: 'react-native-reanimated', replacement: at('test/stubs/reanimated.tsx') },
            { find: 'react-native-safe-area-context', replacement: at('test/stubs/safe-area.tsx') },
            { find: /^react-native-svg$/, replacement: at('test/stubs/svg.tsx') },
            { find: 'expo-router', replacement: at('test/stubs/expo-router.tsx') },
            { find: 'expo-haptics', replacement: at('test/stubs/expo-haptics.ts') },
            { find: 'expo-audio', replacement: at('test/stubs/expo-audio.ts') },
            // last, because it is a prefix of most of the entries above it
            { find: /^react-native$/, replacement: 'react-native-web' },
          ],
        },
        test: {
          name: 'screens',
          environment: 'jsdom',
          /* Screen tests live under `test/`, not beside the screen they cover.
             Expo Router turns every file under `src/app` into a route, so a
             colocated `play.test.tsx` is a route that imports vitest — which
             drags vite into the app bundle and breaks the build. Components
             outside `src/app` are safe to colocate, and are. */
          include: ['src/**/*.test.tsx', 'test/screens/**/*.test.tsx'],
          setupFiles: [at('test/setup.ts')],
          restoreMocks: true,
        },
      },
    ],
  },
});
