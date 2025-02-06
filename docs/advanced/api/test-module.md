# TestModule

The `TestModule` class represents a single module in a single project. This class is only available in the main thread. Refer to the ["Runner API"](/advanced/runner#tasks) if you are working with runtime tasks.

The `TestModule` instance always has a `type` property with the value of `module`. You can use it to distinguish between different task types:

```ts
if (task.type === 'module') {
  task // TestModule
}
```

::: warning Extending Suite Methods
The `TestModule` class inherits all methods and properties from the [`TestSuite`](/advanced/api/test-suite). This guide will only list methods and properties unique to the `TestModule`.
:::

## moduleId

This is usually an absolute unix file path (even on Windows). It can be a virtual id if the file is not on the disk. This value corresponds to Vite's `ModuleGraph` id.

```ts
'C:/Users/Documents/project/example.test.ts' // ✅
'/Users/mac/project/example.test.ts' // ✅
'C:\\Users\\Documents\\project\\example.test.ts' // ❌
```

## state

```ts
function state(): TestModuleState
```

Works the same way as [`testSuite.state()`](/advanced/api/test-suite#state), but can also return `queued` if module wasn't executed yet.

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
  readonly environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  readonly prepareDuration: number
  /**
   * The time it takes to import the test module.
   * This includes importing everything in the module and executing suite callbacks.
   */
  readonly collectDuration: number
  /**
   * The time it takes to import the setup module.
   */
  readonly setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the module.
   */
  readonly duration: number
}
```
