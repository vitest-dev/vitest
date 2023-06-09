import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

describe('json reporter', async () => {
  const root = resolve(__dirname, '../fixtures')

  it('generates correct report', async () => {
    const { stdout } = await runVitest({ reporters: 'json', root }, ['json-fail'])

    const data = JSON.parse(stdout)

    expect(data.testResults).toHaveLength(1)
    expect(data.testResults[0].assertionResults).toHaveLength(1)

    const result = data.testResults[0].assertionResults[0]
    delete result.duration
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
