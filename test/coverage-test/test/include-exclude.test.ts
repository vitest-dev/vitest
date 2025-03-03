import { expect } from 'vitest'
import { coverageConfigDefaults } from 'vitest/config'
import { readCoverageMap, runVitest, test } from '../utils'

test('default exclude should ignore test files', async () => {
  await runVitest({
    root: './fixtures',
    config: './configs/vitest.config.ts',
    include: ['test/math.test.ts'],
    coverage: {
      all: true,
      reporter: 'json',
      include: ['test/math.test.ts'],
    },
  })

  const coverageMap = await readCoverageMap('./fixtures/coverage/coverage-final.json')
  expect(coverageMap.files()).toMatchInlineSnapshot(`{}`)
})

test('overridden exclude should still apply defaults', async () => {
  await runVitest({
    root: './fixtures',
    config: './configs/vitest.config.ts',
    include: ['test/math.test.ts'],
    coverage: {
      enabled: true,
      all: true,
      reporter: 'json',
      include: ['test/math.test.ts'],
      exclude: ['dont-match-anything'],
    },
  })

  const coverageMap = await readCoverageMap('./fixtures/coverage/coverage-final.json')
  expect(coverageMap.files()).toMatchInlineSnapshot(`{}`)
})

test('test file is excluded from report when excludes is not set', async () => {
  await runVitest({
    root: './fixtures',
    config: './configs/vitest.config.ts',
    include: ['src/test-that-looks-like-source-file.ts'],
    coverage: {
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap('./fixtures/coverage/coverage-final.json')
  const files = coverageMap.files()
  expect(files.find(file => file.includes('test-that-looks-like-source-file'))).toBeFalsy()
})

test('test files are automatically excluded from report when excludes is set', async () => {
  await runVitest({
    root: './fixtures',
    config: './configs/vitest.config.ts',
    include: ['src/test-that-looks-like-source-file.ts'],
    coverage: {
      all: true,
      reporter: 'json',
      exclude: [...coverageConfigDefaults.exclude, '**/something-else/**'],
    },
  })

  const coverageMap = await readCoverageMap('./fixtures/coverage/coverage-final.json')
  const files = coverageMap.files()
  expect(files.find(file => file.includes('test-that-looks-like-source-file'))).toBeFalsy()
})
