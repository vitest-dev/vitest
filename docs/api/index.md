---
outline: deep
---

# API Reference

The following types are used in the type signatures below

```ts
type Awaitable<T> = T | PromiseLike<T>
type TestFunction = () => Awaitable<void>

interface TestOptions {
  timeout?: number
  retry?: number
}
```

When a test function returns a promise, the runner will wait until it is resolved to collect async expectations. If the promise is rejected, the test will fail.

::: tip
In Jest, `TestFunction` can also be of type `(done: DoneCallback) => void`. If this form is used, the test will not be concluded until `done` is called. You can achieve the same using an `async` function, see the [Migration guide Done Callback section](../guide/migration#done-callback).
:::

## test

- **Type:** `(name: string, fn: TestFunction, timeout?: number | TestOptions) => void`
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

- **Type:** `(name: string, fn: TestFunction, timeout?: number | TestOptions) => void`
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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

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

  Sometimes it is very useful to run `only` tests in a certain file, ignoring all other tests from the whole test suite, which pollute the output.

  In order to do that run `vitest` with specific file containing the tests in question.
  ```
  # vitest interesting.test.ts
  ```

### test.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.concurrent`

  `test.concurrent` marks consecutive tests to be run in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

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
  // ✓ add(1, 1) -> 2
  // ✓ add(1, 2) -> 3
  // ✓ add(2, 1) -> 3
  ```

  You can also access object properties with `$` prefix, if you are using objects as arguments:

    ```ts
    test.each([
      { a: 1, b: 1, expected: 2 },
      { a: 1, b: 2, expected: 3 },
      { a: 2, b: 1, expected: 3 },
    ])('add($a, $b) -> $expected', ({ a, b, expected }) => {
      expect(a + b).toBe(expected)
    })

  // this will return
  // ✓ add(1, 1) -> 2
  // ✓ add(1, 2) -> 3
  // ✓ add(2, 1) -> 3
  ```

  If you want to have access to `TestContext`, use `describe.each` with a single test.

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

## bench

- **Type:** `(name: string, fn: BenchFunction, options?: BenchOptions) => void`

`bench` defines a benchmark. In Vitest terms benchmark is a function that defines a series of operations. Vitest runs this function multiple times to display different performance results.

Vitest uses [`tinybench`](https://github.com/tinylibs/tinybench) library under the hood, inheriting all its options that can be used as a third argument.

  ```ts
  import { bench } from 'vitest'

  bench('normal sorting', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  }, { time: 1000 })
  ```

  ```ts
  export interface Options {
    /**
     * time needed for running a benchmark task (milliseconds)
     * @default 500
     */
    time?: number

    /**
     * number of times that a task should run if even the time option is finished
     * @default 10
     */
    iterations?: number

    /**
     * function to get the current timestamp in milliseconds
     */
    now?: () => number

    /**
     * An AbortSignal for aborting the benchmark
     */
    signal?: AbortSignal

    /**
     * warmup time (milliseconds)
     * @default 100ms
     */
    warmupTime?: number

    /**
     * warmup iterations
     * @default 5
     */
    warmupIterations?: number

    /**
     * setup function to run before each benchmark task (cycle)
     */
    setup?: Hook

    /**
     * teardown function to run after each benchmark task (cycle)
     */
    teardown?: Hook
  }
  ```

### bench.skip

- **Type:** `(name: string, fn: BenchFunction, options?: BenchOptions) => void`

You can use `bench.skip` syntax to skip running certain benchmarks.

  ```ts
  import { bench } from 'vitest'

  bench.skip('normal sorting', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  })
  ```

### bench.only

- **Type:** `(name: string, fn: BenchFunction, options?: BenchOptions) => void`

Use `bench.only` to only run certain benchmarks in a given suite. This is useful when debugging.

  ```ts
  import { bench } from 'vitest'

  bench.only('normal sorting', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  })
  ```

### bench.todo

- **Type:** `(name: string) => void`

Use `bench.todo` to stub benchmarks to be implemented later.

  ```ts
  import { bench } from 'vitest'

  bench.todo('unimplemented test')
  ```

## describe

When you use `test` or `bench` in the top level of file, they are collected as part of the implicit suite for it. Using `describe` you can define a new suite in the current context, as a set of related tests or benchmarks and other nested suites. A suite lets you organize your tests and benchmarks so reports are more clear.

  ```ts
  // basic.spec.ts
  // organizing tests

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

  ```ts
  // basic.bench.ts
  // organizing benchmarks

  import { bench, describe } from 'vitest'

  describe('sort', () => {
    bench('normal', () => {
      const x = [1, 5, 4, 2, 3]
      x.sort((a, b) => {
        return a - b
      })
    })

    bench('reverse', () => {
      const x = [1, 5, 4, 2, 3]
      x.reverse().sort((a, b) => {
        return a - b
      })
    })
  })
  ```

  You can also nest describe blocks if you have a hierarchy of tests or benchmarks:

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
        expect(() => numberToCurrency('abc')).toThrowError()
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

- **Type:** `(name: string, fn: TestFunction, options?: number | TestOptions) => void`

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

- **Type:** `(name: string, fn: TestFunction, options?: number | TestOptions) => void`

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

  Sometimes it is very useful to run `only` tests in a certain file, ignoring all other tests from the whole test suite, which pollute the output.

  In order to do that run `vitest` with specific file containing the tests in question.
  ```
  # vitest interesting.test.ts
  ```

### describe.concurrent

- **Type:** `(name: string, fn: TestFunction, options?: number | TestOptions) => void`

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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

### describe.shuffle

