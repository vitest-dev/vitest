import { readFileSync, writeFileSync } from 'fs'
import { afterEach, describe, expect, test } from 'vitest'

import { startWatchMode, waitFor } from './utils'

const sourceFile = 'fixtures/math.ts'
const sourceFileContent = readFileSync(sourceFile, 'utf-8')

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

const configFile = 'fixtures/vitest.config.ts'
const configFileContent = readFileSync(configFile, 'utf-8')

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
})

test('editing source file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toContain('New code running')
    expect(vitest.getOutput()).toContain('RERUN  math.ts')
    expect(vitest.getOutput()).toContain('1 passed')
  })
})

test('editing test file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(testFile, editFile(testFileContent), 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toContain('New code running')
    expect(vitest.getOutput()).toMatch('RERUN  math.test.ts')
    expect(vitest.getOutput()).toMatch('1 passed')
  })
})

test('editing config file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(configFile, editFile(configFileContent), 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toContain('New code running')
    expect(vitest.getOutput()).toMatch('Restarting due to config changes')
    expect(vitest.getOutput()).toMatch('2 passed')
  })
})

test('editing config file reloads new changes', async () => {
  const vitest = await startWatchMode()

  writeFileSync(configFile, configFileContent.replace('reporters: \'verbose\'', 'reporters: \'tap\''), 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('TAP version')
    expect(vitest.getOutput()).toMatch('ok 2')
  })
})

describe('browser', () => {
  test('editing source file triggers re-run', async () => {
    const vitest = await startWatchMode('--browser.enabled', '--browser.headless', '--browser.name=chrome')

    writeFileSync(sourceFile, editFile(sourceFileContent), 'utf8')

    await waitFor(() => {
      expect(vitest.getOutput()).toContain('New code running')
      expect(vitest.getOutput()).toContain('RERUN  math.ts')
      expect(vitest.getOutput()).toContain('1 passed')
    })

    vitest.write('q')
  })
})
