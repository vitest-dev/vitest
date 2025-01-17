import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

// TODO run only in Node >23
// TODO: add a test with a loader
test.runIf(process.version.split('.')[0] === '23')('can run custom pools with Vitest', async () => {
  const { stderr, stdout } = await runVitest({
    root: './fixtures/native',
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('global setup')
  expect(stdout).toContain('global teardown')
  expect(stdout).toContain('✓ test/basic.test.ts')
})
