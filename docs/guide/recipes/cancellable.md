---
title: Cancellable Test Resources | Recipes
---

# Cancellable Test Resources

A test can hold onto resources that don't stop when the test stops. A `fetch`, a child process, a file stream, a polling loop: none of those notice when Vitest has cancelled the test, and the worker has to sit there waiting for them to finish on their own. Vitest cancels a test when it exceeds its `timeout`, when another test fails under `--bail`, or when someone presses <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal.

The test context provides a [`signal`](/guide/test-context#signal) <Version>3.2.0</Version> that fires in all of those cases. Pass it to anything that accepts an `AbortSignal` and the resource is released when Vitest cancels.

## Pattern

```ts
import { test } from 'vitest'

test('stop request when test times out', async ({ signal }) => {
  await fetch('/heavy-resource', { signal })
}, 2000)
```

If the request hasn't completed within 2 seconds, `fetch` rejects with `AbortError` instead of the test hanging until the operation finishes.

## Other Web APIs that accept an `AbortSignal`

- [`fetch`](https://developer.mozilla.org/docs/Web/API/fetch)
- [`addEventListener`](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener), where passing `{ signal }` removes the listener on abort
- [`ReadableStream.pipeTo`](https://developer.mozilla.org/docs/Web/API/ReadableStream/pipeTo)
- Node.js APIs like [`fs.readFile`](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options), [`child_process.spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options), and [`setTimeout` or `setInterval`](https://nodejs.org/api/timers.html), all of which accept `{ signal }`
- Any custom code that calls `signal.throwIfAborted()` or listens for `'abort'`

## Forwarding the signal

Wire the test's signal into your own helpers so cancellation propagates all the way down:

```ts
async function pollUntilReady(url: string, signal: AbortSignal) {
  while (!signal.aborted) {
    const res = await fetch(url, { signal })
    if (res.ok) {
      return
    }
    await new Promise(r => setTimeout(r, 200))
  }
  signal.throwIfAborted()
}

test('worker becomes ready', async ({ signal }) => {
  await pollUntilReady('http://localhost:4000/health', signal)
}, 5000)
```

## See also

- [`signal` in Test Context](/guide/test-context#signal)
- [`bail`](/config/bail)
- [`testTimeout`](/config/testtimeout)
