import { assert, expect, inject } from 'vitest'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

declare module 'vitest' {
  export interface ProvidedContext {
    coverage: {
      provider: string | undefined
      thresholds: {
        [key: string]: any
      }
    }
  }
}

test('{ threshold: { 100: true }}', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { thresholds: { 100: true } },
    reporters: [
      'verbose',
      {
        onInit(ctx) {
          ctx.getRootProject().provide('coverage', {
            provider: ctx.config.coverage.provider,
            thresholds: (ctx.config.coverage as any).thresholds,
          })
        },
      },
    ],
  }, { throwOnError: false })
})

coverageTest('thresholds.100 sets global thresholds to 100', () => {
  const coverage = inject('coverage')

  assert(coverage.provider === 'v8' || coverage.provider === 'istanbul')
  assert(coverage.thresholds !== undefined)

  expect(coverage.thresholds[100]).toBe(true)
  expect(coverage.thresholds.lines).toBe(100)
  expect(coverage.thresholds.branches).toBe(100)
  expect(coverage.thresholds.functions).toBe(100)
  expect(coverage.thresholds.statements).toBe(100)
})
