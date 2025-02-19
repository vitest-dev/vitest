import type { UserConfig } from 'vitest/node'
import { expect, test } from 'vitest'

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
    root: './fixtures/mixed-environments',
    ...config,
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('✓ |Project #1| test/node.test.ts')
  expect(stdout).toContain('✓ |Project #1| test/jsdom.test.ts')
  expect(stdout).toContain('✓ |Project #2| test/jsdom.test.ts')
  expect(stdout).toContain('✓ |Project #1| test/happy-dom.test.ts')
  expect(stdout).toContain('✓ |Project #2| test/happy-dom.test.ts')
  expect(stdout).toContain('✓ |Project #1| test/workspace-project.test.ts')
  expect(stdout).toContain('✓ |Project #2| test/workspace-project.test.ts')
  expect(stdout).toContain('Test Files  8 passed (8)')
  expect(stdout).toContain('Tests  8 passed (8)')
})
