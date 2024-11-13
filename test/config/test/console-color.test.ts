import { x } from 'tinyexec'
import { expect, test } from 'vitest'

// use "tinyexec" directly since "runVitestCli" strips color

test('with color', async () => {
  const proc = await x('vitest', ['run', '--root=./fixtures/console-color'], {
    nodeOptions: {
      env: {
        CI: '1',
        FORCE_COLOR: '1',
        NO_COLOR: undefined,
        GITHUB_ACTIONS: undefined,
      },
    },
  })
  expect(proc.stdout).toContain('\x1B[33mtrue\x1B[39m\n')
})

test('without color', async () => {
  const proc = await x('vitest', ['run', '--root=./fixtures/console-color'], {
    nodeOptions: {
      env: {
        CI: '1',
        FORCE_COLOR: undefined,
        NO_COLOR: '1',
        GITHUB_ACTIONS: undefined,
      },
    },
  })
  expect(proc.stdout).toContain('true\n')
})
