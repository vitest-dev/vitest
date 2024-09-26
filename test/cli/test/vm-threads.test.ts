import { expect, test } from 'vitest'

import { createFile, resolvePath, runVitest } from '../../test-utils'

const [major] = process.version.slice(1).split('.').map(num => Number(num))

test.runIf(major < 22)('importing files in restricted fs works correctly', async () => {
  createFile(
    resolvePath(import.meta.url, '../fixtures/vm-threads/src/external/package-null/package-null.json'),
    'null',
  )

  const { stderr, exitCode } = await runVitest({
    root: './fixtures/vm-threads',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
