---
title: Random API
outline: deep
---

# Random <Experimental /> <Version type="experimental">5.2.0</Version> {#random}

A random source returns random values from a seed. Two sources with the same seed return the same values in the same order, so a run with the same [`seed`](/config/seed) option repeats the values of the previous run. There are 3 ways to get a random source:

- [`context.random`](/guide/test-context#random) in a test, its hooks and fixtures of test scope. Each test has its own seed.
- [`vi.createRandom`](/api/vi#vi-createrandom) in code without a test context, such as suite hooks, fixtures of file or worker scope, and setup files.
- [`project.createRandom`](/api/advanced/test-project#createrandom) in a [global setup file](/config/globalsetup).

For code that calls `Math.random()` or `crypto.randomUUID()`, use [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). To run a test with many seeds and replay a seed that failed, see [Seeded Tests](/guide/seeded-tests).

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

Each call reads the next numbers of the source (see [Algorithm](#algorithm)). If you add a call, the calls after it return different values. To keep the values of one part of a test when another part changes, use [`fork`](#fork).

::: details Algorithm
A random source is a [`xoshiro128**`](https://prng.di.unimi.it/) generator that makes a sequence of 32-bit numbers. Its 128-bit state comes from 2 outputs of splitmix64 on the 64-bit seed. A fork gets its seed from the seed of the parent and the label, so it reads no numbers from the parent.

Each method reads the next numbers of the sequence and makes its result from them. `uint32()` returns 1 number as it is.

| Method                    | Numbers that it reads                           |
| ------------------------- | ----------------------------------------------- |
| `uint32()`, `bool()`      | 1                                               |
| `next()`, `weighted()`    | 2                                               |
| `int(min, max)`, `pick()` | 1, sometimes more                               |
| `float(min, max)`         | 2, sometimes more. 0 if `min` equals `max`      |
| `shuffle(items)`          | 1 for each item after the first, sometimes more |
| `sample(items, count)`    | `count`, sometimes more                         |
| `bytes(length)`           | 1 for each 4 bytes, rounded up                  |
| `uuid()`                  | 4                                               |
| `fork()`, `seed`          | 0                                               |

A method reads more numbers only in these cases:

- `int` divides the `2^32` possible numbers into `max - min + 1` groups of equal size. If a number is above the last full group, `int` reads 1 more, so each integer has the same chance. This is rare: for `int(1, 1000)`, it occurs about 1 time in 14 million calls. `pick`, `shuffle` and `sample` use `int`.
- `float` reads 2 more if rounding gives `max`. This occurs only if the range is very small compared to `min`, for example in about half of the calls to `float(1e16, 1e16 + 2)`.

A call that throws an error reads no numbers.
:::

The type of a random source is `RandomSource`, which `vitest` exports:

```ts
import type { RandomSource } from 'vitest'
```

## seed

```ts
const seed: string
```

The seed of the random source as 16 lowercase hexadecimal digits. The [`seed`](/config/seed) option shows the inputs that Vitest uses to derive it.

Use it as a string seed for other libraries:

```ts
import seedrandom from 'seedrandom'
import { test as baseTest } from 'vitest'

export const test = baseTest.extend('rng', ({ random }) => {
  return seedrandom(random.fork('seedrandom').seed)
})
```

## next

```ts
function next(): number
```

Returns a float in `[0, 1)` with 53 random bits, like `Math.random()`. Use it for code that accepts a function like `Math.random`:

```ts [backoff.js]
export function backoff(attempt, random = Math.random) {
  return 2 ** attempt * 100 * (0.5 + random())
}
```

```ts [backoff.test.js]
import { expect, test } from 'vitest'
import { backoff } from './backoff.js'

test('the delay grows with each attempt', ({ random }) => {
  expect(backoff(3, random.next)).toBeGreaterThan(backoff(1, random.next))
})
```

## uint32

```ts
function uint32(): number
```

Returns an integer in `[0, 2^32)`. Use it as a numeric seed for other libraries:

```ts
import { base, en, Faker } from '@faker-js/faker'
import { test as baseTest } from 'vitest'

export const test = baseTest.extend('faker', ({ random }) => {
  return new Faker({ locale: [en, base], seed: random.fork('faker').uint32() })
})
```

Create a new instance of the library for each test. Tests that run at the same time (see [`test.concurrent`](/api/test#test-concurrent)) share a global instance, so its values depend on the order of the tests.

## int

```ts
function int(min: number, max: number): number
```

Returns an integer in `[min, max]`. Both `min` and `max` are possible results. Each integer has the same chance.

```ts
const port = random.int(1024, 65535)
```

Throws a `RangeError` if `min` or `max` is not a safe integer, if `min` is greater than `max`, or if the range has more than `2^32` integers.

## float

```ts
function float(min: number, max: number): number
```

Returns a float in `[min, max)`. If `min` equals `max`, returns `min`. For a float in `[0, 1)`, use [`next`](#next).

```ts
const price = random.float(0.5, 100)
```

Throws a `RangeError` if `min` or `max` is not a finite number, if `min` is greater than `max`, or if `max - min` is greater than `Number.MAX_VALUE`.

## bool

```ts
function bool(probability?: number): boolean
```

Returns `true` with the given probability, from `0` to `1`. The default probability is `0.5`. `bool(0)` always returns `false`, and `bool(1)` always returns `true`.

```ts
const offline = random.bool(0.1) // true in 10% of the cases
```

Throws a `RangeError` if the probability is not between `0` and `1`.

## pick

```ts
function pick<T>(items: readonly T[]): T
```

Returns one item of the array. Each item has the same chance.

```ts
const locale = random.pick(['en-US', 'de-DE', 'ja-JP'])
```

Throws a `RangeError` if the array is empty.

## weighted

```ts
function weighted<T>(entries: readonly (readonly [value: T, weight: number])[]): T
```

Returns one value from a list of `[value, weight]` entries. The chance of each value is its weight divided by the sum of all weights. A value with the weight `0` is never returned.

```ts
// 'read' in 80% of the cases, 'write' in 15% and 'delete' in 5%
const operation = random.weighted([
  ['read', 80],
  ['write', 15],
  ['delete', 5],
])
```

Throws a `RangeError` if a weight is negative or not finite, if the sum of the weights is greater than `Number.MAX_VALUE`, or if no weight is greater than `0`.

## shuffle

```ts
function shuffle<T>(items: readonly T[]): T[]
```

Returns a shuffled copy of the array. Each order has the same chance. The original array does not change.

```ts
const events = random.shuffle(['connect', 'message', 'close'])
```

## sample

```ts
function sample<T>(items: readonly T[], count: number): T[]
```

Returns `count` items from different positions of the array, in a random order. If a value is at 2 positions of the array, the result can contain it 2 times. The original array does not change.

```ts
const winners = random.sample(users, 3)
```

Throws a `RangeError` if `count` is not an integer from `0` to the length of the array.

## bytes

```ts
function bytes(length: number): Uint8Array
```

Returns a new `Uint8Array` with `length` random bytes.

```ts
const key = random.bytes(32)
```

Throws a `RangeError` if `length` is not an integer of `0` or more.

## uuid

```ts
function uuid(): string
```

Returns a [version 4 UUID](https://www.rfc-editor.org/rfc/rfc9562#section-5.4) in lowercase, in the format of `crypto.randomUUID()`.

```ts
const user = { id: random.uuid(), name: 'Alice' }
```

## fork

```ts
function fork(label: string): RandomSource
```

Returns a new random source. Its values depend only on the seed of the parent and the label, not on the values that the parent returned before. Use a fork for each part of a test, so that a new call in one part does not change the values in the other parts:

```ts
import { test } from 'vitest'

test('the cluster elects one leader', async ({ random }) => {
  const network = new SimulatedNetwork(random.fork('network'))
  const faults = new FaultInjector(random.fork('faults'))
  // a new call in `faults` does not change the delays of `network`
  await runCluster({ network, faults })
})
```

Each label can be used one time on a random source. A second fork with the same label would return the same values as the first fork, so Vitest throws an error instead:

```ts
import type { RandomSource } from 'vitest'
import { test } from 'vitest'

function createUser(random: RandomSource) {
  const values = random.fork('user')
  return { id: values.uuid(), age: values.int(18, 99) }
}

test('creates two users', ({ random }) => {
  const alice = createUser(random)
  // Error: random.fork("user") was already called on the random source with the seed ...
  const bob = createUser(random)
})
```

Without the error, `alice` and `bob` would get the same ID and the same age. Such copies are hard to find: the test can still pass, but it checks fewer cases than you expect. In a simulation, 2 parts with the same label get the same numbers, for example the network delays and the times of the faults, so the run explores fewer states.

To make many values of one kind, put a name or an index in the label. To use the same values again, keep the fork and use it again:

```ts
function createUser(random: RandomSource, name: string) {
  const values = random.fork(`user:${name}`)
  return { id: values.uuid(), age: values.int(18, 99) }
}
```

If a library forks a random source, it should put its package name in the label, so that its labels do not conflict with the labels of the test. Vitest uses labels that start with `vitest:`, for example for [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). [`vi.createRandom`](/api/vi#vi-createrandom) has no parent source, so it returns equal values for equal labels on purpose.
