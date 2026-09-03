import { existsSync, rmSync } from 'node:fs'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import * as testUtils from '#test-utils'

const mathTs = /* ts */ `
export function sum(a: number, b: number) {
  return a + b
}
`

const mathTestTs = /* ts */ `
import { expect, test } from 'vitest'

import { sum } from './math'

test('sum', () => {
  expect(sum(1, 2)).toBe(3)
})
`

const exampleTs = /* ts */ `
export function getHelloWorld() {
  return 'Hello world'
}
`

const exampleTestTs = /* ts */ `
import { expect, test } from 'vitest'

import { getHelloWorld } from './example'

test('getHello', async () => {
  expect(getHelloWorld()).toBe('Hello world')
})
`

// two test files, so the initial run reports "2 passed" and a "1 passed" wait
// can only be satisfied by a rerun of a single affected file
const baseFixture = {
  'math.ts': mathTs,
  'math.test.ts': mathTestTs,
  'example.ts': exampleTs,
  'example.test.ts': exampleTestTs,
}

function modifyContent(fileContent: string) {
  return `// Modified by file-watching.test.ts
${fileContent}
console.log("New code running"); // This is used to check that edited changes are actually run, and cached files are not run instead
  `
}

test('editing source file triggers re-run', async () => {
  const { vitest, fs } = await testUtils.runInlineTests(baseFixture, { watch: true })

  fs.editFile('math.ts', modifyContent)

  await vitest.waitForStdout('New code running')
  await vitest.waitForStdout('RERUN  ../math.ts')
  await vitest.waitForStdout('1 passed')
})

test('editing file that was imported with a query reruns suite', async () => {
  const { vitest, fs } = await testUtils.runInlineTests({
    ...baseFixture,
    '42.txt': '42\n',
    'answer.test.ts': /* ts */ `
import { expect, test } from 'vitest'

// @ts-expect-error not typed txt
import answer from './42.txt?raw'

test('answer is 42', () => {
  expect(answer).toContain('42')
})
`,
  }, { watch: true })

  fs.editFile('42.txt', file => `${file}\n`)

  await vitest.waitForStdout('RERUN  ../42.txt')
  await vitest.waitForStdout('1 passed')
})

test('editing force rerun trigger reruns all tests', async () => {
  const { vitest, fs } = await testUtils.runInlineTests({
    ...baseFixture,
    '.project/force-watch/trigger.js': 'export const trigger = false\n',
    'vitest.config.ts': /* ts */ `
export default {
  test: {
    forceRerunTriggers: ['**/force-watch/**'],
  },
}
`,
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes...')
  vitest.resetOutput()

  fs.editFile('.project/force-watch/trigger.js', modifyContent)

  await vitest.waitForStdout('RERUN  ../.project/force-watch/trigger.js')
  await vitest.waitForStdout('example.test.ts')
  await vitest.waitForStdout('math.test.ts')
  await vitest.waitForStdout('2 passed')
})

test('editing test file triggers re-run', async () => {
  const { vitest, fs } = await testUtils.runInlineTests(baseFixture, { watch: true })

  fs.editFile('math.test.ts', modifyContent)

  await vitest.waitForStdout('New code running')
  await vitest.waitForStdout('RERUN  ../math.test.ts')
  await vitest.waitForStdout('1 passed')
})

test('editing config file triggers re-run', async () => {
  const { vitest, fs } = await testUtils.runInlineTests({
    ...baseFixture,
    'vitest.config.ts': /* ts */ `
export default {
  test: {
    reporters: 'verbose',
  },
}
`,
  }, { watch: true, reporters: 'none' })

  await vitest.waitForStdout('Waiting for file changes...')
  vitest.resetOutput()

  fs.editFile('vitest.config.ts', modifyContent)

  await vitest.waitForStdout('Restarting due to config changes')
  await vitest.waitForStdout('2 passed')
})

test('editing config file reloads new changes', async () => {
  const { vitest, fs } = await testUtils.runInlineTests({
    ...baseFixture,
    'vitest.config.ts': /* ts */ `
export default {
  test: {
    reporters: 'verbose',
  },
}
`,
  }, { watch: true, reporters: 'none' })

  fs.editFile('vitest.config.ts', content => content.replace('reporters: \'verbose\'', 'reporters: \'tap\''))

  await vitest.waitForStdout('TAP version')
  await vitest.waitForStdout('ok 2')
})

test('adding a new test file triggers re-run', async () => {
  const { vitest, fs } = await testUtils.runInlineTests({
    'base.test.js': /* js */`test("base test", () => {})`,
  }, { watch: true, globals: true })

  await vitest.waitForStdout('press h to show help')

  const testFileContent = `
import { expect, test } from "vitest";

test("dynamic test case", () => {
  console.log("Running added dynamic test")
  expect(true).toBeTruthy()
})
`

  fs.createFile('new-dynamic.test.ts', testFileContent)

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  ../new-dynamic.test.ts')
  await vitest.waitForStdout('1 passed')
})

test('renaming an existing test file', { retry: 3 }, async () => {
  const { vitest, ctx, fs } = await testUtils.runInlineTests({
    'before.test.js': /* js */`
      import { expect, test } from "vitest";

      test("test case", () => {
        console.log("Running existing test")
        expect(true).toBeTruthy()
      })
    `,
  }, { watch: true })

  await vitest.waitForStdout('Running existing test')
  await vitest.waitForStdout('press h to show help')

  const fileAdded = new Promise<void>((resolve) => {
    ctx!.vite.watcher.on('add', () => {
      resolve()
    })
  })

  fs.renameFile('before.test.js', 'after.test.js')

  await vitest.waitForStdout('Test removed')
  await vitest.waitForStdout('Waiting for file changes...')
  await fileAdded

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
  const { vitest, fs, root } = await testUtils.runInlineTests(baseFixture, {
    watch: true,
    reporters: ['verbose', 'junit'],
    outputFile: './test-results/junit.xml',
  })

  const report = resolve(root, 'test-results/junit.xml')

  // Test report should be generated on initial test run
  expect(existsSync(report)).toBe(true)

  // Test report should be re-generated on second test run
  rmSync(report)
  expect(existsSync(report)).toBe(false)

  vitest.resetOutput()
  fs.editFile('math.ts', modifyContent)

  await vitest.waitForStdout('JUNIT report written')
  expect(existsSync(report)).toBe(true)
})

describe('browser', () => {
  test.runIf((process.platform !== 'win32'))('editing source file triggers re-run', { retry: 3 }, async () => {
    const { vitest, fs } = await testUtils.runInlineTests(baseFixture, {
      watch: true,
      browser: {
        instances: [{ browser: 'chromium' }],
        provider: playwright(),
        enabled: true,
        headless: true,
      },
    })

    fs.editFile('math.ts', modifyContent)

    await vitest.waitForStdout('New code running')
    await vitest.waitForStdout('RERUN  ../math.ts')
    await vitest.waitForStdout('1 passed')

    vitest.write('q')
  })
})
