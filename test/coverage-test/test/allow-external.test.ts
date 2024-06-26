import { expect } from 'vitest'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils'
import { multiply } from '../fixtures/src/math'
import * as ExternalMath from '../../test-utils/fixtures/math'

test('{ allowExternal: true } includes files outside project root', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { allowExternal: true, reporter: 'json' },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files).toContain('<project-root>/test/test-utils/fixtures/math.ts')

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})

test('{ allowExternal: false } excludes files outside project root', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { allowExternal: false, reporter: 'json' },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files.find(file => file.includes('test-utils/fixtures/math.ts'))).toBeFalsy()

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})

coverageTest('calling files outside project root', () => {
  expect(ExternalMath.sum(2, 3)).toBe(5)
})

coverageTest('multiply - add some files to report', () => {
  expect(multiply(2, 3)).toBe(6)
})
