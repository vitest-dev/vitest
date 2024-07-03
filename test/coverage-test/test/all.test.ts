import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('{ all: true } includes uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/**'],
    exclude: ['**/virtual-files-**'],
    coverage: {
      include: ['fixtures/src/**'],
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toContain('<process-cwd>/fixtures/src/untested-file.ts')
  expect(files.length).toBeGreaterThanOrEqual(3)

  // Directories starting with dot should be excluded, check for ".should-be-excluded-from-coverage/excluded-from-coverage.ts"
  expect(files.find(file => file.includes('excluded-from-coverage'))).toBeFalsy()
})

test('{ all: false } excludes uncovered files', async () => {
  await runVitest({
    include: ['fixtures/test/**'],
    exclude: ['**/virtual-files-**'],
    coverage: {
      include: ['fixtures/src/**'],
      all: false,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files.find(file => file.includes('untested-file'))).toBeFalsy()
  expect(files.length).toBeGreaterThanOrEqual(3)

  // Directories starting with dot should be excluded, check for ".should-be-excluded-from-coverage/excluded-from-coverage.ts"
  expect(files.find(file => file.includes('excluded-from-coverage'))).toBeFalsy()
})
