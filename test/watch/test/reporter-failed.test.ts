import { describe, expect, it, onTestFinished } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

describe.each(['default', 'basic'])('reporter: %s', (reporter) => {
  it('prints previously failed tests on rerun', async () => {
    const { vitest, ctx } = await runVitest({
      watch: true,
      root: './fixtures/single-failed',
      reporters: [reporter],
    })
    onTestFinished(async () => {
      await ctx?.close()
    })

    expect(vitest.stderr).toContain('failed.test.ts > fails')
    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')

    editFile('./fixtures/single-failed/basic.test.ts', file => `${file}\n`)

    vitest.resetOutput()

    await vitest.waitForStdout('RERUN  ../../basic.test.ts')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')
  })

  it('prints tests once if changed test is the same', async () => {
    const { vitest, ctx } = await runVitest({
      watch: true,
      root: './fixtures/single-failed',
      reporters: [reporter],
    })
    onTestFinished(async () => {
      await ctx?.close()
    })

    expect(vitest.stderr).toContain('failed.test.ts > fails')
    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')

    editFile('./fixtures/single-failed/failed.test.ts', file => `${file}\n`)

    vitest.resetOutput()

    await vitest.waitForStdout('RERUN  ../../failed.test.ts')
    await vitest.waitForStdout('Watching for file changes...')

    expect(vitest.stdout).toContain('❯ failed.test.ts')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).not.toContain('1 passed')
  })
})
