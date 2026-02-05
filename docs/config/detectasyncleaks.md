---
title: detectAsyncLeaks | Config
outline: deep
---

# detectAsyncLeaks

- **Type:** `boolean`
- **CLI:** `--detectAsyncLeaks`, `--detect-async-leaks`
- **Default:** `false`

::: warning
Enabling this option will make your tests run much slower. Use only when debugging or developing tests.
:::

Detect asynchronous resources leaking from the test file.
Uses [`node:async_hooks`](https://nodejs.org/api/async_hooks.html) to track creation of async resources. If a resource is not cleaned up, it will be logged after tests have finished.

For example if your code has `setTimeout` calls that execute the callback after tests have finished, you will see following error:

```sh
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

Timeout leaking in test/checkout-screen.test.tsx
 26|
 27|   useEffect(() => {
 28|     setTimeout(() => setWindowWidth(window.innerWidth), 150)
   |     ^
 29|   })
 30|
```

To fix this, you'll need to make sure your code cleans the timeout properly:

```js
useEffect(() => {
  setTimeout(() => setWindowWidth(window.innerWidth), 150) // [!code --]
  const timeout = setTimeout(() => setWindowWidth(window.innerWidth), 150) // [!code ++]

  return function cleanup() { // [!code ++]
    clearTimeout(timeout) // [!code ++]
  } // [!code ++]
})
```
