---
title: seed | Config
outline: deep
---

# seed <CRoot /> <Experimental /> <Version type="experimental">5.2.0</Version> {#seed}

- **Type:** `number | 'random'`
- **Default:** `0`, or a random seed if files or tests are shuffled
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

If the config does not shuffle files or tests, the default seed is `0`. Then `context.random` returns the same values, and suites shuffled with `describe.shuffle` keep the same order on every run. Set another seed to test other values:

```sh
vitest --seed 42
```

Use `random` to generate a new seed. If tests are shuffled and you do not set a seed, Vitest also generates a new seed on every run. Vitest prints the seed at the start of the run and in the summary, so you can repeat the run with the same order and the same values:

```sh
$ vitest --seed random

 RUN  v5.2.0 /home/user/project
      Running tests with seed "158412337095872"

 ✓ src/queue.test.ts (12 tests) 18ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
       Seed  158412337095872
   Start at  10:24:31
   Duration  412ms
```

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

To use one seed in all shards, give each shard the same seed, for example the ID of the CI run. Then you know the seed before the tests start, also if a shard does not finish. A test gets the same values in each shard and in a run without `--shard`:

```yaml
- run: npx vitest run --reporter=blob --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }} --seed=${{ github.run_id }}
```

Vitest throws an error if the value is not a number or `'random'`.

::: tip
[`sequence.seed`](/config/sequence#sequence-seed) is a deprecated alias of this option. If both are set, `seed` wins.
:::
