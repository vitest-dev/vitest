import { readFileSync, rmSync } from 'node:fs'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('custom provider', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    fsModuleCache: false,
  })

  const report = readFileSync('./coverage/custom-coverage-provider-report.json', 'utf-8')

  expect(report).toMatchInlineSnapshot(`
    "{
      "calls": [
        "initialized with context",
        "resolveOptions",
        "clean with force",
        "onAfterSuiteRun",
        "reportCoverage with {\\"allTestsRun\\":true}"
      ],
      "coverageReports": [
        "{\\"coverage\\":{\\"customCoverage\\":\\"Coverage report passed from workers to main thread\\"},\\"testFiles\\":[\\"fixtures/test/even.test.ts\\"],\\"environment\\":\\"ssr\\",\\"projectName\\":\\"\\"}",
        "{\\"coverage\\":{\\"customCoverage\\":\\"Coverage report passed from workers to main thread\\"},\\"testFiles\\":[\\"fixtures/test/math.test.ts\\"],\\"environment\\":\\"ssr\\",\\"projectName\\":\\"\\"}"
      ],
      "transformedFiles": [
        "<process-cwd>/fixtures/src/even.ts",
        "<process-cwd>/fixtures/src/math.ts"
      ],
      "restoredFiles": []
    }"
  `)
})

test('custom provider restores its data from fs module cache', async () => {
  const fsModuleCachePath = './node_modules/.vitest-custom-provider-cache'
  rmSync(fsModuleCachePath, { recursive: true, force: true })

  const config = {
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    fsModuleCache: true,
    fsModuleCachePath,
  }

  // first run transforms the files and stores their data in the cache
  await runVitest(config)
  const first = JSON.parse(readFileSync('./coverage/custom-coverage-provider-report.json', 'utf-8'))

  expect(first.transformedFiles).toEqual([
    '<process-cwd>/fixtures/src/even.ts',
    '<process-cwd>/fixtures/src/math.ts',
  ])
  expect(first.restoredFiles).toEqual([])

  // second run loads the files from the cache and doesn't transform them
  await runVitest(config)
  const second = JSON.parse(
    readFileSync('./coverage/custom-coverage-provider-report.json', 'utf-8'),
  )

  expect(second.transformedFiles).toEqual([])
  expect(second.restoredFiles).toEqual([
    '<process-cwd>/fixtures/src/even.ts {"cachedBy":"custom-coverage-provider","filename":"<process-cwd>/fixtures/src/even.ts"}',
    '<process-cwd>/fixtures/src/math.ts {"cachedBy":"custom-coverage-provider","filename":"<process-cwd>/fixtures/src/math.ts"}',
  ])

  rmSync(fsModuleCachePath, { recursive: true, force: true })
})
