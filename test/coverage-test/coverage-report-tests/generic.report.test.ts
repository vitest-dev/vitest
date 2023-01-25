/*
 * Test cases shared by both coverage providers
*/

import fs from 'fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('html report', async () => {
  const coveragePath = resolve('./coverage/src')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('index.mts.html')
  expect(files).toContain('Hello.vue.html')
})

test('lcov report', async () => {
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

test('file using import.meta.env is included in report', async () => {
  const coveragePath = resolve('./coverage/src')
  const files = fs.readdirSync(coveragePath)

  expect(files).toContain('importEnv.ts.html')
})

test('files should not contain a setup file', () => {
  const coveragePath = resolve('./coverage')
  const files = fs.readdirSync(coveragePath)

  expect(files).not.toContain('coverage-test')
  expect(files).not.toContain('setup.ts.html')

  const coverageSrcPath = resolve('./coverage/src')
  const srcFiles = fs.readdirSync(coverageSrcPath)

  expect(srcFiles).not.toContain('another-setup.ts.html')
})
