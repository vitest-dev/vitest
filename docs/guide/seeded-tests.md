---
title: Seeded Tests | Guide
outline: deep
---

# Seeded Tests <Experimental /> <Version type="experimental">5.2.0</Version> {#seeded-tests}

A seeded test gets all of its random values from a seed. Vitest can repeat the test with other seeds to find the values that make it fail, and run 1 seed again to debug the failure. This is a small form of deterministic simulation testing: the test controls the random parts of a system, for example the order of network messages, and checks the result for many orders.

## Random Values from a Seed

Each test has its own random source, [`context.random`](/api/random). Its seed comes from the [`seed`](/config/seed) option of the run, the project, the file, and the names of the test and its suites. If you do not set the `seed` option, each run gets a new seed, so the test checks new values on every run. A run with the same seed gets the same values:

```ts
import { expect, test } from 'vitest'

test('the queue keeps the order of messages', async ({ random }) => {
  const queue = new Queue()
  const messages = random.sample(['create', 'update', 'delete', 'archive'], 3)

  for (const message of messages) {
    await queue.push(message, { delay: random.int(0, 50) })
  }

  expect(await queue.drain()).toEqual(messages)
})
```

If your code calls `Math.random()` or `crypto.randomUUID()`, use [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). Then these functions also return values from the seed of the test.

## Repeat a Test with Other Seeds

