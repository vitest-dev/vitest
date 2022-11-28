import fs from 'fs'
import { normalize, resolve } from 'pathe'
import { expect, test } from 'vitest'

test('istanbul html report', async () => {
  const coveragePath = resolve('./coverage/src')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('index.ts.html')
  expect(files).toContain('Hello.vue.html')
})

test('istanbul lcov report', async () => {
  const coveragePath = resolve('./coverage')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('lcov.info')

  const lcovReport = resolve('./coverage/lcov-report')
  const lcovReportFiles = fs.readdirSync(lcovReport)

  expect(lcovReportFiles).toContain('index.html')
})

test('all includes untested files', () => {
  const coveragePath = resolve('./coverage/src')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('untested-file.ts.html')
})

test('files should not contain query parameters', () => {
  const coveragePath = resolve('./coverage/src/Counter')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('Counter.vue.html')
  expect(files).toContain('Counter.component.ts.html')
  expect(files).not.toContain('Counter.component.ts?vue&type=script&src=true&lang.ts.html')
})

test('implicit else is included in branch count', async () => {
  // @ts-expect-error -- generated file
  const { default: coverageMap } = await import('./coverage/coverage-final.json')

  const filename = normalize(resolve('./src/implicitElse.ts'))
  const fileCoverage = coverageMap[filename]

  expect(fileCoverage.b).toHaveProperty('0')
  expect(fileCoverage.b['0']).toHaveLength(2)
})

test('file using import.meta.env is included in report', async () => {
  const coveragePath = resolve('./coverage/src')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('importEnv.ts.html')
})
