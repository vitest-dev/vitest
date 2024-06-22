import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

const FILE_TO_CHANGE = resolve('./fixtures/src/file-to-change.ts')
const NEW_UNCOVERED_FILE = resolve('./fixtures/src/new-uncovered-file.ts')

beforeAll(() => {
  let content = readFileSync(FILE_TO_CHANGE, 'utf8')
  content = content.replace('This file will be modified by test cases', 'Changed!')
  writeFileSync(FILE_TO_CHANGE, content, 'utf8')

  writeFileSync(NEW_UNCOVERED_FILE, `
  // This file is not covered by any tests but should be picked by --changed
  export default function helloworld() {
    return 'Hello world'
  }
  `.trim(), 'utf8')
})

afterAll(() => {
  let content = readFileSync(FILE_TO_CHANGE, 'utf8')
  content = content.replace('Changed!', 'This file will be modified by test cases')
  writeFileSync(FILE_TO_CHANGE, content, 'utf8')
  rmSync(NEW_UNCOVERED_FILE)
})

test('{ changed: "HEAD" }', async () => {
  await runVitest({
    include: ['fixtures/test/**'],
    changed: 'HEAD',
    coverage: {
      include: ['fixtures/src/**'],
      reporter: 'json',
      all: true,
    },
  })

  const coverageMap = await readCoverageMap()

  // Note that this test may fail if you have new files in "vitest/test/coverage/src"
  // and have not yet committed those
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/file-to-change.ts",
      "<process-cwd>/fixtures/src/new-uncovered-file.ts",
    ]
  `)

  const uncoveredFile = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/new-uncovered-file.ts').toSummary()
  expect(uncoveredFile.lines.pct).toBe(0)

  const changedFile = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/file-to-change.ts').toSummary()
  expect(changedFile.lines.pct).toBeGreaterThanOrEqual(50)
}, !!process.env.ECOSYSTEM_CI)
