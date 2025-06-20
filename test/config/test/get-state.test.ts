import type { TestUserConfig } from 'vitest/node'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test.for([
  { isolate: true },
  { isolate: false, minWorkers: 1, maxWorkers: 1 },
  { isolate: false, fileParallelism: false },
  { isolate: false, poolOptions: { forks: { singleFork: true } } },
] satisfies TestUserConfig[])(`getState().testPath during collection %s`, async (config) => {
  const result = await runVitest({
    root: './fixtures/get-state',
    ...config,
  })
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('✓ a.test.ts')
  expect(result.stdout).toContain('✓ b.test.ts')
  expect(result.stdout).toContain('✓ c.test.ts')
})
