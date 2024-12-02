# TestSuite

```ts
declare class TestSuite {
  readonly type = 'suite'
  /**
   * The project associated with the test.
   */
  readonly project: TestProject
  /**
   * Direct reference to the test module where the suite is defined.
   */
  readonly module: TestModule
  /**
   * Name of the suite.
   */
  readonly name: string
  /**
   * Full name of the suite including all parent suites separated with `>`.
   */
  readonly fullName: string
  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the project name, module id and test position.
   */
  readonly id: string
  /**
   * Location in the module where the suite was defined.
   * Locations are collected only if `includeTaskLocation` is enabled in the config.
   */
  readonly location: { line: number; column: number } | undefined
  /**
   * Collection of suites and tests that are part of this suite.
   */
  readonly children: TaskCollection
  /**
   * Options that the suite was initiated with.
   */
  readonly options: TaskOptions
  /**
   * Errors that happened outside of the test run during collection, like syntax errors.
   */
  public errors(): TestError[]
}
```
