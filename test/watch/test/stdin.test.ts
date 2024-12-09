import { rmSync, writeFileSync } from 'node:fs'
import { describe, expect, onTestFinished, test } from 'vitest'

import { runVitest } from '../../test-utils'

const _options = { root: 'fixtures', watch: true }

describe.each([true, false])('standalone mode is %s', (standalone) => {
  const options = { ..._options, standalone }

  test('quit watch mode', async () => {
    const { vitest, waitForClose } = await runVitest(options)

    vitest.write('q')

    await waitForClose()
  })

  test('filter by filename', async () => {
    const { vitest } = await runVitest(options)

    vitest.write('p')

    await vitest.waitForStdout('Input filename pattern')

    vitest.write('math')

    await vitest.waitForStdout('Pattern matches 1 result')
    await vitest.waitForStdout('› math.test.ts')

    vitest.write('\n')

    await vitest.waitForStdout('Filename pattern: math')
    await vitest.waitForStdout('1 passed')
  })

  test('filter by test name', async () => {
    const { vitest } = await runVitest(options)

    vitest.write('t')

    await vitest.waitForStdout('Input test name pattern')

    vitest.write('sum')
    if (standalone) {
      await vitest.waitForStdout('Pattern matches no results')
    }
    else {
      await vitest.waitForStdout('Pattern matches 1 result')
    }
    await vitest.waitForStdout('› sum')

    vitest.write('\n')

    await vitest.waitForStdout('Test name pattern: /sum/')
    await vitest.waitForStdout('1 passed')
  })

  test.skipIf(process.env.GITHUB_ACTIONS)('cancel test run', async () => {
    const { vitest } = await runVitest(options)

    const testPath = 'fixtures/cancel.test.ts'
    const testCase = `// Dynamic test case
import { afterAll, afterEach, test } from 'vitest'

// These should be called even when test is cancelled
afterAll(() => console.log('[cancel-test]: afterAll'))
afterEach(() => console.log('[cancel-test]: afterEach'))

test('1 - test that finishes', async () => {
  console.log('[cancel-test]: test')

  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('2 - test that is cancelled', async () => {
  console.log('[cancel-test]: should not run')
})
`

    onTestFinished(() => rmSync(testPath))
    writeFileSync(testPath, testCase, 'utf8')

    // Test case is running, cancel it
    await vitest.waitForStdout('[cancel-test]: test')
    vitest.write('c')

    // Test hooks should still be called
    await vitest.waitForStdout('CANCELLED')
    await vitest.waitForStdout('[cancel-test]: afterAll')
    await vitest.waitForStdout('[cancel-test]: afterEach')

    expect(vitest.stdout).not.include('[cancel-test]: should not run')
  })
})

test('rerun current pattern tests', async () => {
  const { vitest } = await runVitest({ ..._options, testNamePattern: 'sum' })

  vitest.write('r')

  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('Test name pattern: /sum/')
  await vitest.waitForStdout('1 passed')
})

test('cli filter as watch filename pattern', async () => {
  const { vitest } = await runVitest(_options, ['math'])

  vitest.write('r')

  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('Filename pattern: math')
  await vitest.waitForStdout('1 passed')
})
