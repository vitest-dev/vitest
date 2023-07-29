import { readFileSync, writeFileSync } from 'node:fs'
import { afterEach, test } from 'vitest'

import { runVitestCli } from '../../test-utils'

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

afterEach(() => {
  writeFileSync(testFile, testFileContent, 'utf8')
})

test('console.log is visible on test re-run', async () => {
  const vitest = await runVitestCli('--root', 'fixtures', '--watch')
  vitest.resetOutput()
  const testCase = `
test('test with logging', () => {
  console.log('First')
  console.log('Second')
  console.log('Third')
  expect(true).toBe(true)
})
`

  writeFileSync(testFile, `${testFileContent}${testCase}`, 'utf8')

  await vitest.waitForStdout('stdout | math.test.ts > test with logging')
  await vitest.waitForStdout('First')
  await vitest.waitForStdout('Second')
  await vitest.waitForStdout('Third')
})
