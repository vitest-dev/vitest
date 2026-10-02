import type { TestModule, Vitest } from 'vitest/node'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { replaceRoot, runInlineTests, runVitest } from '../../test-utils'

const cacheDir = `node_modules/.vite/vitest/${createHash('sha1').update('').digest('hex')}`
const resultsFile = `${cacheDir}/results.json`

const passingTest = /* js */ `
import { test } from 'vitest'
test('passes', () => {})
`

const failingTest = /* js */ `
import { expect, test } from 'vitest'
test('passes', () => {})
test('fails', () => {
  expect(1).toBe(2)
})
`

function getResultsPath(ctx: Vitest | undefined) {
  return resolve(ctx!.viteConfig.cacheDir, 'results.json')
}

function readRawResults(ctx: Vitest | undefined) {
  return JSON.parse(readFileSync(getResultsPath(ctx), 'utf-8'))
}

function readResults(ctx: Vitest | undefined) {
  // durations and timestamps are different in every run
  return JSON.parse(readFileSync(getResultsPath(ctx), 'utf-8'), (key, value) => {
    return key === 'duration' || key === 'lastRun' ? `<${key}>` : value
  })
}

function recordOrder(order: string[]) {
  return {
    onTestModuleStart(testModule: TestModule) {
      order.push(testModule.relativeModuleId)
    },
  }
}

test('stores the results of test files by project', async () => {
  const { ctx } = await runInlineTests(
    {
      'unit/basic.test.js': passingTest,
      'api/basic.test.js': failingTest,
      'vitest.config.js': {
        test: {
          projects: [
            { test: { name: 'unit', include: ['unit/*.test.js'] } },
            { test: { name: 'api:v2', include: ['api/*.test.js'] } },
          ],
        },
      },
    },
    { cache: true },
  )

  expect(readResults(ctx)).toMatchInlineSnapshot(`
    {
      "projects": {
        "api:v2": {
          "files": {
            "api/basic.test.js": {
              "duration": "<duration>",
              "failed": true,
              "lastRun": "<lastRun>",
            },
          },
        },
        "unit": {
          "files": {
            "unit/basic.test.js": {
              "duration": "<duration>",
              "failed": false,
              "lastRun": "<lastRun>",
            },
          },
        },
      },
      "version": 1,
    }
  `)
})

test('returns the cached result of a specification', async () => {
  const { ctx, fs } = await runInlineTests(
    {
      'basic.test.js': failingTest,
      'vitest.config.js': { test: { name: 'unit:node' } },
    },
    { cache: true, fsModuleCachePath: './node_modules/.vitest-fs-cache' },
  )

  const [specification] = ctx!.getModuleSpecifications(fs.resolveFile('basic.test.js'))
  const result = ctx!.cache.getTestSpecificationResult(specification)
  expect(result).toEqual({
    failed: true,
    duration: expect.any(Number),
    lastRun: expect.any(Number),
  })
  expect(result).toEqual(readRawResults(ctx).projects['unit:node'].files['basic.test.js'])

  const resultsPath = getResultsPath(ctx)
  await ctx!.clearCache()

  expect(ctx!.cache.getTestSpecificationResult(specification)).toBe(undefined)
  expect(existsSync(resultsPath)).toBe(false)
})

test('a partial run cannot mark a failed file as passed', async () => {
  const { ctx, fs } = await runInlineTests({ 'basic.test.js': failingTest }, { cache: true })

  const firstRun = readRawResults(ctx).projects[''].files['basic.test.js']
  expect(firstRun).toEqual({
    failed: true,
    duration: expect.any(Number),
    lastRun: expect.any(Number),
  })

  const filteredRun = await runVitest({ root: fs.root, cache: true, testNamePattern: 'passes' })

  expect(filteredRun.stderr).toBe('')
  expect(filteredRun.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "fails": "skipped",
        "passes": "passed",
      },
    }
  `)
  expect(readRawResults(filteredRun.ctx).projects[''].files['basic.test.js']).toEqual(firstRun)

  fs.editFile('basic.test.js', (content) => content.replace('toBe(2)', 'toBe(1)'))
  const fullRun = await runVitest({ root: fs.root, cache: true })

  expect(fullRun.stderr).toBe('')
  const lastRun = readRawResults(fullRun.ctx).projects[''].files['basic.test.js']
  expect(lastRun.failed).toBe(false)
  expect(lastRun.lastRun).toBeGreaterThan(firstRun.lastRun)
})

test('a partial run records a failure without the time of the run', async () => {
  const { ctx } = await runInlineTests(
    { 'basic.test.js': failingTest },
    { cache: true, testNamePattern: 'fails' },
  )

  expect(readResults(ctx)).toMatchInlineSnapshot(`
    {
      "projects": {
        "": {
          "files": {
            "basic.test.js": {
              "duration": "<duration>",
              "failed": true,
            },
          },
        },
      },
      "version": 1,
    }
  `)
})

test('a cancelled run does not record passed files', async () => {
  const { ctx } = await runInlineTests(
    {
      // the largest file runs first when there are no results
      'a-fail.test.js': `${failingTest}\n// ${'-'.repeat(1000)}`,
      'b-pass.test.js': passingTest,
      'c-pass.test.js': passingTest,
    },
    { cache: true, bail: 1 },
  )

  const { files } = readRawResults(ctx).projects['']
  expect(files['a-fail.test.js'].failed).toBe(true)
  const completeRuns = Object.keys(files).filter((file) => files[file].lastRun != null)
  expect(completeRuns).toEqual([])
})

