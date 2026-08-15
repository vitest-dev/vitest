import type { RunVitestConfig } from '#test-utils'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

describe('dangerouslyIgnoreUnhandledErrors', () => {
  test('{ dangerouslyIgnoreUnhandledErrors: true }', async () => {
    const { stderr, exitCode } = await runUnhandledTest({
      dangerouslyIgnoreUnhandledErrors: true,
    })

    expect(exitCode).toBe(0)
    expect(stderr).toMatch('Vitest caught 1 unhandled error during the test run')
    expect(stderr).toMatch('Error: intentional unhandled error')
  })

  test('{ dangerouslyIgnoreUnhandledErrors: true } without reporter', async () => {
    const { exitCode } = await runUnhandledTest({
      dangerouslyIgnoreUnhandledErrors: true,
      reporters: [{ onInit: () => {} }],
    })

    expect(exitCode).toBe(0)
  })

  test('{ dangerouslyIgnoreUnhandledErrors: false }', async () => {
    const { stderr, exitCode } = await runUnhandledTest({
      dangerouslyIgnoreUnhandledErrors: false,
    })

    expect(exitCode).toBe(1)
    expect(stderr).toMatch('Vitest caught 1 unhandled error during the test run')
    expect(stderr).toMatch('Error: intentional unhandled error')
  })

  function runUnhandledTest(config: RunVitestConfig) {
    return runInlineTests({
      'throw-errors.test.js': /* js */`
        import { test } from "vitest"

        test("Some test", () => {
          //
        })

        new Promise((_, reject) => reject(new Error("intentional unhandled error")))
      `,
    }, config, { fails: true })
  }
})

test('unhandled rejections of main thread are reported even when no reporter is used', async () => {
  const { stderr, exitCode } = await runInlineTests({
    'setup-unhandled-rejections.js': /* ts */`
      export function setup() {
        void new Promise((_, reject) => reject(new Error('intentional unhandled rejection')))
      }
    `,
    'example.test.js': '', // won't run
  }, {
    config: false,
    globalSetup: ['setup-unhandled-rejections.js'],
    reporters: [{ onInit: () => {} }],
  }, { fails: true })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Unhandled Rejection')
  expect(stderr).toContain('Error: intentional unhandled rejection')
  expect(stderr).toContain('setup-unhandled-rejections.js:3:48')
})

// Node never fires `unhandledRejection` and `rejectionHandled` for the same promise, so
// these tests simulate an eager-reporting runtime (e.g. workerd) by emitting them by hand.
describe('rejectionHandled', () => {
  test('retracted rejection is not reported', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'retracted.test.js': /* js */`
        import { test } from "vitest"

        test("passes", () => {
          const promise = Promise.resolve()
          process.emit('unhandledRejection', new Error('handled late'), promise)
          process.emit('rejectionHandled', promise)
        })
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('Unhandled Rejection')
  })

  test('retracting in one worker keeps another worker\'s rejection', async () => {
    // Rejection ids are worker-local counters, so two concurrent workers both report
    // id 0. The sleeps interleave them deliberately: "retracts" reports first, "keeps"
    // reports the same id while that is still pending, then "retracts" retracts. If the
    // ids were not scoped per worker, the retraction would drop the surviving error.
    // `runInlineTests` defaults to `maxWorkers: 1`, so both worker options are required
    // for the two files to overlap at all. A scheduler slow enough to miss the window
    // makes this pass without exercising the overlap, but never fail spuriously.
    const { stderr, exitCode } = await runInlineTests({
      'retracts.test.js': /* js */`
        import { test } from "vitest"

        test("retracts its own rejection", async () => {
          const promise = Promise.resolve()
          process.emit('unhandledRejection', new Error('retracted rejection'), promise)
          await new Promise(resolve => setTimeout(resolve, 1000))
          process.emit('rejectionHandled', promise)
        })
      `,
      'keeps.test.js': /* js */`
        import { test } from "vitest"

        test("leaves its rejection unhandled", async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          process.emit('unhandledRejection', new Error('surviving rejection'), Promise.resolve())
        })
      `,
    }, {
      isolate: true,
      fileParallelism: true,
      minWorkers: 2,
      maxWorkers: 2,
    }, { fails: true })

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Error: surviving rejection')
    expect(stderr).not.toContain('Error: retracted rejection')
    expect(stderr).toContain('Vitest caught 1 unhandled error during the test run')
  })

  test('retracts a rejection with a primitive reason', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'primitive.test.js': /* js */`
        import { test } from "vitest"

        test("passes", () => {
          const promise = Promise.resolve()
          process.emit('unhandledRejection', 'a string reason', promise)
          process.emit('rejectionHandled', promise)
        })
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('a string reason')
  })

  test('reporting does not depend on globals that tests can stub', async () => {
    // The error catcher must not reach for globals like `crypto` at report time:
    // a test is free to replace them, and throwing inside the `unhandledRejection`
    // handler would escalate to an uncaught exception.
    const { stderr, exitCode } = await runInlineTests({
      'stubbed.test.js': /* js */`
        import { test, vi } from "vitest"

        test("stubs globals then leaves a rejection unhandled", () => {
          vi.stubGlobal('crypto', { subtle: {} })
          process.emit('unhandledRejection', new Error('still reported'), Promise.resolve())
        })
      `,
    }, {}, { fails: true })

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Error: still reported')
    expect(stderr).not.toContain('is not a function')
  })
})
