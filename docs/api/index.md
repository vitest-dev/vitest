# API Reference

The following types are used in the type signatures below

```ts
type DoneCallback = (error?: any) => void
type Awaitable<T> = T | PromiseLike<T>
type TestFunction = () => Awaitable<void> | (done: DoneCallback) => void
```

When a test function returns a promise, the runner will wait until it is resolved to collect async expectations. If the promise is rejected, the test will fail.

For compatibility with Jest, `TestFunction` can also be of type `(done: DoneCallback) => void`. If this form is used, the test will not be concluded until `done` is called (with zero arguments or a falsy value for a successful test, and with a truthy error value as argument to trigger a fail). We don't recommend using this form, as you can achieve the same using an `async` function.

## test

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it`

  `test` defines a set of related expectations. It receives the test name and a function that holds the expectations to test.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds, and can be configured globally with [testTimeout](/config/#testtimeout)

  ```ts
  import { test, expect } from 'vitest'

  test('should work as expected', () => {
    expect(Math.sqrt(4)).toBe(2);
  })
  ```

### test.skip

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.skip`

  If you want to skip running certain tests, but you don't want to delete the code due to any reason, you can use `test.skip` to avoid running them.

  ```ts
  import { test, assert } from 'vitest'

  test.skip("skipped test", () => {
    // Test skipped, no error
    assert.equal(Math.sqrt(4), 3);
  });
  ```

### test.only

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.only`

  Use `test.only` to only run certain tests in a given suite. This is useful when debugging.

  Optionally, you can provide a timeout (in milliseconds) for specifying how long to wait before terminating. The default is 5 seconds, and can be configured globally with [testTimeout](/config/#testtimeout).

  ```ts
  import { test, assert } from 'vitest'

  test.only("test", () => {
    // Only this test (and others marked with only) are run
    assert.equal(Math.sqrt(4), 2);
  });
  ```

### test.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.concurrent`

  `test.concurrent` marks consecutive tests to be run them in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

  ```ts
  import { describe, test } from 'vitest'

  // The two tests marked with concurrent will be run in parallel
  describe("suite", () => {
    test("serial test", async() => { /* ... */ });
    test.concurrent("concurrent test 1", async() => { /* ... */ });
    test.concurrent("concurrent test 2", async() => { /* ... */ });
  });
  ```

  `test.skip`, `test.only`, and `test.todo` works with concurrent tests. All the following combinations are valid:

  ```ts
  test.concurrent(...)
  test.skip.concurrent(...), test.concurrent.skip(...)
  test.only.concurrent(...), test.concurrent.only(...)
  test.todo.concurrent(...), test.concurrent.todo(...)
  ```

### test.todo

- **Type:** `(name: string) => void`
- **Alias:** `it.todo`

  Use `test.todo` to stub tests to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

  ```ts
  // An entry will be shown in the report for this test
  test.todo("unimplemented test");
  ```

