import { assert, expect } from 'vitest'
import { getWorkerState } from 'vitest/src/utils.js'
import { coverageTest, normalizeURL, runVitest, test } from '../utils'

test('{ threshold: { 100: true }}', async () => {
  await runVitest({
    include: [normalizeURL(import.meta.url)],
    coverage: { thresholds: { 100: true } },
  }, { throwOnError: false })
})

coverageTest('thresholds.100 sets global thresholds to 100', () => {
  const state = getWorkerState()

  assert(state.config.coverage.provider === 'v8' || state.config.coverage.provider === 'istanbul')
  assert(state.config.coverage.thresholds !== undefined)

  expect(state.config.coverage.thresholds[100]).toBe(true)
  expect(state.config.coverage.thresholds.lines).toBe(100)
  expect(state.config.coverage.thresholds.branches).toBe(100)
  expect(state.config.coverage.thresholds.functions).toBe(100)
  expect(state.config.coverage.thresholds.statements).toBe(100)
})
