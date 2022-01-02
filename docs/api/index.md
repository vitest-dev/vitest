# API Reference

The following types are used in the type signatures below

```ts
type DoneCallback = (error?: any) => void
type Awaitable<T> = T | PromiseLike<T>
type TestFunction = () => Awaitable<void> | (done: DoneCallback) => void
```

When a test function returns a promise, the runner will await until it is resolved to collect async expectations. If the promise is rejected, the test will fail.

For compatibility with Jest, `TestFunction` can also be of type `(done: DoneCallback) => void`. If this form is used, the test will not be concluded until `done` is called (with zero arguments or a falsy value for a successful test, and with a truthy error value as argument to trigger a fail). We don't recommend to use this form, as you can achieve the same using an `async` function.

## test

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it`

  `test` defines a set of related expectations. Default timeout for tests is 5 seconds, and can be configured globally with [testTimeout](../config/#testtimeout).

  ```ts
  import { test, expect } from 'vitest'

  test('should work as expected', () => {
    expect(Math.sqrt(4)).toBe(2);
  })
  ```

### test.skip

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  Use `.skip` to avoid running certain tests

  ```ts
  test.skip("skipped test", () => {
    // Test skipped, no error
    assert.equal(Math.sqrt(4), 3);
  });
  ```

### test.only

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  Use `.only` to only run certain tests in a given suite

  ```ts
  test.only("test", () => {
    // Only this test (and others marked with only) are run
    assert.equal(Math.sqrt(4), 2);
  });
  ```

### test.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  `.concurrent` marks consecutive tests to be run them in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

  ```ts
  // The two tests marked with concurrent will be run in parallel
  describe("suite", () => {
    test("serial test", async() => { /* ... */ });
    test.concurrent("concurrent test 1", async() => { /* ... */ });
    test.concurrent("concurrent test 2", async() => { /* ... */ });
  });
  ```

  `.skip`, `.only`, and `.todo` works with concurrent tests. All the following combinations are valid:

  ```ts
  test.concurrent(...)
  test.skip.concurrent(...), test.concurrent.skip(...)
  test.only.concurrent(...), test.concurrent.only(...)
  test.todo.concurrent(...), test.concurrent.todo(...)
  ```

### test.todo

- **Type:** `(name: string) => void`

  Use `.todo` to stub tests to be implemented later

  ```ts
  // An entry will be shown in the report for this test
  test.todo("unimplemented test");
  ```

## describe

When you use `test` in the top level of file, they are collected as part of the implicit suite for it. Using `describe` you can define a new suite in the current context, as a set of related tests and other nested suites. A suite lets you organize your tests so reports are more clear.

### describe.skip

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  Use `.skip` in a suite to avoid running it

  ```ts
  describe.skip("skipped suite", () => {
    test("sqrt", () => {
      // Suite skipped, no error
      assert.equal(Math.sqrt(4), 3);
    });
  });
  ```

### describe.only

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  Use `.only` to only run certain suites

  ```ts
  // Only this suite (and others marked with only) are run
  describe.only("suite", () => {
    test("sqrt", () => {
      assert.equal(Math.sqrt(4), 3);
    });
  });
  ```

### describe.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  `.concurrent` in a suite marks every tests as concurrent

  ```ts
  // All tests within this suite will be run in parallel
  describe.concurrent("suite", () => {
    test("concurrent test 1", async() => { /* ... */ });
    test("concurrent test 2", async() => { /* ... */ });
    test.concurrent("concurrent test 3", async() => { /* ... */ });
  });
  ```

  `.skip`, `.only`, and `.todo` works with concurrent suites. All the following combinations are valid:

  ```ts
  describe.concurrent(...)
  describe.skip.concurrent(...), describe.concurrent.skip(...)
  describe.only.concurrent(...), describe.concurrent.only(...)
  describe.todo.concurrent(...), describe.concurrent.todo(...)
  ```

### describe.todo

- **Type:** `(name: string) => void`

  Use `.todo` to stub suites to be implemented later

  ```ts
  // An entry will be shown in the report for this suite
  describe.todo("unimplemented suite");
  ```

## Setup and Teardown

These functions allows you to hook into the life cycle of tests to avoid repeating setup and teardown code. They apply to the current context: the file if they are used at the top-level or the current suite if they are inside a `describe` block.

### beforeEach

- **Type:** `beforeEach(fn: () => Awaitable<void>, timeout?: number)`

  Register a callback to be called before each of the tests in the current context runs.
  If the function returns a promise, Vitest waits until the promise resolve before running the test.

  Optionally, you can pass a timeout (in milliseconds) defining how long to wait before terminating. The default is 5 seconds.

  ```ts
  import { beforeEach } from 'vitest'

  beforeEach(async () => {
    // Clear mocks and add some testing data after before each test run
    await stopMocking()
    await addUser({ name: 'John'})
  })
  ```

  Here, the `beforeEach` ensures that user is added for each test.

### afterEach

- **Type:** `afterEach(fn: () => Awaitable<void>, timeout?: number)`

  Register a callback to be called after each one of the tests in the current context completes. 
  If the function returns a promise, Vitest waits until the promise resolve before continuing.

  Optionally, you can a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds.

  ```ts
  import { afterEach } from 'vitest'

  afterEach(async () => {
    await clearTestingData() // clear testing data after each test run
  })
  ```
  Here, the `afterEach` ensures that testing data is cleared after each test runs.

### beforeAll

- **Type:** `beforeAll(fn: () => Awaitable<void>, timeout?: number)`

  Register a callback to be called once before starting to run all tests in the current context. 
  If the function returns a promise, Vitest waits until the promise resolve before running tests.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds.

  ```ts
  import { beforeAll } from 'vitest'

  beforeAll(async () => {
    await startMocking() // called once before all tests run
  })
  ```

  Here the `beforeAll` ensures that the mock data is set up before tests run

### afterAll

- **Type:** `afterAll(fn: () => Awaitable<void>, timeout?: number)`

  Register a callback to be called once after all tests have run in the current context.
  If the function returns a promise, Vitest waits until the promise resolve before continuing.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds.

  ```ts
  import { afterAll } from 'vitest'

  afterAll(async () => {
    await stopMocking() // this method is called after all tests run
  })
  ```

  Here the `afterAll` ensures that `stopMocking` method is called after all tests run.


