# Sushi Dragon

Two games on one counter, for one child.

**The cat** teaches letter sounds. It hears a sound and he drags the matching
piece of sushi up to the cat to feed it. Ported from the web version at
`../sushi_cat`, which still runs there.

**The dragon** teaches him to read words he has never met. Every time he stalls
on a word in a book you add it, in your own voice, and it comes back to him as
sushi until he owns it.

```bash
pnpm install
pnpm start          # then open on the iPad
pnpm test           # 136 tests, no simulator needed
```

---

## How the dragon teaches

**The shape of the sushi is the shape of the word.** One syllable is one piece
of nigiri. More is a roll, sliced — `to · ma · to` — and the cuts fall exactly
where the seams in the word do. The food tells him how to break the word up
before he has read a letter of it.

That matters because the wall a child hits after CVC words is length: sounding
out `d-r-a-g-o-n` is six things to hold in your head at once, which is past what
a five-year-old has. `drag` + `on` is two.

**The seams are a guess, and you can move them.** `dragon` and `birthday` come
out right; `tiger` comes out `tig|er`, because no rule distinguishes it from
`finger`. Tap between any two letters to move a cut. Fixed once, fixed for good
— the pieces are stored on the word rather than recomputed.

**Letters that lie get wasabi.** `said` is almost entirely regular: the `s` and
the `d` behave perfectly and only the `ai` misbehaves. Marking exactly that much
keeps his decoding instinct intact and leaves something much smaller to
remember than "this word is just weird".

**One word buys a family.** Adding `night` also brings `light`, `right`,
`fight`. The same table supplies the wrong answers in picking rounds, so he
chooses between `night` and `light` rather than `night` and `dog` — there is no
shortcut through that except reading.

**Four kinds of round**, and words climb between them:

| | what he does | scored |
|---|---|---|
| meet | the dragon sears a new word and says it | no |
| pick | hears it, finds it among near-identical words | yes, automatically |
| order | puts the slices of a roll back in order | yes, automatically |
| read | reads it cold, feeds it, the dragon says it back | by you |

**You are the scorer for the one that matters.** Reading aloud is the actual
skill and no tablet can hear it reliably, so three buttons appear after a
reading round: *got it*, *a nudge*, *not yet*. They change nothing he can see —
the dragon is delighted either way — and only decide when the word comes back.
If you don't tap, the round moves on unscored.

Nothing enters the hoard on picking alone. A word he can pick out of a line-up
eight times may only be a shape he recognises, so the hoard means *my son can
read this* rather than *my son can spot this*.

## Pacing

Inherited from the cat game, where the worst bug was never a missing sound but
two sounds arriving on top of each other. Everything goes through one queue that
plays one thing at a time; silences are members of that queue rather than an
afterthought; starting a new sequence abandons the old one instead of talking
over it. The gaps are longer than they look like they should be — see the
constants at the top of each play screen.

## Where things are

```
src/
  game/      the dragon: chunker, families, tricky words, rounds, progress
  cat/       the letter game: letters, rounds, mastery, what the cat says
  components/  Cat, Dragon, Sushi, SeamEditor
  app/       routes — index is the two doors
  persist.ts   a swappable place to put a string (files on device, memory in tests)
assets/audio/  the cat's 150 recorded clips
```

The parts worth being sure about — how a word is cut up, which words rhyme,
whether he can read one, what the cat says and in what order — have no Expo and
no React in them, which is why the tests run in half a second without a
simulator.

## Storage

Everything lives in the app's **documents** directory, not the cache, because
documents are what the iPad's iCloud backup includes. Lose the iPad and the word
list, the progress and your recordings all come back with the restore.

The parent screen also exports the lot as one file — recordings included, since
those are the part you cannot regenerate — for Files → iCloud Drive.

## Not done yet

- The cat's restaurant background and earned decorations
- The cat's parent screen (per-letter mastery, active set, name entry)
- Its synthesised chomp and chime are haptic taps now; Web Audio oscillators
  have no equivalent in `expo-audio`
- Generating a word's audio instead of recording it — needs a server
