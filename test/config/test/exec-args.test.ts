import { x } from 'tinyexec'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const [nodeMajor, nodeMinor] = process.version.slice(1).split('.').map(Number)

test.each([
  { pool: 'forks', execArgv: ['--hash-seed=1', '--random-seed=1', '--no-opt'] },
  { pool: 'threads', execArgv: ['--inspect-brk'] },
  { pool: 'vmThreads', execArgv: ['--inspect-brk'] },
] as const)('should pass execArgv to { pool: $pool } ', async ({ pool, execArgv }) => {
  const root = './fixtures/exec-args-fixtures'
  const fileToTest = `${pool}.test.ts`

  // TODO: node.js has a bug that makes --inspect-brk not work on worker threads
  if (pool !== 'forks') {
    if ((nodeMajor === 20 && nodeMinor > 14) || (nodeMajor > 20)) {
      return
    }
  }

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
  const { stdout, stderr } = await x('node', [
    '--title',
    'this-works-only-on-main-thread',
    '../../../../node_modules/vitest/vitest.mjs',
    '--run',
  ], {
    nodeOptions: {
      cwd: `${process.cwd()}/fixtures/no-exec-args-fixtures`,
      env: {
        VITE_NODE_DEPS_MODULE_DIRECTORIES: '/node_modules/,/packages/',
        NO_COLOR: '1',
      },
    },
    throwOnError: false,
  })

  expect(stderr).not.toContain('Error: Initiated Worker with invalid execArgv flags: --title')
  expect(stderr).not.toContain('ERR_WORKER_INVALID_EXEC_ARGV')
  expect(stdout).toContain('✓ no-exec-argv.test.ts')
})

test('should let allowed args pass to workers', async () => {
  const { stdout, stderr } = await x('node', [
    '--heap-prof',
    '--diagnostic-dir=/tmp/vitest-diagnostics',
    '--heap-prof-name=heap.prof',
    '../../../../node_modules/vitest/vitest.mjs',
    '--run',
  ], {
    nodeOptions: {
      cwd: `${process.cwd()}/fixtures/allowed-exec-args-fixtures`,
      env: {
        VITE_NODE_DEPS_MODULE_DIRECTORIES: '/node_modules/,/packages/',
        NO_COLOR: '1',
      },
    },
    throwOnError: false,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('✓ allowed-exec-argv.test.ts')
})
