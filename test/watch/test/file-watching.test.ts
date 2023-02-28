import { readFileSync, writeFileSync } from 'fs'
import { afterEach, expect, test } from 'vitest'

import { startWatchMode, waitFor } from './utils'

const EDIT_COMMENT = '// Modified by file-watching.test.ts\n\n'

const sourceFile = 'fixtures/math.ts'
const sourceFileContent = readFileSync(sourceFile, 'utf-8')

const testFile = 'fixtures/math.test.ts'
const testFileContent = readFileSync(testFile, 'utf-8')

const configFile = 'fixtures/vitest.config.ts'
const configFileContent = readFileSync(configFile, 'utf-8')

afterEach(() => {
  writeFileSync(sourceFile, sourceFileContent, 'utf8')
  writeFileSync(testFile, testFileContent, 'utf8')
  writeFileSync(configFile, configFileContent, 'utf8')
})

test('editing source file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(sourceFile, `${EDIT_COMMENT}${sourceFileContent}`, 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toContain('RERUN  math.ts')
    expect(vitest.getOutput()).toContain('1 passed')
  })
})

test('editing test file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(testFile, `${EDIT_COMMENT}${testFileContent}`, 'utf8')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('RERUN  math.test.ts')
    expect(vitest.getOutput()).toMatch('1 passed')
  })
})

test('editing config file triggers re-run', async () => {
  const vitest = await startWatchMode()

  writeFileSync(configFile, `${EDIT_COMMENT}${configFileContent}`, 'utf8')

  await waitFor(() => {
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
