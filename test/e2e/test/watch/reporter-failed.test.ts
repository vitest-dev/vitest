import { runInlineTests } from '#test-utils'
import { describe, expect, it } from 'vitest'

describe.for([
  true,
  false,
])('%s reporter with %s tty', (isTTY) => {
  it('prints previously failed tests on rerun', async () => {
    const { vitest, fs } = await runReporterTests(isTTY)

    expect(vitest.stderr).toContain('failed.test.js > fails')
    expect(vitest.stdout).toContain('❯ failed.test.js')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')

    vitest.resetOutput()

    fs.editFile('./basic.test.js', code => `${code}\n`)

    await vitest.waitForStdout('RERUN  ../basic.test.js')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(vitest.stdout).not.toContain('log fail')
    expect(vitest.stdout).toContain('❯ failed.test.js')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).toContain('1 passed')
  })

  it('prints tests once if changed test is the same', async () => {
    const { vitest, fs } = await runReporterTests(isTTY)

    expect(vitest.stderr).toContain('failed.test.js > fails')
    expect(vitest.stdout).toContain('❯ failed.test.js')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')

    vitest.resetOutput()

    fs.editFile('./failed.test.js', code => `${code}\n`)

    await vitest.waitForStdout('RERUN  ../failed.test.js')
    await vitest.waitForStdout('Watching for file changes...')

    expect(vitest.stdout).toContain('❯ failed.test.js')
    expect(vitest.stdout).toContain('× fails')
    expect(vitest.stdout).toContain('1 failed')
    expect(vitest.stdout).not.toContain('1 passed')
  })
})

async function runReporterTests(isTTY: boolean) {
  return await runInlineTests({
    'basic.test.js': /* js */`
      import { expect, it } from 'vitest';

      it('works correctly', () => {
        console.log('log basic')
        expect(1).toBe(1)
      })
    `,
    'failed.test.js': /* js */`
      import { it } from 'vitest';

      it('fails', () => {
        console.log('log fail')
        throw new Error('failed')
      })
    `,
  }, {
    config: false,
    watch: true,
    fileParallelism: false,
    reporters: [['default', { isTTY }]],
  })
}
