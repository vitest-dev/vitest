import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('with color', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/console-color',
    env: {
      CI: '1',
      FORCE_COLOR: '1',
      NO_COLOR: undefined,
      GITHUB_ACTIONS: undefined,
    },
  }, [], { preserveAnsi: true })

  expect(stdout).toContain('\x1B[33mtrue\x1B[39m\n')
})

test('without color', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/console-color',
    env: {
      CI: '1',
      FORCE_COLOR: undefined,
      NO_COLOR: '1',
      GITHUB_ACTIONS: undefined,
    },
  }, [], { preserveAnsi: true })

  expect(stdout).toContain('true\n')
  expect(stdout).not.toContain('\x1B[33mtrue\x1B[39m\n')
})

test.skipIf(process.platform === 'win32')('without color, forks pool in non-TTY parent', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/console-color',
    env: {
      CI: undefined,
      FORCE_COLOR: undefined,
      NO_COLOR: undefined,
      GITHUB_ACTIONS: undefined,

      // Overrides current process's value, since we are running Vitest in Vitest here
      // By default, tinyrainbow doesn't check isatty since version 3, but
      // FORCE_TTY=false will make the check `false`
      FORCE_TTY: 'false',
    },
  }, [], { preserveAnsi: true })

  expect(stdout).toContain('true\n')
  expect(stdout).not.toContain('\x1B[33mtrue\x1B[39m\n')
})

test('with color, forks pool in TTY parent', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/console-color',
    env: {
      CI: undefined,
      FORCE_COLOR: undefined,
      NO_COLOR: undefined,
      GITHUB_ACTIONS: undefined,
    },
  }, [], { preserveAnsi: true })

  expect(stdout).toContain('\x1B[33mtrue\x1B[39m\n')
})
