import { expect, test } from 'vitest'
import { isWindows } from '../../../packages/vite-node/src/utils'
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
  }, undefined, undefined, undefined, { preserveAnsi: true })

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
  }, undefined, undefined, undefined, { preserveAnsi: true })

  expect(stdout).toContain('true\n')
  expect(stdout).not.toContain('\x1B[33mtrue\x1B[39m\n')
})

test.skipIf(isWindows)('without color, forks pool in non-TTY parent', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/console-color',
    env: {
      CI: undefined,
      FORCE_COLOR: undefined,
      NO_COLOR: undefined,
      GITHUB_ACTIONS: undefined,

      // Overrides current process's value, since we are running Vitest in Vitest here
      FORCE_TTY: undefined,
    },
  }, undefined, undefined, undefined, { preserveAnsi: true })

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
  }, undefined, undefined, undefined, { preserveAnsi: true })

  expect(stdout).toContain('\x1B[33mtrue\x1B[39m\n')
})
