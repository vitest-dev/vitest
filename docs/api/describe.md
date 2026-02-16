---
outline: deep
---

# describe

- **Alias:** `suite`

```ts
function describe(
  name: string | Function,
  body?: () => unknown,
  timeout?: number
): void
function describe(
  name: string | Function,
  options: SuiteOptions,
  body?: () => unknown,
): void
```

`describe` is used to group related tests and benchmarks into a suite. Suites help organize your test files by creating logical blocks, making test output easier to read and enabling shared setup/teardown through [lifecycle hooks](/api/hooks).

When you use `test` in the top level of file, they are collected as part of the implicit suite for it. Using `describe` you can define a new suite in the current context, as a set of related tests or benchmarks and other nested suites.

```ts [basic.spec.ts]
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

You can also nest `describe` blocks if you have a hierarchy of tests:

```ts
import { describe, expect, test } from 'vitest'

function numberToCurrency(value: number | string) {
  if (typeof value !== 'number') {
    throw new TypeError('Value must be a number')
  }

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

## Test Options

You can use [test options](/api/test#test-options) to apply configuration to every test inside a suite, including nested suites. This is useful when you want to set timeouts, retries, or other options for a group of related tests.

```ts
import { describe, test } from 'vitest'

describe('slow tests', { timeout: 10_000 }, () => {
  test('test 1', () => { /* ... */ })
  test('test 2', () => { /* ... */ })

  // nested suites also inherit the timeout
  describe('nested', () => {
    test('test 3', () => { /* ... */ })
  })
})
```

### `shuffle`

- **Type:** `boolean`
- **Default:** `false` (configured by [`sequence.shuffle`](/config/sequence#sequence-shuffle))
- **Alias:** [`describe.shuffle`](#describe-shuffle)

Run tests within the suite in random order. This option is inherited by nested suites.

```ts
import { describe, test } from 'vitest'

describe('randomized tests', { shuffle: true }, () => {
  test('test 1', () => { /* ... */ })
  test('test 2', () => { /* ... */ })
  test('test 3', () => { /* ... */ })
})
```

## describe.skip

- **Alias:** `suite.skip`

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

## describe.skipIf

- **Alias:** `suite.skipIf`

In some cases, you might run suites multiple times with different environments, and some of the suites might be environment-specific. Instead of wrapping the suite with `if`, you can use `describe.skipIf` to skip the suite whenever the condition is truthy.

```ts
import { describe, test } from 'vitest'

const isDev = process.env.NODE_ENV === 'development'

describe.skipIf(isDev)('prod only test suite', () => {
  // this test suite only runs in production
})
```

## describe.runIf

- **Alias:** `suite.runIf`

Opposite of [describe.skipIf](#describe-skipif).

```ts
import { assert, describe, test } from 'vitest'

const isDev = process.env.NODE_ENV === 'development'

describe.runIf(isDev)('dev only test suite', () => {
  // this test suite only runs in development
})
```

## describe.only

- **Alias:** `suite.only`

Use `describe.only` to only run certain suites

```ts
import { assert, describe, test } from 'vitest'

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

In order to do that, run `vitest` with specific file containing the tests in question:

```shell
vitest interesting.test.ts
```

## describe.concurrent

- **Alias:** `suite.concurrent`

`describe.concurrent` runs all inner suites and tests in parallel

```ts
import { describe, test } from 'vitest'

// All suites and tests within this suite will be run in parallel
describe.concurrent('suite', () => {
  test('concurrent test 1', async () => { /* ... */ })
  describe('concurrent suite 2', async () => {
    test('concurrent test inner 1', async () => { /* ... */ })
    test('concurrent test inner 2', async () => { /* ... */ })
  })
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

When running concurrent tests, Snapshots and Assertions must use `expect` from the local [Test Context](/guide/test-context) to ensure the right test is detected.

```ts
describe.concurrent('suite', () => {
  test('concurrent test 1', async ({ expect }) => {
    expect(foo).toMatchSnapshot()
  })
  test('concurrent test 2', async ({ expect }) => {
    expect(foo).toMatchSnapshot()
  })
})
```

## describe.sequential

- **Alias:** `suite.sequential`

`describe.sequential` in a suite marks every test as sequential. This is useful if you want to run tests in sequence within `describe.concurrent` or with the `--sequence.concurrent` command option.

```ts
import { describe, test } from 'vitest'

describe.concurrent('suite', () => {
  test('concurrent test 1', async () => { /* ... */ })
  test('concurrent test 2', async () => { /* ... */ })

  describe.sequential('', () => {
    test('sequential test 1', async () => { /* ... */ })
    test('sequential test 2', async () => { /* ... */ })
  })
})
```

## describe.shuffle

- **Alias:** `suite.shuffle`

Vitest provides a way to run all tests in random order via CLI flag [`--sequence.shuffle`](/guide/cli) or config option [`sequence.shuffle`](/config/sequence#sequence-shuffle), but if you want to have only part of your test suite to run tests in random order, you can mark it with this flag.

```ts
import { describe, test } from 'vitest'

// or describe('suite', { shuffle: true }, ...)
describe.shuffle('suite', () => {
  test('random test 1', async () => { /* ... */ })
  test('random test 2', async () => { /* ... */ })
  test('random test 3', async () => { /* ... */ })

  // `shuffle` is inherited
  describe('still random', () => {
    test('random 4.1', async () => { /* ... */ })
    test('random 4.2', async () => { /* ... */ })
  })

  // disable shuffle inside
  describe('not random', { shuffle: false }, () => {
    test('in order 5.1', async () => { /* ... */ })
    test('in order 5.2', async () => { /* ... */ })
  })
})
// order depends on sequence.seed option in config (Date.now() by default)
```

`.skip`, `.only`, and `.todo` works with random suites.

## describe.todo

- **Alias:** `suite.todo`

Use `describe.todo` to stub suites to be implemented later. An entry will be shown in the report for the tests so you know how many tests you still need to implement.

```ts
// An entry will be shown in the report for this suite
describe.todo('unimplemented suite')
```

## describe.each

- **Alias:** `suite.each`

::: tip
While `describe.each` is provided for Jest compatibility,
Vitest also has [`describe.for`](#describe-for) which simplifies argument types and aligns with [`test.for`](/api/test#test-for).
:::

Use `describe.each` if you have more than one test that depends on the same data.

```ts
import { describe, expect, test } from 'vitest'

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

* First row should be column names, separated by `|`;
* One or more subsequent rows of data supplied as template literal expressions using `${value}` syntax.

```ts
import { describe, expect, test } from 'vitest'

describe.each`
  a               | b      | expected
  ${1}            | ${1}   | ${2}
  ${'a'}          | ${'b'} | ${'ab'}
  ${[]}           | ${'b'} | ${'b'}
  ${{}}           | ${'b'} | ${'[object Object]b'}
  ${{ asd: 1 }}   | ${'b'} | ${'[object Object]b'}
`('describe template string add($a, $b)', ({ a, b, expected }) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })
})
```

## describe.for

- **Alias:** `suite.for`

The difference from `describe.each` is how array case is provided in the arguments.
Other non array case (including template string usage) works exactly same.

```ts
// `each` spreads array case
describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', (a, b, expected) => { // [!code --]
  test('test', () => {
    expect(a + b).toBe(expected)
  })
})

// `for` doesn't spread array case
describe.for([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', ([a, b, expected]) => { // [!code ++]
  test('test', () => {
    expect(a + b).toBe(expected)
  })
})
```
