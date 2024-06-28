import { expect } from 'vitest'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'

test('default exclude should ignore test files', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: true,
      reporter: 'json',
      include: ['fixtures/test/math.test.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`[]`)
})

test('overriden exclude should not apply defaults', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      all: true,
      reporter: 'json',
      include: ['fixtures/test/math.test.ts'],
      exclude: ['dont-match-anything'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/test/math.test.ts",
    ]
  `)
})

coverageTest('dummy', () => {
  expect(1 + 1).toBe(2)
})
