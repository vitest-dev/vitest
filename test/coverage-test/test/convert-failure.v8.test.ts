import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('logs warning but doesn\'t crash when coverage conversion fails', async () => {
  const { stderr, exitCode } = await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { reporter: 'json', include: ['fixtures/src/**'], all: false },
  }, { throwOnError: false })

  // Logged warning should not set erroneous exit code
  expect(exitCode).toBe(0)

  expect(stderr).toMatch('Failed to convert coverage for file://')
  expect(stderr).toMatch('/fixtures/src/cjs-package/target.js.')
  expect(stderr).toMatch('TypeError: Cannot read properties of undefined (reading \'endCol\')')

  const coverageMap = await readCoverageMap()

  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/cjs-package/entry.js",
      "<process-cwd>/fixtures/src/cjs-package/target.js",
    ]
  `)
})

coverageTest('load file both from Vite and outside it', async () => {
  const entry = createRequire(import.meta.url)('../fixtures/src/cjs-package' as any)
  const target = await import('../fixtures/src/cjs-package/target.js' as any)

  expect(entry).toBe('Entry here')
  expect(target.default).toStrictEqual({
    debug: 0,
    error: 3,
    fatal: 4,
    info: 1,
    warn: 2,
  })
})
