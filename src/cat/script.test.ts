import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALL_LETTERS, type Letter } from './letters';
import { allClipNames, catSound, confirmClip, promptClips, randomPraise } from './script';
import type { Round } from './types';

const round = (kind: Round['kind'], target: Letter = 'T'): Round => ({
  kind,
  target,
  options: [target],
});

describe('promptClips', () => {
  it('says the letter, waits, then makes its sound', () => {
    /* The sound of a stop is barely a tenth of a second. Naming the letter
       first is what gives him time to look up before it arrives. */
    expect(promptClips(round('sound'))).toEqual(['letter/T', 460, 'prompt/T']);
  });

  it('leaves a shorter beat for a letter you can hold', () => {
    // /mmm/ can be drawn out, so it does not need as much of a run-up
    expect(promptClips(round('sound', 'M'))).toEqual(['letter/M', 340, 'prompt/M']);
  });

  it('leads a word round with the word', () => {
    expect(promptClips(round('word', 'S'))).toEqual(['word/S', 280, 'prompt/S']);
  });

  it('asks a naming round in one piece', () => {
    // "where's S?" carries its own context and needs nothing before it
    expect(promptClips(round('name', 'S'))).toEqual(['name/S']);
  });
});

describe('the clips the game asks for', () => {
  /**
   * The web version checked this against files on disk. Here the clips are
   * bundled into the app at build time, so the check is against the same
   * folder Metro bundles from — a missing one is silence in the middle of a
   * round, which nobody notices until a child is looking at the screen.
   */
  it('all exist in the bundle', () => {
    const root = path.join(__dirname, '../../assets/audio');
    const missing = allClipNames(ALL_LETTERS).filter(
      (name) => !fs.existsSync(path.join(root, `${name}.mp3`)),
    );
    expect(missing).toEqual([]);
  });

  it('covers every letter of the alphabet', () => {
    expect(allClipNames(ALL_LETTERS).filter((c) => c.startsWith('prompt/'))).toHaveLength(26);
  });
});

describe('the cat picking a noise', () => {
  it('only ever picks one it has', () => {
    const known = new Set(allClipNames(ALL_LETTERS));
    for (let i = 0; i < 40; i++) {
      expect(known.has(catSound('happy'))).toBe(true);
      expect(known.has(catSound('curious'))).toBe(true);
      expect(known.has(randomPraise())).toBe(true);
    }
  });

  it('names a confirmation for every letter', () => {
    for (const letter of ALL_LETTERS) expect(confirmClip(letter)).toBe(`confirm/${letter}`);
  });
});
