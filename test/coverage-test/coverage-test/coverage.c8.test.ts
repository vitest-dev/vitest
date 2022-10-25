import fs from 'fs'
import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

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

test('coverage c8', async () => {
  const coveragePath = resolve('./coverage/tmp/')
  const stat = fs.statSync(coveragePath)
  expect(stat.isDirectory()).toBe(true)
  const files = fs.readdirSync(coveragePath)
  expect(files.length > 0).toBe(true)
})

test('Should show coverage', async () => {
  const stdout = await run('--config', 'vitest.config-c8-coverage.ts', '--coverage')

  // For Vue SFC and vue + ts files
  expect(stdout).contain('not-SFC.ts')
  expect(stdout).not.contain('not-SFC.ts?vue')
  expect(stdout).contain('not-SFC.vue')
  expect(stdout).contain('SFC.vue')

  // For ts and js files
  expect(stdout).contain('math.ts')
  expect(stdout).contain('utils.js')
})
