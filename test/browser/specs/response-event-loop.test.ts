import { expect, test } from 'vitest'
import { runBrowserTests } from './utils'

test('unknown events do not cause infinite response event loop', async () => {
  const { exitCode, testTree } = await runBrowserTests({
    root: './fixtures/response-event-loop',
  })

  expect(exitCode).toBe(0)
  expect(testTree()).toMatchObject({
    'response-guard.test.ts': {
      'response:prefixed event is not processed by tester': 'passed',
    },
  })
})
