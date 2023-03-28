import { readFileSync, writeFileSync } from 'fs'
import { afterEach, test } from 'vitest'

import { startWatchMode } from './utils'

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

afterEach(() => {
  writeFileSync(testFile, testFileContent, 'utf8')
})

test('console.log is visible on test re-run', async () => {
  const vitest = await startWatchMode()
  const testCase = `
test('test with logging', () => {
  console.log('First')
  console.log('Second')
  console.log('Third')
  expect(true).toBe(true)
})
`

  writeFileSync(testFile, `${testFileContent}${testCase}`, 'utf8')

  await vitest.waitForOutput('stdout | math.test.ts > test with logging')
  await vitest.waitForOutput('First')
  await vitest.waitForOutput('Second')
  await vitest.waitForOutput('Third')
})
