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

When a seed of a test with [`repeats`](/api/test#repeats) or [`seeds`](/api/test#seeds) fails, Vitest runs it 1 more time and compares the errors. A seed that timed out does not run again, because the run could take the full timeout again. A test without them gets this run only before a [search](#shrink-a-failure), and not with `--replay-seed`. This second run is the replay. If the replay fails with the same error, Vitest prints nothing more. If not, the test depends on more than its seed, and Vitest prints a yellow line:

- `Reproduced  no, the replay passed, so the test depends on more than its seed`: the replay passed, was skipped, or failed with another error. The next line shows the other error.
- `Reproduced  no for 1 of 4 seeds (0e1d2c3b4a596877), so the test depends on more than its seeds`: a block with more than 1 seed names the seeds that did not fail again.

The replay does not change the result of the test. With [`retry`](/api/test#retry), the retries take its place, and a retry that passes makes the test flaky instead of failed.

The replay happens in the same process, right after the failure, so it shares the state of the module with the failed run. Thus a failure that repeats does not prove that the replay command fails, because the command runs only this test.

If the replay does not fail again in the same way, Vitest checks if it read the same random values as the failed run, and adds the result to the `Reproduced` line:

- `the failed run and the replay read the same random values`: the random values are not the cause. State from an earlier run, or time and I/O, made the failed run different.
- `the failed run and the replay made other random calls on random.fork('network')`: Vitest runs the seed a third time, and compares the random calls of the replay and of this second replay:

```
 Reproduced  no, the replay passed, so the test depends on more than its seed
             the failed run and the replay made other random calls on random and the fakes of vi.useFakeRandom()
             the replay and a second replay differ at random call 1:
             replay:        Math.random() → 0.9971224539990146 (src/balancer.test.ts:14:29)
             second replay: random.int(0, 100) → 97 (src/balancer.test.ts:11:36)
```

- `differ at random call 1`: the 2 replays also took other paths. The next lines show the call of each run, with its place in the code. The cause is before these calls.
- `the replay and a second replay made the same 3 random calls`: the 2 replays took the same path, so only the failed run was different, for example because a cache was empty only in the first run.

The random calls are the calls of `context.random` and `vi.useFakeRandom`, and the start time of [fake timers](#fake-timers) with a `now` range. The second replay compares the first 10000 calls, and an array shows only its length. The second replay is not an attempt in the results, and its logs, annotations and artifacts are not reported. If the replay failed with a timeout, Vitest does not compare the runs. With `retry`, the retries take the place of the second run, so Vitest does not compare runs.

If the failure does not repeat, look for these causes:

- State that one run leaves for the next, for example a module variable, a cache, or data in a database. Reset it in `beforeEach`, or create it in a fixture of test scope.
- Random values that do not come from the seed. Use `context.random`, or [`vi.useFakeRandom`](/api/vi#vi-usefakerandom) for `Math.random()` and `crypto`.
- Real time. Use the [`fakeTimers`](#fake-timers) test option for `setTimeout` and `Date`, with a `now` range or a fixed `now`.

## Shrink a Failure {#shrink-a-failure}

A failed seed often has more random values than the failure needs, for example 7 jobs when 1 large job is enough. Vitest can look for a smaller input that fails in the same way, and show it after the error. The search is off by default. Turn it on with [`shrink: true`](/config/shrink):

- in the config, for all tests,
- in a tag, for example for simulation tests,
- in the [test option](/api/test#shrink), for 1 test or a `describe`,
- with `--shrink` at the end of the replay command of 1 failure.

The output of a failed test then has the smaller input:

```
 FAIL  src/queue.test.ts > the queue keeps every job
AssertionError: expected [] to deeply equal [ 501 ]
 ❯ src/queue.test.ts:11:25

   Original  AssertionError: expected [ 142, 500, 432 ] to deeply equal [ 142, 891, 914, 546, 714, 500, 432 ]
     Shrunk  from 15 to 3 random values in 163 tries (412ms)
       Keep  examples: [{ jobs: [501] }]
     Replay  vitest run src/queue.test.ts -t '^the queue keeps every job$' --seed 0 --replay-seed 4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH
```

The error comes from the smaller input. With `shrink: true`, the search stops after 10 seconds for each failed test. A number sets another time limit. The duration of the test does not include the search, and the line of the test shows the time of the search, for example `× the queue keeps every job 38ms (search 412ms)`.

A failed test without [`repeats`](/api/test#repeats) or [`seeds`](/api/test#seeds) that reads only the fake values of `vi.useFakeRandom` gets no search. See [When Vitest Searches](/config/shrink#when-vitest-searches).

::: warning Side effects
The search runs the test many times, with its hooks and fixtures. The search and the replay of a seed are correct only if the result of the test depends only on the seed. If the test uses a database, files or a service, give each run the same start state:

- Wrap the test in a database transaction with [`aroundEach`](/api/hooks#aroundeach), and roll it back after the test.
- Give each run a new temporary directory from a test fixture.
- Replace a real service with a fake.
- Make IDs and times in the test, not in the database or in the service.

If you cannot control this state, do not turn the search on for this test, or turn it off with [`shrink: false`](/api/test#shrink). Then the replay of the seed can also give a different result.

The snapshots of the search runs are not saved. If a timer or a promise of a search run throws after the run, Vitest shows these unhandled errors as 1 error for each place, with the count.
:::

### Read the Output {#read-the-shrink-output}

- `Original`: the error before the search, if it differs from the error above.
- `Shrunk`: the size of the smaller input, and how long the search took.
- `Values`: the random values of the smaller input, in the order of the calls.
- `Keep`: the test option that runs the smaller input on every run. See [Keep an Example](#keep-an-example).
- `Replay`: a command that runs the smaller input 1 time, for example to debug it.

`Values` names each value by its label, or by its place in the code:

```
     Values  user → { name: 'Carol', age: 51 }
             Math.random() → 0.7000000029802322 (src/coupon.test.ts:5:64)
             Math.random() → 0 (src/coupon.test.ts:5:64), 7 times
             fakeTimers.now → 2024-01-30T00:00:00.000Z
```

If `Keep` shows an example, Vitest does not show `Values`, because the example has the same values.

::: warning
If `Shrunk` is yellow, the smaller input did not fail again in the same way. Then the error and `Replay` are for the failed seed, not for the smaller input.
:::

### How the Search Works {#how-the-search-works}

Vitest records the random numbers that the test reads. This list is the tape of the run. The search runs the test with fewer and smaller numbers, and keeps each change that still fails with the same type of error at the same line. Smaller numbers give simpler values: `int` and `float` move toward 0, `bool` returns `false`, and `pick` returns an item nearer to the start.

The search changes 1 number at a time, so it can stop at an input that becomes smaller only with 2 changes together. For example, if a test fails when `quantity * price` is above 250, the search can stop at quantity 5 and price 51, and not find quantity 3 and price 84.

Vitest does not search if the failure does not repeat, or if the test timed out, because each run of the search could take the full timeout. If a smaller input makes the test hang, Vitest stops that run and tries another input.

### What the Search Changes {#what-the-search-changes}

The search changes the values of `context.random` and its forks, and of [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). It moves the start time of [fake timers](#fake-timers) toward the start of the `now` range.

::: info Values that do not shrink
The values of `beforeAll` hooks, fixtures of file and worker scope, and [`vi.createRandom`](/api/vi#vi-createrandom) come from the run seed, so they do not change. A library with its own generator gets only a seed from `random`, so its values do not become smaller. fast-check shrinks its values itself. faker can read from `random` with a [randomizer](/api/random#uint32).
:::

::: tip
Use [`many`](/api/random#many) for arrays and [`span`](/api/random#span) for a value that several calls make. Then the search removes or simplifies the whole item or value, and the values after it keep their meaning.
:::

In browser mode, the screenshot and the [trace](/config/experimental#experimental-tracetimeline) of the failure show the failed seed, not the smaller input.

## Seeds in Reports {#seeds-in-reports}

The reports show the same seeds and replay commands as the terminal:

- [JSON](/guide/reporters#json-reporter): `failedSeeds` of a test lists each failed seed with its `repeatIndex`, the index of its error in `failureMessages` (`failureIndex`), its `runs`, the count of runs that failed with the same error (`reproducedRuns`), its `command`, the `tape` of the smallest input, and the numbers of the `shrink` search. `runSeed` is the run seed.
- [JUnit](/guide/reporters#junit-reporter): a `vitest.seed` property for each failed seed, a `vitest.runSeed` property of the test suite, and the seed details at the end of the first `<failure>` of each place where the test failed.
- [TAP](/guide/reporters#tap-reporter): `# failed`, `# reproduced` and `# replay` comments after the first error of each place where the test failed.
- [GitHub Actions](/guide/reporters#github-actions-reporter): 1 annotation with the seed details for the seeds that fail at the same place, and a "Failed Seeds" section in the job summary with the replay command of each place where a test failed.
- [Vitest UI and the HTML report](/guide/ui): the dashboard shows the run seed, and the report of a test shows its errors in the same groups as the terminal, with the seed details, the runs and all seeds of each error, and a button that copies the replay command. The [trace view](/guide/browser/trace-view) shows the seed of each attempt.

In a [merged report](/guide/cli#merge-reports), the replay command of a test has the flags and the seed of the run that tested its file.

## Keep an Example {#keep-an-example}

An example is an input that you write yourself. The [`examples`](/api/test#examples) option sets the results of `span` and `many` by their labels. Examples run before the other runs:

```ts
test('the queue keeps every job', {
  examples: [{ jobs: [501] }],
}, ({ random }) => {
  const jobs = random.many('jobs', () => random.int(0, 1000))
  expect(enqueue(jobs)).toEqual(jobs)
})
```

Unlike a seed, an example keeps its values when the code changes, so it always tests the same input. For forks and labels that run more than 1 time, see [`examples`](/api/test#examples).

After a [search](#shrink-a-failure), `Keep` shows the smaller input as an example if the test reads all of its random values in `span` and `many` calls. Else `Keep` shows the seed and its tape. An example with more than 30 lines also gives the seed.

::: tip
To get examples from the search, read each random value in a labeled `span` or `many`. `Math.random()` with `vi.useFakeRandom`, and fake timers with a `now` range, read values outside of them.
:::

A failed example has no replay and does not start a search. The output names the example and shows a command that runs the test again:

```
 FAIL  src/queue.test.ts > the queue keeps every job
AssertionError: expected [] to deeply equal [ 501 ]

     Failed  1 of 2 runs: 1st example
     Replay  vitest run src/queue.test.ts -t '^the queue keeps every job$' --seed 0
```

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

After a [search](#shrink-a-failure), keep the smaller input instead of the seed. Copy the entry from the `Keep` line. It has the seed and the [tape](#how-the-search-works) of the smaller input, so the test runs the smaller input on every run:

```ts
test('the queue keeps every job', {
  seeds: ['4b22ec81796e2c5c:AQEAAwKr1arVAtHf-sAH'],
}, ({ random }) => {
  const jobs = random.many('jobs', () => random.int(0, 1000))
  expect(enqueue(jobs)).toEqual(jobs)
})
```

Like a seed, a tape depends on the code: after a change, its values can reach other calls. If the test reads more values than the tape has, the rest come from the seed, so the test still runs. If `context.random` or one of its forks reads another count of values than the tape has for it, the `Tapes` row of the summary says that the entry does not fit the code and does not test the original input any more, and shows both counts for up to 3 of them. Then update the entry, or remove it.

::: tip
If the values are plain data, a normal test with these values is easier to read, for example `expect(enqueue([501])).toEqual([501])`.
:::

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

## Check That the Seeds Reach a Case

A test that passes with every seed can still miss a case, for example if a fault is too rare for the count of repeats. Mark the case with [`expect.sometimes`](/api/expect#expect-sometimes). If its condition is false with every seed, the test fails:

```ts
send(message: Message): void {
  const lost = this.random.bool(0.01)
  expect.sometimes(lost, 'a lost message')
  if (!lost) {
    this.queue.push(message)
  }
}
```

## Fake Timers {#fake-timers}

A test that waits for real timers is slow, and a test that reads the real date can pass today and fail on the last day of the month. The [`fakeTimers`](/api/test#faketimers) test option gives each run of the test its own fake clock. With a `now` range, the clock starts at a time from the seed of the test. Thus each repeat tests another date, and the replay command of a failure starts at the same date on any day:

```ts
test('a subscription renews in the next month', {
  repeats: 100,
  fakeTimers: {
    now: { min: new Date('2024-01-01'), max: new Date('2027-12-31') },
  },
}, () => {
  const subscription = subscribe()
  vi.advanceTimersByTime(31 * DAY)
  expect(subscription.invoices).toHaveLength(2)
})
```

Use a range that agrees with the dates in your test data. For code that calls `Math.random()` or `crypto`, add the [`fakeRandom`](/api/test#fakerandom) test option.

::: tip
To give all simulation tests the same options, define a [tag](/guide/test-tags):

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      {
        name: 'simulation',
        repeats: 100,
        shrink: true,
        fakeRandom: true,
        fakeTimers: {
          now: { min: new Date('2024-01-01'), max: new Date('2027-12-31') },
        },
      },
    ],
  },
})
```

```ts
test('a subscription renews in the next month', { tags: 'simulation' }, () => {
  // ...
})
```
:::

## Limits

- The seed controls only the random values and the start time of [fake timers](#fake-timers) with a `now` range. Real timers, I/O, other workers and the order of promises that wait for them can still change the result.
- Only the values of the test change between repeats: `context.random` in the test, its `beforeEach` and `afterEach` hooks and its fixtures of test scope, and `vi.useFakeRandom` while the test runs. [`vi.createRandom`](/api/vi#vi-createrandom), `beforeAll` hooks, fixtures of file and worker scope, and fake values that a module takes when it loads are the same for every repeat.
- The `--repeats` flag does not change a test that sets `repeats` itself. Use a tag for the count, as in [More Repeats in CI](#more-repeats-in-ci).
- With [`retry`](/api/test#retry), a repeat that fails and then passes counts as passed. If you want every failure of a repeat to fail the test, do not set `retry` on these tests.
- Each project gets other seeds. In browser mode, each [browser instance](/config/browser/instances) is a separate project.
- `vi.useFakeRandom` throws an error in [concurrent](/api/test#test-concurrent) tests, because the tests share `Math.random`. Use `context.random` in concurrent tests.
- Without a `now` option, fake timers start at the real time. A failure that depends on the date can then pass when you run the replay command on another day.
- The [`fakeTimers`](/api/test#faketimers) and [`fakeRandom`](/api/test#fakerandom) test options throw an error for concurrent tests, because the tests share the timers and the random functions.
