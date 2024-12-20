# TestModule

The `TestModule` class represents a single module in a single project. This class is only available in the main thread. Refer to the ["Runner API"](/advanced/runner#tasks) if you are working with runtime tasks.

The `TestModule` instance always has a `type` property with the value of `module`. You can use it to distinguish between different task types:

```ts
if (task.type === 'module') {
  task // TestModule
}
```

The `TestModule` inherits all methods and properties from the [`TestSuite`](/advanced/api/test-module). This guide will only list methods and properties unique to the `TestModule`

::: warning
We are planning to introduce a new Reporter API that will be using this API by default. For now, the Reporter API uses [runner tasks](/advanced/runner#tasks), but you can still access `TestModule` via `vitest.state.getReportedEntity` method:

```ts
import type { RunnerTestFile, TestModule, Vitest } from 'vitest/node'

class Reporter {
  private vitest!: Vitest

  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onFinished(files: RunnerTestFile[]) {
    for (const file of files) {
      const testModule = this.vitest.getReportedEntity(file) as TestModule
      console.log(testModule) // TestModule
    }
  }
}
```
:::

## moduleId

This is usually an absolute unix file path (even on Windows). It can be a virtual id if the file is not on the disk. This value corresponds to Vite's `ModuleGraph` id.

## diagnostic

```ts
function diagnostic(): ModuleDiagnostic
```

Useful information about the module like duration, memory usage, etc. If the module was not executed yet, all diagnostic values will return `0`.

```ts
interface ModuleDiagnostic {
  /**
   * The time it takes to import and initiate an environment.
   */
  environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  prepareDuration: number
  /**
   * The time it takes to import the test module.
   * This includes importing everything in the module and executing suite callbacks.
   */
  collectDuration: number
  /**
   * The time it takes to import the setup module.
   */
  setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the module.
   */
  duration: number
}
```
