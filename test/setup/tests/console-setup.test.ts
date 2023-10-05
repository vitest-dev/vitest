import { normalize } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

async function run() {
  return await runVitest({
    include: ['tests/fixtures/console.test.ts'],
    setupFiles: ['setupFiles/console-setup.ts'],
  })
}

describe('setup files console', () => {
  test('print stdout and stderr correctly', async () => {
    const { stdout, stderr } = await run()
    const filepath = normalize('setupFiles/console-setup.ts')
    expect(stdout).toContain(`stdout | ${filepath}`)
    expect(stderr).toContain(`stderr | ${filepath}`)
  })
})
