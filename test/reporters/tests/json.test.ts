import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

describe('json reporter', async () => {
  const root = resolve(__dirname, '..', 'fixtures')
  const projectRoot = resolve(__dirname, '..', '..', '..')

  it('generates correct report', async () => {
    const { stdout } = await runVitest({
      reporters: 'json',
      root,
      includeTaskLocation: true,
    }, ['json-fail'])

    const data = JSON.parse(stdout)

    expect(data.testResults).toHaveLength(2)

    const failedImport = data.testResults.find((r: any) => r.name.includes('json-fail-import.test'))!
    const failedTest = data.testResults.find((r: any) => r.name.includes('json-fail.test'))!

    expect(failedTest.assertionResults).toHaveLength(1)
    expect(failedImport.assertionResults).toHaveLength(0)

    expect(failedTest.status).toBe('failed')
    expect(failedImport.status).toBe('failed')

    const result = failedTest.assertionResults[0]
    delete result.duration
    const rootRegexp = new RegExp(projectRoot, 'g')
    result.failureMessages = result.failureMessages
      .map((m: string) => {
        const errorStack = m.split('\n').slice(0, 2).join('\n')
        return errorStack.replace(/\\/g, '/').replace(rootRegexp, '<root>')
      })
    expect(result).toMatchSnapshot()
  }, 40000)

  it('generates empty json with success: false', async () => {
    const { stdout } = await runVitest({
      reporters: 'json',
      root,
      includeTaskLocation: true,
    }, ['json-non-existing-files'])

    const json = JSON.parse(stdout)
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
    const { stdout } = await runVitest({
      reporters: 'json',
      root,
      includeTaskLocation: true,
      passWithNoTests: true,
    }, ['json-non-existing-files'])

    const json = JSON.parse(stdout)
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
    ['passed', 'all-passing-or-skipped'],
    ['passed', 'all-skipped'],
    ['failed', 'some-failing'],
  ])('resolves to "%s" status for test file "%s"', async (expected, file) => {
    const { stdout } = await runVitest({ reporters: 'json', root }, [file])

    const data = JSON.parse(stdout)

    expect(data.testResults).toHaveLength(1)
    expect(data.testResults[0].status).toBe(expected)
  }, 40000)
})
