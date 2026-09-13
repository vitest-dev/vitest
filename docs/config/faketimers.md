---
title: fakeTimers | Config
outline: deep
---

# fakeTimers

- **Type:** `FakeTimerConfig`

Options that configure fake timers when using [`vi.useFakeTimers()`](/api/vi#vi-usefaketimers). Vitest's fake timer implementation is based on [`@sinon/fake-timers`](https://npmx.dev/package/@sinonjs/fake-timers), with additional options and behavior tailored to Vitest.

## fakeTimers.now

- **Type:** `number | Date`
- **Default:** `Date.now()`

Installs fake timers with the specified Unix epoch.

## fakeTimers.toFake

- **Type:** `('setTimeout' | 'clearTimeout' | 'setImmediate' | 'clearImmediate' | 'setInterval' | 'clearInterval' | 'Date' | 'nextTick' | 'hrtime' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'requestIdleCallback' | 'cancelIdleCallback' | 'performance' | 'queueMicrotask' | 'Intl' | 'Temporal')[]`
- **Default:** everything available globally except `nextTick` and `queueMicrotask`

An array with names of global methods and APIs to fake. For example, to only mock `setTimeout()` and `nextTick()`, specify this property as `['setTimeout', 'nextTick']`.

`Temporal` is only faked when it is available on the global object: natively (Node.js >= 26 by default, behind `--harmony-temporal` on older versions, and supporting browsers) or through a globally installed polyfill such as `import 'temporal-polyfill/global'`.

Mocking `nextTick` is not supported when running Vitest inside `node:child_process` by using `--pool=forks`. NodeJS uses `process.nextTick` internally in `node:child_process` and hangs when it is mocked. Mocking `nextTick` is supported when running Vitest with `--pool=threads`.

## fakeTimers.toNotFake

- **Type:** `('setTimeout' | 'clearTimeout' | 'setImmediate' | 'clearImmediate' | 'setInterval' | 'clearInterval' | 'Date' | 'nextTick' | 'hrtime' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'requestIdleCallback' | 'cancelIdleCallback' | 'performance' | 'queueMicrotask' | 'Intl' | 'Temporal')[]`
- **Default:** `[]`

An array with names of global methods and APIs to keep native. All other available timers will be mocked. For example, to keep `setInterval()` native and mock all other timers, specify this property as `['setInterval']`.

Mocking `nextTick` is not supported when running Vitest inside `node:child_process` by using `--pool=forks`. When running with `--pool=forks`, Vitest automatically adds `nextTick` to the `toNotFake` array.

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

## fakeTimers.fakeNodeBuiltins <Version>5.0.0</Version> {#faketimers-fakenodebuiltins}

- **Type:** `boolean`
- **Default:** `false`

Mock timer APIs imported from `node:timers` and `node:timers/promises`.
