---
title: Writing Tests | Guide
prev:
  text: Getting Started
  link: /guide/
next:
  text: Using Matchers
  link: /guide/learn/matchers
---

# Writing Tests

In the [Getting Started](/guide/) guide, you installed Vitest and ran your first test. This page dives deeper into how to write and organize tests in Vitest.

## Your First Test

A test verifies that a piece of code produces the expected result. In Vitest, you use the [`test`](/api/test) function to define a test, and [`expect`](/api/expect) to make assertions. Each test has a name (a string describing what it checks) and a function that contains one or more assertions. If any assertion fails, the test fails.

```js
import { expect, test } from 'vitest'

test('Math.sqrt works for perfect squares', () => {
  expect(Math.sqrt(4)).toBe(2)
  expect(Math.sqrt(144)).toBe(12)
  expect(Math.sqrt(0)).toBe(0)
})
```

You might also see tests written with [`it`](/api/test) instead of `test`. They behave identically. `it` is just an alias that some people prefer because it reads more naturally with a descriptive name:

```js
import { expect, it } from 'vitest'

it('should compute square roots', () => {
  expect(Math.sqrt(4)).toBe(2)
})
```

Use whichever you prefer. Both work the same way, and you can mix them freely in a project. If you want to enforce a consistent choice across your codebase, the [`consistent-test-it`](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/consistent-test-it.md) lint rule (also available in [oxlint](https://oxc.rs/docs/guide/usage/linter/rules/jest/consistent-test-it.html)) can help with that.

## Grouping Tests with `describe`

As your test files grow, you'll want to organize related tests together. [`describe`](/api/describe) creates a test suite, which is a named group of tests:

```js
import { describe, expect, it } from 'vitest'

describe('Math.sqrt', () => {
  it('returns the square root of perfect squares', () => {
    expect(Math.sqrt(4)).toBe(2)
    expect(Math.sqrt(9)).toBe(3)
  })

  it('returns NaN for negative numbers', () => {
    expect(Math.sqrt(-1)).toBeNaN()
  })

  it('returns 0 for 0', () => {
    expect(Math.sqrt(0)).toBe(0)
  })
})
```

You can nest `describe` blocks for further organization, but keep nesting shallow. Deeply nested tests are harder to read. A flat list of tests is often enough for simple modules, and `describe` becomes more useful when a file tests multiple functions or methods that each need their own group.

## Test Files

By default, Vitest looks for any file that contains `.test.` or `.spec.` in its name, such as `utils.test.ts`, `app.spec.js`, or `math.test.tsx`. It searches in all subdirectories, so it doesn't matter where you place them.

The exact patterns are:

- `**/*.test.{ts,js,mjs,cjs,tsx,jsx}`
- `**/*.spec.{ts,js,mjs,cjs,tsx,jsx}`

There's no single "right" way to organize your test files. Some teams prefer placing tests right next to the source code they test, while others keep them in a dedicated directory. Vitest will find them either way:

```
src/
  utils.ts
  utils.test.ts       # co-located with the source
  __tests__/
    utils.test.ts      # in a test directory
```

If the default patterns don't work for your project, you can customize which files are included with the [`include`](/config/include) and [`exclude`](/config/exclude) config options.

## Reading Test Output

When you run `vitest` and only a single test file matches, the output is expanded into a tree structure showing `describe` groups and individual tests along with their duration:

```txt
✓ src/utils.test.ts (3 tests) 5ms
  ✓ Math.sqrt 4ms
    ✓ returns the square root of perfect squares 2ms
    ✓ returns NaN for negative numbers 1ms
    ✓ returns 0 for 0 1ms

Test Files  1 passed (1)
     Tests  3 passed (3)
```

When multiple test files run, Vitest collapses each file into a single line to keep the output manageable:

```txt
✓ src/utils.test.ts (3 tests) 5ms
✓ src/math.test.ts (2 tests) 3ms
✓ src/strings.test.ts (4 tests) 7ms

Test Files  3 passed (3)
     Tests  9 passed (9)
```

When a test fails, Vitest shows you exactly what went wrong. You'll see the expected value, the actual value, a diff highlighting the difference, and a code snippet of the surrounding lines with the failing assertion highlighted. It also includes the file and line number so you can jump straight to the source:

```txt
FAIL  src/utils.test.ts > Math.sqrt > returns the square root of perfect squares
AssertionError: expected 3 to be 2

- Expected   2
+ Received   3

  ❯ src/utils.test.ts:5:28
      3|   it('returns the square root of perfect squares', () => {
      4|     expect(Math.sqrt(4)).toBe(2)
      5|     expect(Math.sqrt(9)).toBe(2)
                                  ^
      6|   })
      7|
```

Between the diff and the code snippet, you can usually understand what went wrong without needing to add extra `console.log` statements or open the file yourself.

## Skipping and Focusing Tests

While developing, you'll often want to run only a subset of tests. Vitest provides modifiers for this:

[`.only`](/api/test#only) tells Vitest to run only this test (or suite) and skip everything else in the file. This is useful when you're working on a specific test and don't want to wait for the entire suite to finish:

```js
test.only('focus on this test', () => {
  // only this test runs in the file
})
```

[`.skip`](/api/test#skip) does the opposite. It skips a test without removing it, which is handy when a test is temporarily broken or you want to ignore it while you work on something else:

```js
test.skip('not ready yet', () => {
  // this test is skipped
})
```

[`.todo`](/api/test#todo) lets you mark a placeholder for a test you haven't written yet. Vitest will list it in the output so you won't forget about it:

```js
test.todo('implement validation later')
```

These modifiers are great for quick, local changes while developing. For more permanent ways to filter tests (by filename, line number, or tags), see the [Test Filtering](/guide/filtering) guide.

## Using Global Imports

By default, you import `test`, `expect`, `describe`, and other functions from `vitest` at the top of every test file. If you'd rather use them as globals without importing (similar to how Jest works), you can enable the [`globals`](/config/globals) option in your config:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

With this enabled, you can write tests without the import line:

```js
test('no import needed', () => {
  expect(1 + 1).toBe(2)
})
```

::: tip
If you use TypeScript, add `"types": ["vitest/globals"]` to your `tsconfig.json` `compilerOptions` for proper type support.
:::

## Running Tests

Vitest runs all test files **in parallel** by default, using [child processes](/config/pool). Each test file runs in its own isolated context, so your test files don't share state with each other. This prevents tests in different files from accidentally interfering.

Tests **within** a single file run sequentially by default, which is usually what you want since tests in the same file often share setup code. If your tests are truly independent, you can opt into running them concurrently with [`test.concurrent`](/api/test#concurrent) to speed things up:

```js
test.concurrent('first concurrent test', async () => {
  // runs in parallel with the next test
})

test.concurrent('second concurrent test', async () => {
  // runs in parallel with the previous test
})
```

See the [Parallelism](/guide/parallelism) guide for more details on controlling test execution.
