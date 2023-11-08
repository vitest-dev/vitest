import { rmSync, writeFileSync } from 'node:fs'
import { afterEach, expect, test } from 'vitest'

import * as testUtils from '../../test-utils'

async function runVitestCli(...args: string[]) {
  const vitest = await testUtils.runVitestCli(...args)
  if (args.includes('--watch'))
    vitest.resetOutput()
  return vitest
}

const cliArgs = ['--root', 'fixtures', '--watch']
const cleanups: (() => void)[] = []

afterEach(() => {
  cleanups.splice(0).forEach(fn => fn())
})

// TODO: Fix flakiness and enable on CI
if (process.env.GITHUB_ACTIONS)
  test.only('skip tests on CI', () => {})

test('quit watch mode', async () => {
  const vitest = await runVitestCli(...cliArgs)

  vitest.write('q')

  await vitest.isDone
})

test('rerun current pattern tests', async () => {
  const vitest = await runVitestCli(...cliArgs, '-t', 'sum')

  vitest.write('r')

  await vitest.waitForStdout('Test name pattern: /sum/')
  await vitest.waitForStdout('1 passed')
})

test('filter by filename', async () => {
  const vitest = await runVitestCli(...cliArgs)

  vitest.write('p')

  await vitest.waitForStdout('Input filename pattern')

  vitest.write('math\n')

  await vitest.waitForStdout('Filename pattern: math')
  await vitest.waitForStdout('1 passed')
})

test('filter by test name', async () => {
  const vitest = await runVitestCli(...cliArgs)

  vitest.write('t')

  await vitest.waitForStdout('Input test name pattern')

  vitest.write('sum\n')

  await vitest.waitForStdout('Test name pattern: /sum/')
  await vitest.waitForStdout('1 passed')
})

test('cancel test run', async () => {
  const vitest = await runVitestCli(...cliArgs)

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

  cleanups.push(() => rmSync(testPath))
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
