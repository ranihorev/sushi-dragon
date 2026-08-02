/**
 * The TypeScript face of `modules/sushi-icloud`.
 *
 * The native half is autolinked and asked for by name, so nothing here has to
 * be imported from a path — which is the whole reason it sits with the game
 * code rather than inside the module folder.
 *
 * `requireOptionalNativeModule` hands back null anywhere the native half is not
 * there: on the web, in node while the dev server renders a screen, in a test.
 * Every function below then does nothing and says so, and the game plays
 * exactly as it did before iCloud existed — which is also what happens on an
 * iPad with no iCloud account, so it is not a special case, it is the ordinary
 * one with the account missing.
 */

import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo-modules-core';

export interface CloudItem {
  name: string;
  /** whether the bytes are on this device yet, or only in the cloud */
  downloaded: boolean;
  size: number;
}

declare class SushiICloud extends NativeModule<{ onChange: () => void }> {
  isAvailable(): Promise<boolean>;
  read(path: string): Promise<string | null>;
  write(path: string, contents: string): Promise<void>;
  list(dir: string): Promise<CloudItem[]>;
  copyIn(path: string, from: string): Promise<void>;
  copyOut(path: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  download(path: string): Promise<void>;
}

const native = requireOptionalNativeModule<SushiICloud>('SushiICloud');

export const isAvailable = () => native?.isAvailable() ?? Promise.resolve(false);

export const read = (path: string) => native?.read(path) ?? Promise.resolve(null);

export const write = (path: string, contents: string) =>
  native?.write(path, contents) ?? Promise.resolve();

export const list = (dir: string) => native?.list(dir) ?? Promise.resolve([]);

export const copyIn = (path: string, from: string) =>
  native?.copyIn(path, from) ?? Promise.resolve();

export const copyOut = (path: string, to: string) => native?.copyOut(path, to) ?? Promise.resolve();

export const remove = (path: string) => native?.remove(path) ?? Promise.resolve();

export const download = (path: string) => native?.download(path) ?? Promise.resolve();

/**
 * Tell me when another device changes something.
 *
 * Returns the way to stop listening, and something that does nothing when
 * there is no iCloud — so a caller never has to ask which it is holding.
 */
export function watch(onChange: () => void): EventSubscription {
  return native?.addListener('onChange', onChange) ?? { remove: () => {} };
}
