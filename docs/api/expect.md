# Expect API

The following types are used in the type signatures:

```ts
type Awaitable<T> = T | PromiseLike<T>
type TestFunction = () => Awaitable<void>
```

`expect` is used to create assertions. In this context `assertions` are functions that can be called to assert a statement. Vitest provides `chai` assertions by default and also `Jest` compatible assertions build on top of `chai`.

For example, this code asserts that an `input` value is equal to `2`. If it's not, assertion will throw an error, and the test will fail.

```ts
import { expect, test } from 'vitest'

test('basic test', () => {
  const input = Math.sqrt(4)

  expect(input).to.equal(2) // chai API
  expect(input).toBe(2) // jest API
})
```

`expect` can also be used statically to access matchers functions, described later, and more.

## not

- **Type**: `Assertion`

  Using `not` will negate the assertion. For example, this code asserts that an `input` value is not equal to `2`. If it's equal, assertion will throw an error, and the test will fail.

  ```ts
  import { expect, test } from 'vitest'

  test('basic test', () => {
    const input = Math.sqrt(16)

    expect(input).not.to.equal(2) // chai API
    expect(input).not.toBe(2) // jest API
  })
  ```

## toBe

- **Type:** `(value: any) => Awaitable<void>`

  `toBe` can be used to assert if primitives are equal or that objects share the same reference. It is equivalent of calling `expect(Object.is(3, 3)).toBe(true)`. If the objects are not the same, but you want check if their structures are identical, you can use [`toEqual`](#toequal).

  For example, the code below checks if trader has 13 apples.

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

## toBeCloseTo

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

## toBeDefined

- **Type:** `() => Awaitable<void>`

  `toBeDefined` asserts that the value is not equal to `undefined`. Useful use case would be to check if function _returned_ anything.

  ```ts
  import { expect, test } from 'vitest'

  const getApples = () => 3

  test('function returned something', () => {
    expect(getApples()).toBeDefined()
  })
  ```

## toBeUndefined

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

## toBeTruthy

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

## toBeFalsy

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

  test('if Bill stock hasnt failed, sell apples to him', () => {
    stocks.syncStocks('Bill')
    expect(stocks.stockFailed('Bill')).toBeFalsy()
  })
  ```

  Everything in JavaScript is truthy, except `false`, `0`, `''`, `null`, `undefined`, and `NaN`.

## toBeNull

- **Type:** `() => Awaitable<void>`

  `toBeNull` simply asserts if something is `null`. Alias for `.toBe(null)`.

  ```ts
  import { expect, test } from 'vitest'

  function apples() {
    return null
  }

  test('we dont have apples', () => {
    expect(apples()).toBeNull()
  })
  ```

## toBeNaN

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

## toBeTypeOf

- **Type:** `(c: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined') => Awaitable<void>`

  `toBeTypeOf` asserts if an actual value is of type of received type.

  ```ts
  import { expect, test } from 'vitest'
  const actual = 'stock'

  test('stock is type of string', () => {
    expect(actual).toBeTypeOf('string')
  })
  ```

## toBeInstanceOf

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

## toBeGreaterThan

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeGreaterThan` asserts if actual value is greater than received one. Equal values will fail the test.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have more then 10 apples', () => {
    expect(getApples()).toBeGreaterThan(10)
  })
  ```

## toBeGreaterThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeGreaterThanOrEqual` asserts if actual value is greater than received one or equal to it.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or more', () => {
    expect(getApples()).toBeGreaterThanOrEqual(11)
  })
  ```

## toBeLessThan

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThan` asserts if actual value is less than received one. Equal values will fail the test.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have less then 20 apples', () => {
    expect(getApples()).toBeLessThan(20)
  })
  ```

## toBeLessThanOrEqual

- **Type:** `(n: number | bigint) => Awaitable<void>`

  `toBeLessThanOrEqual` asserts if actual value is less than received one or equal to it.

  ```ts
  import { expect, test } from 'vitest'
  import { getApples } from './stock'

  test('have 11 apples or less', () => {
    expect(getApples()).toBeLessThanOrEqual(11)
  })
  ```

## toEqual

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
  A _deep equality_ will not be performed for `Error` objects. To test if something was thrown, use [`toThrow`](#tothrow) assertion.
  :::

## toStrictEqual

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

## toContain

- **Type:** `(received: string) => Awaitable<void>`

  `toContain` asserts if actual value is in an array. `toContain` can also check whether a string is a substring of another string.

  ```ts
  import { expect, test } from 'vitest'
  import { getAllFruits } from './stock'

  test('the fruit list contains orange', () => {
    expect(getAllFruits()).toContain('orange')
  })
  ```

## toContainEqual

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

## toHaveLength

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

## toHaveProperty

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

## toMatch

- **Type:** `(received: string | regexp) => Awaitable<void>`

  `toMatch` asserts if a string matches a regular expression or a string.

  ```ts
  import { expect, test } from 'vitest'

  test('top fruits', () => {
    expect('top fruits include apple, orange and grape').toMatch(/apple/)
    expect('applefruits').toMatch('fruit') // toMatch also accepts a string
  })
  ```

## toMatchObject

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

## toThrowError

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

## toMatchSnapshot

- **Type:** `(hint?: string) => void`

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

## toMatchInlineSnapshot

- **Type:** `(snapshot?: string) => void`

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


## toThrowErrorMatchingSnapshot

- **Type:** `(snapshot?: string) => void`

  The same as [`toMatchSnapshot`](#tomatchsnapshot), but expects the same value as [`toThrowError`](#tothrowerror).

  If the function throws an `Error`, the snapshot will be the error message. Otherwise, snapshot will be the value thrown by the function.

## toThrowErrorMatchingInlineSnapshot

- **Type:** `(snapshot?: string) => void`

  The same as [`toMatchInlineSnapshot`](#tomatchinlinesnapshot), but expects the same value as [`toThrowError`](#tothrowerror).

  If the function throws an `Error`, the snapshot will be the error message. Otherwise, snapshot will be the value thrown by the function.

## toHaveBeenCalled

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

## toHaveBeenCalledTimes

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

## toHaveBeenCalledWith

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

## toHaveBeenLastCalledWith

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

## toHaveBeenNthCalledWith

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

## toHaveReturned

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

## toHaveReturnedTimes

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

## toHaveReturnedWith

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

## toHaveLastReturnedWith

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

## toHaveNthReturnedWith

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

## toSatisfy

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
  <!-- toSatisfy -->

## resolves

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

## rejects

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

## expect.assertions

- **Type:** `(count: number) => void`

  After the test has passed or failed verifies that curtain number of assertions was called during a test. Useful case would be to check if an asynchronous code was called.

  For examples, if we have a function than asynchronously calls two matchers, we can assert that they were actually called.

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

## expect.hasAssertions

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
    // if you dont have expect.hasAssertions(), test will pass
    await select(3)
  })
  ```

<!-- ## expect.anything
## expect.any
## expect.arrayContaining
## expect.not.arrayContaining
## expect.objectContaining
## expect.not.objectContaining
## expect.stringContaining
## expect.not.stringContaining
## expect.stringMatching
## expect.not.stringMatching -->

## expect.addSnapshotSerializer

- **Type:** `(plugin: PrettyFormatPlugin) => void`

  This method adds custom serializers that are called when creating a snapshot. This is advanced feature - if you want to know more, please read a [guide on custom serializers](/guide/snapshot#custom-serializer).

  If you are adding custom serializers, you should call this method inside [`setupFiles`](/config/#setupfiles). This will affect every snapshot.

  :::tip
  If you previously used Vue CLI with Jest, you might want to install [jest-serializer-vue](https://www.npmjs.com/package/jest-serializer-vue). Otherwise, your snapshots will be wrapped in a string, which cases `"` to be escaped.
  :::

## expect.extend

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
