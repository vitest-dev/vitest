import { expect, test } from 'vitest'
import { runVitest, runVitestCli } from '../../test-utils'

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

test('agent', async () => {
  // Agent check is done on module import, so new process is needed
  const { stdout } = await runVitestCli({
    preserveAnsi: true,
    nodeOptions: { env: { AI_AGENT: 'copilot' } },
  }, '--root', 'fixtures/console-color', '--reporter', 'default')

  expect.soft(stdout).toContain('true\n')
  expect.soft(stdout).not.toContain('\x1B[33mtrue\x1B[39m\n')

  expect.soft(stdout).toContain(' RUN')
  expect.soft(stdout).not.toContain('\x1B[46m RUN')
})

test('agent keeps tinyrainbow colors enabled in user code', async () => {
  const { stdout } = await runVitestCli({
    preserveAnsi: true,
    nodeOptions: {
      env: {
        AI_AGENT: 'copilot',
        FORCE_COLOR: '1',
        NO_COLOR: undefined,
      },
    },
  }, '--root', 'fixtures/console-color-agent-user-code', '--reporter', 'default')

  expect.soft(stdout).toContain('✓ basic.test.ts')
  expect.soft(stdout).toContain(' RUN')
  expect.soft(stdout).not.toContain('\x1B[46m RUN')
})

test('agent keeps internal assertion output uncolored', async () => {
  const { stderr, stdout } = await runVitestCli({
    preserveAnsi: true,
    nodeOptions: {
      env: {
        AI_AGENT: 'copilot',
        FORCE_COLOR: '1',
        NO_COLOR: undefined,
      },
    },
  }, '--root', 'fixtures/console-color-agent-expect', '--reporter', 'default')

  expect.soft(stdout).toContain('basic.test.ts')
  expect.soft(stderr).toContain('expected')
  expect.soft(stderr).toContain('received')
  expect.soft(stderr).not.toContain('\x1B[32m')
  expect.soft(stderr).not.toContain('\x1B[31m')
  expect.soft(stderr).not.toContain('\x1B[33m')
  expect.soft(stderr).not.toContain('\x1B[90m')
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
