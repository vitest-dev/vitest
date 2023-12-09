import { join } from 'node:path'
import { expect, it } from 'vitest'

import { runVitestCli } from '../../test-utils'

it('related correctly runs only related tests', async () => {
  const { stdout, stderr } = await runVitestCli('related', join(process.cwd(), 'fixtures/related/src/sourceA.ts'), '--root', join(process.cwd(), './fixtures/related'), '--globals', '--no-watch')
  expect(stderr).toBe('')
  expect(stdout).toContain('1 passed')
  expect(stdout).toContain('related.test.ts')
  expect(stdout).not.toContain('not-related.test.ts')
})
