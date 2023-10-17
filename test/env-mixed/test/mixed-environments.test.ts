import { type UserConfig, expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

const configs: UserConfig[] = [
  { pool: 'threads', poolOptions: { threads: { isolate: false, singleThread: true } } },
  { pool: 'threads', poolOptions: { threads: { isolate: false, singleThread: false } } },
  { pool: 'threads', poolOptions: { threads: { isolate: false, minThreads: 1, maxThreads: 1 } } },
  { pool: 'forks', poolOptions: { forks: { isolate: true } } },
  { pool: 'forks', poolOptions: { forks: { isolate: false } } },
]

test.each(configs)('should isolate environments when %s', async (config) => {
  const { stderr, stdout } = await runVitest({
    root: './fixtures',
    ...config,
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('✓ test/node.test.ts')
  expect(stdout).toContain('✓ test/jsdom.test.ts')
  expect(stdout).toContain('✓ test/happy-dom.test.ts')
  expect(stdout).toContain('✓ test/workspace-project.test.ts')
  expect(stdout).toContain('Test Files  8 passed (8)')
  expect(stdout).toContain('Tests  8 passed (8)')
})
