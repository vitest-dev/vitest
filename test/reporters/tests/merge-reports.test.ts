import type { File, Test } from '@vitest/runner/types'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { createFileTask } from '@vitest/runner/utils'
import { beforeEach, expect, test } from 'vitest'
import { version } from 'vitest/package.json'
import { writeBlob } from 'vitest/src/node/reporters/blob.js'
import { runVitest } from '../../test-utils'

// always relative to CWD because it's used only from the CLI,
// so we need to correctly resolve it here
const reportsDir = resolve('./fixtures/merge-reports/.vitest-reports')

beforeEach(() => {
  rmSync(reportsDir, { force: true, recursive: true })
})

test('merge reports', async () => {
  await runVitest({
    root: './fixtures/merge-reports',
    include: ['first.test.ts'],
    reporters: [['blob', { outputFile: './.vitest-reports/first-run.json' }]],
  })

  await runVitest({
    root: './fixtures/merge-reports',
    include: ['second.test.ts'],
    reporters: [['blob', { outputFile: './.vitest-reports/second-run.json' }]],
  })

  const { stdout: reporterDefault, stderr: stderrDefault, exitCode } = await runVitest({
    root: './fixtures/merge-reports',
    mergeReports: reportsDir,
    reporters: [['default', { isTTY: false }]],
  })

  expect(exitCode).toBe(1)

  const stdoutCheck = trimReporterOutput(reporterDefault)
  const stderrArr = stderrDefault.split('\n')
  const stderrCheck = [
    ...stderrArr.slice(4, 19),
    ...stderrArr.slice(21, -3),
  ]

  expect(stderrDefault).toMatch('Failed Tests 2')

  expect(stderrCheck.join('\n')).toMatchInlineSnapshot(`
    "AssertionError: expected 1 to be 2 // Object.is equality

    - Expected
    + Received

    - 2
    + 1

     ❯ first.test.ts:15:13
         13| test('test 1-2', () => {
         14|   console.log('test 1-2')
         15|   expect(1).toBe(2)
           |             ^
         16| })
         17| 

     FAIL  second.test.ts > test 2-1
    AssertionError: expected 1 to be 2 // Object.is equality

    - Expected
    + Received

    - 2
    + 1

     ❯ second.test.ts:5:13
          3| test('test 2-1', () => {
          4|   console.log('test 2-1')
          5|   expect(1).toBe(2)
           |             ^
          6| })
          7| 
    "
  `)

  expect(stdoutCheck).toMatchInlineSnapshot(`
    "stdout | first.test.ts
    global scope

    stdout | first.test.ts > test 1-1
    beforeEach

    stdout | first.test.ts > test 1-2
    beforeEach

    stdout | first.test.ts > test 1-2
    test 1-2

     ❯ first.test.ts (2 tests | 1 failed) <time>
       ✓ test 1-1 <time>
       × test 1-2 <time>
         → expected 1 to be 2 // Object.is equality
    stdout | second.test.ts > test 2-1
    test 2-1

     ❯ second.test.ts (3 tests | 1 failed) <time>
       × test 2-1 <time>
         → expected 1 to be 2 // Object.is equality
       ✓ group > test 2-2 <time>
       ✓ group > test 2-3 <time>

     Test Files  2 failed (2)
          Tests  2 failed | 3 passed (5)
       Duration  <time> (transform <time>, setup <time>, collect <time>, tests <time>, environment <time>, prepare <time>)
       Per blob  <time> <time>"
  `)

  const { stdout: reporterJson } = await runVitest({
    root: './fixtures/merge-reports',
    mergeReports: reportsDir,
    reporters: [['json', { outputFile: /** so it outputs into stdout */ null }]],
  })

  const slash = (r: string) => r.replace(/\\/g, '/')
  const path = (r: string) => slash(r)
    .replace(new RegExp(slash(process.cwd()), 'gi'), '<root>')

  const json = JSON.parse(reporterJson)
  json.testResults.forEach((result: any) => {
    result.startTime = '<time>'
    result.endTime = '<time>'
    result.name = path(result.name)
    result.assertionResults.forEach((assertion: any) => {
      delete assertion.duration
      assertion.failureMessages = assertion.failureMessages.map((m: string) => {
        return m.split('\n').slice(0, 2).map(path).join('\n')
      })
    })
  })
  json.startTime = '<time>'

  expect(json).toMatchInlineSnapshot(`
    {
      "numFailedTestSuites": 2,
      "numFailedTests": 2,
      "numPassedTestSuites": 1,
      "numPassedTests": 3,
      "numPendingTestSuites": 0,
      "numPendingTests": 0,
      "numTodoTests": 0,
      "numTotalTestSuites": 3,
      "numTotalTests": 5,
      "snapshot": {
        "added": 0,
        "didUpdate": false,
        "failure": false,
        "filesAdded": 0,
        "filesRemoved": 0,
        "filesRemovedList": [],
        "filesUnmatched": 0,
        "filesUpdated": 0,
        "matched": 0,
        "total": 0,
        "unchecked": 0,
        "uncheckedKeysByFile": [],
        "unmatched": 0,
        "updated": 0,
      },
      "startTime": "<time>",
      "success": false,
      "testResults": [
        {
          "assertionResults": [
            {
              "ancestorTitles": [],
              "failureMessages": [],
              "fullName": "test 1-1",
              "meta": {},
              "status": "passed",
              "title": "test 1-1",
            },
            {
              "ancestorTitles": [],
              "failureMessages": [
                "AssertionError: expected 1 to be 2 // Object.is equality
        at <root>/fixtures/merge-reports/first.test.ts:15:13",
              ],
              "fullName": "test 1-2",
              "meta": {},
              "status": "failed",
              "title": "test 1-2",
            },
          ],
          "endTime": "<time>",
          "message": "",
          "name": "<root>/fixtures/merge-reports/first.test.ts",
          "startTime": "<time>",
          "status": "failed",
        },
        {
          "assertionResults": [
            {
              "ancestorTitles": [],
              "failureMessages": [
                "AssertionError: expected 1 to be 2 // Object.is equality
        at <root>/fixtures/merge-reports/second.test.ts:5:13",
              ],
              "fullName": "test 2-1",
              "meta": {},
              "status": "failed",
              "title": "test 2-1",
            },
            {
              "ancestorTitles": [
                "group",
              ],
              "failureMessages": [],
              "fullName": "group test 2-2",
              "meta": {},
              "status": "passed",
              "title": "test 2-2",
            },
            {
              "ancestorTitles": [
                "group",
              ],
              "failureMessages": [],
              "fullName": "group test 2-3",
              "meta": {},
              "status": "passed",
              "title": "test 2-3",
            },
          ],
          "endTime": "<time>",
          "message": "",
          "name": "<root>/fixtures/merge-reports/second.test.ts",
          "startTime": "<time>",
          "status": "failed",
        },
      ],
    }
  `)
})

