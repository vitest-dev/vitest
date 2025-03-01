import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('--merge-reports', async () => {
  for (const index of [1, 2, 3]) {
    await runVitest({
      include: ['fixtures/test/merge-fixture-*.test.ts'],
      reporters: 'blob',
      shard: `${index}/3`,
      coverage: { all: false },
    })
  }

  await runVitest({
    // Pass default value - this option is publicly only available via CLI so it's a bit hacky usage here
    mergeReports: '.vitest-reports',
    coverage: {
      reporter: 'json',
      all: false,
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // Two files were covered: 3/3 cases covered math.ts, 1/3 covered even.ts
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
    ]
  `)

  const mathCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')
  const mathLines = mathCoverage.getLineCoverage()

  // sum() should be covered by one test file
  expect(mathLines[2]).toBe(1)

  // multiply() should be covered by two test files
  expect(mathLines[10]).toBe(2)

  const evenCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/even.ts')
  const evenLines = evenCoverage.getLineCoverage()

  // isEven() should be covered by one test file
  expect(evenLines[2]).toBe(1)
})