test('the cache is stored in the cacheDir of Vite', async () => {
  const defaultRun = await runInlineTests({ 'basic.test.js': passingTest }, { cache: true })

  expect(defaultRun.stderr).toBe('')
  expect(getResultsPath(defaultRun.ctx)).toBe(defaultRun.fs.resolveFile(resultsFile))
  expect(existsSync(getResultsPath(defaultRun.ctx))).toBe(true)

  const customRun = await runInlineTests(
    { 'basic.test.js': passingTest },
    { cache: true, $viteConfig: { cacheDir: 'node_modules/.vite-custom' } },
  )

  expect(customRun.stderr).toBe('')
  expect(getResultsPath(customRun.ctx)).toBe(
    customRun.fs.resolveFile(resultsFile.replace('.vite', '.vite-custom')),
  )
  expect(existsSync(getResultsPath(customRun.ctx))).toBe(true)
})

test('the deprecated cache.dir option has no effect', async () => {
  const { ctx, fs, stderr } = await runInlineTests(
    {
      'basic.test.js': passingTest,
      'vitest.config.js': {
        test: {
          cache: { dir: 'node_modules/.vitest-custom' },
          projects: [{ test: { name: 'first' } }, { test: { name: 'second' } }],
        },
      },
    },
    { cache: undefined },
  )

  expect(stderr).toMatchInlineSnapshot(`
    " DEPRECATED  "cache.dir" is deprecated and has no effect. Use Vite's "cacheDir" instead if you want to change the cache directory. Note that the cache is written to "cacheDir/vitest".
    "
  `)
  expect(getResultsPath(ctx)).toBe(fs.resolveFile(resultsFile))
  expect(existsSync(getResultsPath(ctx))).toBe(true)
  expect(existsSync(fs.resolveFile('node_modules/.vitest-custom'))).toBe(false)
})

