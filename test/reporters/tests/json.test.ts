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
