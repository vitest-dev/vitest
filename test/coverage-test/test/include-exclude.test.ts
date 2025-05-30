import assert from 'node:assert'
import { expect } from 'vitest'
import { coverageConfigDefaults } from 'vitest/config'
import { readCoverageMap, runVitest, test } from '../utils'

test('default exclude should ignore test files', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      all: true,
      reporter: 'json',
      include: ['fixtures/test/math.test.ts'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`{}`)
})

test('overridden exclude should still apply defaults', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      all: true,
      reporter: 'json',
      include: ['fixtures/test/math.test.ts'],
      exclude: ['dont-match-anything'],
    },
  })

  const coverageMap = await readCoverageMap()
  expect(coverageMap.files()).toMatchInlineSnapshot(`{}`)
})

test('test file is excluded from report when excludes is not set', async () => {
  await runVitest({
    include: ['fixtures/src/test-that-looks-like-source-file.ts'],
    coverage: {
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()
  expect(files.find(file => file.includes('test-that-looks-like-source-file'))).toBeFalsy()
})

test('test files are automatically excluded from report when excludes is set', async () => {
  await runVitest({
    include: ['fixtures/src/test-that-looks-like-source-file.ts'],
    coverage: {
      all: true,
      reporter: 'json',
      exclude: [...coverageConfigDefaults.exclude, '**/something-else/**'],
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()
  expect(files.find(file => file.includes('test-that-looks-like-source-file'))).toBeFalsy()
})

test('files included and excluded in plugin\'s configureVitest are excluded', async () => {
  await runVitest({
    config: 'fixtures/configs/vitest.config.configure-vitest-hook.ts',
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      // Include math.ts by default, exclude it in plugin config
      include: ['**/math.ts'],
      all: true,
      reporter: 'json',
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})

test('files included and excluded in project\'s plugin\'s configureVitest are excluded', async () => {
  await runVitest({
    coverage: {
      // Include math.ts by default, exclude it in plugin config
      include: ['**/math.ts'],
      all: true,
      reporter: 'json',
    },
    projects: [
      {
        test: {
          name: 'first',
          include: ['fixtures/test/math.test.ts'],
        },
        plugins: [{
          name: 'coverage-options-by-runtime-plugin',
          configureVitest(context) {
            const coverage = context.vitest.config.coverage
            assert(coverage.provider === 'v8' || coverage.provider === 'istanbul')

            coverage.include ||= []
            coverage.include.push('**/even.ts')
          },
        }],
      },
      {
        test: {
          name: 'second',
          include: ['fixtures/test/even.test.ts'],
        },
        plugins: [{
          name: 'coverage-options-by-runtime-plugin',
          configureVitest(context) {
            const coverage = context.vitest.config.coverage
            assert(coverage.provider === 'v8' || coverage.provider === 'istanbul')

            coverage.include ||= []
            coverage.include.push('**/untested-file.ts')
            coverage.exclude.push('**/math.ts')
          },
        }],
      },
    ],
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/even.ts",
      "<process-cwd>/fixtures/src/untested-file.ts",
    ]
  `)
})
