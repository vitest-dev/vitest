import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, test } from 'vitest'

import * as testUtils from '../../test-utils'

const sourceFile = 'fixtures/math.ts'
const sourceFileContent = readFileSync(sourceFile, 'utf-8')

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

const configFile = 'fixtures/vitest.config.ts'
const configFileContent = readFileSync(configFile, 'utf-8')

const forceTriggerFile = 'fixtures/force-watch/trigger.js'
const forceTriggerFileContent = readFileSync(forceTriggerFile, 'utf-8')

const options = { root: 'fixtures', watch: true }
const cleanups: (() => void)[] = []

function editFile(fileContent: string) {
  return `// Modified by file-watching.test.ts
${fileContent}
console.log("New code running"); // This is used to check that edited changes are actually run, and cached files are not run instead
  `
}

afterEach(() => {
  writeFileSync(sourceFile, sourceFileContent, 'utf8')
  writeFileSync(testFile, testFileContent, 'utf8')
  writeFileSync(configFile, configFileContent, 'utf8')
  writeFileSync(forceTriggerFile, forceTriggerFileContent, 'utf8')
  cleanups.splice(0).forEach(cleanup => cleanup())
})

// TODO: Fix flakiness and enable on CI
if (process.env.GITHUB_ACTIONS) {
  test.only('skip tests on CI', () => {})
}

test('editing source file triggers re-run', async () => {
  const { vitest } = await testUtils.runVitest(options)

  writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

  await vitest.waitForStdout('New code running')
  await vitest.waitForStdout('RERUN  ../math.ts')
  await vitest.waitForStdout('1 passed')
})

test('editing file that was imported with a query reruns suite', async () => {
  const { vitest } = await testUtils.runVitest(options)

  testUtils.editFile(
    testUtils.resolvePath(import.meta.url, '../fixtures/42.txt'),
    file => `${file}\n`,
  )

  await vitest.waitForStdout('RERUN  ../42.txt')
  await vitest.waitForStdout('1 passed')
})

test('editing force rerun trigger reruns all tests', async () => {
  const { vitest } = await testUtils.runVitest(options)

  writeFileSync(forceTriggerFile, editFile(forceTriggerFileContent), 'utf8')

  await vitest.waitForStdout('Waiting for file changes...')
  await vitest.waitForStdout('RERUN  ../force-watch/trigger.js')
  await vitest.waitForStdout('example.test.ts')
  await vitest.waitForStdout('math.test.ts')
  await vitest.waitForStdout('2 passed')
})

test('editing test file triggers re-run', async () => {
  const { vitest } = await testUtils.runVitest(options)

  writeFileSync(testFile, editFile(testFileContent), 'utf8')

  await vitest.waitForStdout('New code running')
  await vitest.waitForStdout('RERUN  ../math.test.ts')
  await vitest.waitForStdout('1 passed')
})

test('editing config file triggers re-run', async () => {
  const { vitest } = await testUtils.runVitest(options)

  writeFileSync(configFile, editFile(configFileContent), 'utf8')

  await vitest.waitForStdout('Restarting due to config changes')
  await vitest.waitForStdout('2 passed')
})

test('editing config file reloads new changes', async () => {
  const { vitest } = await testUtils.runVitest({ ...options, reporters: 'none' })

  writeFileSync(configFile, configFileContent.replace('reporters: \'verbose\'', 'reporters: \'tap\''), 'utf8')

  await vitest.waitForStdout('TAP version')
  await vitest.waitForStdout('ok 2')
})

test('adding a new test file triggers re-run', async () => {
  const { vitest } = await testUtils.runVitest(options)

  const testFile = 'fixtures/new-dynamic.test.ts'
  const testFileContent = `
import { expect, test } from "vitest";

test("dynamic test case", () => {
  console.log("Running added dynamic test")
  expect(true).toBeTruthy()
})
`
  cleanups.push(() => rmSync(testFile))
  writeFileSync(testFile, testFileContent, 'utf-8')

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  ../new-dynamic.test.ts')
  await vitest.waitForStdout('1 passed')
})

test('renaming an existing test file', async () => {
  cleanups.push(() => rmSync('fixtures/after.test.ts'))
  const beforeFile = 'fixtures/before.test.ts'
  const afterFile = 'fixtures/after.test.ts'
  const textContent = `
import { expect, test } from "vitest";

test("test case", () => {
  console.log("Running existing test")
  expect(true).toBeTruthy()
})
`
  writeFileSync(beforeFile, textContent, 'utf-8')
  const { vitest } = await testUtils.runVitest({ root: 'fixtures', watch: true })
  await vitest.waitForStdout('Running existing test')

  renameSync(beforeFile, afterFile)
  await vitest.waitForStdout('Test removed')
  await vitest.waitForStdout('Waiting for file changes...')

  vitest.write('p')
  await vitest.waitForStdout('Input filename pattern')
  vitest.write('before')
  await vitest.waitForStdout('Pattern matches no results')
  vitest.write('\n')
  await vitest.waitForStdout('No test files found')
  await vitest.waitForStdout('Waiting for file changes...')
  vitest.write('p')
  await vitest.waitForStdout('Input filename pattern')
  vitest.write('after')
  await vitest.waitForStdout('Pattern matches 1 result')
  vitest.write('\n')
  await vitest.waitForStdout('Filename pattern: after')
  await vitest.waitForStdout('1 passed')
})

test('editing source file generates new test report to file system', async () => {
  const report = 'fixtures/test-results/junit.xml'
  if (existsSync(report)) {
    rmSync(report)
  }

  // Test report should not be present before test run
  expect(existsSync(report)).toBe(false)

  const { vitest } = await testUtils.runVitest({
    ...options,
    reporters: ['verbose', 'junit'],
    outputFile: './test-results/junit.xml',
  },
  )

  // Test report should be generated on initial test run
  expect(existsSync(report)).toBe(true)

  // Test report should be re-generated on second test run
  rmSync(report)
  expect(existsSync(report)).toBe(false)

  vitest.resetOutput()
  writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

  await vitest.waitForStdout('JUNIT report written')
  await vitest.waitForStdout(report)
  expect(existsSync(report)).toBe(true)
})

describe('browser', () => {
  test.runIf((process.platform !== 'win32'))('editing source file triggers re-run', { retry: 3 }, async () => {
    const { vitest } = await testUtils.runVitest({
      ...options,
      browser: {
        instances: [{ browser: 'chromium' }],
        provider: 'webdriverio',
        enabled: true,
        headless: true,
      },
    })

    writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

    await vitest.waitForStdout('New code running')
    await vitest.waitForStdout('RERUN  ../math.ts')
    await vitest.waitForStdout('1 passed')

    vitest.write('q')
  })
})
