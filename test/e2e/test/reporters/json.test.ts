import { readFileSync } from 'node:fs'
import { basename, resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

describe('json reporter', async () => {
  const root = resolve(import.meta.dirname, '..', '..', 'fixtures', 'reporters')
  const projectRoot = resolve(import.meta.dirname, '..', '..', '..', '..')

  function readJsonReport() {
    return JSON.parse(readFileSync(resolve(root, '.vitest/json/output.json'), 'utf-8'))
  }

  it('generates correct report', async () => {
    await runVitest(
      {
        reporters: 'json',
        root,
        include: ['**/json-fail-import.test.ts', '**/json-fail.test.ts'],
        includeTaskLocation: true,
      },
      ['json-fail'],
    )

    const data = readJsonReport()

    expect(data.testResults).toHaveLength(2)

    const failedImport = data.testResults.find((r: any) =>
      r.name.includes('json-fail-import.test'),
    )!
    const failedTest = data.testResults.find((r: any) => r.name.includes('json-fail.test'))!

    expect(failedTest.assertionResults).toHaveLength(1)
    expect(failedImport.assertionResults).toHaveLength(0)

    expect(failedTest.status).toBe('failed')
    expect(failedImport.status).toBe('failed')

    const result = failedTest.assertionResults[0]
    delete result.duration
    const rootRegexp = new RegExp(projectRoot, 'g')
    result.failureMessages = result.failureMessages.map((m: string) => {
      const errorStack = m.split('\n').slice(0, 2).join('\n')
      return errorStack.replace(/\\/g, '/').replace(rootRegexp, '<root>')
    })
    expect(result).toMatchSnapshot()
  })

  it('generates empty json with success: false', async () => {
    await runVitest(
      {
        reporters: 'json',
        root,
        includeTaskLocation: true,
      },
      ['json-non-existing-files'],
    )

    const json = readJsonReport()
    json.startTime = 0
    expect(json).toMatchInlineSnapshot(`
      {
        "numFailedTestSuites": 0,
        "numFailedTests": 0,
        "numPassedTestSuites": 0,
        "numPassedTests": 0,
        "numPendingTestSuites": 0,
        "numPendingTests": 0,
        "numTodoTests": 0,
        "numTotalTestSuites": 0,
        "numTotalTests": 0,
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
        "startTime": 0,
        "success": false,
        "testResults": [],
      }
    `)
  })

  it('generates empty json with success: true', async () => {
    await runVitest(
      {
        reporters: 'json',
        root,
        includeTaskLocation: true,
        passWithNoTests: true,
      },
      ['json-non-existing-files'],
    )

    const json = readJsonReport()
    json.startTime = 0
    expect(json).toMatchInlineSnapshot(`
      {
        "numFailedTestSuites": 0,
        "numFailedTests": 0,
        "numPassedTestSuites": 0,
        "numPassedTests": 0,
        "numPendingTestSuites": 0,
        "numPendingTests": 0,
        "numTodoTests": 0,
        "numTotalTestSuites": 0,
        "numTotalTests": 0,
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
        "startTime": 0,
        "success": true,
        "testResults": [],
      }
    `)
  })

  it.each([
    ['passed', 'all-passing-or-skipped.test.ts'],
    ['passed', 'all-skipped.test.ts'],
    ['failed', 'some-failing.test.ts'],
  ])('resolves to "%s" status for test file "%s"', async (expected, file) => {
    await runVitest({ reporters: 'json', root, include: [`**/${file}`] })

    const data = readJsonReport()

    expect(data.testResults).toHaveLength(1)
    expect(data.testResults[0].status).toBe(expected)
  })

  it('includes all meta fields when filterMeta is not set', async () => {
    await runVitest({
      reporters: 'json',
      root,
      include: ['**/json-meta.test.ts'],
    })

    const data = readJsonReport()
    const results = data.testResults[0].assertionResults
    const passing = results.find((r: any) => r.title === 'pass')

    expect(passing.meta).toEqual({ custom: 'Passing test added this' })
  })

  it('filterMeta filters meta fields by key', async () => {
    await runVitest({
      reporters: [
        [
          'json',
          {
            filterMeta: (key) => key !== 'custom',
          },
        ],
      ],
      root,
      include: ['**/json-meta.test.ts'],
    })

    const data = readJsonReport()
    const results = data.testResults[0].assertionResults

    for (const result of results) {
      expect(result.meta).toEqual({})
    }
  })

  it('prints report to stdout when stdout option is set', async () => {
    const { stdout } = await runVitest({
      reporters: [['json', { stdout: true }]],
      root,
      include: ['**/ok.test.ts'],
    })
    const data = JSON.parse(stdout)
    expect(data).toMatchObject({
      numTotalTests: 1,
      numPassedTests: 1,
      success: true,
    })
  })

  describe('when a worker crashes', () => {
    async function runWithCrash(crashTest: string) {
      const { stdout, exitCode } = await runInlineTests(
        {
          'ok.test.ts': `
            import { expect, test } from 'vitest'

            test('ok', () => {
              expect(1).toBe(1)
            })
          `,
          'crash.test.ts': crashTest,
        },
        {
          pool: 'forks',
          dangerouslyIgnoreUnhandledErrors: true,
          reporters: [['json', { stdout: true }]],
        },
      )

      const data = JSON.parse(stdout)
      return {
        exitCode,
        data,
        statuses: Object.fromEntries(
          data.testResults.map((r: any) => [basename(r.name), r.status]),
        ),
      }
    }

    it('reports the file as failed if the worker crashes during collection', async () => {
      const { exitCode, data, statuses } = await runWithCrash(`
        import { test } from 'vitest'

        // the worker dies while Vitest collects the tests of this file
        process.kill(process.pid, 'SIGKILL')

        test('never collected', () => {})
      `)

      expect(exitCode).toBe(1)
      expect(statuses).toEqual({ 'crash.test.ts': 'failed', 'ok.test.ts': 'passed' })
      expect(data).toMatchObject({
        numTotalTestSuites: 2,
        numFailedTestSuites: 1,
        numPassedTestSuites: 1,
        numPendingTestSuites: 0,
        success: false,
      })
    })

    it('reports the file as failed if the worker crashes during a test', async () => {
      const { exitCode, data, statuses } = await runWithCrash(`
        import { test } from 'vitest'

        test('before', () => {})

        test('kills the worker', () => {
          process.kill(process.pid, 'SIGKILL')
        })

        test('after', () => {})
      `)

      expect(exitCode).toBe(1)
      expect(statuses).toEqual({ 'crash.test.ts': 'failed', 'ok.test.ts': 'passed' })
      expect(data).toMatchObject({
        numTotalTestSuites: 2,
        numFailedTestSuites: 1,
        numPassedTestSuites: 1,
        numPendingTestSuites: 0,
        success: false,
      })
    })
  })
})
