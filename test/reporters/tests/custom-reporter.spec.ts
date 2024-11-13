import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'

import { runVitest, runVitestCli } from '../../test-utils'
import TestReporter from '../src/custom-reporter'

const customTsReporterPath = resolve(__dirname, '../src/custom-reporter.ts')
const customJSReporterPath = resolve(__dirname, '../src/custom-reporter.js')
const root = resolve(__dirname, '..')

async function runWithRetry(...runOptions: string[]) {
  const count = 3

  for (let i = count; i >= 0; i--) {
    try {
      const vitest = await runVitestCli({ nodeOptions: { cwd: root, windowsHide: false } }, 'run', ...runOptions)
      return vitest.stdout
    }
    catch (e) {
      if (i <= 0) {
        throw e
      }
    }
  }
}

describe('custom reporters', () => {
  // On Windows and macOS child_process is very unstable, we skip testing it as the functionality is tested on Linux
  if ((process.platform === 'win32' || process.platform === 'darwin') && process.env.CI) {
    return test.skip('skip on windows')
  }

  const TIMEOUT = 60_000

  test('custom reporter instances works', async () => {
    const { stdout } = await runVitest({ root, reporters: [new TestReporter()], include: ['tests/reporters.spec.ts'] })
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('load no base on root custom reporter instances defined in configuration works', async () => {
    const { stdout, stderr } = await runVitest({ reporters: 'none', config: './reportTest2/custom-reporter-path.vitest.config.ts' })
    expect(stderr).toBe('')
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('package.json dependencies reporter instances defined in configuration works', async () => {
    const { stdout } = await runVitest({
      root,
      include: ['tests/reporters.spec.ts'],
      reporters: ['pkg-reporter', 'vitest-sonar-reporter'],
      outputFile: './sonar-config.xml',
    })
    expect(stdout).includes('hello from package reporter')
  }, TIMEOUT)

  test('a path to a custom reporter defined in configuration works', async () => {
    const { stdout } = await runVitest({ root, reporters: customJSReporterPath, include: ['tests/reporters.spec.ts'] })
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('custom TS reporters using ESM given as a CLI argument works', async () => {
    const stdout = await runWithRetry('--config', 'without-custom-reporter.vitest.config.ts', '--reporter', customTsReporterPath)
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('custom JS reporters using CJS given as a CLI argument works', async () => {
    const stdout = await runWithRetry('--config', 'without-custom-reporter.vitest.config.ts', '--reporter', customJSReporterPath)
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('overrides reporters by given a CLI argument --reporter works', async () => {
    const stdout = await runWithRetry('--config', 'deps-reporter.vitest.config.ts', '--reporter', customJSReporterPath)
    expect(stdout).not.includes('hello from package reporter')
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('custom reporter with options', async () => {
    const { stdout } = await runVitest({ root, reporters: [[customTsReporterPath, { some: { custom: 'option here' } }]], include: ['tests/reporters.spec.ts'] })
    expect(stdout).includes('hello from custom reporter')
    expect(stdout).includes('custom reporter options {"some":{"custom":"option here"}}')
  }, TIMEOUT)
})
