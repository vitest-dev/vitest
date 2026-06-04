---
title: Test Filtering | Guide
---

# Test Filtering

As your test suite grows, running every test on every change becomes slow and distracting. If you're fixing a bug in a single module, you don't need to wait for hundreds of unrelated tests to finish. Test filtering lets you narrow down which tests run so you can stay focused on the code you're actively working on.

Vitest offers several ways to filter tests: from the command line, inside your test files, and through tags. Each approach is useful in different situations.

::: tip Performance Note
Filters like `-t`, `--tags-filter`, `.only`, and `.skip` are applied *per test file* — Vitest still has to run each test file to discover which tests match. In a large project, this overhead adds up even if only a few tests actually execute.

To avoid this, always pass a file path alongside your filter so Vitest only loads the files you care about:

```bash
vitest utils.test.ts -t "handles empty input"
```

Alternatively, you can use the [`--experimental.preParse`](/config/experimental#experimental-preparse) flag, which parses test files to discover test names without fully executing them:

```bash
vitest --experimental.preParse -t "handles empty input"
```
:::

## Filtering by File Name

The simplest way to run a subset of tests is to pass a filename pattern as a CLI argument. Vitest will only run test files whose path contains the given string:

```bash
vitest basic
```

This matches any test file with `basic` in its path:

```
basic.test.ts
basic-foo.test.ts
basic/foo.test.ts
```

This is useful when you know which file you need to work on and want to skip everything else.

## Filtering by Test Name

Sometimes the test you care about is buried in a file with many other tests. The `-t` (or `--testNamePattern`) option filters by the test's name rather than the filename. It accepts a regex pattern and matches against the full test name, which includes any `describe` block names:

```bash
vitest -t "handles empty input"
```

You can combine this with a file filter to narrow things down further:

```bash
vitest utils -t "handles empty input"
```

This runs only tests whose name matches `"handles empty input"` inside files matching `utils`.

## Filtering by Line Number

When you're looking at a specific test in your editor, you often just want to run *that one test*. You can point directly to a line number:

```bash
vitest basic/foo.test.ts:10
```

Vitest will run the test that contains line 10. This requires the full filename (relative or absolute):

```bash
vitest basic/foo.test.ts:10 # ✅
vitest ./basic/foo.test.ts:10 # ✅
vitest /users/project/basic/foo.test.ts:10 # ✅
vitest foo:10 # ❌ partial name won't work
vitest ./basic/foo:10 # ❌ missing file extension
```

To run multiple specific tests, separate them with spaces:

```bash
vitest basic/foo.test.ts:10 basic/foo.test.ts:25 # ✅
vitest basic/foo.test.ts:10-25 # ❌ ranges are not supported
```

## Filtering by Tags

For larger projects, you may want to categorize tests and run them by category. [Tags](/guide/test-tags) let you label tests and then filter by those labels from the CLI:

```ts
test('renders a form', { tags: ['frontend'] }, () => {
  // ...
})

test('calls an external API', { tags: ['backend'] }, () => {
  // ...
})
```

```bash
vitest --tags-filter=frontend
```

This is particularly helpful in CI pipelines where you might want to run frontend and backend tests in separate jobs, or skip slow integration tests during quick checks.

## Focusing on Specific Tests with `.only`

When you're debugging a failing test, you want to run just that test without modifying CLI arguments every time. Adding `.only` to a test or suite tells Vitest to skip everything else in the file:

```ts
import { describe, expect, it } from 'vitest'

describe.only('suite', () => {
  it('test', () => {
    // This runs because the suite is marked with .only
    expect(Math.sqrt(4)).toBe(2)
  })
})

describe('another suite', () => {
  it('skipped test', () => {
    // This does not run
    expect(Math.sqrt(4)).toBe(2)
  })

  it.only('focused test', () => {
    // This also runs because it is marked with .only
    expect(Math.sqrt(4)).toBe(2)
  })
})
```

You can use `.only` on both `describe` blocks and individual tests. When any test or suite in a file is marked with `.only`, all unmarked tests in that file are skipped.

::: warning
Remember to remove `.only` before committing. By default, Vitest will fail the entire test run if it encounters `.only` in CI (when `process.env.CI` is set), preventing you from accidentally skipping tests in your pipeline. This behavior is controlled by the [`allowOnly`](/config/allowonly) option.

To catch `.only` even earlier, the [`no-focused-tests`](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-focused-tests.md) ESLint rule (also available in [oxlint](https://oxc.rs/docs/guide/usage/linter/rules/jest/no-focused-tests.html)) can flag it in your editor before you commit.
:::

## Skipping Tests with `.skip`

The opposite of `.only` is `.skip`. Use it to temporarily disable a test or suite without deleting it. Skipped tests still show up in the report so you don't forget about them:

```ts
import { describe, expect, it } from 'vitest'

describe.skip('skipped suite', () => {
  it('test', () => {
    // This entire suite is skipped
    expect(Math.sqrt(4)).toBe(2)
  })
})

describe('suite', () => {
  it.skip('skipped test', () => {
    // Just this one test is skipped
    expect(Math.sqrt(4)).toBe(2)
  })
})
```

This is useful when a test is flaky or depends on an external service that's temporarily down. It lets you keep the test in place as a reminder while unblocking the rest of the suite.

## Placeholder Tests with `.todo`

When planning new features, you might know what tests you'll need before you write the actual implementation. `.todo` marks a test as planned but not yet written. It shows up in the report as a reminder:

```ts
import { describe, it } from 'vitest'

describe.todo('unimplemented suite')

describe('suite', () => {
  it.todo('unimplemented test')
})
```

Unlike `.skip`, a `.todo` test has no test body. It's purely a placeholder for future work.
