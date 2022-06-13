# Test Runner API

The following types are used in the type signatures:

```ts
type Awaitable<T> = T | PromiseLike<T>
type TestFunction = () => Awaitable<void>
```

When a test function returns a promise, the runner will wait until it is resolved to collect async expectations. If the promise is rejected, the test will fail.

::: tip
In Jest, `TestFunction` can also be of type `(done: DoneCallback) => void`. If this form is used, the test will not be concluded until `done` is called. You can achieve the same using an `async` function, see the [Migration guide Done Callback section](../guide/migration#done-callback).
:::

## test

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it`

  `test` defines a set of related expectations. It receives the test name and a function that holds the expectations to test.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds, and can be configured globally with [testTimeout](/config/#testtimeout)

  ```ts
  import { expect, test } from 'vitest'

  test('should work as expected', () => {
    expect(Math.sqrt(4)).toBe(2)
  })
  ```

### test.skip

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.skip`

  If you want to skip running certain tests, but you don't want to delete the code due to any reason, you can use `test.skip` to avoid running them.

  ```ts
  import { assert, test } from 'vitest'

  test.skip('skipped test', () => {
    // Test skipped, no error
    assert.equal(Math.sqrt(4), 3)
  })
  ```

### test.skipIf

- **Type:** `(condition: any) => Test`
- **Alias:** `it.skipIf`

  In some cases you might run tests multiple times with different environments, and some of the tests might be environment-specific. Instead of wrapping the test code with `if`, you can use `test.skipIf` to skip the test whenever the condition is truthy.

  ```ts
  import { assert, test } from 'vitest'

  const isDev = process.env.NODE_ENV === 'development'

  test.skipIf(isDev)('prod only test', () => {
    // this test only runs in production
  })
  ```

### test.runIf

- **Type:** `(condition: any) => Test`
- **Alias:** `it.runIf`

  Opposite of [test.skipIf](#testskipif).

  ```ts
  import { assert, test } from 'vitest'

  const isDev = process.env.NODE_ENV === 'development'

  test.runIf(isDev)('dev only test', () => {
    // this test only runs in development
  })
  ```

### test.only

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.only`

  Use `test.only` to only run certain tests in a given suite. This is useful when debugging.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds, and can be configured globally with [testTimeout](/config/#testtimeout).

  ```ts
  import { assert, test } from 'vitest'

  test.only('test', () => {
    // Only this test (and others marked with only) are run
    assert.equal(Math.sqrt(4), 2)
  })
  ```

### test.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.concurrent`

  `test.concurrent` marks consecutive tests to be run them in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

  ```ts
  import { describe, test } from 'vitest'

  // The two tests marked with concurrent will be run in parallel
  describe('suite', () => {
    test('serial test', async () => { /* ... */ })
    test.concurrent('concurrent test 1', async () => { /* ... */ })
    test.concurrent('concurrent test 2', async () => { /* ... */ })
  })
  ```

  `test.skip`, `test.only`, and `test.todo` works with concurrent tests. All the following combinations are valid:

  ```ts
  test.concurrent(/* ... */)
  test.skip.concurrent(/* ... */) // or test.concurrent.skip(/* ... */)
  test.only.concurrent(/* ... */) // or test.concurrent.only(/* ... */)
  test.todo.concurrent(/* ... */) // or test.concurrent.todo(/* ... */)
  ```

  When using Snapshots with async concurrent tests, due to the limitation of JavaScript, you need to use the `expect` from the [Test Context](/guide/test-context.md) to ensure the right test is being detected.

  ```ts
  test.concurrent('test 1', async ({ expect }) => {
    expect(foo).toMatchSnapshot()
  })
  test.concurrent('test 2', async ({ expect }) => {
    expect(foo).toMatchSnapshot()
  })
  ```

### test.todo

- **Type:** `(name: string) => void`
- **Alias:** `it.todo`

  Use `test.todo` to stub tests to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

  ```ts
  // An entry will be shown in the report for this test
  test.todo('unimplemented test')
  ```

### test.fails

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.fails`

  Use `test.fails` to indicate that an assertion will fail explicitly.

  ```ts
  import { expect, test } from 'vitest'
  const myAsyncFunc = () => new Promise(resolve => resolve(1))
  test.fails('fail test', async () => {
    await expect(myAsyncFunc()).rejects.toBe(1)
  })
  ```

### test.each
- **Type:** `(cases: ReadonlyArray<T>) => void`
- **Alias:** `it.each`

  Use `test.each` when you need to run the same test with different variables.
  You can inject parameters with [printf formatting](https://nodejs.org/api/util.html#util_util_format_format_args) in the test name in the order of the test function parameters.

  - `%s`: string
  - `%d`: number
  - `%i`: integer
  - `%f`: floating point value
  - `%j`: json
  - `%o`: object
  - `%#`: index of the test case
  - `%%`: single percent sign ('%')

  ```ts
  test.each([
    [1, 1, 2],
    [1, 2, 3],
    [2, 1, 3],
  ])('add(%i, %i) -> %i', (a, b, expected) => {
    expect(a + b).toBe(expected)
  })

  // this will return
  // √ add(1, 1) -> 2
  // √ add(1, 2) -> 3
  // √ add(2, 1) -> 3
  ```

## describe

When you use `test` in the top level of file, they are collected as part of the implicit suite for it. Using `describe` you can define a new suite in the current context, as a set of related tests and other nested suites. A suite lets you organize your tests so reports are more clear.

  ```ts
  import { describe, expect, test } from 'vitest'

  const person = {
    isActive: true,
    age: 32,
  }

  describe('person', () => {
    test('person is defined', () => {
      expect(person).toBeDefined()
    })

    test('is active', () => {
      expect(person.isActive).toBeTruthy()
    })

    test('age limit', () => {
      expect(person.age).toBeLessThanOrEqual(32)
    })
  })
  ```

  You can also nest describe blocks if you have a hierarchy of tests:

  ```ts
  import { describe, expect, test } from 'vitest'

  const numberToCurrency = (value) => {
    if (typeof value !== 'number')
      throw new Error('Value must be a number')

    return value.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  describe('numberToCurrency', () => {
    describe('given an invalid number', () => {
      test('composed of non-numbers to throw error', () => {
        expect(() => numberToCurrency('abc')).toThrow()
      })
    })

    describe('given a valid number', () => {
      test('returns the correct currency format', () => {
        expect(numberToCurrency(10000)).toBe('10,000.00')
      })
    })
  })
  ```

### describe.skip

- **Type:** `(name: string, fn: TestFunction) => void`

  Use `describe.skip` in a suite to avoid running a particular describe block.

  ```ts
  import { assert, describe, test } from 'vitest'

  describe.skip('skipped suite', () => {
    test('sqrt', () => {
      // Suite skipped, no error
      assert.equal(Math.sqrt(4), 3)
    })
  })
  ```

### describe.only

- **Type:** `(name: string, fn: TestFunction) => void`

  Use `describe.only` to only run certain suites

  ```ts
  // Only this suite (and others marked with only) are run
  describe.only('suite', () => {
    test('sqrt', () => {
      assert.equal(Math.sqrt(4), 3)
    })
  })

  describe('other suite', () => {
    // ... will be skipped
  })
  ```

### describe.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  `describe.concurrent` in a suite marks every tests as concurrent

  ```ts
  // All tests within this suite will be run in parallel
  describe.concurrent('suite', () => {
    test('concurrent test 1', async () => { /* ... */ })
    test('concurrent test 2', async () => { /* ... */ })
    test.concurrent('concurrent test 3', async () => { /* ... */ })
  })
  ```

  `.skip`, `.only`, and `.todo` works with concurrent suites. All the following combinations are valid:

  ```ts
  describe.concurrent(/* ... */)
  describe.skip.concurrent(/* ... */) // or describe.concurrent.skip(/* ... */)
  describe.only.concurrent(/* ... */) // or describe.concurrent.only(/* ... */)
  describe.todo.concurrent(/* ... */) // or describe.concurrent.todo(/* ... */)
  ```

### describe.todo

- **Type:** `(name: string) => void`

  Use `describe.todo` to stub suites to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

  ```ts
  // An entry will be shown in the report for this suite
  describe.todo('unimplemented suite')
  ```
### describe.each

- **Type:** `(cases: ReadonlyArray<T>): (name: string, fn: (...args: T[]) => void) => void`

  Use `describe.each` if you have more than one test that depends on the same data.

  ```ts
  describe.each([
    { a: 1, b: 1, expected: 2 },
    { a: 1, b: 2, expected: 3 },
    { a: 2, b: 1, expected: 3 },
  ])('describe object add($a, $b)', ({ a, b, expected }) => {
    test(`returns ${expected}`, () => {
      expect(a + b).toBe(expected)
    })

    test(`returned value not be greater than ${expected}`, () => {
      expect(a + b).not.toBeGreaterThan(expected)
    })

    test(`returned value not be less than ${expected}`, () => {
      expect(a + b).not.toBeLessThan(expected)
    })
  })
  ```


## Setup and Teardown

These functions allow you to hook into the life cycle of tests to avoid repeating setup and teardown code. They apply to the current context: the file if they are used at the top-level or the current suite if they are inside a `describe` block.

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
    await addUser({ name: 'John' })
  })
  ```

  Here, the `beforeEach` ensures that user is added for each test.

  Since Vitest v0.10.0, `beforeEach` also accepts an optional cleanup function (equivalent to `afterEach`).

  ```ts
  import { beforeEach } from 'vitest'

  beforeEach(async () => {
    // called once before each test run
    await prepareSomething()

    // clean up function, called once after each test run
    return async () => {
      await resetSomething()
    }
  })
  ```

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

  Here the `beforeAll` ensures that the mock data is set up before tests run.

  Since Vitest v0.10.0, `beforeAll` also accepts an optional cleanup function (equivalent to `afterAll`).

  ```ts
  import { beforeAll } from 'vitest'

  beforeAll(async () => {
    // called once before all tests run
    await startMocking()
  
    // clean up function, called once after all tests run
    return async () => {
      await stopMocking()
    }
  })
  ```

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
