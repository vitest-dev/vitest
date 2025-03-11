import { expect } from 'vitest'
import { isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('{ all: true } includes uncovered files that require custom transform', async () => {
  await runVitest({
    workspace: 'fixtures/configs/vitest.workspace.multi-transforms.ts',
    coverage: {
      all: true,
      extension: ['.ts', '.custom-1', '.custom-2'],
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

  if (isV8Provider()) {
    expect(fileCoverages).toMatchInlineSnapshot(`
      {
        "<process-cwd>/fixtures/src/covered.custom-1": {
          "branches": "1/1 (100%)",
          "functions": "1/2 (50%)",
          "lines": "2/3 (66.66%)",
          "statements": "2/3 (66.66%)",
        },
        "<process-cwd>/fixtures/src/math.ts": {
          "branches": "1/1 (100%)",
          "functions": "1/4 (25%)",
          "lines": "6/12 (50%)",
          "statements": "6/12 (50%)",
        },
        "<process-cwd>/fixtures/src/uncovered.custom-1": {
          "branches": "0/1 (0%)",
          "functions": "0/1 (0%)",
          "lines": "0/2 (0%)",
          "statements": "0/2 (0%)",
        },
        "<process-cwd>/fixtures/workspaces/custom-2/src/covered.custom-2": {
          "branches": "1/1 (100%)",
          "functions": "1/2 (50%)",
          "lines": "2/3 (66.66%)",
          "statements": "2/3 (66.66%)",
        },
        "<process-cwd>/fixtures/workspaces/custom-2/src/uncovered.custom-2": {
          "branches": "0/1 (0%)",
          "functions": "0/1 (0%)",
          "lines": "0/2 (0%)",
          "statements": "0/2 (0%)",
        },
      }
    `)
  }
  else {
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
  }
})
