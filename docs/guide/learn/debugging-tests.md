---
title: Debugging Failing Tests | Guide
prev:
  text: Testing in Practice
  link: /guide/learn/testing-in-practice
next:
  text: Writing Tests with AI
  link: /guide/learn/writing-tests-with-ai
---

# Debugging Failing Tests

This page covers how to investigate test failures in Vitest: reading error output, isolating problems, identifying common causes, and using the available debugging tools.

## Reading the Error

When a test fails, Vitest gives you several pieces of information. Let's look at a real failure and break it down:

<<< ./snippets/debug-output-fail.ansi

There's a lot here, but each part tells you something:

**The header** (`FAIL src/user.test.js > createUser > sets the default role`) tells you which file, describe block, and test failed. This is the full path in the test tree.

**The assertion message** (`expected { ... } to deeply equal { ... }`) tells you what kind of check failed and shows the two values being compared.

**The diff** shows exactly what's different. Lines starting with <code class="diff-add">+</code> are what you actually got, and lines starting with <code class="diff-remove">-</code> are what you expected. In this case, the role was <code class="diff-add">"viewer"</code> but the test expected <code class="diff-remove">"member"</code>.

**The code snippet** shows the exact line and a few surrounding lines, with a caret (`^`) pointing to the failing assertion. You can click the file path in most terminals and IDEs to jump directly there.

At this point, the question is: did the code change (maybe the default role was intentionally updated to `"viewer"`), or is the test wrong? Check the source code for `createUser` to find out. If the default was intentionally changed, update the test. If not, you've found a bug.

## Isolating the Problem

When a test fails and the cause isn't immediately clear, the first step is to isolate it. Run just that one test, without the rest of your suite:

```bash
# Run only the failing test file
vitest src/user.test.js

# Run only tests matching a name pattern
vitest -t "sets the default role"

# Combine both for maximum precision
vitest src/user.test.js -t "sets the default role"
```

You can also add [`.only`](/api/test#only) to the test itself:

```js
test.only('sets the default role', () => {
  // only this test runs in the file
})
```

If the test passes when run alone but fails when run with others, you have a test isolation problem (more on that below). If it fails even when run alone, the issue is in the test itself or the code it's testing.

## Common Causes of Failures

### Shared State Between Tests

This is one of the most common and frustrating issues. A test passes when you run it alone, but fails when the full suite runs. The usual cause is that some other test modifies shared state (a global variable, a module-level cache, a database) and doesn't clean up after itself.

```js
// This is a problem: `users` is shared between tests
const users = []

test('adds a user', () => {
  users.push('Alice')
  expect(users).toEqual(['Alice'])
})

test('starts empty', () => {
  // This fails because 'Alice' is still in the array!
  expect(users).toEqual([])
})
```

The fix is to reset the state before each test with [`beforeEach`](/api/hooks#beforeeach), or better yet, use [`test.extend`](/guide/test-context#extend-test-context) to create fresh state for each test automatically:

```js
const test = baseTest.extend('users', () => [])

test('adds a user', ({ users }) => {
  users.push('Alice')
  expect(users).toEqual(['Alice'])
})

test('starts empty', ({ users }) => {
  // Passes: each test gets its own array
  expect(users).toEqual([])
})
```

### Async Issues

Tests that involve promises can fail intermittently or in confusing ways if the async flow isn't handled correctly. The most common mistake is forgetting an `await`:

```js
// This test always passes, even if fetchUser rejects!
test('fetches user', () => {
  // Missing await: the test finishes before the promise settles
  expect(fetchUser(1)).resolves.toMatchObject({ name: 'Alice' })
})
```

Vitest will usually warn you about unawaited assertions at the end of the test. If you see that warning, add the missing `await`:

```js
test('fetches user', async () => {
  await expect(fetchUser(1)).resolves.toMatchObject({ name: 'Alice' })
})
```

If a test hangs and eventually times out, it usually means a promise never resolves. Check for missing callbacks, unresolved conditions, or deadlocks in the code you're testing.

### Stale Snapshots

If you're using [snapshot tests](/guide/learn/snapshots) and you intentionally changed the output of your code, the existing snapshots will be outdated. The test fails and shows a diff between the old snapshot and the new output.

This is expected. Review the diff to confirm the changes are correct, then update the snapshots by pressing `u` in watch mode or running `vitest -u`.

### Wrong Test Environment

If your code accesses browser APIs like `document` or `window` and you see errors like "document is not defined", your test is running in the Node environment (the default). You can switch to a browser-like environment with the [`environment`](/config/environment) config option, or better yet, use [Browser Mode](/guide/browser/) which runs tests in a real browser.

### Mocks Not Cleaned Up

If a mock from one test leaks into another, you'll get unexpected behavior. For example, a `vi.spyOn` that overrides a method's return value will persist into the next test unless it's restored.

The easiest fix is to enable automatic mock restoration in your config:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    restoreMocks: true,
  },
})
```

This calls [`mockRestore()`](/api/mock#mockrestore) on every mock after each test. See the [Mock Functions](/guide/learn/mock-functions#resetting-mocks) tutorial for more details.

## Debugging Tools

### Console Logging

There's nothing wrong with adding `console.log` to your tests. It's the fastest way to inspect values and understand what's happening:

```js
test('transforms data correctly', () => {
  const input = getData()
  console.log('input:', input)

  const result = transform(input)
  console.log('result:', result)

  expect(result).toMatchObject({ status: 'ok' })
})
```

Vitest displays console output inline with the test results, so you can see which test produced which log.

### Vitest UI

For a visual overview of your test suite, run Vitest with the `--ui` flag:

```bash
vitest --ui
```

This opens a browser-based dashboard where you can see all your tests, their status, and their output. It also includes a module graph that shows how your files are connected, which can help you understand why a change in one file causes failures in another. See the [Vitest UI](/guide/ui) guide for more details.

### VS Code Extension

The [Vitest VS Code extension](https://vitest.dev/vscode) lets you run and debug individual tests directly from your editor. You can click a "play" button next to any test, set breakpoints, and step through code in the VS Code debugger. This is often faster than switching between the terminal and your editor.

### Verbose Output

If the default output isn't showing enough detail, use the verbose reporter:

```bash
vitest --reporter=verbose
```

This shows every test individually (not just the files), which can help spot patterns in which tests pass and which fail.

### Attaching a Debugger

For more complex issues where you need to step through code line by line, you can attach a debugger. See the [Debugging](/guide/debugging) guide for setup instructions for VS Code, IntelliJ, and Chrome DevTools.

## Getting Help

If you're stuck, these resources can help:

- The [Common Errors](/guide/common-errors) page covers specific error messages and their solutions
- [GitHub Issues](https://github.com/vitest-dev/vitest/issues) for searching known bugs and workarounds
- The [Discord community](https://chat.vitest.dev) for real-time help from other Vitest users and maintainers

<style>
.vp-doc code.diff-add {
  color: var(--vp-c-green-2) !important;
}
.vp-doc code.diff-remove {
  color: var(--vp-c-red-2) !important;
}
</style>
