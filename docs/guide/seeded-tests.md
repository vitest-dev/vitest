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

The first run has the same values as the test without `repeats`. Seeds that you keep in [`seeds`](#keep-the-seeds-that-failed) run before it.

## Replay a Seed {#replay-a-seed}

When a repeat that used its seed fails, Vitest prints a command after the error that runs the test again with this seed:

```
 FAIL  src/raft.test.ts > log entries are never lost
AssertionError: expected [ 1, 2, 4 ] to deeply equal [ 1, 2, 3, 4 ]
 ❯ src/raft.test.ts:12:31

     Failed  1 of 200 runs
     Replay  vitest run src/raft.test.ts -t '^log entries are never lost$' --seed 158412337095872 --replay-seed 3fa2c9e1b07d5a44
```

The command runs the test 1 time with this seed, so you can debug the failure, for example with a debugger or with more logs. Vitest prints it for any failed test that used `context.random` or `vi.useFakeRandom`, also without `repeats`.

The command also has the [`--seed`](/config/seed) of the run, because values outside the test, for example in `beforeAll` hooks or fixtures of file scope, come from it.

### Many Failed Seeds {#many-failed-seeds}

Often many seeds fail at the same place, with other values in the error message. Vitest shows these seeds in 1 block, with 1 error and 1 replay command:

```
 FAIL  src/raft.test.ts > log entries are never lost
AssertionError: expected [ 1, 2, 4 ] to deeply equal [ 1, 2, 3, 4 ]
 ❯ src/raft.test.ts:12:31

     Failed  4 of 200 runs
     Replay  vitest run src/raft.test.ts -t '^log entries are never lost$' --seed 158412337095872 --replay-seed 3fa2c9e1b07d5a44
```

The error and the replay command come from 1 of the seeds. A failure at another place gets its own block. All seeds are in the [reports](#seeds-in-reports).

### Reproduced or Not {#reproduced-or-not}

When a repeat fails with its seed, Vitest runs it 1 more time and compares the errors. If the second run fails with the same error, Vitest prints nothing more. If not, the test depends on more than its seed, and Vitest prints a yellow line:

- `Reproduced  no, the 2nd run passed, so the test depends on more than its seed`: the second run passed, was skipped, or failed with another error. The next line shows the other error.
- `Reproduced  no for 1 of 4 seeds (0e1d2c3b4a596877), so the test depends on more than its seeds`: a block with more than 1 seed names the seeds that did not fail again.

The second run does not change the result of the test. With [`retry`](/api/test#retry), the retries take its place, and a retry that passes makes the test flaky instead of failed.

The second run happens in the same process, right after the failure, so it shares the state of the module with the failed run. Thus a failure that repeats does not prove that the replay command fails, because the command runs only this test.

If the failure does not repeat, look for these causes:

- State that one run leaves for the next, for example a module variable, a cache, or data in a database. Reset it in `beforeEach`, or create it in a fixture of test scope.
- Random values that do not come from the seed. Use `context.random`, or [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) for `Math.random()` and `crypto`.
- Real time. Use [fake timers](/guide/mocking/timers) for `setTimeout` and `Date`. Without the [`order`](#timer-order) and [`jitter`](#timer-order) options, the fake clock starts at the real time, so also set [`now`](/config/faketimers#faketimers-now) or one of these options.

## Seeds in Reports {#seeds-in-reports}

The reports show the same seeds and replay commands as the terminal:

- [JSON](/guide/reporters#json-reporter): `failedSeeds` of a test lists each failed seed with its `runs`, the runs that `reproduced` the error, and its `command`. `seed` is the run seed.
- [JUnit](/guide/reporters#junit-reporter): a `vitest.seed` property for each failed seed, a `vitest.runSeed` property of the test suite, and the seed details at the end of the first `<failure>` of the test.
- [TAP](/guide/reporters#tap-reporter): `# failed`, `# reproduced` and `# replay` comments after the errors of the test.
- [GitHub Actions](/guide/reporters#github-actions-reporter): 1 annotation with the seed details for the seeds that fail at the same place, and a "Failed Seeds" section with the replay command of each test in the job summary.
- [Vitest UI and the HTML report](/guide/ui): the dashboard shows the run seed, and the report of a test shows its errors in the same groups as the terminal, with the seed details, the runs and all seeds of each error, and a button that copies the replay command. The [trace view](/guide/browser/trace-view) shows the seed of each attempt.

In a [merged report](/guide/cli#merge-reports), the replay command of a test has the flags and the seed of the run that tested its file.

## Keep the Seeds That Failed {#keep-the-seeds-that-failed}

Each run gets a new run seed, so a seed that failed in CI does not run again by itself. After you fix the bug, add the seed to the [`seeds`](/api/test#seeds) option. These seeds run before the repeats, so the test checks the old failure on every run. Each seed adds 1 run, and each seed can be in the list only 1 time. If a kept seed fails again, the `Failed` line names it, for example `Failed  1 of 201 runs: kept seed 3fa2c9e1b07d5a44`:

```ts
test('log entries are never lost', {
  repeats: 199,
  seeds: ['3fa2c9e1b07d5a44'],
}, async ({ random }) => {
  // ...
})
```

`seeds` does not set the count of repeats. A test with `seeds` and without `repeats` gets its repeats from a tag, the config or the `--repeats` flag, as in [More Repeats in CI](#more-repeats-in-ci).

The seed of a test changes if you rename the test, move it to another file or suite, or change the run seed. A seed in `seeds` does not change, but after changes to the code it can test another path.

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

Each repeat of a test that uses `context.random` or `vi.useFakeRandom` gets other random values. Other tests run as before. The [`Reproduced`](#reproduced-or-not) line shows if a failure does not repeat with the same seed.

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

## Timer Order and Late Timers {#timer-order}

With [fake timers](/guide/mocking/timers), timers that are due at the same time run in the order of creation, and each timer runs exactly on time. Real timers do not: a busy event loop makes them late, and then their order can change. The [`order`](/config/faketimers#faketimers-order) and [`jitter`](/config/faketimers#faketimers-jitter) options take the order and the delays from the seed of the test, so each repeat tests another schedule:

```ts
test('an invalidation wins over a slow response', { repeats: 99 }, () => {
  vi.useFakeTimers({ order: 'random', jitter: 10 })
  // ...
})
```

Set the options in the [`fakeTimers`](/config/faketimers) config to use them in all tests that call `vi.useFakeTimers()`. Vitest keeps the order that Node.js and browsers guarantee, so a failure shows a schedule that can also happen outside of tests.

With these options, the fake clock also starts at a time from the seed, from 2000 to 2037. Thus each repeat tests another date, for example the last day of a month, and the replay command of a failure starts at the same time on any day. Set [`now`](/config/faketimers#faketimers-now) if a test needs a specific date.

## Limits

- The seed controls only the random values and, with the [`order`](#timer-order) and [`jitter`](#timer-order) options, fake timers. Real timers, I/O, other workers and the order of promises that wait for them can still change the result.
- Only the values of the test change between repeats: `context.random` in the test, its `beforeEach` and `afterEach` hooks and its fixtures of test scope, and `vi.useFakeRandom` while the test runs. [`vi.createRandom`](/api/vi#vi-createrandom), `beforeAll` hooks, fixtures of file and worker scope, and fake values that a module takes when it loads get their values from the run seed, so they are the same for every repeat.
- The `--repeats` flag does not change a test that sets `repeats` itself. Use a tag for the count, as in [More Repeats in CI](#more-repeats-in-ci).
- With [`retry`](/api/test#retry), a repeat that fails and then passes counts as passed. If you want every failure of a repeat to fail the test, do not set `retry` on these tests.
- Each project gets other seeds. In browser mode, each [browser instance](/config/browser/instances) is a separate project.
- `vi.useFakeRandom` throws an error in [concurrent](/api/test#test-concurrent) tests, because the tests share `Math.random`. Use `context.random` in concurrent tests.
- Without a random `order` or a `jitter`, the fake clock starts at the real time. A failure that depends on the date can then pass when you run the replay command on another day.
- With a random `order` or a `jitter`, `vi.useFakeTimers()`, `setTimeout` and the other fake timer functions throw an error in concurrent tests, because the tests share the timers.
