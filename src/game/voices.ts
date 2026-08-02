/**
 * The dragon's recorded voice.
 *
 * Written by `scripts/voices.mjs` — edit that, not this. Every clip here was
 * made once, off the device, and ships inside the app, because the game has to
 * work with no network and a five-year-old's patience for a spinner is nil.
 *
 * A word that is not in this table is not a failure: it is a word a parent
 * added after the app was built, and the iPad reads it instead.
 */

import w0 from '../../assets/voice/word-said.m4a';
import w1 from '../../assets/voice/word-was.m4a';
import w2 from '../../assets/voice/word-come.m4a';
import w3 from '../../assets/voice/word-have.m4a';
import w4 from '../../assets/voice/word-they.m4a';
import w5 from '../../assets/voice/word-you.m4a';
import w6 from '../../assets/voice/word-what.m4a';
import w7 from '../../assets/voice/word-one.m4a';
import w8 from '../../assets/voice/word-dragon.m4a';
import w9 from '../../assets/voice/word-sushi.m4a';
import p0 from '../../assets/voice/ask-here-s-a-new-word-it-says.m4a';
import p1 from '../../assets/voice/ask-a-new-one-for-you-this-says.m4a';
import p2 from '../../assets/voice/ask-something-new-this-one-says.m4a';
import p3 from '../../assets/voice/ask-look-what-i-made-it-says.m4a';
import p4 from '../../assets/voice/ask-which-one-says.m4a';
import p5 from '../../assets/voice/ask-find-the-word.m4a';
import p6 from '../../assets/voice/ask-i-would-like.m4a';
import p7 from '../../assets/voice/ask-can-you-find.m4a';
import p8 from '../../assets/voice/ask-my-pieces-are-mixed-up-put-them-in-order-to-make.m4a';
import p9 from '../../assets/voice/ask-put-the-pieces-in-the-right-order-to-make.m4a';
import p10 from '../../assets/voice/ask-these-pieces-are-muddled-put-them-in-order-to-make.m4a';
import p11 from '../../assets/voice/ask-hello-i-m-hungry-let-s-read-some-words.m4a';
import p12 from '../../assets/voice/ask-there-you-are-i-could-eat-a-whole-word.m4a';
import p13 from '../../assets/voice/ask-hello-again-shall-we-feed-the-dragon.m4a';
import p14 from '../../assets/voice/ask-you-made-it-now-feed-it-to-me.m4a';

const WORDS: Record<string, number> = {
  ['said']: w0,
  ['was']: w1,
  ['come']: w2,
  ['have']: w3,
  ['they']: w4,
  ['you']: w5,
  ['what']: w6,
  ['one']: w7,
  ['dragon']: w8,
  ['sushi']: w9,
};

const PHRASES: Record<string, number> = {
  ['Here\'s a new word. It says']: p0,
  ['A new one for you. This says']: p1,
  ['Something new. This one says']: p2,
  ['Look what I made. It says']: p3,
  ['Which one says']: p4,
  ['Find the word']: p5,
  ['I would like']: p6,
  ['Can you find']: p7,
  ['My pieces are mixed up. Put them in order to make']: p8,
  ['Put the pieces in the right order to make']: p9,
  ['These pieces are muddled. Put them in order to make']: p10,
  ['Hello! I\'m hungry. Let\'s read some words.']: p11,
  ['There you are! I could eat a whole word.']: p12,
  ['Hello again. Shall we feed the dragon?']: p13,
  ['You made it! Now feed it to me.']: p14,
};

/** The dragon saying this word, if it was recorded saying it. */
export const wordClip = (text: string): number | undefined => WORDS[text.toLowerCase()];

/** The dragon saying the words that come before a word. */
export const phraseClip = (text: string): number | undefined => PHRASES[text];
