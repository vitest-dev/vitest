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

    vitest.resetOutput()

    // one file
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('a\n')
    await vitest.waitForStdout('Filename pattern: a')
    await vitest.waitForStdout('Waiting for file changes...')
    expect(vitest.stdout).contain('✓ a1 test')
    expect(vitest.stdout).contain('✓ nested a3 test')

    // rerun and two files
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('\bb\n') // backspace to clear first filter
    await vitest.waitForStdout('Waiting for file changes...')
    expect(vitest.stdout).toContain('✓ b1.test.ts')
    expect(vitest.stdout).toContain('✓ b2.test.ts')
    expect(vitest.stdout).not.toContain('✓ nested b1 test')
    expect(vitest.stdout).not.toContain('✓ b1 test')
    expect(vitest.stdout).not.toContain('✓ b2 test')
  })

  test('autocomplete', async () => {
    const vitest = await run([], true, '-t', 'passed')
    vitest.resetOutput()

    // show all when no filter
    vitest.write('p')
    expect(await getAutocomplete(vitest)).toEqual(['a.test.ts', 'b1.test.ts', 'b2.test.ts'])

    // filter "a"
    vitest.write('a')
    expect(await getAutocomplete(vitest)).toEqual(['a.test.ts'])

    // run test
    vitest.resetOutput()
    vitest.write('\n')
    await vitest.waitForStdout('Waiting for file changes...')

    // last filter "a" is preserved
    vitest.write('p')
    expect(await getAutocomplete(vitest)).toEqual(['a.test.ts'])

    // filter "b"
    vitest.write('\bb')
    expect(await getAutocomplete(vitest)).toEqual(['b1.test.ts', 'b2.test.ts'])
  })
}, 120000)

async function getAutocomplete(vitest: { stdout: string }) {
  await waitForStableOutput(vitest)

  // get entries after the last prompt
  const last = vitest.stdout.split(/.*Input filename pattern.*/).at(-1) ?? ''
  return last.trim().split('\n').map(line => line.split('/').at(-1) ?? '')
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// TOOD: to test-utils?
async function waitForStableOutput(vitest: { stdout: string }) {
  let last = vitest.stdout
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    if (last === vitest.stdout)
      return

    last = vitest.stdout
  }
  throw new Error('waitForStableOutput')
}
