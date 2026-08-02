/**
 * An iCloud that is really two Maps.
 *
 * It stands in for `src/game/icloud.ts` everywhere off the device, which is
 * every test and the dev server. The point is not to imitate iCloud closely —
 * it is to be able to put a second device's file in the folder and see what the
 * first one does with it.
 *
 * The two things it does imitate on purpose are the two that bite: a folder
 * that is not there at all, and a file iCloud knows about but has not fetched
 * yet.
 */

/** The cloud: path → contents. */
const cloud = new Map<string, string>();

/** This device's disk: uri → contents. Shared with whatever stands in for storage. */
export const disk = new Map<string, string>();

/** Paths iCloud has heard of but not fetched. */
const pending = new Set<string>();

let available = true;
let listeners: (() => void)[] = [];

export function reset(opts: { available?: boolean } = {}) {
  cloud.clear();
  disk.clear();
  pending.clear();
  available = opts.available ?? true;
  listeners = [];
}

/** Put a file in the cloud, as another device would have. */
export function seed(path: string, contents: string, downloaded = true) {
  cloud.set(path, contents);
  if (!downloaded) pending.add(path);
}

export const peek = (path: string) => cloud.get(path) ?? null;
export const paths = () => [...cloud.keys()];

/** Pretend another device changed something. */
export const announce = () => listeners.forEach((fn) => fn());

// —— the same shape as src/game/icloud.ts ——

export const isAvailable = async () => available;

export const read = async (path: string) => (available ? (cloud.get(path) ?? null) : null);

export const write = async (path: string, contents: string) => {
  if (!available) throw new Error('no iCloud');
  cloud.set(path, contents);
};

export const list = async (dir: string) => {
  if (!available) return [];
  return [...cloud.keys()]
    .filter((path) => path.startsWith(`${dir}/`))
    .map((path) => ({
      name: path.slice(dir.length + 1),
      downloaded: !pending.has(path),
      size: cloud.get(path)!.length,
    }));
};

export const copyIn = async (path: string, from: string) => {
  if (!available) throw new Error('no iCloud');
  const found = disk.get(from);
  if (found === undefined) throw new Error(`nothing at ${from}`);
  cloud.set(path, found);
};

export const copyOut = async (path: string, to: string) => {
  const found = cloud.get(path);
  if (found === undefined || pending.has(path)) throw new Error(`nothing at ${path}`);
  disk.set(to, found);
};

export const remove = async (path: string) => {
  cloud.delete(path);
  pending.delete(path);
};

/** Asking is enough to make it arrive, next time somebody looks. */
export const download = async (path: string) => {
  pending.delete(path);
};

export function watch(onChange: () => void) {
  listeners.push(onChange);
  return { remove: () => (listeners = listeners.filter((fn) => fn !== onChange)) };
}
