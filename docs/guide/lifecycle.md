---
title: Test Run Lifecycle | Guide
outline: deep
---

# Test Run Lifecycle

Understanding the test run lifecycle is essential for writing effective tests, debugging issues, and optimizing your test suite. This guide explains when and in what order different lifecycle phases occur in Vitest, from initialization to teardown.

## Overview

A typical Vitest test run goes through these main phases:

1. **Initialization** - Configuration loading and project setup
2. **Global Setup** - One-time setup before any tests run
3. **Worker Creation** - Test workers are spawned based on the [pool](/config/pool) configuration
4. **Test File Collection** - Test files are discovered and organized
5. **Test Execution** - Tests run with their hooks and assertions
6. **Reporting** - Results are collected and reported
7. **Global Teardown** - Final cleanup after all tests complete

Phases 4–6 run once for each test file, so across your test suite they will execute multiple times and may also run in parallel across different files when you use more than [1 worker](/config/maxworkers).

## Detailed Lifecycle Phases

### 1. Initialization Phase

When you run `vitest`, the framework first loads your configuration and prepares the test environment.

**What happens:**
- [Command-line](/guide/cli) arguments are parsed
- [Configuration file](/config/) is loaded
- Project structure is validated

This phase can run again if the config file or one of its imports changes.

**Scope:** Main process (before any test workers are created)

### 2. Global Setup Phase

If you have configured [`globalSetup`](/config/globalsetup) files, they run once before any test workers are created.

**What happens:**
- `setup()` functions (or exported `default` function) from global setup files execute sequentially
- Multiple global setup files run in the order they are defined

**Scope:** Main process (separate from test workers)

**Important notes:**
- Global setup runs in a **different global scope** from your tests
- Tests cannot access variables defined in global setup (use [`provide`/`inject`](/config/provide) instead)
- Global setup only runs if there is at least one test queued

```ts [globalSetup.ts]
export function setup(project) {
  // Runs once before all tests
  console.log('Global setup')

  // Share data with tests
  project.provide('apiUrl', 'http://localhost:3000')
}

export function teardown() {
  // Runs once after all tests
  console.log('Global teardown')
}
```

### 3. Worker Creation Phase

After global setup completes, Vitest creates test workers based on your [pool configuration](/config/pool).

