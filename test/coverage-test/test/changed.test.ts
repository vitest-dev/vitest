import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

// Note that this test may fail if you have new files in "vitest/test/coverage/src"
// and have not yet committed those
const SKIP = !!process.env.ECOSYSTEM_CI || !process.env.GITHUB_ACTIONS

const FILE_TO_CHANGE = resolve('./fixtures/src/file-to-change.ts')
const NEW_UNCOVERED_FILE = resolve('./fixtures/src/new-uncovered-file.ts')

beforeAll(() => {
  const original = readFileSync(FILE_TO_CHANGE, 'utf8')
  const changed = original.replace('This file will be modified by test cases', 'Changed!')
  writeFileSync(FILE_TO_CHANGE, changed, 'utf8')

  writeFileSync(NEW_UNCOVERED_FILE, `
  // This file is not covered by any tests but should be picked by --changed
  export default function helloworld() {
    return 'Hello world'
  }
  `.trim(), 'utf8')

  return function restore() {
    writeFileSync(FILE_TO_CHANGE, original, 'utf8')
    rmSync(NEW_UNCOVERED_FILE)
  }
})

test('{ changed: "HEAD" }', async () => {
  await runVitest({
    include: ['fixtures/test/**'],
    exclude: ['**/custom-1-syntax**'],
    changed: 'HEAD',
    coverage: {
      include: ['fixtures/src/**'],
      reporter: 'json',
      all: true,
    },
  })

  const coverageMap = await readCoverageMap()

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
}, SKIP)
