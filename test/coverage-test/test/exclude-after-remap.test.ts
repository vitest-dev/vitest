import { expect } from 'vitest'
import * as transpiled from '../fixtures/src/pre-bundle/bundle.js'
import { coverageTest, normalizeURL, readCoverageMap, runVitest, test } from '../utils.js'

test('{ excludeAfterRemap: true } should exclude files that come up after remapping', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['fixtures/src/**'],
      exclude: ['fixtures/src/pre-bundle/second.ts'],
      excludeAfterRemap: true,
      reporter: 'json',
      all: false,
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/pre-bundle/first.ts",
    ]
  `)
})

test('{ excludeAfterRemap: false } should not exclude files that come up after remapping', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: {
      include: ['fixtures/src/**'],
      exclude: ['fixtures/src/pre-bundle/second.ts'],
      reporter: 'json',
      all: false,
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/pre-bundle/first.ts",
      "<process-cwd>/fixtures/src/pre-bundle/second.ts",
    ]
  `)
})

test('{ excludeAfterRemap: true } should exclude uncovered files that come up after remapping', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts'],
    coverage: {
      include: ['fixtures/src/pre-bundle/**'],
      exclude: ['fixtures/src/pre-bundle/second.ts'],
      excludeAfterRemap: true,
      reporter: 'json',
      all: true,
    },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).contains('<process-cwd>/fixtures/src/pre-bundle/first.ts')
  expect(files).not.contains('<process-cwd>/fixtures/src/pre-bundle/second.ts')
})

coverageTest('run bundled sources', () => {
  expect(transpiled.first.covered()).toBe('First')
  expect(transpiled.second.covered()).toBe('Second')
})
