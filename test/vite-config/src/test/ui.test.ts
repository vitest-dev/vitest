import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { execa } from 'execa'

const root = resolve(__dirname, '../../fixtures')
const skip = (process.platform === 'win32' || process.platform === 'darwin') && process.env.CI
const runWithEnableUI = (isEnable: boolean) => {
  return execa('npx', ['vitest', 'run', isEnable ? '--ui' : ''], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
  })
}

test.skipIf(skip)('run mode', async () => {
  const { stdout } = await runWithEnableUI(false)

  expect(stdout).not.includes('UI started at')
  expect(stdout).not.includes('HTML  Report is generated')
}, 60_000)

test.skipIf(skip)('run mode with enable ui', async () => {
  const { stdout } = await runWithEnableUI(true)

  expect(stdout).not.includes('UI started at')
  expect(stdout).includes('HTML  Report is generated')
  expect(stdout).not.includes('API started at http')
}, 60_000)
