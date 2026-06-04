import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { instances, provider, runInlineBrowserTests } from './utils'

const [firstInstance] = instances

test.runIf(provider.name === 'playwright')('exposes concurrencyId/workerId bounded by maxWorkers', async () => {
  const maxWorkers = 2
  const fileCount = 4

  const files: Record<string, string> = {}
  for (let i = 0; i < fileCount; i++) {
    files[`test/file-${i}.test.ts`] = `
      import { expect, test } from 'vitest'
      test('reads worker state', () => {
        const ctx = globalThis.__vitest_worker__.ctx
        expect(ctx.concurrencyId).toBeGreaterThanOrEqual(1)
        expect(ctx.workerId).toBe(ctx.concurrencyId)
        expect(String(ctx.workerId)).toBe(import.meta.env.VITEST_WORKER_ID)
        expect(String(ctx.concurrencyId)).toBe(import.meta.env.VITEST_POOL_ID)
      })
    `
  }

  const testModules: TestModule[] = []

  const { stderr, stdout } = await runInlineBrowserTests(files, {
    maxWorkers,
    browser: {
      fileParallelism: true,
      instances: [firstInstance],
    },
    reporters: [
      'default',
      {
        onTestModuleEnd(module) {
          testModules.push(module)
        },
      },
    ],
  })

  expect(stderr).toBe('')
  expect(testModules).toHaveLength(fileCount)

  const used = new Set<number>()
  for (const module of testModules) {
    const diagnostic = module.diagnostic()

    expect(stdout).toReportPassedTest(module.relativeModuleId, firstInstance.browser)

    expect(diagnostic.workerId).toBe(diagnostic.concurrencyId)
    expect(diagnostic.concurrencyId).toBeGreaterThanOrEqual(1)
    expect(diagnostic.concurrencyId).toBeLessThanOrEqual(maxWorkers)

    used.add(diagnostic.concurrencyId)
  }

  // the pool opens one tab per slot, so both slots are used and stay within range
  expect([...used].sort()).toEqual([1, 2])
})
