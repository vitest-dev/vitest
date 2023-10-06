import { promises as fs } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

async function run() {
  return await runVitest({
    include: ['tests/empty-setup.test.ts'],
    setupFiles: ['setupFiles/empty-setup.ts'],
    changed: true,
  })
}

describe('setup files with forceRerunTrigger', () => {
  const file = './setupFiles/empty-setup.ts'

  afterEach(async () => {
    await fs.writeFile(file, '', 'utf-8')
  })

  // Note that this test will fail locally if you have uncommitted changes
  it.runIf(process.env.GITHUB_ACTIONS)('should run no tests if setup file is not changed', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  }, 60_000)

  it('should run the whole test suite if setup file is changed', async () => {
    const codes = 'export const a = 1'
    await fs.writeFile(file, codes, 'utf-8')
    const { stdout } = await run()
    expect(stdout).toContain('1 passed')
  }, 60_000)
})
