import { afterAll, beforeAll, expect, test } from 'vitest'
import { execa } from 'execa'
import { runVitest } from '../../test-utils'

// VITEST_SEGFAULT_RETRY messes with the node flags, as can be seen in packages/vitest/src/node/cli-wrapper.ts
// so here we remove it to make sure the tests are not affected by it
const ORIGIN_VITEST_SEGFAULT_RETRY = process.env.VITEST_SEGFAULT_RETRY
beforeAll(() => {
  delete process.env.VITEST_SEGFAULT_RETRY
})
afterAll(() => {
  process.env.VITEST_SEGFAULT_RETRY = ORIGIN_VITEST_SEGFAULT_RETRY
})

test.each([
  { pool: 'forks', execArgv: ['--hash-seed=1', '--random-seed=1', '--no-opt'] },
  { pool: 'threads', execArgv: ['--inspect-brk'] },
  { pool: 'vmThreads', execArgv: ['--inspect-brk'] },
] as const)('should pass execArgv to { pool: $pool } ', async ({ pool, execArgv }) => {
  const root = './fixtures/exec-args-fixtures'
  const fileToTest = `${pool}.test.ts`

  const vitest = await runVitest({
    root,
    include: [fileToTest],
    pool,
    poolOptions: {
      [pool]: {
        execArgv,
      },
    },
  })

  expect(vitest.stdout).toContain(`✓ ${fileToTest}`)
  expect(vitest.stderr).toBe('')
})

test('should not pass execArgv to workers when not specified in the config', async () => {
  const { stdout, stderr } = await execa('node', [
    '--title',
    'this-works-only-on-main-thread',
    '../../../../node_modules/vitest/vitest.mjs',
    '--run',
  ], {
    cwd: `${process.cwd()}/fixtures/no-exec-args-fixtures`,
    reject: false,
    env: {
      VITE_NODE_DEPS_MODULE_DIRECTORIES: '/node_modules/,/packages/',
      NO_COLOR: '1',
    },
  })

  expect(stderr).not.toContain('Error: Initiated Worker with invalid execArgv flags: --title')
  expect(stderr).not.toContain('ERR_WORKER_INVALID_EXEC_ARGV')
  expect(stdout).toContain('✓ no-exec-argv.test.ts')
})

test.only('should let allowed args pass to workers', async () => {
  const { stdout, stderr } = await execa('node', [
    '--heap-prof',
    '--diagnostic-dir=/tmp/vitest-diagnostics',
    '--heap-prof-name=heap.prof',
    '../../../../node_modules/vitest/vitest.mjs',
    '--run',
  ], {
    cwd: `${process.cwd()}/fixtures/allowed-exec-args-fixtures`,
    reject: false,
    env: {
      VITE_NODE_DEPS_MODULE_DIRECTORIES: '/node_modules/,/packages/',
      NO_COLOR: '1',
    },
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ allowed-exec-argv.test.ts')
})
