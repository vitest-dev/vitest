import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { execa } from 'execa'

const root = resolve(__dirname, '../../fixtures')

test('run mode', async () => {
  const { stdout } = await execa('npx', ['vitest', 'run'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
  })

  expect(stdout).not.includes('UI started at')
  expect(stdout).not.includes('HTML  Report is generated')
}, 60_000)

test('run mode with enable ui', async () => {
  const { stdout } = await execa('npx', ['vitest', 'run', '--ui'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
  })

  expect(stdout).not.includes('UI started at')
  expect(stdout).includes('HTML  Report is generated')
}, 60_000)
