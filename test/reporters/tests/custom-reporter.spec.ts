import { execa } from 'execa'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'

const customReporterPath = resolve(__dirname, '../src/custom-reporter.js')

async function runTest(...runOptions) {
  // On Windows child_process is very unstable, we skip testing it
  if (process.platform === 'win32' && process.env.CI)
    return

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
    const stdout = await runTest('--config', 'custom-reporter.vitest.config.ts')
    expect(stdout).toContain('hello from custom reporter')
  }, 40000)

  test('custom reporters given as a CLI argument work', async() => {
    const stdout = await runTest('--config', 'without-custom-reporter.vitest.config.ts', '--reporter', customReporterPath)
    expect(stdout).toContain('hello from custom reporter')
  }, 40000)
})
