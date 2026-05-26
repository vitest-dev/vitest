import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

// v3 backport of
// https://github.com/vitest-dev/vitest/blob/af993b66b4e5ba9498cb658a86a74a2c0416b75e/test/browser/specs/errors.test.ts#L73
test('cannot use fs commands if write is disabled', async () => {
  const root = './fixtures/errors-fs'
  const { stderr } = await runBrowserTests({
    root,
    update: true,
  })

  const errors = stderr.split('\n').filter(line => line.includes('Cannot modify file "/test-file.txt".'))
  expect(errors).toHaveLength(2 * instances.length)

  expect(stderr).toContain(
    `Cannot save snapshot file "${resolve(process.cwd(), root, './__snapshots__/fs-commands.test.ts.snap')}". File writing is disabled because server is exposed to the internet`,
  )
  expect(stderr).toContain(
    `Cannot remove snapshot file "${resolve(process.cwd(), root, './__snapshots__/basic.test.js.snap')}". File writing is disabled because server is exposed to the internet`,
  )
})