**What happens:**
- Workers are spawned according to the `browser.enabled` or `pool` setting (`threads`, `forks`, `vmThreads`, or `vmForks`)
- Each worker gets its own isolated environment (unless [isolation](/config/isolate) is disabled)
- By default, workers are not reused to provide isolation. Workers are reused only if:
  - [isolation](/config/isolate) is disabled
  - OR pool is `vmThreads` or `vmForks` because [VM](https://nodejs.org/api/vm.html) provides enough isolation

**Scope:** Worker processes/threads

### 4. Test File Setup Phase

Before each test file runs, [setup files](/config/setupfiles) are executed.

**What happens:**
- Setup files run in the same process as your tests
- By default, setup files run in **parallel** (configurable via [`sequence.setupFiles`](/config/sequence#sequence-setupfiles))
- Setup files execute before **each test file**
- Any global _state_ or configuration can be initialized here

**Scope:** Worker process (same as your tests)

**Important notes:**
- If [isolation](/config/isolate) is disabled, setup files still rerun before each test file to trigger side effects, but imported modules are cached
- Editing a setup file triggers a rerun of all tests in watch mode

```ts [setupFile.ts]
import { afterEach } from 'vitest'

// Runs before each test file
console.log('Setup file executing')

// Register hooks that apply to all tests
afterEach(() => {
  cleanup()
})
```

### 5. Test Collection and Execution Phase

This is the main phase where your tests actually run.

#### Test File Execution Order

Test files are executed based on your configuration:

- **Sequential by default** within a worker
- Files will run in **parallel** across different workers, configured by [`maxWorkers`](/config/maxworkers)
- Order can be randomized with [`sequence.shuffle`](/config/sequence#sequence-shuffle) or fine-tuned with [`sequence.sequencer`](/config/sequence#sequence-sequencer)
- Long-running tests typically start earlier (based on cache) unless shuffle is enabled

#### Within Each Test File

The execution follows this order:

1. **File-level code** - All code outside `describe` blocks runs immediately
2. **Test collection** - `describe` blocks are processed, and tests are registered as side effects of importing the test file
3. **[`aroundAll`](/api/hooks#aroundall) hooks** - Wrap around all tests in the suite (must call `runSuite()`)
4. **[`beforeAll`](/api/hooks#beforeall) hooks** - Run once before any tests in the suite
5. **For each test:**
   - [`aroundEach`](/api/hooks#aroundeach) hooks wrap around the test (must call `runTest()`)
   - `beforeEach` hooks execute (in order defined, or based on [`sequence.hooks`](/config/sequence#sequence-hooks))
   - Test function executes
   - `afterEach` hooks execute (reverse order by default with `sequence.hooks: 'stack'`)
   - [`onTestFinished`](/api/hooks#ontestfinished) callbacks run (always in reverse order)
   - If test failed: [`onTestFailed`](/api/hooks#ontestfailed) callbacks run
   - Note: if `repeats` or `retry` are set, all of these steps are executed again
6. **[`afterAll`](/api/hooks#afterall) hooks** - Run once after all tests in the suite complete

**Example execution flow:**

```ts
// This runs immediately (collection phase)
console.log('File loaded')

describe('User API', () => {
  // This runs immediately (collection phase)
  console.log('Suite defined')

  aroundAll(async (runSuite) => {
    // Wraps around all tests in this suite
    console.log('aroundAll before')
    await runSuite()
    console.log('aroundAll after')
  })

  beforeAll(() => {
    // Runs once before all tests in this suite
    console.log('beforeAll')
  })

  aroundEach(async (runTest) => {
    // Wraps around each test
    console.log('aroundEach before')
    await runTest()
    console.log('aroundEach after')
  })

  beforeEach(() => {
    // Runs before each test
    console.log('beforeEach')
  })

  test('creates user', () => {
    // Test executes
    console.log('test 1')
  })

  test('updates user', () => {
    // Test executes
    console.log('test 2')
  })

  afterEach(() => {
    // Runs after each test
    console.log('afterEach')
  })

  afterAll(() => {
    // Runs once after all tests in this suite
    console.log('afterAll')
  })
})

// Output:
// File loaded
// Suite defined
// aroundAll before
//   beforeAll
//   aroundEach before
//     beforeEach
//       test 1
//     afterEach
//   aroundEach after
//   aroundEach before
//     beforeEach
//       test 2
//     afterEach
//   aroundEach after
//   afterAll
// aroundAll after
```

#### Nested Suites

When using nested `describe` blocks, hooks follow a hierarchical pattern. The `aroundAll` and `aroundEach` hooks wrap around their respective scopes, with parent hooks wrapping child hooks:

```ts
describe('outer', () => {
  aroundAll(async (runSuite) => {
    console.log('outer aroundAll before')
    await runSuite()
    console.log('outer aroundAll after')
  })

  beforeAll(() => console.log('outer beforeAll'))

  aroundEach(async (runTest) => {
    console.log('outer aroundEach before')
    await runTest()
    console.log('outer aroundEach after')
  })

  beforeEach(() => console.log('outer beforeEach'))

  test('outer test', () => console.log('outer test'))

  describe('inner', () => {
    aroundAll(async (runSuite) => {
      console.log('inner aroundAll before')
      await runSuite()
      console.log('inner aroundAll after')
    })

    beforeAll(() => console.log('inner beforeAll'))

    aroundEach(async (runTest) => {
      console.log('inner aroundEach before')
      await runTest()
      console.log('inner aroundEach after')
    })

    beforeEach(() => console.log('inner beforeEach'))

    test('inner test', () => console.log('inner test'))

    afterEach(() => console.log('inner afterEach'))
    afterAll(() => console.log('inner afterAll'))
  })

  afterEach(() => console.log('outer afterEach'))
  afterAll(() => console.log('outer afterAll'))
})

// Output:
// outer aroundAll before
//   outer beforeAll
//   outer aroundEach before
//     outer beforeEach
//       outer test
//     outer afterEach
//   outer aroundEach after
//   inner aroundAll before
//     inner beforeAll
//     outer aroundEach before
//       inner aroundEach before
//         outer beforeEach
//           inner beforeEach
//             inner test
//           inner afterEach
//         outer afterEach
//       inner aroundEach after
//     outer aroundEach after
//     inner afterAll
//   inner aroundAll after
//   outer afterAll
// outer aroundAll after
```

#### Concurrent Tests

When using `test.concurrent` or [`sequence.concurrent`](/config/sequence#sequence-concurrent):

- Tests within the same file can run in parallel
- Each concurrent test still runs its own `beforeEach` and `afterEach` hooks
- Use [test context](/guide/test-context) for concurrent snapshots: `test.concurrent('name', async ({ expect }) => {})`

### 6. Reporting Phase

Throughout the test run, reporters receive lifecycle events and display results.

**What happens:**
- Reporters receive events as tests progress
- Results are collected and formatted
- Test summaries are generated
- Coverage reports are generated (if enabled)

For detailed information about the reporter lifecycle, see the [Reporters](/api/advanced/reporters) guide.

### 7. Global Teardown Phase

After all tests complete, global teardown functions execute.

**What happens:**
- `teardown()` functions from [`globalSetup`](/config/globalsetup) files run
- Multiple teardown functions run in **reverse order** of their setup
- In watch mode, teardown runs before process exit, not between test reruns

**Scope:** Main process

```ts [globalSetup.ts]
export function teardown() {
  // Clean up global resources
  console.log('Global teardown complete')
}
```

## Lifecycle in Different Scopes

Understanding where code executes is crucial for avoiding common pitfalls:

| Phase | Scope | Access to Test Context | Runs |
|-------|-------|----------------------|------|
| Config File | Main process | ❌ No | Once per Vitest run |
| Global Setup | Main process | ❌ No (use `provide`/`inject`) | Once per Vitest run |
| Setup Files | Worker (same as tests) | ✅ Yes | Before each test file |
| File-level code | Worker | ✅ Yes | Once per test file |
| `aroundAll` | Worker | ✅ Yes | Once per suite (wraps all tests) |
| `beforeAll` / `afterAll` | Worker | ✅ Yes | Once per suite |
| `aroundEach` | Worker | ✅ Yes | Per test (wraps each test) |
| `beforeEach` / `afterEach` | Worker | ✅ Yes | Per test |
| Test function | Worker | ✅ Yes | Once (or more with retries/repeats) |
| Global Teardown | Main process | ❌ No | Once per Vitest run |

## Watch Mode Lifecycle

In watch mode, the lifecycle repeats with some differences:

1. **Initial run** - Full lifecycle as described above
2. **On file change:**
   - New [test run](/api/advanced/reporters#ontestrunstart) starts
   - Only affected test files are re-run
   - [Setup files](/config/setupfiles) run again for those test files
   - [Global setup](/config/globalsetup) does **not** re-run (use [`project.onTestsRerun`](/config/globalsetup#handling-test-reruns) for rerun-specific logic)
3. **On exit:**
   - Global teardown executes
   - Process terminates

## Performance Considerations

Understanding the lifecycle helps optimize test performance:

- **Global setup** is ideal for expensive one-time operations (database seeding, server startup)
- **Setup files** run before each test file - avoid heavy operations here if you have many test files
- **`beforeAll`** is better than `beforeEach` for expensive setup that doesn't need isolation
- **Disabling [isolation](/config/isolate)** improves performance, but setup files still execute before each file
- **[Pool configuration](/config/pool)** affects parallelization and available APIs

For tips on how to improve performance, read the [Improving Performance](/guide/improving-performance) guide.

## Related Documentation

- [Global Setup Configuration](/config/globalsetup)
- [Setup Files Configuration](/config/setupfiles)
- [Test Sequencing Options](/config/sequence)
- [Isolation Configuration](/config/isolate)
- [Pool Configuration](/config/pool)
- [Extending Reporters](/guide/advanced/reporters) - for reporter lifecycle events
- [Test API Reference](/api/hooks) - for hook APIs
