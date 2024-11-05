import { expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

test('{ dangerouslyIgnoreUnhandledErrors: true }', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root: 'fixtures/dangerously-ignore-unhandled-errors',
    dangerouslyIgnoreUnhandledErrors: true,
  })

  expect(exitCode).toBe(0)
  expect(stdout).toMatch('Vitest caught 1 unhandled error during the test run')
  expect(stderr).toMatch('Error: intentional unhandled error')
})

test('{ dangerouslyIgnoreUnhandledErrors: true } without reporter', async () => {
  const { exitCode } = await runVitest({
    root: 'fixtures/dangerously-ignore-unhandled-errors',
    dangerouslyIgnoreUnhandledErrors: true,
    reporters: [{ onInit: () => {} }],
  })

  expect(exitCode).toBe(0)
})

test('{ dangerouslyIgnoreUnhandledErrors: false }', async () => {
  const { stderr, stdout, exitCode } = await runVitest({
    root: 'fixtures/dangerously-ignore-unhandled-errors',
    dangerouslyIgnoreUnhandledErrors: false,
  })

  expect(exitCode).toBe(1)
  expect(stdout).toMatch('Vitest caught 1 unhandled error during the test run')
  expect(stderr).toMatch('Error: intentional unhandled error')
})
