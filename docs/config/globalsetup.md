---
title: globalSetup | Config
outline: deep
---

# globalSetup

- **Type:** `string | string[]`

Path to global setup files relative to project [root](/config/root).

A global setup file can either export named functions `setup` and `teardown` or a `default` function that returns a teardown function:

::: code-group
```js [exports]
export function setup(project) {
  console.log('setup')
}

export function teardown() {
  console.log('teardown')
}
```
```js [default]
export default function setup(project) {
  console.log('setup')

  return function teardown() {
    console.log('teardown')
  }
}
```
:::

Note that the `setup` method and a `default` function receive a [test project](/api/advanced/test-project) as the first argument. The global setup is called before the test workers are created and only if there is at least one test queued, and teardown is called after all test files have finished running. In [watch mode](/config/watch), the teardown is called before the process is exited instead. If you need to reconfigure your setup before the test rerun, you can use [`onTestsRerun`](#handling-test-reruns) hook instead.

Multiple global setup files are possible. `setup` and `teardown` are executed sequentially with teardown in reverse order.

::: danger
Beware that the global setup is running in a different global scope before test workers are even created, so your tests don't have access to global variables defined here. However, you can pass down serializable data to tests via [`provide`](/config/provide) method and read them in your tests via `inject` imported from `vitest`:

:::code-group
```ts [example.test.ts]
import { inject } from 'vitest'

inject('wsPort') === 3000
```
```ts [globalSetup.ts]
import type { TestProject } from 'vitest/node'

export default function setup(project: TestProject) {
  project.provide('wsPort', 3000)
}

declare module 'vitest' {
  export interface ProvidedContext {
    wsPort: number
  }
}
```

If you need to execute code in the same process as tests, use [`setupFiles`](/config/setupfiles) instead, but note that it runs before every test file.
:::

### Handling Test Reruns

You can define a custom callback function to be called when Vitest reruns tests. The test runner will wait for it to complete before executing tests. Note that you cannot destruct the `project` like `{ onTestsRerun }` because it relies on the context.

```ts [globalSetup.ts]
import type { TestProject } from 'vitest/node'

export default function setup(project: TestProject) {
  project.onTestsRerun(async () => {
    await restartDb()
  })
}
```
