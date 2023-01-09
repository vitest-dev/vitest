import { promises as fs } from 'fs'
import { afterEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'

const run = async () => await execa('vitest', ['run', '--changed', '--config', 'setup.vitest.config.ts'])

describe('setup files with forceRerunTrigger', () => {
  const file = './setupFiles/empty-setup.ts'

  afterEach(async () => {
    await fs.writeFile(file, '', 'utf-8')
  })

  it('should run no tests if setup files are not changed', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  }, 60_000)

  it('should run the whole test suite if setup files are changed', async () => {
    const codes = 'export const a = 1'
    await fs.writeFile(file, codes, 'utf-8')
    const { stdout } = await run()
    expect(stdout).toContain('1 passed')
  }, 60_000)
})
