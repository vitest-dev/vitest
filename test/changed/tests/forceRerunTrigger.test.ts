import { unlink, writeFile } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

const fileName = 'fixtures/related/rerun.temp'

describe('forceRerunTrigger', () => {
  async function run() {
    return runVitest({
      root: join(process.cwd(), 'fixtures/related'),
      include: ['related.test.ts'],
      forceRerunTriggers: ['**/rerun.temp/**'],
      changed: true,
    })
  }

  beforeEach(async () => {
    unlink(fileName, () => {})
  })

  it('should run the whole test suite if file exists', async () => {
    writeFile(fileName, '', () => {})
    const { stdout, stderr } = await run()
    expect(stderr).toBe('')
    expect(stdout).toContain('1 passed')
    expect(stdout).toContain('related.test.ts')
    expect(stdout).not.toContain('not-related.test.ts')
  })

  it('should run no tests if file does not exist', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('No test files found, exiting with code 0')
  })
})
