import { execa } from 'execa'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'

const customTsReporterPath = resolve(__dirname, '../src/custom-reporter.ts')
const customJSReporterPath = resolve(__dirname, '../src/custom-reporter.js')

async function runTest(...runOptions: string[]): Promise<string> {
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

describe('Custom reporters', () => {
  test('custom reporters defined in configuration work', async() => {
    // On Windows child_process is very unstable, we skip testing it
    if (process.platform === 'win32' && process.env.CI)
      return

    const stdout = await runTest('--config', 'custom-reporter.vitest.config.ts')
    expect(stdout).includes('hello from custom reporter')
  }, 40000)

  test('custom TS reporters using ESM given as a CLI argument work', async() => {
    // On Windows child_process is very unstable, we skip testing it
    if (process.platform === 'win32' && process.env.CI)
      return

    const stdout = await runTest('--config', 'without-custom-reporter.vitest.config.ts', '--reporter', customTsReporterPath)
    expect(stdout).includes('hello from custom reporter')
  }, 40000)

  test('custom JS reporters using CJS given as a CLI argument work', async() => {
    // On Windows child_process is very unstable, we skip testing it
    if (process.platform === 'win32' && process.env.CI)
      return

    const stdout = await runTest('--config', 'without-custom-reporter.vitest.config.ts', '--reporter', customJSReporterPath)
    expect(stdout).includes('hello from custom reporter')
  }, 40000)
})
