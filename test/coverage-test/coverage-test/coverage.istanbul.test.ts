import fs from 'fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('istanbul html report', async () => {
  const coveragePath = resolve('./coverage')
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
