import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = resolve(__dirname, '../src/app');

function everyFile(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? everyFile(path) : [path];
  });
}

/**
 * Expo Router turns every file under `src/app` into a route.
 *
 * That includes a test file. A colocated `play.test.tsx` becomes a route that
 * imports vitest, which drags vite into the app bundle, and the export dies
 * with a syntax error deep inside `vite/dist/node/module-runner.js` — a long
 * way from anything that looks like the cause. It happened once; this is here
 * so it cannot happen quietly again.
 *
 * Screen tests live in `test/screens/` instead. Components outside `src/app`
 * are not routes and their tests sit beside them, which is where they belong.
 */
describe('the routes directory', () => {
  it('holds nothing but routes', () => {
    const strays = everyFile(APP)
      .filter((path) => /\.(test|spec)\.[jt]sx?$/.test(path))
      .map((path) => relative(APP, path));

    expect(strays).toEqual([]);
  });
});
