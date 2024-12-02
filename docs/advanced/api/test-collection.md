# TestCollection

`TestCollection` represents a collection of suites and tests. It also provides useful methods to iterate over itself.

```ts
declare class TestCollection {
  /**
   * Returns the test or suite at a specific index in the array.
   */
  at(index: number): TestCase | TestSuite | undefined
  /**
   * The number of tests and suites in the collection.
   */
  size: number
  /**
   * Returns the collection in array form for easier manipulation.
   */
  array(): (TestCase | TestSuite)[]
  /**
   * Filters all suites that are part of this collection and its children.
   */
  allSuites(): IterableIterator<TestSuite>
  /**
   * Filters all tests that are part of this collection and its children.
   */
  allTests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase>
  /**
   * Filters only the tests that are part of this collection.
   */
  tests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase>
  /**
   * Filters only the suites that are part of this collection.
   */
  suites(): IterableIterator<TestSuite>;
  [Symbol.iterator](): IterableIterator<TestSuite | TestCase>
}
```

For example, you can iterate over all tests inside a module by calling `testModule.children.allTests()`:

```ts
function onFileCollected(testModule: TestModule): void {
  console.log('collecting tests in', testModule.moduleId)

  // iterate over all tests and suites in the module
  for (const task of testModule.children.allTests()) {
    console.log('collected', task.type, task.fullName)
  }
}
```
