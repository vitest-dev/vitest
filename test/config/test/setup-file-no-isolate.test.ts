import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('re-import setupFiles with no isolate', async () => {
  const root = path.resolve(import.meta.dirname, '../fixtures/setup-file-no-isolate')

  const { stderr, exitCode } = await runVitest({ root })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
