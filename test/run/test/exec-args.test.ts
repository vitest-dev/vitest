import { expect, test } from 'vitest'
import { execa } from 'execa'
import { runVitest } from '../../test-utils'

test.each([
  { pool: 'forks', execArgv: ['--hash-seed=1', '--random-seed=1', '--no-opt'] },
  { pool: 'threads', execArgv: ['--inspect-brk'] },
  { pool: 'vmThreads', execArgv: ['--inspect-brk'] },
] as const)('should pass execArgv to { pool: $pool } ', async ({ pool, execArgv }) => {
  const fileToTest = `exec-args-fixtures/${pool}.test.ts`

  const vitest = await runVitest({
    include: [fileToTest],
    pool,
    poolOptions: {
      [pool]: {
        execArgv,
      },
    },
  })

  expect(vitest.stdout).toContain(`✓ ${fileToTest}`)
})

test('should not pass execArgv to workers when not specified in the config', async () => {
  const { stdout, stderr } = await execa('node', [
    '--title', 'this-works-only-on-main-thread',
    './node_modules/vitest/vitest.mjs', '--run',
    '--root', 'no-exec-args-fixtures', '--dir', 'no-exec-args-fixtures',
  ], {
    reject: false,
    env: {
      VITE_NODE_DEPS_MODULE_DIRECTORIES: '/node_modules/,/packages/',
    },
  })

  expect(stderr).not.toContain('Error: Initiated Worker with invalid execArgv flags: --title')
  expect(stderr).not.toContain('ERR_WORKER_INVALID_EXEC_ARGV')
  expect(stdout).toContain('✓ no-exec-argv.test.ts')
})