The [`repeats`](/api/test#repeats) option runs the test again, and each repeat gets its own seed. Thus `context.random` and `vi.useFakeRandom` give other values in each repeat:

```ts
import { expect, test } from 'vitest'
import { Cluster } from '../src/cluster'
import { SimulatedNetwork } from './simulated-network'

test('one leader per term', { repeats: 199 }, async ({ random }) => {
  const network = new SimulatedNetwork(random.fork('network'))
  const cluster = new Cluster({ nodes: 5, network })

  await cluster.run({ steps: 1_000 })

  expect(cluster.leadersPerTerm()).toBe(1)
})
```

`repeats: 199` runs the test 200 times. Each repeat is a full run of the test: `beforeEach`, `afterEach`, `aroundEach` and fixtures of test scope run again for each repeat. `beforeAll`, `afterAll`, `aroundAll` and fixtures of file and worker scope run only 1 time, so all repeats share them.

All repeats run, also after a repeat fails. If a repeat calls `skip()`, Vitest skips only this repeat. The test is skipped only if all of its repeats are skipped.

The runs get their seeds in this order:

1. The seeds in [`include`](#keep-the-seeds-that-failed), in the order of the list.
2. The seed of the test without `repeats`. Thus this run gets the same values as a test without the option. If `include` has this seed, it does not run again.
3. New seeds that come from the seed of the test, 1 for each of the other repeats.

Without `include`, the first run has the seed of the test without `repeats`.

## Replay a Seed {#replay-a-seed}

When a repeat that used its seed fails, Vitest prints the seed after the error, and a command that runs the test again with this seed:

```
 FAIL  src/raft.test.ts > log entries are never lost
AssertionError: expected [ 1, 2, 4 ] to deeply equal [ 1, 2, 3, 4 ]
 ❯ src/raft.test.ts:12:31

     Failed  136th repeat
       Seed  3fa2c9e1b07d5a44
 Reproduced  2 of 2 runs
     Replay  vitest run src/raft.test.ts -t '^log entries are never lost$' --seed 158412337095872 --replay-seed 3fa2c9e1b07d5a44
```

The [`--replay-seed`](/guide/cli#replay-seed) flag runs each selected test 1 time with the seed, even a test with `repeats`. Use the flag to debug the failure, for example with a debugger or with more logs. It also works for tests without `repeats`: Vitest prints the seed of any failed test that used `context.random` or `vi.useFakeRandom`.

The replay command also has the [`--seed`](/config/seed) of the run. The seed of the test sets only the values in the test, its hooks and its fixtures of test scope. Other values come from the run seed: `beforeAll` and `afterAll` hooks, fixtures of file and worker scope, the top level of the file, [`vi.createRandom`](/api/vi#vi-createrandom), and the order of shuffled tests. Without the same `--seed`, these values change.

### Many Failed Seeds {#many-failed-seeds}

Often many seeds fail at the same place, with other values in the error message. Vitest shows these seeds in 1 block, with 1 error and 1 replay command:

```
 FAIL  src/raft.test.ts > log entries are never lost
AssertionError: expected [ 1, 2, 4 ] to deeply equal [ 1, 2, 3, 4 ]
 ❯ src/raft.test.ts:12:31

     Failed  repeats 12, 40-41, 136
      Seeds  3fa2c9e1b07d5a44 (this error), 0e1d2c3b4a596877, 8899aabbccddeeff and 1 more
 Reproduced  4 of 4 seeds
     Replay  vitest run src/raft.test.ts -t '^log entries are never lost$' --seed 158412337095872 --replay-seed 3fa2c9e1b07d5a44
```

The block shows the first 3 seeds. The replay command and the error use the first seed that failed with the same error on every run, marked with `(this error)` when the other seeds have other messages. A failure at another place, or with another type of error, gets its own block. To get all seeds, use [`attempts()`](/api/advanced/test-case#attempts) in a reporter, or `failedSeeds` in the [JSON report](/guide/reporters#json-reporter).

### Reproduced or Not {#reproduced-or-not}

If a repeat that used its seed fails and the test has no [`retry`](/api/test#retry), Vitest runs the same seed 1 more time and compares the errors. The reporter calls this run the replay of the repeat. If the replay fails with the same error, the output shows the error 1 time. If the replay fails with another error, the output shows its error in a separate block, for example `(replay of 136th repeat)`. The output also shows the [trace](/config/experimental#experimental-tracetimeline) of the replay. In [`attempts()`](/api/advanced/test-case#attempts), the replay is the attempt with `retryIndex: 1` of the failed repeat.

- `Reproduced  2 of 2 runs`: the replay failed with the same error.
- `Reproduced  1 of 2 runs`: the replay passed, or failed with another error. The test depends on more than its seed, and Vitest prints this line in yellow.

The replay does not change the result: the test fails also if the replay passes or calls `skip()`. A failed repeat that did not use its seed does not run again.

With `retry`, Vitest does not replay the repeat. Instead, the failed repeat runs again with the same seed as many times as `retry` allows, and [`retry.condition`](/api/test#retry) and `retry.delay` apply. If a retry passes, the repeat counts as passed and the test is reported as flaky. If all runs fail, the output shows how many of them failed with the same error, for example `3 of 3 runs` with `retry: 2`. With more than 1 seed in a block, the line counts seeds, for example `3 of 4 seeds`, and names the seeds that did not reproduce.

The replay runs in the same process, right after the failed run. It has the same module state, the same values from `beforeAll` hooks, and the same fixtures of file and worker scope. Thus `2 of 2 runs` does not prove that the replay command fails. The replay command runs only this test, so it does not have the state that earlier tests in the file left behind. If the replay command passes, look for state that an earlier test changes.

If the failure is not reproduced, look for these causes:

- State that one repeat leaves for the next repeat, for example a module variable, a cache, or data in a database. Reset it in `beforeEach`, or create it in a fixture of test scope.
- Random values that do not come from the seed. Use `context.random`, or [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) for `Math.random()` and `crypto`.
- Real time. Use [fake timers](/guide/mocking/timers) for `setTimeout` and `Date`.

## Seeds in Reports {#seeds-in-reports}

The reports show the same seeds and replay commands as the terminal:

- [JSON](/guide/reporters#json-reporter): `failedSeeds` of a test lists each failed seed with its `runs`, the runs that `reproduced` the error, and its `command`. `seed` is the run seed.
- [JUnit](/guide/reporters#junit-reporter): a `vitest.seed` property for each failed seed, a `vitest.runSeed` property of the test suite, and the seed details at the end of the first `<failure>` of the test.
- [TAP](/guide/reporters#tap-reporter): `# failed`, `# seeds`, `# reproduced` and `# replay` comments after the errors of the test.
- [GitHub Actions](/guide/reporters#github-actions-reporter): 1 annotation with the seed details for the seeds that fail at the same place, and a "Failed Seeds" section with the replay command of each test in the job summary.
- [Vitest UI and the HTML report](/guide/ui): the dashboard shows the run seed, and the report of a test shows its errors in the same groups as the terminal, with the seed details and a button that copies the replay command. The [trace view](/guide/browser/trace-view) shows the seed of each attempt.

In a [merged report](/guide/cli#merge-reports), the replay command of a test has the flags and the seed of the run that tested its file.

## Keep the Seeds That Failed

Each run gets a new run seed, so a seed that failed in CI does not run again by itself. After you fix the bug, add the seed to `include`. The seeds in `include` run before the other repeats, so the test checks the old failure on every run. Each seed in `include` adds 1 run, and each seed can be in the list only 1 time:

```ts
test('log entries are never lost', {
  repeats: { count: 199, include: ['3fa2c9e1b07d5a44'] },
}, async ({ random }) => {
  // ...
})
```

The seed of a test changes if you rename the test, move it to another file or suite, or change the run seed. A seed in `include` does not change, but after changes to the code it can test another path.

## More Repeats in CI

The [`repeats`](/config/repeats) option of the config and the `--repeats` flag set the repeats of tests that do not set `repeats` themselves. To run more repeats of the simulation tests in a nightly job, set `repeats` on a [tag](/guide/test-tags) instead of on the tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      { name: 'simulation', repeats: process.env.NIGHTLY ? 1999 : 99 },
    ],
  },
})
```

Each run tests new seeds, because each run gets a new run seed. Vitest prints the run seed in the summary, and the replay command contains it. If you set the commit hash as the seed, a rerun of the CI job tests the same seeds, so a failure does not go away on a rerun. See [Seeds in CI](/config/seed#seeds-in-ci):

```sh
NIGHTLY=1 vitest run --tags-filter simulation --seed "$GITHUB_SHA"
```

If the config sets `seed`, each run tests the same seeds. To test new seeds in a nightly job, use `--seed random`.

## Find Flaky Tests

To check that all tests are stable, run every test many times:

```sh
vitest run --repeats 99
```

Each repeat of a test that uses `context.random` or `vi.useFakeRandom` gets other random values. Other tests run as before. The replay of a failed repeat that used its seed shows if the failure repeats with the same seed (`2 of 2 runs`) or not (`1 of 2 runs`), for example because of real time or state that the failed run left behind.

## Inject Faults

A simulation finds more bugs if the random values also control faults, for example lost or late messages. Give the code a dependency that gets its decisions from a fork of `context.random`, and use the real dependency in production:

```ts
import type { RandomSource } from 'vitest'

export class SimulatedNetwork implements Network {
  private queue: Message[] = []

  constructor(private random: RandomSource) {}

  send(message: Message): void {
    // lose 1% of the messages
    if (this.random.bool(0.01)) {
      return
    }
    this.queue.push(message)
  }

  // deliver the messages in a random order
  receive(): Message | undefined {
    if (!this.queue.length) {
      return undefined
    }
    return this.queue.splice(this.random.int(0, this.queue.length - 1), 1)[0]
  }
}
```

Each part of the simulation gets its own [fork](/api/random#fork), for example `random.fork('network')` and `random.fork('disk')`. Then a change in one part does not change the values of the other parts.

## Limits

- The seed controls only the random values. Real timers, I/O, other workers and the order of promises that wait for them can still change the result.
- Only the values of the test change between repeats: `context.random` in the test, its `beforeEach` and `afterEach` hooks and its fixtures of test scope, and `vi.useFakeRandom` while the test runs. [`vi.createRandom`](/api/vi#vi-createrandom), `beforeAll` hooks, fixtures of file and worker scope, and fake values that a module takes when it loads get their values from the run seed, so they are the same for every repeat.
- The `--repeats` flag does not change a test that sets `repeats` itself. Use a tag for the count, as in [More Repeats in CI](#more-repeats-in-ci).
- With [`retry`](/api/test#retry), a repeat that fails and then passes counts as passed. If you want every failure of a repeat to fail the test, do not set `retry` on these tests.
- Each project gets other seeds. In browser mode, each [browser instance](/config/browser/instances) is a separate project.
- `vi.useFakeRandom` throws an error in [concurrent](/api/test#test-concurrent) tests, because the tests share `Math.random`. Use `context.random` in concurrent tests.
