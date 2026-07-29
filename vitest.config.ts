import { defineConfig } from 'vitest/config';

/* The game's thinking — how a word is cut up, which words rhyme with it, how
   sure we are that he can read it — is plain TypeScript with no React Native
   in it anywhere. That is deliberate: it means the part that is hard to get
   right can be tested in milliseconds, without a simulator. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
