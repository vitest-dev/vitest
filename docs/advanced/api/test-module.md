# TestModule

```ts
declare class TestModule extends TestSuite {
  readonly type = 'module'
  /**
   * Collection of suites and tests that are part of this module.
   */
  readonly children: TestCollection
  /**
   * This is usually an absolute Unix file path.
   * It can be a virtual id if the file is not on the disk.
   * This value corresponds to Vite's `ModuleGraph` id.
   */
  readonly moduleId: string
  /**
   * Useful information about the module like duration, memory usage, etc.
   * If the module was not executed yet, all diagnostic values will return `0`.
   */
  diagnostic(): ModuleDiagnostic
}

export interface ModuleDiagnostic {
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
