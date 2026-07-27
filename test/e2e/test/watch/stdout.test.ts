import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { afterEach, test } from 'vitest'
import { restoreFile, runVitest } from '#test-utils'

const testFile = 'fixtures/watch/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')
const testFileStat = statSync(testFile)

afterEach(() => {
  restoreFile(testFile, testFileContent, testFileStat)
})

test('console.log is visible on test re-run', async () => {
  const { vitest } = await runVitest({ root: 'fixtures/watch', watch: true })

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