test('the cache is not stored if it is disabled', async () => {
  const { ctx, stderr, testTree } = await runInlineTests(
    { 'basic.test.js': passingTest },
    { cache: false },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "passes": "passed",
      },
    }
  `)
  expect(existsSync(getResultsPath(ctx))).toBe(false)
})

test('a file in the previous format is replaced', async () => {
  const { ctx, stderr } = await runInlineTests(
    {
      'basic.test.js': passingTest,
      [resultsFile]: JSON.stringify({
        version: '5.0.2',
        results: [[':basic.test.js', { duration: 1, failed: true }]],
      }),
    },
    { cache: true },
  )

  expect(stderr).toBe('')
  expect(readResults(ctx)).toMatchInlineSnapshot(`
    {
      "projects": {
        "": {
          "files": {
            "basic.test.js": {
              "duration": "<duration>",
              "failed": false,
              "lastRun": "<lastRun>",
            },
          },
        },
      },
      "version": 1,
    }
  `)
})

test('results of another process are not lost', async () => {
  const { ctx, fs } = await runInlineTests({ 'basic.test.js': passingTest }, { cache: true })

  const results = readRawResults(ctx)
  results.projects.other = { files: { 'other.test.js': { failed: true, duration: 1 } } }
  writeFileSync(getResultsPath(ctx), JSON.stringify(results))

  await ctx!.runTestSpecifications(ctx!.getModuleSpecifications(fs.resolveFile('basic.test.js')))

  expect(readResults(ctx)).toMatchInlineSnapshot(`
    {
      "projects": {
        "": {
          "files": {
            "basic.test.js": {
              "duration": "<duration>",
              "failed": false,
              "lastRun": "<lastRun>",
            },
          },
        },
        "other": {
          "files": {
            "other.test.js": {
              "duration": "<duration>",
              "failed": true,
            },
          },
        },
      },
      "version": 1,
    }
  `)
})

test('--clearCache deletes the results', async () => {
  const { ctx, fs } = await runInlineTests(
    { 'basic.test.js': passingTest },
    { cache: true, fsModuleCachePath: './node_modules/.vitest-fs-cache' },
  )
  const resultsPath = getResultsPath(ctx)
  expect(existsSync(resultsPath)).toBe(true)

  const { stdout, stderr } = await runVitest({
    root: fs.root,
    cache: true,
    clearCache: true,
    fsModuleCachePath: './node_modules/.vitest-fs-cache',
  })

  expect(stderr).toBe('')
  expect(replaceRoot(stdout, fs.root)).toMatchInlineSnapshot(`
    "[cache] cleared results cache at <root>/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json
    [cache] cleared fs module cache at <root>/node_modules/.vitest-fs-cache
    "
  `)
  expect(existsSync(resultsPath)).toBe(false)
})

test('failed and longer files run first', async () => {
  const order: string[] = []
  const { stderr } = await runInlineTests(
    {
      'a-long.test.js': passingTest,
      'b-short.test.js': passingTest,
      'c-failed.test.js': passingTest,
      [resultsFile]: JSON.stringify({
        version: 1,
        projects: {
          '': {
            files: {
              'a-long.test.js': { failed: false, duration: 1000, lastRun: 1 },
              'b-short.test.js': { failed: false, duration: 1, lastRun: 1 },
              'c-failed.test.js': { failed: true, duration: 1, lastRun: 1 },
            },
          },
        },
      }),
    },
    { cache: true, reporters: [recordOrder(order)] },
  )

  expect(stderr).toBe('')
  expect(order).toEqual(['c-failed.test.js', 'a-long.test.js', 'b-short.test.js'])
})

test('larger files run first if there are no results', async () => {
  const order: string[] = []
  const { stderr } = await runInlineTests(
    {
      'a-small.test.js': passingTest,
      'b-large.test.js': `${passingTest}\n// ${'-'.repeat(2000)}`,
      'c-medium.test.js': `${passingTest}\n// ${'-'.repeat(1000)}`,
    },
    { cache: true, reporters: [recordOrder(order)] },
  )

  expect(stderr).toBe('')
  expect(order).toEqual(['b-large.test.js', 'c-medium.test.js', 'a-small.test.js'])
})

test('the deprecated methods of the cache still work in a custom sequencer', async () => {
  const order: string[] = []
  const { stderr } = await runInlineTests(
    {
      'short.test.js': passingTest,
      'long.test.js': passingTest,
      'unknown.test.js': `${passingTest}\n// ${'-'.repeat(2000)}`,
      [resultsFile]: JSON.stringify({
        version: 1,
        projects: {
          'unit:node': {
            files: {
              'short.test.js': { failed: false, duration: 1, lastRun: 1 },
              'long.test.js': { failed: false, duration: 1000, lastRun: 1 },
            },
          },
        },
      }),
      'vitest.config.js': /* js */ `
        import { BaseSequencer } from 'vitest/node'

        class LegacySequencer extends BaseSequencer {
          async sort(files) {
            const { cache, config } = this.ctx
            const getKey = spec => spec.project.name + ':' + spec.moduleId.slice(config.root.length + 1)
            const getRank = (spec) => {
              const key = getKey(spec)
              return cache.getFileTestResults(key)?.duration ?? cache.getFileStats(key).size
            }
            return [...files].sort((a, b) => getRank(b) - getRank(a))
          }
        }

        export default {
          test: {
            name: 'unit:node',
            sequence: { sequencer: LegacySequencer },
          },
        }
      `,
    },
    { cache: true, reporters: [recordOrder(order)] },
  )

  expect(stderr).toMatchInlineSnapshot(`
    " DEPRECATED  "vitest.cache.getFileTestResults" is deprecated. Use "getTestSpecificationResult(specification)" instead.
     DEPRECATED  "vitest.cache.getFileStats" is deprecated. Read the size from the file system instead.
    "
  `)
  expect(order).toEqual(['unknown.test.js', 'long.test.js', 'short.test.js'])
})
