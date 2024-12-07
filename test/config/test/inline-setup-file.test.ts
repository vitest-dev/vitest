import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('import a generated file', async () => {
  const root = path.resolve(import.meta.dirname, '../fixtures/inline-setup-file')

  const { stderr, exitCode } = await runVitest({ root })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
