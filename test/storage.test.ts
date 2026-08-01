import { describe, expect, it, vi } from 'vitest';

/**
 * A file system that is not there.
 *
 * This is what `expo-file-system` behaves like off the device. The dev server
 * renders every screen once in node before it serves anything, and in node
 * there is nothing behind the module: asking it for the document directory
 * throws `this.validatePath is not a function`.
 */
const gone = (): never => {
  throw new TypeError('this.validatePath is not a function');
};

vi.mock('expo-file-system', () => ({
  Paths: {
    get document() {
      return gone();
    },
    get cache() {
      return gone();
    },
  },
  Directory: class {
    constructor() {
      gone();
    }
  },
  File: class {
    constructor() {
      gone();
    }
  },
}));

/* A static import, on purpose: if the module reaches for the file system while
   it is being imported, this line throws and the whole file fails. It sits
   below the mock rather than above it for the same reason — read in order, it
   says what it is testing. */
// eslint-disable-next-line import/first
import * as store from '../src/game/storage';

/**
 * What broke, and why it broke everything.
 *
 * The two folders used to be built at module scope. That made the throw above
 * happen during the import, so every screen that reads or writes anything —
 * which is all of them — failed to load, and the app served a 500 with a
 * message about `validatePath` in it. Nothing about that message says
 * "storage", which is what made it expensive to find.
 *
 * The rule this file protects: this module may fail to *store* anything on a
 * platform with no file system, but it must always import, and every call must
 * come back with something the game can be played with.
 */
describe('storage where there is no file system', () => {
  it('imports without touching one', () => {
    expect(typeof store.loadProfile).toBe('function');
  });

  it('hands back a blank profile instead of throwing', () => {
    expect(() => store.loadProfile()).not.toThrow();
    expect(store.loadProfile().mealsCompleted).toBe(0);
  });

  it('still deals the starter words, which are not on disk anyway', () => {
    const words = store.loadDictionary();
    expect(words.length).toBeGreaterThan(0);
    expect(words[0]).toHaveProperty('text');
  });

  it('says the dragon has no voice, rather than dying looking for one', () => {
    expect(store.hasVoice('said')).toBe(false);
  });

  it('swallows a save it cannot make', () => {
    expect(() => store.saveProfile(store.loadProfile())).not.toThrow();
  });
});
