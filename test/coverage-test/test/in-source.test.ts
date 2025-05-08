import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('in-source tests work', async () => {
  const { stdout } = await runVitest({
    include: [],
    includeSource: ['fixtures/src/in-source.ts'],
    coverage: { all: false, reporter: 'json' },
  })

  expect(stdout).toContain('in source test running add function')

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/in-source.ts",
    ]
  `)
})
