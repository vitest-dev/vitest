import { expect } from 'vitest'
import { StableTestFileOrderSorter } from '../../test-utils'
import { readCoverageMap, runVitest, test } from '../utils'

test('module offset is set correctly when module import is pending (#10581)', async () => {
  await runVitest({
    include: [
      'fixtures/test/slow-module-import-awaited.test.ts',
      'fixtures/test/slow-module-import-pending.test.ts',
    ],
    fileParallelism: false,
    sequence: { sequencer: StableTestFileOrderSorter },
    coverage: { reporter: 'json' },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/slow-module-imported.ts",
      "<process-cwd>/fixtures/src/slow-module.ts",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/slow-module-imported.ts')

  /** {@link file://./../fixtures/src/slow-module-imported.ts} */
  const lineCoverage = fileCoverage.getLineCoverage()

  expect.soft(lineCoverage['4']).toBe(0)
  expect.soft(lineCoverage['8']).toBe(0)

  expect.soft(lineCoverage['12']).toBe(1)
  expect.soft(lineCoverage['13']).toBe(0)
  expect.soft(lineCoverage['16']).toBe(1)
})
