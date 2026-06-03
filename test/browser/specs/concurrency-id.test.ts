import type { ModuleDiagnostic } from 'vitest/node'
import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

const [firstInstance] = instances

test('exposes concurrencyId/workerId bounded by maxWorkers', async () => {
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
      })
    `
  }

  const diagnostics: ModuleDiagnostic[] = []

  const { stderr } = await runInlineBrowserTests(files, {
    maxWorkers,
    browser: {
      fileParallelism: true,
      instances: [firstInstance],
    },
    reporters: [
      {
        onTestModuleEnd(module) {
          diagnostics.push(module.diagnostic())
        },
      },
    ],
  })

  expect(stderr).toBe('')
  expect(diagnostics).toHaveLength(fileCount)

  const used = new Set<number>()
  for (const diagnostic of diagnostics) {
    expect(diagnostic.workerId).toBe(diagnostic.concurrencyId)
    expect(diagnostic.concurrencyId).toBeGreaterThanOrEqual(1)
    expect(diagnostic.concurrencyId).toBeLessThanOrEqual(maxWorkers)
    used.add(diagnostic.concurrencyId)
  }

  // the pool opens one tab per slot, so both slots are used and stay within range
  expect([...used].sort()).toEqual([1, 2])
})
