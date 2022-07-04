import { unlink, writeFile } from 'fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'

const run = async () => await execa('vitest', ['run', '--changed', '--config', 'force-rerun.vitest.config.ts'])

const fileName = 'rerun.temp'

describe('forceRerunTrigger', () => {
  beforeEach(async () => {
    unlink(fileName, () => {})
  })

  it('should run the whole test suite if file exists', async () => {
    writeFile(fileName, '', error => console.error(error))
    const { stdout } = await run()
    expect(stdout).toContain('1 passed')
  }, 60_000)

  it('should run no tests if file does not exist', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  }, 60_000)
})
