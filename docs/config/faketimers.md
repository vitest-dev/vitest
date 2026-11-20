---
title: fakeTimers | Config
outline: deep
---

# fakeTimers

- **Type:** `FakeTimerConfig`

Options that configure fake timers when using [`vi.useFakeTimers()`](/api/vi#vi-usefaketimers). Vitest's fake timer implementation is based on [`@sinon/fake-timers`](https://npmx.dev/package/@sinonjs/fake-timers), with additional options and behavior tailored to Vitest.

## fakeTimers.now

- **Type:** `number | Date | { min: number | Date, max: number | Date }`
- **Default:** `Date.now()`, or a time from 2000 to 2003 from the [seed](/config/seed) with a random [`order`](#faketimers-order) or a [`jitter`](#faketimers-jitter)

Installs fake timers with the specified Unix epoch.

With a random `order` or a `jitter`, the fake clock starts at a time from the seed of the current test. Thus the [replay command](/guide/seeded-tests#replay-a-seed) of a failure starts at the same time on any day, and each repeat starts at another time from 2000-01-01 to 2003-12-31. The first and the last day of a month, midnight, and the last millisecond of a day are more likely than other times, because they are [edge cases](/api/random#int). The time is the same on every machine, but local dates also depend on the [time zone](/guide/common-errors#time-zone-does-not-change-in-worker-threads). If a test fails, the [search](/guide/seeded-tests#shrink-a-failure) moves the start time toward the start of the range, and `Values` shows the time, for example `vi.useFakeTimers() starts at 2000-01-30T00:00:00.000Z`.

To take the start time from the seed in other years, set a range. The range includes `min` and `max`, and it also works without `order` and `jitter`:

```ts
vi.useFakeTimers({
  now: { min: new Date('2024-01-01T00:00:00Z'), max: new Date('2026-12-31T23:59:59.999Z') },
})
```

Set a fixed `now` or a range if a test compares the time with the dates of its test data, for example a check that an order from 2025 is in the past. A time that [`vi.setSystemTime()`](/api/vi#vi-setsystemtime) set before `vi.useFakeTimers()` also wins over the seed, and a second call of `vi.useFakeTimers()` keeps the current fake time.

## fakeTimers.toFake

- **Type:** `('setTimeout' | 'clearTimeout' | 'setImmediate' | 'clearImmediate' | 'setInterval' | 'clearInterval' | 'Date' | 'nextTick' | 'hrtime' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'requestIdleCallback' | 'cancelIdleCallback' | 'performance' | 'queueMicrotask' | 'Intl' | 'Temporal')[]`
- **Default:** everything available globally except `nextTick` and `queueMicrotask`

An array with names of global methods and APIs to fake. For example, to only mock `setTimeout()` and `nextTick()`, specify this property as `['setTimeout', 'nextTick']`.

`Temporal` is only faked when it is available on the global object: natively (Node.js >= 26 by default, behind `--harmony-temporal` on older versions, and supporting browsers) or through a globally installed polyfill such as `import 'temporal-polyfill/global'`.

Mocking `nextTick` is not supported when running Vitest inside `node:child_process` by using `--pool=forks`. NodeJS uses `process.nextTick` internally in `node:child_process` and hangs when it is mocked. Mocking `nextTick` is supported when running Vitest with `--pool=threads`.

## fakeTimers.toNotFake

- **Type:** `('setTimeout' | 'clearTimeout' | 'setImmediate' | 'clearImmediate' | 'setInterval' | 'clearInterval' | 'Date' | 'nextTick' | 'hrtime' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'requestIdleCallback' | 'cancelIdleCallback' | 'performance' | 'queueMicrotask' | 'Intl' | 'Temporal')[]`
- **Default:** `[]`

An array of global methods and APIs to exclude from fake timers. Vitest always excludes `nextTick` and `queueMicrotask` when this option is used. To fake either API, use `toFake` instead.

::: warning
Using both `toFake` and `toNotFake` together is not supported.
:::

## fakeTimers.loopLimit

- **Type:** `number`
- **Default:** `10_000`

The maximum number of timers that will be run when calling [`vi.runAllTimers()`](/api/vi#vi-runalltimers).

## fakeTimers.shouldAdvanceTime

- **Type:** `boolean`
- **Default:** `false`

Tells @sinonjs/fake-timers to increment mocked time automatically based on the real system time shift (e.g. the mocked time will be incremented by 20ms for every 20ms change in the real system time).

## fakeTimers.advanceTimeDelta

- **Type:** `number`
- **Default:** `20`

Relevant only when using with `shouldAdvanceTime: true`. increment mocked time by advanceTimeDelta ms every advanceTimeDelta ms change in the real system time.

## fakeTimers.shouldClearNativeTimers

- **Type:** `boolean`
- **Default:** `true`

Tells fake timers to clear "native" (i.e. not fake) timers by delegating to their respective handlers. When disabled, it can lead to potentially unexpected behavior if timers existed prior to starting fake timers session.

## fakeTimers.fakeNodeBuiltins <Version>5.1.0</Version> {#faketimers-fakenodebuiltins}

- **Type:** `boolean`
- **Default:** `false`

Mock timer APIs imported from `node:timers` and `node:timers/promises`.

## fakeTimers.order <Experimental /> <Version type="experimental">5.2.0</Version> {#faketimers-order}

- **Type:** `'fifo' | 'random'`
- **Default:** `'fifo'`

The order of timeouts, intervals and animation frames that are due at the same time. By default, they run in the order of creation. With `'random'`, the order comes from the [seed](/config/seed) of the current test. Thus [`repeats`](/api/test#repeats) can find bugs that depend on the order of timers, and the [replay command](/guide/seeded-tests#replay-a-seed) repeats the order.

```ts
import { expect, test, vi } from 'vitest'

test('an invalidation wins over a slow response', { repeats: 99 }, () => {
  vi.useFakeTimers({ order: 'random' })
  const cache = createCache()
  cache.refresh() // the response arrives after 10 ms
  vi.advanceTimersByTime(5)
  cache.invalidate() // runs after 5 ms, at the same time as the response
  vi.advanceTimersByTime(5)
  expect(cache.get()).toBe('fresh')
})
```

Vitest keeps the order that Node.js and browsers guarantee:

- A timer always runs after the timers that were created before it with an equal or a smaller delay. Thus only timers that were created at different times can change places.
- Immediates, animation frames and idle callbacks run in the order of creation.
- All callbacks of an animation frame run together, so no timeout runs between them. With `'random'`, the frame runs before, between or after the timeouts that are due at the same time.

The order does not change the values of [`vi.useFakeRandom`](/api/vi#vi-usefakerandom). Without [`now`](#faketimers-now), the fake clock starts at a time from the seed. With a random order, `vi.useFakeTimers()`, `setTimeout` and the other fake timer functions throw an error in [concurrent](/api/test#test-concurrent) tests, because the order would depend on the order of the calls.

## fakeTimers.jitter <Experimental /> <Version type="experimental">5.2.0</Version> {#faketimers-jitter}

- **Type:** `number`
- **Default:** `0`

The maximum number of milliseconds that a timer can be late. Each timer gets a delay from 0 to `jitter` milliseconds from the [seed](/config/seed) of the current test. A delay of 0, 1 or `jitter` milliseconds is more likely than the other delays, because these are [edge cases](/api/random#int). Real timers are late when the event loop is busy, so code that works only with exact timers fails for some seeds.

```ts
vi.useFakeTimers({ order: 'random', jitter: 10 })
```

Vitest keeps the order that Node.js and browsers guarantee:

- A timer never runs before a timer that was created earlier with an equal or a smaller delay.
- An interval counts its next call from the late call, so the delays add up.
- Immediates and animation frames that wait together are late together. An animation frame is late by whole frames of 16 ms, so with a `jitter` below 16 frames are never late. [`vi.advanceTimersToNextFrame()`](/api/vi#vi-advancetimerstonextframe) advances to the next frame, also when it is late.
- Idle callbacks without a `timeout` are never late, because they run after all other timers.

Without [`now`](#faketimers-now), the fake clock starts at a time from the seed. With a jitter, `vi.useFakeTimers()`, `setTimeout` and the other fake timer functions throw an error in [concurrent](/api/test#test-concurrent) tests.
