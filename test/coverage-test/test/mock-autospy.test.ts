import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('vi.mock({ spy: true }) collects coverage of original module', async () => {
  await runVitest({
    include: ['fixtures/test/mock-autospy-fixture.test.ts'],
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/mock-target.ts'],
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

  const coverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/mock-target.ts')
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
