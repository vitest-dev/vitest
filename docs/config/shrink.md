---
title: shrink | Config
outline: deep
---

# shrink <CRoot /> <Experimental /> <Version type="experimental">5.2.0</Version> {#shrink}

- **Type:** `boolean | number`
- **Default:** `false`
- **CLI:** `--shrink [time]`, `--no-shrink`

If a test fails with its [`context.random`](/api/random) or [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) values, Vitest can run it again with fewer and smaller random values, and show a smaller input that fails in the same way. See [Shrink a Failure](/guide/seeded-tests#shrink-a-failure).

The search is off by default. It runs a failed test many times, with its hooks and fixtures. `true` turns it on with a time limit of 10 seconds for each failed test. A number is the time limit in milliseconds:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    shrink: true,
  },
})
```

A tag can turn the search on for a group of tests, for example for simulation tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [{ name: 'simulation', shrink: true }],
  },
})
```

The [test option](/api/test#shrink) turns the search on or off for 1 test or a `describe`. If the config turns the search on, turn it off for a test that writes to a database:

```ts
test('saves the order', { shrink: false }, async ({ random }) => {
  // ...
})
```

To search 1 failure, add `--shrink` to its replay command:

```sh
vitest run src/queue.test.ts -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c --shrink
```

The search and its time limit come from the first of these:

1. `false` in the test option: no search for this test.
2. `--no-shrink` or `--shrink <time>` in the CLI. `--shrink` without a time turns the search on, and a number in the test option still sets the time limit.
3. `true` or a number in the test option, from the test, its `describe` or a tag. `true` keeps the time limit of the config, or 10 seconds.
4. The `shrink` config option.

## When Vitest Searches

If the search is on, Vitest searches a failed test that read values from its seed, if the test fails again in the same way and did not time out.

These values come from the seed of the test:

- the values of [`context.random`](/api/random),
- the start time of a [`now` range](/api/test#faketimers),
- the fake values of [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) and [`fakeRandom`](/config/fakerandom), only in a test with [`repeats`](/api/test#repeats) or [`seeds`](/api/test#seeds).

Without `repeats` or `seeds`, a failed test that reads only fake values runs 1 time, and the output shows only its replay command. To search its fake values, add its seed to `seeds`.

Before the search, Vitest runs the failed seed 1 more time to check that the failure [reproduces](/guide/seeded-tests#reproduced-or-not). A test with `repeats` or `seeds` gets this run also when the search is off, but not after a timeout. With [`--replay-seed`](/guide/cli#replay-seed), the search starts after the first run. With [`retry`](/api/test#retry), the retries do this check. Vitest does not search a timeout, because each run of the search could take the full timeout. Seeds that fail at the same place get 1 search.