- **Type:** `(name: string, fn: TestFunction, options?: number | TestOptions) => void`

  Vitest provides a way to run all tests in random order via CLI flag [`--sequence.shuffle`](/guide/cli) or config option [`sequence.shuffle`](/config/#sequence-shuffle), but if you want to have only part of your test suite to run tests in random order, you can mark it with this flag.

  ```ts
  describe.shuffle('suite', () => {
    test('random test 1', async () => { /* ... */ })
    test('random test 2', async () => { /* ... */ })
    test('random test 3', async () => { /* ... */ })
  })
  // order depends on sequence.seed option in config (Date.now() by default)
  ```

`.skip`, `.only`, and `.todo` works with random suites.

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

### describe.todo

- **Type:** `(name: string) => void`

  Use `describe.todo` to stub suites to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

  ```ts
  // An entry will be shown in the report for this suite
  describe.todo('unimplemented suite')
  ```

### describe.each

- **Type:** `(cases: ReadonlyArray<T>): (name: string, fn: (...args: T[]) => void, options?: number | TestOptions) => void`

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

::: warning
You cannot use this syntax, when using Vitest as [type checker](/guide/testing-types).
:::

## expect

- **Type:** `ExpectStatic & (actual: any) => Assertions`

  `expect` is used to create assertions. In this context `assertions` are functions that can be called to assert a statement. Vitest provides `chai` assertions by default and also `Jest` compatible assertions build on top of `chai`.

  For example, this code asserts that an `input` value is equal to `2`. If it's not, assertion will throw an error, and the test will fail.

  ```ts
  import { expect } from 'vitest'

  const input = Math.sqrt(4)

  expect(input).to.equal(2) // chai API
  expect(input).toBe(2) // jest API
  ```

  Technically this example doesn't use [`test`](#test) function, so in the console you will see Nodejs error instead of Vitest output. To learn more about `test`, please read [next chapter](#test).

  Also, `expect` can be used statically to access matchers functions, described later, and more.

::: warning
`expect` has no effect on testing types, if expression doesn't have a type error. If you want to use Vitest as [type checker](/guide/testing-types), use [`expectTypeOf`](#expecttypeof) or [`assertType`](#asserttype).
:::

### not

  Using `not` will negate the assertion. For example, this code asserts that an `input` value is not equal to `2`. If it's equal, assertion will throw an error, and the test will fail.

  ```ts
  import { expect, test } from 'vitest'

  const input = Math.sqrt(16)

  expect(input).not.to.equal(2) // chai API
  expect(input).not.toBe(2) // jest API
  ```

### toBe

- **Type:** `(value: any) => Awaitable<void>`

  `toBe` can be used to assert if primitives are equal or that objects share the same reference. It is equivalent of calling `expect(Object.is(3, 3)).toBe(true)`. If the objects are not the same, but you want check if their structures are identical, you can use [`toEqual`](#toequal).

  For example, the code below checks if the trader has 13 apples.

  ```ts
  import { expect, test } from 'vitest'

  const stock = {
    type: 'apples',
    count: 13,
  }

  test('stock has 13 apples', () => {
    expect(stock.type).toBe('apples')
    expect(stock.count).toBe(13)
  })

  test('stocks are the same', () => {
    const refStock = stock // same reference

    expect(stock).toBe(refStock)
  })
  ```

  Try not to use `toBe` with floating-point numbers. Since JavaScript rounds them, `0.1 + 0.2` is not strictly `0.3`. To reliably assert floating-point numbers, use [`toBeCloseTo`](#tobecloseto) assertion.

### toBeCloseTo

- **Type:** `(value: number, numDigits?: number) => Awaitable<void>`

  Use `toBeCloseTo` to compare floating-point numbers. The optional `numDigits` argument limits the number of digits to check _after_ the decimal point. For example:

  ```ts
  import { expect, test } from 'vitest'

  test.fails('decimals are not equal in javascript', () => {
    expect(0.2 + 0.1).toBe(0.3) // 0.2 + 0.1 is 0.30000000000000004
  })

  test('decimals are rounded to 5 after the point', () => {
    // 0.2 + 0.1 is 0.30000 | "000000000004" removed
    expect(0.2 + 0.1).toBeCloseTo(0.3, 5)
    // nothing from 0.30000000000000004 is removed
    expect(0.2 + 0.1).not.toBeCloseTo(0.3, 50)
  })
  ```

### toBeDefined

- **Type:** `() => Awaitable<void>`

  `toBeDefined` asserts that the value is not equal to `undefined`. Useful use case would be to check if function _returned_ anything.

  ```ts
  import { expect, test } from 'vitest'

  const getApples = () => 3

  test('function returned something', () => {
    expect(getApples()).toBeDefined()
  })
  ```

### toBeUndefined

- **Type:** `() => Awaitable<void>`

  Opposite of `toBeDefined`, `toBeUndefined` asserts that the value _is_ equal to `undefined`. Useful use case would be to check if function hasn't _returned_ anything.

  ```ts
  import { expect, test } from 'vitest'

  function getApplesFromStock(stock) {
    if (stock === 'Bill')
      return 13
  }

  test('mary doesn\'t have a stock', () => {
    expect(getApplesFromStock('Mary')).toBeUndefined()
  })
  ```

### toBeTruthy

- **Type:** `() => Awaitable<void>`

  `toBeTruthy` asserts that the value is true, when converted to boolean. Useful if you don't care for the value, but just want to know it can be converted to `true`.

  For example having this code you don't care for the return value of `stocks.getInfo` - it maybe complex object, a string or anything else. The code will still work.

  ```ts
  import { Stocks } from './stocks'
  const stocks = new Stocks()
  stocks.sync('Bill')
  if (stocks.getInfo('Bill'))
    stocks.sell('apples', 'Bill')
  ```

  So if you want to test that `stocks.getInfo` will be truthy, you could write:

  ```ts
  import { expect, test } from 'vitest'
  import { Stocks } from './stocks'
  const stocks = new Stocks()

  test('if we know Bill stock, sell apples to him', () => {
    stocks.sync('Bill')
    expect(stocks.getInfo('Bill')).toBeTruthy()
  })
  ```

  Everything in JavaScript is truthy, except `false`, `0`, `''`, `null`, `undefined`, and `NaN`.

### toBeFalsy

- **Type:** `() => Awaitable<void>`

  `toBeFalsy` asserts that the value is false, when converted to boolean. Useful if you don't care for the value, but just want to know it can be converted to `false`.

  For example having this code you don't care for the return value of `stocks.stockFailed` - it may return any falsy value, but the code will still work.

  ```ts
  import { Stocks } from './stocks'
  const stocks = new Stocks()
  stocks.sync('Bill')
  if (!stocks.stockFailed('Bill'))
    stocks.sell('apples', 'Bill')
  ```

  So if you want to test that `stocks.stockFailed` will be falsy, you could write:

  ```ts
  import { expect, test } from 'vitest'
  import { Stocks } from './stocks'
  const stocks = new Stocks()

  test('if Bill stock hasn\'t failed, sell apples to him', () => {
    stocks.syncStocks('Bill')
    expect(stocks.stockFailed('Bill')).toBeFalsy()
  })
  ```

  Everything in JavaScript is truthy, except `false`, `0`, `''`, `null`, `undefined`, and `NaN`.

### toBeNull

- **Type:** `() => Awaitable<void>`

  `toBeNull` simply asserts if something is `null`. Alias for `.toBe(null)`.

  ```ts
  import { expect, test } from 'vitest'

  function apples() {
    return null
  }

  test('we don\'t have apples', () => {
    expect(apples()).toBeNull()
  })
  ```

### toBeNaN

- **Type:** `() => Awaitable<void>`

  `toBeNaN` simply asserts if something is `NaN`. Alias for `.toBe(NaN)`.

  ```ts
  import { expect, test } from 'vitest'

  let i = 0

  function getApplesCount() {
    i++
    return i > 1 ? NaN : i
  }

  test('getApplesCount has some unusual side effects...', () => {
    expect(getApplesCount()).not.toBeNaN()
    expect(getApplesCount()).toBeNaN()
  })
  ```

### toBeTypeOf

- **Type:** `(c: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined') => Awaitable<void>`

  `toBeTypeOf` asserts if an actual value is of type of received type.

  ```ts
  import { expect, test } from 'vitest'
  const actual = 'stock'

  test('stock is type of string', () => {
    expect(actual).toBeTypeOf('string')
  })
  ```

### toBeInstanceOf

- **Type:** `(c: any) => Awaitable<void>`

  `toBeInstanceOf` asserts if an actual value is instance of received class.

  ```ts
  import { expect, test } from 'vitest'
  import { Stocks } from './stocks'
  const stocks = new Stocks()

  test('stocks are instance of Stocks', () => {
    expect(stocks).toBeInstanceOf(Stocks)
  })
  ```

### toBeGreaterThan

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeGreaterThan` asserts if actual value is greater than received one. Equal values will fail the test.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have more then 10 apples', () => {
    expect(getApples()).toBeGreaterThan(10)
  })
  ```

### toBeGreaterThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeGreaterThanOrEqual` asserts if actual value is greater than received one or equal to it.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or more', () => {
    expect(getApples()).toBeGreaterThanOrEqual(11)
  })
  ```

### toBeLessThan

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThan` asserts if actual value is less than received one. Equal values will fail the test.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have less then 20 apples', () => {
    expect(getApples()).toBeLessThan(20)
  })
  ```

### toBeLessThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThanOrEqual` asserts if actual value is less than received one or equal to it.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or less', () => {
    expect(getApples()).toBeLessThanOrEqual(11)
  })
  ```

### toEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toEqual` asserts if actual value is equal to received one or has the same structure, if it is an object (compares them recursively). You can see the difference between `toEqual` and [`toBe`](#tobe) in this example:

  ```ts
  import { expect, test } from 'vitest'

  const stockBill = {
    type: 'apples',
    count: 13,
  }

  const stockMary = {
    type: 'apples',
    count: 13,
  }

  test('stocks have the same properties', () => {
    expect(stockBill).toEqual(stockMary)
  })

  test('stocks are not the same', () => {
    expect(stockBill).not.toBe(stockMary)
  })
  ```

  :::warning
  A _deep equality_ will not be performed for `Error` objects. To test if something was thrown, use [`toThrowError`](#tothrowerror) assertion.
  :::

### toStrictEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toStrictEqual` asserts if actual value is equal to received one or has the same structure, if it is an object (compares them recursively), and of the same type.

  Differences from [`.toEqual`](#toequal):

  -  Keys with `undefined` properties are checked. e.g. `{a: undefined, b: 2}` does not match `{b: 2}` when using `.toStrictEqual`.
  -  Array sparseness is checked. e.g. `[, 1]` does not match `[undefined, 1]` when using `.toStrictEqual`.
  -  Object types are checked to be equal. e.g. A class instance with fields `a` and` b` will not equal a literal object with fields `a` and `b`.

  ```ts
  import { expect, test } from 'vitest'

  class Stock {
    constructor(type) {
      this.type = type
    }
  }

  test('structurally the same, but semantically different', () => {
    expect(new Stock('apples')).toEqual({ type: 'apples' })
    expect(new Stock('apples')).not.toStrictEqual({ type: 'apples' })
  })
  ```

### toContain

- **Type:** `(received: string) => Awaitable<void>`

  `toContain` asserts if actual value is in an array. `toContain` can also check whether a string is a substring of another string.

  ```ts
  import { expect, test } from 'vitest'
  import { getAllFruits } from './stock'

  test('the fruit list contains orange', () => {
    expect(getAllFruits()).toContain('orange')
  })
  ```

### toContainEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toContainEqual` asserts if an item with a specific structure and values is contained in an array.
  It works like [`toEqual`](#toequal) inside for each element.

  ```ts
  import { expect, test } from 'vitest'
  import { getFruitStock } from './stock'

  test('apple available', () => {
    expect(getFruitStock()).toContainEqual({ fruit: 'apple', count: 5 })
  })
  ```

### toHaveLength

- **Type:** `(received: number) => Awaitable<void>`

  `toHaveLength` asserts if an object has a `.length` property and it is set to a certain numeric value.

  ```ts
  import { expect, test } from 'vitest'

  test('toHaveLength', () => {
    expect('abc').toHaveLength(3)
    expect([1, 2, 3]).toHaveLength(3)

    expect('').not.toHaveLength(3) // doesn't have .length of 3
    expect({ length: 3 }).toHaveLength(3)
  })
  ```

### toHaveProperty

- **Type:** `(key: any, received?: any) => Awaitable<void>`

  `toHaveProperty` asserts if a property at provided reference `key` exists for an object.

  You can provide an optional value argument also known as deep equality, like the `toEqual` matcher to compare the received property value.

  ```ts
  import { expect, test } from 'vitest'

  const invoice = {
    'isActive': true,
    'P.O': '12345',
    'customer': {
      first_name: 'John',
      last_name: 'Doe',
      location: 'China',
    },
    'total_amount': 5000,
    'items': [
      {
        type: 'apples',
        quantity: 10,
      },
      {
        type: 'oranges',
        quantity: 5,
      },
    ],
  }

  test('John Doe Invoice', () => {
    expect(invoice).toHaveProperty('isActive') // assert that the key exists
    expect(invoice).toHaveProperty('total_amount', 5000) // assert that the key exists and the value is equal

    expect(invoice).not.toHaveProperty('account') // assert that this key does not exist

    // Deep referencing using dot notation
    expect(invoice).toHaveProperty('customer.first_name')
    expect(invoice).toHaveProperty('customer.last_name', 'Doe')
    expect(invoice).not.toHaveProperty('customer.location', 'India')

    // Deep referencing using an array containing the key
    expect(invoice).toHaveProperty('items[0].type', 'apples')
    expect(invoice).toHaveProperty('items.0.type', 'apples') // dot notation also works

    // Wrap your key in an array to avoid the key from being parsed as a deep reference
    expect(invoice).toHaveProperty(['P.O'], '12345')
  })
  ```

### toMatch

- **Type:** `(received: string | regexp) => Awaitable<void>`

  `toMatch` asserts if a string matches a regular expression or a string.

  ```ts
  import { expect, test } from 'vitest'

  test('top fruits', () => {
    expect('top fruits include apple, orange and grape').toMatch(/apple/)
    expect('applefruits').toMatch('fruit') // toMatch also accepts a string
  })
  ```

### toMatchObject

- **Type:** `(received: object | array) => Awaitable<void>`

  `toMatchObject` asserts if an object matches a subset of the properties of an object.

  You can also pass an array of objects. This is useful if you want to check that two arrays match in their number of elements, as opposed to `arrayContaining`, which allows for extra elements in the received array.

  ```ts
  import { expect, test } from 'vitest'

  const johnInvoice = {
    isActive: true,
    customer: {
      first_name: 'John',
      last_name: 'Doe',
      location: 'China',
    },
    total_amount: 5000,
    items: [
      {
        type: 'apples',
        quantity: 10,
      },
      {
        type: 'oranges',
        quantity: 5,
      },
    ],
  }

  const johnDetails = {
    customer: {
      first_name: 'John',
      last_name: 'Doe',
      location: 'China',
    },
  }

  test('invoice has john personal details', () => {
    expect(johnInvoice).toMatchObject(johnDetails)
  })

  test('the number of elements must match exactly', () => {
    // Assert that an array of object matches
    expect([{ foo: 'bar' }, { baz: 1 }]).toMatchObject([
      { foo: 'bar' },
      { baz: 1 },
    ])
  })
  ```

### toThrowError

- **Type:** `(received: any) => Awaitable<void>`

  `toThrowError` asserts if a function throws an error when it is called.

  For example, if we want to test that `getFruitStock('pineapples')` throws, we could write:

  You can provide an optional argument to test that a specific error is thrown:

  - regular expression: error message matches the pattern
  - string: error message includes the substring

  :::tip
    You must wrap the code in a function, otherwise the error will not be caught, and the assertion will fail.
  :::

  ```ts
  import { expect, test } from 'vitest'

  function getFruitStock(type) {
    if (type === 'pineapples')
      throw new DiabetesError('Pineapples is not good for people with diabetes')

    // Do some other stuff
  }

  test('throws on pineapples', () => {
    // Test that the error message says "diabetes" somewhere: these are equivalent
    expect(() => getFruitStock('pineapples')).toThrowError(/diabetes/)
    expect(() => getFruitStock('pineapples')).toThrowError('diabetes')

    // Test the exact error message
    expect(() => getFruitStock('pineapples')).toThrowError(
      /^Pineapples is not good for people with diabetes$/,
    )
  })
  ```

### toMatchSnapshot

- **Type:** `<T>(shape?: Partial<T> | string, message?: string) => void`

  This ensures that a value matches the most recent snapshot.

  You can provide an optional `hint` string argument that is appended to the test name. Although Vitest always appends a number at the end of a snapshot name, short descriptive hints might be more useful than numbers to differentiate multiple snapshots in a single it or test block. Vitest sorts snapshots by name in the corresponding `.snap` file.

  :::tip
    When snapshot mismatch and causing the test failing, if the mismatch is expected, you can press `u` key to update the snapshot for once. Or you can pass `-u` or `--update` CLI options to make Vitest always update the tests.
  :::

  ```ts
  import { expect, test } from 'vitest'

  test('matches snapshot', () => {
    const data = { foo: new Set(['bar', 'snapshot']) }
    expect(data).toMatchSnapshot()
  })
  ```

  You can also provide a shape of an object, if you are testing just a shape of an object, and don't need it to be 100% compatible:

  ```ts
  import { expect, test } from 'vitest'

  test('matches snapshot', () => {
    const data = { foo: new Set(['bar', 'snapshot']) }
    expect(data).toMatchSnapshot({ foo: expect.any(Set) })
  })
  ```

### toMatchInlineSnapshot

- **Type:** `<T>(shape?: Partial<T> | string, snapshot?: string, message?: string) => void`

  This ensures that a value matches the most recent snapshot.

  Vitest adds and updates the inlineSnapshot string argument to the matcher in the test file (instead of an external `.snap` file).

  ```ts
  import { expect, test } from 'vitest'

  test('matches inline snapshot', () => {
    const data = { foo: new Set(['bar', 'snapshot']) }
    // Vitest will update following content when updating the snapshot
    expect(data).toMatchInlineSnapshot(`
      {
        "foo": Set {
          "bar",
          "snapshot",
        },
      }
    `)
  })
  ```

  You can also provide a shape of an object, if you are testing just a shape of an object, and don't need it to be 100% compatible:

  ```ts
  import { expect, test } from 'vitest'

  test('matches snapshot', () => {
    const data = { foo: new Set(['bar', 'snapshot']) }
    expect(data).toMatchInlineSnapshot(
      { foo: expect.any(Set) },
      `
      {
        "foo": Any<Set>,
      }
    `
    )
  })
  ```


### toThrowErrorMatchingSnapshot

- **Type:** `(message?: string) => void`

  The same as [`toMatchSnapshot`](#tomatchsnapshot), but expects the same value as [`toThrowError`](#tothrowerror).

  If the function throws an `Error`, the snapshot will be the error message. Otherwise, snapshot will be the value thrown by the function.

### toThrowErrorMatchingInlineSnapshot

- **Type:** `(snapshot?: string, message?: string) => void`

  The same as [`toMatchInlineSnapshot`](#tomatchinlinesnapshot), but expects the same value as [`toThrowError`](#tothrowerror).

  If the function throws an `Error`, the snapshot will be the error message. Otherwise, snapshot will be the value thrown by the function.

### toHaveBeenCalled

- **Type:** `() => Awaitable<void>`

  This assertion is useful for testing that a function has been called. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const market = {
    buy(subject: string, amount: number) {
      // ...
    },
  }

  test('spy function', () => {
    const buySpy = vi.spyOn(market, 'buy')

    expect(buySpy).not.toHaveBeenCalled()

    market.buy('apples', 10)

    expect(buySpy).toHaveBeenCalled()
  })
  ```

### toHaveBeenCalledTimes

 - **Type**: `(amount: number) => Awaitable<void>`

  This assertion checks if a function was called a certain amount of times. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const market = {
    buy(subject: string, amount: number) {
      // ...
    },
  }

  test('spy function called two times', () => {
    const buySpy = vi.spyOn(market, 'buy')

    market.buy('apples', 10)
    market.buy('apples', 20)

    expect(buySpy).toHaveBeenCalledTimes(2)
  })
  ```

### toHaveBeenCalledWith

 - **Type**: `(...args: any[]) => Awaitable<void>`

  This assertion checks if a function was called at least once with certain parameters. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const market = {
    buy(subject: string, amount: number) {
      // ...
    },
  }

  test('spy function', () => {
    const buySpy = vi.spyOn(market, 'buy')

    market.buy('apples', 10)
    market.buy('apples', 20)

    expect(buySpy).toHaveBeenCalledWith('apples', 10)
    expect(buySpy).toHaveBeenCalledWith('apples', 20)
  })
  ```

### toHaveBeenLastCalledWith

 - **Type**: `(...args: any[]) => Awaitable<void>`

  This assertion checks if a function was called with certain parameters at it's last invocation. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const market = {
    buy(subject: string, amount: number) {
      // ...
    },
  }

  test('spy function', () => {
    const buySpy = vi.spyOn(market, 'buy')

    market.buy('apples', 10)
    market.buy('apples', 20)

    expect(buySpy).not.toHaveBeenLastCalledWith('apples', 10)
    expect(buySpy).toHaveBeenLastCalledWith('apples', 20)
  })
  ```

### toHaveBeenNthCalledWith

 - **Type**: `(time: number, ...args: any[]) => Awaitable<void>`

  This assertion checks if a function was called with certain parameters at the certain time. The count starts at 1. So, to check the second entry, you would write `.toHaveBeenNthCalledWith(2, ...)`.

  Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const market = {
    buy(subject: string, amount: number) {
      // ...
    },
  }

  test('first call of spy function called with right params', () => {
    const buySpy = vi.spyOn(market, 'buy')

    market.buy('apples', 10)
    market.buy('apples', 20)

    expect(buySpy).toHaveBeenNthCalledWith(1, 'apples', 10)
  })
  ```

### toHaveReturned

  - **Type**: `() => Awaitable<void>`

  This assertion checks if a function has successfully returned a value at least once (i.e., did not throw an error). Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  const getApplesPrice = (amount: number) => {
    const PRICE = 10
    return amount * PRICE
  }

  test('spy function returned a value', () => {
    const getPriceSpy = vi.fn(getApplesPrice)

    const price = getPriceSpy(10)

    expect(price).toBe(100)
    expect(getPriceSpy).toHaveReturned()
  })
  ```

### toHaveReturnedTimes

  - **Type**: `(amount: number) => Awaitable<void>`

  This assertion checks if a function has successfully returned a value exact amount of times (i.e., did not throw an error). Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  test('spy function returns a value two times', () => {
    const sell = vi.fn((product: string) => ({ product }))

    sell('apples')
    sell('bananas')

    expect(sell).toHaveReturnedTimes(2)
  })
  ```

### toHaveReturnedWith

  - **Type**: `(returnValue: any) => Awaitable<void>`

  You can call this assertion to check if a function has successfully returned a value with certain parameters at least once. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  test('spy function returns a product', () => {
    const sell = vi.fn((product: string) => ({ product }))

    sell('apples')

    expect(sell).toHaveReturnedWith({ product: 'apples' })
  })
  ```

### toHaveLastReturnedWith

  - **Type**: `(returnValue: any) => Awaitable<void>`

  You can call this assertion to check if a function has successfully returned a value with certain parameters on it's last invoking. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  test('spy function returns bananas on a last call', () => {
    const sell = vi.fn((product: string) => ({ product }))

    sell('apples')
    sell('bananas')

    expect(sell).toHaveLastReturnedWith({ product: 'bananas' })
  })
  ```

### toHaveNthReturnedWith

  - **Type**: `(time: number, returnValue: any) => Awaitable<void>`

  You can call this assertion to check if a function has successfully returned a value with certain parameters on a certain call. Requires a spy function to be passed to `expect`.

  ```ts
  import { expect, test, vi } from 'vitest'

  test('spy function returns bananas on second call', () => {
    const sell = vi.fn((product: string) => ({ product }))

    sell('apples')
    sell('bananas')

    expect(sell).toHaveNthReturnedWith(2, { product: 'bananas' })
  })
  ```

### toSatisfy

  - **Type:** `(predicate: (value: any) => boolean) => Awaitable<void>`

  This assertion checks if a value satisfies a certain predicate.

  ```ts
  describe('toSatisfy()', () => {
    const isOdd = (value: number) => value % 2 !== 0

    it('pass with 0', () => {
      expect(1).toSatisfy(isOdd)
    })

    it('pass with negotiation', () => {
      expect(2).not.toSatisfy(isOdd)
    })
  })
  ```

### resolves

- **Type:** `Promisify<Assertions>`

  `resolves` is intended to remove boilerplate when asserting asynchronous code. Use it to unwrap value from the pending promise and assert its value with usual assertions. If the promise rejects, the assertion will fail.

  It returns the same `Assertions` object, but all matchers now return `Promise`, so you would need to `await` it. Also works with `chai` assertions.

  For example, if you have a function, that makes an API call and returns some data, you may use this code to assert its return value:

  ```ts
  import { expect, test } from 'vitest'

  async function buyApples() {
    return fetch('/buy/apples').then(r => r.json())
  }

  test('buyApples returns new stock id', async () => {
    // toEqual returns a promise now, so you HAVE to await it
    await expect(buyApples()).resolves.toEqual({ id: 1 }) // jest API
    await expect(buyApples()).resolves.to.equal({ id: 1 }) // chai API
  })
  ```

  :::warning
  If the assertion is not awaited, then you will have a false-positive test that will pass every time. To make sure that assertions are actually called, you may use [`expect.assertions(number)`](#expect-assertions).
  :::

### rejects

- **Type:** `Promisify<Assertions>`

  `rejects` is intended to remove boilerplate when asserting asynchronous code. Use it to unwrap reason why promise was rejected, and assert its value with usual assertions. If promise successfully resolves, the assertion will fail.

  It returns the same `Assertions` object, but all matchers are now return `Promise`, so you would need to `await` it. Also works with `chai` assertions.

  For example, if you have a function that fails when you call it, you may use this code to assert the reason:

  ```ts
  import { expect, test } from 'vitest'

  async function buyApples(id) {
    if (!id)
      throw new Error('no id')
  }

  test('buyApples throws an error when no id provided', async () => {
    // toThrow returns a promise now, so you HAVE to await it
    await expect(buyApples()).rejects.toThrow('no id')
  })
  ```

  :::warning
  If the assertion is not awaited, then you will have a false-positive test that will pass every time. To make sure that assertions are actually happened, you may use [`expect.assertions(number)`](#expect-assertions).
  :::

### expect.assertions

- **Type:** `(count: number) => void`

  After the test has passed or failed verifies that certain number of assertions was called during a test. Useful case would be to check if an asynchronous code was called.

  For example, if we have a function that asynchronously calls two matchers, we can assert that they were actually called.

  ```ts
  import { expect, test } from 'vitest'

  async function doAsync(...cbs) {
    await Promise.all(
      cbs.map((cb, index) => cb({ index })),
    )
  }

  test('all assertions are called', async () => {
    expect.assertions(2)
    function callback1(data) {
      expect(data).toBeTruthy()
    }
    function callback2(data) {
      expect(data).toBeTruthy()
    }

    await doAsync(callback1, callback2)
  })
  ```

### expect.hasAssertions

- **Type:** `() => void`

  After the test has passed or failed verifies that at least one assertion was called during a test. Useful case would be to check if an asynchronous code was called.

  For example, if you have a code that calls a callback, we can make an assertion inside a callback, but the test will always pass, if we don't check if an assertion was called.

  ```ts
  import { expect, test } from 'vitest'
  import { db } from './db'

  const cbs = []

  function onSelect(cb) {
    cbs.push(cb)
  }

  // after selecting from db, we call all callbacks
  function select(id) {
    return db.select({ id }).then((data) => {
      return Promise.all(
        cbs.map(cb => cb(data)),
      )
    })
  }

  test('callback was called', async () => {
    expect.hasAssertions()
    onSelect((data) => {
      // should be called on select
      expect(data).toBeTruthy()
    })
    // if not awaited, test will fail
    // if you don't have expect.hasAssertions(), test will pass
    await select(3)
  })
  ```

<!-- asymmetric matchers -->

### expect.anything

- **Type:** `() => any`

  This asymmetric matcher, when used with equality check, will always return `true`. Useful, if you just want to be sure that the property exist.

  ```ts
  import { expect, test } from 'vitest'

  test('object has "apples" key', () => {
    expect({ apples: 22 }).toEqual({ apples: expect.anything() })
  })
  ```

### expect.any

- **Type:** `(constructor: unknown) => any`

  This asymmetric matcher, when used with equality check, will return `true` only if value is an instance of specified constructor. Useful, if you have a value that is generated each time, and you only want to know that it exist with a proper type.

  ```ts
  import { expect, test } from 'vitest'
  import { generateId } from './generators'

  test('"id" is a number', () => {
    expect({ id: generateId() }).toEqual({ id: expect.any(Number) })
  })
  ```

### expect.arrayContaining

- **Type:** `<T>(expected: T[]) => any`

  When used with equality check, this asymmetric matcher will return `true` if value is an array and contains specified items.

  ```ts
  import { expect, test } from 'vitest'

  test('basket includes fuji', () => {
    const basket = {
      varieties: [
        'Empire',
        'Fuji',
        'Gala',
      ],
      count: 3
    }
    expect(basket).toEqual({
      count: 3,
      varieties: expect.arrayContaining(['Fuji'])
    })
  })
  ```

  :::tip
  You can use `expect.not` with this matcher to negate the expected value.
  :::

### expect.objectContaining

- **Type:** `(expected: any) => any`

  When used with equality check, this asymmetric matcher will return `true` if value has a similar shape.

  ```ts
  import { expect, test } from 'vitest'

  test('basket has empire apples', () => {
    const basket = {
      varieties: [
        {
          name: 'Empire',
          count: 1,
        }
      ],
    }
    expect(basket).toEqual({
      varieties: [
        expect.objectContaining({ name: 'Empire' }),
      ]
    })
  })
  ```

  :::tip
  You can use `expect.not` with this matcher to negate the expected value.
  :::

### expect.stringContaining

- **Type:** `(expected: any) => any`

  When used with equality check, this asymmetric matcher will return `true` if value is a string and contains specified substring.

  ```ts
  import { expect, test } from 'vitest'

  test('variety has "Emp" in its name', () => {
    const variety = {
      name: 'Empire',
      count: 1,
    }
    expect(basket).toEqual({
      name: expect.stringContaining('Emp'),
      count: 1,
    })
  })
  ```

  :::tip
  You can use `expect.not` with this matcher to negate the expected value.
  :::

### expect.stringMatching

- **Type:** `(expected: any) => any`

  When used with equality check, this asymmetric matcher will return `true` if value is a string and contains specified substring or the string matches regular expression.

  ```ts
  import { expect, test } from 'vitest'

  test('variety ends with "re"', () => {
    const variety = {
      name: 'Empire',
      count: 1,
    }
    expect(basket).toEqual({
      name: expect.stringMatching(/re$/),
      count: 1,
    })
  })
  ```

  :::tip
  You can use `expect.not` with this matcher to negate the expected value.
  :::

### expect.addSnapshotSerializer

- **Type:** `(plugin: PrettyFormatPlugin) => void`

  This method adds custom serializers that are called when creating a snapshot. This is advanced feature - if you want to know more, please read a [guide on custom serializers](/guide/snapshot#custom-serializer).

  If you are adding custom serializers, you should call this method inside [`setupFiles`](/config/#setupfiles). This will affect every snapshot.

  :::tip
  If you previously used Vue CLI with Jest, you might want to install [jest-serializer-vue](https://www.npmjs.com/package/jest-serializer-vue). Otherwise, your snapshots will be wrapped in a string, which cases `"` to be escaped.
  :::

### expect.extend

- **Type:** `(matchers: MatchersObject) => void`

  You can extend default matchers with your own. This function is used to extend the matchers object with custom matchers.

  When you define matchers that way, you also create asymmetric matchers that can be used like `expect.stringContaining`.

  ```ts
  import { expect, test } from 'vitest'

  test('custom matchers', () => {
    expect.extend({
      toBeFoo: (received, expected) => {
        if (received !== 'foo') {
          return {
            message: () => `expected ${received} to be foo`,
            pass: false,
          }
        }
      },
    })

    expect('foo').toBeFoo()
    expect({ foo: 'foo' }).toEqual({ foo: expect.toBeFoo() })
  })
  ```

  > If you want your matchers to appear in every test, you should call this method inside [`setupFiles`](/config/#setupFiles).

  This function is compatible with Jest's `expect.extend`, so any library that uses it to create custom matchers will work with Vitest.

  If you are using TypeScript, you can extend default Matchers interface with the code bellow:

  ```ts
  interface CustomMatchers<R = unknown> {
    toBeFoo(): R
  }

  declare global {
    namespace Vi {
      interface Assertion extends CustomMatchers {}
      interface AsymmetricMatchersContaining extends CustomMatchers {}
    }
  }
  ```

  > Note: augmenting jest.Matchers interface will also work.

  :::tip
  If you want to know more, checkout [guide on extending matchers](/guide/extending-matchers).
  :::

## expectTypeOf

- **Type:** `<T>(a: unknown) => ExpectTypeOf`

### not

  - **Type:** `ExpectTypeOf`

  You can negate all assertions, using `.not` property.

### toEqualTypeOf

  - **Type:** `<T>(expected: T) => void`

  This matcher will check, if types are fully equal to each other. This matcher will not fail, if two objects have different values, but the same type, but will fail, if object is missing a property.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf({ a: 1 }).toEqualTypeOf<{ a: number }>()
  expectTypeOf({ a: 1 }).toEqualTypeOf({ a: 1 })
  expectTypeOf({ a: 1 }).toEqualTypeOf({ a: 2 })
  expectTypeOf({ a: 1, b: 1 }).not.toEqualTypeOf<{ a: number }>()
  ```

### toMatchTypeOf

  - **Type:** `<T>(expected: T) => void`

  This matcher checks if expect type extends provided type. It is different from `toEqual` and is more similar to expect's `toMatch`. With this matcher you can check, if an object "matches" a type.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf({ a: 1, b: 1 }).toMatchTypeOf({ a: 1 })
  expectTypeOf<number>().toMatchTypeOf<string | number>()
  expectTypeOf<string | number>().not.toMatchTypeOf<number>()
  ```

### extract

  - **Type:** `ExpectTypeOf<ExtractedUnion>`

  You can use `.extract` to narrow down types for further testing.

  ```ts
  import { expectTypeOf } from 'vitest'

  type ResponsiveProp<T> = T | T[] | { xs?: T; sm?: T; md?: T }
  const getResponsiveProp = <T>(_props: T): ResponsiveProp<T> => ({})
  interface CSSProperties { margin?: string; padding?: string }

  const cssProperties: CSSProperties = { margin: '1px', padding: '2px' }

  expectTypeOf(getResponsiveProp(cssProperties))
    .extract<{ xs?: any }>() // extracts the last type from a union
    .toEqualTypeOf<{ xs?: CSSProperties; sm?: CSSProperties; md?: CSSProperties }>()

  expectTypeOf(getResponsiveProp(cssProperties))
    .extract<unknown[]>() // extracts an array from a union
    .toEqualTypeOf<CSSProperties[]>()
  ```

  ::: warning
  If no type is found in the union, `.extract` will return `never`.
  :::

### exclude

  - **Type:** `ExpectTypeOf<NonExcludedUnion>`

  You can use `.exclude` to remove types from a union for further testing.

  ```ts
  import { expectTypeOf } from 'vitest'

  type ResponsiveProp<T> = T | T[] | { xs?: T; sm?: T; md?: T }
  const getResponsiveProp = <T>(_props: T): ResponsiveProp<T> => ({})
  interface CSSProperties { margin?: string; padding?: string }

  const cssProperties: CSSProperties = { margin: '1px', padding: '2px' }

  expectTypeOf(getResponsiveProp(cssProperties))
    .exclude<unknown[]>()
    .exclude<{ xs?: unknown }>() // or just .exclude<unknown[] | { xs?: unknown }>()
    .toEqualTypeOf<CSSProperties>()
  ```

  ::: warning
  If no type is found in the union, `.exclude` will return `never`.
  :::

### returns

  - **Type:** `ExpectTypeOf<ReturnValue>`

  You can use `.returns` to extract return value of a function type.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(() => {}).returns.toBeVoid()
  expectTypeOf((a: number) => [a, a]).returns.toEqualTypeOf([1, 2])
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### parameters

  - **Type:** `ExpectTypeOf<Parameters>`

  You can extract function arguments with `.parameters` to perform assertions on its value. Parameters are returned as an array.

  ```ts
  import { expectTypeOf } from 'vitest'

  type NoParam = () => void
  type HasParam = (s: string) => void

  expectTypeOf<NoParam>().parameters.toEqualTypeOf<[]>()
  expectTypeOf<HasParam>().parameters.toEqualTypeOf<[string]>()
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

  ::: tip
  You can also use [`.toBeCallableWith`](#tobecallablewith) matcher as a more expressive assertion.
  :::

### parameter

  - **Type:** `(nth: number) => ExpectTypeOf`

  You can extract a certain function argument with `.parameter(number)` call to perform other assertions on it.

  ```ts
  import { expectTypeOf } from 'vitest'

  const foo = (a: number, b: string) => [a, b]

  expectTypeOf(foo).parameter(0).toBeNumber()
  expectTypeOf(foo).parameter(1).toBeString()
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### constructorParameters

  - **Type:** `ExpectTypeOf<ConstructorParameters>`

  You can extract constructor parameters as an array of values and perform assertions on them with this method.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(Date).constructorParameters.toEqualTypeOf<[] | [string | number | Date]>()
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

  ::: tip
  You can also use [`.toBeConstructibleWith`](#tobeconstructiblewith) matcher as a more expressive assertion.
  :::

### instance

  - **Type:** `ExpectTypeOf<ConstructableInstance>`

  This property gives access to matchers that can be performed on an instance of the provided class.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(Date).instance.toHaveProperty('toISOString')
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### items

  - **Type:** `ExpectTypeOf<T>`

  You can get array item type with `.items` to perform further assertions.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf([1, 2, 3]).items.toEqualTypeOf<number>()
  expectTypeOf([1, 2, 3]).items.not.toEqualTypeOf<string>()
  ```

### resolves

  - **Type:** `ExpectTypeOf<ResolvedPromise>`

  This matcher extracts resolved value of a `Promise`, so you can perform other assertions on it.

  ```ts
  import { expectTypeOf } from 'vitest'

  const asyncFunc = async () => 123

  expectTypeOf(asyncFunc).returns.resolves.toBeNumber()
  expectTypeOf(Promise.resolve('string')).resolves.toBeString()
  ```

  ::: warning
  If used on a non-promise type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### guards

  - **Type:** `ExpectTypeOf<Guard>`

  This matcher extracts guard value (e.g., `v is number`), so you can perform assertions on it.

  ```ts
  import { expectTypeOf } from 'vitest'

  const isString = (v: any): v is string => typeof v === 'string'
  expectTypeOf(isString).guards.toBeString()
  ```

  ::: warning
  Returns `never`, if the value is not a guard function, so you won't be able to chain it with other matchers.
  :::

### asserts

  - **Type:** `ExpectTypeOf<Assert>`

  This matcher extracts assert value (e.g., `assert v is number`), so you can perform assertions on it.

  ```ts
  import { expectTypeOf } from 'vitest'

  const assertNumber = (v: any): asserts v is number => {
    if (typeof v !== 'number')
      throw new TypeError('Nope !')
  }

  expectTypeOf(assertNumber).asserts.toBeNumber()
  ```

  ::: warning
  Returns `never`, if the value is not an assert function, so you won't be able to chain it with other matchers.
  :::

### toBeAny

  - **Type:** `() => void`

  With this matcher you can check, if provided type is `any` type. If the type is too specific, the test will fail.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf<any>().toBeAny()
  expectTypeOf({} as any).toBeAny()
  expectTypeOf('string').not.toBeAny()
  ```

### toBeUnknown

  - **Type:** `() => void`

  This matcher checks, if provided type is `unknown` type.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf().toBeUnknown()
  expectTypeOf({} as unknown).toBeUnknown()
  expectTypeOf('string').not.toBeUnknown()
  ```

### toBeNever

  - **Type:** `() => void`

  This matcher checks, if provided type is a `never` type.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf<never>().toBeNever()
  expectTypeOf((): never => {}).returns.toBeNever()
  ```

### toBeFunction

  - **Type:** `() => void`

  This matcher checks, if provided type is a `functon`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(42).not.toBeFunction()
  expectTypeOf((): never => {}).toBeFunction()
  ```

### toBeObject

  - **Type:** `() => void`

  This matcher checks, if provided type is an `object`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(42).not.toBeObject()
  expectTypeOf({}).toBeObject()
  ```

### toBeArray

  - **Type:** `() => void`

  This matcher checks, if provided type is `Array<T>`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(42).not.toBeArray()
  expectTypeOf([]).toBeArray()
  expectTypeOf([1, 2]).toBeArray()
  expectTypeOf([{}, 42]).toBeArray()
  ```

### toBeString

  - **Type:** `() => void`

  This matcher checks, if provided type is a `string`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(42).not.toBeArray()
  expectTypeOf([]).toBeArray()
  expectTypeOf([1, 2]).toBeArray()
  expectTypeOf<number[]>().toBeArray()
  ```

### toBeBoolean

  - **Type:** `() => void`

  This matcher checks, if provided type is `boolean`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(42).not.toBeBoolean()
  expectTypeOf(true).toBeBoolean()
  expectTypeOf<boolean>().toBeBoolean()
  ```

### toBeVoid

  - **Type:** `() => void`

  This matcher checks, if provided type is `void`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(() => {}).returns.toBeVoid()
  expectTypeOf<void>().toBeVoid()
  ```

### toBeSymbol

  - **Type:** `() => void`

  This matcher checks, if provided type is a `symbol`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(Symbol(1)).toBeSymbol()
  expectTypeOf<symbol>().toBeSymbol()
  ```

### toBeNull

  - **Type:** `() => void`

  This matcher checks, if provided type is `null`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(null).toBeNull()
  expectTypeOf<null>().toBeNull()
  expectTypeOf(undefined).not.toBeNull()
  ```

### toBeUndefined

  - **Type:** `() => void`

  This matcher checks, if provided type is `undefined`.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(undefined).toBeUndefined()
  expectTypeOf<undefined>().toBeUndefined()
  expectTypeOf(null).not.toBeUndefined()
  ```

### toBeNullable

  - **Type:** `() => void`

  This matcher checks, if you can use `null` or `undefined` with provided type.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf<1 | undefined>().toBeNullable()
  expectTypeOf<1 | null>().toBeNullable()
  expectTypeOf<1 | undefined | null>().toBeNullable()
  ```

### toBeCallableWith

  - **Type:** `() => void`

  This matcher ensures you can call provided function with a set of parameters.

  ```ts
  import { expectTypeOf } from 'vitest'

  type NoParam = () => void
  type HasParam = (s: string) => void

  expectTypeOf<NoParam>().toBeCallableWith()
  expectTypeOf<HasParam>().toBeCallableWith('some string')
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### toBeConstructibleWith

  - **Type:** `() => void`

  This matcher ensures you can create a new instance with a set of constructor parameters.

  ```ts
  import { expectTypeOf } from 'vitest'

  expectTypeOf(Date).toBeConstructibleWith(new Date())
  expectTypeOf(Date).toBeConstructibleWith('01-01-2000')
  ```

  ::: warning
  If used on a non-function type, it will return `never`, so you won't be able to chain it with other matchers.
  :::

### toHaveProperty

  - **Type:** `<K extends keyof T>(property: K) => ExpectTypeOf<T[K>`

  This matcher checks if a property exists on provided object. If it exists, it also returns the same set of matchers for the type of this property, so you can chain assertions one after another.

  ```ts
  import { expectTypeOf } from 'vitest'

  const obj = { a: 1, b: '' }

  expectTypeOf(obj).toHaveProperty('a')
  expectTypeOf(obj).not.toHaveProperty('c')

  expectTypeOf(obj).toHaveProperty('a').toBeNumber()
  expectTypeOf(obj).toHaveProperty('b').toBeString()
  expectTypeOf(obj).toHaveProperty('a').not.toBeString()
  ```

## assertType

  - **Type:** `<T>(value: T): void`

  You can use this function as an alternative for `expectTypeOf` to easily assert that argument type is equal to provided generic.

  ```ts
  import { assertType } from 'vitest'

  function concat(a: string, b: string): string
  function concat(a: number, b: number): number
  function concat(a: string | number, b: string | number): string | number

  assertType<string>(concat('a', 'b'))
  assertType<number>(concat(1, 2))
  // @ts-expect-error wrong types
  assertType(concat('a', 2))
  ```

## Setup and Teardown

These functions allow you to hook into the life cycle of tests to avoid repeating setup and teardown code. They apply to the current context: the file if they are used at the top-level or the current suite if they are inside a `describe` block. These hooks are not called, when you are running Vitest as a type checker.

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

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds.

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

## Vi
Vitest provides utility functions to help you out through it's **vi** helper. You can `import { vi } from 'vitest'` or access it **globally** (when [globals configuration](/config/#globals) is **enabled**).

### vi.advanceTimersByTime

- **Type:** `(ms: number) => Vitest`

  Works just like `runAllTimers`, but will end after passed milliseconds. For example this will log `1, 2, 3` and will not throw:

  ```ts
  let i = 0
  setInterval(() => console.log(++i), 50)

  vi.advanceTimersByTime(150)
  ```

### vi.advanceTimersToNextTimer

- **Type:** `() => Vitest`

  Will call next available timer. Useful to make assertions between each timer call. You can chain call it to manage timers by yourself.

  ```ts
  let i = 0
  setInterval(() => console.log(++i), 50)

  vi.advanceTimersToNextTimer() // log 1
    .advanceTimersToNextTimer() // log 2
    .advanceTimersToNextTimer() // log 3
  ```

### vi.clearAllMocks

  Will call [`.mockClear()`](/api/#mockclear) on all spies. This will clear mock history, but not reset its implementation to the default one.

### vi.clearAllTimers

  Removes all timers that are scheduled to run. These timers will never run in the future.

### vi.dynamicImportSettled

  Wait for all imports to load. Useful, if you have a synchronous call that starts importing a module, that you cannot wait otherwise.

### vi.fn

- **Type:** `(fn?: Function) => CallableMockInstance`

  Creates a spy on a function, though can be initiated without one. Every time a function is invoked, it stores its call arguments, returns and instances. Also, you can manipulate its behavior with [methods](#mockinstance-methods).
  If no function is given, mock will return `undefined`, when invoked.

  ```ts
  const getApples = vi.fn(() => 0)

  getApples()

  expect(getApples).toHaveBeenCalled()
  expect(getApples).toHaveReturnedWith(0)

  getApples.mockReturnValueOnce(5)

  const res = getApples()
  expect(res).toBe(5)
  expect(getApples).toHaveNthReturnedWith(2, 5)
  ```

### vi.getMockedSystemTime

- **Type**: `() => Date | null`

  Returns mocked current date that was set using `setSystemTime`. If date is not mocked, will return `null`.

### vi.getRealSystemTime

- **Type**: `() => number`

  When using `vi.useFakeTimers`, `Date.now` calls are mocked. If you need to get real time in milliseconds, you can call this function.

### vi.mock

- **Type**: `(path: string, factory?: () => unknown) => void`

  Makes all `imports` to passed module to be mocked. Inside a path you _can_ use configured Vite aliases. The call to `vi.mock` is hoisted, so it doesn't matter where you call it. It will always be executed before all imports.

  - If `factory` is defined, will return its result. Factory function can be asynchronous. You may call [`vi.importActual`](#vi-importactual) inside to get the original module. Since the call to `vi.mock` is hoisted, you don't have access to variables declared in the global file scope!
  - If mocking a module with a default export, you'll need to provide a `default` key within the returned factory function object. This is an ES modules specific caveat, therefore `jest` documentation may differ as `jest` uses commonJS modules. *Example:*

  ```ts
  vi.mock('path', () => {
    return {
      default: { myDefaultKey: vi.fn() },
      namedExport: vi.fn(),
      // etc...
    }
  })
  ```

  - If `__mocks__` folder with file of the same name exist, all imports will return its exports. For example, `vi.mock('axios')` with `<root>/__mocks__/axios.ts` folder will return everything exported from `axios.ts`.
  - If there is no `__mocks__` folder or a file with the same name inside, will call original module and mock it. (For the rules applied, see [algorithm](/guide/mocking#automocking-algorithm).)

### vi.mocked

- **Type**: `<T>(obj: T, deep?: boolean) => MaybeMockedDeep<T>`
- **Type**: `<T>(obj: T, options?: { partial?: boolean; deep?: boolean }) => MaybePartiallyMockedDeep<T>`

  Type helper for TypeScript. In reality just returns the object that was passed.

  When `partial` is `true` it will expect a `Partial<T>` as a return value.
  ```ts
  import example from './example'
  vi.mock('./example')

  test('1+1 equals 2', async () => {
    vi.mocked(example.calc).mockRestore()

    const res = example.calc(1, '+', 1)

    expect(res).toBe(2)
  })
  ```

### vi.importActual

- **Type**: `<T>(path: string) => Promise<T>`

  Imports module, bypassing all checks if it should be mocked. Can be useful if you want to mock module partially.

  ```ts
  vi.mock('./example', async () => {
    const axios = await vi.importActual('./example')

    return { ...axios, get: vi.fn() }
  })
   ```

### vi.importMock

- **Type**: `<T>(path: string) => Promise<MaybeMockedDeep<T>>`

  Imports a module with all of its properties (including nested properties) mocked. Follows the same rules that [`vi.mock`](#vi-mock) follows. For the rules applied, see [algorithm](/guide/mocking#automocking-algorithm).

### vi.resetAllMocks

  Will call [`.mockReset()`](/api/#mockreset) on all spies. This will clear mock history and reset its implementation to an empty function (will return `undefined`).

### vi.resetModules

- **Type**: `() => Vitest`

  Resets modules registry by clearing cache of all modules. Might be useful to isolate modules where local state conflicts between tests.

  ```ts
  import { vi } from 'vitest'

  beforeAll(() => {
    vi.resetModules()
  })

  test('change state', async () => {
    const mod = await import('./some/path')
    mod.changeLocalState('new value')
    expect(mod.getlocalState()).toBe('new value')
  })

  test('module has old state', async () => {
    const mod = await import('./some/path')
    expect(mod.getlocalState()).toBe('old value')
  })
  ```

### vi.restoreAllMocks

  Will call [`.mockRestore()`](/api/#mockrestore) on all spies. This will clear mock history and reset its implementation to the original one.

### vi.restoreCurrentDate

- **Type**: `() => void`

  Restores `Date` back to its native implementation.

### vi.runAllTicks

- **Type:** `() => Vitest`

  Calls every microtask. These are usually queued by `proccess.nextTick`. This will also run all microtasks scheduled by themselves.

### vi.runAllTimers

- **Type:** `() => Vitest`

  This method will invoke every initiated timer until the timers queue is empty. It means that every timer called during `runAllTimers` will be fired. If you have an infinite interval,
  it will throw after 10 000 tries. For example this will log `1, 2, 3`:

  ```ts
  let i = 0
  setTimeout(() => console.log(++i))
  const interval = setInterval(() => {
    console.log(++i)
    if (i === 3)
      clearInterval(interval)

  }, 50)

  vi.runAllTimers()
  ```

### vi.runOnlyPendingTimers

- **Type:** `() => Vitest`

  This method will call every timer that was initiated after `vi.useFakeTimers()` call. It will not fire any timer that was initiated during its call. For example this will only log `1`:

  ```ts
  let i = 0
  setInterval(() => console.log(++i), 50)

  vi.runOnlyPendingTimers()
  ```

### vi.setSystemTime

- **Type**: `(date: string | number | Date) => void`

  Sets current date to the one that was passed. All `Date` calls will return this date.

  Useful if you need to test anything that depends on the current date - for example [luxon](https://github.com/moment/luxon/) calls inside your code.

  ```ts
  const date = new Date(1998, 11, 19)

  vi.useFakeTimers()
  vi.setSystemTime(date)

  expect(Date.now()).toBe(date.valueOf())

  vi.useRealTimers()
  ```

### vi.spyOn

- **Type:** `<T, K extends keyof T>(object: T, method: K, accessType?: 'get' | 'set') => MockInstance`

  Creates a spy on a method or getter/setter of an object.

  ```ts
  let apples = 0
  const obj = {
    getApples: () => 13,
  }

  const spy = vi.spyOn(obj, 'getApples').mockImplementation(() => apples)
  apples = 1

  expect(obj.getApples()).toBe(1)

  expect(spy).toHaveBeenCalled()
  expect(spy).toHaveReturnedWith(1)
  ```

### vi.stubGlobal

- **Type**: `(key: keyof globalThis & Window, value: any) => Vitest`

  Puts a value on global variable. If you are using `jsdom` or `happy-dom`, also puts the value on `window` object.

  Read more in ["Mocking Globals" section](/guide/mocking.html#globals).

### vi.unmock

- **Type**: `(path: string) => void`

  Removes module from mocked registry. All subsequent calls to import will return original module even if it was mocked.

### vi.useFakeTimers

- **Type:** `() => Vitest`

  To enable mocking timers, you need to call this method. It will wrap all further calls to timers (such as `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `nextTick`, `setImmediate`, `clearImmediate`, and `Date`), until [`vi.useRealTimers()`](#vi-userealtimers) is called.

  The implementation is based internally on [`@sinonjs/fake-timers`](https://github.com/sinonjs/fake-timers).

### vi.useRealTimers

- **Type:** `() => Vitest`

  When timers are run out, you may call this method to return mocked timers to its original implementations. All timers that were run before will not be restored.

## MockInstance Methods

### getMockName

- **Type:** `() => string`

  Use it to return the name given to mock with method `.mockName(name)`.

### mockClear

- **Type:** `() => MockInstance`

  Clears all information about every call. After calling it, [`spy.mock.calls`](#mock-calls), [`spy.mock.results`](#mock-results) will return empty arrays. It is useful if you need to clean up spy between different assertions.

  If you want this method to be called before each test automatically, you can enable [`clearMocks`](/config/#clearmocks) setting in config.


### mockName

- **Type:** `(name: string) => MockInstance`

  Sets internal mock name. Useful to see what mock has failed the assertion.

### mockImplementation

- **Type:** `(fn: Function) => MockInstance`

  Accepts a function that will be used as an implementation of the mock.

  For example:

  ```ts
  const mockFn = vi.fn().mockImplementation(apples => apples + 1)
  // or: vi.fn(apples => apples + 1);

  const NelliesBucket = mockFn(0)
  const BobsBucket = mockFn(1)

  NelliesBucket === 1 // true
  BobsBucket === 2 // true

  mockFn.mock.calls[0][0] === 0 // true
  mockFn.mock.calls[1][0] === 1 // true
  ```

### mockImplementationOnce

- **Type:** `(fn: Function) => MockInstance`

  Accepts a function that will be used as an implementation of the mock for one call to the mocked function. Can be chained so that multiple function calls produce different results.

  ```ts
  const myMockFn = vi
    .fn()
    .mockImplementationOnce(() => true)
    .mockImplementationOnce(() => false)

  myMockFn() // true
  myMockFn() // false
  ```

  When the mocked function runs out of implementations, it will invoke the default implementation that was set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called:

  ```ts
  const myMockFn = vi
    .fn(() => 'default')
    .mockImplementationOnce(() => 'first call')
    .mockImplementationOnce(() => 'second call')

  // 'first call', 'second call', 'default', 'default'
  console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn())
  ```

### mockRejectedValue

- **Type:** `(value: any) => MockInstance`

  Accepts an error that will be rejected, when async function will be called.

  ```ts
  test('async test', async () => {
    const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'))

    await asyncMock() // throws "Async error"
  })
  ```

### mockRejectedValueOnce

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be rejected for one call to the mock function. If chained, every consecutive call will reject passed value.

  ```ts
  test('async test', async () => {
    const asyncMock = vi
      .fn()
      .mockResolvedValueOnce('first call')
      .mockRejectedValueOnce(new Error('Async error'))

    await asyncMock() // first call
    await asyncMock() // throws "Async error"
  })
  ```

### mockReset

- **Type:** `() => MockInstance`

  Does what `mockClear` does and makes inner implementation as an empty function (returning `undefined`, when invoked). This is useful when you want to completely reset a mock back to its initial state.

  If you want this method to be called before each test automatically, you can enable [`mockReset`](/config/#mockreset) setting in config.

### mockRestore

- **Type:** `() => MockInstance`

  Does what `mockReset` does and restores inner implementation to the original function.

  Note that restoring mock from `vi.fn()` will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.

  If you want this method to be called before each test automatically, you can enable [`restoreMocks`](/config/#restoreMocks) setting in config.

### mockResolvedValue

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be resolved, when async function will be called.

  ```ts
  test('async test', async () => {
    const asyncMock = vi.fn().mockResolvedValue(43)

    await asyncMock() // 43
  })
  ```

### mockResolvedValueOnce

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be resolved for one call to the mock function. If chained, every consecutive call will resolve passed value.

  ```ts
  test('async test', async () => {
    const asyncMock = vi
      .fn()
      .mockResolvedValue('default')
      .mockResolvedValueOnce('first call')
      .mockResolvedValueOnce('second call')

    await asyncMock() // first call
    await asyncMock() // second call
    await asyncMock() // default
    await asyncMock() // default
  })
  ```

### mockReturnThis

- **Type:** `() => MockInstance`

  Sets inner implementation to return `this` context.

### mockReturnValue

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be returned whenever the mock function is called.

  ```ts
  const mock = vi.fn()
  mock.mockReturnValue(42)
  mock() // 42
  mock.mockReturnValue(43)
  mock() // 43
  ```

### mockReturnValueOnce

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be returned for one call to the mock function. If chained, every consecutive call will return passed value. When there are no more `mockReturnValueOnce` values to use, calls a function specified by `mockImplementation` or other `mockReturn*` methods.

  ```ts
  const myMockFn = vi
    .fn()
    .mockReturnValue('default')
    .mockReturnValueOnce('first call')
    .mockReturnValueOnce('second call')

  // 'first call', 'second call', 'default', 'default'
  console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn())
  ```

## MockInstance Properties

### mock.calls

This is an array containing all arguments for each call. One item of the array is arguments of that call.

If a function was invoked twice with the following arguments `fn(arg1, arg2)`, `fn(arg3, arg4)` in that order, then `mock.calls` will be:

```js
[
  ['arg1', 'arg2'],
  ['arg3', 'arg4'],
]
```

### mock.lastCall

This contains the arguments of the last call. If spy wasn't called, will return `undefined`.

### mock.results

This is an array containing all values, that were `returned` from function. One item of the array is an object with properties `type` and `value`. Available types are:

- `'return'` - function returned without throwing.
- `'throw'` - function threw a value.

The `value` property contains returned value or thrown error.

If function returned `result`, then threw an error, then `mock.results` will be:

```js
[
  {
    type: 'return',
    value: 'result',
  },
  {
    type: 'throw',
    value: Error,
  },
]
```

### mock.instances

This is an array containing all instances that were instantiated when mock was called with a `new` keyword. Note, this is an actual context (`this`) of the function, not a return value.

For example, if mock was instantiated with `new MyClass()`, then `mock.instances` will be an array of one value:

```js
import { expect, vi } from 'vitest'

const MyClass = vi.fn()

const a = new MyClass()

expect(MyClass.mock.instances[0]).toBe(a)
```

If you return a value from constructor, it will not be in `instances` array, but instead on `results`:

```js
import { expect, vi } from 'vitest'

const Spy = vi.fn(() => ({ method: vi.fn() }))

const a = new Spy()

expect(Spy.mock.instances[0]).not.toBe(a)
expect(Spy.mock.results[0]).toBe(a)
```
