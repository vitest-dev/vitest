import type { FileCoverageData } from 'istanbul-lib-coverage'
import type { TestFunction } from 'vitest'
import type { UserConfig } from 'vitest/node'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import libCoverage from 'istanbul-lib-coverage'
import { normalize } from 'pathe'
import { vi, describe as vitestDescribe, test as vitestTest } from 'vitest'
import * as testUtils from '../test-utils'

export function test(name: string, fn: TestFunction, skip = false) {
  if (process.env.COVERAGE_TEST !== 'true') {
    return vitestTest.skipIf(skip)(name, fn)
  }
}

export function describe(name: string, fn: () => void) {
  if (process.env.COVERAGE_TEST !== 'true') {
    return vitestDescribe(name, () => fn())
  }
}

export function coverageTest(name: string, fn: TestFunction) {
  if (process.env.COVERAGE_TEST === 'true') {
    return vitestTest(name, fn)
  }
}

export async function runVitest(config: UserConfig, options = { throwOnError: true }) {
  const provider = process.env.COVERAGE_PROVIDER as any

  const result = await testUtils.runVitest({
    config: 'fixtures/configs/vitest.config.ts',
    pool: 'threads',
    ...config,
    env: {
      COVERAGE_TEST: 'true',
      ...config.env,
    },
    coverage: {
      enabled: true,
      reporter: [],
      ...config.coverage,
      provider,
      customProviderModule: provider === 'custom' ? 'fixtures/custom-provider' : undefined,
    },
    browser: {
      enabled: process.env.COVERAGE_BROWSER === 'true',
      headless: true,
      name: 'chromium',
      provider: 'playwright',
      ...config.browser,
    },
  })

  if (options.throwOnError) {
    if (result.stderr !== '') {
      throw new Error(`stderr:\n${result.stderr}\n\nstdout:\n${result.stdout}`)
    }
  }

  return result
}

/**
 * Read JSON coverage report from file system.
 * Normalizes paths to keep contents consistent between OS's
 */
export async function readCoverageJson(name = './coverage/coverage-final.json') {
  const jsonReport = JSON.parse(readFileSync(name, 'utf8')) as Record<string, FileCoverageData>

  const normalizedReport: typeof jsonReport = {}

  for (const [filename, coverage] of Object.entries(jsonReport)) {
    coverage.path = normalizeFilename(coverage.path)
    normalizedReport[normalizeFilename(filename)] = coverage
  }

  return normalizedReport
}

/**
 * Read coverage report from file system as Istanbul's `CoverageMap`
 */
export async function readCoverageMap(name = './coverage/coverage-final.json') {
  const coverageJson = await readCoverageJson(name)
  return libCoverage.createCoverageMap(coverageJson)
}

export function normalizeFilename(filename: string) {
  return normalize(filename)
    .replace(normalize(process.cwd()), '<process-cwd>')
    .replace(normalize(resolve(process.cwd(), '../../')), '<project-root>')
}

export function isV8Provider() {
  return process.env.COVERAGE_PROVIDER === 'v8'
}

export function isBrowser() {
  return process.env.COVERAGE_BROWSER === 'true'
}

export function normalizeURL(importMetaURL: string) {
  return normalize(fileURLToPath(importMetaURL))
}

export function captureStdout() {
  const spy = vi.fn()
  const original = process.stdout.write
  process.stdout.write = spy

  return function collect() {
    process.stdout.write = original
    return stripVTControlCharacters(spy.mock.calls.map(call => call[0]).join(''))
  }
}
