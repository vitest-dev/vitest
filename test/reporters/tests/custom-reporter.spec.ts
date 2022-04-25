import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('custom reporters work', async () => {
  // in Windows child_process is very unstable, we skip testing it
  if (process.platform === 'win32' && process.env.CI)
    return

  const root = resolve(__dirname, '..')

  const { stdout } = await execa('npx', ['vitest', 'run', '--config', 'custom-reporter.vitest.config.ts'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    windowsHide: false,
  })

  expect(stdout).toContain('hello from custom reporter')
}, 40000)
