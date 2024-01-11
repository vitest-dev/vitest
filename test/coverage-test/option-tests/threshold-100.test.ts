// eslint-disable-next-line ts/ban-ts-comment -- Type tests keep picking this file up and fails
// @ts-nocheck

import { assert, expect, test } from 'vitest'
import { getWorkerState } from 'vitest/src/utils.js'

test('thresholds.100 sets global thresholds to 100', () => {
  const state = getWorkerState()

  assert(state.config.coverage.provider === 'v8' || state.config.coverage.provider === 'istanbul')
  assert(state.config.coverage.thresholds !== undefined)

  expect(state.config.coverage.thresholds[100]).toBe(true)
  expect(state.config.coverage.thresholds.lines).toBe(100)
  expect(state.config.coverage.thresholds.branches).toBe(100)
  expect(state.config.coverage.thresholds.functions).toBe(100)
  expect(state.config.coverage.thresholds.statements).toBe(100)
})
