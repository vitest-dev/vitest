import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

// TODO: browser mode?
test('vi.mock({ spy: true }) collects coverage (#9290)', async () => {
  await runVitest({
    include: ['fixtures/test/autospy-fixture.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/autospy-target.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap).toMatchInlineSnapshot(`
    {
      "branches": "0/0 (100%)",
      "functions": "1/2 (50%)",
      "lines": "1/2 (50%)",
      "statements": "1/2 (50%)",
    }
  `)

  const coverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/autospy-target.ts')
  const functionCoverage = Object.keys(coverage.fnMap)
    .map(index => ({ name: coverage.fnMap[index].name, hits: coverage.f[index] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  expect(functionCoverage).toMatchInlineSnapshot(`
    [
      {
        "hits": 1,
        "name": "double",
      },
      {
        "hits": 0,
        "name": "triple",
      },
    ]
  `)
})
