# The mastery score couldn't reach its own thresholds

**Status:** fixed. `src/game/progress.ts`.

## What was wrong

`mastery` was a running average that converges on the child's own credit rate,
and the thresholds read against it were set above the rate they were meant to
certify. A child who read a word correctly most of the time could sit below the
bar permanently, no matter how much he practised.

`bump` moved the score a fixed fraction toward each result:

```ts
mastery: prev.mastery + alpha * (credit - prev.mastery)
```

An exponential average settles on the *mean of what you feed it*. So after
enough showings, `mastery` ≈ the child's average credit — nothing more.

Credits are `got: 1`, `nudge: 0.5`, `not-yet: 0`, and `isSolid` wanted
`mastery >= 0.85`. Solving for the mix that sustains that:

```
x·1 + (1−x)·0.5 = 0.85   →   x = 0.7
```

**A word only became solid if roughly 70% of reads were a clean `got`, with no
`not-yet` at all.** A child who alternated `got` and `nudge` — reading it, but
needing a nudge half the time — settled at 0.75 and never qualified. That is a
child who can substantially read the word.

Second problem: `ALPHA_READ = 0.4` gave the average a half-life of about 1.4
reads, so one `not-yet` knocked the score 40% toward zero. The score flickered
rather than reflecting a trend.

It bit in three places, all inheriting the same flaw: `isSolid` (the hoard),
the parent screen's count and progress bars, and the difficulty ramp in
`engine.ts` — which meant a child could stay on three choices and scaffolded
`order` rounds forever.

## The fix

The running average is gone. A stat now keeps `recent: Verdict[]`, the last
`WINDOW = 4` showings, and `grip()` reads it as a plain fraction of the credit
available:

```ts
export const grip = (s: WordStat): number =>
  s.recent.reduce((n, v) => n + CREDIT[v], 0) / WINDOW;

export function isSolid(p: DragonProfile, word: string): boolean {
  const s = statFor(p, word);
  return s.spoken >= 2 && s.recent.length >= WINDOW && grip(s) >= 0.75;
}
```

That reads as **"three of his last four, where a nudge counts half"** — a fixed
window one bad day can't undo, a rule a parent can check by watching, and no
alpha to tune. The `spoken >= 2` gate is unchanged; it is what stops
recognition alone filling the hoard.

Two consequences worth knowing:

- **A correct pick now counts the same as a clean read** inside the window,
  where before it moved the score at roughly half the rate. The distinction
  didn't disappear, it moved to where it matters: `isSolid` asks separately how
  many times he has read the word *out loud*, so the hoard still means what it
  said it meant.
- **`engine.ts` reads `grip(stat)`** everywhere it used to read `stat.mastery`.
  The thresholds (`0.3` / `0.65` / `0.7`) are unchanged and now sit on a scale
  that can actually reach them.

## Migration

`statFor` normalises on read: a stored stat with a `mastery` number and no
`recent` array gets a window spread back across it worth the same credit
(`spread()`). Nobody's hoard empties on upgrade, and nobody is handed one they
didn't earn — both cases are covered in `progress.test.ts`.
