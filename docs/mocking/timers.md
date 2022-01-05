# Timers

To make your tests faster, you can mock calls to `setTimeout` and `setInterval`. All methods to manipulate timers are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

##  useFakeTimers

**Type:** `() => Vitest`

To enable mocking timers, you need to call this method. It will wrap all further calls to timers, until [`vi.useRealTimers()`](#userealtimers) is called.

## useRealTimers

**Type:** `() => Vitest`

When timers are run out, you may call this method to return mocked timers to its original implementations. All timers that were run before will not be restored.

## runOnlyPendingTimers

**Type:** `() => Vitest`

This method will call every timer that was initiated after `vi.useFakeTimers()` call. It will not fire any timer that was initiated during its call. For example this will only log `1`:

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.runOnlyPendingTimers()
```

## runAllTimers

**Type:** `() => Vitest`

This method will invoke every initiated timer until the timers queue is empty. It means that every timer called during `runAllTimers` will be fired. If you have an infinite interval,
it will throw after 10 000 tries. For example this will log `1, 2, 3`:

```ts
let i = 0
setTimeout(() => console.log(++i))
let interval = setInterval(() => {
    console.log(++i)
    if (i === 2) {
        clearInterval(interval)
    }
}, 50)

vi.runAllTimers()
```

## advanceTimersByTime

**Type:** `(ms: number) => Vitest`

Works just like `runAllTimers`, but will end after passed milliseconds. For example this will log `1, 2, 3` and will not throw:

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.advanceTimersByTime(150)
```

## advanceTimersToNextTimer

**Type:** `() => Vitest`

Will call next available timer. Useful to make assertions between each timer call. You can chain call it to manage timers by yourself.

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.advanceTimersToNextTimer() // log 1
  .advanceTimersToNextTimer() // log 2
  .advanceTimersToNextTimer() // log 3
```
