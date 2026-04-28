import type { RunVitestConfig } from '#test-utils'
import { runInlineTests } from '#test-utils'
import { describe, expect, test } from 'vitest'

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
