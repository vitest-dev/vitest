// TODO: deprecate <reference types="vitest" /> in favor of `<reference types="vitest/config" />`
import './node/types/vite'
import './global'

export {
  suite,
  test,
  describe,
  it,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  onTestFailed,
  onTestFinished,
} from '@vitest/runner'
export { bench } from './runtime/benchmark'

export { runOnce, isFirstRun } from './integrations/run-once'
export { createExpect, assert, should, chai, expect } from './integrations/chai'
export { vi, vitest } from './integrations/vi'
export { getRunningMode, isWatchMode } from './integrations/utils'
export { inject } from './integrations/inject'

export type { VitestUtils } from './integrations/vi'

export * from './types'
export type {
  TransformResultWithSource,
  WebSocketHandlers,
  WebSocketEvents,
  WebSocketRPC,
} from './api/types'
