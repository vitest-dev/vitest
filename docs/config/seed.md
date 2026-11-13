---
title: seed | Config
outline: deep
---

# seed <CRoot /> <Experimental /> <Version type="experimental">5.2.0</Version> {#seed}

- **Type:** `string | number`
- **Default:** a new random seed on every run
- **CLI:** `--seed <seed>`

The seed for the order of shuffled files and tests (see [`sequence.shuffle`](/config/sequence#sequence-shuffle)), for [`context.random`](/guide/test-context#random), and for [`vi.createRandom`](/api/vi#vi-createrandom). Vitest derives a separate seed for each of these values:

| Values                                                                                                                                                                  | Inputs in addition to this seed                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`context.random`](/guide/test-context#random)                                                                                                                          | The project name, the file path, and the names of the test and its suites   |
| [`vi.createRandom`](/api/vi#vi-createrandom), [`project.createRandom`](/api/advanced/test-project#createrandom)                                                         | The project name and the labels                                             |
| The order of tests in a suite shuffled with [`sequence.shuffle.tests`](/config/sequence#sequence-shuffle-tests) or [`describe.shuffle`](/api/describe#describe-shuffle) | The project name, the file path, and the names of the suite and its parents |
| The order of files shuffled with [`sequence.shuffle.files`](/config/sequence#sequence-shuffle-files)                                                                    | None                                                                        |

A test keeps its random values when you filter or shuffle tests, or add other tests to the file. A shuffled suite keeps its order when you add or remove other suites.

Each project gets different values. In browser mode, each [browser instance](/config/browser/instances) is a separate project, so a test gets different values in each browser.

Any string is a valid seed, for example a commit hash, a branch name or a date. A number is the same seed as its string, so `seed: 42` and `--seed 42` give the same values. The CLI keeps the value as text, so `--seed 007` and `--seed 7` are different seeds.

## A new seed on every run

If you do not set a seed, Vitest generates a new seed on every run. A test that reads `context.random` gets new values on every run, so it can find a failure that one fixed seed does not show.

Vitest prints the seed at the start of every run and in the summary. Use the seed to repeat the run with the same order and the same values:

```sh
$ vitest

 RUN  v5.2.0 /home/user/project
      Running tests with seed "158412337095872"

 ✓ src/queue.test.ts (12 tests) 18ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
       Seed  158412337095872
   Start at  10:24:31
   Duration  412ms

$ vitest --seed 158412337095872
```

These runs use the seed of the previous run, so a failure that depends on the seed fails again:

- [`--last-failed`](/guide/cli#last-failed) uses the seed of the last run. Use `--seed random` to get a new seed.
- A restart in watch mode, for example after a change to the config file, keeps the seed.

`random` generates a new seed. Use it to replace a seed that the config sets:

```sh
vitest --seed random
```

To get the same values on every run, for example for a snapshot of values from `context.random`, set the seed in the config:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    seed: 'snapshots',
  },
})
```

## Seeds in CI

If you split the run with [`--shard`](/guide/cli#shard) and the seed is random, each shard generates its own seed. The summary of [`--merge-reports`](/guide/cli#merge-reports) shows the seed of each blob report:

```sh
$ vitest run --merge-reports

 Test Files  2 failed | 4 passed (6)
      Tests  3 failed | 120 passed (123)
       Seed  158412337095872 (blob-1-2.json)
             994512338100417 (blob-2-2.json)
   Start at  10:24:31
   Duration  8.12s
   Per blob  4.20s 3.92s
```

To use one seed in all shards, give each shard the same seed. The commit hash is a good seed:

- Each commit tests new values.
- A rerun of the CI job uses the same values, so a failure stays.
- You can repeat the run on your machine with `vitest --seed $(git rev-parse HEAD)`.
- You know the seed before the tests start, also if a shard does not finish.

A test gets the same values in each shard and in a run without `--shard`:

```yaml
- run: npx vitest run --reporter=blob --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }} --seed=${{ github.sha }}
```

Vitest throws an error if the value is an empty string or a number that is not finite.

::: tip
[`sequence.seed`](/config/sequence#sequence-seed) is deprecated. If `seed` is not set, Vitest uses `sequence.seed` as the seed. If both are set, Vitest ignores `sequence.seed`.
:::