test('total and merged execution times are shown', async () => {
  for (const [_index, name] of ['first.test.ts', 'second.test.ts'].entries()) {
    const index = 1 + _index
    const file = createFileTask(
      resolve('./fixtures/merge-reports', name),
      resolve('./fixtures/merge-reports'),
      '',
    )
    file.tasks.push(createTest('some test', file))

    await writeBlob(
      [version, [file], [], [], undefined, 1500 * index],
      resolve(`./fixtures/merge-reports/.vitest-reports/blob-${index}-2.json`),
    )
  }

  const { stdout } = await runVitest({
    root: resolve('./fixtures/merge-reports'),
    mergeReports: resolve('./fixtures/merge-reports/.vitest-reports'),
    reporters: [['default', { isTTY: false }]],
  })

  expect(stdout).toContain('✓ first.test.ts (1 test)')
  expect(stdout).toContain('✓ second.test.ts (1 test)')

  expect(stdout).toContain('Duration  4.50s')
  expect(stdout).toContain('Per blob  1.50s 3.00s')
})

function trimReporterOutput(report: string) {
  const rows = report
    .replace(/\d+ms/g, '<time>')
    .replace(/\d+\.\d+s/g, '<time>')
    .split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Start at')), 1)

  return rows.join('\n').trim()
}

function createTest(name: string, file: File): Test {
  file.result = { state: 'pass' }

  return {
    type: 'test',
    name,
    id: `${file.id}_0`,
    mode: 'run',
    file,
    suite: file,
    annotations: [],
    timeout: 0,
    result: { state: 'pass' },
    meta: {},
    context: {} as any,
  }
}
