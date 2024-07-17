import { describe, expect, it } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

describe.each([
  ['default', true],
  ['default', false],
  ['basic', false],
])('%s reporter with %s tty', (reporter, isTTY) => {
  it('prints previously failed tests on rerun', async () => {
    const { vitest } = await runVitest({
      watch: true,
      fileParallelism: false,
      root: './fixtures/single-failed',
      reporters: [[reporter, { isTTY }]],
    })

    expect(vitest.stderr).toContain('failed.test.ts > fails')
    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')

    vitest.resetOutput()

    editFile('./fixtures/single-failed/basic.test.ts', file => `${file}\n`)

    await vitest.waitForStdout('RERUN  ../../basic.test.ts')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(vitest.stdout).not.toContain('log fail')
    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')
  })

  it('prints tests once if changed test is the same', async () => {
    const { vitest } = await runVitest({
      watch: true,
      fileParallelism: false,
      root: './fixtures/single-failed',
      reporters: [[reporter, { isTTY }]],
    })

    expect(vitest.stderr).toContain('failed.test.ts > fails')
    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')

    vitest.resetOutput()

    editFile('./fixtures/single-failed/failed.test.ts', file => `${file}\n`)

    await vitest.waitForStdout('RERUN  ../../failed.test.ts')
    await vitest.waitForStdout('Watching for file changes...')

    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).not.toContain('1 passed')
  })
})
