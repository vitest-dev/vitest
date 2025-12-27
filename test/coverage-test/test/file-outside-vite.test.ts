import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { coverageTest, isV8Provider, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('does not crash when file outside Vite is loaded (#5639)', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json', include: ['fixtures/src/load-outside-vite.cjs'] },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/load-outside-vite.cjs')

  if (isV8Provider()) {
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "0/0 (100%)",
        "functions": "0/1 (0%)",
        "lines": "1/1 (100%)",
        "statements": "1/1 (100%)",
      }
    `)
  }
  else {
    // On istanbul the instrumentation happens on Vite plugin, so files
    // loaded outsite Vite should have 0% coverage
    expect(fileCoverage).toMatchInlineSnapshot(`
      {
        "branches": "0/0 (100%)",
        "functions": "0/1 (0%)",
        "lines": "0/1 (0%)",
        "statements": "0/1 (0%)",
      }
    `)
  }
})

coverageTest('load file using require so it\'s not intercepted by Vite', () => {
  const noop = createRequire(import.meta.url)('../fixtures/src/load-outside-vite.cjs')

  expect(noop).toBeTypeOf('function')
})
