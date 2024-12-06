import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('custom provider', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
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
        "{\\"coverage\\":{\\"customCoverage\\":\\"Coverage report passed from workers to main thread\\"},\\"testFiles\\":[\\"fixtures/test/even.test.ts\\"],\\"transformMode\\":\\"ssr\\",\\"projectName\\":\\"\\"}",
        "{\\"coverage\\":{\\"customCoverage\\":\\"Coverage report passed from workers to main thread\\"},\\"testFiles\\":[\\"fixtures/test/math.test.ts\\"],\\"transformMode\\":\\"ssr\\",\\"projectName\\":\\"\\"}"
      ],
      "transformedFiles": [
        "<process-cwd>/fixtures/src/even.ts",
        "<process-cwd>/fixtures/src/math.ts"
      ]
    }"
  `)
})
