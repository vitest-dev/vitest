import { execa } from 'execa'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'

const customTsReporterPath = resolve(__dirname, '../src/custom-reporter.ts')
const customJSReporterPath = resolve(__dirname, '../src/custom-reporter.js')

async function run(...runOptions: string[]): Promise<string> {
  const root = resolve(__dirname, '..')

  const { stdout } = await execa('npx', ['vitest', 'run', ...runOptions], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    windowsHide: false,
  })

  return stdout
}

async function runWithRetry(...runOptions: string[]) {
  const count = 3

  for (let i = count; i >= 0; i--) {
    try {
      return await run(...runOptions)
    }
    catch (e) {
      if (i <= 0)
        throw e
    }
  }
}

describe.concurrent('custom reporters', () => {
  // On Windows and macOS child_process is very unstable, we skip testing it as the functionality is tested on Linux
  if ((process.platform === 'win32' || process.platform === 'darwin') && process.env.CI)
    return test.skip('skip on windows')

  const TIMEOUT = 60_000

  test('custom reporter instances defined in configuration works', async () => {
    const stdout = await runWithRetry('--config', 'custom-reporter.vitest.config.ts')
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('load no base on root custom reporter instances defined in configuration works', async () => {
    const stdout = await runWithRetry('--config', './reportTest2/custom-reporter-path.vitest.config.ts')
    expect(stdout).includes('hello from custom reporter')
  }, TIMEOUT)

  test('package.json dependencies reporter instances defined in configuration works', async () => {
    const stdout = await runWithRetry('--config', 'deps-reporter.vitest.config.ts')
    expect(stdout).includes('hello from package reporter')
  }, TIMEOUT)

  test('a path to a custom reporter defined in configuration works', async () => {
    const stdout = await runWithRetry('--config', 'custom-reporter-path.vitest.config.ts', '--reporter', customJSReporterPath)
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
})

