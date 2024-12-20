import { expect } from 'vitest'
import { implicitElse } from '../fixtures/src/implicit-else'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('implicit else is included in branch count', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json', all: false },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/implicit-else.ts')

  expect(fileCoverage.b).toHaveProperty('0')
  expect(fileCoverage.b['0']).toHaveLength(2)
})

coverageTest('cover if branch', () => {
  expect(implicitElse(true)).toBe(2)
})
