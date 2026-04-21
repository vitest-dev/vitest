import { expect } from 'vitest'
import { customFilePlugin } from '../fixtures/configs/vitest.config.multi-transforms'
import { readCoverageMap, runVitest, test } from '../utils'

test('custom `viteOverrides.plugins` work with `vitest:coverage-transform` plugin (#8468)', async () => {
  const viteOverrides = { plugins: [customFilePlugin('1')] }

  await runVitest({
    include: ['fixtures/test/custom-1-syntax.test.ts'],
    coverage: { reporter: 'json' },
  }, undefined, viteOverrides)

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/covered.custom-1",
    ]
  `)

  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/covered.custom-1')
  expect(fileCoverage).toMatchInlineSnapshot(`
    {
      "branches": "0/0 (100%)",
      "functions": "1/2 (50%)",
      "lines": "1/2 (50%)",
      "statements": "1/2 (50%)",
    }
  `)
})
