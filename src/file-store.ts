import { Directory, File, Paths } from 'expo-file-system';

import type { TextStore } from './persist';

/** Everything the app keeps, in one folder inside the iCloud-backed documents. */
export const ROOT = new Directory(Paths.document, 'sushi');

export function ensureRoot() {
  if (!ROOT.exists) ROOT.create({ intermediates: true });
}

/** One small JSON file per key. Both games' profiles live here side by side. */
export function fileStore(): TextStore {
  return {
    get(key) {
      ensureRoot();
      const file = new File(ROOT, `${key}.json`);
      return file.exists ? file.textSync() : null;
    },
    set(key, value) {
      ensureRoot();
      const file = new File(ROOT, `${key}.json`);
      if (!file.exists) file.create();
      file.write(value);
    },
  };
}
