import swc from 'unplugin-swc'
import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('uncovered files that require custom transform', async () => {
  await runVitest({
    config: './fixtures/configs/vitest.config.multi-transforms.ts',
    coverage: {
      reporter: ['json', 'html'],
      include: ['**/*.custom-1', '**/*.custom-2', '**/math.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // All files from workspace should be picked
  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/covered.custom-1",
      "<process-cwd>/fixtures/src/math.ts",
      "<process-cwd>/fixtures/src/uncovered.custom-1",
      "<process-cwd>/fixtures/workspaces/custom-2/src/covered.custom-2",
      "<process-cwd>/fixtures/workspaces/custom-2/src/uncovered.custom-2",
    ]
  `)

  const fileCoverages = coverageMap.files().map(file => coverageMap.fileCoverageFor(file))

  expect(fileCoverages).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/src/covered.custom-1": {
        "branches": "0/0 (100%)",
        "functions": "1/2 (50%)",
        "lines": "1/2 (50%)",
        "statements": "1/2 (50%)",
      },
      "<process-cwd>/fixtures/src/math.ts": {
        "branches": "0/0 (100%)",
        "functions": "1/4 (25%)",
        "lines": "1/4 (25%)",
        "statements": "1/4 (25%)",
      },
      "<process-cwd>/fixtures/src/uncovered.custom-1": {
        "branches": "0/0 (100%)",
        "functions": "0/1 (0%)",
        "lines": "0/1 (0%)",
        "statements": "0/1 (0%)",
      },
      "<process-cwd>/fixtures/workspaces/custom-2/src/covered.custom-2": {
        "branches": "0/0 (100%)",
        "functions": "1/2 (50%)",
        "lines": "1/2 (50%)",
        "statements": "1/2 (50%)",
      },
      "<process-cwd>/fixtures/workspaces/custom-2/src/uncovered.custom-2": {
        "branches": "0/0 (100%)",
        "functions": "0/1 (0%)",
        "lines": "0/1 (0%)",
        "statements": "0/1 (0%)",
      },
    }
  `)
})

test('merging reports from transforms that produce different end mappings', async () => {
  await runVitest({
    coverage: {
      reporter: ['json', 'html'],
    },

    projects: [
      {
        test: { name: 'one', include: ['fixtures/test/math.test.ts'] },
      },
      {
        test: { name: 'two', include: ['fixtures/test/math.test.ts'] },
        plugins: [{
          name: 'vitest-custom-multi-transform',
          enforce: 'pre',
          transform(code, id, options) {
            if (id.includes('math.ts')) {
              // @ts-expect-error -- Ignore complex type
              return swc.vite({ jsc: { target: 'esnext' } }).transform(code, id, options)
            }
          },
        }],
      },
    ],
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/math.ts')

  expect(fileCoverage).toMatchInlineSnapshot(`
    {
      "branches": "0/0 (100%)",
      "functions": "2/8 (25%)",
      "lines": "1/4 (25%)",
      "statements": "1/4 (25%)",
    }
  `)

  expect(Object.values(fileCoverage.fnMap).map(fn => fn.name)).toMatchInlineSnapshot(`
    [
      "sum",
      "subtract",
      "multiply",
      "remainder",
      "sum",
      "subtract",
      "multiply",
      "remainder",
    ]
  `)
})
