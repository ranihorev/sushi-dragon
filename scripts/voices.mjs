#!/usr/bin/env node
/**
 * The dragon's voice, recorded once and shipped in the app.
 *
 * The game speaks constantly and until now it spoke through the iPad's own
 * text-to-speech, which reads a word to a five-year-old the way a lift
 * announces a floor. This puts a real voice on the two things he hears most —
 * the starter words, and the handful of phrases the dragon wraps them in — and
 * leaves the iPad as the fallback for words a parent adds later, which cannot
 * be recorded in advance.
 *
 * The phrase and the word are always separate clips, spliced at play time. One
 * clip per phrase plus one per word is a few dozen files; one clip per
 * combination would be several hundred, and would have to be regenerated every
 * time a line of dialogue changed.
 *
 * Run with the key in the environment:
 *
 *     ELEVEN_LABS_KEY=… node scripts/voices.mjs
 *
 * It is not part of the build. The clips it writes are committed, because the
 * app has to work on a plane and nothing here can run on a device.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = join(ROOT, 'assets/voice');
const AUDIO_DIR = join(ROOT, 'assets/audio');
const TMP = join(ROOT, 'node_modules/.voice-tmp');

const KEY = process.env.ELEVEN_LABS_KEY;
if (!KEY) throw new Error('ELEVEN_LABS_KEY is not set');

/**
 * George — warm, British, and used to reading stories out loud. The game speaks
 * in en-GB everywhere else, and a dragon that sounds like a satnav is a dragon
 * nobody wants to be asked a question by.
 */
const VOICE = 'JBFqnCBsd6RMkjVDRZzb';
const MODEL = 'eleven_multilingual_v2';

/* The word is the thing being learnt, so it is said slower than the sentence
   around it — which is what a person does anyway. */
const WORD_SETTINGS = { stability: 0.55, similarity_boost: 0.8, speed: 0.8 };
const PHRASE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, speed: 0.95 };

/**
 * The two lists, read out of the source rather than kept in step by hand.
 *
 * Both are plain arrays of string literals, and a build script that silently
 * recorded last month's wording would be worse than one that fails.
 */
function literals(file, from, to) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const start = src.indexOf(from);
  if (start < 0) throw new Error(`${from} not found in ${file}`);
  const end = src.indexOf(to, start);
  if (end < 0) throw new Error(`end of ${from} not found in ${file}`);
  /* Comments go first. A comment explaining why a line was reworded quotes the
     line it replaced, and the dragon then recorded that too — a phrase no
     screen in the app can ever ask for, in the voice it uses for real ones. */
  const block = src
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return [...block.matchAll(/'([^']*)'|"([^"]*)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter((s) => s.trim().length > 0);
}

const WORDS = literals('src/game/words.ts', 'export const STARTER_WORDS', '];');
const PHRASES = [
  ...new Set([
    ...literals('src/game/asking.ts', 'const CARRIERS', '\n};'),
    ...literals('src/game/asking.ts', 'export const GREETINGS', '\n];'),
    ...literals('src/game/asking.ts', 'export const READY', '\n'),
  ]),
].filter((p) => p.includes(' '));

/** Noises, not language. Same voice budget, entirely different endpoint. */
const EFFECTS = [
  {
    name: 'munch',
    prompt:
      'a friendly cartoon dragon takes one quick bite of food and swallows it, ' +
      'soft crunch and a gulp, clean and short, no music',
    seconds: 1.5,
  },
  {
    name: 'cheer',
    prompt:
      'a short warm celebratory chime, three ascending bell notes, ' +
      'gentle and magical, for a small child finishing a game, no voices',
    seconds: 2.5,
  },
];

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const speech = (text, settings) =>
  post(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    text,
    model_id: MODEL,
    voice_settings: settings,
  });

const effect = (prompt, seconds) =>
  post('https://api.elevenlabs.io/v1/sound-generation', {
    text: prompt,
    duration_seconds: seconds,
    prompt_influence: 0.6,
  });

/**
 * Down to a small mono clip, with the leading and trailing silence cut off.
 *
 * The trim is the part that matters: these clips are played back to back, and
 * a third of a second of nothing on the end of the phrase turns *which one says
 * — sushi* into two unrelated announcements.
 */
const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02';
function encode(mp3, out) {
  mkdirSync(TMP, { recursive: true });
  const raw = join(TMP, 'raw.mp3');
  writeFileSync(raw, mp3);
  execFileSync(
    'ffmpeg',
    // prettier-ignore
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', raw,
      '-af', `${TRIM},areverse,${TRIM},areverse,loudnorm=I=-16:TP=-1.5:LRA=11`,
      '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k',
      out,
    ],
    { stdio: 'inherit' },
  );
}

/* Emptied first: a clip whose wording has changed keeps its old file under its
   old name forever, and the app ships every file in this folder. */
rmSync(VOICE_DIR, { recursive: true, force: true });
mkdirSync(VOICE_DIR, { recursive: true });
mkdirSync(AUDIO_DIR, { recursive: true });

const words = [];
for (const word of WORDS) {
  const file = `word-${slug(word)}.m4a`;
  encode(await speech(`${word}.`, WORD_SETTINGS), join(VOICE_DIR, file));
  words.push({ key: word, file });
  console.log(`word  ${word}`);
}

const phrases = [];
for (const phrase of PHRASES) {
  const file = `ask-${slug(phrase)}.m4a`;
  encode(await speech(phrase, PHRASE_SETTINGS), join(VOICE_DIR, file));
  phrases.push({ key: phrase, file });
  console.log(`ask   ${phrase}`);
}

for (const { name, prompt, seconds } of EFFECTS) {
  encode(await effect(prompt, seconds), join(AUDIO_DIR, `${name}.m4a`));
  console.log(`sound ${name}`);
}

rmSync(TMP, { recursive: true, force: true });

const quoted = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const table = (rows, prefix) =>
  rows.map((r, i) => `  [${quoted(r.key)}]: ${prefix}${i},`).join('\n');
const imports = (rows, prefix) =>
  rows.map((r, i) => `import ${prefix}${i} from '../../assets/voice/${r.file}';`).join('\n');

writeFileSync(
  join(ROOT, 'src/game/voices.ts'),
  `/**
 * The dragon's recorded voice.
 *
 * Written by \`scripts/voices.mjs\` — edit that, not this. Every clip here was
 * made once, off the device, and ships inside the app, because the game has to
 * work with no network and a five-year-old's patience for a spinner is nil.
 *
 * A word that is not in this table is not a failure: it is a word a parent
 * added after the app was built, and the iPad reads it instead.
 */

${imports(words, 'w')}
${imports(phrases, 'p')}

const WORDS: Record<string, number> = {
${table(words, 'w')}
};

const PHRASES: Record<string, number> = {
${table(phrases, 'p')}
};

/** The dragon saying this word, if it was recorded saying it. */
export const wordClip = (text: string): number | undefined => WORDS[text.toLowerCase()];

/** The dragon saying the words that come before a word. */
export const phraseClip = (text: string): number | undefined => PHRASES[text];
`,
);

console.log(`\n${words.length} words, ${phrases.length} phrases, ${EFFECTS.length} sounds`);
