import { type UserConfig, expect, test } from 'vitest'

import { runVitest } from '../../test-utils'

const configs: UserConfig[] = [
  { isolate: false, singleThread: true },
  { isolate: false, singleThread: false },
  { isolate: false, threads: true, minThreads: 1, maxThreads: 1 },
  { isolate: false, threads: false },
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