### test.fails

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`
- **Alias:** `it.fails`

  Use `test.fails` to indicate that an assertion will fail explicitly.

  ```ts
  import { test } from 'vitest'
  const myAsyncFunc = () => new Promise((resolve) => resolve(1))
  test.fails("fail test", () => {
    expect(myAsyncFunc()).rejects.toBe(1)
  })
  ```

## describe

When you use `test` in the top level of file, they are collected as part of the implicit suite for it. Using `describe` you can define a new suite in the current context, as a set of related tests and other nested suites. A suite lets you organize your tests so reports are more clear.

  ```ts
  import { describe, test } from 'vitest'

  const person = {
    isActive: true,
    age: 32,
  };

  describe('person', () => {
    test('person is defined', () => {
      expect(person).toBeDefined()
    });

    test('is active', () => {
      expect(person.isActive).toBeTruthy();
    });

    test('age limit', () => {
      expect(person.age).toBeLessThanOrEqual(32);
    });
  });
  ```

  You can also nest describe blocks if you have a hierarchy of tests:

  ```ts
  import { describe, test, expect } from 'vitest'

  const numberToCurrency = (value) => {
    if (typeof value !== 'number') {
        throw new Error(`Value must be a number`);
    }

    return value.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  describe('numberToCurrency', () => {
    describe('given an invalid number', () => {
      test('composed of non-numbers to throw error', () => {
        expect(() => numberToCurrency('abc')).toThrow();
      });
    });

    describe('given a valid number', () => {
      test('returns the correct currency format', () => {
        expect(numberToCurrency(10000)).toBe('10,000.00');
      });
    });
  });
  ```

### describe.skip

- **Type:** `(name: string, fn: TestFunction) => void`

  Use `describe.skip` in a suite to avoid running a particular describe block.

  ```ts
  import { describe, test } from 'vitest'

  describe.skip("skipped suite", () => {
    test("sqrt", () => {
      // Suite skipped, no error
      assert.equal(Math.sqrt(4), 3);
    });
  });
  ```

### describe.only

- **Type:** `(name: string, fn: TestFunction) => void`

  Use `describe.only` to only run certain suites

  ```ts
  // Only this suite (and others marked with only) are run
  describe.only("suite", () => {
    test("sqrt", () => {
      assert.equal(Math.sqrt(4), 3);
    });
  });

  describe('other suite', () => {
    // ... will be skipped
  });
  ```

### describe.concurrent

- **Type:** `(name: string, fn: TestFunction, timeout?: number) => void`

  `describe.concurrent` in a suite marks every tests as concurrent

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

  Use `describe.todo` to stub suites to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

  ```ts
  // An entry will be shown in the report for this suite
  describe.todo("unimplemented suite");
  ```

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

### not

TODO

### toBe

- **Type:** `(value: any) => Awaitable<void>`

  `toBe` can be used to assert if primitives are equal or that objects share the same reference. It is equivalent of calling `expect(Object.is(3, 3)).toBe(true)`. If the objects are not the same, but you want check if their structures are identical, you can use [`toEqual`](#toequal).

  For example, the code below checks if the trader has 13 apples.

  ```ts
  import { test, expect } from 'vitest'

  const stock = {
    type: 'apples',
    count: 13
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
  import { test, expect } from 'vitest'

  test.fails('decimals are not equal in javascript', () => {
    expect(0.2 + 0.1).toBe(0.3); // 0.2 + 0.1 is 0.30000000000000004
  });

  test('decimals are rounded to 5 after the point', () => {
    // 0.2 + 0.1 is 0.30000 | "000000000004" removed
    expect(0.2 + 0.1).toBeCloseTo(0.3, 5);
     // nothing from 0.30000000000000004 is removed
    expect(0.2 + 0.1).not.toBeCloseTo(0.3, 50);
  });
  ```

### toBeDefined

- **Type:** `() => Awaitable<void>`

  `toBeDefined` asserts that the value is not equal to `undefined`. Useful use case would be to check if function _returned_ anything.

  ```ts
  import { test, expect } from 'vitest'

  const getApples = () => 3

  test('function returned something', () => {
    expect(getApples()).toBeDefined()
  })
  ```

### toBeUndefined

- **Type:** `() => Awaitable<void>`

  Opposite of `toBeDefined`, `toBeUndefined` asserts that the value _is_ equal to `undefined`. Useful use case would be to check if function hasn't _returned_ anything.

  ```ts
  import { test, expect } from 'vitest'

  function getApplesFromStock(stock) {
    if(stock === 'Bill') return 13
  }

  test('mary doesnt have a stock', () => {
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
  if(stocks.getInfo('Bill')) {
    stocks.sell('apples', 'Bill')
  }
  ```

  So if you want to test that `stocks.getInfo` will be truthy, you could write:

  ```ts
  import { test, expect } from 'vitest'
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
  if(!stocks.stockFailed('Bill')) {
    stocks.sell('apples', 'Bill')
  }
  ```

  So if you want to test that `stocks.stockFailed` will be falsy, you could write:

  ```ts
  import { test, expect } from 'vitest'
  import { Stocks } from './stocks'
  const stocks = new Stocks()

  test('if Bill stock hasnt failed, sell apples to him', () => {
    stocks.syncStocks('Bill')
    expect(stocks.stockFailed('Bill')).toBeFalsy()
  })
  ```

  Everything in JavaScript is truthy, except `false`, `0`, `''`, `null`, `undefined`, and `NaN`.

### toBeNull

- **Type:** `() => Awaitable<void>`

  `toBeNull` simply asserts if something is `null`. Alias for `.toBe(null)`.

  ```ts
  import { test, expect } from 'vitest'

  function apples() {
    return null
  }

  test('we dont have apples', () => {
    expect(apples()).toBeNull()
  })
  ```

### toBeNaN

- **Type:** `() => Awaitable<void>`

  `toBeNaN` simply asserts if something is `NaN`. Alias for `.toBe(NaN)`.

  ```ts
  import { test, expect } from 'vitest'

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
  import { test, expect } from 'vitest'
  const actual = 'stock'

  test('stock is type of string', () => {
    expect(actual).toBeTypeOf('string')
  })
  ```

### toBeInstanceOf

- **Type:** `(c: any) => Awaitable<void>`

  `toBeInstanceOf` asserts if an actual value is instance of received class.

  ```ts
  import { test, expect } from 'vitest'
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
  import { test, expect } from 'vitest'
  import { getApples } from './stock'

  test('have more then 10 apples', () => {
    expect(getApples()).toBeGreaterThan(10)
  })
  ```

### toBeGreaterThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeGreaterThanOrEqual` asserts if actual value is greater than received one or equal to it.

  ```ts
  import { test, expect } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or more', () => {
    expect(getApples()).toBeGreaterThanOrEqual(11)
  })
  ```

### toBeLessThan

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThan` asserts if actual value is less than received one. Equal values will fail the test.

  ```ts
  import { test, expect } from 'vitest'
  import { getApples } from './stock'

  test('have less then 20 apples', () => {
    expect(getApples()).toBeLessThan(20)
  })
  ```

### toBeLessThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThanOrEqual` asserts if actual value is less than received one or equal to it.

  ```ts
  import { test, expect } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or less', () => {
    expect(getApples()).toBeLessThanOrEqual(11)
  })
  ```

### toEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toEqual` asserts if actual value is equal to received one or has the same structure, if it is an object (compares them recursively). You can see the difference between `toEqual` and [`toBe`](#tobe) in this example:

  ```ts
  import { test, expect } from 'vitest'

  const stockBill = {
    type: 'apples',
    count: 13
  }

  const stockMary = {
    type: 'apples',
    count: 13
  }

  test('stocks have the same properties', () => {
    expect(stockBill).toEqual(stockMary)
  })

  test('stocks are not the same', () => {
    expect(stockBill).not.toBe(stockMary)
  })
  ```

  :::warning
  A _deep equality_ will not be performed for `Error` objects. To test if something was thrown, use [`toThrow`](#tothrow) assertion.
  :::

### toStrictEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toStrictEqual` asserts if actual value is equal to received one or has the same structure, if it is an object (compares them recursively), and of the same type.

  Differences from [`.toEqual`](#toequal):

  -  Keys with `undefined` properties are checked. e.g. `{a: undefined, b: 2}` does not match `{b: 2}` when using `.toStrictEqual`.
  -  Array sparseness is checked. e.g. `[, 1]` does not match `[undefined, 1]` when using `.toStrictEqual`.
  -  Object types are checked to be equal. e.g. A class instance with fields `a` and` b` will not equal a literal object with fields `a` and `b`.

  ```ts
  import { test, expect } from 'vitest'

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
    expect(getAllFruits()).toContain('orange');
  })
  ```

### toContainEqual

- **Type:** `(received: any) => Awaitable<void>`

  `toContainEqual` asserts if an item with a specific structure and values is contained in an array.
  It works like [`toEqual`](#toequal) inside for each element.

  ```ts
  import { test, expect } from 'vitest'
  import { getFruitStock } from './stock'

  test("apple available", () => {
    expect(getFruitStock()).toContainEqual({ fruit: 'apple', count: 5 })
  })
  ```

### toHaveLength

- **Type:** `(received: number) => Awaitable<void>`

  `toHaveLength` asserts if an object has a `.length` property and it is set to a certain numeric value.

  ```ts
  import { test, expect } from 'vitest'

  test('toHaveLength', () => {
    expect('abc').toHaveLength(3);
    expect([1, 2, 3]).toHaveLength(3);

    expect('').not.toHaveLength(3); // doesn't have .length of 3
    expect({ length: 3 }).toHaveLength(3)
  })
  ```

### toHaveProperty

- **Type:** `(key: any, received?: any) => Awaitable<void>`

  `toHaveProperty` asserts if a property at provided reference `key` exists for an object.

  You can provide an optional value argument also known as deep equality, like the `toEqual` matcher to compare the received property value.

  ```ts
  import { test, expect } from 'vitest'

  const invoice = {
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
    ]
  }

  test('John Doe Invoice', () => {
    expect(invoice).toHaveProperty('isActive') // assert that the key exists
    expect(invoice).toHaveProperty('total_amount', 5000) //assert that the key exists and the value is equal

    expect(invoice).not.toHaveProperty('account') //assert that this key does not exist

    // Deep referencing using dot notation
    expect(invoice).toHaveProperty('customer.first_name')
    expect(invoice).toHaveProperty('customer.last_name', 'Doe')
    expect(invoice).not.toHaveProperty('customer.location', 'India')

    // Deep referencing using an array containing the key
    expect(invoice).toHaveProperty('items[0].type', 'apples')
    expect(invoice).toHaveProperty('items.0.type', 'apples') // dot notation also works

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
  import { test, expect } from 'vitest'

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
      }
    ]
  }

  const johnDetails = {
    customer: {
      first_name: 'John',
      last_name: 'Doe',
      location: 'China',
    }
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

  For example, if we want to test that `getFruitStock('pineapples')` throws, because pineapples is not good for people with diabetes, we could write:

  You can provide an optional argument to test that a specific error is thrown:

  - regular expression: error message matches the pattern
  - string: error message includes the substring

  :::tip
    You must wrap the code in a function, otherwise the error will not be caught and the assertion will fail.
  :::

  ```ts
  import { test, expect } from 'vitest'

  function getFruitStock(type) {
    if (type === 'pineapples') {
      throw new DiabetesError('Pineapples is not good for people with diabetes')
    }
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

// snapshots

### toMatchSnapshot
### toMatchInlineSnapshot
### toThrowErrorMatchingSnapshot
### toThrowErrorMatchingInlineSnapshot

### toHaveBeenCalled
### toHaveBeenCalledTimes
### toHaveBeenCalledWith
### toHaveBeenLastCalledWith
### toHaveBeenNthCalledWith
### toHaveReturned
### toHaveReturnedTimes
### toHaveReturnedWith
### toHaveLastReturnedWith
### toHaveNthReturnedWith

### resolves

- **Type:** `Promisify<Assertions>`

  `resolves` is intended to remove boilerplate when asserting asynchronous code. Use it to unwrap value from pending promise and assert its value with usual assertions. If promise rejects, the assertion will fail.

  It returns the same `Assertions` object, but all matchers are now return `Promise`, so you would need to `await` it. Also works with `chai` assertions.

  For example, if you have a function, that makes an API call and returns some data, you may use this code to assert its return value:

  ```ts
  import { test, expect } from 'vitest'

  function buyApples() {
    return fetch('/buy/apples').then(r => r.json())
  }

  test('buyApples returns new stock id', async () => {
    // toEqual returns a promise now, so you HAVE to await it
    await expect(buyApples()).resolves.toEqual({ id: 1 })
  })
  ```

  :::warning
  If the assertion is not awaited, then you will have a false-positive test that will pass every time. To make sure that assertions are actually happened, you may use [`expect.assertions(number)`](#expect-assertions).
  :::

### rejects

- **Type:** `Promisify<Assertions>`

  `rejects` is intended to remove boilerplate when asserting asynchronous code. Use it to unwrap reason why promise was rejected, and assert its value with usual assertions. If promise successfully resolves, the assertion will fail.

  It returns the same `Assertions` object, but all matchers are now return `Promise`, so you would need to `await` it. Also works with `chai` assertions.

  For example, if you have a function that fails when you call it, you may use this code to assert the reason:

  ```ts
  import { test, expect } from 'vitest'

  function buyApples(id) {
    if(!id) {
      throw new Error('no id')
    }
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

  After the test has passed or failed verifies that curtain number of assertions was called during a test. Useful case would be to check if an asynchronous code was called.

  For examples, if we have a function than asynchronously calls two matchers, we can assert that they were actually called.

  ```ts
  import { test, expect } from 'vitest'

  async function doAsync(...cbs) {
    await Promise.all(
      cbs.map((cb, index) => cb({ index }))
    )
  }

  test('all assertions are called', async () => {
    expect.assertions(2);
    function callback1(data) {
      expect(data).toBeTruthy();
    }
    function callback2(data) {
      expect(data).toBeTruthy();
    }

    await doAsync(callback1, callback2);
  })
  ```

### expect.hasAssertions

- **Type:** `(count: number) => void`

  After the test has passed or failed verifies that at least one assertion was called during a test. Useful case would be to check if an asynchronous code was called.

  For example, if you have a code that calls a callback, we can make an assertion inside a callback, but the test will always pass, if we don't check if an assertion was called.

  ```ts
  import { test, expect } from 'vitest'
  import { db } from './db'

  const cbs = []

  function onSelect(cb) {
    cbs.push(cb)
  }

  // after selecting from db, we call all callbacks
  function select(id) {
    return db.select({ id }).then(data => {
      return Promise.all(
        cbs.map(cb => cb(data))
      )
    })
  }

  test('callback was called', async () => {
    expect.hasAssertions()
    onSelect((data) => {
      // should be called on select
      expect(data).toBeTruthy();
    })
    // if not awaited, test will fail
    // if you dont have expect.hasAssertions(), test will pass
    await select(3)
  })
  ```

// asymmetric matchers

### expect.anything
### expect.any
### expect.arrayContaining
### expect.not.arrayContaining
### expect.objectContaining
### expect.not.objectContaining
### expect.stringContaining
### expect.not.stringContaining
### expect.stringMatching
### expect.not.stringMatching

### expect.addSnapshotSerializer
### expect.extend

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

## Vi
Vitest provides utility functions to help you out through it's **vi** helper. You can `import { vi } from 'vitest'` or access it **globally** (when [global configuration](/config/#global) is **enabled**).

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

### vi.clearAllTimers

  Removes all timers that are scheduled to run. These timers will never run in the future.

### vi.fn

- **Type:** `(fn: Function) => CallableMockInstance`

  Creates a spy on a function, though can be initiated without one. Every time a function is invoked, it stores its call arguments, returns and instances. Also, you can manipulate its behavior with [methods](#mockmethods).
  If no function is given, mock will return `undefined`, when invoked.

  ```ts
  const getApples = vi.fn(() => 0)

  getApples()

  expect(getApples).toHaveBeenCalled()
  expect(getApples).toHaveReturnedWith(0)

  getApples.mockReturnOnce(5)

  const res = getApples()
  expect(res).toBe(5)
  expect(getApples).toHaveReturnedNthTimeWith(1, 5)
  ```

### vi.getMockedSystemTime

- **Type**: `() => Date | null`

  Returns mocked current date that was set using `setSystemTime`. If date is not mocked, will return `null`.

### vi.getRealSystemTime

- **Type**: `() => number`

  When using `vi.useFakeTimers`, `Date.now` calls are mocked. If you need to get real time in milliseconds, you can call this function.

### vi.mock

  **Type**: `(path: string, factory?: () => unknown) => void`

  Makes all `imports` to passed module to be mocked. Inside a path you _can_ use configured Vite aliases.

  - If `factory` is defined, will return its result. Factory function can be asynchronous. You may call [`vi.importActual`](#vi-importactual) inside to get the original module. The call to `vi.mock` is hoisted to the top of the file, so you don't have access to variables declared in the global file scope!
  - If `__mocks__` folder with file of the same name exist, all imports will return its exports. For example, `vi.mock('axios')` with `<root>/__mocks__/axios.ts` folder will return everything exported from `axios.ts`.
  - If there is no `__mocks__` folder or a file with the same name inside, will call original module and mock it. (For the rules applied, see [algorithm](/guide/mocking#automocking-algorithm).)

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

### vi.mocked

- **Type**: `<T>(obj: T, deep?: boolean) => MaybeMockedDeep<T>`

  Type helper for TypeScript. In reality just returns the object that was passed.

  ```ts
  import example from './example'
  vi.mock('./example')

  test('1+1 equals 2' async () => {
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

  Imports a module with all of its properties (including nested properties) mocked. Follows the same rules that [`vi.mock`](#mock) follows. For the rules applied, see [algorithm](#automockingalgorithm).

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
  let interval = setInterval(() => {
      console.log(++i)
      if (i === 2) {
          clearInterval(interval)
      }
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
### vi.unmock

**Type**: `(path: string) => void`

  Removes module from mocked registry. All subsequent calls to import will return original module even if it was mocked.

### vi.useFakeTimers

- **Type:** `() => Vitest`

  To enable mocking timers, you need to call this method. It will wrap all further calls to timers (such as `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `nextTick`, `setImmediate`, `clearImmediate`, and `Date`), until [`vi.useRealTimers()`](#userealtimers) is called.

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

  Clears all information about every call. After calling it, [`spy.mock.calls`](#mockcalls), [`spy.mock.returns`](#mockreturns) will return empty arrays. It is useful if you need to clean up spy between different assertions.

  If you want this method to be called before each test automatically, you can enable [`clearMocks`](/config/#clearMocks) setting in config.


### mockName

- **Type:** `(name: string) => MockInstance`

  Sets internal mock name. Useful to see what mock has failed the assertion.

### mockImplementation

- **Type:** `(fn: Function) => MockInstance`

  Accepts a function that will be used as an implementation of the mock.

  For example:

  ```ts
  const mockFn = vi.fn().mockImplementation(apples => apples + 1);
  // or: vi.fn(apples => apples + 1);

  const NelliesBucket = mockFn(0);
  const BobsBucket = mockFn(1);

  NelliesBucket === 1; // true
  BobsBucket === 2; // true

  mockFn.mock.calls[0][0] === 0; // true
  mockFn.mock.calls[1][0] === 1; // true
  ```

### mockImplementationOnce

- **Type:** `(fn: Function) => MockInstance`

  Accepts a function that will be used as an implementation of the mock for one call to the mocked function. Can be chained so that multiple function calls produce different results.

  ```ts
  const myMockFn = vi
    .fn()
    .mockImplementationOnce(() => true)
    .mockImplementationOnce(() => false);

  myMockFn(); // true
  myMockFn(); // false
  ```

  When the mocked function runs out of implementations, it will invoke the default implementation that was set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called:

  ```ts
  const myMockFn = vi
    .fn(() => 'default')
    .mockImplementationOnce(() => 'first call')
    .mockImplementationOnce(() => 'second call');

  // 'first call', 'second call', 'default', 'default'
  console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
  ```

### mockRejectedValue

- **Type:** `(value: any) => MockInstance`

  Accepts an error that will be rejected, when async function will be called.

  ```ts
  test('async test', async () => {
    const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'));

    await asyncMock(); // throws "Async error"
  });
  ```

### mockRejectedValueOnce

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be rejected for one call to the mock function. If chained, every consecutive call will reject passed value.

  ```ts
  test('async test', async () => {
    const asyncMock = vi
      .fn()
      .mockResolvedValueOnce('first call')
      .mockRejectedValueOnce(new Error('Async error'));

    await asyncMock(); // first call
    await asyncMock(); // throws "Async error"
  });
  ```

### mockReset

- **Type:** `() => MockInstance`

  Does what `mockClear` does and makes inner implementation as an empty function (returning `undefined`, when invoked). This is useful when you want to completely reset a mock back to its initial state.

  If you want this method to be called before each test automatically, you can enable [`mockReset`](/config/#mockReset) setting in config.

### mockRestore

- **Type:** `() => MockInstance`

  Does what `mockRestore` does and restores inner implementation to the original function.

  Note that restoring mock from `vi.fn()` will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.

  If you want this method to be called before each test automatically, you can enable [`restoreMocks`](/config/#restoreMocks) setting in config.

### mockResolvedValue

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be resolved, when async function will be called.

  ```ts
  test('async test', async () => {
    const asyncMock = vi.fn().mockResolvedValue(43);

    await asyncMock(); // 43
  });
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
      .mockResolvedValueOnce('second call');

    await asyncMock(); // first call
    await asyncMock(); // second call
    await asyncMock(); // default
    await asyncMock(); // default
  });
  ```

### mockReturnThis

- **Type:** `() => MockInstance`

  Sets inner implementation to return `this` context.

### mockReturnValue

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be returned whenever the mock function is called.

  ```ts
  const mock = vi.fn();
  mock.mockReturnValue(42);
  mock(); // 42
  mock.mockReturnValue(43);
  mock(); // 43
  ```

### mockReturnValueOnce

- **Type:** `(value: any) => MockInstance`

  Accepts a value that will be returned whenever mock function is invoked. If chained, every consecutive call will return passed value. When there are no more `mockReturnValueOnce` values to use, calls a function specified by `mockImplementation` or other `mockReturn*` methods.

  ```ts
  const myMockFn = vi
    .fn()
    .mockReturnValue('default')
    .mockReturnValueOnce('first call')
    .mockReturnValueOnce('second call');

  // 'first call', 'second call', 'default', 'default'
  console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
  ```

## MockInstance Properties

### mock.calls

This is an array containing all arguments for each call. One item of the array is arguments of that call.

If a function was invoked twice with the following arguments `fn(arg1, arg2)`, `fn(arg3, arg4)` in that order, then `mock.calls` will be:

```js
[
  ['arg1', 'arg2'],
  ['arg3', 'arg4'],
];
```

### mock.results

This is an array containing all values, that were `returned` from function. One item of the array is an object with properties `type` and `value`. Available types are:

- `'return'` - function returned without throwing.
- `'throw'` - function threw a value.

The `value` property contains returned value or thrown error.

If function returned `'result1`, then threw and error, then `mock.results` will be:

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
];
```

### mock.instances

Currently, this property is not implemented.
