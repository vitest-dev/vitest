import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test.skip('custom resolvers work with threads', async() => {
  const root = resolve(__dirname, '..')

  const { stdout } = await execa('npx', ['vitest', 'run', '--config', 'custom-reporter.vitest.config.ts'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
  })

  expect(stdout).toContain('hello from custom reporter')
}, 20000)
