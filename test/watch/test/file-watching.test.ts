import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, describe, test } from 'vitest'

import { startWatchMode } from './utils'

const sourceFile = 'fixtures/math.ts'
const sourceFileContent = readFileSync(sourceFile, 'utf-8')

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

const configFile = 'fixtures/vitest.config.ts'
const configFileContent = readFileSync(configFile, 'utf-8')

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
  cleanups.splice(0).forEach(cleanup => cleanup())
})

test('editing source file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

  await vitest.waitForOutput('New code running')
  await vitest.waitForOutput('RERUN  ../math.ts')
  await vitest.waitForOutput('1 passed')
})

test('editing test file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(testFile, editFile(testFileContent), 'utf8')

  await vitest.waitForOutput('New code running')
  await vitest.waitForOutput('RERUN  ../math.test.ts')
  await vitest.waitForOutput('1 passed')
})

test('editing config file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(configFile, editFile(configFileContent), 'utf8')

  await vitest.waitForOutput('New code running')
  await vitest.waitForOutput('Restarting due to config changes')
  await vitest.waitForOutput('2 passed')
})

test('editing config file reloads new changes', async () => {
  const vitest = await startWatchMode()

  writeFileSync(configFile, configFileContent.replace('reporters: \'verbose\'', 'reporters: \'tap\''), 'utf8')

  await vitest.waitForOutput('TAP version')
  await vitest.waitForOutput('ok 2')
})

test('adding a new test file triggers re-run', async () => {
  const vitest = await startWatchMode()

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

  await vitest.waitForOutput('Running added dynamic test')
  await vitest.waitForOutput('RERUN  ../new-dynamic.test.ts')
  await vitest.waitForOutput('1 passed')
})

describe('browser', () => {
  test.runIf((process.platform !== 'win32'))('editing source file triggers re-run', async () => {
    const vitest = await startWatchMode('--browser.enabled', '--browser.headless', '--browser.name=chrome')

    writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

    await vitest.waitForOutput('New code running')
    await vitest.waitForOutput('RERUN  ../math.ts')
    await vitest.waitForOutput('1 passed')

    vitest.write('q')
  })
})
