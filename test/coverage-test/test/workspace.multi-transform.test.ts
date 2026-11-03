import { expect, onTestFinished } from 'vitest'
import { runInlineTests } from '../../test-utils'
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

  const fileCoverages = coverageMap.files().map((file) => coverageMap.fileCoverageFor(file))

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

test('uncovered files use the project with the containing root', async () => {
  const transformed: string[] = []
  ;(globalThis as any).__coverageProjectTransforms = transformed
  onTestFinished(() => {
    delete (globalThis as any).__coverageProjectTransforms
  })

  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': `
      function project(name) {
        return {
          plugins: [{
            name: 'track-' + name,
            transform(_code, id) {
              if (id.includes('/packages/app-utils/src/untested.ts')) {
                globalThis.__coverageProjectTransforms.push(name)
              }
            },
          }],
          test: { name, root: './packages/' + name },
        }
      }

      export default {
        test: {
          projects: [project('app'), project('app-utils')],
          coverage: {
            enabled: true,
            provider: process.env.COVERAGE_PROVIDER,
            include: ['packages/*/src/untested.ts'],
            reporter: [],
          },
        },
      }
    `,
    'packages/app/app.test.ts': `
      import { test } from 'vitest'
      test('app', () => {})
    `,
    'packages/app-utils/app-utils.test.ts': `
      import { test } from 'vitest'
      test('app-utils', () => {})
    `,
    'packages/app-utils/src/untested.ts': 'export const untested = true',
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "app-utils.test.ts": {
        "app-utils": "passed",
      },
      "app.test.ts": {
        "app": "passed",
      },
    }
  `)
  expect(transformed).toMatchInlineSnapshot(`
    [
      "app-utils",
    ]
  `)
})
