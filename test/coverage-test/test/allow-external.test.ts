import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ allowExternal: true } includes files outside project root', async () => {
  await runVitest({
    include: ['fixtures/test/allow-external-fixture.test.ts'],
    coverage: { allowExternal: true, reporter: 'json', include: ['**/fixtures/**'], all: false },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files).toContain('<project-root>/test/test-utils/fixtures/external-math.ts')

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})

test('{ allowExternal: false } excludes files outside project root', async () => {
  await runVitest({
    include: ['fixtures/test/allow-external-fixture.test.ts'],
    coverage: { allowExternal: false, reporter: 'json', include: ['**/fixtures/**'] },
  })
  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  // File outside project root
  expect(files.find(file => file.includes('test-utils/fixtures/external-math.ts'))).toBeFalsy()

  // Files inside project root should always be included
  expect(files).toContain('<process-cwd>/fixtures/src/math.ts')
})
