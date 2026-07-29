/**
 * Somewhere to put a string, chosen at startup.
 *
 * Both games keep their progress as JSON, and both want the same three things
 * from wherever it goes: that a damaged file doesn't crash the game, that a
 * full disk doesn't either, and that all of that can be tested without a
 * simulator. So the actual writing is behind this seam — the app installs a
 * file-backed store when it boots, and tests get an in-memory one for free.
 *
 * The file-backed store writes into the app's *document* directory, which is
 * what puts the whole thing inside the iPad's iCloud backup.
 */

export interface TextStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStore(): TextStore {
  const held = new Map<string, string>();
  return {
    get: (key) => held.get(key) ?? null,
    set: (key, value) => void held.set(key, value),
  };
}

let current: TextStore = memoryStore();

export const useStore = (store: TextStore) => {
  current = store;
};

export function readText(key: string): string | null {
  try {
    return current.get(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string) {
  try {
    current.set(key, value);
  } catch {
    /* Out of space, or a permission we don't have. The game plays on and
       forgets this session — losing a meal is better than crashing inside one. */
  }
}
