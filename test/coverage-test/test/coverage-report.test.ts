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

test('Should show coverage', async () => {
  const stdout = await run('--config', 'vitest.config-coverage-report.ts', '--coverage')

  // For Vue SFC and vue + ts files
  expect(stdout).contain('not-SFC.ts')
  expect(stdout).not.contain('not-SFC.ts?vue')
  expect(stdout).contain('not-SFC.vue')
  expect(stdout).contain('SFC.vue')

  // For ts and js files
  expect(stdout).contain('math.ts')
  expect(stdout).contain('utils.js')
}, 40000)
