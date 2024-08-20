import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ allowExternal: true } includes files outside project root', async () => {
  await runVitest({
    include: ['fixtures/test/allow-external-fixture.test.ts'],
    coverage: {
      allowExternal: true,
      reporter: 'json',
      include: ['**/fixtures/src/math.ts', '**/test/test-utils/fixtures/**'],
      all: true,
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files).toContain('<project-root>/test/test-utils/fixtures/external-math.ts')

  // Uncovered files outside project root should also be included
  expect(files).toContain('<project-root>/test/test-utils/fixtures/uncovered.ts')

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})

test('{ allowExternal: false } excludes files outside project root', async () => {
  await runVitest({
    include: ['fixtures/test/allow-external-fixture.test.ts'],
    coverage: {
      allowExternal: false,
      reporter: 'json',
      include: ['**/fixtures/src/math.ts', '**/test/test-utils/fixtures/**'],
    },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files.find(file => file.includes('test-utils/fixtures/external-math.ts'))).toBeFalsy()
  expect(files.find(file => file.includes('test-utils/fixtures/uncovered.ts'))).toBeFalsy()

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})
