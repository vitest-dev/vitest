import path from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const resolve = (id = '') => path.resolve(__dirname, '../fixtures/default', id)
async function run(fileFilter: string[], watch = false, ...args: string[]) {
  return runVitestCli(
    ...fileFilter,
    '--root',
    resolve(),
    watch ? '--watch' : '--run',
    ...args,
  )
}

describe('default reporter', async () => {
  test('normal', async () => {
    const { stdout } = await run(['b1.test.ts', 'b2.test.ts'])
    expect(stdout).contain('✓ b2 test')
    expect(stdout).not.contain('✓ nested b1 test')
    expect(stdout).contain('× b failed test')
  })

  test('show full test suite when only one file', async () => {
    const { stdout } = await run(['a.test.ts'])
    expect(stdout).contain('✓ a1 test')
    expect(stdout).contain('✓ nested a3 test')
    expect(stdout).contain('× a failed test')
    expect(stdout).contain('nested a failed 1 test')
  })

  test('rerun should undo', async () => {
    const vitest = await run([], true, '-t', 'passed')

    // one file
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('a\n')
    await vitest.waitForStdout('Filename pattern: a')
    await vitest.waitForStdout('Waiting for file changes')
    expect(vitest.stdout).contain('✓ a1 test')
    expect(vitest.stdout).contain('✓ nested a3 test')

    // rerun and two files
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('b\n')
    await vitest.waitForStdout('Waiting for file changes')
    await vitest.waitForStdout('Filename pattern: b')
    await vitest.waitForStdout('b1.test.ts')
    expect(vitest.stdout).toContain('RERUN')
    expect(vitest.stdout).toContain('b1.test.ts')
    expect(vitest.stdout).toContain('b2.test.ts')
    expect(vitest.stdout).not.toContain('nested b1 test')
    expect(vitest.stdout).not.toContain('b1 test')
    expect(vitest.stdout).not.toContain('b2 test')
  })
}, 120000)
