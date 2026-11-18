---
title: shrink | Config
outline: deep
---

# shrink <CRoot /> <Experimental /> <Version type="experimental">5.2.0</Version> {#shrink}

- **Type:** `boolean | number`
- **Default:** `true` (30 seconds)
- **CLI:** `--shrink [time]`, `--no-shrink`

If a test fails with its [`context.random`](/api/random) or [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) values, Vitest runs it again with fewer and smaller random values, and shows a smaller input that fails in the same way. See [Shrink a Failure](/guide/seeded-tests#shrink-a-failure).

A number is the time limit of the search for each failed test, in milliseconds. `true` sets 30 seconds:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    shrink: 10_000,
  },
})
```

`false` turns the search off for all tests. To turn it off for 1 test, for example a test that writes to a database, use the test option:

```ts
test('saves the order', { shrink: false }, async ({ random }) => {
  // ...
})
```

## When Vitest Searches

The search runs only for a failed test, so tests that pass do not get slower. Before the search, Vitest runs the failed seed 1 more time to check that the failure [repeats](/guide/seeded-tests#reproduced-or-not). Seeds that fail at the same place get 1 search.

Vitest does not search if:

- the failure does not repeat,
- the test timed out, because each run of the search could take the full timeout,
- the test has [`fails`](/api/test#test-fails),
- the run replays a tape, for example with [`--replay-seed <seed>:<tape>`](/guide/cli#replay-seed),
- the run was cancelled, for example by [`bail`](/config/bail).
