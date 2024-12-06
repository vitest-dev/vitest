import { promises as fs } from 'node:fs'
import { describe, expect, it, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

const [major] = process.version.slice(1).split('.').map(num => Number(num))

test.each(['threads', 'vmThreads'])('%s: print stdout and stderr correctly when called in the setup file', async (pool) => {
  if (major >= 22 && pool === 'vmThreads') {
    return
  }

  const { stdout, stderr } = await runVitest({
    root: 'fixtures/setup-files',
    include: ['empty.test.ts'],
    setupFiles: ['./console-setup.ts'],
    pool,
  })

  const filepath = 'empty.test.ts'
  expect(stdout).toContain(`stdout | ${filepath}`)
  expect(stderr).toContain(`stderr | ${filepath}`)
})

describe('setup files with forceRerunTrigger', () => {
  const file = './fixtures/setup-files/empty-setup.ts'

  async function run() {
    return await runVitest({
      root: 'fixtures/setup-files',
      include: ['empty.test.ts'],
      setupFiles: ['./empty-setup.ts'],
      changed: true,
    })
  }

  // Note that this test will fail locally if you have uncommitted changes
  it.runIf(process.env.GITHUB_ACTIONS && !process.env.ECOSYSTEM_CI)('should run no tests if setup file is not changed', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  })

  it('should run the whole test suite if setup file is changed', async () => {
    const codes = 'export const a = 1'
    editFile(file, () => codes)
    await fs.writeFile(file, codes, 'utf-8')
    const { stdout } = await run()
    expect(stdout).toContain('1 passed')
  })
})
