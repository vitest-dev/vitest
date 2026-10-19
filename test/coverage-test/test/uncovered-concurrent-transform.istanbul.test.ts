import type { DevEnvironment, Plugin } from 'vite'
import { resolve } from 'node:path'
import { expect } from 'vitest'
import { formatSummary, readCoverageMap, runVitest, test } from '../utils'

test('uncovered file coverage is not replaced by concurrent transforms (#11433)', async () => {
  await runVitest(
    {
      include: ['fixtures/test/math.test.ts'],
      coverage: {
        reporter: 'json',
        include: ['fixtures/src/math.ts', 'fixtures/src/untested-file.ts', 'fixtures/src/even.ts'],
      },
    },
    undefined,
    { plugins: [transformAnotherFileDuringUncoveredTransform()] },
  )

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)

  const untested = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/untested-file.ts')
  expect(formatSummary(untested.toSummary())).toMatchInlineSnapshot(`
    {
      "branches": "0/2 (0%)",
      "functions": "0/4 (0%)",
      "lines": "0/6 (0%)",
      "statements": "0/6 (0%)",
    }
  `)

  const even = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/even.ts')
  expect(formatSummary(even.toSummary())).toMatchInlineSnapshot(`
    {
      "branches": "0/0 (100%)",
      "functions": "0/2 (0%)",
      "lines": "0/2 (0%)",
      "statements": "0/2 (0%)",
    }
  `)
})

// Simulates import warm-up finishing while the uncovered file's transform is still pending
function transformAnotherFileDuringUncoveredTransform(): Plugin {
  const anotherFile = resolve(import.meta.dirname, '../fixtures/src/even.ts')

  return {
    name: 'test:transform-another-file-during-uncovered-transform',
    transform: {
      order: 'post',
      async handler(_, id) {
        if (id.includes('untested-file.ts') && id.includes('vitest-uncovered-coverage=true')) {
          await (this.environment as DevEnvironment).transformRequest(
            `${anotherFile}?concurrent-transform`,
          )
        }
      },
    },
  }
}
