import { rmSync, writeFileSync } from 'node:fs'
import { afterEach, expect, test } from 'vitest'

import { startWatchMode } from './utils'

const cleanups: (() => void)[] = []

afterEach(() => {
  cleanups.splice(0).forEach(fn => fn())
})

test('quit watch mode', async () => {
  const vitest = await startWatchMode()

  vitest.write('q')

  await vitest.isDone
})

test('rerun current pattern tests', async () => {
  const vitest = await startWatchMode('-t', 'sum')

  vitest.write('r')

  await vitest.waitForOutput('Test name pattern: /sum/')
  await vitest.waitForOutput('1 passed')
})

test('filter by filename', async () => {
  const vitest = await startWatchMode()

  vitest.write('p')

  await vitest.waitForOutput('Input filename pattern')

  vitest.write('math\n')

  await vitest.waitForOutput('Filename pattern: math')
  await vitest.waitForOutput('1 passed')
})

test('filter by test name', async () => {
  const vitest = await startWatchMode()

  vitest.write('t')

  await vitest.waitForOutput('Input test name pattern')

  vitest.write('sum\n')

  await vitest.waitForOutput('Test name pattern: /sum/')
  await vitest.waitForOutput('1 passed')
})

test('cancel test run', async () => {
  const vitest = await startWatchMode()

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
  await vitest.waitForOutput('[cancel-test]: test')
  vitest.write('c')

  // Test hooks should still be called
  await vitest.waitForOutput('CANCELLED')
  await vitest.waitForOutput('[cancel-test]: afterAll')
  await vitest.waitForOutput('[cancel-test]: afterEach')

  expect(vitest.output).not.include('[cancel-test]: should not run')
})
